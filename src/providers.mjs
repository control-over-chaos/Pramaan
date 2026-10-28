import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
import { allRows, execute, oneRow } from './db.mjs';
import { writeAudit } from './audit.mjs';
import { parseDocument } from './local-processing.mjs';
import { fieldsForVersion, filePrerequisite, normalizeValue, fieldReliable } from './evidence.mjs';
import { recordEligibilityAssessment } from './eligibility.mjs';
import { DemoRegistryAdapter } from './source-adapters.mjs';

function refreshEligibility(applicationId, context = {}) {
  if (!applicationId) return;
  try { recordEligibilityAssessment(applicationId, context); } catch { /* a later application read can safely recalculate this snapshot */ }
}

function refreshApplicationVerificationStatus(applicationId) {
  const rows = allRows(`SELECT dv.verification_result FROM documents d
    JOIN document_versions dv ON dv.document_id=d.id AND dv.version_number=d.current_version
    WHERE d.application_id=?`, applicationId);
  const statuses = rows.map((row)=>String(row.verification_result||'PENDING').toUpperCase());
  let status='PENDING';
  if(statuses.includes('EXPIRED'))status='EXPIRED';
  else if(statuses.includes('MISMATCH_DETECTED')||statuses.includes('DEMO_MISMATCH'))status='MISMATCH_DETECTED';
  else if(statuses.length&&statuses.every((value)=>value==='VERIFIED'))status='VERIFIED';
  else if(statuses.includes('SOURCE_UNAVAILABLE'))status='SOURCE_UNAVAILABLE';
  else if(statuses.includes('AUTHORIZATION_REQUIRED'))status='AUTHORIZATION_REQUIRED';
  else if(statuses.includes('INCONCLUSIVE'))status='INCONCLUSIVE';
  else if(statuses.includes('MANUAL_REVIEW_REQUIRED'))status='MANUAL_REVIEW_REQUIRED';
  else if(statuses.includes('DEMO_EXPIRED'))status='DEMO_EXPIRED';
  else if(statuses.includes('DEMO_MATCH'))status='DEMO_MATCH';
  else if(statuses.includes('TEST_ONLY'))status='TEST_ONLY';
  execute('UPDATE applications SET verification_status=?,updated_at=?,version=version+1 WHERE id=?',status,new Date().toISOString(),applicationId);
}

export class OCRProvider {
  async extractText() { throw new Error('extractText is not implemented'); }
  async extractLayout() { throw new Error('extractLayout is not implemented'); }
  async extractTables() { throw new Error('extractTables is not implemented'); }
  async extractKeyValuePairs() { throw new Error('extractKeyValuePairs is not implemented'); }
}

export class ConfiguredOCRProvider extends OCRProvider {
  constructor(url, token) { super(); this.url = url.replace(/\/$/, ''); this.token = token; }
  async request(operation, payload) {
    const response = await fetch(`${this.url}/v1/${operation}`, {
      method: 'POST', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(45000), redirect: 'error',
    });
    if (!response.ok) throw Object.assign(new Error(`OCR provider returned HTTP ${response.status}.`), { code: 'OCR_PROVIDER_ERROR' });
    return response.json();
  }
  extractText(payload) { return this.request('extract-text', payload); }
  extractLayout(payload) { return this.request('extract-layout', payload); }
  extractTables(payload) { return this.request('extract-tables', payload); }
  extractKeyValuePairs(payload) { return this.request('extract-key-value-pairs', payload); }
}

export class VerificationProvider {
  async verify() { throw new Error('verify is not implemented'); }
  async getStatus() { throw new Error('getStatus is not implemented'); }
  normalizeResponse(response) { return response; }
  validateResponse(response) { return Boolean(response && typeof response.result === 'string'); }
}

export class QRVerificationProvider {
  async extractReferences() { throw new Error('extractReferences is not implemented'); }
  validateAuthorizedReference(reference, authorizedDomains = []) {
    try {
      const parsed = new URL(reference);
      return parsed.protocol === 'https:' && authorizedDomains.includes(parsed.hostname.toLowerCase());
    } catch { return false; }
  }
}

export class DigitalSignatureVerificationProvider {
  async verify() { throw new Error('verify is not implemented'); }
  normalizeResponse(response) {
    const allowed = new Set(['VALID','INVALID','EXPIRED','UNTRUSTED','UNVERIFIABLE','NOT_PRESENT']);
    return { ...response, status: allowed.has(response?.status) ? response.status : 'UNVERIFIABLE' };
  }
}

