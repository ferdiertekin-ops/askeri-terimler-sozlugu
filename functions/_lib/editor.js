import { json, methodNotAllowed, normalizeQuery, requestId } from './http.js';

const COOKIE_NAME = 'ats_editor_session';
const SESSION_TTL_SECONDS = 4 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 8;
const loginAttempts = new Map();

function hex(buffer) {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(leftValue, rightValue) {
  const left = String(leftValue || '');
  const right = String(rightValue || '');
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function textToBase64Url(text) {
  return bytesToBase64Url(new TextEncoder().encode(text));
}

function base64UrlToText(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, character => character.charCodeAt(0)));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))));
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

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  return Boolean(origin) && origin === new URL(request.url).origin;
}

async function createSession(secret) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    csrf: crypto.randomUUID(),
    nonce: crypto.randomUUID()
  };
  const encoded = textToBase64Url(JSON.stringify(payload));
  const signature = await hmac(secret, encoded);
  return { token: `${encoded}.${signature}`, payload };
}

async function readSession(request, env) {
  const secret = String(env.SESSION_SECRET || '');
  if (secret.length < 32) return null;
  const token = cookieValue(request, COOKIE_NAME);
  const [encoded, signature, extra] = token.split('.');
  if (!encoded || !signature || extra) return null;
  const expected = await hmac(secret, encoded);
  if (!constantTimeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(base64UrlToText(encoded));
    const now = Math.floor(Date.now() / 1000);
    if (!payload || !payload.csrf || Number(payload.exp) <= now || Number(payload.iat) > now + 60) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function hasEditorSession(context) {
  return Boolean(await readSession(context.request, context.env));
}

async function authorize(context, { csrf = false } = {}) {
  const session = await readSession(context.request, context.env);
  if (!session) return { response: json({ ok: false, error: 'unauthorized' }, { status: 401 }) };
  if (csrf) {
    if (!sameOrigin(context.request)) {
      return { response: json({ ok: false, error: 'invalid_origin' }, { status: 403 }) };
    }
    const token = context.request.headers.get('X-CSRF-Token') || '';
    if (!constantTimeEqual(token, session.csrf)) {
      return { response: json({ ok: false, error: 'invalid_csrf' }, { status: 403 }) };
    }
  }
  return { session };
}

function clientKey(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

function rateLimited(request) {
  const key = clientKey(request);
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > LOGIN_LIMIT;
}

function clearAttempts(request) {
  loginAttempts.delete(clientKey(request));
}

async function passwordMatches(password, expectedHash) {
  const value = typeof password === 'string' ? password : '';
  const hash = String(expectedHash || '').toLowerCase();
  if (!value || value.length > 256 || !/^[0-9a-f]{64}$/.test(hash)) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return constantTimeEqual(hex(digest), hash);
}

async function bodyJson(request) {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 128 * 1024) throw new Error('payload_too_large');
  return request.json();
}

function clean(value, maxLength = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function slugify(value) {
  return clean(value, 180)
    .toLocaleLowerCase('en-US')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150);
}

function stringList(value, maxItems = 50) {
  const values = Array.isArray(value) ? value : String(value || '').split(/\r?\n/);
  return [...new Set(values.map(item => clean(item, 1000)).filter(Boolean))].slice(0, maxItems);
}

function normalizeSourceUrl(value) {
  const raw = clean(value, 2048);
  if (!raw) return { value: '' };
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.toString().length > 2048) {
      return { error: 'invalid_source_url' };
    }
    return { value: parsed.toString() };
  } catch {
    return { error: 'invalid_source_url' };
  }
}

function sourceList(value, maxItems = 10) {
  const values = Array.isArray(value) ? value : String(value || '').split(/\r?\n/);
  const sources = [];
  const seen = new Set();
  for (const item of values) {
    const object = item && typeof item === 'object' ? item : null;
    const citation = clean(object ? object.citation : item, 1000);
    const rawUrl = object ? object.url : '';
    if (!citation && !clean(rawUrl, 2048)) continue;
    if (!citation) return { error: 'source_citation_required' };
    const normalized = normalizeSourceUrl(rawUrl);
    if (normalized.error) return normalized;
    const key = citation.toLocaleLowerCase('tr-TR') + '\n' + normalized.value;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({ citation, url: normalized.value });
    if (sources.length >= maxItems) break;
  }
  return { value: sources };
}

