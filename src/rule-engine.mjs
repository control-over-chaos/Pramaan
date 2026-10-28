import { allRows, oneRow } from './db.mjs';
import { safeJson } from './domain.mjs';
import { currentDocuments, fieldsForVersion, filePrerequisite, fieldReliable, normalizeValue } from './evidence.mjs';

const utcToday = () => new Date().toISOString().slice(0, 10);

export function evaluateRule(applicationId, rule, options = {}) {
  const condition = safeJson(rule.condition_json, {});
  const type = String(condition.type || '').toUpperCase();
  if (type === 'DOCUMENT_PRESENT') return evaluateDocumentPresent(applicationId, rule, condition);
  if (type === 'FIELD_PRESENT') return evaluateFieldPresent(applicationId, rule, condition);
  if (type === 'FIELD_EQUALS') return evaluateFieldEquals(applicationId, rule, condition);
  if (type === 'DATE_VALID') return evaluateDateValid(applicationId, rule, condition);
  if (type === 'INSTITUTION_MATCH') return evaluateInstitutionMatch(applicationId, rule, condition);
  if (type === 'EXPIRY_DATE_VALID') return evaluateExpiryDate(applicationId, rule, condition, options.assessmentDate || utcToday());
  if (type === 'SOURCE_STATUS') return evaluateSourceStatus(applicationId, rule, condition);
  if (type === 'MANUAL_REVIEW') return result('REVIEW_REQUIRED', '', 'Officer review is required by this rule condition.', '', rule.recommended_action);
  return result('UNABLE_TO_VERIFY', '', 'Condition type is unsupported by the configured rule evaluator.', '', rule.recommended_action);
}

function evaluateDocumentPresent(applicationId, rule, condition) {
  const requiredType = String(condition.documentType || '').trim();
  if (!requiredType) return result('UNABLE_TO_VERIFY', '', 'The document type condition is not configured.', '', rule.recommended_action);
  const document = oneRow(`SELECT d.id, d.document_type, d.processing_status, dv.id AS version_id, dv.version_number, dv.original_name
    FROM documents d JOIN document_versions dv ON dv.document_id=d.id AND dv.version_number=d.current_version
    WHERE d.application_id=? AND lower(d.document_type)=lower(?) ORDER BY d.created_at DESC LIMIT 1`, applicationId, requiredType);
  if (!document) return result('FAIL', 'MISSING', `Required document “${requiredType}” has not been received.`, '', rule.recommended_action);
  const prerequisite=filePrerequisite(oneRow('SELECT * FROM document_versions WHERE id=?',document.version_id));
  if(!prerequisite.ok) return result('UNABLE_TO_VERIFY','FILE_UNAVAILABLE',prerequisite.reason,'',rule.recommended_action);
  if(document.processing_status!=='COMPLETED') return result('REVIEW_REQUIRED',document.processing_status,'Processing and field review must finish before this document can satisfy the rule.','',rule.recommended_action);
  const evidence = JSON.stringify([{ documentId: document.id, documentVersionId: document.version_id, version: document.version_number, fileName: document.original_name }]);
  if (['MANUAL_REVIEW','RETRY_REQUIRED','FAILED'].includes(document.processing_status)) return result('REVIEW_REQUIRED', document.processing_status, `Document “${requiredType}” is present but its processing needs officer review.`, evidence, rule.recommended_action);
  return result('PASS', document.document_type, `Required document “${requiredType}” is present.`, evidence, rule.recommended_action);
}

function currentFields(applicationId, fieldName) {
  return currentDocuments(applicationId).flatMap(v=>fieldsForVersion(v.id).filter(f=>normalizeValue(f.field_name)===normalizeValue(fieldName)).map(f=>({...f,document_id:v.document_id,document_type:v.document_type,version_id:v.id,version_number:v.version_number,original_name:v.original_name,file_ready:filePrerequisite(v).ok})));
}
function uncertain(fields,rule) {return fields.some(f=>!f.file_ready||!fieldReliable(f))?result('REVIEW_REQUIRED','UNCERTAIN_EVIDENCE','Current file integrity and sufficiently confident or officer-confirmed fields are required.',evidenceFor(fields),rule.recommended_action):null;}

function evidenceFor(fields) {
  return JSON.stringify(fields.map((field) => ({ documentId: field.document_id, documentVersionId: field.version_id, version: field.version_number,
    fileName: field.original_name, fieldId: field.id, field: field.field_name, value: field.field_value, page: field.page_number, location: field.evidence_location, confidence: field.confidence })));
}

