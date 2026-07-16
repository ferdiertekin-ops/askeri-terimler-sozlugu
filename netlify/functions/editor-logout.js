const { clearCookie, sameOrigin, securityHeaders } = require('./_auth-session');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: securityHeaders(), body: JSON.stringify({ ok: false, error: 'method_not_allowed' }) };
  if (!sameOrigin(event)) return { statusCode: 403, headers: securityHeaders(), body: JSON.stringify({ ok: false, error: 'origin_rejected' }) };
  return { statusCode: 200, headers: securityHeaders({ 'Set-Cookie': clearCookie() }), body: JSON.stringify({ ok: true }) };
};

exports.config = { path: '/api/editor/logout' };
