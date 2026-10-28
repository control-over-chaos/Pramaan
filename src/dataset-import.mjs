import { createHash } from 'node:crypto';
import { db, allRows, oneRow, execute } from './db.mjs';
import { writeAudit } from './audit.mjs';

// This format describes an explicitly synthetic test package. It is never an
// authority for accounts, real source checks, approvals, or published rules.
const entities = {
  institutions: ['institution_id', ['name', 'city', 'state', 'country', 'institution_type', 'website', 'record_origin', 'verification_status', 'regulatory_scope']],
  applications: ['application_id', ['institution_id', 'application_type', 'academic_year', 'submitted_at', 'assigned_officer', 'stage', 'scenario', 'record_origin']],
  programs: ['program_id', ['institution_id', 'program_name', 'level', 'record_origin', 'note']],
  faculty: ['faculty_id', ['institution_id', 'display_name', 'department', 'qualification', 'employment_status', 'record_origin']],
  documents: ['document_id', ['application_id', 'institution_id', 'document_type', 'filename', 'issued_on', 'expires_on', 'ocr_status', 'source_status', 'anomaly_flag', 'record_origin', 'note']],
  infrastructure: ['claim_id', ['application_id', 'asset_type', 'evidence_status', 'record_origin']],
  rules: ['rule_id', ['category', 'description', 'regulatory_reference', 'status', 'record_origin']],
  rule_evaluations: ['evaluation_id', ['application_id', 'rule_id', 'result', 'record_origin']],
  source_verifications: ['verification_id', ['document_id', 'provider', 'status', 'response_code', 'record_origin']],
  findings: ['finding_id', ['application_id', 'category', 'severity', 'description', 'status', 'evidence_document_id', 'rule_id', 'record_origin', 'human_decision']],
  rectifications: ['rectification_id', ['finding_id', 'application_id', 'status', 'record_origin']],
  inspections: ['inspection_id', ['application_id', 'reason', 'status', 'record_origin']],
  users: ['user_id', ['name', 'role', 'email', 'record_origin']],
  audit_events: ['event_id', ['application_id', 'actor_id', 'action', 'event_time', 'record_origin']],
};
const stageMap = {
  'Under Validation': 'PRE_VALIDATION',
  'Documents Processing': 'DOCUMENT_PROCESSING',
  'Source Verification': 'SOURCE_VERIFICATION',
  'Compliance Review': 'COMPLIANCE_REVIEW',
  'Findings Review': 'OFFICER_REVIEW',
  'Infrastructure Review': 'OFFICER_REVIEW',
  Rectification: 'RECTIFICATION_RECEIVED',
  'Inspection Review': 'INSPECTION_RECOMMENDED',
};
const operationalTables = {
  institutions: 'institutions', applications: 'applications', programs: 'programmes', faculty: 'faculty_records',
  documents: 'documents', infrastructure: 'infrastructure_evidence', rules: 'regulatory_rules',
  rule_evaluations: 'compliance_results', source_verifications: 'verifications', findings: 'findings',
  rectifications: 'rectifications', inspections: 'inspections',
};
const warnings = [
  'Institution identities are public reference data. Every application and operational record is synthetic test data, not an actual AICTE filing or decision.',
  'The package contains document metadata only. No genuine PDFs or evidence files are attached; download and document processing are unavailable until actual files are uploaded.',
  'Source checks are simulated TEST_ONLY records. They do not verify documents or enable external providers.',
  'Programme capacities are illustrative. Approved intake and current approval status remain unknown.',
  'Illustrative rules have unmapped regulatory references and remain drafts. Imported evaluations are historical test outcomes, not live compliance results.',
  'Sample users are retained as source records only. No login accounts, passwords, roles, or officer assignments are created.',
  'Original sample audit events are preserved as source records. A separate live audit event records this import.',
  'Finding rule references are preserved as supplied. Rules from separate packages remain in separate draft versions.',
];

