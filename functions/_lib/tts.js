import { json, methodNotAllowed, requestId } from './http.js';

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_TTS_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const DEFAULT_VOICE = 'tr-TR-Chirp3-HD-Achird';
const MAX_TEXT_LENGTH = 800;
const CACHE_VERSION = 'ats-tr-tts-v1';

let accessTokenCache = { token: '', expiresAt: 0 };

function clean(value, maxLength = MAX_TEXT_LENGTH) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlText(value) {
  return base64Url(new TextEncoder().encode(value));
}

function pemToPkcs8(pem) {
  const normalized = String(pem || '').replace(/\\n/g, '\n').trim();
  const base64 = normalized
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  if (!base64) throw new Error('google_private_key_missing');
  const binary = atob(base64);
  return Uint8Array.from(binary, char => char.charCodeAt(0)).buffer;
}

async function serviceAccountAssertion(env) {
  const clientEmail = clean(env.GOOGLE_TTS_CLIENT_EMAIL, 320);
  const privateKey = String(env.GOOGLE_TTS_PRIVATE_KEY || '');
  if (!clientEmail || !privateKey) throw new Error('tts_not_configured');

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlText(JSON.stringify({
    iss: clientEmail,
    scope: GOOGLE_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

async function googleAccessToken(env) {
  const now = Date.now();
  if (accessTokenCache.token && accessTokenCache.expiresAt - 60_000 > now) return accessTokenCache.token;

  const assertion = await serviceAccountAssertion(env);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'google_oauth_failed');
  }
  accessTokenCache = {
    token: data.access_token,
    expiresAt: now + Math.max(60, Number(data.expires_in || 3600)) * 1000
  };
  return accessTokenCache.token;
}

function romanToInt(value) {
  const roman = String(value || '').toUpperCase();
  const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let index = 0; index < roman.length; index += 1) {
    const current = values[roman[index]];
    const next = values[roman[index + 1]] || 0;
    if (!current) return 0;
    total += current < next ? -current : current;
  }
  return total;
}

function intToRoman(number) {
  let value = Number(number || 0);
  if (!Number.isInteger(value) || value < 1 || value > 3999) return '';
  const pairs = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let result = '';
  for (const [amount, symbol] of pairs) {
    while (value >= amount) {
      result += symbol;
      value -= amount;
    }
  }
  return result;
}

const ONES = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const TENS = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
const ORDINAL_FORMS = new Map([
  ['bir', 'birinci'], ['iki', 'ikinci'], ['üç', 'üçüncü'], ['dört', 'dördüncü'], ['beş', 'beşinci'],
  ['altı', 'altıncı'], ['yedi', 'yedinci'], ['sekiz', 'sekizinci'], ['dokuz', 'dokuzuncu'], ['on', 'onuncu'],
  ['yirmi', 'yirminci'], ['otuz', 'otuzuncu'], ['kırk', 'kırkıncı'], ['elli', 'ellinci'], ['altmış', 'altmışıncı'],
  ['yetmiş', 'yetmişinci'], ['seksen', 'sekseninci'], ['doksan', 'doksanıncı'], ['yüz', 'yüzüncü'], ['bin', 'bininci']
]);

function numberWords(number) {
  const value = Number(number || 0);
  if (!Number.isInteger(value) || value < 1 || value > 3999) return '';
  const words = [];
  const thousands = Math.floor(value / 1000);
  const hundreds = Math.floor((value % 1000) / 100);
  const tens = Math.floor((value % 100) / 10);
  const ones = value % 10;
  if (thousands) {
    if (thousands > 1) words.push(ONES[thousands]);
    words.push('bin');
  }
  if (hundreds) {
    if (hundreds > 1) words.push(ONES[hundreds]);
    words.push('yüz');
  }
  if (tens) words.push(TENS[tens]);
  if (ones) words.push(ONES[ones]);
  return words.join(' ');
}

function ordinalWords(number) {
  const cardinal = numberWords(number);
  if (!cardinal) return '';
  const parts = cardinal.split(' ');
  const last = parts.pop();
  const ordinal = ORDINAL_FORMS.get(last);
  if (!ordinal) return cardinal;
  parts.push(ordinal);
  return parts.join(' ');
}

export function normalizeRomanOrdinals(text) {
  return String(text || '').replace(/\b([IVXLCDM]{1,12})\.(?=\s|$|[A-ZÇĞİÖŞÜ])/g, (match, roman) => {
    const number = romanToInt(roman);
    if (!number || intToRoman(number) !== roman) return match;
    return ordinalWords(number);
  });
}

function adjacentLetter(chars, index, direction) {
  for (let i = index + direction; i >= 0 && i < chars.length; i += direction) {
    if (/\p{L}/u.test(chars[i])) return chars[i].toLocaleLowerCase('tr-TR');
  }
  return '';
}

function turkishWordToIpa(word) {
  const chars = [...String(word || '').toLocaleLowerCase('tr-TR')];
  if (!chars.some(char => 'âîû'.includes(char))) return '';
  if (chars.some(char => !/[abcçdefgğhıiîjklmnoöprsştuûüvyzâ]/u.test(char))) return '';
  if (chars.includes('ğ')) return '';

  let ipa = '';
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    const previous = adjacentLetter(chars, index, -1);
    const next = adjacentLetter(chars, index, 1);
    const frontPrevious = ['e', 'i', 'î', 'ö', 'ü'].includes(previous);
    const frontNext = ['e', 'i', 'î', 'ö', 'ü'].includes(next);
    const circumflexA = next === 'â';
    switch (char) {
      case 'a': ipa += 'a'; break;
      case 'â': ipa += 'aː'; break;
      case 'e': ipa += 'e'; break;
      case 'ı': ipa += 'ɯ'; break;
      case 'i': ipa += 'i'; break;
      case 'î': ipa += 'iː'; break;
      case 'o': ipa += 'o'; break;
      case 'ö': ipa += 'ø'; break;
      case 'u': ipa += 'u'; break;
      case 'û': ipa += 'uː'; break;
      case 'ü': ipa += 'y'; break;
      case 'b': ipa += 'b'; break;
      case 'c': ipa += 'dʒ'; break;
      case 'ç': ipa += 'tʃ'; break;
      case 'd': ipa += 'd'; break;
      case 'f': ipa += 'f'; break;
      case 'g': ipa += (frontPrevious || frontNext || circumflexA) ? 'ɟ' : 'g'; break;
      case 'h': ipa += 'h'; break;
      case 'j': ipa += 'ʒ'; break;
      case 'k': ipa += (frontPrevious || frontNext || circumflexA) ? 'c' : 'k'; break;
      case 'l': ipa += (frontPrevious || frontNext || circumflexA) ? 'ʎ' : 'l'; break;
      case 'm': ipa += 'm'; break;
      case 'n': ipa += 'n'; break;
      case 'p': ipa += 'p'; break;
      case 'r': ipa += 'ɾ'; break;
      case 's': ipa += 's'; break;
      case 'ş': ipa += 'ʃ'; break;
      case 't': ipa += 't'; break;
      case 'v': ipa += 'v'; break;
      case 'y': ipa += 'j'; break;
      case 'z': ipa += 'z'; break;
      default: return '';
    }
  }
  return ipa;
}

