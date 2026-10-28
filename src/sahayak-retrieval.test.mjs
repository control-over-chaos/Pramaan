import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let dataDir;
let db;
let execute;
let allRows;
let retrieveForSahayak;
let sahayakFallbackAnswer;
let context;
const id = {
  user: 'eval-user', institution: 'eval-inst', application: 'eval-app', document: 'eval-doc',
  version: 'eval-doc-v1', verification: 'eval-verification', ruleSet: 'eval-ruleset',
  ruleVersion: 'eval-rule-version', rule: 'eval-rule', passRule: 'eval-pass-rule', missingRule: 'eval-missing-document-rule', currentExecution: 'eval-current-run',
  oldExecution: 'eval-old-run', currentResult: 'eval-current-result', oldResult: 'eval-old-result',
};

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'pramaan-sahayak-eval-'));
  process.env.DATA_DIR = dataDir;
  process.env.NODE_ENV = 'test';
  ({ db, execute, allRows } = await import('./db.mjs'));
  await import('./dataset-import.mjs');
  ({ retrieveForSahayak, sahayakFallbackAnswer } = await import('./sahayak.mjs'));

  const now = new Date().toISOString();
  execute('INSERT INTO users(id,email,display_name,password_hash,created_at) VALUES(?,?,?,?,?)', id.user, 'eval@example.test', 'Evaluation User', 'test-only', now);
  execute(`INSERT INTO institutions(id,aicte_id,name,institution_type,address,district,state_ut,establishment_year,affiliating_university,current_approval_status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, id.institution, 'EVAL-001', 'Maharashtra Evaluation Institute', 'Technical', '', 'Pune', 'Maharashtra', 2000, '', 'UNKNOWN', now, now);
  const category = allRows('SELECT id FROM application_categories LIMIT 1')[0];
  execute(`INSERT INTO applications(id,external_reference,institution_id,category_id,academic_year,submission_date,processing_stage,validation_status,verification_status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`, id.application, 'EVAL-APP-1', id.institution, category.id, '2025-26', '2025-01-10', 'OFFICER_REVIEW', 'PENDING', 'PENDING', now, now);
  execute(`INSERT INTO documents(id,institution_id,application_id,document_type,processing_status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?)`, id.document, id.institution, id.application, 'Approval Letter', 'COMPLETED', now, now);
  execute(`INSERT INTO document_versions(id,document_id,version_number,original_name,mime_type,byte_size,sha256,storage_key,uploaded_by,uploaded_at,processing_result,verification_result)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, id.version, id.document, 1, 'approval.pdf', 'application/pdf', 12, 'test-hash', 'eval/approval.pdf', id.user, now, 'COMPLETED', 'PENDING');
  execute(`INSERT INTO verifications(id,application_id,document_version_id,provider,result,requested_by,requested_at)
    VALUES(?,?,?,?,?,?,?)`, id.verification, id.application, id.version, 'TEST_SOURCE', 'PENDING', id.user, now);

  execute('INSERT INTO rule_sets(id,name,status,created_by,created_at) VALUES(?,?,?,?,?)', id.ruleSet, 'Evaluation Rules', 'PUBLISHED', id.user, now);
  execute('INSERT INTO rule_versions(id,rule_set_id,version_number,status,published_by,published_at) VALUES(?,?,?,?,?,?)', id.ruleVersion, id.ruleSet, 1, 'PUBLISHED', id.user, now);
  execute('INSERT INTO regulatory_rules(id,rule_version_id,rule_key,title,condition_json) VALUES(?,?,?,?,?)', id.rule, id.ruleVersion, 'EVAL-RULE', 'Evaluation rule', JSON.stringify({ eligibilityCategory: 'LEGAL_EXISTENCE', mandatory: true }));
  execute('INSERT INTO regulatory_rules(id,rule_version_id,rule_key,title) VALUES(?,?,?,?)', id.missingRule, id.ruleVersion, 'REQUIRED_TRANSCRIPT', 'Required transcript');
  execute('INSERT INTO regulatory_rules(id,rule_version_id,rule_key,title) VALUES(?,?,?,?)', id.passRule, id.ruleVersion, 'EVAL-PASS', 'Passing evaluation');
  const currentDocumentManifest = JSON.stringify([{ documentId: id.document, versionId: id.version, version: 1, sha256: 'test-hash', corrections: [] }]);
  execute('INSERT INTO rule_executions(id,application_id,rule_version_id,status,started_at,finished_at,document_manifest) VALUES(?,?,?,?,?,?,?)', id.oldExecution, id.application, id.ruleVersion, 'COMPLETED', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:01.000Z', currentDocumentManifest);
  execute('INSERT INTO rule_executions(id,application_id,rule_version_id,status,started_at,finished_at,document_manifest) VALUES(?,?,?,?,?,?,?)', id.currentExecution, id.application, id.ruleVersion, 'COMPLETED', '2025-02-01T00:00:00.000Z', '2025-02-01T00:00:01.000Z', currentDocumentManifest);
  execute('INSERT INTO compliance_results(id,execution_id,rule_id,status,reason) VALUES(?,?,?,?,?)', id.oldResult, id.oldExecution, id.rule, 'PASS', 'Old evaluation');
  execute('INSERT INTO compliance_results(id,execution_id,rule_id,status,reason) VALUES(?,?,?,?,?)', id.currentResult, id.currentExecution, id.rule, 'FAIL', 'Current evaluation');
  execute(`INSERT INTO compliance_results(id,execution_id,rule_id,status,actual_value,expected_condition,reason)
    VALUES(?,?,?,?,?,?,?)`, 'eval-missing-document-result', id.currentExecution, id.missingRule, 'FAIL', 'MISSING', 'Required', 'No transcript is stored.');
  execute('INSERT INTO compliance_results(id,execution_id,rule_id,status,reason) VALUES(?,?,?,?,?)', 'eval-current-pass-result', id.currentExecution, id.passRule, 'PASS', 'Current pass');

  execute(`INSERT INTO faculty_records(id,institution_id,display_name,department,qualification,employment_status,record_origin,created_at)
    VALUES(?,?,?,?,?,?,?,?)`, 'eval-faculty', id.institution, 'Evaluation Professor', 'Engineering', 'PhD', 'ACTIVE', 'WORKSPACE', now);
  execute(`INSERT INTO infrastructure_evidence(id,institution_id,application_id,category,institution_claim,review_status,created_at)
    VALUES(?,?,?,?,?,?,?)`, 'eval-infrastructure', id.institution, id.application, 'Laboratory', 'Stored laboratory claim', 'PENDING', now);
  execute(`INSERT INTO audit_events(id,actor_id,actor_role,action,entity_type,entity_id,reference,created_at)
    VALUES(?,?,?,?,?,?,?,?)`, 'eval-audit', id.user, 'SYSTEM_ADMIN', 'APPLICATION_REVIEWED', 'APPLICATION', id.application, 'Evaluation audit event', now);

  context = { user: { id: id.user, roles: ['SYSTEM_ADMIN'], institution_id: null, permissions: [
    'application.read', 'institution.read', 'document.read', 'verification.review', 'rule.read', 'finding.read', 'audit.read',
  ] } };
});

