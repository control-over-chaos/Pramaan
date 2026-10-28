import './config.mjs';
import { getGeminiAssistantConfig } from './assistant-config.mjs';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = resolve(process.env.DATA_DIR || './data', 'pramaan.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });
export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id),
  permission_id TEXT NOT NULL REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);
CREATE TABLE IF NOT EXISTS institutions (
  id TEXT PRIMARY KEY,
  aicte_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  institution_type TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  district TEXT NOT NULL DEFAULT '',
  state_ut TEXT NOT NULL DEFAULT '',
  establishment_year INTEGER,
  affiliating_university TEXT NOT NULL DEFAULT '',
  current_approval_status TEXT NOT NULL DEFAULT 'UNKNOWN',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  institution_id TEXT REFERENCES institutions(id),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);
CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(id),
  role_id TEXT NOT NULL REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token_hash, expires_at);
CREATE TABLE IF NOT EXISTS application_categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  external_reference TEXT UNIQUE,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  category_id TEXT NOT NULL REFERENCES application_categories(id),
  academic_year TEXT NOT NULL,
  submission_date TEXT,
  processing_stage TEXT NOT NULL DEFAULT 'RECEIVED',
  validation_status TEXT NOT NULL DEFAULT 'PENDING',
  verification_status TEXT NOT NULL DEFAULT 'PENDING',
  assigned_user_id TEXT REFERENCES users(id),
  due_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS applications_institution_idx ON applications(institution_id, created_at DESC);
