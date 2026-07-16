const { readiness, securityHeaders } = require('./_auth-session');

exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: securityHeaders(),
      body: JSON.stringify({ ok: false, error: 'method_not_allowed' })
    };
  }

  const result = readiness();
  return {
    statusCode: result.ok ? 200 : 503,
    headers: securityHeaders(),
    body: JSON.stringify(result)
  };
};

exports.config = { path: '/api/editor/health' };
