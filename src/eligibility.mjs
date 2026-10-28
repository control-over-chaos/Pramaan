import { createHash, randomUUID } from 'node:crypto';
import { allRows, db, execute, oneRow } from './db.mjs';
import { writeAudit } from './audit.mjs';
import { currentCompliance, currentDocuments, crossComparisons, documentManifest, fieldReliable, fieldsForVersion } from './evidence.mjs';

export const ELIGIBILITY_FRAMEWORK_VERSION = 'PRAMAAN_INTERNAL_SCREENING_V1';
export const RISK_MODEL_VERSION = 'PRAMAAN_INTERNAL_EVIDENCE_RISK_V1';
const RISK_SEVERITY_POINTS = Object.freeze({ CRITICAL: 40, HIGH: 25, MEDIUM: 15, LOW: 5 });

function calculateEvidenceRisk(applicationId, publishedRules, results) {
  const resultById = new Map(results.map((result) => [result.rule_id, result]));
  const configured = publishedRules.map((rule) => {
    const stored = resultById.get(rule.rule_id);
    return { ...rule, status: stored ? normalizeRuleResult(stored) : 'PENDING', reason: stored?.reason || '',
      evidenceReference: stored?.evidence_reference || '', actualValue: stored?.actual_value || '',
      recommendedAction: stored?.recommended_action || rule.recommended_action || '' };
  });
  const applicable = configured.filter((rule) => rule.status !== 'NOT_APPLICABLE');
  const inconclusive = applicable.filter((rule) => !['PASS', 'FAIL'].includes(rule.status));
  const failed = applicable.filter((rule) => rule.status === 'FAIL');
  const current = currentDocuments(applicationId);
  const fields = current.flatMap((version) => fieldsForVersion(version.id));
  const threshold = Number(process.env.EXTRACTION_CONFIDENCE_THRESHOLD || 0.85);
  const lowConfidenceFieldCount = fields.filter((field) => !field.correction_id && field.confidence !== null && field.confidence !== undefined
    && Number.isFinite(Number(field.confidence)) && (Number(field.confidence) < threshold || Number(field.confidence) > 1)).length;
  const unknownConfidenceFieldCount = fields.filter((field) => !field.correction_id && field.extraction_method !== 'PDF_TEXT'
    && (field.confidence === null || field.confidence === undefined)).length;
  const versionIds = current.map((version) => version.id);
  const unverifiedSourceChecks = versionIds.length
    ? Number(oneRow(`SELECT COUNT(*) AS count FROM verifications WHERE document_version_id IN (${versionIds.map(() => '?').join(',')})
      AND result NOT IN ('VERIFIED','MISMATCH_DETECTED','EXPIRED')`, ...versionIds)?.count || 0)
    : 0;
  const factors = failed.map((rule) => {
    const actual = String(rule.actualValue || '').toUpperCase();
    const factor = actual.includes('EXPIRED') ? 'EXPIRED_RULE_CHECK'
      : actual.includes('MISSING') ? 'MISSING_EVIDENCE'
      : actual.includes('MISMATCH') ? 'INFORMATION_MISMATCH'
      : 'FAILED_RULE_CHECK';
    return {
      factor, ruleKey: rule.rule_key, title: rule.title, severity: rule.severity || 'MEDIUM',
      points: RISK_SEVERITY_POINTS[String(rule.severity || 'MEDIUM').toUpperCase()] || RISK_SEVERITY_POINTS.MEDIUM,
      status: rule.status, reason: rule.reason, evidenceReference: rule.evidenceReference,
      recommendedAction: rule.recommendedAction,
    };
  });
  for (const contradiction of crossComparisons(applicationId).filter((item) => item.status === 'MISMATCH_DETECTED')) {
    factors.push({ factor: 'CROSS_DOCUMENT_CONTRADICTION', title: `${contradiction.field} values conflict across current documents`,
      severity: 'MEDIUM', points: RISK_SEVERITY_POINTS.MEDIUM, status: 'MISMATCH_DETECTED', reason: contradiction.reason,
      evidenceReference: `Current cross-document check: ${contradiction.field}`,
      recommendedAction: 'Review the current source documents and confirm the correct information.' });
  }
  const processingInFlight = Boolean(oneRow("SELECT id FROM processing_jobs WHERE application_id=? AND status IN ('QUEUED','RUNNING') LIMIT 1", applicationId));
  const hasObservableChecks = configured.length > 0 || factors.some((item) => item.factor === 'CROSS_DOCUMENT_CONTRADICTION');
  let score = null;
  let category = 'NOT_CONFIGURED';
  let status = 'NOT_CONFIGURED';
  if (configured.length && applicable.length === 0 && factors.length === 0) {
    category = 'NOT_APPLICABLE';
    status = 'NOT_APPLICABLE';
  } else if (hasObservableChecks) {
    if (inconclusive.length || processingInFlight) {
      category = 'ASSESSMENT_INCOMPLETE';
      status = 'ASSESSMENT_INCOMPLETE';
    } else {
      score = Math.min(100, factors.reduce((sum, item) => sum + item.points, 0));
      category = score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MODERATE' : 'LOW';
      status = 'ASSESSED';
    }
  }
  return {
    modelVersion: RISK_MODEL_VERSION, status, score, category,
    failedCheckCount: failed.length + factors.filter((item) => item.factor === 'CROSS_DOCUMENT_CONTRADICTION').length,
    unverifiedCheckCount: inconclusive.length + unverifiedSourceChecks + (processingInFlight ? 1 : 0),
    unverifiedSourceChecks,
    uncertainty: { lowConfidenceFieldCount, unknownConfidenceFieldCount },
    severityPoints: RISK_SEVERITY_POINTS,
    bandThresholds: { LOW: '0–24', MODERATE: '25–49', HIGH: '50–74', CRITICAL: '75–100' },
    factors,
    notice: 'Internal evidence-review indicator only. Severity points summarize published rule failures and clear cross-document contradictions; unverified checks and OCR uncertainty are reported separately and do not increase the score. This score does not establish fraud, legal risk, eligibility, or an official decision.',
  };
}