export function pronunciationPlan(text, profile = 'modern') {
  const normalizedText = normalizeRomanOrdinals(clean(text));
  const pronunciations = [];
  const seen = new Set();
  const tokens = normalizedText.match(/[A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû]+/gu) || [];

  for (const token of tokens) {
    if (!/[âîûÂÎÛ]/u.test(token)) continue;
    const key = token.toLocaleLowerCase('tr-TR');
    if (seen.has(key)) continue;
    const ipa = turkishWordToIpa(token);
    if (!ipa) continue;
    seen.add(key);
    pronunciations.push({
      phrase: token,
      phoneticEncoding: 'PHONETIC_ENCODING_IPA',
      pronunciation: ipa
    });
  }

  return {
    text: normalizedText,
    profile: profile === 'ottoman' ? 'ottoman' : 'modern',
    pronunciations
  };
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  return Boolean(origin) && origin === new URL(request.url).origin;
}

function audioHeaders({ cache = 'MISS', profile = 'modern', voice = DEFAULT_VOICE } = {}) {
  return {
    'Content-Type': 'audio/mpeg',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'X-ATS-TTS-Cache': cache,
    'X-ATS-TTS-Profile': profile,
    'X-ATS-TTS-Voice': voice
  };
}

async function synthesizeWithGoogle(env, plan, voiceName) {
  const accessToken = await googleAccessToken(env);
  const input = { text: plan.text };
  if (plan.pronunciations.length) input.customPronunciations = { pronunciations: plan.pronunciations };

  const requestBody = {
    input,
    voice: { languageCode: 'tr-TR', name: voiceName },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: plan.profile === 'ottoman' ? 0.92 : 0.96
    }
  };

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json; charset=utf-8'
  };
  const projectId = clean(env.GOOGLE_CLOUD_PROJECT_ID, 200);
  if (projectId) headers['x-goog-user-project'] = projectId;

  const response = await fetch(GOOGLE_TTS_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.audioContent) {
    const message = data?.error?.message || data?.error?.status || `google_tts_http_${response.status}`;
    throw new Error(message);
  }
  const binary = atob(data.audioContent);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

