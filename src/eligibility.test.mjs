import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let root, db, execute, allRows, calculateEligibility, recordEligibilityAssessment;
const now = new Date().toISOString();
const ids = { user: 'eligibility-user', institution: 'eligibility-institution', application: 'eligibility-application', ruleset: 'eligibility-ruleset', version: 'eligibility-version', execution: 'eligibility-execution' };

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'pramaan-eligibility-'));
  process.env.DATA_DIR = root;
  process.env.NODE_ENV = 'test';
  ({ db, execute, allRows } = await import('./db.mjs'));
  ({ calculateEligibility, recordEligibilityAssessment } = await import('./eligibility.mjs'));
  execute('INSERT INTO users(id,email,display_name,password_hash,created_at) VALUES(?,?,?,?,?)', ids.user, 'eligibility@example.test', 'Eligibility test', 'unused', now);
  execute('INSERT INTO institutions(id,aicte_id,name,created_at,updated_at) VALUES(?,?,?,?,?)', ids.institution, 'ELIGIBILITY-TEST', 'Eligibility Test Institute', now, now);
  execute('INSERT INTO applications(id,institution_id,category_id,academic_year,created_at,updated_at) VALUES(?,?,?,?,?,?)', ids.application, ids.institution, 'NEW_INSTITUTION', '2026-27', now, now);
  execute('INSERT INTO rule_sets(id,name,application_category_id,status,created_by,created_at) VALUES(?,?,?,?,?,?)', ids.ruleset, 'Internal eligibility test rules', 'NEW_INSTITUTION', 'PUBLISHED', ids.user, now);
  execute('INSERT INTO rule_versions(id,rule_set_id,version_number,status,published_by,published_at) VALUES(?,?,?,?,?,?)', ids.version, ids.ruleset, 1, 'PUBLISHED', ids.user, now);
  execute('INSERT INTO rule_executions(id,application_id,rule_version_id,status,started_at,finished_at,assessment_date,document_manifest) VALUES(?,?,?,?,?,?,?,?)', ids.execution, ids.application, ids.version, 'COMPLETED', now, now, '2026-10-26', '[]');
});

after(async () => { db?.close(); await rm(root, { recursive: true, force: true }); });

function addRule(key, title, category, mandatory, status) {
  const ruleId = `eligibility-rule-${key}`;
  execute('INSERT INTO regulatory_rules(id,rule_version_id,rule_key,title,condition_json,recommended_action) VALUES(?,?,?,?,?,?)', ruleId, ids.version, key, title, JSON.stringify({ type: 'MANUAL_REVIEW', eligibilityCategory: category, mandatory }), `Review ${title}.`);
  if (status) execute('INSERT INTO compliance_results(id,execution_id,rule_id,status,reason,recommended_action) VALUES(?,?,?,?,?,?)', `eligibility-result-${key}`, ids.execution, ruleId, status, `${key} stored result.`, `Review ${title}.`);
}

test('ten internal weights are seeded without activating regulatory rules', () => {
  const categories = allRows('SELECT category_key,weight FROM eligibility_categories ORDER BY display_order');
  assert.equal(categories.length, 10);
  assert.equal(categories.reduce((sum, category) => sum + category.weight, 0), 100);
  const result = calculateEligibility(ids.application);
  assert.equal(result.status, 'NOT_EVALUATED');
  assert.equal(result.criteriaSatisfiedPercent, null);
  assert.equal(result.verificationCoveragePercent, null);
  assert.equal(result.risk.score, null);
  assert.equal(result.risk.category, 'NOT_CONFIGURED');
  assert.ok(result.criteria.every((criterion) => criterion.status === 'NOT_CONFIGURED'));
});

test('eligibility percentages use only explicitly mapped, applicable rule weights and mandatory failures block review readiness', () => {
  addRule('LEGAL-FAIL', 'Registration check', 'LEGAL_EXISTENCE', true, 'FAIL');
  addRule('IDENTITY-PASS', 'Identity check', 'ORGANIZATION_IDENTITY', false, 'PASS');
  addRule('ADDRESS-NA', 'Address check', 'REGISTERED_ADDRESS', false, 'NOT_APPLICABLE');
  const result = calculateEligibility(ids.application);
  assert.equal(result.applicableWeight, 25);
  assert.equal(result.passedWeight, 10);
  assert.equal(result.conclusivelyEvaluatedWeight, 25);
  assert.equal(result.criteriaSatisfiedPercent, 40);
  assert.equal(result.verificationCoveragePercent, 100);
  assert.equal(result.mandatoryFailures, 1);
  assert.equal(result.status, 'NOT_ELIGIBLE_FOR_APPROVAL_REVIEW');
  assert.equal(result.risk.score, 15);
  assert.equal(result.risk.category, 'LOW');
  assert.equal(result.risk.failedCheckCount, 1);
});

test('linked published rules without current evidence remain pending and do not count as passed or covered', () => {
  addRule('FINANCIAL-PENDING', 'Financial evidence check', 'FINANCIAL_OPERATIONAL', false, null);
  execute("UPDATE compliance_results SET status='PASS' WHERE id=?",'eligibility-result-LEGAL-FAIL');
  const result = calculateEligibility(ids.application);
  assert.equal(result.status, 'VERIFICATION_PENDING');
  const financial = result.criteria.find((criterion) => criterion.categoryKey === 'FINANCIAL_OPERATIONAL');
  assert.equal(financial.status, 'PENDING');
  assert.equal(financial.applicability, 'APPLICABLE');
  assert.equal(result.passedWeight, 25);
  assert.equal(result.conclusivelyEvaluatedWeight, 25);
  assert.equal(result.risk.score, null);
  assert.equal(result.risk.category, 'ASSESSMENT_INCOMPLETE');
  assert.equal(result.risk.unverifiedCheckCount, 1);
});

test('assessment snapshots are append-only and idempotent for unchanged evidence', () => {
  const first = recordEligibilityAssessment(ids.application, { actorRole: 'TEST' });
  const second = recordEligibilityAssessment(ids.application, { actorRole: 'TEST' });
  assert.equal(first.assessmentId, second.assessmentId);
  assert.equal(allRows('SELECT id FROM eligibility_assessments WHERE application_id=?', ids.application).length, 1);
  assert.equal(allRows("SELECT id FROM audit_events WHERE entity_type='APPLICATION' AND entity_id=? AND action='ELIGIBILITY_ASSESSED'", ids.application).length, 1);
  assert.throws(() => execute('UPDATE eligibility_assessments SET status=? WHERE id=?', 'APPROVED', first.assessmentId), /immutable snapshots/);
});
