const { verifySession, securityHeaders } = require('./_auth-session');

exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers: securityHeaders(), body: JSON.stringify({ ok: false, error: 'method_not_allowed' }) };
  const session = verifySession(event);
  if (!session) return { statusCode: 401, headers: securityHeaders(), body: JSON.stringify({ ok: false, authenticated: false }) };
  return { statusCode: 200, headers: securityHeaders(), body: JSON.stringify({ ok: true, authenticated: true, csrfToken: session.csrf, expiresAt: session.exp }) };
};

exports.config = { path: '/api/editor/session' };