export class ComputerVisionProvider {
  async classifyImage() { throw new Error('classifyImage is not implemented'); }
  async detectObjects() { throw new Error('detectObjects is not implemented'); }
  async assessEvidenceQuality() { throw new Error('assessEvidenceQuality is not implemented'); }
  async compareVisualEvidence() { throw new Error('compareVisualEvidence is not implemented'); }
}

export class ConfiguredVerificationProvider extends VerificationProvider {
  constructor(url, token) { super(); this.url = url.replace(/\/$/, ''); this.token = token; }
  async verify(payload) {
    const response = await fetch(`${this.url}/v1/verify`, {
      method: 'POST', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(30000), redirect: 'error',
    });
    if (!response.ok) throw Object.assign(new Error(`Verification provider returned HTTP ${response.status}.`), { code: response.status===429?'RATE_LIMITED':response.status===404?'NOT_FOUND':[401,403].includes(response.status)?'AUTHORIZATION_REQUIRED':'SOURCE_UNAVAILABLE' });
    const raw=await response.json();
    if(!raw||typeof raw.result!=='string'||!raw.sourceValues||typeof raw.sourceValues!=='object'||Array.isArray(raw.sourceValues)||typeof raw.evidenceReference!=='string'||!raw.evidenceReference.trim())throw Object.assign(new Error('Verification response lacks structured source values or an evidence reference.'),{code:'MALFORMED_RESPONSE'});
    const result = this.normalizeResponse(raw);
    if (!this.validateResponse(result)) throw Object.assign(new Error('Verification provider returned a malformed response.'), { code: 'INCONCLUSIVE' });
    return result;
  }
  async getStatus(reference) {
    const response = await fetch(`${this.url}/v1/status/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(15000), redirect: 'error',
    });
    if (!response.ok) throw Object.assign(new Error(`Verification provider returned HTTP ${response.status}.`), { code: 'SOURCE_UNAVAILABLE' });
    return this.normalizeResponse(await response.json());
  }
  normalizeResponse(response) {
    const allowed = new Set(['VERIFIED', 'MISMATCH_DETECTED', 'EXPIRED', 'PENDING', 'SOURCE_UNAVAILABLE', 'AUTHORIZATION_REQUIRED', 'INCONCLUSIVE', 'MANUAL_REVIEW_REQUIRED']);
    return { ...response, result: allowed.has(response?.result) ? response.result : 'INCONCLUSIVE' };
  }
}

export class ConfiguredAssistantProvider {
  constructor(baseUrl, token, model, maxOutputTokens = 1600) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
    this.model = model;
    this.maxOutputTokens = Math.max(256, Math.min(8192, Number(maxOutputTokens) || 1600));
  }

  async respond(messages) {
    const systemInstruction = messages.find((message) => message.role === 'system')?.content || '';
    const contents = [];
    for (const message of messages) {
      if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || !message.content.trim()) continue;
      const role = message.role === 'assistant' ? 'model' : 'user';
      const last = contents.at(-1);
      if (last?.role === role) last.parts[0].text += `\n\n${message.content}`;
      else contents.push({ role, parts: [{ text: message.content }] });
    }
    const response = await fetch(`${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': this.token, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: this.maxOutputTokens, thinkingConfig: { thinkingLevel: 'low' } },
      }),
      signal: AbortSignal.timeout(45000),
      redirect: 'error',
    });
    if (!response.ok) throw Object.assign(new Error('AI provider request failed.'), { code: 'AI_PROVIDER_UNAVAILABLE' });
    const payload = await response.json();
    const answer = (payload?.candidates?.[0]?.content?.parts || []).map((part) => part?.text || '').join('');
    if (!answer.trim()) throw Object.assign(new Error('AI provider returned an empty response.'), { code: 'AI_PROVIDER_EMPTY_RESPONSE' });
    return { answer: answer.trim().slice(0, Math.min(this.maxOutputTokens * 4, 30000)), model: String(payload.modelVersion || this.model).slice(0, 120) };
  }
}