function readPayload(row) {
  try { return JSON.parse(row?.payload_json || '{}'); } catch { return {}; }
}

function activePublishedRules(application) {
  const today = new Date().toISOString().slice(0, 10);
  const all = allRows(`SELECT rs.id AS rule_set_id, rs.name AS rule_set, rv.id AS rule_version_id,
      rv.version_number, rr.id AS rule_id, rr.rule_key, rr.title, rr.condition_json, rr.severity, rr.recommended_action
    FROM rule_sets rs JOIN rule_versions rv ON rv.rule_set_id=rs.id
    JOIN regulatory_rules rr ON rr.rule_version_id=rv.id
    WHERE rv.status='PUBLISHED' AND rs.retired_at IS NULL
      AND (rs.application_category_id IS NULL OR rs.application_category_id=?)
      AND (rv.effective_from IS NULL OR rv.effective_from<=?)
      AND (rv.effective_until IS NULL OR rv.effective_until>=?)
    ORDER BY rs.id, rv.version_number DESC, rr.rule_key`, application.category_id, today, today);
  const latestVersion = new Map();
  for (const rule of all) if (!latestVersion.has(rule.rule_set_id)) latestVersion.set(rule.rule_set_id, rule.rule_version_id);
  return all.filter((rule) => latestVersion.get(rule.rule_set_id) === rule.rule_version_id);
}

function normalizeRuleResult(result) {
  const status = String(result?.status || '').toUpperCase();
  if (status === 'PASS') return 'PASS';
  if (status === 'FAIL') return 'FAIL';
  if (status === 'NOT_APPLICABLE') return 'NOT_APPLICABLE';
  if (status === 'REVIEW_REQUIRED') return 'MANUAL_REVIEW_REQUIRED';
  return 'PENDING';
}

function assessmentStatus(criteria, applicableWeight, mandatoryFailures, inFlight) {
  if (!applicableWeight) return inFlight ? 'VERIFICATION_PENDING' : 'NOT_EVALUATED';
  if (mandatoryFailures > 0) return 'NOT_ELIGIBLE_FOR_APPROVAL_REVIEW';
  if (inFlight || criteria.some((item) => item.ruleResults.some((rule) => rule.status === 'PENDING'))) return 'VERIFICATION_PENDING';
  if (criteria.some((item) => item.status === 'MANUAL_REVIEW_REQUIRED')) return 'MANUAL_REVIEW_REQUIRED';
  if (criteria.some((item) => item.status === 'FAIL')) return 'ACTION_REQUIRED';
  if (criteria.filter((item) => item.applicability === 'APPLICABLE').every((item) => item.status === 'PASS')) return 'ELIGIBLE_FOR_APPROVAL_REVIEW';
  return 'NOT_EVALUATED';
}

