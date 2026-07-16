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
  const payload = { iat: now, exp: now + SESSION_TTL_SECONDS, sid: crypto.randomBytes(24).toString('base64url'), csrf: crypto.randomBytes(24).toString('base64url') };
  const encoded = b64url(JSON.stringify(payload));
  return { token: `${encoded}.${sign(encoded)}`, payload };
}

function verifySession(event) {
  const token = parseCookies(event)[COOKIE_NAME];
  if (!token) return null;
  const [encoded, signature] = String(token).split('.');
  if (!encoded || !signature || !safeEqual(signature, sign(encoded))) return null;
  let payload;
  try { payload = JSON.parse(fromB64url(encoded)); } catch (_) { return null; }
  const now = Math.floor(Date.now() / 1000);
  if (!payload || !payload.sid || !payload.csrf || !payload.exp || payload.exp <= now) return null;
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

function sameOrigin(event) {
  const origin = String((event.headers && (event.headers.origin || event.headers.Origin)) || '');
  if (!origin) return true;
  const expected = String(process.env.PUBLIC_SITE_ORIGIN || 'https://askeriterimlersozlugu.com').replace(/\/$/, '');
  return origin.replace(/\/$/, '') === expected;
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
    ...extra
  };
}

module.exports = { createSession, verifySession, verifyCsrf, verifyPassword, sameOrigin, sessionCookie, clearCookie, securityHeaders };
