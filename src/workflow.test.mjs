import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
test('HTTP journey: evidence, rectification, snapshots, role matrix, concurrency and process restart', {timeout:120000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'pramaan-http-')),port=19000+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
 const launch=()=>spawn(process.execPath,['src/server.mjs'],{env:{...process.env,PORT:String(port),DATA_DIR:root,PRIVATE_STORAGE_DIR:join(root,'storage'),NODE_ENV:'test',OCR_PROVIDER_URL:'',OCR_PROVIDER_TOKEN:'',AI_ASSISTANT_API_KEY:'',VERIFICATION_PROVIDER_URL:'',VERIFICATION_PROVIDER_TOKEN:''},windowsHide:true,stdio:['ignore','pipe','pipe']});
 let child=launch();
 let logs='',cookie='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 const call=async(path,body,expected=200,method=body?'POST':'GET')=>{
  const response=await fetch(base+'/api/v1'+path,{method,headers:{Origin:base,...(cookie?{Cookie:cookie}:{}),...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
  const result=await response.json();assert.equal(response.status,expected,`${path}: ${JSON.stringify(result)}`);if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];return result.data;
 };
 const waitFor=async(fn)=>{for(let n=0;n<60;n++){const result=await fn();if(result)return result;await delay(250);}throw new Error('Timed out waiting for persisted job: '+logs);};
 try {
  await waitFor(async()=>{try{return (await fetch(base+'/api/v1/auth/state')).ok;}catch{return false;}});
  const password='Test-'+randomBytes(16).toString('hex')+'Aa1';
  await call('/auth/bootstrap',{email:'admin@example.invalid',displayName:'Test Admin',password},201);
  const adminCookie=cookie;
  const institution=await call('/institutions',{name:'Pramaan Test Institute',aicteId:'CONTROLLED-TEST-ONLY',address:'1 Test Road'},201);
  const categories=await call('/application-categories');const application=await call('/applications',{institutionId:institution.id,categoryId:categories[0].id,academicYear:'2026-27'},201);
  const upload=async(name,documentId)=>{
   const form=new FormData();form.set('applicationId',application.id);form.set('documentType','Fire NOC');if(documentId){form.set('documentId',documentId);form.set('replacementReason','Corrected controlled test evidence');}form.set('file',new Blob([await readFile(new URL('../test-fixtures/verification/'+name,import.meta.url))],{type:'application/pdf'}),name);
   return call('/documents',form,201);
  };
  const doc=await upload('expired.pdf');
  const detail=await waitFor(async()=>{const d=await call('/documents/'+doc.id);return d.jobs.some(j=>j.status==='COMPLETED')?d:false;});assert.equal(detail.extractedFields.length,5);
  const preview=await fetch(base+`/api/v1/documents/${doc.id}/preview?page=1`,{headers:{Cookie:cookie}});assert.equal(preview.status,200);assert.equal(preview.headers.get('content-type'),'image/png');
  const source=await call('/verifications',{documentId:doc.id,provider:'CONTROLLED_TEST_SOURCE'},202);
  await waitFor(async()=>{const d=await call('/applications/'+application.id);return d.verifications.find(v=>v.id===source.id&&v.result==='TEST_ONLY');});
  await call('/rules',{name:'Controlled expiry test',categoryId:categories[0].id,rules:[{key:'FIRE-EXPIRY',title:'Fire NOC expiry',condition:{type:'EXPIRY_DATE_VALID',field:'expiry_date'},severity:'HIGH',recommendedAction:'Upload renewed evidence'}]},201);
  const rule=(await call('/rules'))[0];await call(`/rules/${rule.current_version_id}/test`,{applicationId:application.id},201);await call(`/rules/${rule.current_version_id}/publish`,{});
  const run=await call('/compliance/execute',{applicationId:application.id},202);await waitFor(async()=>{const j=await call('/jobs/'+run.jobId);return j.status==='COMPLETED';});
  let app=await call('/applications/'+application.id);assert.equal(app.compliance[0].status,'FAIL');assert.equal(app.documents[0].extracted_fields.length,5);
  const finding=app.findings.find(f=>f.source==='REGULATORY_RULE');assert.ok(finding);
  await call(`/findings/${finding.id}/review`,{action:'REQUEST_RECTIFICATION',reason:'Upload a renewed controlled certificate.'});
  const request=(await call('/applications/'+application.id)).rectifications[0];assert.ok(request);
  await call(`/rectifications/${request.id}`,{response:'A corrected fixture will be uploaded.'},200,'PATCH');
  const report=await call('/reports',{applicationId:application.id},201);assert.equal(report.content.documents[0].fields.length,5);assert.equal(report.content.complianceResults[0].status,'FAIL');
  const replacement=await upload('corrected.pdf',doc.id);assert.equal(replacement.version_number,2);
  app=await call('/applications/'+application.id);assert.equal(app.compliance.length,0);assert.equal(app.verifications.length,0);
  await waitFor(async()=>{const d=await call('/documents/'+doc.id);return d.versions[0].processing_result==='COMPLETED';});
  const rerun=await call('/compliance/execute',{applicationId:application.id},202);await waitFor(async()=>{const j=await call('/jobs/'+rerun.jobId);return j.status==='COMPLETED';});
  app=await call('/applications/'+application.id);assert.equal(app.compliance[0].status,'PASS');
  await call(`/findings/${finding.id}/review`,{action:'RESOLVE',reason:'Current expiry rule passed on replacement evidence.'});
  const original=await call('/reports/'+report.id);assert.equal(original.content.documents[0].version_number,1);assert.equal(original.content.complianceResults[0].status,'FAIL');assert.equal(original.content_json,undefined);
  await call('/users',{email:'inspector@example.invalid',displayName:'Test Inspector',password,role:'INSPECTION_OFFICER'},201);
  await call('/auth/login',{email:'inspector@example.invalid',password});
  await call('/applications/'+application.id,undefined,403);
  await call('/auth/password',{currentPassword:password,newPassword:password+'New2'});
  const restricted=await call('/applications/'+application.id);assert.equal(restricted.compliance.length,0);assert.equal(restricted.verifications.length,0);
  const restrictedReport=await call('/reports/'+report.id);assert.equal(restrictedReport.content.complianceResults.length,0);assert.equal(restrictedReport.content.sourceVerifications.length,0);assert.equal(restrictedReport.content_json,undefined);
  cookie=adminCookie;
  const roles=[['SCRUTINY_OFFICER',true,true],['VERIFICATION_OFFICER',true,true],['APPROVING_AUTHORITY',true,true],['AUDITOR',true,false],['REGULATORY_ADMINISTRATOR',true,true]];
  for(const[role,ruleAccess,sourceAccess]of roles){
    cookie=adminCookie;const email=role.toLowerCase()+'@example.invalid';await call('/users',{email,displayName:'Test '+role,password,role},201);await call('/auth/login',{email,password});await call('/auth/password',{currentPassword:password,newPassword:password+'New2'});
    await call('/compliance',undefined,ruleAccess?200:403);await call('/verifications',undefined,sourceAccess?200:403);
    const scopedReport=await call('/reports/'+report.id);if(!sourceAccess)assert.equal(scopedReport.content.sourceVerifications.length,0);
  }
  cookie=adminCookie;
  const other=await call('/institutions',{name:'Other Test Institute',aicteId:'OTHER-TEST-ONLY'},201);
  await call('/users',{email:'institution@example.invalid',displayName:'Institution Test',password,role:'INSTITUTION_USER',institutionId:other.id},201);await call('/auth/login',{email:'institution@example.invalid',password});await call('/auth/password',{currentPassword:password,newPassword:password+'New2'});
  await call('/applications/'+application.id,undefined,404);await call('/documents/'+doc.id,undefined,404);await call('/reports/'+report.id,undefined,403);
  cookie=adminCookie;
  const concurrent=await Promise.allSettled([upload('corrected.pdf',doc.id),upload('corrected.pdf',doc.id)]);assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);assert.equal(concurrent.filter(r=>r.status==='rejected').length,1);
  await waitFor(async()=>{const d=await call('/documents/'+doc.id);return d.versions[0].processing_result==='COMPLETED';});
  child.kill();await new Promise(resolve=>child.once('exit',resolve));
  const store=new DatabaseSync(join(root,'pramaan.sqlite')),version=store.prepare('SELECT dv.id FROM document_versions dv JOIN documents d ON d.id=dv.document_id AND d.current_version=dv.version_number WHERE d.id=?').get(doc.id),recoveryId=randomUUID();
  store.prepare("INSERT INTO processing_jobs(id,application_id,document_version_id,job_type,status,attempts,created_at,lease_until) VALUES(?,?,?,'DOCUMENT_PIPELINE','RUNNING',1,?,'2000-01-01')").run(recoveryId,application.id,version.id,new Date().toISOString());store.close();
  child=launch();child.stderr.on('data',b=>logs+=b);await waitFor(async()=>{try{return(await fetch(base+'/api/v1/auth/state')).ok;}catch{return false;}});
  await waitFor(async()=>{const j=await call('/jobs/'+recoveryId);return j.status==='COMPLETED';});
  const recovered=await call('/documents/'+doc.id);assert.equal(recovered.extractedFields.filter(f=>f.document_version_id===version.id).length,5);
  const form=new FormData();form.set('applicationId',application.id);form.set('documentType','Fire NOC');form.set('file',new Blob([await readFile(new URL('../test-fixtures/verification/corrupt.pdf',import.meta.url))],{type:'application/pdf'}),'corrupt.pdf');await call('/documents',form,422);
  const evaluation=await call('/evaluation/setup',{},201),sameEvaluation=await call('/evaluation/setup',{},201);assert.equal(evaluation.applicationId,sameEvaluation.applicationId);assert.equal(sameEvaluation.existing,true);
  const reviewApplication=await call('/applications',{institutionId:institution.id,categoryId:categories[0].id,academicYear:'2026-27'},201);
  const reviewTypes=[
   {documentType:'Financial Document',key:'FINANCIAL_DOCUMENT_PRESENT',title:'Financial evidence received'},
   {documentType:'Faculty Document',key:'OPERATIONAL_FACULTY_RECORD_PRESENT',title:'Faculty evidence received'},
   {documentType:'Infrastructure Certificate',key:'OPERATIONAL_INFRASTRUCTURE_PRESENT',title:'Infrastructure evidence received'},
  ];
  for(const item of reviewTypes) await call('/rules',{name:'Controlled '+item.key,categoryId:categories[0].id,rules:[{key:item.key,title:item.title,condition:{type:'DOCUMENT_PRESENT',documentType:item.documentType,mandatory:true},severity:'HIGH',recommendedAction:'Attach the corresponding evidence.'}]},201);
  for(const item of reviewTypes){
   const form=new FormData();form.set('applicationId',reviewApplication.id);form.set('documentType',item.documentType);form.set('file',new Blob([await readFile(new URL('../test-fixtures/verification/expired.pdf',import.meta.url))],{type:'application/pdf'}),item.key+'.pdf');
   const uploaded=await call('/documents',form,201);
   const reviewed=await waitFor(async()=>{const detail=await call('/documents/'+uploaded.id);return detail.aiReview&&detail.jobs.some(j=>j.job_type==='AI_DOCUMENT_REVIEW'&&j.status==='COMPLETED')?detail:false;});
   assert.equal(reviewed.aiReview.engine_status,'LOCAL_RULES_ONLY');
   assert.equal(reviewed.aiReview.result.profile,item.documentType==='Financial Document'?'FINANCIAL':item.documentType==='Faculty Document'?'FACULTY':'INFRASTRUCTURE');
   const presence=reviewed.aiReview.result.rules.find(rule=>rule.ruleKey===item.key);assert.ok(presence);assert.equal(presence.source,'DRAFT_REVIEW_ONLY');assert.equal(presence.status,'PASSED');
   assert.ok(reviewed.aiReview.result.rules.some(rule=>rule.ruleKey.startsWith(item.documentType==='Financial Document'?'FIN-':item.documentType==='Faculty Document'?'FAC-':'INF-')));
   const retry=await call('/documents/'+uploaded.id+'/ai-review',{},202);assert.equal(retry.status,'QUEUED');
   await waitFor(async()=>{const detail=await call('/documents/'+uploaded.id);return detail.jobs.some(j=>j.id===retry.jobId&&j.status==='COMPLETED')?detail:false;});
  }
  const fireUpload=async(name)=>{const form=new FormData();form.set('applicationId',reviewApplication.id);form.set('documentType','Fire NOC');form.set('file',new Blob([await readFile(new URL('../test-fixtures/verification/'+name,import.meta.url))],{type:'application/pdf'}),name);return call('/documents',form,201);};
  const [currentFire,expiredFire]=await Promise.all([fireUpload('corrected.pdf'),fireUpload('expired.pdf')]);
  const [currentFireResult,expiredFireResult]=await Promise.all([currentFire,expiredFire].map(async uploaded=>await waitFor(async()=>{const detail=await call('/documents/'+uploaded.id);return detail.aiReview&&detail.jobs.some(j=>j.job_type==='AI_DOCUMENT_REVIEW'&&j.status==='COMPLETED')?detail:false;})));
  assert.equal(currentFireResult.aiReview.status,'PASSED');assert.equal(expiredFireResult.aiReview.status,'EXPIRED');
 } finally {child.kill();await new Promise(resolve=>child.once('exit',resolve));await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