after(async () => {
  db?.close();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

test('state and pending filters execute against stored source verification rows', () => {
  const result = retrieveForSahayak({ context, message: 'Show pending source verifications in Maharashtra' });
  assert.equal(result.intent, 'verification');
  assert.equal(result.data.matchingVerifications.count, 1);
  assert.equal(result.data.matchingVerifications.records[0].institution_name, 'Maharashtra Evaluation Institute');
  assert.match(sahayakFallbackAnswer(result), /1 stored record/);
});

test('institution-scoped account cannot see another institution’s pending checks', () => {
  const restrictedContext = { user: { ...context.user, roles: ['INSTITUTION_USER'], institution_id: 'other-institution', permissions: ['application.read'] } };
  const result = retrieveForSahayak({ context: restrictedContext, message: 'Show pending source verifications in Maharashtra' });
  assert.equal(result.reason, 'NO_ASSOCIATED_RECORD');
  assert.doesNotMatch(result.deterministicAnswer, /Maharashtra Evaluation Institute/);
  assert.equal(result.sources.length, 0);
});

test('global failed-rule search returns latest result only', () => {
  const result = retrieveForSahayak({ context, message: 'Find failed compliance rules' });
  assert.equal(result.intent, 'compliance');
  assert.equal(result.data.matchingRuleEvaluations.count, 2);
  assert.ok(result.data.matchingRuleEvaluations.records.every((record) => record.status === 'FAIL'));
  assert.ok(result.data.matchingRuleEvaluations.records.every((record) => record.reason !== 'Old evaluation'));
});

test('case-level passed-rule filter is applied before returning results', () => {
  const result = retrieveForSahayak({ context, message: 'Show passed compliance rules', page: { page: 'application', applicationId: id.application } });
  assert.ok(result.data, JSON.stringify(result));
  assert.equal(result.data.sections.compliance.count, 1);
  assert.equal(result.data.sections.compliance.records[0].status, 'PASS');
  assert.equal(result.data.sections.compliance.records[0].reason, 'Current pass');
});

test('Sahayak explains stored internal eligibility from the selected application', () => {
  const result = retrieveForSahayak({ context, message: 'What is the eligibility percentage and why?', page: { page: 'application', applicationId: id.application } });
  assert.equal(result.intent, 'eligibility');
  const evaluation = result.data.sections.eligibility.records[0];
  assert.equal(evaluation.status, 'NOT_ELIGIBLE_FOR_APPROVAL_REVIEW');
  assert.equal(evaluation.criteriaSatisfiedPercent, 0);
  assert.equal(evaluation.verificationCoveragePercent, 100);
  assert.equal(evaluation.mandatoryFailures, 1);
  const answer = sahayakFallbackAnswer(result, 'What is the eligibility percentage and why?');
  assert.match(answer, /criteria satisfied 0%/);
  assert.match(answer, /mandatory failure/);
  assert.match(answer, /not an official approval/i);
  assert.equal(evaluation.risk.status, 'ASSESSED');
  assert.equal(evaluation.risk.score, 30);
  assert.equal(evaluation.risk.category, 'MODERATE');
  assert.equal(evaluation.risk.unverifiedSourceChecks, 1);
  assert.match(answer, /internal evidence-review indicator/i);
});

test('institution account receives a scoped eligibility summary without rule-level details', () => {
  const institutionContext = { user: { ...context.user, roles: ['INSTITUTION_USER'], institution_id: id.institution, permissions: ['application.read', 'institution.read'] } };
  const result = retrieveForSahayak({ context: institutionContext, message: 'What is my eligibility percentage?', page: { page: 'application', applicationId: id.application } });
  const evaluation = result.data.sections.eligibility.records[0];
  assert.equal(evaluation.applicationId, id.application);
  assert.equal(evaluation.status, 'NOT_ELIGIBLE_FOR_APPROVAL_REVIEW');
  assert.equal(evaluation.criteria[0].ruleResults, undefined);
  assert.equal(evaluation.risk.score, 30);
  assert.equal(evaluation.risk.factors, undefined);
  const answer = sahayakFallbackAnswer(result);
  assert.match(answer, /criteria satisfied 0%/);
  assert.doesNotMatch(answer, /Current evaluation|Evaluation rule/);
});

test('multi-topic request on an application page retrieves both institution facets', () => {
  const result = retrieveForSahayak({ context, message: 'Show faculty and infrastructure', page: { page: 'application', applicationId: id.application } });
  assert.ok(result.data.sections.faculty);
  assert.ok(result.data.sections.infrastructure);
  assert.equal(result.data.sections.faculty.count, 1);
  assert.equal(result.data.sections.infrastructure.count, 1);
});

test('faculty student-ratio question on a case includes faculty and stored rule evidence', () => {
  const result = retrieveForSahayak({ context, message: 'What is the faculty student ratio?', page: { page: 'application', applicationId: id.application } });
  assert.equal(result.data.sections.faculty.count, 1);
  assert.equal(result.data.sections.compliance.count, 3);
  assert.ok(result.data.sections.compliance.records.some((record) => record.rule_title === 'Evaluation rule'));
});

test('Hindi missing-document question reports a stored missing-document rule check', () => {
  const result = retrieveForSahayak({ context, message: 'कौन से दस्तावेज़ गायब हैं?', page: { page: 'application', applicationId: id.application } });
  assert.equal(result.intent, 'documents');
  assert.equal(result.data.sections.missingDocumentRequirements.count, 1);
  assert.equal(result.data.sections.missingDocumentRequirements.records[0].rule_title, 'Required transcript');
  assert.match(sahayakFallbackAnswer(result, 'कौन से दस्तावेज़ गायब हैं?'), /दस्तावेज़/);
});

test('next-step request uses the selected application record', () => {
  const result = retrieveForSahayak({ context, message: 'What should I do next?', page: { page: 'application', applicationId: id.application } });
  assert.equal(result.intent, 'next_steps');
  assert.equal(result.data.application.id, id.application);
  assert.ok(result.data.sections.findings);
  assert.ok(result.data.sections.compliance);
});

test('what-changed request retrieves scoped audit events', () => {
  const result = retrieveForSahayak({ context, message: 'What changed?', page: { page: 'application', applicationId: id.application } });
  assert.equal(result.intent, 'audit');
  assert.equal(result.data.sections.audit.count, 2);
  assert.ok(result.data.sections.audit.records.some((record) => record.reference === 'Evaluation audit event'));
});

test('explain-this-page is answered from actual page context', () => {
  const result = retrieveForSahayak({ context, message: 'Explain this page', page: { page: 'dashboard' } });
  assert.equal(result.intent, 'page_explanation');
  assert.match(result.deterministicAnswer, /Command Center/);
});