async function processClaimedJob(handlers,token) {
  const heartbeat=new Date().toISOString();
  execute("INSERT INTO worker_health(id,heartbeat_at) VALUES('local',?) ON CONFLICT(id) DO UPDATE SET heartbeat_at=excluded.heartbeat_at",heartbeat);
  execute("UPDATE processing_jobs SET status=CASE WHEN attempts<3 THEN 'QUEUED' ELSE 'FAILED' END,error_code='LEASE_EXPIRED',error_message='Worker interrupted; recovered expired lease.',lease_token='' WHERE status='RUNNING' AND (lease_until IS NULL OR lease_until<?)",heartbeat);
  const job = oneRow("SELECT * FROM processing_jobs WHERE status='QUEUED' AND (next_attempt_at IS NULL OR next_attempt_at<=?) ORDER BY created_at LIMIT 1",heartbeat);
  if (!job) return false;
  const now = new Date().toISOString();
  execute("UPDATE processing_jobs SET status='RUNNING', started_at=?, attempts=attempts+1,lease_token=?,lease_until=?,heartbeat_at=? WHERE id=? AND status='QUEUED'", now,token,new Date(Date.now()+240000).toISOString(),now, job.id);
  const current = oneRow('SELECT * FROM processing_jobs WHERE id=?', job.id);
  if (!current || current.status !== 'RUNNING'||current.lease_token!==token) return true;
  if(job.document_version_id && !oneRow('SELECT d.id FROM documents d JOIN document_versions dv ON dv.document_id=d.id AND dv.version_number=d.current_version WHERE dv.id=?',job.document_version_id)) {execute("UPDATE processing_jobs SET status='SUPERSEDED',finished_at=? WHERE id=?",now,job.id);return true;}
  if (job.job_type === 'SOURCE_VERIFICATION') return processVerificationJob(job);
  if (job.job_type === 'COMPLIANCE_EXECUTION' && handlers.compliance) return handlers.compliance(job);
  if (job.job_type === 'AI_DOCUMENT_REVIEW' && handlers.aiDocumentReview) return handlers.aiDocumentReview(job);
  const version = oneRow('SELECT * FROM document_versions WHERE id=?', job.document_version_id);
  const document = oneRow('SELECT * FROM documents WHERE id=?', version?.document_id);
  let documentProcessed = false;
  try {
    if (!version || !document) throw Object.assign(new Error('Document record is unavailable.'), { code: 'DOCUMENT_UNAVAILABLE' });
    const storageRoot = resolve(process.env.PRIVATE_STORAGE_DIR || './storage');
    const path = resolve(storageRoot, version.storage_key);
    if (relative(storageRoot, path).startsWith('..')) throw Object.assign(new Error('Invalid private storage key.'), { code: 'STORAGE_KEY_INVALID' });
    const bytes = await readFile(path);
    if(bytes.length!==version.byte_size||createHash('sha256').update(bytes).digest('hex')!==version.sha256)throw Object.assign(new Error('Stored file checksum or length changed. Processing stopped.'),{code:'FILE_INTEGRITY_FAILED'});
    execute("UPDATE processing_jobs SET stage='VALIDATING_FILE',stage_updated_at=? WHERE id=?",new Date().toISOString(),job.id);
    const parsed=await parseDocument(path);
    execute('UPDATE document_versions SET validation_json=?,extraction_json=? WHERE id=?',JSON.stringify({status:parsed.status,reason:parsed.reason,pageCount:parsed.pageCount,qualityWarnings:parsed.qualityWarnings,malwareScan:'NOT_CONFIGURED'}),JSON.stringify(parsed),version.id);
    if(parsed.status!=='VALID')throw Object.assign(new Error(parsed.reason||'File structure validation failed.'),{code:'FILE_VALIDATION_FAILED'});
    execute("UPDATE processing_jobs SET stage='EXTRACTING_FIELDS',stage_updated_at=? WHERE id=?",new Date().toISOString(),job.id);
    const provider = new ConfiguredOCRProvider(process.env.OCR_PROVIDER_URL || "", process.env.OCR_PROVIDER_TOKEN);
    const payload = { documentId: version.document_id, version: version.version_number, fileName: version.original_name, mimeType: version.mime_type, sha256: version.sha256, contentBase64: bytes.toString('base64') };
    const [text, layout, tables, keyValuePairs] = process.env.OCR_PROVIDER_URL && process.env.OCR_PROVIDER_TOKEN ? await Promise.all([
      provider.extractText(payload), provider.extractLayout(payload), provider.extractTables(payload), provider.extractKeyValuePairs(payload),
    ]) : [parsed,parsed.pages,{tables:[]},{fields:parsed.fields,classification:{type:document.document_type,confidence:null}}];
    if(!oneRow("SELECT id FROM processing_jobs WHERE id=? AND lease_token=? AND status='RUNNING'",job.id,token)||!oneRow('SELECT id FROM documents WHERE id=? AND current_version=?',document.id,version.version_number)) {execute("UPDATE processing_jobs SET status='SUPERSEDED',finished_at=? WHERE id=? AND lease_token=?",new Date().toISOString(),job.id,token);return true;}
    const fields = normalizeExtractedFields(keyValuePairs?.fields || keyValuePairs?.items || []);
    for (const field of fields.filter(f=>!oneRow('SELECT id FROM extracted_fields WHERE document_version_id=? AND field_name=? AND page_number IS ? AND field_value=?',version.id,f.name,f.page,f.value))) execute(`INSERT INTO extracted_fields(id, document_version_id, field_name, field_value, confidence, page_number, evidence_location, extraction_method, created_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`, randomUUID(), version.id, field.name, field.value, field.confidence, field.page, field.location, field.method || 'OCR_PROVIDER', new Date().toISOString());
    const classification = keyValuePairs?.classification;
    const confidence = Number(classification?.confidence);
    const fire=/fire.*noc|fire.*safety/i.test(document.document_type);
    const required=fire?['certificate_number','institution_name','issue_date','expiry_date']:['institution_name'];
    const needsManualReview = required.some(name=>!fields.some(f=>f.name===name)) || fields.some(f=>!fieldReliable({confidence:f.confidence,extraction_method:f.method})) || parsed.qualityWarnings?.length || !fire;
    const finalStatus = needsManualReview ? 'MANUAL_REVIEW' : 'COMPLETED';
    const finished = new Date().toISOString();
    execute('UPDATE documents SET classification_confidence=?, processing_status=?, updated_at=? WHERE id=? AND current_version=?',
      classification?.confidence!=null&&Number.isFinite(confidence) ? confidence : null, finalStatus, finished, document.id,version.version_number);
    execute('UPDATE document_versions SET processing_result=? WHERE id=?', finalStatus, version.id);
    execute("UPDATE processing_jobs SET status='COMPLETED', finished_at=? WHERE id=?", finished, job.id);
    execute('UPDATE processing_jobs SET stage=?,stage_updated_at=? WHERE id=?',finalStatus,finished,job.id);
    writeAudit(null, 'DOCUMENT_PROCESSING_COMPLETED', 'DOCUMENT', document.id, 'RUNNING', finalStatus, JSON.stringify({ pages: text?.pageCount || null, layoutAvailable: Boolean(layout), tables: tables?.tables?.length || 0 }));
    refreshEligibility(job.application_id, { actorRole: 'SYSTEM_WORKER' });
    documentProcessed = true;
  } catch (error) {
    const finished = new Date().toISOString();
    const code = error.code || 'OCR_PROVIDER_ERROR';
    execute("UPDATE processing_jobs SET status='FAILED', error_code=?, error_message=?, finished_at=? WHERE id=?", code, String(error.message || 'Processing failed').slice(0, 500), finished, job.id);
    if(['OCR_PROVIDER_ERROR','ETIMEDOUT','ECONNRESET'].includes(code)&&job.attempts+1<3)execute("UPDATE processing_jobs SET status='QUEUED',stage='RETRY_WAIT',next_attempt_at=?,finished_at=NULL WHERE id=?",new Date(Date.now()+2**(job.attempts+1)*5000).toISOString(),job.id);
    if (version) execute("UPDATE documents SET processing_status='RETRY_REQUIRED', updated_at=? WHERE id=? AND current_version=?", finished, version.document_id,version.version_number);
    if (version) execute("UPDATE document_versions SET processing_result='RETRY_REQUIRED' WHERE id=?", version.id);
    writeAudit(null, 'DOCUMENT_PROCESSING_FAILED', 'DOCUMENT', version?.document_id || job.id, 'RUNNING', 'RETRY_REQUIRED', code);
    refreshEligibility(job.application_id, { actorRole: 'SYSTEM_WORKER' });
  }
  if (documentProcessed && handlers.documentCompleted) {
    try { await handlers.documentCompleted(job.application_id); }
    catch (error) { console.error(JSON.stringify({ message: 'Automatic rule review could not be queued.', detail: String(error.message || error).slice(0, 200) })); }
  }
  return true;
}

