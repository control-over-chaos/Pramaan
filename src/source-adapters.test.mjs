import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let root, db, execute, DemoRegistryAdapter, DigiLockerRequesterAdapter, trustHubStatus;
const now = new Date().toISOString();
const ids = { user:'demo-source-user', institution:'demo-source-inst', application:'demo-source-app' };

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'pramaan-source-adapters-'));
  process.env.DATA_DIR = root;
  process.env.NODE_ENV = 'test';
  ({ db, execute } = await import('./db.mjs'));
  ({ DemoRegistryAdapter, DigiLockerRequesterAdapter, trustHubStatus } = await import('./source-adapters.mjs'));
  execute('INSERT INTO users(id,email,display_name,password_hash,created_at) VALUES(?,?,?,?,?)',ids.user,'demo-source@example.test','Demo source test','unused',now);
  execute('INSERT INTO institutions(id,aicte_id,name,created_at,updated_at) VALUES(?,?,?,?,?)',ids.institution,'DEMO-SOURCE-TEST','Synthetic Adapter Test Institute',now,now);
  execute('INSERT INTO applications(id,institution_id,category_id,academic_year,created_at,updated_at) VALUES(?,?,?,?,?,?)',ids.application,ids.institution,'NEW_INSTITUTION','2026-27',now,now);
});

after(async () => { db?.close(); await rm(root, {recursive:true,force:true}); });

const validFields = [
  ['certificate_number','DEMO-CERT-001'],['registration_number','DEMO-REG-001'],
  ['institution_name','Suryodaya Technical Institute'],['address','Sector 12, Sample Nagar, Karnataka'],
  ['issue_date','2025-01-01'],['expiry_date','2027-12-31'],
].map(([field_name,field_value])=>({field_name,field_value}));

test('demo registry is separate, synthetic, and clearly not an official source', async () => {
  const status = await new DemoRegistryAdapter().getConnectionStatus();
  assert.equal(status.status,'DEMO_CONNECTED');
  assert.equal(status.official,false);
  const hub = await trustHubStatus();
  assert.equal(hub.demoCases.length,10);
  assert.equal(hub.demoCases.filter((item)=>item.sourceAvailable).length,9);
  assert.equal(hub.sources.find((item)=>item.provider==='DIGILOCKER').status,'NOT_CONNECTED');
});

test('synthetic registry compares submitted extracted fields against stored records', async () => {
  execute('INSERT INTO documents(id,institution_id,application_id,document_type,created_at,updated_at) VALUES(?,?,?,?,?,?)','demo-source-doc',ids.institution,ids.application,'Fire NOC',now,now);
  execute('INSERT INTO document_versions(id,document_id,version_number,original_name,mime_type,byte_size,sha256,storage_key,uploaded_by,uploaded_at,file_available) VALUES(?,?,?,?,?,?,?,?,?,?,?)','demo-source-doc-v1','demo-source-doc',1,'sample.pdf','application/pdf',0,'fixture-hash','demo-source-sample.pdf',ids.user,now,0);
  const adapter = new DemoRegistryAdapter();
  const match = await adapter.verify(validFields,ids.application);
  assert.equal(match.result,'DEMO_MATCH');
  assert.equal(match.sourceValues.official,false);
  assert.ok(match.sourceValues.comparisons.every((item)=>item.status==='MATCH'));

  const mismatch = await adapter.verify(validFields.map((item)=>item.field_name==='registration_number'?{...item,field_value:'DEMO-REG-ALT-002'}:item),ids.application);
  assert.equal(mismatch.result,'DEMO_MISMATCH');
  assert.deepEqual(mismatch.sourceValues.findings[0].fields,['registration_number']);

  const expiredFields=validFields.map((item)=>item.field_name==='certificate_number'?{...item,field_value:'DEMO-CERT-003'}:item)
    .map((item)=>item.field_name==='registration_number'?{...item,field_value:'DEMO-REG-003'}:item)
    .map((item)=>item.field_name==='institution_name'?{...item,field_value:'Aarohan Learning Institute'}:item)
    .map((item)=>item.field_name==='address'?{...item,field_value:'Road 4, Example City, Rajasthan'}:item)
    .map((item)=>item.field_name==='issue_date'?{...item,field_value:'2022-01-01'}:item)
    .map((item)=>item.field_name==='expiry_date'?{...item,field_value:'2024-12-31'}:item);
  assert.equal((await adapter.verify(expiredFields,ids.application)).result,'DEMO_EXPIRED');
  assert.equal((await adapter.verify(validFields.map((item)=>item.field_name==='certificate_number'?{...item,field_value:'DEMO-CERT-006'}:item),ids.application)).result,'SOURCE_UNAVAILABLE');
  assert.equal((await adapter.verify(validFields.map((item)=>item.field_name==='certificate_number'?{...item,field_value:'DEMO-CERT-010'}:item),ids.application)).result,'DEMO_REVIEW_REQUIRED');
});

test('missing required sample documents remain a review state; demo results never become verified', async () => {
  const adapter = new DemoRegistryAdapter();
  const appWithoutDocs = 'demo-source-no-doc-app';
  execute('INSERT INTO applications(id,institution_id,category_id,academic_year,created_at,updated_at) VALUES(?,?,?,?,?,?)',appWithoutDocs,ids.institution,'NEW_INSTITUTION','2026-27',now,now);
  const fields = validFields.map((item)=>item.field_name==='certificate_number'?{...item,field_value:'DEMO-CERT-004'}:item)
    .map((item)=>item.field_name==='registration_number'?{...item,field_value:'DEMO-REG-004'}:item)
    .map((item)=>item.field_name==='institution_name'?{...item,field_value:'Nirmal Institute of Technology'}:item)
    .map((item)=>item.field_name==='address'?{...item,field_value:'Campus Road, Example District, Gujarat'}:item)
    .map((item)=>item.field_name==='issue_date'?{...item,field_value:'2025-03-01'}:item);
  const result = await adapter.verify(fields,appWithoutDocs);
  assert.equal(result.result,'DEMO_REVIEW_REQUIRED');
  assert.deepEqual(result.sourceValues.missingDocuments,['Fire NOC','Registration Certificate']);
  assert.notEqual(result.result,'VERIFIED');
});

test('DigiLocker remains unconnected and does not fabricate OAuth behavior', async () => {
  const adapter = new DigiLockerRequesterAdapter();
  assert.equal((await adapter.getConnectionStatus()).status,'NOT_CONNECTED');
  await assert.rejects(adapter.beginAuthorization(),{code:'DIGILOCKER_NOT_CONNECTED'});
  await assert.rejects(adapter.importDocument(),{code:'DIGILOCKER_NOT_CONNECTED'});
});
