const assert = require('assert');
const crypto = require('crypto');

process.env.SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.EDITOR_PASSWORD_HASH = crypto.createHash('sha256').update('test-password').digest('hex');
process.env.PUBLIC_SITE_ORIGIN = 'https://askeriterimlersozlugu.com';
process.env.DEPLOY_PRIME_URL = 'https://deploy-preview-2--online-askeri-terimler-sozlugu.netlify.app';

const auth = require('../netlify/functions/_auth-session');

function eventFor(origin, cookie = '', extraHeaders = {}) {
  return {
    headers: {
      origin,
      host: new URL(origin).host,
      'x-forwarded-proto': 'https',
      cookie,
      'sec-fetch-site': 'same-origin',
      ...extraHeaders
    }
  };
}

const ready = auth.readiness();
assert.strictEqual(ready.ok, true, 'Gerekli ortam değişkenleri hazır olmalı');
assert.strictEqual(auth.verifyPassword('test-password'), true, 'Doğru parola doğrulanmalı');
assert.strictEqual(auth.verifyPassword('wrong-password'), false, 'Yanlış parola reddedilmeli');

assert.strictEqual(auth.sameOrigin(eventFor('https://askeriterimlersozlugu.com')), true, 'Canlı köken kabul edilmeli');
assert.strictEqual(auth.sameOrigin(eventFor('https://deploy-preview-2--online-askeri-terimler-sozlugu.netlify.app')), true, 'Deploy Preview kökeni kabul edilmeli');
assert.strictEqual(auth.sameOrigin(eventFor('https://example.invalid')), false, 'Yabancı köken reddedilmeli');
assert.strictEqual(auth.sameOrigin(eventFor('https://askeriterimlersozlugu.com', '', { 'sec-fetch-site': 'cross-site' })), false, 'Cross-site istek reddedilmeli');

const created = auth.createSession();
const cookieHeader = auth.sessionCookie(created.token).split(';')[0];
const session = auth.verifySession(eventFor('https://askeriterimlersozlugu.com', cookieHeader));
assert(session && session.sid, 'İmzalı oturum doğrulanmalı');
assert.strictEqual(auth.verifyCsrf({ headers: { 'x-csrf-token': created.payload.csrf } }, session), true, 'Doğru CSRF kabul edilmeli');
assert.strictEqual(auth.verifyCsrf({ headers: { 'x-csrf-token': 'wrong' } }, session), false, 'Yanlış CSRF reddedilmeli');

const tampered = cookieHeader.replace(/.$/, cookieHeader.endsWith('a') ? 'b' : 'a');
assert.strictEqual(auth.verifySession(eventFor('https://askeriterimlersozlugu.com', tampered)), null, 'Değiştirilmiş oturum reddedilmeli');

console.log('Security smoke test passed.');