export function calculateEligibility(applicationId) {
  const application = oneRow('SELECT id, category_id FROM applications WHERE id=?', applicationId);
  if (!application) throw Object.assign(new Error('Application not found.'), { status: 404 });
  const categories = allRows('SELECT * FROM eligibility_categories ORDER BY display_order');
  const publishedRules = activePublishedRules(application);
  const results = currentCompliance(applicationId);
  const resultByRuleId = new Map(results.map((item) => [item.rule_id, item]));
  const criteria = categories.map((category) => {
    const rules = publishedRules.filter((rule) => {
      let condition = {};
      try { condition = JSON.parse(rule.condition_json || '{}'); } catch { /* invalid stored configuration is left unevaluated */ }
      return condition.eligibilityCategory === category.category_key;
    });
    if (!rules.length) return {
      categoryKey: category.category_key, label: category.label, weight: category.weight,
      status: 'NOT_CONFIGURED', applicability: 'UNKNOWN', mandatoryFailure: false, ruleResults: [],
    };
    const ruleResults = rules.map((rule) => {
      let condition = {};
      try { condition = JSON.parse(rule.condition_json || '{}'); } catch { /* invalid rule configuration cannot pass */ }
      const stored = resultByRuleId.get(rule.rule_id);
      return {
        ruleId: rule.rule_id, ruleKey: rule.rule_key, ruleSet: rule.rule_set,
        ruleVersionId: rule.rule_version_id, ruleVersion: rule.version_number,
        title: rule.title, status: stored ? normalizeRuleResult(stored) : 'PENDING',
        severity: rule.severity || 'MEDIUM',
        mandatory: condition.mandatory === true,
        reason: stored?.reason || (stored ? 'The stored rule result is not conclusive.' : 'This published rule has not been evaluated against current evidence.'),
        recommendedAction: stored?.recommended_action || rule.recommended_action || '',
        evidenceReference: stored?.evidence_reference || '', resultId: stored?.id || null,
      };
    });
    const applicableResults = ruleResults.filter((item) => item.status !== 'NOT_APPLICABLE');
    const applicability = applicableResults.length ? 'APPLICABLE' : 'NOT_APPLICABLE';
    let status = 'NOT_APPLICABLE';
    if (applicableResults.length) {
      if (applicableResults.some((item) => item.status === 'FAIL')) status = 'FAIL';
      else if (applicableResults.every((item) => item.status === 'PASS')) status = 'PASS';
      else if (applicableResults.some((item) => item.status === 'MANUAL_REVIEW_REQUIRED')) status = 'MANUAL_REVIEW_REQUIRED';
      else status = 'PENDING';
    }
    const mandatoryFailure = ruleResults.some((item) => item.mandatory && item.status === 'FAIL');
    return { categoryKey: category.category_key, label: category.label, weight: category.weight, status, applicability, mandatoryFailure, ruleResults };
  });
  const applicable = criteria.filter((item) => item.applicability === 'APPLICABLE');
  const applicableWeight = applicable.reduce((sum, item) => sum + item.weight, 0);
  const passedWeight = applicable.filter((item) => item.status === 'PASS').reduce((sum, item) => sum + item.weight, 0);
  const conclusivelyEvaluatedWeight = applicable.filter((item) => ['PASS', 'FAIL'].includes(item.status)
    && item.ruleResults.filter((rule) => rule.status !== 'NOT_APPLICABLE').every((rule) => ['PASS', 'FAIL'].includes(rule.status)))
    .reduce((sum, item) => sum + item.weight, 0);
  const mandatoryFailures = criteria.flatMap((item) => item.ruleResults.filter((rule) => rule.mandatory && rule.status === 'FAIL'));
  const inFlight = Boolean(oneRow("SELECT id FROM processing_jobs WHERE application_id=? AND status IN ('QUEUED','RUNNING') LIMIT 1", applicationId));
  const risk = calculateEvidenceRisk(applicationId, publishedRules, results);
  const evaluation = {
    schemaVersion: 1, frameworkVersion: ELIGIBILITY_FRAMEWORK_VERSION,
    assessmentId: null, applicationId, calculatedAt: new Date().toISOString(),
    criteriaSatisfiedPercent: applicableWeight ? Math.round((100 * passedWeight / applicableWeight) * 100) / 100 : null,
    verificationCoveragePercent: applicableWeight ? Math.round((100 * conclusivelyEvaluatedWeight / applicableWeight) * 100) / 100 : null,
    applicableWeight, passedWeight, conclusivelyEvaluatedWeight,
    mandatoryFailures: mandatoryFailures.length,
    mandatoryFailureRules: mandatoryFailures.map(({ ruleKey, title, reason, recommendedAction }) => ({ ruleKey, title, reason, recommendedAction })),
    status: assessmentStatus(criteria, applicableWeight, mandatoryFailures.length, inFlight),
    inFlight, criteria, risk,
    notice: 'Internal PRAMAAN decision support only. Percentages reflect explicitly linked, published rules and current stored evidence; they are not official approval or a regulatory eligibility determination.',
  };
  const sourceDigest = createHash('sha256').update(JSON.stringify({
    frameworkVersion: ELIGIBILITY_FRAMEWORK_VERSION,
    applicationId, categoryId: application.category_id,
    manifest: documentManifest(applicationId),
    rules: publishedRules.map(({ rule_id, rule_version_id, condition_json }) => ({ rule_id, rule_version_id, condition_json })),
    results: results.map(({ id, rule_id, status, reason, evidence_reference }) => ({ id, rule_id, status, reason, evidence_reference })),
    risk,
    jobs: inFlight,
  })).digest('hex');
  return { ...evaluation, sourceDigest };
}

