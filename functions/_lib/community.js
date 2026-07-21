import { json, methodNotAllowed, requestId } from './http.js';

const COOKIE_NAME = 'ats_member_session';
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const VERIFICATION_TTL_SECONDS = 24 * 60 * 60;
const RESET_TTL_SECONDS = 60 * 60;
const PASSWORD_ITERATIONS = 310000;
const CONSENT_VERSION = '2026-07-21';
const INTEREST_AREAS = new Set([
  '', 'history', 'military-history', 'ottoman-history', 'language-terminology',
  'undergraduate-graduate', 'academic', 'independent-researcher', 'other'
]);

function clean(value, maxLength = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  return Boolean(origin) && origin === new URL(request.url).origin;
}

function cookieValue(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
}

function secureCookie(token, maxAge = SESSION_TTL_SECONDS) {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

function clearCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function hex(buffer) {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || ''))));
}

function constantTimeEqual(leftValue, rightValue) {
  const left = String(leftValue || '');
  const right = String(rightValue || '');
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(value || ''))));
}

async function bodyJson(request) {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 64 * 1024) throw new Error('payload_too_large');
  return request.json();
}

function normalizeEmail(value) {
  return clean(value, 254).toLocaleLowerCase('en-US');
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

function validPassword(password) {
  const value = typeof password === 'string' ? password : '';
  if (value.length < 12 || value.length > 128) return false;
  return /\p{L}/u.test(value) && /\p{N}/u.test(value);
}

async function hashPassword(password, salt = null) {
  const saltBytes = salt ? base64UrlToBytes(salt) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: PASSWORD_ITERATIONS },
    keyMaterial,
    256
  );
  return { hash: hex(bits), salt: bytesToBase64Url(saltBytes) };
}

async function passwordMatches(password, storedHash, storedSalt) {
  if (!validPassword(password) || !/^[0-9a-f]{64}$/.test(String(storedHash || ''))) return false;
  try {
    const derived = await hashPassword(password, storedSalt);
    return constantTimeEqual(derived.hash, storedHash);
  } catch {
    return false;
  }
}

function requireDatabase(context) {
  return context.env.DB ? null : json({ ok: false, error: 'database_not_configured' }, { status: 503 });
}

function securityConfigured(env) {
  return clean(env.COMMUNITY_SECURITY_SECRET, 500).length >= 32;
}

function turnstileConfigured(env) {
  return Boolean(clean(env.TURNSTILE_SITE_KEY, 300) && clean(env.TURNSTILE_SECRET_KEY, 300));
}

function emailConfigured(env) {
  return Boolean(clean(env.CF_ACCOUNT_ID, 120) && clean(env.CF_EMAIL_API_TOKEN, 1000) && clean(env.COMMUNITY_EMAIL_FROM, 320));
}

async function validateTurnstile(context, token, expectedAction) {
  const secret = clean(context.env.TURNSTILE_SECRET_KEY, 300);
  if (!secret) return { ok: false, error: 'turnstile_not_configured', status: 503 };
  const responseToken = clean(token, 2048);
  if (!responseToken) return { ok: false, error: 'turnstile_required', status: 400 };
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', responseToken);
  const ip = clean(context.request.headers.get('CF-Connecting-IP'), 80);
  if (ip) form.append('remoteip', ip);
  form.append('idempotency_key', crypto.randomUUID());
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) return { ok: false, error: 'turnstile_failed', status: 403 };
    if (expectedAction && data.action && data.action !== expectedAction) return { ok: false, error: 'turnstile_action_mismatch', status: 403 };
    return { ok: true };
  } catch {
    return { ok: false, error: 'turnstile_unavailable', status: 503 };
  }
}

async function rateLimitKey(context, scope, identity = '') {
  const secret = clean(context.env.COMMUNITY_SECURITY_SECRET, 500);
  if (secret.length < 32) throw new Error('community_security_not_configured');
  const ip = clean(context.request.headers.get('CF-Connecting-IP'), 80) || 'unknown';
  return hmacHex(secret, `${scope}\n${ip}\n${String(identity || '').toLocaleLowerCase('en-US')}`);
}

async function consumeRateLimit(context, scope, { identity = '', limit = 10, windowSeconds = 900 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const key = await rateLimitKey(context, scope, identity);
  const current = await context.env.DB.prepare(
    'SELECT window_started_at, attempts FROM community_rate_limits WHERE bucket_key=?1'
  ).bind(key).first();
  if (!current || Number(current.window_started_at || 0) + windowSeconds <= now) {
    await context.env.DB.prepare(`
      INSERT INTO community_rate_limits (bucket_key, window_started_at, attempts)
      VALUES (?1, ?2, 1)
      ON CONFLICT(bucket_key) DO UPDATE SET window_started_at=excluded.window_started_at, attempts=1
    `).bind(key, now).run();
    return false;
  }
  const attempts = Number(current.attempts || 0) + 1;
  await context.env.DB.prepare('UPDATE community_rate_limits SET attempts=?1 WHERE bucket_key=?2').bind(attempts, key).run();
  return attempts > limit;
}

async function createSession(context, userId) {
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  const csrf = randomToken(24);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare('DELETE FROM community_sessions WHERE expires_at <= ?1').bind(new Date().toISOString()),
    context.env.DB.prepare(`
      INSERT INTO community_sessions (token_hash, user_id, csrf_token, expires_at)
      VALUES (?1, ?2, ?3, ?4)
    `).bind(tokenHash, userId, csrf, expiresAt)
  ]);
  return { token, csrf, expiresAt };
}

