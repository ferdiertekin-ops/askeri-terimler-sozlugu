const { createSession, verifyPassword, sameOrigin, sessionCookie, securityHeaders } = require('./_auth-session');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: securityHeaders(), body: JSON.stringify({ ok: false, error: 'method_not_allowed' }) };
  if (!sameOrigin(event)) return { statusCode: 403, headers: securityHeaders(), body: JSON.stringify({ ok: false, error: 'origin_rejected' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return { statusCode: 400, headers: securityHeaders(), body: JSON.stringify({ ok: false, error: 'invalid_json' }) }; }

  if (!verifyPassword(body.password)) return { statusCode: 401, headers: securityHeaders(), body: JSON.stringify({ ok: false, error: 'unauthorized' }) };

  const { token, payload } = createSession();
  return {
    statusCode: 200,
    headers: securityHeaders({ 'Set-Cookie': sessionCookie(token) }),
    body: JSON.stringify({ ok: true, csrfToken: payload.csrf, expiresAt: payload.exp })
  };
};

exports.config = { path: '/api/editor/login', rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