export async function processNextJob(handlers={}) {
 const token=randomUUID();
 const timer=setInterval(()=>{const now=new Date().toISOString();execute("UPDATE processing_jobs SET heartbeat_at=?,lease_until=? WHERE lease_token=? AND status='RUNNING'",now,new Date(Date.now()+240000).toISOString(),token);execute("INSERT INTO worker_health(id,heartbeat_at) VALUES('local',?) ON CONFLICT(id) DO UPDATE SET heartbeat_at=excluded.heartbeat_at",now);},10000);
 timer.unref();try{return await processClaimedJob(handlers,token);}finally{clearInterval(timer);}
}

async function processVerificationJob(job) {
  const verification = oneRow('SELECT * FROM verifications WHERE id=?', job.related_entity_id);
  if (!verification) {
    execute("UPDATE processing_jobs SET status='FAILED', error_code='VERIFICATION_NOT_FOUND', error_message='Verification request record is unavailable.', finished_at=? WHERE id=?", new Date().toISOString(), job.id);
    return true;
  }
  const version = oneRow('SELECT * FROM document_versions WHERE id=?', verification.document_version_id);
  const fields = fieldsForVersion(verification.document_version_id).map(f=>({field_name:f.field_name,field_value:f.field_value,confidence:f.confidence,correction_id:f.correction_id,extraction_method:f.extraction_method}));
  execute('UPDATE verifications SET submitted_values=? WHERE id=?',JSON.stringify(fields),verification.id);
  let result = { result: 'SOURCE_UNAVAILABLE', error: 'An authorized verification provider is not configured.' };
  if (!filePrerequisite(version).ok || !fields.length || fields.some(f=>!fieldReliable(f))) result={result:'MANUAL_REVIEW_REQUIRED',error:'Validated current file and reviewed, reliable fields are required.'};
  else if(verification.provider==='CONTROLLED_TEST_SOURCE') {
    const values=Object.fromEntries(fields.map(f=>[f.field_name,f.field_value]));
    const fixture={certificate_number:'TEST-FIRE-001',institution_name:'Pramaan Test Institute',address:'1 Test Road',issue_date:'2026-01-01',expiry_date:'2027-12-31'};
    const comparison=Object.keys(fixture).map(field=>({field,submitted:values[field]||'',source:fixture[field],status:normalizeValue(values[field])===normalizeValue(fixture[field])?'MATCH':'MISMATCH_DETECTED'}));
    result={result:'TEST_ONLY',sourceValues:{environment:'CONTROLLED_TEST',authority:'Fictional local fixture; not a government source',values:fixture,comparison},evidenceReference:'fixture:TEST-FIRE-001:v1',error:'Controlled fixture only; cannot satisfy official source verification.'};
  }
  else if (verification.provider === 'DEMO_REGISTRY') {
    const adapter = new DemoRegistryAdapter();
    result = await adapter.verify(fields, verification.application_id);
  }
  else if (process.env.VERIFICATION_PROVIDER_URL && process.env.VERIFICATION_PROVIDER_TOKEN && version) {
    try {
      const provider = new ConfiguredVerificationProvider(process.env.VERIFICATION_PROVIDER_URL, process.env.VERIFICATION_PROVIDER_TOKEN);
      result = { ...await provider.verify({ verificationId: verification.id, provider: verification.provider, documentId: version.document_id, version: version.version_number, sha256: version.sha256, submittedValues: fields }), error: '' };
    } catch (error) {
      result = { result: error.name==='TimeoutError'?'SOURCE_TIMEOUT':['INCONCLUSIVE','MALFORMED_RESPONSE','RATE_LIMITED','NOT_FOUND','AUTHORIZATION_REQUIRED'].includes(error.code)?error.code:'SOURCE_UNAVAILABLE', error: String(error.message || 'Verification source unavailable').slice(0, 500) };
    }
  }
  const completedAt = new Date().toISOString();
  const allowed = new Set(['MALFORMED_RESPONSE','RATE_LIMITED','NOT_FOUND','SOURCE_TIMEOUT','TEST_ONLY','VERIFIED', 'MISMATCH_DETECTED', 'EXPIRED', 'PENDING', 'SOURCE_UNAVAILABLE', 'AUTHORIZATION_REQUIRED', 'INCONCLUSIVE', 'MANUAL_REVIEW_REQUIRED','DEMO_MATCH','DEMO_MISMATCH','DEMO_EXPIRED','DEMO_REVIEW_REQUIRED']);
  if(result.result==='VERIFIED'){
    const source=result.sourceValues?.values||result.sourceValues||{};
    const compared=fields.filter(f=>Object.hasOwn(source,f.field_name));
    if(!compared.length||fields.some(f=>!Object.hasOwn(source,f.field_name))){result.result='INCONCLUSIVE';result.error='The source response does not cover all submitted fields; partial evidence requires review.';}
    else if(compared.some(f=>normalizeValue(source[f.field_name])!==normalizeValue(f.field_value)))result.result='MISMATCH_DETECTED';
    result.sourceValues={...result.sourceValues,comparison:compared.map(f=>({field:f.field_name,submitted:f.field_value,source:source[f.field_name],status:normalizeValue(source[f.field_name])===normalizeValue(f.field_value)?'MATCH':'MISMATCH_DETECTED'}))};
  }
  if(verification.provider!=='CONTROLLED_TEST_SOURCE'&&['VERIFIED','MISMATCH_DETECTED','EXPIRED'].includes(result.result)&&process.env.VERIFICATION_PROVIDER_ENVIRONMENT!=='PRODUCTION'){result.sourceValues={...result.sourceValues,testOutcome:result.result,environment:'TEST'};result.result='TEST_ONLY';result.error='Gateway is in test environment; this is not official verification.';}
  if(!oneRow("SELECT id FROM processing_jobs WHERE id=? AND status='RUNNING'",job.id)||!oneRow('SELECT d.id FROM documents d JOIN document_versions dv ON dv.document_id=d.id AND dv.version_number=d.current_version WHERE dv.id=?',verification.document_version_id)) {execute("UPDATE processing_jobs SET status='SUPERSEDED',finished_at=? WHERE id=?",completedAt,job.id);return true;}
  const status = allowed.has(result.result) ? result.result : 'INCONCLUSIVE';
  execute('UPDATE verifications SET result=?, source_values=?, evidence_reference=?, error_message=?, responded_at=? WHERE id=?',
    status, JSON.stringify(result.sourceValues || {}), String(result.evidenceReference || '').slice(0, 500), String(result.error || '').slice(0, 500), completedAt, verification.id);
  execute('UPDATE document_versions SET verification_result=? WHERE id=?', status, verification.document_version_id);
  refreshApplicationVerificationStatus(verification.application_id);
  execute("UPDATE processing_jobs SET status='COMPLETED', finished_at=? WHERE id=?", completedAt, job.id);
  writeAudit(null, 'SOURCE_VERIFICATION_COMPLETED', 'VERIFICATION', verification.id, 'PENDING', status, result.error || result.evidenceReference || '');
  refreshEligibility(verification.application_id, { actorRole: 'SYSTEM_WORKER' });
  return true;
}

