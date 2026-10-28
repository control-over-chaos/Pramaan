import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretSahayakRequest, standardizeSahayakReason } from './sahayak-understanding.mjs';

test('find failed compliance rules is understood as a compliance filter', () => {
  const request = interpretSahayakRequest('Find failed compliance rules');
  assert.ok(request.topics.includes('compliance'));
  assert.deepEqual(request.filters.statuses, ['FAILED']);
  assert.ok(request.operations.includes('search'));
});

test('multi-topic faculty and infrastructure requests retain both topics', () => {
  const request = interpretSahayakRequest('Show faculty and infrastructure for this institution');
  assert.ok(request.topics.includes('faculty'));
  assert.ok(request.topics.includes('infrastructure'));
});

test('faculty student-ratio questions also request rule-evaluation evidence', () => {
  const request = interpretSahayakRequest('What is the faculty student ratio for this institution?');
  assert.ok(request.topics.includes('faculty'));
  assert.ok(request.topics.includes('compliance'));
});

test('Hindi missing-document questions stay on documents and preserve Hindi', () => {
  const request = interpretSahayakRequest('कौन से दस्तावेज़ गायब हैं?');
  assert.equal(request.language, 'hi');
  assert.ok(request.topics.includes('documents'));
  assert.ok(request.filters.statuses.includes('MISSING'));
  assert.ok(!request.topics.includes('institution'));
});

test('pending source verification in a named state yields both filters', () => {
  const request = interpretSahayakRequest('Show pending source verifications in Maharashtra');
  assert.ok(request.topics.includes('verification'));
  assert.deepEqual(request.filters.statuses, ['PENDING']);
  assert.equal(request.filters.state, 'Maharashtra');
});

test('academic-year and temporal filters are parsed explicitly', () => {
  const request = interpretSahayakRequest('Show current compliance results for 2025-26');
  assert.equal(request.filters.timeframe, 'current');
  assert.deepEqual(request.filters.academicYears, ['2025-26']);
});

test('workflow, page-explanation, and change-history operations are recognized', () => {
  assert.ok(interpretSahayakRequest('What should I do next?').operations.includes('next_steps'));
  assert.ok(interpretSahayakRequest('Explain this page').operations.includes('page_explanation'));
  assert.ok(interpretSahayakRequest('What changed in this application?').operations.includes('changes'));
});

test('failed status does not also become passed for “not passed”', () => {
  const request = interpretSahayakRequest('Show rules that did not pass');
  assert.ok(request.filters.statuses.includes('FAILED'));
  assert.ok(!request.filters.statuses.includes('PASS'));
});

test('legacy internal reasons map onto the stable Sahayak response contract', () => {
  assert.equal(standardizeSahayakReason('NOT_IN_DATASET'), 'NOT_FOUND');
  assert.equal(standardizeSahayakReason('UNSUPPORTED_REQUEST'), 'UNSUPPORTED_OPERATION');
  assert.equal(standardizeSahayakReason('ACCESS_RESTRICTED'), 'ACCESS_RESTRICTED');
  assert.equal(standardizeSahayakReason('unexpected'), 'SERVICE_UNAVAILABLE');
});
