const {
  jsonHeaders, isAuthorized, readContent, writeContent,
  clientIp, isRateLimited, noteAuthFailure, clearAuthFailures
} = require('./_shared');

// Yazma gövdesi için üst sınır (kötü niyetli dev yükleri engeller).
const MAX_BODY_BYTES = 3 * 1024 * 1024; // 3 MB

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    // Same-origin kullanıldığından geniş CORS verilmez.
    return { statusCode: 204, headers: jsonHeaders(), body: '' };
  }

  if (event.httpMethod === 'GET') {
    // Parola doğrulama ucu: içerik yazmadan, yalnızca kimlik doğrular.
    // İstemci editör girişinde bunu kullanır; böylece özet istemciye gömülmez.
    const q = event.queryStringParameters || {};
    if (q.check === 'auth') {
      const ip = clientIp(event);
      if (await isRateLimited(ip)) {
        return { statusCode: 429, headers: jsonHeaders({ 'Retry-After': '600' }), body: JSON.stringify({ ok: false, error: 'too_many_attempts' }) };
      }
      const ok = isAuthorized(event);
      if (ok) { await clearAuthFailures(ip); }
      else { await noteAuthFailure(ip); }
      return { statusCode: ok ? 200 : 401, headers: jsonHeaders(), body: JSON.stringify({ ok, editor: ok }) };
    }
    try {
      const content = await readContent();
      return { statusCode: 200, headers: jsonHeaders(), body: JSON.stringify(content) };
    } catch (err) {
      console.error('content_read_failed:', err && err.message ? err.message : err);
      return { statusCode: 500, headers: jsonHeaders(), body: JSON.stringify({ ok: false, error: 'read_failed' }) };
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders({ 'Allow': 'GET, POST, OPTIONS' }), body: JSON.stringify({ ok: false, error: 'method_not_allowed' }) };
  }

  const ip = clientIp(event);

  // Çevrimiçi parola denemelerine karşı hız sınırı.
  if (await isRateLimited(ip)) {
    return { statusCode: 429, headers: jsonHeaders({ 'Retry-After': '600' }), body: JSON.stringify({ ok: false, error: 'too_many_attempts' }) };
  }

  // Gövde boyutu denetimi.
  const rawBody = event.body || '';
  const bodyBytes = event.isBase64Encoded ? Math.floor(rawBody.length * 3 / 4) : Buffer.byteLength(rawBody, 'utf8');
  if (bodyBytes > MAX_BODY_BYTES) {
    return { statusCode: 413, headers: jsonHeaders(), body: JSON.stringify({ ok: false, error: 'payload_too_large' }) };
  }

  if (!isAuthorized(event)) {
    await noteAuthFailure(ip);
    return { statusCode: 401, headers: jsonHeaders(), body: JSON.stringify({ ok: false, error: 'unauthorized' }) };
  }

  // Başarılı kimlik doğrulamada başarısızlık sayacı sıfırlanır.
  await clearAuthFailures(ip);

  let payload;
  try {
    payload = JSON.parse(event.isBase64Encoded ? Buffer.from(rawBody, 'base64').toString('utf8') : (rawBody || '{}'));
  } catch (err) {
    return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ ok: false, error: 'invalid_json' }) };
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ ok: false, error: 'invalid_payload' }) };
  }

  try {
    const current = await readContent();
    const next = { ...current };
    const kind = payload.kind || 'all';

    if ((kind === 'all' || kind === 'data') && Array.isArray(payload.data)) {
      next.data = payload.data;
    }
    if ((kind === 'all' || kind === 'pages') && payload.pages && typeof payload.pages === 'object') {
      next.pages = { ...(current.pages || {}), ...payload.pages };
    }
    if ((kind === 'all' || kind === 'pages') && payload.pages_en && typeof payload.pages_en === 'object') {
      next.pages_en = { ...(current.pages_en || {}), ...payload.pages_en };
    }
    if (payload.meta && typeof payload.meta === 'object') {
      next.meta = { ...(current.meta || {}), ...payload.meta };
    }

    const saved = await writeContent(next);

    return {
      statusCode: 200,
      headers: jsonHeaders(),
      body: JSON.stringify({ ok: true, updatedAt: saved.updatedAt, writeId: saved._writeId })
    };
  } catch (err) {
    console.error('content_write_failed:', err && err.message ? err.message : err);
    return { statusCode: 500, headers: jsonHeaders(), body: JSON.stringify({ ok: false, error: 'write_failed' }) };
  }
};