export async function handleTtsApi(context, pathname) {
  const request = context.request;
  const id = requestId(request);

  if (pathname === '/api/tts/preview') {
    if (request.method !== 'POST') return methodNotAllowed(['POST']);
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json', requestId: id }, { status: 400 }); }
    const text = clean(body?.text);
    if (!text) return json({ ok: false, error: 'text_required', requestId: id }, { status: 400 });
    const plan = pronunciationPlan(text, body?.profile);
    return json({ ok: true, ...plan, requestId: id });
  }

  if (pathname !== '/api/tts') return json({ ok: false, error: 'not_found', requestId: id }, { status: 404 });
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  if (!sameOrigin(request)) return json({ ok: false, error: 'invalid_origin', requestId: id }, { status: 403 });

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json', requestId: id }, { status: 400 }); }
  const text = clean(body?.text);
  if (!text) return json({ ok: false, error: 'text_required', requestId: id }, { status: 400 });
  if (String(body?.text || '').length > MAX_TEXT_LENGTH) return json({ ok: false, error: 'text_too_long', requestId: id }, { status: 413 });

  const plan = pronunciationPlan(text, body?.profile);
  const voiceName = clean(context.env.GOOGLE_TTS_VOICE, 120) || DEFAULT_VOICE;
  const cacheHash = await sha256Hex(`${CACHE_VERSION}\n${voiceName}\n${plan.profile}\n${plan.text}\n${JSON.stringify(plan.pronunciations)}`);
  const cacheRequest = new Request(`https://tts-cache.askeriterimlersozlugu.com/${CACHE_VERSION}/${cacheHash}.mp3`);
  const cache = caches.default;
  const cached = await cache.match(cacheRequest);
  if (cached) {
    return new Response(cached.body, { status: 200, headers: audioHeaders({ cache: 'HIT', profile: plan.profile, voice: voiceName }) });
  }

  try {
    if (!context.env.GOOGLE_TTS_CLIENT_EMAIL || !context.env.GOOGLE_TTS_PRIVATE_KEY) {
      return json({ ok: false, error: 'tts_not_configured', requestId: id }, { status: 503 });
    }
    const audioBytes = await synthesizeWithGoogle(context.env, plan, voiceName);
    const response = new Response(audioBytes, { status: 200, headers: audioHeaders({ cache: 'MISS', profile: plan.profile, voice: voiceName }) });
    context.waitUntil(cache.put(cacheRequest, response.clone()));
    return response;
  } catch (error) {
    return json({ ok: false, error: 'tts_synthesis_failed', message: String(error?.message || error), requestId: id }, { status: 502 });
  }
}
