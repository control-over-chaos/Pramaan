const GEMINI_HOST = 'generativelanguage.googleapis.com';

export function getGeminiAssistantConfig(env = process.env) {
  const model = String(env.AI_ASSISTANT_MODEL || '').trim();
  const apiKey = String(env.AI_ASSISTANT_API_KEY || '').trim();
  let baseUrl = '';
  let endpointValid = false;

  try {
    const parsed = new URL(String(env.AI_ASSISTANT_BASE_URL || '').trim());
    const versionPath = parsed.pathname.replace(/\/+$/, '');
    endpointValid = parsed.protocol === 'https:'
      && parsed.hostname.toLowerCase() === GEMINI_HOST
      && !parsed.port
      && !parsed.username
      && !parsed.password
      && !parsed.search
      && !parsed.hash
      && ['/v1', '/v1beta'].includes(versionPath);
    if (endpointValid) baseUrl = `${parsed.origin}${versionPath}`;
  } catch { /* an invalid optional provider URL leaves the assistant local-only */ }

  const modelValid = /^[A-Za-z0-9._-]{1,120}$/.test(model);
  const configured = Boolean(endpointValid && modelValid && apiKey);
  return {
    configured,
    baseUrl: configured ? baseUrl : '',
    apiKey: configured ? apiKey : '',
    model: configured ? model : 'Local record summary',
  };
}
