import test from 'node:test';
import assert from 'node:assert/strict';
import { before, after } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let ConfiguredAssistantProvider;
let root;
let db;

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'pramaan-assistant-provider-'));
  process.env.DATA_DIR = root;
  process.env.NODE_ENV = 'test';
  ({ db } = await import('./db.mjs'));
  ({ ConfiguredAssistantProvider } = await import('./providers.mjs'));
});

after(async () => {
  db?.close();
  if (root) await rm(root, { recursive: true, force: true });
});

test('Gemini assistant uses server-side authentication, JSON responses, and the generateContent endpoint', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = '';
  let requestOptions;
  globalThis.fetch = async (url, options) => {
    requestUrl = String(url);
    requestOptions = options;
    return new Response(JSON.stringify({
      modelVersion: 'test-gemini-model',
      candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: 'The stored status is pending.', claims: [{ path: 'data.application.status', value: 'PENDING' }] }) }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const provider = new ConfiguredAssistantProvider('https://generativelanguage.googleapis.com/v1beta', 'test-only-api-key', 'test-model');
    const result = await provider.respond([
      { role: 'system', content: 'Answer only from the supplied record.' },
      { role: 'user', content: 'Why is the application waiting?' },
    ]);
    assert.equal(requestUrl, 'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent');
    assert.equal(requestOptions.headers['x-goog-api-key'], 'test-only-api-key');
    const body = JSON.parse(requestOptions.body);
    assert.equal(body.systemInstruction.parts[0].text, 'Answer only from the supplied record.');
    assert.equal(body.contents[0].role, 'user');
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal(result.answer.includes('test-only-api-key'), false);
    assert.equal(result.model, 'test-gemini-model');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Gemini provider errors do not expose upstream response bodies', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('sensitive upstream detail', { status: 401 });
  try {
    const provider = new ConfiguredAssistantProvider('https://example.test/v1beta', 'test-only-api-key', 'test-model');
    await assert.rejects(provider.respond([{ role: 'user', content: 'hello' }]), (error) => {
      assert.equal(error.code, 'AI_PROVIDER_UNAVAILABLE');
      assert.doesNotMatch(error.message, /sensitive upstream detail|test-only-api-key/);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
