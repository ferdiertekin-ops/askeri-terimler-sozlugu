const crypto = require('crypto');

const COOKIE_NAME = '__Host-ats_session';
const SESSION_TTL_SECONDS = 45 * 60;

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function fromB64url(input) {
  return Buffer.from(String(input || ''), 'base64url').toString('utf8');
}

function secret() {
  const value = String(process.env.SESSION_SECRET || '').trim();
  if (value.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters');
  return value;
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function parseCookies(event) {
  const raw = String((event.headers && (event.headers.cookie || event.headers.Cookie)) || '');
  return Object.fromEntries(raw.split(';').map(v => v.trim()).filter(Boolean).map(part => {
    const i = part.indexOf('=');
    return i < 0 ? [part, ''] : [part.slice(0, i), part.slice(i + 1)];
  }));
}

function createSession() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    sid: crypto.randomBytes(24).toString('base64url'),
    csrf: crypto.randomBytes(24).toString('base64url')
  };
  const encoded = b64url(JSON.stringify(payload));
  return { token: `${encoded}.${sign(encoded)}`, payload };
}

function verifySession(event) {
  const token = parseCookies(event)[COOKIE_NAME];
  if (!token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature || !safeEqual(signature, sign(encoded))) return null;
  let payload;
  try { payload = JSON.parse(fromB64url(encoded)); } catch (_) { return null; }
  const now = Math.floor(Date.now() / 1000);
  if (!payload || payload.v !== 1 || !payload.sid || !payload.csrf || !payload.iat || !payload.exp) return null;
  if (payload.iat > now + 30 || payload.exp <= now || payload.exp - payload.iat > SESSION_TTL_SECONDS) return null;
  return payload;
}

function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

function clearCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

function verifyCsrf(event, session) {
  const supplied = String((event.headers && (event.headers['x-csrf-token'] || event.headers['X-CSRF-Token'])) || '');
  return !!session && safeEqual(supplied, session.csrf);
}

function normalizeOrigin(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:') return '';
    return url.origin;
  } catch (_) {
    return '';
  }
}

function requestOrigin(event) {
  const headers = event.headers || {};
  const origin = normalizeOrigin(headers.origin || headers.Origin);
  if (origin) return origin;
  const proto = String(headers['x-forwarded-proto'] || headers['X-Forwarded-Proto'] || 'https').split(',')[0].trim();
  const host = String(headers['x-forwarded-host'] || headers['X-Forwarded-Host'] || headers.host || headers.Host || '').split(',')[0].trim();
  return normalizeOrigin(`${proto}://${host}`);
}

function allowedOrigins() {
  const values = [
    process.env.PUBLIC_SITE_ORIGIN,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    process.env.DEPLOY_URL
  ];
  return new Set(values.map(normalizeOrigin).filter(Boolean));
}

function sameOrigin(event) {
  const headers = event.headers || {};
  const secFetchSite = String(headers['sec-fetch-site'] || headers['Sec-Fetch-Site'] || '').toLowerCase();
  if (secFetchSite && !['same-origin', 'none'].includes(secFetchSite)) return false;

  const origin = requestOrigin(event);
  if (!origin) return false;
  const allowed = allowedOrigins();
  if (!allowed.size) allowed.add('https://askeriterimlersozlugu.com');
  return allowed.has(origin);
}

function passwordHash() {
  const configured = String(process.env.EDITOR_PASSWORD_HASH || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(configured)) throw new Error('EDITOR_PASSWORD_HASH must be a SHA-256 hex digest');
  return configured;
}

function verifyPassword(password) {
  const actual = crypto.createHash('sha256').update(String(password || ''), 'utf8').digest('hex');
  return safeEqual(actual, passwordHash());
}

function securityHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    ...extra
  };
}

function readiness() {
  const checks = {
    editorPasswordHash: /^[0-9a-f]{64}$/.test(String(process.env.EDITOR_PASSWORD_HASH || '').trim().toLowerCase()),
    sessionSecret: String(process.env.SESSION_SECRET || '').trim().length >= 32,
    allowedOrigin: allowedOrigins().size > 0
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}

module.exports = {
  createSession,
  verifySession,
  verifyCsrf,
  verifyPassword,
  sameOrigin,
  sessionCookie,
  clearCookie,
  securityHeaders,
  readiness
};