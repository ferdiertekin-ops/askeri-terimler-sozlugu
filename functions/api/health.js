import { json, requestId } from '../_lib/http.js';

export async function onRequestGet(context) {
  const id = requestId(context.request);
  const checks = {
    runtime: true,
    databaseBinding: Boolean(context.env.DB),
    sessionSecret: typeof context.env.SESSION_SECRET === 'string' && context.env.SESSION_SECRET.length >= 32,
    editorPasswordHash: /^[0-9a-f]{64}$/i.test(String(context.env.EDITOR_PASSWORD_HASH || ''))
  };

  if (checks.databaseBinding) {
    try {
      await context.env.DB.prepare('SELECT 1 AS ok').first();
      checks.databaseQuery = true;
    } catch (error) {
      checks.databaseQuery = false;
    }
  } else {
    checks.databaseQuery = false;
  }

  const ok = Object.values(checks).every(Boolean);
  return json({
    ok,
    service: 'Askerî Terimler Sözlüğü API',
    environment: context.env.CF_PAGES_BRANCH || 'unknown',
    checks,
    requestId: id,
    timestamp: new Date().toISOString()
  }, { status: ok ? 200 : 503 });
}
