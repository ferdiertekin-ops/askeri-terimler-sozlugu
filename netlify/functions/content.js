const { jsonHeaders, isAuthorized, readContent, writeContent } = require('./_shared');

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: jsonHeaders(), body: '' };
  }

  if (event.httpMethod === 'GET') {
    const check = event.queryStringParameters && event.queryStringParameters.check;
    if (String(check || '').toLowerCase() === 'auth') {
      if (!isAuthorized(event)) {
        return {
          statusCode: 401,
          headers: jsonHeaders(),
          body: JSON.stringify({ ok: false, error: 'unauthorized' })
        };
      }
      return {
        statusCode: 200,
        headers: jsonHeaders(),
        body: JSON.stringify({ ok: true })
      };
    }

    try {
      const content = await readContent();
      return {
        statusCode: 200,
        headers: jsonHeaders(),
        body: JSON.stringify(content)
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: jsonHeaders(),
        body: JSON.stringify({
          ok: false,
          error: 'read_failed',
          message: err && err.message ? err.message : String(err)
        })
      };
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: jsonHeaders(),
      body: JSON.stringify({ ok: false, error: 'method_not_allowed' })
    };
  }

  if (!isAuthorized(event)) {
    return {
      statusCode: 401,
      headers: jsonHeaders(),
      body: JSON.stringify({ ok: false, error: 'unauthorized' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return {
      statusCode: 400,
      headers: jsonHeaders(),
      body: JSON.stringify({ ok: false, error: 'invalid_json' })
    };
  }

  try {
    const kind = payload.kind || 'all';
    const fullSnapshot = Array.isArray(payload.data)
      && payload.pages && typeof payload.pages === 'object'
      && payload.pages_en && typeof payload.pages_en === 'object';
    let next;

    if (fullSnapshot) {
      // Güncel istemci tam anlık görüntü gönderir; önceki blobu okumadan tek yazma yapılır.
      next = {
        data: payload.data,
        pages: payload.pages,
        pages_en: payload.pages_en,
        meta: payload.meta && typeof payload.meta === 'object' ? payload.meta : {}
      };
    } else {
      // Eski istemcilerle geriye dönük uyumluluk.
      const current = await readContent();
      next = { ...current };
      if ((kind === 'all' || kind === 'data') && Array.isArray(payload.data)) next.data = payload.data;
      if ((kind === 'all' || kind === 'pages') && payload.pages && typeof payload.pages === 'object') next.pages = { ...(current.pages || {}), ...payload.pages };
      if ((kind === 'all' || kind === 'pages') && payload.pages_en && typeof payload.pages_en === 'object') next.pages_en = { ...(current.pages_en || {}), ...payload.pages_en };
      if (payload.meta && typeof payload.meta === 'object') next.meta = { ...(current.meta || {}), ...payload.meta };
    }

    const saved = await writeContent(next);
    return {
      statusCode: 200,
      headers: jsonHeaders(),
      body: JSON.stringify({
        ok: true,
        updatedAt: saved.updatedAt,
        writeId: saved._writeId,
        blobResult: saved._blobResult || {}
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: jsonHeaders(),
      body: JSON.stringify({
        ok: false,
        error: 'write_failed',
        message: err && err.message ? err.message : String(err)
      })
    };
  }
};
