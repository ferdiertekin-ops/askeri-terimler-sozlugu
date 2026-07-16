const { jsonHeaders, readContent, writeContent } = require('./_shared');
const { verifySession, verifyCsrf, sameOrigin, securityHeaders } = require('./_auth-session');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: securityHeaders(), body: JSON.stringify({ ok: false, error: 'method_not_allowed' }) };
  if (!sameOrigin(event)) return { statusCode: 403, headers: securityHeaders(), body: JSON.stringify({ ok: false, error: 'origin_rejected' }) };

  const session = verifySession(event);
  if (!session) return { statusCode: 401, headers: securityHeaders(), body: JSON.stringify({ ok: false, error: 'unauthorized' }) };
  if (!verifyCsrf(event, session)) return { statusCode: 403, headers: securityHeaders(), body: JSON.stringify({ ok: false, error: 'csrf_failed' }) };

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch (_) { return { statusCode: 400, headers: securityHeaders(), body: JSON.stringify({ ok: false, error: 'invalid_json' }) }; }

  try {
    const kind = payload.kind || 'all';
    const fullSnapshot = Array.isArray(payload.data) && payload.pages && typeof payload.pages === 'object' && payload.pages_en && typeof payload.pages_en === 'object';
    let next;

    if (fullSnapshot) {
      next = { data: payload.data, pages: payload.pages, pages_en: payload.pages_en, meta: payload.meta && typeof payload.meta === 'object' ? payload.meta : {} };
    } else {
      const current = await readContent();
      next = { ...current };
      if ((kind === 'all' || kind === 'data') && Array.isArray(payload.data)) next.data = payload.data;
      if ((kind === 'all' || kind === 'pages') && payload.pages && typeof payload.pages === 'object') next.pages = { ...(current.pages || {}), ...payload.pages };
      if ((kind === 'all' || kind === 'pages') && payload.pages_en && typeof payload.pages_en === 'object') next.pages_en = { ...(current.pages_en || {}), ...payload.pages_en };
      if (payload.meta && typeof payload.meta === 'object') next.meta = { ...(current.meta || {}), ...payload.meta };
    }

    const saved = await writeContent(next);
    return { statusCode: 200, headers: securityHeaders(), body: JSON.stringify({ ok: true, updatedAt: saved.updatedAt, writeId: saved._writeId, blobResult: saved._blobResult || {} }) };
  } catch (err) {
    return { statusCode: 500, headers: jsonHeaders(), body: JSON.stringify({ ok: false, error: 'write_failed', message: err && err.message ? err.message : String(err) }) };
  }
};

exports.config = { path: '/api/editor/content', rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] } };
