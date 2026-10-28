import { readFileSync, statSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { allRows, oneRow } from './db.mjs';

export const capabilities = [
 {documentType:'Fire NOC',support:'AI_EVIDENCE_REVIEW',fields:['certificate_number','institution_name','address','issue_date','expiry_date'],checks:['uploaded-file integrity','required fields','expiry','identity/address comparison'],source:'Gemini evidence assessment plus deterministic local checks; advisory only'},
 {documentType:'Financial Document',support:'AI_EVIDENCE_REVIEW',fields:['institution_name','accounting_period','financial_year'],checks:['financial statement sections','audit evidence visible','applicable recent-year coverage','institution identity'],source:'Gemini checks extracted evidence; auditor credentials and financial solvency are not authenticated'},
 {documentType:'Faculty Document',support:'AI_EVIDENCE_REVIEW',fields:['faculty_name','department','designation','qualification','experience'],checks:['roster details','qualification/experience details visible','staffing context'],source:'Gemini checks extracted evidence; degrees and faculty credentials are not authenticated'},
 {documentType:'Infrastructure Certificate',support:'AI_EVIDENCE_REVIEW',fields:['institution_name','facility','programme','area','capacity'],checks:['facility inventory','programme mapping','capacity/area evidence'],source:'Gemini checks extracted evidence; physical facilities require inspection and no thresholds are invented'},
];
export function normalizeValue(value) { return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-IN'); }
export function filePrerequisite(version) {
 if (!version || !version.file_available) return {ok:false,reason:'No real file is attached to this document version.'};
 try {
  const root=resolve(process.env.PRIVATE_STORAGE_DIR || './storage'), path=resolve(root,version.storage_key), rel=relative(root,path);
  if(isAbsolute(rel)||rel.startsWith('..')) return {ok:false,reason:'The storage reference is invalid.'};
  const stat=statSync(path);
  if(!stat.isFile()||stat.size!==version.byte_size||stat.size>15*1024*1024) return {ok:false,reason:'The stored file size does not match its evidence record.'};
  if(createHash('sha256').update(readFileSync(path)).digest('hex')!==version.sha256) return {ok:false,reason:'The stored file checksum does not match its evidence record.'};
  const validation=JSON.parse(version.validation_json||'{}');
  if(validation.status!=='VALID') return {ok:false,reason:validation.reason||'File structure has not been validated. Reprocess this version.'};
  return {ok:true};
 } catch { return {ok:false,reason:'The stored file is unavailable or unreadable.'}; }
}
export function currentDocuments(applicationId) {
 return allRows(`SELECT dv.*,d.id AS document_id,d.document_type,d.processing_status FROM documents d JOIN document_versions dv ON dv.document_id=d.id AND dv.version_number=d.current_version WHERE d.application_id=? ORDER BY d.id`,applicationId);
}
export function fieldsForVersion(versionId) {
 return allRows(`SELECT ef.*,ef.field_value AS raw_value,
 COALESCE((SELECT corrected_value FROM field_corrections fc WHERE fc.field_id=ef.id ORDER BY created_at DESC,rowid DESC LIMIT 1),ef.field_value) AS field_value,
 (SELECT id FROM field_corrections fc WHERE fc.field_id=ef.id ORDER BY created_at DESC,rowid DESC LIMIT 1) AS correction_id
 FROM extracted_fields ef WHERE ef.document_version_id=? ORDER BY ef.page_number,ef.field_name`,versionId).map(f=>({...f,normalized_value:normalizeValue(f.field_value),corrections:allRows('SELECT * FROM field_corrections WHERE field_id=? ORDER BY created_at',f.id)}));
}
export function fieldReliable(field, threshold=Number(process.env.EXTRACTION_CONFIDENCE_THRESHOLD||0.85)) {
 return Boolean(field.correction_id)||field.extraction_method==='PDF_TEXT'||(field.confidence!==null && field.confidence!==undefined && Number.isFinite(Number(field.confidence))&&Number(field.confidence)>=threshold&&Number(field.confidence)<=1);
}
export function documentManifest(id) { return currentDocuments(id).map(v=>({documentId:v.document_id,versionId:v.id,version:v.version_number,sha256:v.sha256,corrections:fieldsForVersion(v.id).filter(f=>f.correction_id).map(f=>f.correction_id)})); }
export function currentCompliance(id) {
 const manifest=JSON.stringify(documentManifest(id));
 return allRows(`SELECT cr.*,rr.title AS requirement,rr.rule_key,rr.condition_json,rr.severity,rv.version_number,rs.name AS rule_set,re.assessment_date,re.finished_at AS evaluated_at,re.document_manifest FROM compliance_results cr JOIN regulatory_rules rr ON rr.id=cr.rule_id JOIN rule_versions rv ON rv.id=rr.rule_version_id JOIN rule_sets rs ON rs.id=rv.rule_set_id JOIN rule_executions re ON re.id=cr.execution_id WHERE re.application_id=? AND re.status='COMPLETED' AND re.id=(SELECT r2.id FROM rule_executions r2 WHERE r2.application_id=re.application_id AND r2.rule_version_id=re.rule_version_id AND r2.status='COMPLETED' ORDER BY r2.started_at DESC,r2.rowid DESC LIMIT 1)`,id).filter(r=>r.document_manifest===manifest);
}
export function crossComparisons(id) {
 const docs=currentDocuments(id), rows=[];
 for(const name of ['institution_name','address','certificate_number','academic_year']) {
  const values=docs.flatMap(v=>fieldsForVersion(v.id).filter(f=>f.field_name===name).map(f=>({...f,documentId:v.document_id,versionId:v.id,version:v.version_number,fileReady:filePrerequisite(v).ok})));
  const distinct=new Set(values.map(f=>f.documentId));
  const status=distinct.size<2?'NOT_APPLICABLE':values.some(f=>!f.fileReady||!fieldReliable(f))?'REVIEW_REQUIRED':new Set(values.map(f=>f.normalized_value)).size===1?'MATCH':'MISMATCH_DETECTED';
  rows.push({field:name,status,values,reason:distinct.size<2?'Two current documents containing this field are required.':status==='REVIEW_REQUIRED'?'Confirm uncertain extracted fields before comparing.':'Deterministic comparison of current document values; this does not authenticate an issuer.'});
 }
 return rows;
}
export function workflowBlockers(id) {
 const docs=currentDocuments(id), blockers=[];
 if(!docs.length) blockers.push('Attach the required document evidence.');
 for(const v of docs) {const check=filePrerequisite(v);if(!check.ok) blockers.push(`${v.document_type}: ${check.reason}`);else if(v.processing_result!=='COMPLETED') blockers.push(`${v.document_type}: complete processing and field review.`);}
 if(oneRow("SELECT COUNT(*) AS n FROM processing_jobs WHERE application_id=? AND status IN ('QUEUED','RUNNING')",id).n) blockers.push('Wait for active processing jobs to finish.');
 if(oneRow("SELECT COUNT(*) AS n FROM findings WHERE application_id=? AND status NOT IN ('RESOLVED','DISMISSED','SUPERSEDED')",id).n) blockers.push('Resolve or dismiss open findings with a recorded reason.');
 const rules=currentCompliance(id);
 if(!rules.length) blockers.push('Run applicable published rules against the current evidence.');
 else if(rules.some(r=>!['PASS','NOT_APPLICABLE'].includes(r.status))) blockers.push('Address unsuccessful or uncertain compliance checks and rerun them.');
 if(crossComparisons(id).some(r=>r.status==='MISMATCH_DETECTED')) blockers.push('Resolve inconsistent current document values.');
 return [...new Set(blockers)];
}
export function filterReport(context,content) {
 const p=new Set(context.user.permissions), copy=structuredClone(content);
 if(!p.has('document.read')) {copy.documents=[];delete copy.manifest;}
 if(!p.has('finding.read')) {copy.findings=[];delete copy.attention;delete copy.blockers;}
 if(!p.has('verification.review')) copy.sourceVerifications=[];
 if(!p.has('rule.read')) copy.complianceResults=[];
 if(!p.has('document.verify')) copy.crossComparisons=[];
 return copy;
}
