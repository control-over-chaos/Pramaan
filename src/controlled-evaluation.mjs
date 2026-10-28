import {randomUUID,createHash}from'node:crypto';
import{readFile,mkdir,writeFile,unlink}from'node:fs/promises';
import{resolve}from'node:path';
import{db,oneRow,execute}from'./db.mjs';
import{requirePermission}from'./domain.mjs';
import{writeAudit}from'./audit.mjs';
import{parseDocument}from'./local-processing.mjs';
export async function loadControlledEvaluation(context,root,storage){
 requirePermission(context,'configuration.manage');
 const existing=oneRow("SELECT id FROM applications WHERE external_reference='PRAMAAN_CONTROLLED_FIXTURE_V1'");if(existing)return {applicationId:existing.id,existing:true};
 const institutionId=randomUUID(),applicationId='APP-TEST-'+randomUUID().slice(0,8).toUpperCase(),documentId=randomUUID(),versionId=randomUUID(),now=new Date().toISOString();
 const bytes=await readFile(resolve(root,'test-fixtures/verification/expired.pdf')),key=`${documentId}/1/${randomUUID()}.pdf`,path=resolve(storage,key);
 await mkdir(resolve(path,'..'),{recursive:true,mode:0o700});await writeFile(path,bytes,{flag:'wx',mode:0o600});
 const parsed=await parseDocument(path,'validate');if(parsed.status!=='VALID'){await unlink(path);throw Object.assign(new Error('Controlled fixture validation failed.'),{status:422});}
 db.exec('BEGIN IMMEDIATE');try{
   const concurrent=oneRow("SELECT id FROM applications WHERE external_reference='PRAMAAN_CONTROLLED_FIXTURE_V1'");if(concurrent){db.exec('ROLLBACK');await unlink(path);return {applicationId:concurrent.id,existing:true};}
   execute('INSERT INTO institutions(id,aicte_id,name,created_at,updated_at) VALUES(?,?,?,?,?)',institutionId,'TEST-ONLY:'+institutionId,'Pramaan Test Institute',now,now);
   execute("INSERT OR IGNORE INTO application_categories(id,label) VALUES('CONTROLLED_TEST','Controlled evaluation — fictional records only')");
   execute('INSERT INTO applications(id,external_reference,institution_id,category_id,academic_year,submission_date,processing_stage,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',applicationId,'PRAMAAN_CONTROLLED_FIXTURE_V1',institutionId,'CONTROLLED_TEST','2026-27','2026-10-25','DOCUMENT_PROCESSING',now,now);
   execute('INSERT INTO documents(id,institution_id,application_id,document_type,created_at,updated_at) VALUES(?,?,?,?,?,?)',documentId,institutionId,applicationId,'Fire NOC',now,now);
   execute('INSERT INTO document_versions(id,document_id,version_number,original_name,mime_type,byte_size,sha256,storage_key,uploaded_by,uploaded_at,validation_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)',versionId,documentId,1,'CONTROLLED-TEST-expired.pdf','application/pdf',bytes.length,createHash('sha256').update(bytes).digest('hex'),key,context.user.id,now,JSON.stringify({status:'VALID',pageCount:parsed.pageCount,malwareScan:'NOT_CONFIGURED'}));
   execute('INSERT INTO processing_jobs(id,application_id,document_version_id,job_type,status,created_at) VALUES(?,?,?,?,?,?)',randomUUID(),applicationId,versionId,'DOCUMENT_PIPELINE','QUEUED',now);
   const ruleSet=randomUUID(),ruleVersion=randomUUID();execute('INSERT INTO rule_sets(id,name,application_category_id,status,created_by,created_at) VALUES(?,?,?,?,?,?)',ruleSet,'CONTROLLED TEST ONLY — Fire NOC evidence checks','CONTROLLED_TEST','DRAFT',context.user.id,now);
   execute('INSERT INTO rule_versions(id,rule_set_id,version_number,status,effective_from) VALUES(?,?,?,?,?)',ruleVersion,ruleSet,1,'DRAFT','2026-01-01');
   for(const[key,title,condition]of[['TEST-FILE','Real current file',{type:'DOCUMENT_PRESENT',documentType:'Fire NOC'}],['TEST-EXPIRY','Expiry on assessment date',{type:'EXPIRY_DATE_VALID',field:'expiry_date'}],['TEST-SOURCE','Official source required',{type:'SOURCE_STATUS',documentType:'Fire NOC'}]])execute('INSERT INTO regulatory_rules(id,rule_version_id,rule_key,title,condition_json,severity,recommended_action) VALUES(?,?,?,?,?,?,?)',randomUUID(),ruleVersion,key,title,JSON.stringify(condition),'MEDIUM','Controlled evaluation only. Review evidence; never infer official approval.');
   writeAudit(context,'CONTROLLED_EVALUATION_CREATED','APPLICATION',applicationId,'',{environment:'CONTROLLED_TEST',documentId,ruleVersion,officialVerification:false});db.exec('COMMIT');return {applicationId,documentId,ruleVersion,existing:false};
 }catch(error){db.exec('ROLLBACK');await unlink(path).catch(()=>{});throw error;}
}