function evaluateFieldPresent(applicationId, rule, condition) {
  const fieldName = String(condition.field || '').trim();
  if (!fieldName) return result('UNABLE_TO_VERIFY', '', 'The field name condition is not configured.', '', rule.recommended_action);
  const fields = currentFields(applicationId, fieldName);
  if (!fields.length) return result('REVIEW_REQUIRED', 'NOT_EXTRACTED', `Field “${fieldName}” was not found in the current extracted evidence.`, '', rule.recommended_action);
  if(uncertain(fields,rule))return uncertain(fields,rule);
  return result('PASS', fields[0].field_value, `Field “${fieldName}” is present in extracted evidence.`, evidenceFor(fields), rule.recommended_action);
}

function evaluateFieldEquals(applicationId, rule, condition) {
  const fieldName = String(condition.field || '').trim();
  if (!fieldName || condition.expected === undefined) return result('UNABLE_TO_VERIFY', '', 'The field equality condition needs a field and expected value.', '', rule.recommended_action);
  const fields = currentFields(applicationId, fieldName);
  if (!fields.length) return result('UNABLE_TO_VERIFY', 'NOT_EXTRACTED', `Field “${fieldName}” is not available in current extracted evidence.`, '', rule.recommended_action);
  if(uncertain(fields,rule))return uncertain(fields,rule);
  const expected = String(condition.expected).trim();
  const match = fields.every((field) => normalizeValue(field.field_value) === normalizeValue(expected));
  return result(match ? 'PASS' : 'FAIL', fields.map((field) => field.field_value).join(' | '), match ? `Extracted “${fieldName}” matches the configured condition.` : `Extracted “${fieldName}” does not match the configured condition.`, evidenceFor(fields), rule.recommended_action);
}

function evaluateDateValid(applicationId, rule, condition) {
  const fieldName = String(condition.field || '').trim();
  if (!fieldName) return result('UNABLE_TO_VERIFY', '', 'The date rule does not name a field.', '', rule.recommended_action);
  const fields = currentFields(applicationId, fieldName);
  if (!fields.length) return result('REVIEW_REQUIRED', 'NOT_EXTRACTED', `Date field “${fieldName}” was not found in extracted evidence.`, '', rule.recommended_action);
  if (uncertain(fields, rule)) return uncertain(fields, rule);
  const valid = fields.every((field) => {
    const value = String(field.field_value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  });
  return result(valid ? 'PASS' : 'FAIL', fields.map((field) => field.field_value).join(' | '), valid ? `Date field “${fieldName}” is a valid calendar date.` : `Date field “${fieldName}” is not an unambiguous YYYY-MM-DD calendar date.`, evidenceFor(fields), rule.recommended_action);
}

function evaluateInstitutionMatch(applicationId, rule, condition) {
  const fieldName = String(condition.field || 'institution_name').trim();
  const fields = currentFields(applicationId, fieldName);
  if (!fields.length) return result('REVIEW_REQUIRED', 'NOT_EXTRACTED', `Institution field “${fieldName}” was not found in extracted evidence.`, '', rule.recommended_action);
  if (uncertain(fields, rule)) return uncertain(fields, rule);
  const institution = oneRow(`SELECT i.name AS institution_name,i.address FROM applications a JOIN institutions i ON i.id=a.institution_id WHERE a.id=?`, applicationId);
  if (!institution) return result('UNABLE_TO_VERIFY', 'INSTITUTION_RECORD_MISSING', 'The application has no institution master record to compare.', evidenceFor(fields), rule.recommended_action);
  const expected = fieldName === 'address' ? institution.address : institution.institution_name;
  if (!String(expected || '').trim()) return result('REVIEW_REQUIRED', 'MASTER_VALUE_MISSING', `The application institution record has no ${fieldName === 'address' ? 'address' : 'name'} to compare.`, evidenceFor(fields), rule.recommended_action);
  const matches = fields.every((field) => normalizeValue(field.field_value) === normalizeValue(expected));
  return result(matches ? 'PASS' : 'MISMATCHED', fields.map((field) => field.field_value).join(' | '), matches ? `Extracted ${fieldName} matches the application’s stored institution record.` : `Extracted ${fieldName} differs from the application’s stored institution record; confirm the identity and address.`, evidenceFor(fields), rule.recommended_action);
}

function evaluateExpiryDate(applicationId, rule, condition, assessmentDate) {
  const fieldName = String(condition.field || 'expiry_date');
  const fields = currentFields(applicationId, fieldName);
  if (!fields.length) return result('UNABLE_TO_VERIFY', 'NOT_EXTRACTED', `Expiry field “${fieldName}” is not available in current extracted evidence.`, '', rule.recommended_action);
  if(uncertain(fields,rule))return uncertain(fields,rule);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(assessmentDate)||fields.some(f=>!/^\d{4}-\d{2}-\d{2}$/.test(f.field_value)||Number.isNaN(Date.parse(f.field_value))||new Date(f.field_value).toISOString().slice(0,10)!==f.field_value))return result('REVIEW_REQUIRED','AMBIGUOUS_DATE','Use a valid, unambiguous YYYY-MM-DD date.',evidenceFor(fields),rule.recommended_action);
  const expiry = new Date(fields[0].field_value);
  if (Number.isNaN(expiry.valueOf())) return result('REVIEW_REQUIRED', fields[0].field_value, 'Expiry date could not be interpreted from the extracted value.', evidenceFor([fields[0]]), rule.recommended_action);
  const valid = fields.every(f=>f.field_value>=assessmentDate);
  return result(valid ? 'PASS' : 'FAIL', fields.map(f=>f.field_value).join(' | '), `Expiry assessed against ${assessmentDate}: ${valid?'current':'expired'}.`, evidenceFor(fields), rule.recommended_action);
}