function validateTerm(input, existingSlug = '') {
  const headword = clean(input?.headword_en, 300);
  if (!headword) return { error: 'headword_required' };
  const status = ['draft', 'review', 'published', 'suspended'].includes(input?.status) ? input.status : 'draft';
  const requestedSlug = clean(input?.slug, 180);
  const slug = slugify(requestedSlug || existingSlug || headword);
  if (!slug) return { error: 'invalid_slug' };
  const sources = sourceList(input?.sources);
  if (sources.error) return { error: sources.error };
  return {
    value: {
      slug,
      headword_en: headword,
      ottoman_period_term: clean(input?.ottoman_period_term, 2000),
      modern_equivalent_tr: clean(input?.modern_equivalent_tr, 2000),
      category: clean(input?.category, 200),
      explanation_tr: clean(input?.explanation_tr, 12000),
      explanation_en: clean(input?.explanation_en, 12000),
      status,
      variants: stringList(input?.variants),
      sources: sources.value
    }
  };
}

async function fullTerm(db, slug, publishedOnly = false) {
  const statusClause = publishedOnly ? " AND status = 'published'" : '';
  const term = await db.prepare(`
    SELECT id, slug, headword_en, ottoman_period_term, modern_equivalent_tr, category,
           explanation_tr, explanation_en, status, created_at, updated_at, published_at, version
    FROM terms WHERE slug = ?1${statusClause} LIMIT 1
  `).bind(slug).first();
  if (!term) return null;
  const [variants, sources] = await Promise.all([
    db.prepare('SELECT variant, variant_type, language FROM term_variants WHERE term_id = ?1 ORDER BY id').bind(term.id).all(),
    db.prepare('SELECT citation, url, source_type, page_reference, sort_order FROM term_sources WHERE term_id = ?1 ORDER BY sort_order, id').bind(term.id).all()
  ]);
  return { ...term, variants: variants.results || [], sources: sources.results || [] };
}

async function audit(db, action, entityType, entityId, id, metadata) {
  return db.prepare(`
    INSERT INTO audit_log (action, entity_type, entity_id, request_id, metadata_json)
    VALUES (?1, ?2, ?3, ?4, ?5)
  `).bind(action, entityType, String(entityId || ''), id, JSON.stringify(metadata || {})).run();
}

async function login(context) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  if (!sameOrigin(context.request)) return json({ ok: false, error: 'invalid_origin' }, { status: 403 });
  if (rateLimited(context.request)) return json({ ok: false, error: 'rate_limited' }, { status: 429 });
  let body;
  try {
    body = await bodyJson(context.request);
  } catch {
    return json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  if (!(await passwordMatches(body?.password, context.env.EDITOR_PASSWORD_HASH))) {
    return json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  clearAttempts(context.request);
  const created = await createSession(String(context.env.SESSION_SECRET || ''));
  return json({ ok: true, csrfToken: created.payload.csrf, expiresAt: new Date(created.payload.exp * 1000).toISOString() }, {
    headers: { 'Set-Cookie': secureCookie(created.token) }
  });
}

async function session(context) {
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  const current = await readSession(context.request, context.env);
  if (!current) return json({ ok: true, authenticated: false });
  return json({ ok: true, authenticated: true, csrfToken: current.csrf, expiresAt: new Date(current.exp * 1000).toISOString() });
}

async function logout(context) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  if (!sameOrigin(context.request)) return json({ ok: false, error: 'invalid_origin' }, { status: 403 });
  return json({ ok: true }, { headers: { 'Set-Cookie': clearCookie() } });
}

