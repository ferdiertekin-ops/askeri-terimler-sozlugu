const LIVE_ORIGIN = 'https://askeriterimlersozlugu.com';
const UPSTREAM_TIMEOUT_MS = 10000;
const SAFE_LIST_PARAMS = ['limit', 'offset', 'q'];

function jsonResponse(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders
    },
    body: JSON.stringify(payload)
  };
}

function safeToken(value) {
  try {
    const decoded = decodeURIComponent(String(value || '').trim());
    return /^[a-z0-9][a-z0-9-]{0,199}$/i.test(decoded) ? decoded : '';
  } catch {
    return '';
  }
}

function addListQuery(target, event) {
  const params = event.queryStringParameters || {};
  for (const key of SAFE_LIST_PARAMS) {
    if (params[key] != null && String(params[key]) !== '') {
      target.searchParams.set(key, String(params[key]));
    }
  }
}

function upstreamUrl(event, route) {
  const params = event.queryStringParameters || {};

  if (route === 'terms') {
    const target = new URL('/api/terms', LIVE_ORIGIN);
    addListQuery(target, event);
    return target;
  }

  if (route === 'term') {
    const slug = safeToken(params.slug);
    return slug ? new URL(`/api/terms/${encodeURIComponent(slug)}`, LIVE_ORIGIN) : null;
  }

  if (route === 'site-page') {
    const key = safeToken(params.key);
    return key ? new URL(`/api/site-pages/${encodeURIComponent(key)}`, LIVE_ORIGIN) : null;
  }

  return null;
}

async function handlePreviewRequest(event, route) {
  const method = String(event.httpMethod || 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        Allow: 'GET, HEAD, OPTIONS',
        'Cache-Control': 'no-store, max-age=0',
        'X-Robots-Tag': 'noindex, nofollow, noarchive'
      },
      body: ''
    };
  }

  if (method !== 'GET' && method !== 'HEAD') {
    return jsonResponse(405, { ok: false, error: 'method_not_allowed' }, {
      Allow: 'GET, HEAD, OPTIONS'
    });
  }

  if (route === 'editor-session') {
    return jsonResponse(200, { ok: true, authenticated: false });
  }

  const target = upstreamUrl(event, route);
  if (!target) return jsonResponse(400, { ok: false, error: 'invalid_preview_route' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    // Bilerek Cookie ve Authorization aktarılmaz: Deploy Preview salt okunurdur.
    const response = await fetch(target, {
      method,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ats-netlify-deploy-preview/1.0'
      },
      redirect: 'manual',
      signal: controller.signal
    });

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      return jsonResponse(502, { ok: false, error: 'invalid_upstream_response' });
    }

    const body = method === 'HEAD' ? '' : await response.text();
    if (method !== 'HEAD') {
      try {
        JSON.parse(body);
      } catch {
        return jsonResponse(502, { ok: false, error: 'invalid_upstream_json' });
      }
    }

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
        'X-Content-Type-Options': 'nosniff'
      },
      body
    };
  } catch (error) {
    const timedOut = error && error.name === 'AbortError';
    return jsonResponse(502, {
      ok: false,
      error: timedOut ? 'upstream_timeout' : 'upstream_unavailable'
    });
  } finally {
    clearTimeout(timeout);
  }
}

exports.createHandler = function createHandler(route) {
  return event => handlePreviewRequest(event, route);
};