CREATE INDEX IF NOT EXISTS applications_assignment_idx ON applications(assigned_user_id, processing_stage, due_date);
CREATE INDEX IF NOT EXISTS applications_year_category_idx ON applications(academic_year, category_id, processing_stage);
CREATE TABLE IF NOT EXISTS application_decisions (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  decision TEXT NOT NULL CHECK(decision IN ('APPROVED','REJECTED')),
  reason TEXT NOT NULL,
  decided_by TEXT NOT NULL REFERENCES users(id),
  decided_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS application_decisions_latest_idx ON application_decisions(application_id, decided_at DESC);
CREATE TRIGGER IF NOT EXISTS application_decisions_no_update BEFORE UPDATE ON application_decisions BEGIN SELECT RAISE(ABORT, 'application decisions are append-only'); END;
CREATE TRIGGER IF NOT EXISTS application_decisions_no_delete BEFORE DELETE ON application_decisions BEGIN SELECT RAISE(ABORT, 'application decisions are append-only'); END;
CREATE TABLE IF NOT EXISTS external_document_references (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  source_system TEXT NOT NULL,
  external_id TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'Other',
  received_at TEXT NOT NULL,
  UNIQUE(source_system, external_id)
);
CREATE TABLE IF NOT EXISTS programmes (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  name TEXT NOT NULL,
  approved_intake INTEGER,
  approval_record_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS approval_records (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  application_id TEXT REFERENCES applications(id),
  academic_year TEXT NOT NULL,
  status TEXT NOT NULL,
  effective_from TEXT,
  effective_until TEXT,
  reference TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  application_id TEXT NOT NULL REFERENCES applications(id),
  document_type TEXT NOT NULL,
  classification_confidence REAL,
  current_version INTEGER NOT NULL DEFAULT 1,
  processing_status TEXT NOT NULL DEFAULT 'UPLOADED',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS documents_application_idx ON documents(application_id, created_at DESC);
CREATE TABLE IF NOT EXISTS document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  version_number INTEGER NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  uploaded_at TEXT NOT NULL,
  replacement_reason TEXT NOT NULL DEFAULT '',
  processing_result TEXT NOT NULL DEFAULT 'UPLOADED',
  verification_result TEXT NOT NULL DEFAULT 'PENDING',
  UNIQUE(document_id, version_number)
);
CREATE TABLE IF NOT EXISTS extracted_fields (
  id TEXT PRIMARY KEY,
  document_version_id TEXT NOT NULL REFERENCES document_versions(id),
  field_name TEXT NOT NULL,
  field_value TEXT NOT NULL,
  confidence REAL,
  page_number INTEGER,
  evidence_location TEXT NOT NULL DEFAULT '',
  extraction_method TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS extracted_fields_name_value_idx ON extracted_fields(field_name, field_value);
CREATE TABLE IF NOT EXISTS document_ai_reviews (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  document_id TEXT NOT NULL REFERENCES documents(id),
  document_version_id TEXT NOT NULL REFERENCES document_versions(id),
  status TEXT NOT NULL CHECK(status IN ('PASSED','FAILED','MISMATCHED','EXPIRED','REVIEW_REQUIRED','AI_UNAVAILABLE')),
  engine_status TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL,
  result_json TEXT NOT NULL,
  rules_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS document_ai_reviews_latest_idx ON document_ai_reviews(document_version_id, created_at DESC);
CREATE TRIGGER IF NOT EXISTS document_ai_reviews_no_update BEFORE UPDATE ON document_ai_reviews BEGIN SELECT RAISE(ABORT, 'AI document reviews are append-only'); END;
CREATE TRIGGER IF NOT EXISTS document_ai_reviews_no_delete BEFORE DELETE ON document_ai_reviews BEGIN SELECT RAISE(ABORT, 'AI document reviews are append-only'); END;
CREATE TABLE IF NOT EXISTS processing_jobs (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  document_version_id TEXT REFERENCES document_versions(id),
  related_entity_id TEXT NOT NULL DEFAULT '',
  requested_by TEXT REFERENCES users(id),
  payload_json TEXT NOT NULL DEFAULT '{}',
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  attempts INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS processing_jobs_status_idx ON processing_jobs(status, created_at);
CREATE TABLE IF NOT EXISTS verification_sources (
  id TEXT PRIMARY KEY,
  provider_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  status TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  document_version_id TEXT NOT NULL REFERENCES document_versions(id),
  source_id TEXT REFERENCES verification_sources(id),
  provider TEXT NOT NULL,
  request_reference TEXT NOT NULL DEFAULT '',
  submitted_values TEXT NOT NULL DEFAULT '{}',
  source_values TEXT NOT NULL DEFAULT '{}',
  result TEXT NOT NULL,
  evidence_reference TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  officer_review_status TEXT NOT NULL DEFAULT 'PENDING',
  requested_by TEXT NOT NULL REFERENCES users(id),
  requested_at TEXT NOT NULL,
  responded_at TEXT
);
CREATE INDEX IF NOT EXISTS verifications_application_idx ON verifications(application_id, requested_at DESC);
CREATE TABLE IF NOT EXISTS rule_sets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  application_category_id TEXT REFERENCES application_categories(id),
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  retired_at TEXT
);
CREATE TABLE IF NOT EXISTS rule_versions (
  id TEXT PRIMARY KEY,
  rule_set_id TEXT NOT NULL REFERENCES rule_sets(id),
  version_number INTEGER NOT NULL,
  effective_from TEXT,
  effective_until TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  published_by TEXT REFERENCES users(id),
  published_at TEXT,
  UNIQUE(rule_set_id, version_number)
);
CREATE TABLE IF NOT EXISTS regulatory_rules (
  id TEXT PRIMARY KEY,
  rule_version_id TEXT NOT NULL REFERENCES rule_versions(id),
  rule_key TEXT NOT NULL,
  title TEXT NOT NULL,
  condition_json TEXT NOT NULL DEFAULT '{}',
  severity TEXT NOT NULL DEFAULT 'MEDIUM',
  recommended_action TEXT NOT NULL DEFAULT '',
  UNIQUE(rule_version_id, rule_key)
);
CREATE TABLE IF NOT EXISTS rule_executions (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  rule_version_id TEXT NOT NULL REFERENCES rule_versions(id),
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE TABLE IF NOT EXISTS compliance_results (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES rule_executions(id),
  rule_id TEXT NOT NULL REFERENCES regulatory_rules(id),
  status TEXT NOT NULL,
  actual_value TEXT NOT NULL DEFAULT '',
  expected_condition TEXT NOT NULL DEFAULT '',
  evidence_reference TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  recommended_action TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'OFFICER_REVIEW',
  confidence REAL,
  rule_reference TEXT NOT NULL DEFAULT '',
  recommended_action TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  resolution TEXT NOT NULL DEFAULT '',
  resolution_reason TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS findings_application_status_idx ON findings(application_id, status, severity);
CREATE TABLE IF NOT EXISTS officer_reviews (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL REFERENCES findings(id),
  actor_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rectifications (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  finding_id TEXT REFERENCES findings(id),
  status TEXT NOT NULL DEFAULT 'REQUESTED',
  issue TEXT NOT NULL,
  required_action TEXT NOT NULL,
  deadline TEXT,
  requested_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  responded_at TEXT,
  response TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS infrastructure_evidence (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  application_id TEXT NOT NULL REFERENCES applications(id),
  category TEXT NOT NULL,
  institution_claim TEXT NOT NULL DEFAULT '',
  document_version_id TEXT REFERENCES document_versions(id),
  review_status TEXT NOT NULL DEFAULT 'PENDING',
  officer_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inspections (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  application_id TEXT NOT NULL REFERENCES applications(id),
  status TEXT NOT NULL DEFAULT 'RECOMMENDED',
  recommendation_reason TEXT NOT NULL,
  scheduled_at TEXT,
  team_json TEXT NOT NULL DEFAULT '[]',
  observations TEXT NOT NULL DEFAULT '',
  report_reference TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, read_at, created_at DESC);
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),
  actor_role TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  previous_state TEXT NOT NULL DEFAULT '',
  new_state TEXT NOT NULL DEFAULT '',
  reference TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_events(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_events(created_at DESC);
CREATE TRIGGER IF NOT EXISTS audit_events_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_events_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  report_version INTEGER NOT NULL,
  rule_version_id TEXT REFERENCES rule_versions(id),
  generated_by TEXT NOT NULL REFERENCES users(id),
  generated_at TEXT NOT NULL,
  content_json TEXT NOT NULL,
  UNIQUE(application_id, report_version)
);
CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  provider_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'UNCONFIGURED',
  configuration_status TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
  health_status TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
  last_success_at TEXT,
  last_failure_at TEXT,
  last_failure TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS saved_filters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  resource TEXT NOT NULL,
  filters_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, resource, name)
);
CREATE TABLE IF NOT EXISTS system_config (
  config_key TEXT PRIMARY KEY,
  config_value TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL
);
`);

const schemaVersion=Number(db.prepare('PRAGMA user_version').get().user_version||0);
const ensureColumn=(table,column,definition)=>{
  const columns=db.prepare(`PRAGMA table_info(${table})`).all().map((item)=>item.name);
  if(!columns.includes(column))db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
};
if(schemaVersion<1)ensureColumn('processing_jobs','related_entity_id',"TEXT NOT NULL DEFAULT ''");
if(schemaVersion<2){
  ensureColumn('processing_jobs','requested_by','TEXT REFERENCES users(id)');
  ensureColumn('processing_jobs','payload_json',"TEXT NOT NULL DEFAULT '{}'");
}
if(schemaVersion<2)db.exec('PRAGMA user_version=2');
ensureColumn('document_versions','file_available','INTEGER NOT NULL DEFAULT 1 CHECK(file_available IN (0,1))');
if(schemaVersion<3)db.exec('PRAGMA user_version=3');
ensureColumn('document_versions','validation_json',"TEXT NOT NULL DEFAULT '{}'");
ensureColumn('users','must_change_password','INTEGER NOT NULL DEFAULT 0');
ensureColumn('document_versions','extraction_json',"TEXT NOT NULL DEFAULT '{}'");
ensureColumn('processing_jobs','lease_token',"TEXT NOT NULL DEFAULT ''");
ensureColumn('processing_jobs','lease_until','TEXT');
ensureColumn('processing_jobs','heartbeat_at','TEXT');
ensureColumn('processing_jobs','next_attempt_at','TEXT');
ensureColumn('processing_jobs','stage',"TEXT NOT NULL DEFAULT 'QUEUED'");
ensureColumn('processing_jobs','stage_updated_at','TEXT');
ensureColumn('rule_executions','assessment_date',"TEXT NOT NULL DEFAULT ''");
ensureColumn('rule_executions','document_manifest',"TEXT NOT NULL DEFAULT '[]'");
db.exec(`CREATE TABLE IF NOT EXISTS field_corrections (
 id TEXT PRIMARY KEY, field_id TEXT NOT NULL REFERENCES extracted_fields(id),
 corrected_value TEXT NOT NULL, reason TEXT NOT NULL, reviewed_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS field_corrections_no_update BEFORE UPDATE ON field_corrections BEGIN SELECT RAISE(ABORT,'Corrections are append-only'); END;
CREATE TRIGGER IF NOT EXISTS field_corrections_no_delete BEFORE DELETE ON field_corrections BEGIN SELECT RAISE(ABORT,'Corrections are append-only'); END;
CREATE TABLE IF NOT EXISTS worker_health (id TEXT PRIMARY KEY, heartbeat_at TEXT NOT NULL);
PRAGMA user_version=4;`);

export const permissionCatalog = {
  'application.read': 'Read applications',
  'application.create': 'Create an institution application',
  'application.assign': 'Assign applications to officers',
  'application.review': 'Review application workflow',
  'application.decide': 'Record an authorized final application decision',
  'institution.read': 'Read authorized institution records',
  'institution.manage': 'Manage institution records',
  'document.read': 'Read authorized documents',
  'document.upload': 'Upload and replace document evidence',
  'document.verify': 'Review document verification',
  'finding.read': 'Read findings and evidence',
  'finding.review': 'Review and resolve findings',
  'verification.request': 'Request an authorized source verification',
  'verification.review': 'Review source verification results',
  'rectification.create': 'Respond to a rectification request',
  'rectification.review': 'Create and review rectification requests',
  'inspection.recommend': 'Recommend an expert visit or inspection',
  'inspection.manage': 'Manage inspection cases',
  'report.generate': 'Generate verification reports',
  'rule.read': 'Read regulatory rule sets',
  'rule.create': 'Create and edit draft regulatory rules',
  'rule.publish': 'Publish and retire regulatory rules',
  'audit.read': 'Read append-only audit records',
  'integration.manage': 'Manage provider configuration',
  'user.manage': 'Manage users and role assignments',
  'notification.read': 'Read personal notifications',
  'configuration.manage': 'Manage non-secret product configuration',
};

const all = Object.keys(permissionCatalog);
export const roleCatalog = {
  INSTITUTION_USER: ['application.read', 'application.create', 'institution.read', 'document.read', 'document.upload', 'rectification.create', 'notification.read'],
  SCRUTINY_OFFICER: ['application.read', 'application.assign', 'application.review', 'institution.read', 'document.read', 'document.upload', 'document.verify', 'finding.read', 'finding.review', 'verification.request', 'verification.review', 'rectification.review', 'inspection.recommend', 'report.generate', 'audit.read', 'notification.read', 'rule.read'],
  VERIFICATION_OFFICER: ['application.read', 'application.review', 'institution.read', 'document.read', 'document.verify', 'finding.read', 'finding.review', 'verification.request', 'verification.review', 'report.generate', 'audit.read', 'notification.read', 'rule.read'],
  INSPECTION_OFFICER: ['application.read', 'institution.read', 'document.read', 'finding.read', 'inspection.manage', 'report.generate', 'notification.read'],
  APPROVING_AUTHORITY: ['application.read', 'application.review', 'application.decide', 'institution.read', 'document.read', 'finding.read', 'finding.review', 'verification.review', 'rectification.review', 'inspection.manage', 'report.generate', 'audit.read', 'notification.read', 'rule.read'],
  REGULATORY_ADMINISTRATOR: all,
  SYSTEM_ADMINISTRATOR: all,
  AUDITOR: ['application.read', 'institution.read', 'document.read', 'finding.read', 'audit.read', 'report.generate', 'notification.read', 'rule.read'],
};

const insertPermission = db.prepare('INSERT OR IGNORE INTO permissions(id, description) VALUES(?, ?)');
for (const [id, description] of Object.entries(permissionCatalog)) insertPermission.run(id, description);
for (const [role, grants] of Object.entries(roleCatalog)) {
  db.prepare('INSERT OR IGNORE INTO roles(id, name, description) VALUES(?, ?, ?)').run(role, role.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase()), 'Predefined least-privilege workspace role');
  const grant = db.prepare('INSERT OR IGNORE INTO role_permissions(role_id, permission_id) VALUES(?, ?)');
  for (const permission of grants) grant.run(role, permission);
}

for (const [id, label] of [
  ['EOA', 'Extension of Approval'],
  ['NEW_INSTITUTION', 'New Institution'],
  ['NEW_PROGRAMME', 'New Programme'],
  ['INCREASE_INTAKE', 'Increase in Intake'],
  ['OTHER', 'Other Approval Request'],
]) {
  db.prepare('INSERT OR IGNORE INTO application_categories(id, label) VALUES(?, ?)').run(id, label);
}

export function allRows(sql, ...params) { return db.prepare(sql).all(...params); }
export function oneRow(sql, ...params) { return db.prepare(sql).get(...params); }
export function execute(sql, ...params) { return db.prepare(sql).run(...params); }

const aiAssistantConfigured = getGeminiAssistantConfig().configured;

const configuredProviders = [
  ['aicte', 'AICTE Integration', Boolean(process.env.AICTE_SERVICE_TOKEN)],
  ['document-storage', 'Private Document Storage', true],
  ['ocr', 'OCR Provider', Boolean(process.env.OCR_PROVIDER_URL && process.env.OCR_PROVIDER_TOKEN)],
  ['ai', 'Pramaan Sahayak AI Assistant', aiAssistantConfigured],
  ['computer-vision', 'Computer Vision Provider', false],
  ['digilocker', 'DigiLocker', false],
  ['issuing-authority', 'Issuing Authority Providers', false],
  ['qr', 'QR Verification', false],
  ['digital-signature', 'Digital Signature Verification', false],
  ['notification', 'Notification Provider', false],
];
const upsertIntegration = db.prepare(`INSERT INTO integrations(id, provider_key, display_name, environment, configuration_status, health_status, updated_at)
  VALUES(?, ?, ?, ?, ?, ?, ?) ON CONFLICT(provider_key) DO UPDATE SET environment=excluded.environment,
  configuration_status=excluded.configuration_status, health_status=excluded.health_status, updated_at=excluded.updated_at`);
for (const [key, label, configured] of configuredProviders) {
  const status = configured ? 'CONFIGURED' : 'NOT_CONFIGURED';
  upsertIntegration.run(key, key, label, process.env.NODE_ENV || 'development', status, status, new Date().toISOString());
}

const brandingDefaults = [
  ['brand_name', process.env.BRAND_NAME || 'pramaan'],
  ['organization_name', process.env.ORGANIZATION_NAME || 'Institutional Verification Workspace'],
  ['tagline', 'Verify Before You Scrutinize.'],
  ['description', 'AI-assisted institutional verification, document authentication and regulatory compliance intelligence.'],
  ['support_email', process.env.SUPPORT_EMAIL || ''],
  ['footer_text', 'Automated findings are decision support. Final regulatory decisions remain with competent authorities.'],
  ['logo_path', ''],
  ['favicon_path', '/favicon.svg'],
];
const insertConfig = db.prepare('INSERT OR IGNORE INTO system_config(config_key, config_value, updated_at) VALUES(?, ?, ?)');
for (const [key, value] of brandingDefaults) insertConfig.run(key, value, new Date().toISOString());

db.exec(`CREATE TRIGGER IF NOT EXISTS published_rule_versions_no_update BEFORE UPDATE ON rule_versions WHEN OLD.status='PUBLISHED' BEGIN SELECT RAISE(ABORT, 'published rule versions are immutable'); END;
CREATE TRIGGER IF NOT EXISTS published_rule_versions_no_delete BEFORE DELETE ON rule_versions WHEN OLD.status='PUBLISHED' BEGIN SELECT RAISE(ABORT, 'published rule versions are immutable'); END;
CREATE TRIGGER IF NOT EXISTS published_rules_no_update BEFORE UPDATE ON regulatory_rules WHEN (SELECT status FROM rule_versions WHERE id=OLD.rule_version_id)='PUBLISHED' BEGIN SELECT RAISE(ABORT, 'rules in a published version are immutable'); END;
CREATE TRIGGER IF NOT EXISTS published_rules_no_delete BEFORE DELETE ON regulatory_rules WHEN (SELECT status FROM rule_versions WHERE id=OLD.rule_version_id)='PUBLISHED' BEGIN SELECT RAISE(ABORT, 'rules in a published version are immutable'); END;`);

// Additive PRAMAAN internal eligibility snapshots. These weights are decision-support
// configuration from the product brief; they are not regulatory thresholds or approvals.
db.exec(`
CREATE TABLE IF NOT EXISTS eligibility_categories (
  category_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  weight INTEGER NOT NULL CHECK(weight > 0),
  guidance TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS eligibility_assessments (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  source_digest TEXT NOT NULL,
  framework_version TEXT NOT NULL,
  calculated_at TEXT NOT NULL,
  criteria_satisfied_percent REAL,
  verification_coverage_percent REAL,
  applicable_weight INTEGER NOT NULL DEFAULT 0,
  passed_weight INTEGER NOT NULL DEFAULT 0,
  conclusively_evaluated_weight INTEGER NOT NULL DEFAULT 0,
  mandatory_failures INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  UNIQUE(application_id, source_digest)
);
CREATE INDEX IF NOT EXISTS eligibility_assessments_application_idx ON eligibility_assessments(application_id, calculated_at DESC);
CREATE TABLE IF NOT EXISTS eligibility_assessment_criteria (
  assessment_id TEXT NOT NULL REFERENCES eligibility_assessments(id),
  category_key TEXT NOT NULL REFERENCES eligibility_categories(category_key),
  category_label TEXT NOT NULL,
  weight INTEGER NOT NULL,
  status TEXT NOT NULL,
  applicability TEXT NOT NULL,
  mandatory_failure INTEGER NOT NULL DEFAULT 0 CHECK(mandatory_failure IN (0,1)),
  evidence_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY(assessment_id, category_key)
);
CREATE TABLE IF NOT EXISTS demo_registry_records (
  registry_id TEXT PRIMARY KEY,
  lookup_certificate TEXT NOT NULL UNIQUE,
  scenario_label TEXT NOT NULL,
  record_kind TEXT NOT NULL DEFAULT 'NEW_INSTITUTION',
  source_available INTEGER NOT NULL DEFAULT 1 CHECK(source_available IN (0,1)),
  review_required INTEGER NOT NULL DEFAULT 0 CHECK(review_required IN (0,1)),
  required_document_types_json TEXT NOT NULL DEFAULT '[]',
  reference_fields_json TEXT NOT NULL,
  sample_fields_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS eligibility_assessments_no_update BEFORE UPDATE ON eligibility_assessments BEGIN SELECT RAISE(ABORT, 'eligibility assessments are immutable snapshots'); END;
CREATE TRIGGER IF NOT EXISTS eligibility_assessments_no_delete BEFORE DELETE ON eligibility_assessments BEGIN SELECT RAISE(ABORT, 'eligibility assessments are immutable snapshots'); END;
CREATE TRIGGER IF NOT EXISTS eligibility_assessment_criteria_no_update BEFORE UPDATE ON eligibility_assessment_criteria BEGIN SELECT RAISE(ABORT, 'eligibility assessment criteria are immutable snapshots'); END;
CREATE TRIGGER IF NOT EXISTS eligibility_assessment_criteria_no_delete BEFORE DELETE ON eligibility_assessment_criteria BEGIN SELECT RAISE(ABORT, 'eligibility assessment criteria are immutable snapshots'); END;
CREATE TRIGGER IF NOT EXISTS demo_registry_records_no_update BEFORE UPDATE ON demo_registry_records BEGIN SELECT RAISE(ABORT, 'synthetic registry seed records are immutable'); END;
CREATE TRIGGER IF NOT EXISTS demo_registry_records_no_delete BEFORE DELETE ON demo_registry_records BEGIN SELECT RAISE(ABORT, 'synthetic registry seed records are immutable'); END;
PRAGMA user_version=5;
`);

const eligibilityCategorySeeds = [
  ['LEGAL_EXISTENCE', 'Legal Existence and Registration', 15, 'Internal screening of configured registration evidence.', 1],
  ['ORGANIZATION_IDENTITY', 'Organization Identity', 10, 'Internal screening of identity evidence and configured comparisons.', 2],
  ['AUTHORIZED_REPRESENTATIVE', 'Authorized Representative', 10, 'Internal screening of representative evidence when configured.', 3],
  ['REGISTERED_ADDRESS', 'Registered Address', 10, 'Internal screening of address evidence and configured comparisons.', 4],
  ['PROPERTY_PREMISES', 'Property or Premises Rights', 10, 'Internal screening of premises evidence; physical claims may require inspection.', 5],
  ['SAFETY_PERMISSIONS', 'Safety and Local Permissions', 10, 'Internal screening of explicitly configured safety and local permission rules.', 6],
  ['FINANCIAL_OPERATIONAL', 'Financial and Operational Evidence', 10, 'Internal screening of explicitly configured financial or operational evidence.', 7],
  ['SECTOR_APPROVALS', 'Sector-Specific Approvals', 15, 'Internal screening of explicitly configured sector approval rules.', 8],
  ['DOCUMENT_VALIDITY', 'Document Validity and Consistency', 5, 'Internal screening of configured validity and consistency rules.', 9],
  ['APPLICATION_COMPLETENESS', 'Application Completeness', 5, 'Internal screening against the configured application checklist.', 10],
];
const insertEligibilityCategory = db.prepare('INSERT OR IGNORE INTO eligibility_categories(category_key,label,weight,guidance,display_order) VALUES(?,?,?,?,?)');
for (const row of eligibilityCategorySeeds) insertEligibilityCategory.run(...row);

const demoRegistrySeeds = [
  ['DEMO-REGISTRY-001','DEMO-CERT-001','Valid registration certificate — synthetic match','NEW_INSTITUTION',1,0,['Fire NOC'],
    {certificate_number:'DEMO-CERT-001',registration_number:'DEMO-REG-001',institution_name:'Suryodaya Technical Institute',address:'Sector 12, Sample Nagar, Karnataka',issue_date:'2025-01-01',expiry_date:'2027-12-31'},
    {certificate_number:'DEMO-CERT-001',registration_number:'DEMO-REG-001',institution_name:'Suryodaya Technical Institute',address:'Sector 12, Sample Nagar, Karnataka',issue_date:'2025-01-01',expiry_date:'2027-12-31'}],
  ['DEMO-REGISTRY-002','DEMO-CERT-002','Registration number mismatch — synthetic review','NEW_INSTITUTION',1,0,['Fire NOC'],
    {certificate_number:'DEMO-CERT-002',registration_number:'DEMO-REG-002',institution_name:'Pragati Institute of Applied Studies',address:'Plot 8, Sample Road, Maharashtra',issue_date:'2025-02-01',expiry_date:'2027-12-31'},
    {certificate_number:'DEMO-CERT-002',registration_number:'DEMO-REG-ALT-002',institution_name:'Pragati Institute of Applied Studies',address:'Plot 8, Sample Road, Maharashtra',issue_date:'2025-02-01',expiry_date:'2027-12-31'}],
  ['DEMO-REGISTRY-003','DEMO-CERT-003','Expired certificate — synthetic expiry finding','NEW_INSTITUTION',1,0,['Fire NOC'],
    {certificate_number:'DEMO-CERT-003',registration_number:'DEMO-REG-003',institution_name:'Aarohan Learning Institute',address:'Road 4, Example City, Rajasthan',issue_date:'2022-01-01',expiry_date:'2024-12-31'},
    {certificate_number:'DEMO-CERT-003',registration_number:'DEMO-REG-003',institution_name:'Aarohan Learning Institute',address:'Road 4, Example City, Rajasthan',issue_date:'2022-01-01',expiry_date:'2024-12-31'}],
  ['DEMO-REGISTRY-004','DEMO-CERT-004','Missing mandatory document — synthetic checklist case','NEW_INSTITUTION',1,0,['Fire NOC','Registration Certificate'],
    {certificate_number:'DEMO-CERT-004',registration_number:'DEMO-REG-004',institution_name:'Nirmal Institute of Technology',address:'Campus Road, Example District, Gujarat',issue_date:'2025-03-01',expiry_date:'2027-12-31'},
    {certificate_number:'DEMO-CERT-004',registration_number:'DEMO-REG-004',institution_name:'Nirmal Institute of Technology',address:'Campus Road, Example District, Gujarat',issue_date:'2025-03-01',expiry_date:'2027-12-31'}],
  ['DEMO-REGISTRY-005','DEMO-CERT-005','Conflicting organization address — synthetic mismatch','NEW_INSTITUTION',1,0,['Fire NOC'],
    {certificate_number:'DEMO-CERT-005',registration_number:'DEMO-REG-005',institution_name:'Vistaar College of Engineering',address:'Building A, Sample Avenue, Tamil Nadu',issue_date:'2025-04-01',expiry_date:'2027-12-31'},
    {certificate_number:'DEMO-CERT-005',registration_number:'DEMO-REG-005',institution_name:'Vistaar College of Engineering',address:'Building B, Sample Avenue, Tamil Nadu',issue_date:'2025-04-01',expiry_date:'2027-12-31'}],
  ['DEMO-REGISTRY-006','DEMO-CERT-006','Reference source unavailable — synthetic pending case','NEW_INSTITUTION',0,0,['Fire NOC'],
    {certificate_number:'DEMO-CERT-006',registration_number:'DEMO-REG-006',institution_name:'Udaya Institute of Science',address:'Hill Road, Example Town, Kerala',issue_date:'2025-05-01',expiry_date:'2027-12-31'},
    {certificate_number:'DEMO-CERT-006',registration_number:'DEMO-REG-006',institution_name:'Udaya Institute of Science',address:'Hill Road, Example Town, Kerala',issue_date:'2025-05-01',expiry_date:'2027-12-31'}],
  ['DEMO-REGISTRY-007','DEMO-CERT-007','All mapped demo checks align — not an eligibility decision','NEW_INSTITUTION',1,0,['Fire NOC'],
    {certificate_number:'DEMO-CERT-007',registration_number:'DEMO-REG-007',institution_name:'Navchetna Institute of Engineering',address:'Knowledge Park, Sample City, Madhya Pradesh',issue_date:'2025-06-01',expiry_date:'2027-12-31'},
    {certificate_number:'DEMO-CERT-007',registration_number:'DEMO-REG-007',institution_name:'Navchetna Institute of Engineering',address:'Knowledge Park, Sample City, Madhya Pradesh',issue_date:'2025-06-01',expiry_date:'2027-12-31'}],
  ['DEMO-REGISTRY-008','DEMO-CERT-008','Ineligible example — synthetic identity discrepancy only','NEW_INSTITUTION',1,0,['Fire NOC'],
    {certificate_number:'DEMO-CERT-008',registration_number:'DEMO-REG-008',institution_name:'Sankalp Technical College',address:'Block 2, Example Road, Punjab',issue_date:'2025-07-01',expiry_date:'2027-12-31'},
    {certificate_number:'DEMO-CERT-008',registration_number:'DEMO-REG-008',institution_name:'Sankalp Technical Institute',address:'Block 2, Example Road, Punjab',issue_date:'2025-07-01',expiry_date:'2027-12-31'}],
  ['DEMO-REGISTRY-009','DEMO-CERT-009','Existing institution renewal — synthetic reference','RENEWAL',1,0,['Fire NOC'],
    {certificate_number:'DEMO-CERT-009',registration_number:'DEMO-REG-009',institution_name:'Prerna Institute of Technology',address:'University Road, Sample City, Odisha',issue_date:'2025-08-01',expiry_date:'2027-12-31'},
    {certificate_number:'DEMO-CERT-009',registration_number:'DEMO-REG-009',institution_name:'Prerna Institute of Technology',address:'University Road, Sample City, Odisha',issue_date:'2025-08-01',expiry_date:'2027-12-31'}],
  ['DEMO-REGISTRY-010','DEMO-CERT-010','Synthetic altered-document scenario — manual review required','NEW_INSTITUTION',1,1,['Fire NOC'],
    {certificate_number:'DEMO-CERT-010',registration_number:'DEMO-REG-010',institution_name:'Samarth Institute of Advanced Studies',address:'North Campus, Sample District, Assam',issue_date:'2025-09-01',expiry_date:'2027-12-31'},
    {certificate_number:'DEMO-CERT-010',registration_number:'DEMO-REG-010',institution_name:'Samarth Institute of Advanced Studies',address:'North Campus, Sample District, Assam',issue_date:'2025-09-01',expiry_date:'2027-12-31'}],
];
const insertDemoRegistry = db.prepare(`INSERT OR IGNORE INTO demo_registry_records(registry_id,lookup_certificate,scenario_label,record_kind,source_available,review_required,required_document_types_json,reference_fields_json,sample_fields_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`);
for (const [id,lookup,scenario,kind,available,review,required,reference,sample] of demoRegistrySeeds) insertDemoRegistry.run(id,lookup,scenario,kind,available,review,JSON.stringify(required),JSON.stringify(reference),JSON.stringify(sample),new Date().toISOString());