async function termsCollection(context) {
  if (!context.env.DB) return json({ ok: false, error: 'database_not_configured' }, { status: 503 });
  const auth = await authorize(context, { csrf: context.request.method !== 'GET' });
  if (auth.response) return auth.response;
  const id = requestId(context.request);

  if (context.request.method === 'GET') {
    const url = new URL(context.request.url);
    const q = normalizeQuery(url.searchParams.get('q'), 120);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 100);
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
    const like = `%${q}%`;
    const where = q ? 'WHERE headword_en LIKE ?1 OR ottoman_period_term LIKE ?1 OR modern_equivalent_tr LIKE ?1' : '';
    const rowsSql = `SELECT id, slug, headword_en, ottoman_period_term, modern_equivalent_tr, category, status, updated_at, version FROM terms ${where} ORDER BY headword_en COLLATE NOCASE, id LIMIT ?${q ? 2 : 1} OFFSET ?${q ? 3 : 2}`;
    const countSql = `SELECT COUNT(*) AS count FROM terms ${where}`;
    const rowsStatement = q
      ? context.env.DB.prepare(rowsSql).bind(like, limit, offset)
      : context.env.DB.prepare(rowsSql).bind(limit, offset);
    const countStatement = q
      ? context.env.DB.prepare(countSql).bind(like)
      : context.env.DB.prepare(countSql);
    const [rows, count] = await Promise.all([rowsStatement.all(), countStatement.first()]);
    return json({ ok: true, items: rows.results || [], total: Number(count?.count || 0), limit, offset, requestId: id });
  }

  if (context.request.method !== 'POST') return methodNotAllowed(['GET', 'POST']);
  let body;
  try {
    body = await bodyJson(context.request);
  } catch {
    return json({ ok: false, error: 'invalid_json', requestId: id }, { status: 400 });
  }
  const checked = validateTerm(body);
  if (checked.error) return json({ ok: false, error: checked.error, requestId: id }, { status: 400 });
  const value = checked.value;
  const exists = await context.env.DB.prepare('SELECT 1 AS found FROM terms WHERE slug = ?1').bind(value.slug).first();
  if (exists) return json({ ok: false, error: 'slug_exists', requestId: id }, { status: 409 });

  const inserted = await context.env.DB.prepare(`
    INSERT INTO terms (slug, headword_en, ottoman_period_term, modern_equivalent_tr, category, explanation_tr, explanation_en, status, published_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, CASE WHEN ?8 = 'published' THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE NULL END)
  `).bind(value.slug, value.headword_en, value.ottoman_period_term || null, value.modern_equivalent_tr || null, value.category || null, value.explanation_tr || null, value.explanation_en || null, value.status).run();
  const termId = Number(inserted.meta?.last_row_id || 0);
  const statements = [];
  value.variants.forEach(variant => statements.push(context.env.DB.prepare('INSERT INTO term_variants (term_id, variant, variant_type, language) VALUES (?1, ?2, ?3, ?4)').bind(termId, variant, 'editor', 'en')));
  value.sources.forEach((source, index) => statements.push(context.env.DB.prepare('INSERT INTO term_sources (term_id, citation, url, sort_order) VALUES (?1, ?2, ?3, ?4)').bind(termId, source.citation, source.url || null, index)));
  statements.push(context.env.DB.prepare("INSERT INTO term_revisions (term_id, revision_no, snapshot_json, change_note) VALUES (?1, 1, ?2, 'created')").bind(termId, JSON.stringify(value)));
  if (statements.length) await context.env.DB.batch(statements);
  await audit(context.env.DB, 'term_created', 'term', termId, id, { slug: value.slug, status: value.status });
  return json({ ok: true, term: await fullTerm(context.env.DB, value.slug), requestId: id }, { status: 201 });
}

async function termItem(context, slug) {
  if (!context.env.DB) return json({ ok: false, error: 'database_not_configured' }, { status: 503 });
  const auth = await authorize(context, { csrf: context.request.method !== 'GET' });
  if (auth.response) return auth.response;
  const id = requestId(context.request);
  const current = await fullTerm(context.env.DB, slug);
  if (!current) return json({ ok: false, error: 'not_found', requestId: id }, { status: 404 });
  if (context.request.method === 'GET') return json({ ok: true, term: current, requestId: id });

  if (context.request.method === 'PUT') {
    let body;
    try {
      body = await bodyJson(context.request);
    } catch {
      return json({ ok: false, error: 'invalid_json', requestId: id }, { status: 400 });
    }
    const checked = validateTerm(body, current.slug);
    if (checked.error) return json({ ok: false, error: checked.error, requestId: id }, { status: 400 });
    const value = checked.value;
    if (value.slug !== current.slug) {
      const collision = await context.env.DB.prepare('SELECT 1 AS found FROM terms WHERE slug = ?1 AND id <> ?2').bind(value.slug, current.id).first();
      if (collision) return json({ ok: false, error: 'slug_exists', requestId: id }, { status: 409 });
    }
    const nextVersion = Number(current.version || 1) + 1;
    const statements = [
      context.env.DB.prepare('INSERT OR REPLACE INTO term_revisions (term_id, revision_no, snapshot_json, change_note) VALUES (?1, ?2, ?3, ?4)').bind(current.id, Number(current.version || 1), JSON.stringify(current), clean(body?.change_note, 500) || 'updated'),
      context.env.DB.prepare(`
        UPDATE terms SET slug=?1, headword_en=?2, ottoman_period_term=?3, modern_equivalent_tr=?4,
          category=?5, explanation_tr=?6, explanation_en=?7, status=?8,
          published_at=CASE WHEN ?8='published' THEN COALESCE(published_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')) ELSE published_at END,
          updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'), version=?9
        WHERE id=?10
      `).bind(value.slug, value.headword_en, value.ottoman_period_term || null, value.modern_equivalent_tr || null, value.category || null, value.explanation_tr || null, value.explanation_en || null, value.status, nextVersion, current.id),
      context.env.DB.prepare('DELETE FROM term_variants WHERE term_id = ?1').bind(current.id),
      context.env.DB.prepare('DELETE FROM term_sources WHERE term_id = ?1').bind(current.id)
    ];
    value.variants.forEach(variant => statements.push(context.env.DB.prepare('INSERT INTO term_variants (term_id, variant, variant_type, language) VALUES (?1, ?2, ?3, ?4)').bind(current.id, variant, 'editor', 'en')));
    value.sources.forEach((source, index) => statements.push(context.env.DB.prepare('INSERT INTO term_sources (term_id, citation, url, sort_order) VALUES (?1, ?2, ?3, ?4)').bind(current.id, source.citation, source.url || null, index)));
    await context.env.DB.batch(statements);
    await audit(context.env.DB, 'term_updated', 'term', current.id, id, { fromSlug: current.slug, slug: value.slug, version: nextVersion, status: value.status });
    return json({ ok: true, term: await fullTerm(context.env.DB, value.slug), requestId: id });
  }

  if (context.request.method === 'DELETE') {
    await audit(context.env.DB, 'term_deleted', 'term', current.id, id, { snapshot: current });
    await context.env.DB.prepare('DELETE FROM terms WHERE id = ?1').bind(current.id).run();
    return json({ ok: true, deleted: current.slug, requestId: id });
  }

  return methodNotAllowed(['GET', 'PUT', 'DELETE']);
}

