import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const jsFiles = [
  'functions/_lib/community.js',
  'functions/_lib/tts.js',
  'functions/_middleware.js',
  'functions/api/tts.js',
  'functions/api/tts/preview.js',
  'assets/community-nav.js',
  'assets/community-dictionary.js',
  'assets/community-account.js',
  'assets/ats-tr-tts.js'
];
const htmlFiles = [
  'uye-ol/index.html',
  'oturum-ac/index.html',
  'hesabim/index.html',
  'parola-yenile/index.html',
  'uyelik-aydinlatma/index.html',
  'en/sign-up/index.html',
  'en/sign-in/index.html',
  'en/account/index.html',
  'en/reset-password/index.html',
  'en/membership-notice/index.html',
  'editor-community-private.html'
];

function fail(message) {
  console.error(`community-check: ${message}`);
  process.exitCode = 1;
}

function runNodeCheck(file) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    fail(`JavaScript syntax error in ${file}\n${result.stderr || result.stdout}`);
  }
}

for (const file of jsFiles) {
  if (!fs.existsSync(path.join(root, file))) fail(`Missing ${file}`);
  else runNodeCheck(file);
}

for (const file of htmlFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    fail(`Missing ${file}`);
    continue;
  }
  const html = fs.readFileSync(fullPath, 'utf8');
  if (!/<meta\s+name=["']robots["'][^>]*noindex/i.test(html)) fail(`${file} must be noindex`);
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicates.length) fail(`${file} has duplicate ids: ${duplicates.join(', ')}`);

  let inlineIndex = 0;
  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    const source = match[1].trim();
    if (!source) continue;
    const tempFile = path.join(os.tmpdir(), `ats-community-${path.basename(path.dirname(fullPath)) || 'root'}-${inlineIndex++}.js`);
    fs.writeFileSync(tempFile, source);
    runNodeCheck(tempFile);
    fs.rmSync(tempFile, { force: true });
  }
}

const middleware = fs.readFileSync(path.join(root, 'functions/_middleware.js'), 'utf8');
for (const required of [
  "path.startsWith('/api/account/')",
  "'/editor/community/'",
  'sendCommunityNotification',
  'communityRenderedResponse',
  'COMMUNITY_FEATURE_ENABLED',
  'TTS_FEATURE_ENABLED',
  '/assets/ats-tr-tts.js',
  'stripBrandName',
  'preview-title__main'
]) {
  if (!middleware.includes(required)) fail(`Middleware is missing required integration: ${required}`);
}

const community = fs.readFileSync(path.join(root, 'functions/_lib/community.js'), 'utf8');
for (const required of [
  'TURNSTILE_SECRET_KEY',
  'COMMUNITY_SECURITY_SECRET',
  'CF_EMAIL_API_TOKEN',
  'ats_member_session',
  'PBKDF2',
  'List-Unsubscribe',
  '/api/account/register',
  '/api/account/favorites',
  '/api/account/contributions'
]) {
  if (!community.includes(required)) fail(`Community API is missing expected control: ${required}`);
}

const tts = fs.readFileSync(path.join(root, 'functions/_lib/tts.js'), 'utf8');
for (const required of [
  'tr-TR-Chirp3-HD-Achird',
  'GOOGLE_TTS_CLIENT_EMAIL',
  'GOOGLE_TTS_PRIVATE_KEY',
  'normalizeRomanOrdinals',
  'PHONETIC_ENCODING_IPA',
  "pathname === '/api/tts/preview'",
  "pathname !== '/api/tts'"
]) {
  if (!tts.includes(required)) fail(`TTS API is missing expected control: ${required}`);
}

const headers = fs.readFileSync(path.join(root, '_headers'), 'utf8');
const cspLine = headers.split(/\r?\n/).find(line => line.includes('Content-Security-Policy:')) || '';
if (!/script-src[^;]*https:\/\/challenges\.cloudflare\.com/.test(cspLine)) {
  fail('CSP script-src must allow https://challenges.cloudflare.com for Turnstile.');
}
if (!/frame-src[^;]*https:\/\/challenges\.cloudflare\.com/.test(cspLine)) {
  fail('CSP frame-src must allow https://challenges.cloudflare.com for Turnstile.');
}

const registration = fs.readFileSync(path.join(root, 'uye-ol/index.html'), 'utf8');
if (!registration.includes('Sözlük herkesindir')) fail('Turkish registration page must state the open-access principle.');
if (/gizlilik[^<]{0,80}(kabul|onay)/i.test(registration)) fail('Registration must not force consent to the privacy notice.');

const englishRegistration = fs.readFileSync(path.join(root, 'en/sign-up/index.html'), 'utf8');
if (!englishRegistration.includes('dictionary is a public resource')) fail('English registration page must state the open-access principle.');

if (!process.exitCode) console.log('community-check: all static checks passed');