function evaluateSourceStatus(applicationId, rule, condition) {
  const documentType = String(condition.documentType || '').trim();
  const clauses = ['v.application_id=?','d.current_version=dv.version_number'];
  const params = [applicationId];
  if (documentType) { clauses.push('lower(d.document_type)=lower(?)'); params.push(documentType); }
  const rows = allRows(`SELECT v.id, v.result, v.provider, v.evidence_reference, v.error_message, d.id AS document_id, d.document_type, dv.version_number
    FROM verifications v JOIN document_versions dv ON dv.id=v.document_version_id JOIN documents d ON d.id=dv.document_id
    WHERE ${clauses.join(' AND ')} ORDER BY v.requested_at DESC`, ...params);
  if (!rows.length) return result('UNABLE_TO_VERIFY', 'NOT_REQUESTED', 'No authorized source verification response is recorded.', '', rule.recommended_action);
  const row = rows[0];
  const evidence = JSON.stringify([{ verificationId: row.id, provider: row.provider, result: row.result, evidenceReference: row.evidence_reference, documentId: row.document_id, version: row.version_number }]);
  const versions=currentDocuments(applicationId).filter(v=>!documentType||normalizeValue(v.document_type)===normalizeValue(documentType));
  if(versions.some(v=>!filePrerequisite(v).ok))return result('UNABLE_TO_VERIFY','FILE_UNAVAILABLE','Current source checks require validated file evidence.',evidence,rule.recommended_action);
  const latest=versions.map(v=>oneRow('SELECT * FROM verifications WHERE document_version_id=? ORDER BY requested_at DESC,rowid DESC LIMIT 1',v.id));
  if(latest.some(v=>v&&oneRow('SELECT fc.id FROM field_corrections fc JOIN extracted_fields ef ON ef.id=fc.field_id WHERE ef.document_version_id=? AND fc.created_at>=? LIMIT 1',v.document_version_id,v.requested_at)))return result('UNABLE_TO_VERIFY','FIELDS_CHANGED','Field review occurred after this source request; verify the corrected values again.',evidence,rule.recommended_action);
  if(!latest.length||latest.some(v=>!v||!['VERIFIED','MISMATCH_DETECTED','EXPIRED'].includes(v.result)))return result('UNABLE_TO_VERIFY','INCOMPLETE_SOURCE_EVIDENCE','Every relevant current version needs a conclusive authorized source response. Test-only and unavailable responses cannot pass.',evidence,rule.recommended_action);
  if(latest.some(v=>!v.responded_at||Date.now()-Date.parse(v.responded_at)>Number(process.env.SOURCE_MAX_AGE_HOURS||24)*3600000))return result('UNABLE_TO_VERIFY','STALE_SOURCE','Refresh the source response before evaluating this rule.',evidence,rule.recommended_action);
  const expected = String(condition.expectedStatus || 'VERIFIED').toUpperCase();
  return result(latest.every(v=>v.result===expected)?'PASS':'FAIL',latest.map(v=>v.result).join(' | '),`Current source results were compared with ${expected}.`,JSON.stringify(latest.map(v=>({verificationId:v.id,documentVersionId:v.document_version_id,provider:v.provider,result:v.result,evidenceReference:v.evidence_reference,respondedAt:v.responded_at}))),rule.recommended_action);
}

function result(status, actualValue, reason, evidenceReference, recommendedAction) {
  const supported = new Set(['PASS','FAIL','REVIEW_REQUIRED','NOT_APPLICABLE','UNABLE_TO_VERIFY']);
  return { status: supported.has(status) ? status : 'UNABLE_TO_VERIFY', actualValue, expectedCondition: '', reason, evidenceReference, recommendedAction: recommendedAction || '' };
}