async function pagesCollection(context, pageKey = '') {
  if (!context.env.DB) return json({ ok: false, error: 'database_not_configured' }, { status: 503 });
  const auth = await authorize(context, { csrf: context.request.method !== 'GET' });
  if (auth.response) return auth.response;
  const id = requestId(context.request);
  if (context.request.method === 'GET') {
    if (pageKey) {
      const page = await context.env.DB.prepare('SELECT * FROM site_pages WHERE page_key = ?1').bind(pageKey).first();
      return page ? json({ ok: true, page, requestId: id }) : json({ ok: false, error: 'not_found', requestId: id }, { status: 404 });
    }
    const rows = await context.env.DB.prepare('SELECT page_key, title_tr, title_en, updated_at FROM site_pages ORDER BY page_key').all();
    return json({ ok: true, items: rows.results || [], requestId: id });
  }
  if (!pageKey || context.request.method !== 'PUT') return methodNotAllowed(pageKey ? ['GET', 'PUT'] : ['GET']);
  let body;
  try {
    body = await bodyJson(context.request);
  } catch {
    return json({ ok: false, error: 'invalid_json', requestId: id }, { status: 400 });
  }
  const page = {
    title_tr: clean(body?.title_tr, 500),
    title_en: clean(body?.title_en, 500),
    body_tr: clean(body?.body_tr, 100000),
    body_en: clean(body?.body_en, 100000)
  };
  await context.env.DB.prepare(`
    INSERT INTO site_pages (page_key, title_tr, title_en, body_tr, body_en, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT(page_key) DO UPDATE SET title_tr=excluded.title_tr, title_en=excluded.title_en,
      body_tr=excluded.body_tr, body_en=excluded.body_en, updated_at=excluded.updated_at
  `).bind(pageKey, page.title_tr, page.title_en, page.body_tr, page.body_en).run();
  await audit(context.env.DB, 'page_updated', 'page', pageKey, id, { titles: [page.title_tr, page.title_en] });
  return json({ ok: true, pageKey, requestId: id });
}

export async function handleEditorApi(context, pathname) {
  if (pathname === '/api/editor/login') return login(context);
  if (pathname === '/api/editor/session') return session(context);
  if (pathname === '/api/editor/logout') return logout(context);
  if (pathname === '/api/editor/terms') return termsCollection(context);
  const termMatch = pathname.match(/^\/api\/editor\/terms\/([^/]+)$/);
  if (termMatch) return termItem(context, decodeURIComponent(termMatch[1]));
  if (pathname === '/api/editor/pages') return pagesCollection(context);
  const pageMatch = pathname.match(/^\/api\/editor\/pages\/([^/]+)$/);
  if (pageMatch) return pagesCollection(context, decodeURIComponent(pageMatch[1]));
  return json({ ok: false, error: 'not_found' }, { status: 404 });
}
