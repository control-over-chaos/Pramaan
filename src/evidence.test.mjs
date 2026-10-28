import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
let root,db,execute,oneRow,evaluateRule,evidence,processNextJob;
const now=new Date().toISOString();
const rule=(type,extra={})=>({condition_json:JSON.stringify({type,documentType:'Fire NOC',...extra})});
before(async()=>{
 root=await mkdtemp(join(tmpdir(),'pramaan-evidence-'));process.env.DATA_DIR=root;process.env.PRIVATE_STORAGE_DIR=join(root,'storage');process.env.NODE_ENV='test';
 ({db,execute,oneRow}=await import('./db.mjs'));({evaluateRule}=await import('./rule-engine.mjs'));evidence=await import('./evidence.mjs');({processNextJob}=await import('./providers.mjs'));
 execute('INSERT INTO users(id,email,display_name,password_hash,created_at) VALUES(?,?,?,?,?)','u','test@example.invalid','Test','unused',now);
 execute('INSERT INTO institutions(id,aicte_id,name,created_at,updated_at) VALUES(?,?,?,?,?)','i','TEST-ONLY','Test',now,now);
 execute('INSERT OR IGNORE INTO application_categories(id,label) VALUES(?,?)','test','Test');
 execute('INSERT INTO applications(id,institution_id,category_id,academic_year,created_at,updated_at) VALUES(?,?,?,?,?,?)','a','i','test','2026-27',now,now);
 execute('INSERT INTO documents(id,institution_id,application_id,document_type,processing_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)','d','i','a','Fire NOC','COMPLETED',now,now);
 execute('INSERT INTO document_versions(id,document_id,version_number,original_name,mime_type,byte_size,sha256,storage_key,uploaded_by,uploaded_at,file_available) VALUES(?,?,?,?,?,?,?,?,?,?,?)','v1','d',1,'test.pdf','application/pdf',4,createHash('sha256').update('test').digest('hex'),'test.pdf','u',now,0);
});
after(async()=>{db?.close();await rm(root,{recursive:true,force:true});});
test('metadata-only documents cannot pass',()=>assert.equal(evaluateRule('a',rule('DOCUMENT_PRESENT')).status,'UNABLE_TO_VERIFY'));
test('unvalidated bytes cannot pass even with correct checksum',async()=>{
 await mkdir(join(root,'storage'));await writeFile(join(root,'storage','test.pdf'),'test');execute('UPDATE document_versions SET file_available=1 WHERE id=?','v1');
 assert.equal(evaluateRule('a',rule('DOCUMENT_PRESENT')).status,'UNABLE_TO_VERIFY');
});
test('validated file integrity prerequisite and tamper detection',async()=>{
 execute('UPDATE document_versions SET validation_json=? WHERE id=?','{"status":"VALID"}','v1');
 assert.equal(evaluateRule('a',rule('DOCUMENT_PRESENT')).status,'PASS');
 await writeFile(join(root,'storage','test.pdf'),'evil');assert.equal(evaluateRule('a',rule('DOCUMENT_PRESENT')).status,'UNABLE_TO_VERIFY');await writeFile(join(root,'storage','test.pdf'),'test');
});
test('unknown confidence abstains; append-only officer confirmation supplies reviewed value',()=>{
 execute('INSERT INTO extracted_fields(id,document_version_id,field_name,field_value,created_at) VALUES(?,?,?,?,?)','f','v1','expiry_date','2027-12-31',now);
 assert.equal(evaluateRule('a',rule('EXPIRY_DATE_VALID'),{assessmentDate:'2026-10-25'}).status,'REVIEW_REQUIRED');
 execute('INSERT INTO field_corrections VALUES(?,?,?,?,?,?)','c','f','2027-12-31','Checked against original','u',now);
 assert.equal(evaluateRule('a',rule('EXPIRY_DATE_VALID'),{assessmentDate:'2026-10-25'}).status,'PASS');
 assert.equal(evaluateRule('a',rule('EXPIRY_DATE_VALID'),{assessmentDate:'2028-01-01'}).status,'FAIL');
 assert.throws(()=>execute("UPDATE field_corrections SET reason='edited'"));
});
test('controlled source cannot pass an official source rule',()=>{
 execute('INSERT INTO verifications(id,application_id,document_version_id,provider,result,requested_by,requested_at,responded_at) VALUES(?,?,?,?,?,?,?,?)','s','a','v1','CONTROLLED_TEST_SOURCE','TEST_ONLY','u',now,now);
 assert.equal(evaluateRule('a',rule('SOURCE_STATUS')).status,'UNABLE_TO_VERIFY');
});
test('old verified version cannot pass after replacement',()=>{
 execute("UPDATE verifications SET result='VERIFIED' WHERE id='s'");execute('UPDATE documents SET current_version=2 WHERE id=?','d');
 execute('INSERT INTO document_versions(id,document_id,version_number,original_name,mime_type,byte_size,sha256,storage_key,uploaded_by,uploaded_at,file_available) VALUES(?,?,?,?,?,?,?,?,?,?,?)','v2','d',2,'new.pdf','application/pdf',1,'x','new.pdf','u',now,0);
 assert.equal(evaluateRule('a',rule('SOURCE_STATUS')).status,'UNABLE_TO_VERIFY');
});
test('obsolete queued jobs are superseded without changing current document',async()=>{
 execute('INSERT INTO processing_jobs(id,application_id,document_version_id,job_type,status,created_at) VALUES(?,?,?,?,?,?)','j','a','v1','DOCUMENT_PIPELINE','QUEUED',now);
 await processNextJob();assert.equal(oneRow("SELECT status FROM processing_jobs WHERE id='j'").status,'SUPERSEDED');assert.equal(oneRow("SELECT current_version FROM documents WHERE id='d'").current_version,2);
});
test('expired worker lease recovers and cannot overwrite new version',async()=>{
 execute("UPDATE processing_jobs SET status='RUNNING',lease_until='2000-01-01',attempts=1 WHERE id='j'");await processNextJob();assert.equal(oneRow("SELECT status FROM processing_jobs WHERE id='j'").status,'SUPERSEDED');
});
test('report section permissions remove nested restricted data',()=>{
 const result=evidence.filterReport({user:{permissions:['report.generate']}},{documents:[1],manifest:[1],findings:[1],attention:{secret:1},blockers:['secret'],sourceVerifications:[1],complianceResults:[1],crossComparisons:[1]});
 assert.deepEqual(result,{documents:[],findings:[],sourceVerifications:[],complianceResults:[],crossComparisons:[]});
});
test('missing current evidence blocks final workflow',()=>assert.ok(evidence.workflowBlockers('a').length));