export async function getCommunitySession(context) {
  if (!context.env.DB) return null;
  const rawToken = cookieValue(context.request, COOKIE_NAME);
  if (!rawToken) return null;
  const tokenHash = await sha256(rawToken);
  const row = await context.env.DB.prepare(`
    SELECT s.token_hash, s.csrf_token, s.expires_at,
           u.id, u.email, u.display_name, u.institution, u.interest_area, u.locale,
           u.notify_new_terms, u.notify_updates, u.email_verified_at, u.is_active
    FROM community_sessions s
    JOIN community_users u ON u.id=s.user_id
    WHERE s.token_hash=?1 AND s.expires_at>?2 AND u.is_active=1 AND u.email_verified_at IS NOT NULL
  `).bind(tokenHash, new Date().toISOString()).first();
  if (!row) return null;
  return {
    tokenHash: row.token_hash,
    csrf: row.csrf_token,
    expiresAt: row.expires_at,
    user: {
      id: row.id,
      email: row.email,
      displayName: row.display_name || '',
      institution: row.institution || '',
      interestArea: row.interest_area || '',
      locale: row.locale === 'en' ? 'en' : 'tr',
      notifyNewTerms: Boolean(row.notify_new_terms),
      notifyUpdates: Boolean(row.notify_updates),
      emailVerifiedAt: row.email_verified_at
    }
  };
}

async function authorize(context, { csrf = false } = {}) {
  const session = await getCommunitySession(context);
  if (!session) return { response: json({ ok: false, error: 'unauthorized' }, { status: 401 }) };
  if (csrf) {
    if (!sameOrigin(context.request)) return { response: json({ ok: false, error: 'invalid_origin' }, { status: 403 }) };
    const supplied = context.request.headers.get('X-CSRF-Token') || '';
    if (!constantTimeEqual(supplied, session.csrf)) return { response: json({ ok: false, error: 'invalid_csrf' }, { status: 403 }) };
  }
  return { session };
}

function publicProfile(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName || '',
    institution: user.institution || '',
    interestArea: user.interestArea || '',
    locale: user.locale === 'en' ? 'en' : 'tr',
    notifyNewTerms: Boolean(user.notifyNewTerms),
    notifyUpdates: Boolean(user.notifyUpdates),
    emailVerifiedAt: user.emailVerifiedAt || null
  };
}

function htmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function sendEmail(env, { to, subject, html, text, headers = {} }) {
  if (!emailConfigured(env)) throw new Error('community_email_not_configured');
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(clean(env.CF_ACCOUNT_ID, 120))}/email/sending/send`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clean(env.CF_EMAIL_API_TOKEN, 1000)}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to,
      from: clean(env.COMMUNITY_EMAIL_FROM, 320),
      subject,
      html,
      text,
      headers
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const message = data?.errors?.[0]?.message || `email_http_${response.status}`;
    throw new Error(message);
  }
  return data;
}

async function createOneTimeToken(db, table, userId, ttlSeconds) {
  const token = randomToken(32);
  const hash = await sha256(token);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await db.batch([
    db.prepare(`DELETE FROM ${table} WHERE user_id=?1 OR expires_at<=?2`).bind(userId, new Date().toISOString()),
    db.prepare(`INSERT INTO ${table} (token_hash, user_id, expires_at) VALUES (?1, ?2, ?3)`).bind(hash, userId, expiresAt)
  ]);
  return { token, expiresAt };
}

function verificationCopy(locale, verifyUrl, displayName = '') {
  const tr = locale !== 'en';
  const greeting = displayName ? (tr ? `Merhaba ${htmlEscape(displayName)},` : `Hello ${htmlEscape(displayName)},`) : (tr ? 'Merhaba,' : 'Hello,');
  if (tr) {
    return {
      subject: 'Askerî Terimler Sözlüğü · E-posta doğrulama',
      html: `<p>${greeting}</p><p>Üyeliğinizi etkinleştirmek için aşağıdaki bağlantıyı kullanın. Sözlük herkes için açık ve ücretsiz kalmaya devam eder; üyelik yalnız favoriler ve topluluk özellikleri içindir.</p><p><a href="${htmlEscape(verifyUrl)}">E-posta adresimi doğrula</a></p><p>Bağlantı 24 saat geçerlidir.</p>`,
      text: `${greeting.replace(/<[^>]+>/g, '')}\n\nÜyeliğinizi etkinleştirmek için: ${verifyUrl}\n\nBağlantı 24 saat geçerlidir.`
    };
  }
  return {
    subject: 'Military Terms Dictionary · Verify your email',
    html: `<p>${greeting}</p><p>Use the link below to activate your account. The dictionary remains open and free for everyone; membership only adds favourites and community features.</p><p><a href="${htmlEscape(verifyUrl)}">Verify my email</a></p><p>The link is valid for 24 hours.</p>`,
    text: `${greeting.replace(/<[^>]+>/g, '')}\n\nActivate your account: ${verifyUrl}\n\nThe link is valid for 24 hours.`
  };
}

async function sendVerification(context, user) {
  const created = await createOneTimeToken(context.env.DB, 'community_verification_tokens', user.id, VERIFICATION_TTL_SECONDS);
  const origin = new URL(context.request.url).origin;
  const verifyUrl = `${origin}/api/account/verify?token=${encodeURIComponent(created.token)}`;
  const copy = verificationCopy(user.locale, verifyUrl, user.displayName);
  await sendEmail(context.env, { to: user.email, ...copy });
  return created;
}

function resetCopy(locale, resetUrl, displayName = '') {
  const tr = locale !== 'en';
  const greeting = displayName ? (tr ? `Merhaba ${htmlEscape(displayName)},` : `Hello ${htmlEscape(displayName)},`) : (tr ? 'Merhaba,' : 'Hello,');
  if (tr) {
    return {
      subject: 'Askerî Terimler Sözlüğü · Parola yenileme',
      html: `<p>${greeting}</p><p>Parolanızı yenilemek için aşağıdaki bağlantıyı kullanın.</p><p><a href="${htmlEscape(resetUrl)}">Parolamı yenile</a></p><p>Bağlantı 1 saat geçerlidir. Bu isteği siz yapmadıysanız e-postayı yok sayabilirsiniz.</p>`,
      text: `${greeting.replace(/<[^>]+>/g, '')}\n\nParolanızı yenilemek için: ${resetUrl}\n\nBağlantı 1 saat geçerlidir.`
    };
  }
  return {
    subject: 'Military Terms Dictionary · Reset your password',
    html: `<p>${greeting}</p><p>Use the link below to reset your password.</p><p><a href="${htmlEscape(resetUrl)}">Reset my password</a></p><p>The link is valid for one hour. Ignore this email if you did not request it.</p>`,
    text: `${greeting.replace(/<[^>]+>/g, '')}\n\nReset your password: ${resetUrl}\n\nThe link is valid for one hour.`
  };
}

async function recordConsent(db, userId, type, granted) {
  await db.prepare(`
    INSERT INTO community_consents (id, user_id, consent_type, granted, consent_version)
    VALUES (?1, ?2, ?3, ?4, ?5)
  `).bind(crypto.randomUUID(), userId, type, granted ? 1 : 0, CONSENT_VERSION).run();
}

function userInput(body) {
  const interestArea = clean(body?.interestArea, 80);
  return {
    email: normalizeEmail(body?.email),
    displayName: clean(body?.displayName, 120),
    institution: clean(body?.institution, 200),
    interestArea: INTEREST_AREAS.has(interestArea) ? interestArea : '',
    locale: body?.locale === 'en' ? 'en' : 'tr',
    notifyNewTerms: body?.notifyNewTerms === true,
    notifyUpdates: body?.notifyUpdates === true
  };
}

async function config(context) {
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  return json({
    ok: true,
    turnstileSiteKey: clean(context.env.TURNSTILE_SITE_KEY, 300),
    turnstileConfigured: turnstileConfigured(context.env),
    emailConfigured: emailConfigured(context.env),
    registrationReady: Boolean(context.env.DB && securityConfigured(context.env) && turnstileConfigured(context.env) && emailConfigured(context.env)),
    consentVersion: CONSENT_VERSION
  });
}

async function register(context) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  const dbError = requireDatabase(context); if (dbError) return dbError;
  if (!sameOrigin(context.request)) return json({ ok: false, error: 'invalid_origin' }, { status: 403 });
  if (!securityConfigured(context.env)) return json({ ok: false, error: 'community_security_not_configured' }, { status: 503 });
  if (!emailConfigured(context.env)) return json({ ok: false, error: 'community_email_not_configured' }, { status: 503 });
  let body;
  try { body = await bodyJson(context.request); } catch { return json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  const input = userInput(body);
  if (!validEmail(input.email)) return json({ ok: false, error: 'invalid_email' }, { status: 400 });
  if (!validPassword(body?.password)) return json({ ok: false, error: 'weak_password' }, { status: 400 });
  const turnstile = await validateTurnstile(context, body?.turnstileToken, 'signup');
  if (!turnstile.ok) return json({ ok: false, error: turnstile.error }, { status: turnstile.status });
  try {
    if (await consumeRateLimit(context, 'signup-ip', { limit: 5, windowSeconds: 3600 })) return json({ ok: false, error: 'rate_limited' }, { status: 429 });
    if (await consumeRateLimit(context, 'signup-email', { identity: input.email, limit: 3, windowSeconds: 3600 })) return json({ ok: false, error: 'rate_limited' }, { status: 429 });
  } catch {
    return json({ ok: false, error: 'community_security_not_configured' }, { status: 503 });
  }

  const existing = await context.env.DB.prepare(`
    SELECT id, email, display_name, locale, email_verified_at, is_active
    FROM community_users WHERE email=?1
  `).bind(input.email).first();
  if (existing?.email_verified_at && Number(existing.is_active) === 1) return json({ ok: false, error: 'email_exists' }, { status: 409 });

  const credentials = await hashPassword(body.password);
  const userId = existing?.id || crypto.randomUUID();
  if (existing) {
    await context.env.DB.prepare(`
      UPDATE community_users SET password_hash=?1, password_salt=?2, display_name=?3, institution=?4,
        interest_area=?5, locale=?6, notify_new_terms=?7, notify_updates=?8, is_active=1,
        updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?9
    `).bind(credentials.hash, credentials.salt, input.displayName || null, input.institution || null, input.interestArea || null,
      input.locale, input.notifyNewTerms ? 1 : 0, input.notifyUpdates ? 1 : 0, userId).run();
  } else {
    await context.env.DB.prepare(`
      INSERT INTO community_users
        (id,email,password_hash,password_salt,display_name,institution,interest_area,locale,notify_new_terms,notify_updates)
      VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
    `).bind(userId, input.email, credentials.hash, credentials.salt, input.displayName || null, input.institution || null,
      input.interestArea || null, input.locale, input.notifyNewTerms ? 1 : 0, input.notifyUpdates ? 1 : 0).run();
  }
  await Promise.all([
    recordConsent(context.env.DB, userId, 'notify_new_terms', input.notifyNewTerms),
    recordConsent(context.env.DB, userId, 'notify_updates', input.notifyUpdates)
  ]);
  try {
    await sendVerification(context, { id: userId, email: input.email, locale: input.locale, displayName: input.displayName });
  } catch (error) {
    return json({ ok: false, error: 'verification_email_failed', message: String(error?.message || error) }, { status: 502 });
  }
  return json({ ok: true, verificationRequired: true });
}

async function verifyEmail(context) {
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  const dbError = requireDatabase(context); if (dbError) return dbError;
  const url = new URL(context.request.url);
  const rawToken = clean(url.searchParams.get('token'), 200);
  const fallback = '/oturum-ac/?verification=invalid';
  if (!rawToken) return Response.redirect(new URL(fallback, url.origin).toString(), 303);
  const tokenHash = await sha256(rawToken);
  const row = await context.env.DB.prepare(`
    SELECT t.token_hash,t.user_id,t.expires_at,t.used_at,u.locale
    FROM community_verification_tokens t JOIN community_users u ON u.id=t.user_id
    WHERE t.token_hash=?1
  `).bind(tokenHash).first();
  const lang = row?.locale === 'en' ? 'en' : 'tr';
  const successPath = lang === 'en' ? '/en/sign-in/?verification=success' : '/oturum-ac/?verification=success';
  const invalidPath = lang === 'en' ? '/en/sign-in/?verification=invalid' : fallback;
  if (!row || row.used_at || row.expires_at <= new Date().toISOString()) return Response.redirect(new URL(invalidPath, url.origin).toString(), 303);
  await context.env.DB.batch([
    context.env.DB.prepare("UPDATE community_verification_tokens SET used_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE token_hash=?1 AND used_at IS NULL").bind(tokenHash),
    context.env.DB.prepare("UPDATE community_users SET email_verified_at=COALESCE(email_verified_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1").bind(row.user_id)
  ]);
  return Response.redirect(new URL(successPath, url.origin).toString(), 303);
}

async function resendVerification(context) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  const dbError = requireDatabase(context); if (dbError) return dbError;
  if (!sameOrigin(context.request)) return json({ ok: false, error: 'invalid_origin' }, { status: 403 });
  if (!emailConfigured(context.env)) return json({ ok: false, error: 'community_email_not_configured' }, { status: 503 });
  let body; try { body = await bodyJson(context.request); } catch { return json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  const email = normalizeEmail(body?.email);
  const turnstile = await validateTurnstile(context, body?.turnstileToken, 'resend');
  if (!turnstile.ok) return json({ ok: false, error: turnstile.error }, { status: turnstile.status });
  try {
    if (await consumeRateLimit(context, 'resend-verification', { identity: email, limit: 3, windowSeconds: 3600 })) return json({ ok: false, error: 'rate_limited' }, { status: 429 });
  } catch { return json({ ok: false, error: 'community_security_not_configured' }, { status: 503 }); }
  const user = validEmail(email) ? await context.env.DB.prepare(`SELECT id,email,display_name,locale,email_verified_at,is_active FROM community_users WHERE email=?1`).bind(email).first() : null;
  if (user && !user.email_verified_at && Number(user.is_active) === 1) {
    try { await sendVerification(context, { id: user.id, email: user.email, locale: user.locale, displayName: user.display_name || '' }); } catch {}
  }
  return json({ ok: true });
}

async function login(context) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  const dbError = requireDatabase(context); if (dbError) return dbError;
  if (!sameOrigin(context.request)) return json({ ok: false, error: 'invalid_origin' }, { status: 403 });
  if (!securityConfigured(context.env)) return json({ ok: false, error: 'community_security_not_configured' }, { status: 503 });
  let body; try { body = await bodyJson(context.request); } catch { return json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  const email = normalizeEmail(body?.email);
  const turnstile = await validateTurnstile(context, body?.turnstileToken, 'login');
  if (!turnstile.ok) return json({ ok: false, error: turnstile.error }, { status: turnstile.status });
  try {
    if (await consumeRateLimit(context, 'login', { identity: email, limit: 10, windowSeconds: 900 })) return json({ ok: false, error: 'rate_limited' }, { status: 429 });
  } catch { return json({ ok: false, error: 'community_security_not_configured' }, { status: 503 }); }
  const user = validEmail(email) ? await context.env.DB.prepare(`
    SELECT id,email,password_hash,password_salt,display_name,institution,interest_area,locale,notify_new_terms,notify_updates,email_verified_at,is_active
    FROM community_users WHERE email=?1
  `).bind(email).first() : null;
  if (!user || Number(user.is_active) !== 1 || !(await passwordMatches(body?.password, user.password_hash, user.password_salt))) {
    return json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  }
  if (!user.email_verified_at) return json({ ok: false, error: 'email_not_verified' }, { status: 403 });
  const created = await createSession(context, user.id);
  await context.env.DB.prepare("UPDATE community_users SET last_login_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1").bind(user.id).run();
  return json({ ok: true, csrfToken: created.csrf, expiresAt: created.expiresAt }, { headers: { 'Set-Cookie': secureCookie(created.token) } });
}

async function session(context) {
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  const current = await getCommunitySession(context);
  if (!current) return json({ ok: true, authenticated: false });
  const favoriteCount = await context.env.DB.prepare('SELECT COUNT(*) AS count FROM community_favorites WHERE user_id=?1').bind(current.user.id).first();
  return json({
    ok: true,
    authenticated: true,
    csrfToken: current.csrf,
    expiresAt: current.expiresAt,
    favoriteCount: Number(favoriteCount?.count || 0),
    user: publicProfile(current.user)
  });
}

async function logout(context) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  const auth = await authorize(context, { csrf: true });
  if (auth.response) return auth.response;
  await context.env.DB.prepare('DELETE FROM community_sessions WHERE token_hash=?1').bind(auth.session.tokenHash).run();
  return json({ ok: true }, { headers: { 'Set-Cookie': clearCookie() } });
}

async function profile(context) {
  const dbError = requireDatabase(context); if (dbError) return dbError;
  const auth = await authorize(context, { csrf: context.request.method !== 'GET' });
  if (auth.response) return auth.response;
  if (context.request.method === 'GET') return json({ ok: true, user: publicProfile(auth.session.user) });
  if (context.request.method === 'PUT') {
    let body; try { body = await bodyJson(context.request); } catch { return json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
    const input = userInput({ ...body, email: auth.session.user.email });
    const before = auth.session.user;
    await context.env.DB.prepare(`
      UPDATE community_users SET display_name=?1,institution=?2,interest_area=?3,locale=?4,
        notify_new_terms=?5,notify_updates=?6,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?7
    `).bind(input.displayName || null, input.institution || null, input.interestArea || null, input.locale,
      input.notifyNewTerms ? 1 : 0, input.notifyUpdates ? 1 : 0, before.id).run();
    if (Boolean(before.notifyNewTerms) !== input.notifyNewTerms) await recordConsent(context.env.DB, before.id, 'notify_new_terms', input.notifyNewTerms);
    if (Boolean(before.notifyUpdates) !== input.notifyUpdates) await recordConsent(context.env.DB, before.id, 'notify_updates', input.notifyUpdates);
    const fresh = await context.env.DB.prepare(`SELECT id,email,display_name,institution,interest_area,locale,notify_new_terms,notify_updates,email_verified_at FROM community_users WHERE id=?1`).bind(before.id).first();
    return json({ ok: true, user: publicProfile({
      id:fresh.id,email:fresh.email,displayName:fresh.display_name||'',institution:fresh.institution||'',interestArea:fresh.interest_area||'',locale:fresh.locale,
      notifyNewTerms:Boolean(fresh.notify_new_terms),notifyUpdates:Boolean(fresh.notify_updates),emailVerifiedAt:fresh.email_verified_at
    }) });
  }
  if (context.request.method === 'DELETE') {
    let body; try { body = await bodyJson(context.request); } catch { return json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
    const credentials = await context.env.DB.prepare('SELECT password_hash,password_salt FROM community_users WHERE id=?1').bind(auth.session.user.id).first();
    if (!credentials || !(await passwordMatches(body?.password, credentials.password_hash, credentials.password_salt))) return json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
    await context.env.DB.prepare('DELETE FROM community_users WHERE id=?1').bind(auth.session.user.id).run();
    return json({ ok: true }, { headers: { 'Set-Cookie': clearCookie() } });
  }
  return methodNotAllowed(['GET','PUT','DELETE']);
}

async function changePassword(context) {
  if (context.request.method !== 'PUT') return methodNotAllowed(['PUT']);
  const auth = await authorize(context, { csrf: true }); if (auth.response) return auth.response;
  let body; try { body = await bodyJson(context.request); } catch { return json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  if (!validPassword(body?.newPassword)) return json({ ok: false, error: 'weak_password' }, { status: 400 });
  const credentials = await context.env.DB.prepare('SELECT password_hash,password_salt FROM community_users WHERE id=?1').bind(auth.session.user.id).first();
  if (!credentials || !(await passwordMatches(body?.currentPassword, credentials.password_hash, credentials.password_salt))) return json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  const next = await hashPassword(body.newPassword);
  await context.env.DB.batch([
    context.env.DB.prepare("UPDATE community_users SET password_hash=?1,password_salt=?2,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?3").bind(next.hash,next.salt,auth.session.user.id),
    context.env.DB.prepare('DELETE FROM community_sessions WHERE user_id=?1 AND token_hash<>?2').bind(auth.session.user.id, auth.session.tokenHash)
  ]);
  return json({ ok: true });
}

async function requestPasswordReset(context) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  const dbError = requireDatabase(context); if (dbError) return dbError;
  if (!sameOrigin(context.request)) return json({ ok: false, error: 'invalid_origin' }, { status: 403 });
  if (!emailConfigured(context.env)) return json({ ok: false, error: 'community_email_not_configured' }, { status: 503 });
  let body; try { body = await bodyJson(context.request); } catch { return json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  const email = normalizeEmail(body?.email);
  const turnstile = await validateTurnstile(context, body?.turnstileToken, 'reset');
  if (!turnstile.ok) return json({ ok: false, error: turnstile.error }, { status: turnstile.status });
  try {
    if (await consumeRateLimit(context, 'password-reset', { identity: email, limit: 3, windowSeconds: 3600 })) return json({ ok: false, error: 'rate_limited' }, { status: 429 });
  } catch { return json({ ok: false, error: 'community_security_not_configured' }, { status: 503 }); }
  const user = validEmail(email) ? await context.env.DB.prepare(`SELECT id,email,display_name,locale,email_verified_at,is_active FROM community_users WHERE email=?1`).bind(email).first() : null;
  if (user && user.email_verified_at && Number(user.is_active) === 1) {
    try {
      const created = await createOneTimeToken(context.env.DB, 'community_password_reset_tokens', user.id, RESET_TTL_SECONDS);
      const origin = new URL(context.request.url).origin;
      const path = user.locale === 'en' ? '/en/reset-password/' : '/parola-yenile/';
      const resetUrl = `${origin}${path}?token=${encodeURIComponent(created.token)}`;
      await sendEmail(context.env, { to: user.email, ...resetCopy(user.locale, resetUrl, user.display_name || '') });
    } catch {}
  }
  return json({ ok: true });
}

async function resetPassword(context) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  const dbError = requireDatabase(context); if (dbError) return dbError;
  if (!sameOrigin(context.request)) return json({ ok: false, error: 'invalid_origin' }, { status: 403 });
  let body; try { body = await bodyJson(context.request); } catch { return json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  if (!validPassword(body?.password)) return json({ ok: false, error: 'weak_password' }, { status: 400 });
  const rawToken = clean(body?.token, 200);
  if (!rawToken) return json({ ok: false, error: 'invalid_reset_token' }, { status: 400 });
  const tokenHash = await sha256(rawToken);
  const row = await context.env.DB.prepare(`SELECT token_hash,user_id,expires_at,used_at FROM community_password_reset_tokens WHERE token_hash=?1`).bind(tokenHash).first();
  if (!row || row.used_at || row.expires_at <= new Date().toISOString()) return json({ ok: false, error: 'invalid_reset_token' }, { status: 400 });
  const credentials = await hashPassword(body.password);
  await context.env.DB.batch([
    context.env.DB.prepare("UPDATE community_password_reset_tokens SET used_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE token_hash=?1 AND used_at IS NULL").bind(tokenHash),
    context.env.DB.prepare("UPDATE community_users SET password_hash=?1,password_salt=?2,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?3").bind(credentials.hash,credentials.salt,row.user_id),
    context.env.DB.prepare('DELETE FROM community_sessions WHERE user_id=?1').bind(row.user_id)
  ]);
  return json({ ok: true });
}

async function favorites(context) {
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  const auth = await authorize(context); if (auth.response) return auth.response;
  const rows = await context.env.DB.prepare(`
    SELECT f.term_slug AS slug,f.created_at,t.headword_en,t.ottoman_period_term,t.modern_equivalent_tr
    FROM community_favorites f
    JOIN terms t ON t.slug=f.term_slug AND t.status='published'
    WHERE f.user_id=?1
    ORDER BY f.created_at DESC
  `).bind(auth.session.user.id).all();
  return json({ ok: true, items: rows.results || [] });
}

async function favoriteItem(context, slug) {
  const normalizedSlug = clean(slug, 150).toLocaleLowerCase('en-US');
  if (!/^[a-z0-9-]{1,150}$/.test(normalizedSlug)) return json({ ok: false, error: 'invalid_slug' }, { status: 400 });
  const auth = await authorize(context, { csrf: context.request.method !== 'GET' }); if (auth.response) return auth.response;
  if (context.request.method === 'GET') {
    const row = await context.env.DB.prepare('SELECT 1 AS found FROM community_favorites WHERE user_id=?1 AND term_slug=?2').bind(auth.session.user.id, normalizedSlug).first();
    return json({ ok: true, favorite: Boolean(row) });
  }
  if (context.request.method === 'PUT') {
    const term = await context.env.DB.prepare("SELECT 1 AS found FROM terms WHERE slug=?1 AND status='published'").bind(normalizedSlug).first();
    if (!term) return json({ ok: false, error: 'term_not_found' }, { status: 404 });
    await context.env.DB.prepare('INSERT OR IGNORE INTO community_favorites (user_id,term_slug) VALUES (?1,?2)').bind(auth.session.user.id, normalizedSlug).run();
    return json({ ok: true, favorite: true });
  }
  if (context.request.method === 'DELETE') {
    await context.env.DB.prepare('DELETE FROM community_favorites WHERE user_id=?1 AND term_slug=?2').bind(auth.session.user.id, normalizedSlug).run();
    return json({ ok: true, favorite: false });
  }
  return methodNotAllowed(['GET','PUT','DELETE']);
}

async function contributions(context) {
  const auth = await authorize(context, { csrf: context.request.method === 'POST' }); if (auth.response) return auth.response;
  if (context.request.method === 'GET') {
    const rows = await context.env.DB.prepare(`
      SELECT id,term_slug,suggestion_type,message,status,created_at,updated_at
      FROM community_contributions WHERE user_id=?1 ORDER BY created_at DESC LIMIT 30
    `).bind(auth.session.user.id).all();
    return json({ ok: true, items: rows.results || [] });
  }
  if (context.request.method !== 'POST') return methodNotAllowed(['GET','POST']);
  let body; try { body = await bodyJson(context.request); } catch { return json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  const message = clean(body?.message, 5000);
  const termSlug = clean(body?.termSlug, 150).toLocaleLowerCase('en-US');
  const type = ['correction','source','new-term','other'].includes(body?.suggestionType) ? body.suggestionType : 'correction';
  if (message.length < 10) return json({ ok: false, error: 'contribution_too_short' }, { status: 400 });
  if (termSlug && !/^[a-z0-9-]{1,150}$/.test(termSlug)) return json({ ok: false, error: 'invalid_slug' }, { status: 400 });
  if (termSlug) {
    const term = await context.env.DB.prepare("SELECT 1 AS found FROM terms WHERE slug=?1 AND status='published'").bind(termSlug).first();
    if (!term) return json({ ok: false, error: 'term_not_found' }, { status: 404 });
  }
  const id = crypto.randomUUID();
  await context.env.DB.prepare(`
    INSERT INTO community_contributions (id,user_id,term_slug,suggestion_type,message)
    VALUES (?1,?2,?3,?4,?5)
  `).bind(id, auth.session.user.id, termSlug || null, type, message).run();
  return json({ ok: true, id }, { status: 201 });
}

function unsubscribeTokenPayload(userId) {
  return bytesToBase64Url(new TextEncoder().encode(userId));
}

async function unsubscribeToken(env, userId) {
  const secret = clean(env.COMMUNITY_SECURITY_SECRET, 500);
  const encoded = unsubscribeTokenPayload(userId);
  const signature = await hmacHex(secret, `unsubscribe:${encoded}`);
  return `${encoded}.${signature}`;
}

async function readUnsubscribeToken(env, token) {
  const [encoded, signature, extra] = clean(token, 1000).split('.');
  if (!encoded || !signature || extra || !securityConfigured(env)) return '';
  const expected = await hmacHex(clean(env.COMMUNITY_SECURITY_SECRET, 500), `unsubscribe:${encoded}`);
  if (!constantTimeEqual(signature, expected)) return '';
  try { return new TextDecoder().decode(base64UrlToBytes(encoded)); } catch { return ''; }
}

async function unsubscribe(context) {
  if (context.request.method !== 'GET' && context.request.method !== 'POST') return methodNotAllowed(['GET','POST']);
  const dbError = requireDatabase(context); if (dbError) return dbError;
  const url = new URL(context.request.url);
  const token = url.searchParams.get('token') || '';
  const userId = await readUnsubscribeToken(context.env, token);
  if (!userId) return json({ ok: false, error: 'invalid_unsubscribe_token' }, { status: 400 });
  const current = await context.env.DB.prepare('SELECT notify_new_terms,notify_updates,locale FROM community_users WHERE id=?1 AND is_active=1').bind(userId).first();
  if (!current) return json({ ok: false, error: 'not_found' }, { status: 404 });
  await context.env.DB.prepare("UPDATE community_users SET notify_new_terms=0,notify_updates=0,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1").bind(userId).run();
  await Promise.all([
    recordConsent(context.env.DB, userId, 'notify_new_terms', false),
    recordConsent(context.env.DB, userId, 'notify_updates', false)
  ]);
  if (context.request.method === 'POST') return json({ ok: true });
  const target = current.locale === 'en' ? '/en/account/?unsubscribed=1' : '/hesabim/?unsubscribed=1';
  return Response.redirect(new URL(target, url.origin).toString(), 303);
}

export async function sendCommunityNotification(env, { kind, slug, headword, modern = '', explanation = '' }) {
  if (!env.DB || !securityConfigured(env) || !emailConfigured(env)) return { sent: 0, skipped: true };
  const field = kind === 'new-term' ? 'notify_new_terms' : 'notify_updates';
  const rows = await env.DB.prepare(`
    SELECT id,email,display_name,locale FROM community_users
    WHERE is_active=1 AND email_verified_at IS NOT NULL AND ${field}=1
    ORDER BY id LIMIT 500
  `).all();
  let sent = 0;
  for (const user of rows.results || []) {
    const tr = user.locale !== 'en';
    const path = tr ? `/terim/${encodeURIComponent(slug)}/` : `/en/term/${encodeURIComponent(slug)}/`;
    const termUrl = `https://askeriterimlersozlugu.com${path}`;
    const token = await unsubscribeToken(env, user.id);
    const unsubscribeUrl = `https://askeriterimlersozlugu.com/api/account/unsubscribe?token=${encodeURIComponent(token)}`;
    const subject = kind === 'new-term'
      ? (tr ? `Yeni sözlük maddesi: ${headword}` : `New dictionary entry: ${headword}`)
      : (tr ? `Sözlük maddesi güncellendi: ${headword}` : `Dictionary entry updated: ${headword}`);
    const intro = kind === 'new-term'
      ? (tr ? 'Takip tercihiniz doğrultusunda yeni yayımlanan bir maddeyi bildiriyoruz.' : 'A newly published entry is being sent according to your notification preference.')
      : (tr ? 'Takip tercihiniz doğrultusunda güncellenen bir maddeyi bildiriyoruz.' : 'An updated entry is being sent according to your notification preference.');
    const summary = clean(modern || explanation, 600);
    const html = `<p>${htmlEscape(intro)}</p><p><strong>${htmlEscape(headword)}</strong>${summary ? `<br>${htmlEscape(summary)}` : ''}</p><p><a href="${htmlEscape(termUrl)}">${tr ? 'Maddeyi aç' : 'Open entry'}</a></p><p style="font-size:12px"><a href="${htmlEscape(unsubscribeUrl)}">${tr ? 'Bildirimlerden ayrıl' : 'Unsubscribe from notifications'}</a></p>`;
    const text = `${intro}\n\n${headword}${summary ? `\n${summary}` : ''}\n${termUrl}\n\n${tr ? 'Bildirimlerden ayrıl' : 'Unsubscribe'}: ${unsubscribeUrl}`;
    try {
      await sendEmail(env, {
        to: user.email, subject, html, text,
        headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
      });
      sent += 1;
    } catch {}
  }
  return { sent, skipped: false };
}

export async function handleCommunityApi(context, pathname) {
  if (pathname === '/api/account/config') return config(context);
  if (pathname === '/api/account/register') return register(context);
  if (pathname === '/api/account/verify') return verifyEmail(context);
  if (pathname === '/api/account/resend-verification') return resendVerification(context);
  if (pathname === '/api/account/login') return login(context);
  if (pathname === '/api/account/session') return session(context);
  if (pathname === '/api/account/logout') return logout(context);
  if (pathname === '/api/account/profile') return profile(context);
  if (pathname === '/api/account/password') return changePassword(context);
  if (pathname === '/api/account/password-reset/request') return requestPasswordReset(context);
  if (pathname === '/api/account/password-reset/confirm') return resetPassword(context);
  if (pathname === '/api/account/favorites') return favorites(context);
  if (pathname === '/api/account/contributions') return contributions(context);
  if (pathname === '/api/account/unsubscribe') return unsubscribe(context);
  const favoriteMatch = pathname.match(/^\/api\/account\/favorites\/([^/]+)$/);
  if (favoriteMatch) return favoriteItem(context, decodeURIComponent(favoriteMatch[1]));
  return json({ ok: false, error: 'not_found', requestId: requestId(context.request) }, { status: 404 });
}
