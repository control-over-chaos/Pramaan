import test from 'node:test';
import assert from 'node:assert/strict';
import { getGeminiAssistantConfig } from './assistant-config.mjs';

const valid = {
  AI_ASSISTANT_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/',
  AI_ASSISTANT_API_KEY: 'test-only-key',
  AI_ASSISTANT_MODEL: 'gemini-test-model',
};

test('Gemini configuration accepts only the HTTPS Google Generative Language API', () => {
  const result = getGeminiAssistantConfig(valid);
  assert.equal(result.configured, true);
  assert.equal(result.baseUrl, 'https://generativelanguage.googleapis.com/v1beta');
  assert.equal(result.model, 'gemini-test-model');
  assert.equal(result.apiKey, 'test-only-key');
});

test('Gemini configuration rejects untrusted hosts, non-HTTPS, and endpoint overrides', () => {
  for (const baseUrl of [
    'http://generativelanguage.googleapis.com/v1beta',
    'https://generativelanguage.googleapis.com.attacker.example/v1beta',
    'https://user:pass@generativelanguage.googleapis.com/v1beta',
    'https://generativelanguage.googleapis.com/v1beta?forward=1',
    'https://generativelanguage.googleapis.com/v1beta/chat/completions',
    'https://generativelanguage.googleapis.com/v1beta.evil',
  ]) {
    assert.equal(getGeminiAssistantConfig({ ...valid, AI_ASSISTANT_BASE_URL: baseUrl }).configured, false, baseUrl);
  }
});

test('Gemini configuration rejects malformed model names and missing credentials', () => {
  assert.equal(getGeminiAssistantConfig({ ...valid, AI_ASSISTANT_MODEL: 'gemini/model' }).configured, false);
  assert.equal(getGeminiAssistantConfig({ ...valid, AI_ASSISTANT_API_KEY: '' }).configured, false);
});