export function recordEligibilityAssessment(applicationId, context = {}) {
  const calculated = calculateEligibility(applicationId);
  const existing = oneRow('SELECT id,payload_json FROM eligibility_assessments WHERE application_id=? AND source_digest=?', applicationId, calculated.sourceDigest);
  if (existing) return readPayload(existing);
  const id = randomUUID();
  const now = calculated.calculatedAt;
  const persisted = { ...calculated, assessmentId: id, calculatedAt: now };
  db.exec('BEGIN IMMEDIATE');
  try {
    const raced = oneRow('SELECT id,payload_json FROM eligibility_assessments WHERE application_id=? AND source_digest=?', applicationId, calculated.sourceDigest);
    if (raced) { db.exec('ROLLBACK'); return readPayload(raced); }
    execute(`INSERT INTO eligibility_assessments(id,application_id,source_digest,framework_version,calculated_at,
      criteria_satisfied_percent,verification_coverage_percent,applicable_weight,passed_weight,
      conclusively_evaluated_weight,mandatory_failures,status,payload_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, applicationId, calculated.sourceDigest, ELIGIBILITY_FRAMEWORK_VERSION,
      now, calculated.criteriaSatisfiedPercent, calculated.verificationCoveragePercent, calculated.applicableWeight,
      calculated.passedWeight, calculated.conclusivelyEvaluatedWeight, calculated.mandatoryFailures, calculated.status, JSON.stringify(persisted));
    for (const criterion of calculated.criteria) execute(`INSERT INTO eligibility_assessment_criteria(
      assessment_id,category_key,category_label,weight,status,applicability,mandatory_failure,evidence_json)
      VALUES(?,?,?,?,?,?,?,?)`, id, criterion.categoryKey, criterion.label, criterion.weight, criterion.status,
      criterion.applicability, criterion.mandatoryFailure ? 1 : 0, JSON.stringify(criterion.ruleResults));
    writeAudit(context, 'ELIGIBILITY_ASSESSED', 'APPLICATION', applicationId, '', {
      assessmentId: id, frameworkVersion: ELIGIBILITY_FRAMEWORK_VERSION, status: calculated.status,
      criteriaSatisfiedPercent: calculated.criteriaSatisfiedPercent,
      verificationCoveragePercent: calculated.verificationCoveragePercent,
      mandatoryFailures: calculated.mandatoryFailures,
    }, calculated.sourceDigest);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    const raced = oneRow('SELECT id,payload_json FROM eligibility_assessments WHERE application_id=? AND source_digest=?', applicationId, calculated.sourceDigest);
    if (raced) return readPayload(raced);
    throw error;
  }
  return persisted;
}

export function latestEligibilityAssessment(applicationId) {
  return readPayload(oneRow('SELECT payload_json FROM eligibility_assessments WHERE application_id=? ORDER BY calculated_at DESC,rowid DESC LIMIT 1', applicationId));
}

export function eligibilitySummaryForRole(evaluation, showDetails) {
  if (!evaluation || showDetails) return evaluation;
  return {
    schemaVersion: evaluation.schemaVersion, frameworkVersion: evaluation.frameworkVersion,
    assessmentId: evaluation.assessmentId, applicationId: evaluation.applicationId,
    calculatedAt: evaluation.calculatedAt,
    criteriaSatisfiedPercent: evaluation.criteriaSatisfiedPercent,
    verificationCoveragePercent: evaluation.verificationCoveragePercent,
    applicableWeight: evaluation.applicableWeight, passedWeight: evaluation.passedWeight,
    conclusivelyEvaluatedWeight: evaluation.conclusivelyEvaluatedWeight,
    mandatoryFailures: evaluation.mandatoryFailures, status: evaluation.status, inFlight: evaluation.inFlight,
    risk: evaluation.risk ? { modelVersion: evaluation.risk.modelVersion, status: evaluation.risk.status,
      score: evaluation.risk.score, category: evaluation.risk.category, failedCheckCount: evaluation.risk.failedCheckCount,
      unverifiedCheckCount: evaluation.risk.unverifiedCheckCount, unverifiedSourceChecks: evaluation.risk.unverifiedSourceChecks,
      uncertainty: evaluation.risk.uncertainty, notice: evaluation.risk.notice,
      severityPoints: evaluation.risk.severityPoints, bandThresholds: evaluation.risk.bandThresholds,
      ...(showDetails ? { factors: evaluation.risk.factors } : {}) } : null,
    criteria: (evaluation.criteria || []).map(({ categoryKey, label, weight, status, applicability, mandatoryFailure }) => ({
      categoryKey, label, weight, status, applicability, mandatoryFailure,
    })),
    notice: evaluation.notice,
  };
}