function normalizeExtractedFields(input) {
  if (!Array.isArray(input)) return [];
  return input.filter((field) => field && typeof field.name === 'string' && typeof field.value === 'string')
    .slice(0, 500).map((field) => ({ name: field.name.slice(0, 100), value: field.value.slice(0, 2000), confidence: field.confidence!=null&&Number.isFinite(Number(field.confidence))&&Number(field.confidence)>=0&&Number(field.confidence)<=1 ? Number(field.confidence) : null, page: Number.isInteger(Number(field.page))&&Number(field.page)>0 ? Number(field.page) : null, location: String(field.location || '').slice(0, 1000), method: String(field.method || '').slice(0, 80) }));
}

export async function requestSourceVerification(payload) {
  if (!process.env.VERIFICATION_PROVIDER_URL || !process.env.VERIFICATION_PROVIDER_TOKEN) {
    return { result: 'SOURCE_UNAVAILABLE', error: 'An authorized verification provider is not configured.' };
  }
  try {
    const provider = new ConfiguredVerificationProvider(process.env.VERIFICATION_PROVIDER_URL, process.env.VERIFICATION_PROVIDER_TOKEN);
    const response = await provider.verify(payload);
    return { ...response, error: '' };
  } catch (error) {
    return { result: error.code === 'INCONCLUSIVE' ? 'INCONCLUSIVE' : 'SOURCE_UNAVAILABLE', error: String(error.message || 'Verification source unavailable').slice(0, 500) };
  }
}
