const { jsonHeaders, readContent } = require('./_shared');

function readOnlyHeaders() {
  return jsonHeaders({
    'Allow': 'GET, OPTIONS',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  });
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: readOnlyHeaders(), body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 410,
      headers: readOnlyHeaders(),
      body: JSON.stringify({
        ok: false,
        error: 'legacy_write_endpoint_retired',
        message: 'Bu uç nokta artık salt okunurdur. Güvenli editör oturumu kullanılmalıdır.'
      })
    };
  }

  const check = event.queryStringParameters && event.queryStringParameters.check;
  if (String(check || '').toLowerCase() === 'auth') {
    return {
      statusCode: 410,
      headers: readOnlyHeaders(),
      body: JSON.stringify({
        ok: false,
        error: 'legacy_auth_retired',
        message: 'Eski parola özeti doğrulaması devre dışı bırakılmıştır.'
      })
    };
  }

  try {
    const content = await readContent();
    return {
      statusCode: 200,
      headers: readOnlyHeaders(),
      body: JSON.stringify(content)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: readOnlyHeaders(),
      body: JSON.stringify({
        ok: false,
        error: 'read_failed',
        message: err && err.message ? err.message : String(err)
      })
    };
  }
};
