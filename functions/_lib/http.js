const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cache-Control': 'no-store, max-age=0'
};

export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function methodNotAllowed(allowed) {
  return json({ ok: false, error: 'method_not_allowed' }, {
    status: 405,
    headers: { Allow: allowed.join(', ') }
  });
}

export function requestId(request) {
  return request.headers.get('cf-ray') || crypto.randomUUID();
}

export function normalizeQuery(value, maxLength = 120) {
  return String(value || '').trim().slice(0, maxLength);
}