export function ensureDatasetSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dataset_import_batches (
      id TEXT PRIMARY KEY, digest TEXT NOT NULL UNIQUE, label TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id), imported_at TEXT NOT NULL,
      counts_json TEXT NOT NULL, warnings_json TEXT NOT NULL, record_count INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dataset_records (
      batch_id TEXT NOT NULL REFERENCES dataset_import_batches(id), table_name TEXT NOT NULL,
      source_record_id TEXT NOT NULL, entity_id TEXT NOT NULL, record_origin TEXT NOT NULL,
      record_json TEXT NOT NULL, PRIMARY KEY(batch_id,table_name,source_record_id)
    );
    CREATE INDEX IF NOT EXISTS dataset_records_entity_idx ON dataset_records(table_name,entity_id);
    CREATE TABLE IF NOT EXISTS faculty_records (
      id TEXT PRIMARY KEY, institution_id TEXT NOT NULL REFERENCES institutions(id), display_name TEXT NOT NULL,
      department TEXT NOT NULL, qualification TEXT NOT NULL, employment_status TEXT NOT NULL,
      record_origin TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS faculty_records_institution_idx ON faculty_records(institution_id,display_name);
  `);
  if (!allRows('PRAGMA table_info(dataset_records)').some((column) => column.name === 'source_record_json')) {
    db.exec("ALTER TABLE dataset_records ADD COLUMN source_record_json TEXT NOT NULL DEFAULT ''");
  }
}
ensureDatasetSchema();

function invalid(message, status = 400) {
  throw Object.assign(new Error(message), { status, code: status === 409 ? 'DATASET_CONFLICT' : 'DATASET_VALIDATION_ERROR' });
}
function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}
export function datasetEntityId(tableName, sourceId) {
  if (tableName === 'applications') return sourceId;
  const hash = createHash('sha256').update(`pramaan-synthetic-import-v1\0${tableName}\0${sourceId}`).digest('hex');
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
}
function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
function normalizeDataset(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Choose the Pramaan JSON dataset object.');
  const dataset = structuredClone(input), notices = [];
  let shifted = 0, numbers = 0, booleans = 0;
  for (const row of Array.isArray(dataset.institutions) ? dataset.institutions : []) {
    // A known export defect omits country, shifting the final six cells left.
    // Match the complete signature before correcting it; preserve raw cells below.
    if (row && row.website === 'PUBLIC_IDENTITY' && row.regulatory_scope === null
      && typeof row.institution_type === 'string' && /^https?:\/\//.test(row.institution_type)
      && typeof row.country === 'string' && typeof row.record_origin === 'string' && typeof row.verification_status === 'string'
      && ['West Bengal','Tamil Nadu','Rajasthan','Delhi','Punjab','Maharashtra','Uttar Pradesh'].includes(row.state)) {
      const original = { ...row };
      row.country = 'India'; row.institution_type = original.country; row.website = original.institution_type;
      row.record_origin = original.website; row.verification_status = original.record_origin; row.regulatory_scope = original.verification_status;
      shifted++;
    }
  }
  for (const [table, field] of [['programs','intake_capacity'],['infrastructure','claimed_units']]) {
    for (const row of Array.isArray(dataset[table]) ? dataset[table] : []) {
      if (row && typeof row[field] === 'string' && /^\d+$/.test(row[field]) && Number.isSafeInteger(Number(row[field]))) {
        row[field] = Number(row[field]); numbers++;
      }
    }
  }
  for (const row of Array.isArray(dataset.documents) ? dataset.documents : []) {
    if (row && row.file_exists === 'False') { row.file_exists = false; booleans++; }
  }
  if (shifted) notices.push(`Corrected ${shifted} institution rows affected by the missing-country export column. Country is inferred as India from the supplied Indian locations; original cells remain preserved.`);
  if (numbers) notices.push(`Converted ${numbers} numeric text values to integers without changing their values.`);
  if (booleans) notices.push(`Converted ${booleans} explicit False file flags to boolean false; no files are supplied.`);
  return { dataset, notices };
}
function validate(dataset) {
  if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) invalid('Choose the Pramaan JSON dataset object.');
  for (const key of Object.keys(dataset)) if (!Object.hasOwn(entities, key)) invalid(`Unsupported dataset table: ${key}.`);
  const maps = {}, counts = {};
  let recordCount = 0;
  for (const [table, [key, required]] of Object.entries(entities)) {
    if (!Array.isArray(dataset[table])) invalid(`${table} must be an array.`);
    counts[table] = dataset[table].length;
    recordCount += counts[table];
    if (recordCount > 20000) invalid('Dataset exceeds 20,000 source records.');
    maps[table] = new Map();
    for (const row of dataset[table]) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) invalid(`${table} contains a row that is not an object.`);
      if (typeof row[key] !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,149}$/.test(row[key])) invalid(`${table}.${key} must be a valid source identifier.`);
      if (maps[table].has(row[key])) invalid(`${table} contains duplicate identifier ${row[key]}.`);
      for (const field of required) if (typeof row[field] !== 'string' || !row[field].trim() || row[field].length > 5000) invalid(`${table} ${row[key]} requires text field ${field} (1–5,000 characters).`);
      if (row.record_origin !== (table === 'institutions' ? 'PUBLIC_IDENTITY' : 'SYNTHETIC_TEST')) invalid(`${table} ${row[key]} has an unsupported record_origin. This importer accepts the public-identity/synthetic-test package format only.`);
      maps[table].set(row[key], row);
    }
  }
  if (!counts.institutions || !counts.applications) invalid('The dataset must contain institutions and applications.');
  const ref = (table, id, label) => {
    const row = maps[table].get(id);
    if (!row) invalid(`${label} references missing ${table} record ${String(id)}.`);
    return row;
  };
  const status = (row, field, allowed, label) => { if (!allowed.includes(row[field])) invalid(`${label} has unsupported ${field}: ${row[field]}.`); };
  for (const row of dataset.institutions) {
    let url; try { url = new URL(row.website); } catch { invalid(`${row.institution_id} has an invalid website URL.`); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) invalid(`${row.institution_id} has an unsupported website URL.`);
  }
  for (const row of dataset.applications) {
    ref('institutions', row.institution_id, row.application_id); ref('users', row.assigned_officer, row.application_id);
    if (!Object.hasOwn(stageMap, row.stage)) invalid(`${row.application_id} has unsupported stage ${row.stage}.`);
    const year = row.academic_year.match(/^(20\d{2})-(\d{2})$/);
    if (!year || Number(year[2]) !== (Number(year[1])+1)%100 || !validDate(row.submitted_at)) invalid(`${row.application_id} has an invalid academic year or submission date.`);
  }
  for (const row of dataset.programs) {
    ref('institutions', row.institution_id, row.program_id);
    if (!Number.isInteger(row.intake_capacity) || row.intake_capacity < 0 || row.intake_capacity > 100000) invalid(`${row.program_id} has an invalid illustrative intake_capacity.`);
  }
  for (const row of dataset.faculty) {
    ref('institutions', row.institution_id, row.faculty_id);
    status(row, 'employment_status', ['Active','Needs Review'], row.faculty_id);
  }
  for (const row of dataset.documents) {
    const app = ref('applications', row.application_id, row.document_id);
    ref('institutions', row.institution_id, row.document_id);
    if (app.institution_id !== row.institution_id) invalid(`${row.document_id} belongs to a different institution from its application.`);
    if (row.file_exists !== false) invalid(`${row.document_id}: this import format contains metadata only; file_exists must be false.`);
    if (!validDate(row.issued_on) || !validDate(row.expires_on)) invalid(`${row.document_id} contains an invalid issue or expiry date.`);
    status(row, 'ocr_status', ['Processed'], row.document_id);
    status(row, 'source_status', ['Not externally verified','Unavailable'], row.document_id);
    status(row, 'anomaly_flag', ['None','Expired in test scenario','Review suspected alteration','TEST_MISMATCH'], row.document_id);
  }
  for (const row of dataset.infrastructure) {
    ref('applications', row.application_id, row.claim_id);
    if (!Number.isInteger(row.claimed_units) || row.claimed_units < 0 || row.claimed_units > 1000000) invalid(`${row.claim_id} has invalid claimed_units.`);
    status(row, 'evidence_status', ['Sample evidence pending','Needs Review'], row.claim_id);
  }
  for (const row of dataset.rules) status(row, 'status', ['Illustrative only'], row.rule_id);
  for (const row of dataset.rule_evaluations) {
    ref('applications', row.application_id, row.evaluation_id); ref('rules', row.rule_id, row.evaluation_id);
    status(row, 'result', ['TEST_PASS','NEEDS_REVIEW','TEST_FAIL','TEST_REVIEW'], row.evaluation_id);
  }
  for (const row of dataset.source_verifications) {
    ref('documents', row.document_id, row.verification_id);
    status(row, 'status', ['Simulated','Unavailable'], row.verification_id); status(row, 'response_code', ['TEST_ONLY'], row.verification_id);
  }
  for (const row of dataset.findings) {
    ref('applications', row.application_id, row.finding_id); ref('rules', row.rule_id, row.finding_id);
    const doc = ref('documents', row.evidence_document_id, row.finding_id);
    if (doc.application_id !== row.application_id) invalid(`${row.finding_id} references evidence from another application.`);
    status(row, 'severity', ['High','Medium','Low','Critical'], row.finding_id);
    status(row, 'status', ['Pending Review','Rectification Received'], row.finding_id);
    status(row, 'human_decision', ['Not made'], row.finding_id);
  }
  for (const row of dataset.rectifications) {
    ref('applications', row.application_id, row.rectification_id);
    const finding = ref('findings', row.finding_id, row.rectification_id);
    if (row.replacement_document_id !== undefined && row.replacement_document_id !== null && typeof row.replacement_document_id !== 'string') invalid(`${row.rectification_id} has invalid replacement_document_id.`);
    const doc = row.replacement_document_id ? ref('documents', row.replacement_document_id, row.rectification_id) : null;
    if (finding.application_id !== row.application_id || (doc && doc.application_id !== row.application_id)) invalid(`${row.rectification_id} references records from different applications.`);
    status(row, 'status', ['Received'], row.rectification_id);
  }
  for (const row of dataset.inspections) { ref('applications', row.application_id, row.inspection_id); status(row, 'status', ['Recommendation Pending'], row.inspection_id); }
  for (const row of dataset.audit_events) {
    ref('applications', row.application_id, row.event_id); ref('users', row.actor_id, row.event_id);
    if (Number.isNaN(Date.parse(row.event_time))) invalid(`${row.event_id} has invalid event_time.`);
  }
  return { maps, counts, recordCount };
}

const identityText = (value) => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
function websiteHost(value) {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}
function buildPlan(dataset, digest) {
  const institutionIds = new Map(), reused = [];
  const candidates = allRows('SELECT id,name,district,state_ut FROM institutions');
  for (const row of dataset.institutions) {
    const matches = candidates.filter((candidate) => identityText(candidate.name) === identityText(row.name)
      && identityText(candidate.district) === identityText(row.city) && identityText(candidate.state_ut) === identityText(row.state))
      .filter((candidate) => allRows("SELECT record_json FROM dataset_records WHERE table_name='institutions' AND entity_id=? AND record_origin='PUBLIC_IDENTITY'", candidate.id)
        .some((source) => websiteHost(JSON.parse(source.record_json).website) === websiteHost(row.website)));
    if (matches.length > 1) invalid(`Institution ${row.institution_id} matches multiple stored profiles; resolve the duplicate before importing.`, 409);
    const localId = matches[0]?.id || datasetEntityId('institutions', row.institution_id);
    institutionIds.set(row.institution_id, localId);
    if (matches.length) reused.push({ sourceId: row.institution_id, entityId: localId, name: row.name });
  }
  const id = (table, sourceId) => table === 'institutions' ? institutionIds.get(sourceId)
    : table === 'rules' ? datasetEntityId('rules', `${digest}:${sourceId}`) : datasetEntityId(table, sourceId);
  const ruleCollisions = dataset.rules.filter((row) => oneRow("SELECT 1 FROM dataset_records WHERE table_name='rules' AND source_record_id=? LIMIT 1", row.rule_id)).length;
  const notices = [];
  if (reused.length) notices.push(`Reused ${reused.length} existing institution profile(s) with matching name, location and public website: ${reused.map((row) => `${row.name} (${row.sourceId})`).join(', ')}. Their earlier records remain unchanged.`);
  if (ruleCollisions) notices.push(`${ruleCollisions} source rule identifier(s) also occur in an earlier package. This package receives separate draft rule IDs and its own historical evaluation links.`);
  return { id, reused, notices };
}
function checkConflicts(dataset, plan) {
  for (const [table, storageTable] of Object.entries(operationalTables)) {
    const [key] = entities[table];
    for (const row of dataset[table]) {
      if (table === 'institutions' && plan.reused.some((entry) => entry.sourceId === row[key])) continue;
      const id = plan.id(table, row[key]);
      if (oneRow(`SELECT id FROM ${storageTable} WHERE id=?`, id)) invalid(`Source ${table} record ${row[key]} is already stored by a different import. Existing records will not be overwritten.`, 409);
      if (table === 'institutions' && oneRow('SELECT id FROM institutions WHERE aicte_id=?', `IMPORT:${row[key]}`)) invalid(`Institution source identifier ${row[key]} conflicts with an existing record.`, 409);
      if (table === 'applications' && oneRow('SELECT id FROM applications WHERE external_reference=?', row[key])) invalid(`Application reference ${row[key]} conflicts with an existing record.`, 409);
    }
  }
}

export function previewDataset(dataset) {
  const normalized = normalizeDataset(dataset);
  const digest = createHash('sha256').update(stableJson(dataset)).digest('hex');
  const { counts, recordCount } = validate(normalized.dataset);
  const existing = oneRow('SELECT id,imported_at FROM dataset_import_batches WHERE digest=?', digest);
  const plan = existing ? null : buildPlan(normalized.dataset, digest);
  if (!existing) checkConflicts(normalized.dataset, plan);
  const saved = existing ? oneRow('SELECT warnings_json FROM dataset_import_batches WHERE id=?', existing.id) : null;
  return { digest, counts, recordCount, warnings: saved ? JSON.parse(saved.warnings_json) : [...warnings,...normalized.notices,...plan.notices], reusedInstitutions: plan?.reused || [], alreadyImported: Boolean(existing), batchId: existing?.id || null, importedAt: existing?.imported_at || null };
}

export function listDatasetImports() {
  return allRows('SELECT id,digest,label,created_by,imported_at,counts_json,warnings_json,record_count FROM dataset_import_batches ORDER BY imported_at DESC').map((row) => ({
    id: row.id, digest: row.digest, label: row.label, createdBy: row.created_by, importedAt: row.imported_at,
    counts: JSON.parse(row.counts_json), warnings: JSON.parse(row.warnings_json), recordCount: row.record_count,
  }));
}
export function getDatasetProvenance(tableName, entityId) {
  const row = oneRow(`SELECT r.*,b.imported_at FROM dataset_records r JOIN dataset_import_batches b ON b.id=r.batch_id
    WHERE r.table_name=? AND r.entity_id=? ORDER BY b.imported_at DESC LIMIT 1`, tableName, entityId);
  return row ? { batchId: row.batch_id, sourceId: row.source_record_id, recordOrigin: row.record_origin, importedAt: row.imported_at, record: JSON.parse(row.record_json), originalRecord: JSON.parse(row.source_record_json || row.record_json) } : null;
}

export function importDataset(dataset, context) {
  const actor = context?.user?.id;
  if (!actor || !oneRow(`SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id=u.id
    WHERE u.id=? AND u.active=1 AND ur.role_id IN ('SYSTEM_ADMINISTRATOR','REGULATORY_ADMINISTRATOR')`, actor)) invalid('An active administrator must perform the dataset import.', 403);
  const preview = previewDataset(dataset);
  if (preview.alreadyImported) return preview;
  const originalDataset = dataset;
  dataset = normalizeDataset(dataset).dataset;
  const { maps } = validate(dataset);
  const now = new Date().toISOString(), batchId = datasetEntityId('batches', preview.digest);
  let plan = buildPlan(dataset, preview.digest);
  const id = (table, sourceId) => plan.id(table, sourceId);
  const appFor = (appId) => maps.applications.get(appId);
  const insert = (table, row) => {
    const columns = Object.keys(row);
    execute(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')})`, ...columns.map((key) => row[key]));
  };
  db.exec('BEGIN IMMEDIATE');
  try {
    // Repeat the checks under the write lock so preview/commit races cannot
    // result in partial imports or accidental overwrites.
    const duplicate = oneRow('SELECT id,imported_at FROM dataset_import_batches WHERE digest=?', preview.digest);
    if (duplicate) { db.exec('ROLLBACK'); return { ...preview, alreadyImported: true, batchId: duplicate.id, importedAt: duplicate.imported_at }; }
    plan = buildPlan(dataset, preview.digest);
    checkConflicts(dataset, plan);
    preview.reusedInstitutions = plan.reused;
    insert('dataset_import_batches', { id: batchId, digest: preview.digest, label: 'Pramaan synthetic institution dataset', created_by: actor, imported_at: now, counts_json: JSON.stringify(preview.counts), warnings_json: JSON.stringify(preview.warnings), record_count: preview.recordCount });
    for (const row of dataset.institutions) {
      if (plan.reused.some((entry) => entry.sourceId === row.institution_id)) continue;
      insert('institutions', {
      id: id('institutions', row.institution_id), aicte_id: `IMPORT:${row.institution_id}`, name: row.name,
      institution_type: row.institution_type, address: row.city, district: row.city, state_ut: row.state,
      establishment_year: null, affiliating_university: '', current_approval_status: 'UNKNOWN', created_at: now, updated_at: now,
      });
    }
    for (const row of dataset.applications) insert('applications', {
      id: id('applications', row.application_id), external_reference: row.application_id,
      institution_id: id('institutions', row.institution_id), category_id: 'OTHER', academic_year: row.academic_year,
      submission_date: row.submitted_at, processing_stage: stageMap[row.stage], validation_status: 'PENDING', verification_status: 'TEST_ONLY',
      assigned_user_id: null, due_date: null, created_at: `${row.submitted_at}T00:00:00Z`, updated_at: now,
    });
    for (const row of dataset.programs) insert('programmes', {
      id: id('programs', row.program_id), institution_id: id('institutions', row.institution_id), name: row.program_name,
      approved_intake: null, approval_record_id: null, created_at: now,
    });
    for (const row of dataset.faculty) insert('faculty_records', {
      id: id('faculty', row.faculty_id), institution_id: id('institutions', row.institution_id), display_name: row.display_name,
      department: row.department, qualification: row.qualification, employment_status: row.employment_status, record_origin: row.record_origin, created_at: now,
    });
    for (const row of dataset.documents) {
      const docId = id('documents', row.document_id), versionId = id('document_versions', row.document_id);
      insert('documents', { id: docId, institution_id: id('institutions', row.institution_id), application_id: row.application_id,
        document_type: row.document_type, current_version: 1, processing_status: 'METADATA_ONLY', created_at: now, updated_at: now });
      insert('document_versions', { id: versionId, document_id: docId, version_number: 1, original_name: row.filename,
        mime_type: 'application/pdf', byte_size: 0, sha256: '', storage_key: `dataset-metadata/${batchId}/${docId}`, uploaded_by: actor,
        uploaded_at: now, replacement_reason: 'Imported synthetic metadata; no evidence file supplied.', processing_result: 'METADATA_ONLY', verification_result: 'TEST_ONLY', file_available: 0 });
      for (const field of ['issued_on','expires_on']) insert('extracted_fields', {
        id: id('extracted_fields', `${row.document_id}:${field}`), document_version_id: versionId, field_name: field, field_value: row[field],
        confidence: null, page_number: null, evidence_location: 'Source dataset only; no document attached', extraction_method: 'SYNTHETIC_DATASET_IMPORT', created_at: now,
      });
    }
    for (const row of dataset.infrastructure) insert('infrastructure_evidence', {
      id: id('infrastructure', row.claim_id), institution_id: id('institutions', appFor(row.application_id).institution_id), application_id: row.application_id,
      category: row.asset_type, institution_claim: `${row.claimed_units} claimed units (synthetic test data). ${row.evidence_status}.`,
      document_version_id: null, review_status: 'PENDING', officer_notes: 'Imported synthetic claim; no physical inspection or evidence verification performed.', created_at: now,
    });
    const ruleSetId = id('rule_sets', preview.digest), ruleVersionId = id('rule_versions', preview.digest);
    if (dataset.rules.length) {
      insert('rule_sets', { id: ruleSetId, name: 'Synthetic test rules — illustrative and unmapped', application_category_id: null, status: 'DRAFT', created_by: actor, created_at: now });
      insert('rule_versions', { id: ruleVersionId, rule_set_id: ruleSetId, version_number: 1, status: 'DRAFT' });
      for (const row of dataset.rules) insert('regulatory_rules', {
        id: id('rules', row.rule_id), rule_version_id: ruleVersionId, rule_key: row.rule_id, title: `[Synthetic test] ${row.description}`,
        condition_json: JSON.stringify({ type: 'MANUAL_REVIEW', recordOrigin: row.record_origin, regulatoryReference: row.regulatory_reference }),
        severity: 'MEDIUM', recommended_action: 'Map to an applicable official clause and obtain authorized review before regulatory use.',
      });
      const executionApps = new Set(dataset.rule_evaluations.map((row) => row.application_id));
      for (const applicationId of executionApps) insert('rule_executions', {
        id: id('rule_executions', `${preview.digest}:${applicationId}`), application_id: applicationId, rule_version_id: ruleVersionId,
        status: 'COMPLETED', started_at: now, finished_at: now,
      });
      for (const row of dataset.rule_evaluations) insert('compliance_results', {
        id: id('rule_evaluations', row.evaluation_id), execution_id: id('rule_executions', `${preview.digest}:${row.application_id}`), rule_id: id('rules', row.rule_id),
        status: row.result, actual_value: row.result, expected_condition: 'Illustrative test condition; official requirement unmapped', evidence_reference: `dataset:${batchId}:${row.evaluation_id}`,
        reason: 'Historical synthetic test outcome imported as supplied. No live compliance evaluation or regulatory decision was performed.', recommended_action: 'Review test scenario and map the rule to official requirements before regulatory use.',
      });
    }
    for (const row of dataset.source_verifications) {
      const doc = maps.documents.get(row.document_id);
      insert('verifications', { id: id('source_verifications', row.verification_id), application_id: doc.application_id,
        document_version_id: id('document_versions', row.document_id), source_id: null, provider: row.provider,
        request_reference: row.verification_id, submitted_values: '{}', source_values: JSON.stringify(row), result: 'TEST_ONLY',
        evidence_reference: `dataset:${batchId}:${row.verification_id}`, error_message: 'Simulated record only; no external provider query was made.',
        officer_review_status: 'PENDING', requested_by: actor, requested_at: now, responded_at: null });
    }
    for (const row of dataset.findings) insert('findings', {
      id: id('findings', row.finding_id), application_id: row.application_id, institution_id: id('institutions', appFor(row.application_id).institution_id),
      category: row.category.toUpperCase(), severity: row.severity.toUpperCase(), status: row.status === 'Rectification Received' ? 'UNDER_REVIEW' : 'OPEN',
      title: `[Test scenario] ${row.category.replaceAll('_',' ')}`, description: row.description,
      reason: 'Imported synthetic finding; human decision not made.', evidence_json: JSON.stringify([{ documentId: id('documents', row.evidence_document_id), sourceDocumentId: row.evidence_document_id, metadataOnly: true, recordOrigin: row.record_origin }]),
      source: 'SYNTHETIC_DATASET_IMPORT', confidence: null, rule_reference: row.rule_id,
      recommended_action: 'Review the synthetic scenario; no regulatory action is authorized by this dataset.', created_at: now,
    });
    for (const row of dataset.rectifications) insert('rectifications', {
      id: id('rectifications', row.rectification_id), application_id: row.application_id, finding_id: id('findings', row.finding_id),
      status: 'RESPONDED', issue: maps.findings.get(row.finding_id).description,
      required_action: 'Review the imported synthetic rectification scenario.', deadline: null, requested_by: actor, created_at: now,
      responded_at: now, response: row.replacement_document_id ? `Synthetic response received; replacement metadata references ${row.replacement_document_id}. No replacement PDF is attached.` : 'Synthetic response received. No replacement document reference or file was supplied.',
    });
    for (const row of dataset.inspections) insert('inspections', {
      id: id('inspections', row.inspection_id), institution_id: id('institutions', appFor(row.application_id).institution_id), application_id: row.application_id,
      status: 'RECOMMENDED', recommendation_reason: `${row.reason} (synthetic test scenario; no inspection scheduled).`,
      scheduled_at: null, team_json: '[]', observations: '', report_reference: '', created_by: actor, created_at: now, updated_at: now,
    });
    for (const [table, [key]] of Object.entries(entities)) {
      const originals = new Map(originalDataset[table].map((row) => [row[key], row]));
      for (const row of dataset[table]) insert('dataset_records', {
        batch_id: batchId, table_name: table, source_record_id: row[key], entity_id: table === 'audit_events' ? row.application_id : id(table, row[key]), record_origin: row.record_origin, record_json: JSON.stringify(row), source_record_json: JSON.stringify(originals.get(row[key])),
      });
    }
    writeAudit(context, 'DATASET_IMPORTED', 'DATASET_IMPORT', batchId, '', { digest: preview.digest, counts: preview.counts, recordCount: preview.recordCount, synthetic: true, metadataOnly: true }, 'Pramaan JSON import package');
    for (const row of dataset.applications) writeAudit(context, 'SYNTHETIC_DATASET_RECORD_IMPORTED', 'APPLICATION', row.application_id, '', { batchId, sourceId: row.application_id, recordOrigin: row.record_origin });
    const foreignKeyErrors = allRows('PRAGMA foreign_key_check');
    if (foreignKeyErrors.length) invalid('Dataset import failed relational integrity checks.', 409);
    db.exec('COMMIT');
    return { ...preview, batchId, importedAt: now, alreadyImported: false };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
