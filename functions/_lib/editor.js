import { json, methodNotAllowed, normalizeQuery, requestId } from './http.js';
import { editablePageDefinition, listEditablePages, loadEditablePage } from './editable-pages.js';
import { buildMigrationDataset, fetchMigrationSnapshot } from './migration-data.js';
import { termLetter } from './term-letter.js';
import {
  ADMIRALTY_1920_EXCLUDED,
  ADMIRALTY_1920_MATCH_SLUGS,
  ADMIRALTY_1920_TERMS
} from './admiralty-1920-terms.js';

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
  return { ...term, letter: termLetter(term.headword_en), variants: variants.results || [], sources: sources.results || [] };
}

function savedTermMatches(saved, value, expectedVersion) {
  if (!saved || Number(saved.version) !== Number(expectedVersion)) return false;
  const same = (left, right) => String(left ?? '') === String(right ?? '');
  if (!same(saved.slug, value.slug) || !same(saved.headword_en, value.headword_en) ||
      !same(saved.ottoman_period_term, value.ottoman_period_term) ||
      !same(saved.modern_equivalent_tr, value.modern_equivalent_tr) ||
      !same(saved.category, value.category) || !same(saved.explanation_tr, value.explanation_tr) ||
      !same(saved.explanation_en, value.explanation_en) || !same(saved.status, value.status)) return false;
  const variants = (saved.variants || []).map(item => String(item.variant || ''));
  if (JSON.stringify(variants) !== JSON.stringify(value.variants)) return false;
  const sources = (saved.sources || []).map(item => ({
    citation: String(item.citation || ''),
    url: String(item.url || '')
  }));
  return JSON.stringify(sources) === JSON.stringify(value.sources);
}

async function termCounts(db) {
  const row = await db.prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
           SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft,
           SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END) AS review,
           SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended
    FROM terms
  `).first();
  return {
    total: Number(row?.total || 0),
    published: Number(row?.published || 0),
    draft: Number(row?.draft || 0),
    review: Number(row?.review || 0),
    suspended: Number(row?.suspended || 0)
  };
}

async function audit(db, action, entityType, entityId, id, metadata) {
  return db.prepare(`
    INSERT INTO audit_log (action, entity_type, entity_id, request_id, metadata_json)
    VALUES (?1, ?2, ?3, ?4, ?5)
  `).bind(action, entityType, String(entityId || ''), id, JSON.stringify(metadata || {})).run();
}

function bibliographyFingerprint(value) {
  return clean(value, 1000)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/\b(?:s|sf|sayfa)\.?\s*\d+(?:\s*[–—-]\s*\d+)?\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function sameBibliographySource(left, right) {
  const a = bibliographyFingerprint(left);
  const b = bibliographyFingerprint(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

async function runBatches(db, statements, size = 25) {
  for (let index = 0; index < statements.length; index += size) {
    await db.batch(statements.slice(index, index + size));
  }
}

async function bibliographySync(context) {
  if (!context.env.DB) return json({ ok: false, error: 'database_not_configured' }, { status: 503 });
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  const auth = await authorize(context, { csrf: true });
  if (auth.response) return auth.response;
  const id = requestId(context.request);

  let body;
  try {
    body = await bodyJson(context.request);
  } catch {
    return json({ ok: false, error: 'invalid_json', requestId: id }, { status: 400 });
  }
  const action = String(body?.action || 'audit');
  if (action !== 'audit') {
    return json({
      ok: false,
      error: 'd1_authoritative',
      message: 'The saved D1 dataset is authoritative; migration repair writes are locked.',
      requestId: id
    }, { status: 409 });
  }

  try {
    const snapshot = await fetchMigrationSnapshot();
    const dataset = buildMigrationDataset(snapshot);
    const [termRows, sourceRows] = await Promise.all([
      context.env.DB.prepare('SELECT id, slug FROM terms').all(),
      context.env.DB.prepare('SELECT id, term_id, citation, url, sort_order FROM term_sources ORDER BY term_id, sort_order, id').all()
    ]);

    const termsBySlug = new Map((termRows.results || []).map(term => [term.slug, term]));
    const sourcesByTerm = new Map();
    for (const source of sourceRows.results || []) {
      const list = sourcesByTerm.get(source.term_id) || [];
      list.push(source);
      sourcesByTerm.set(source.term_id, list);
    }

    const removals = [];
    for (const candidate of dataset.bibliographyRepair.removeCandidates) {
      const term = termsBySlug.get(candidate.slug);
      if (!term) continue;
      const currentSources = sourcesByTerm.get(term.id) || [];
      for (const citation of candidate.citations) {
        for (const source of currentSources) {
          if (source.citation === citation && !source.url) {
            removals.push({ id: source.id, termId: term.id, slug: candidate.slug, citation });
          }
        }
      }
    }

    const additions = [];
    const linkUpdates = [];
    const missingTermSlugs = [];
    const missingRecords = [];
    for (const record of dataset.records) {
      const term = termsBySlug.get(record.slug);
      if (!term) {
        missingTermSlugs.push(record.slug);
        missingRecords.push(record);
        continue;
      }
      const currentSources = sourcesByTerm.get(term.id) || [];
      for (const expected of record.sources) {
        const matching = currentSources.find(source => sameBibliographySource(source.citation, expected.citation));
        if (!matching) {
          additions.push({ termId: term.id, slug: record.slug, citation: expected.citation, url: expected.url || null });
        } else if (expected.url && !matching.url) {
          linkUpdates.push({ id: matching.id, termId: term.id, slug: record.slug, citation: matching.citation, url: expected.url });
        }
      }
    }

    const summary = {
      sourceRows: dataset.sourceRowCount,
      sourceTerms: dataset.termCount,
      databaseTerms: (termRows.results || []).length,
      databaseSources: (sourceRows.results || []).length,
      invalidSourcesToRemove: removals.length,
      missingSourcesToAdd: additions.length,
      sourceLinksToActivate: linkUpdates.length,
      sourceTermsMissingFromDatabase: missingTermSlugs.length,
      expectedDatabaseSourcesAfterRepair: (sourceRows.results || []).length - removals.length + additions.length
    };

    if (action === 'audit') {
      return json({
        ok: true,
        action,
        writePerformed: false,
        summary,
        removalSamples: removals.slice(0, 12).map(item => ({ slug: item.slug, citation: item.citation })),
        additionSamples: additions.slice(0, 12).map(item => ({ slug: item.slug, citation: item.citation })),
        linkSamples: linkUpdates.slice(0, 12).map(item => ({ slug: item.slug, citation: item.citation, url: item.url })),
        missingTermSamples: missingTermSlugs.slice(0, 20),
        requestId: id
      });
    }

    if (action === 'apply_missing_terms') {
      const termStatements = missingRecords.map(record => context.env.DB.prepare(`
        INSERT INTO terms (
          slug, headword_en, ottoman_period_term, modern_equivalent_tr,
          category, explanation_tr, explanation_en, status, published_at, version
        )
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
          CASE WHEN ?8 = 'published' THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE NULL END,
          1
        WHERE NOT EXISTS (SELECT 1 FROM terms WHERE slug = ?1)
      `).bind(
        record.slug,
        record.headword_en,
        record.ottoman_period_term || null,
        record.modern_equivalent_tr || null,
        record.category || null,
        record.explanation_tr || null,
        record.explanation_en || null,
        record.status
      ));
      if (termStatements.length) await runBatches(context.env.DB, termStatements);

      const refreshedTerms = await context.env.DB.prepare('SELECT id, slug FROM terms').all();
      const refreshedBySlug = new Map((refreshedTerms.results || []).map(term => [term.slug, term]));
      const childStatements = [];
      let variantCount = 0;
      let sourceCount = 0;
      for (const record of missingRecords) {
        const term = refreshedBySlug.get(record.slug);
        if (!term) continue;
        for (const variant of record.variants) {
          childStatements.push(context.env.DB.prepare(`
            INSERT INTO term_variants (term_id, variant, variant_type, language)
            SELECT ?1, ?2, 'source_variant', 'en'
            WHERE NOT EXISTS (
              SELECT 1 FROM term_variants WHERE term_id = ?1 AND variant = ?2
            )
          `).bind(term.id, variant.variant));
          variantCount += 1;
        }
        for (const source of record.sources) {
          childStatements.push(context.env.DB.prepare(`
            INSERT INTO term_sources (term_id, citation, url, source_type, sort_order)
            SELECT ?1, ?2, ?3, 'migration-sync', ?4
            WHERE NOT EXISTS (
              SELECT 1 FROM term_sources WHERE term_id = ?1 AND citation = ?2
            )
          `).bind(term.id, source.citation, source.url || null, source.sortOrder));
          sourceCount += 1;
        }
      }
      if (childStatements.length) await runBatches(context.env.DB, childStatements);
      await audit(context.env.DB, 'missing_terms_synchronized', 'dataset', 'cloudflare-d1', id, {
        terms: missingRecords.length,
        variants: variantCount,
        sources: sourceCount,
        sourceRows: dataset.sourceRowCount
      });
      return json({
        ok: true,
        action,
        writePerformed: termStatements.length > 0,
        applied: { terms: missingRecords.length, variants: variantCount, sources: sourceCount },
        summary,
        requestId: id
      });
    }

    const removalIds = new Set(removals.map(item => item.id));
    const nextSortOrder = new Map();
    for (const [termId, currentSources] of sourcesByTerm) {
      const kept = currentSources.filter(source => !removalIds.has(source.id));
      nextSortOrder.set(termId, kept.reduce((max, source) => Math.max(max, Number(source.sort_order) || 0), -1) + 1);
    }

    const statements = removals.map(item =>
      context.env.DB.prepare('DELETE FROM term_sources WHERE id = ?1 AND term_id = ?2 AND (url IS NULL OR url = \'\')')
        .bind(item.id, item.termId)
    );
    for (const item of linkUpdates) {
      statements.push(context.env.DB.prepare(`
        UPDATE term_sources SET url = ?1, source_type = COALESCE(source_type, 'migration-repair')
        WHERE id = ?2 AND term_id = ?3 AND (url IS NULL OR url = '')
      `).bind(item.url, item.id, item.termId));
    }
    for (const item of additions) {
      const sortOrder = nextSortOrder.get(item.termId) || 0;
      nextSortOrder.set(item.termId, sortOrder + 1);
      statements.push(context.env.DB.prepare(`
        INSERT INTO term_sources (term_id, citation, url, source_type, sort_order)
        SELECT ?1, ?2, ?3, 'migration-repair', ?4
        WHERE NOT EXISTS (
          SELECT 1 FROM term_sources WHERE term_id = ?1 AND citation = ?2
        )
      `).bind(item.termId, item.citation, item.url || null, sortOrder));
    }
    if (statements.length) await runBatches(context.env.DB, statements);
    await audit(context.env.DB, 'bibliography_reconciled', 'dataset', 'cloudflare-d1', id, {
      removed: removals.length,
      added: additions.length,
      linked: linkUpdates.length,
      missingTerms: missingTermSlugs.length,
      sourceRows: dataset.sourceRowCount
    });

    return json({
      ok: true,
      action,
      writePerformed: statements.length > 0,
      applied: { removed: removals.length, added: additions.length, linked: linkUpdates.length },
      summary,
      missingTermSamples: missingTermSlugs.slice(0, 20),
      requestId: id
    });
  } catch (error) {
    return json({ ok: false, error: 'bibliography_sync_failed', message: String(error?.message || error), requestId: id }, { status: 500 });
  }
}

function importIdentity(value, { removeParenthetical = false } = {}) {
  let text = String(value || '').toLocaleLowerCase('en-US').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  if (removeParenthetical) text = text.replace(/\([^)]*\)/g, ' ');
  return text.replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function mergeImportedValue(currentValue, importedValue) {
  const current = clean(currentValue, 2000);
  const imported = clean(importedValue, 2000);
  if (!imported) return current;
  if (!current) return imported;
  const normalizedCurrent = importIdentity(current);
  const normalizedImported = importIdentity(imported);
  if (normalizedCurrent === normalizedImported || normalizedCurrent.includes(normalizedImported)) return current;
  return `${current}; ${imported}`.slice(0, 2000);
}

function admiraltyLegacyExplanation(record) {
  return `1920 tarihli Admiralty sözlüğünde “${record.headword}” terimi için “${record.legacyPeriod}” karşılığı verilmiştir. Düzeltilmiş Türkçe yazılışı: “${record.legacyModern}”.`;
}

function admiraltyMergeCorrectedValue(baseValue, correctedValue) {
  const kept = clean(baseValue, 2000)
    .split(';')
    .map(value => value.trim())
    .filter(Boolean);
  const seen = new Set(kept.map(importIdentity));
  for (const value of clean(correctedValue, 2000).split(';').map(item => item.trim()).filter(Boolean)) {
    const identity = importIdentity(value);
    const contained = kept.some(existing => {
      const existingIdentity = importIdentity(existing);
      return existingIdentity === identity || existingIdentity.includes(identity) || identity.includes(existingIdentity);
    });
    if (!identity || contained || seen.has(identity)) continue;
    kept.push(value);
    seen.add(identity);
  }
  return kept.join('; ').slice(0, 2000);
}

function admiraltyRepairField(currentValue, legacyValues, correctedValue) {
  const current = clean(currentValue, 2000);
  const legacy = [...new Set((Array.isArray(legacyValues) ? legacyValues : [legacyValues])
    .map(value => clean(value, 2000))
    .filter(Boolean))];
  const corrected = clean(correctedValue, 2000);
  if (current === corrected) return { value: current, state: 'already-correct' };
  if (!current && corrected) return { value: corrected, state: 'filled-empty' };
  if (legacy.includes(current)) return { value: corrected, state: 'replaced-exact' };
  const currentIdentity = importIdentity(current);
  if (currentIdentity && (currentIdentity === importIdentity(corrected) ||
      legacy.some(value => currentIdentity === importIdentity(value)))) {
    return { value: corrected, state: 'replaced-normalized-equivalent' };
  }

  for (const legacyValue of legacy.sort((left, right) => right.length - left.length)) {
    const suffix = `; ${legacyValue}`;
    if (current.endsWith(suffix)) {
      const base = current.slice(0, -suffix.length).trim();
      return {
        value: admiraltyMergeCorrectedValue(base, corrected),
        state: 'replaced-imported-suffix'
      };
    }
  }

  return { value: current, state: 'protected-current-value' };
}

function admiraltyRepairPlan(plan) {
  return plan.existing.map(item => {
    const { record, term, sources } = item;
    const period = admiraltyRepairField(term.ottoman_period_term, [record.legacyPeriod, record.legacyModern], record.period);
    const modern = admiraltyRepairField(term.modern_equivalent_tr, record.legacyModern, record.modern);
    const legacyExplanation = admiraltyLegacyExplanation(record);
    const explanationWasGenerated = clean(term.explanation_tr, 10000) === legacyExplanation;
    const explanation = explanationWasGenerated ? '' : clean(term.explanation_tr, 10000);
    const sourceExists = sources.some(source => source.citation === record.citation ||
      (sameBibliographySource(source.citation, record.citation) && String(source.page_reference || '') === String(record.page)));
    const changed = period.value !== String(term.ottoman_period_term || '') ||
      modern.value !== String(term.modern_equivalent_tr || '') ||
      explanation !== String(term.explanation_tr || '');
    return {
      record,
      term,
      period,
      modern,
      explanation,
      explanationWasGenerated,
      sourceExists,
      sources,
      changed
    };
  });
}

function admiraltyImportPlan(termRows, variantRows, sourceRows) {
  const terms = termRows || [];
  const bySlug = new Map(terms.map(term => [term.slug, term]));
  const exact = new Map();
  const base = new Map();
  const variantsByTerm = new Map();
  const variantExact = new Map();
  const variantBase = new Map();
  const sourcesByTerm = new Map();

  const addIndex = (map, key, term) => {
    if (!key) return;
    const list = map.get(key) || [];
    if (!list.some(item => Number(item.id) === Number(term.id))) list.push(term);
    map.set(key, list);
  };
  for (const term of terms) {
    addIndex(exact, importIdentity(term.headword_en), term);
    addIndex(base, importIdentity(term.headword_en, { removeParenthetical: true }), term);
  }
  for (const variant of variantRows || []) {
    const term = terms.find(item => Number(item.id) === Number(variant.term_id));
    if (!term) continue;
    const list = variantsByTerm.get(term.id) || [];
    list.push(variant);
    variantsByTerm.set(term.id, list);
    addIndex(variantExact, importIdentity(variant.variant), term);
    addIndex(variantBase, importIdentity(variant.variant, { removeParenthetical: true }), term);
  }
  for (const source of sourceRows || []) {
    const list = sourcesByTerm.get(source.term_id) || [];
    list.push(source);
    sourcesByTerm.set(source.term_id, list);
  }

  const existing = [];
  const missing = [];
  const ambiguous = [];
  for (const record of ADMIRALTY_1920_TERMS) {
    const explicitSlug = ADMIRALTY_1920_MATCH_SLUGS[record.headword];
    if (explicitSlug) {
      const term = bySlug.get(explicitSlug);
      if (term) {
        existing.push({ record, term, variants: variantsByTerm.get(term.id) || [], sources: sourcesByTerm.get(term.id) || [], matchedBy: 'explicit-slug' });
        continue;
      }
    }

    const labels = [record.headword, ...(record.aliases || [])];
    const candidateMap = new Map();
    const collect = map => {
      for (const label of labels) {
        for (const term of map.get(label) || []) candidateMap.set(term.id, term);
      }
    };
    collect(new Map(labels.map(label => [label, exact.get(importIdentity(label)) || []])));
    collect(new Map(labels.map(label => [label, variantExact.get(importIdentity(label)) || []])));
    if (!candidateMap.size) {
      collect(new Map(labels.map(label => [label, base.get(importIdentity(label, { removeParenthetical: true })) || []])));
      collect(new Map(labels.map(label => [label, variantBase.get(importIdentity(label, { removeParenthetical: true })) || []])));
    }
    const candidates = [...candidateMap.values()];
    if (candidates.length === 1) {
      const term = candidates[0];
      existing.push({ record, term, variants: variantsByTerm.get(term.id) || [], sources: sourcesByTerm.get(term.id) || [], matchedBy: 'normalized' });
    } else if (candidates.length > 1) {
      ambiguous.push({ record, candidates: candidates.map(term => ({ id: term.id, slug: term.slug, headword: term.headword_en })) });
    } else {
      const slug = slugify(record.headword);
      if (bySlug.has(slug)) {
        const term = bySlug.get(slug);
        existing.push({ record, term, variants: variantsByTerm.get(term.id) || [], sources: sourcesByTerm.get(term.id) || [], matchedBy: 'generated-slug' });
      } else {
        missing.push({ record, slug });
      }
    }
  }
  return { existing, missing, ambiguous };
}

async function admiralty1920Import(context) {
  if (!context.env.DB) return json({ ok: false, error: 'database_not_configured' }, { status: 503 });
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  const auth = await authorize(context, { csrf: true });
  if (auth.response) return auth.response;
  const id = requestId(context.request);
  let body;
  try {
    body = await bodyJson(context.request);
  } catch {
    return json({ ok: false, error: 'invalid_json', requestId: id }, { status: 400 });
  }
  const action = String(body?.action || 'audit');
  if (!['audit', 'apply', 'repair-audit', 'repair-apply'].includes(action)) return json({ ok: false, error: 'invalid_action', requestId: id }, { status: 400 });

  try {
    const [termsResult, variantsResult, sourcesResult, countsBefore] = await Promise.all([
      context.env.DB.prepare(`
        SELECT id, slug, headword_en, ottoman_period_term, modern_equivalent_tr, category,
               explanation_tr, explanation_en, status, version, updated_at
        FROM terms ORDER BY id
      `).all(),
      context.env.DB.prepare('SELECT id, term_id, variant FROM term_variants ORDER BY id').all(),
      context.env.DB.prepare('SELECT id, term_id, citation, url, page_reference, sort_order FROM term_sources ORDER BY term_id, sort_order, id').all(),
      termCounts(context.env.DB)
    ]);
    const plan = admiraltyImportPlan(termsResult.results || [], variantsResult.results || [], sourcesResult.results || []);
    if (action === 'repair-audit' || action === 'repair-apply') {
      const repairItems = admiraltyRepairPlan(plan);
      const changedItems = repairItems.filter(item => item.changed);
      const repairSummary = {
        acceptedSourceTerms: ADMIRALTY_1920_TERMS.length,
        matchedTerms: plan.existing.length,
        missingTerms: plan.missing.length,
        ambiguousSkipped: plan.ambiguous.length,
        termsToChange: changedItems.length,
        periodFieldsToChange: changedItems.filter(item => item.period.value !== String(item.term.ottoman_period_term || '')).length,
        modernFieldsToChange: changedItems.filter(item => item.modern.value !== String(item.term.modern_equivalent_tr || '')).length,
        generatedExplanationsToRemove: changedItems.filter(item => item.explanationWasGenerated).length,
        sourcesToAdd: repairItems.filter(item => !item.sourceExists).length,
        protectedPeriodFields: repairItems.filter(item => item.period.state === 'protected-current-value').length,
        protectedModernFields: repairItems.filter(item => item.modern.state === 'protected-current-value').length
      };
      const details = repairItems.map(item => ({
        headword: item.record.headword,
        slug: item.term.slug,
        page: item.record.page,
        changed: item.changed,
        period: {
          before: item.term.ottoman_period_term || '',
          after: item.period.value,
          state: item.period.state
        },
        modern: {
          before: item.term.modern_equivalent_tr || '',
          after: item.modern.value,
          state: item.modern.state
        },
        explanation: item.explanationWasGenerated ? 'remove-generated' : 'preserve',
        source: item.sourceExists ? 'preserve' : 'add'
      }));

      if (action === 'repair-audit') {
        return json({
          ok: true,
          action,
          writePerformed: false,
          summary: repairSummary,
          changes: details.filter(item => item.changed),
          protected: details.filter(item => item.period.state === 'protected-current-value' || item.modern.state === 'protected-current-value'),
          requestId: id
        });
      }

      const statements = changedItems.map(item => context.env.DB.prepare(`
        UPDATE terms SET ottoman_period_term=?1, modern_equivalent_tr=?2, explanation_tr=?3,
          status='published', published_at=COALESCE(published_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'), version=COALESCE(version,1)+1
        WHERE id=?4
          AND COALESCE(ottoman_period_term,'')=?5
          AND COALESCE(modern_equivalent_tr,'')=?6
          AND COALESCE(explanation_tr,'')=?7
      `).bind(
        item.period.value || null,
        item.modern.value || null,
        item.explanation || null,
        item.term.id,
        String(item.term.ottoman_period_term || ''),
        String(item.term.modern_equivalent_tr || ''),
        String(item.term.explanation_tr || '')
      ));
      for (const item of repairItems.filter(repairItem => !repairItem.sourceExists)) {
        const sortOrder = item.sources.reduce((max, source) => Math.max(max, Number(source.sort_order) || 0), -1) + 1;
        statements.push(context.env.DB.prepare(`
          INSERT INTO term_sources (term_id, citation, url, source_type, page_reference, sort_order)
          SELECT ?1, ?2, ?3, 'admiralty-1920', ?4, ?5
          WHERE NOT EXISTS (SELECT 1 FROM term_sources WHERE term_id=?1 AND citation=?2)
        `).bind(item.term.id, item.record.citation, 'https://archive.org/details/vocabulariesengl00grearich', String(item.record.page), sortOrder));
      }
      if (statements.length) await runBatches(context.env.DB, statements);

      const verifyRows = await context.env.DB.prepare(`
        SELECT id, slug, ottoman_period_term, modern_equivalent_tr, explanation_tr
        FROM terms ORDER BY id
      `).all();
      const verifiedById = new Map((verifyRows.results || []).map(term => [Number(term.id), term]));
      const conflicts = [];
      let verifiedChanges = 0;
      for (const item of changedItems) {
        const saved = verifiedById.get(Number(item.term.id));
        if (saved && String(saved.ottoman_period_term || '') === item.period.value &&
            String(saved.modern_equivalent_tr || '') === item.modern.value &&
            String(saved.explanation_tr || '') === item.explanation) {
          verifiedChanges += 1;
        } else {
          conflicts.push({ headword: item.record.headword, slug: item.term.slug, reason: 'concurrent-or-manual-edit-protected' });
        }
      }
      const verifiedSourcesResult = await context.env.DB.prepare(`
        SELECT term_id, citation FROM term_sources
        WHERE citation LIKE ?1
      `).bind('Great Britain, Admiralty, Naval Staff, Naval Intelligence Division, Geographical Section, Vocabularies:%').all();
      const verifiedSourceKeys = new Set((verifiedSourcesResult.results || []).map(source => `${source.term_id}\n${source.citation}`));
      const verifiedSources = repairItems.filter(item => verifiedSourceKeys.has(`${item.term.id}\n${item.record.citation}`)).length;
      await audit(context.env.DB, 'admiralty_1920_presentation_repaired', 'dataset', 'admiralty-1920', id, {
        ...repairSummary,
        verifiedChanges,
        verifiedSources,
        conflicts: conflicts.length
      });
      return json({
        ok: true,
        action,
        writePerformed: verifiedChanges > 0 || repairSummary.sourcesToAdd > 0,
        summary: { ...repairSummary, verifiedChanges, verifiedSources, conflicts: conflicts.length },
        changed: details.filter(item => item.changed),
        conflicts,
        requestId: id
      });
    }

    const summary = {
      acceptedSourceTerms: ADMIRALTY_1920_TERMS.length,
      excludedAsUnreliable: ADMIRALTY_1920_EXCLUDED.length,
      existingMatches: plan.existing.length,
      newTerms: plan.missing.length,
      ambiguousSkipped: plan.ambiguous.length,
      unpublishedBefore: countsBefore.total - countsBefore.published,
      countsBefore
    };
    if (action === 'audit') {
      return json({
        ok: true,
        action,
        writePerformed: false,
        summary,
        newTerms: plan.missing.map(item => ({ headword: item.record.headword, slug: item.slug, page: item.record.page })),
        existingTerms: plan.existing.map(item => ({ headword: item.record.headword, matchedHeadword: item.term.headword_en, slug: item.term.slug, page: item.record.page, matchedBy: item.matchedBy })),
        ambiguous: plan.ambiguous.map(item => ({ headword: item.record.headword, page: item.record.page, candidates: item.candidates })),
        excluded: ADMIRALTY_1920_EXCLUDED,
        requestId: id
      });
    }

    const statements = [];
    const enriched = [];
    const sourceOnly = [];
    const unchanged = [];
    for (const item of plan.existing) {
      const { record, term, variants, sources } = item;
      const period = mergeImportedValue(term.ottoman_period_term, record.period);
      const modern = mergeImportedValue(term.modern_equivalent_tr, record.modern);
      const category = term.category || record.category;
      const fieldsChanged = period !== String(term.ottoman_period_term || '') || modern !== String(term.modern_equivalent_tr || '') || category !== String(term.category || '') || term.status !== 'published';
      const sourceExists = sources.some(source => source.citation === record.citation || (sameBibliographySource(source.citation, record.citation) && String(source.page_reference || '') === String(record.page)));
      const existingVariants = new Set(variants.map(variant => importIdentity(variant.variant)));
      const aliases = (record.aliases || []).filter(alias => !existingVariants.has(importIdentity(alias)));
      if (fieldsChanged) {
        statements.push(context.env.DB.prepare(`
          UPDATE terms SET ottoman_period_term=?1, modern_equivalent_tr=?2, category=?3,
            status='published', published_at=COALESCE(published_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'), version=COALESCE(version,1)+1
          WHERE id=?4
        `).bind(period || null, modern || null, category || null, term.id));
      } else if (!sourceExists || aliases.length) {
        statements.push(context.env.DB.prepare("UPDATE terms SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?1").bind(term.id));
      }
      if (!sourceExists) {
        const sortOrder = sources.reduce((max, source) => Math.max(max, Number(source.sort_order) || 0), -1) + 1;
        statements.push(context.env.DB.prepare(`
          INSERT INTO term_sources (term_id, citation, url, source_type, page_reference, sort_order)
          SELECT ?1, ?2, ?3, 'admiralty-1920', ?4, ?5
          WHERE NOT EXISTS (SELECT 1 FROM term_sources WHERE term_id=?1 AND citation=?2)
        `).bind(term.id, record.citation, 'https://archive.org/details/vocabulariesengl00grearich', String(record.page), sortOrder));
      }
      for (const alias of aliases) {
        statements.push(context.env.DB.prepare(`
          INSERT INTO term_variants (term_id, variant, variant_type, language)
          SELECT ?1, ?2, 'source_variant', 'en'
          WHERE NOT EXISTS (SELECT 1 FROM term_variants WHERE term_id=?1 AND variant=?2)
        `).bind(term.id, alias));
      }
      const reportItem = { headword: record.headword, slug: term.slug, page: record.page, sourceAdded: !sourceExists };
      if (fieldsChanged) enriched.push(reportItem);
      else if (!sourceExists || aliases.length) sourceOnly.push(reportItem);
      else unchanged.push(reportItem);
    }

    for (const item of plan.missing) {
      const { record, slug } = item;
      statements.push(context.env.DB.prepare(`
        INSERT INTO terms (slug, headword_en, ottoman_period_term, modern_equivalent_tr, category,
          explanation_tr, explanation_en, status, published_at, version)
        SELECT ?1, ?2, ?3, ?4, ?5, NULL, NULL, 'published', strftime('%Y-%m-%dT%H:%M:%fZ','now'), 1
        WHERE NOT EXISTS (SELECT 1 FROM terms WHERE slug=?1)
      `).bind(slug, record.headword, record.period, record.modern, record.category));
    }
    if (statements.length) await runBatches(context.env.DB, statements);

    if (plan.missing.length) {
      const insertedRows = await context.env.DB.prepare('SELECT id, slug FROM terms').all();
      const insertedBySlug = new Map((insertedRows.results || []).map(term => [term.slug, term]));
      const children = [];
      for (const item of plan.missing) {
        const term = insertedBySlug.get(item.slug);
        if (!term) continue;
        children.push(context.env.DB.prepare(`
          INSERT INTO term_sources (term_id, citation, url, source_type, page_reference, sort_order)
          SELECT ?1, ?2, ?3, 'admiralty-1920', ?4, 0
          WHERE NOT EXISTS (SELECT 1 FROM term_sources WHERE term_id=?1 AND citation=?2)
        `).bind(term.id, item.record.citation, 'https://archive.org/details/vocabulariesengl00grearich', String(item.record.page)));
        for (const alias of item.record.aliases || []) {
          children.push(context.env.DB.prepare(`
            INSERT INTO term_variants (term_id, variant, variant_type, language)
            SELECT ?1, ?2, 'source_variant', 'en'
            WHERE NOT EXISTS (SELECT 1 FROM term_variants WHERE term_id=?1 AND variant=?2)
          `).bind(term.id, alias));
        }
      }
      if (children.length) await runBatches(context.env.DB, children);
    }

    const publishResult = await context.env.DB.prepare(`
      UPDATE terms SET status='published',
        published_at=COALESCE(published_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'), version=COALESCE(version,1)+1
      WHERE status <> 'published'
    `).run();
    const countsAfter = await termCounts(context.env.DB);
    await audit(context.env.DB, 'admiralty_1920_imported', 'dataset', 'admiralty-1920', id, {
      newTerms: plan.missing.length,
      enriched: enriched.length,
      sourceOnly: sourceOnly.length,
      unchanged: unchanged.length,
      ambiguousSkipped: plan.ambiguous.length,
      excluded: ADMIRALTY_1920_EXCLUDED.length,
      publishedExisting: Number(publishResult.meta?.changes || 0),
      countsBefore,
      countsAfter
    });
    return json({
      ok: true,
      action,
      writePerformed: true,
      summary: {
        ...summary,
        added: plan.missing.length,
        enriched: enriched.length,
        sourceOnly: sourceOnly.length,
        unchanged: unchanged.length,
        publishedExisting: Number(publishResult.meta?.changes || 0),
        countsAfter
      },
      added: plan.missing.map(item => ({ headword: item.record.headword, slug: item.slug, page: item.record.page })),
      enriched,
      sourceOnly,
      unchanged,
      ambiguous: plan.ambiguous.map(item => ({ headword: item.record.headword, page: item.record.page, candidates: item.candidates })),
      excluded: ADMIRALTY_1920_EXCLUDED,
      requestId: id
    });
  } catch (error) {
    return json({ ok: false, error: 'admiralty_import_failed', message: String(error?.message || error), requestId: id }, { status: 500 });
  }
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
    const [rows, filteredCount, counts] = await Promise.all([
      rowsStatement.all(),
      countStatement.first(),
      termCounts(context.env.DB)
    ]);
    return json({
      ok: true,
      items: (rows.results || []).map(term => ({ ...term, letter: termLetter(term.headword_en) })),
      total: counts.total,
      filteredTotal: Number(filteredCount?.count || 0),
      counts,
      limit,
      offset,
      requestId: id
    });
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
  statements.push(context.env.DB.prepare("INSERT INTO term_revisions (term_id, revision_no, snapshot_json, change_note) VALUES (?1, 1, ?2, 'created')").bind(termId, JSON.stringify({ ...value, id: termId, version: 1 })));
  statements.push(context.env.DB.prepare(`
    INSERT INTO audit_log (action, entity_type, entity_id, request_id, metadata_json)
    VALUES ('term_created', 'term', ?1, ?2, ?3)
  `).bind(String(termId), id, JSON.stringify({ slug: value.slug, status: value.status })));
  if (statements.length) await context.env.DB.batch(statements);
  const saved = await fullTerm(context.env.DB, value.slug);
  if (!savedTermMatches(saved, value, 1)) {
    return json({ ok: false, error: 'save_verification_failed', requestId: id }, { status: 500 });
  }
  return json({ ok: true, term: saved, counts: await termCounts(context.env.DB), requestId: id }, { status: 201 });
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
    const expectedVersion = Number(body?.expected_version || 0);
    if (expectedVersion && expectedVersion !== Number(current.version || 1)) {
      return json({
        ok: false,
        error: 'version_conflict',
        currentVersion: Number(current.version || 1),
        currentUpdatedAt: current.updated_at,
        requestId: id
      }, { status: 409 });
    }
    const checked = validateTerm(body, current.slug);
    if (checked.error) return json({ ok: false, error: checked.error, requestId: id }, { status: 400 });
    const value = checked.value;
    if (value.slug !== current.slug) {
      const collision = await context.env.DB.prepare('SELECT 1 AS found FROM terms WHERE slug = ?1 AND id <> ?2').bind(value.slug, current.id).first();
      if (collision) return json({ ok: false, error: 'slug_exists', requestId: id }, { status: 409 });
    }
    const nextVersion = Number(current.version || 1) + 1;
    const changeNote = clean(body?.change_note, 500) || 'updated';
    const nextSnapshot = { ...value, id: current.id, version: nextVersion };
    const statements = [
      context.env.DB.prepare('INSERT OR IGNORE INTO term_revisions (term_id, revision_no, snapshot_json, change_note) VALUES (?1, ?2, ?3, ?4)').bind(current.id, Number(current.version || 1), JSON.stringify(current), 'snapshot_before_update'),
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
    statements.push(context.env.DB.prepare('INSERT OR REPLACE INTO term_revisions (term_id, revision_no, snapshot_json, change_note) VALUES (?1, ?2, ?3, ?4)').bind(current.id, nextVersion, JSON.stringify(nextSnapshot), changeNote));
    statements.push(context.env.DB.prepare(`
      INSERT INTO audit_log (action, entity_type, entity_id, request_id, metadata_json)
      VALUES ('term_updated', 'term', ?1, ?2, ?3)
    `).bind(String(current.id), id, JSON.stringify({ fromSlug: current.slug, slug: value.slug, version: nextVersion, status: value.status })));
    await context.env.DB.batch(statements);
    const saved = await fullTerm(context.env.DB, value.slug);
    if (!savedTermMatches(saved, value, nextVersion)) {
      return json({ ok: false, error: 'save_verification_failed', expectedVersion: nextVersion, requestId: id }, { status: 500 });
    }
    return json({ ok: true, term: saved, counts: await termCounts(context.env.DB), requestId: id });
  }

  if (context.request.method === 'DELETE') {
    const auditMetadata = JSON.stringify({ snapshot: current });
    await context.env.DB.batch([
      context.env.DB.prepare(`
        INSERT INTO audit_log (action, entity_type, entity_id, request_id, metadata_json)
        VALUES ('term_deleted', 'term', ?1, ?2, ?3)
      `).bind(String(current.id), id, auditMetadata),
      context.env.DB.prepare('DELETE FROM term_sources WHERE term_id = ?1').bind(current.id),
      context.env.DB.prepare('DELETE FROM term_variants WHERE term_id = ?1').bind(current.id),
      context.env.DB.prepare('DELETE FROM term_revisions WHERE term_id = ?1').bind(current.id),
      context.env.DB.prepare('DELETE FROM terms WHERE id = ?1').bind(current.id)
    ]);
    const remaining = await context.env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM terms WHERE id = ?1) AS terms,
        (SELECT COUNT(*) FROM term_sources WHERE term_id = ?1) AS sources,
        (SELECT COUNT(*) FROM term_variants WHERE term_id = ?1) AS variants,
        (SELECT COUNT(*) FROM term_revisions WHERE term_id = ?1) AS revisions
    `).bind(current.id).first();
    const leftovers = Object.values(remaining || {}).reduce((sum, value) => sum + Number(value || 0), 0);
    if (leftovers) {
      return json({ ok: false, error: 'delete_verification_failed', remaining, requestId: id }, { status: 500 });
    }
    return json({
      ok: true,
      deleted: current.slug,
      removed: { terms: 1, sources: current.sources.length, variants: current.variants.length, revisions: 'all' },
      counts: await termCounts(context.env.DB),
      requestId: id
    });
  }

  return methodNotAllowed(['GET', 'PUT', 'DELETE']);
}

async function sourceSuggestions(context) {
  if (!context.env.DB) return json({ ok: false, error: 'database_not_configured' }, { status: 503 });
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  const auth = await authorize(context);
  if (auth.response) return auth.response;
  const id = requestId(context.request);
  const url = new URL(context.request.url);
  const q = normalizeQuery(url.searchParams.get('q'), 120);
  const escaped = q.replace(/[\\%_]/g, value => '\\' + value);
  const prefix = escaped + '%';
  const rows = await context.env.DB.prepare(`
    SELECT citation, MAX(COALESCE(url, '')) AS url, COUNT(*) AS usage_count
    FROM term_sources
    WHERE citation LIKE ?1 ESCAPE '\\'
    GROUP BY citation
    ORDER BY CASE WHEN citation = ?2 THEN 0 ELSE 1 END,
             usage_count DESC, citation COLLATE NOCASE
    LIMIT 24
  `).bind(prefix, q).all();
  return json({
    ok: true,
    items: (rows.results || []).map(row => ({
      citation: row.citation,
      url: row.url || '',
      usageCount: Number(row.usage_count || 0)
    })),
    query: q,
    requestId: id
  });
}

async function pagesCollection(context, pageKey = '') {
  if (!context.env.DB) return json({ ok: false, error: 'database_not_configured' }, { status: 503 });
  const auth = await authorize(context, { csrf: context.request.method !== 'GET' });
  if (auth.response) return auth.response;
  const id = requestId(context.request);

  if (context.request.method === 'GET') {
    if (pageKey) {
      const page = await loadEditablePage(context.env.DB, pageKey);
      return page
        ? json({ ok: true, page, requestId: id })
        : json({ ok: false, error: 'not_found', requestId: id }, { status: 404 });
    }
    const pages = await listEditablePages(context.env.DB);
    return json({
      ok: true,
      items: pages.map(page => ({
        key: page.key,
        labelTr: page.labelTr,
        labelEn: page.labelEn,
        persisted: page.persisted,
        updatedAt: page.updatedAt
      })),
      requestId: id
    });
  }

  const definition = editablePageDefinition(pageKey);
  if (!definition || context.request.method !== 'PUT') {
    return methodNotAllowed(definition ? ['GET', 'PUT'] : ['GET']);
  }
  let body;
  try {
    body = await bodyJson(context.request);
  } catch {
    return json({ ok: false, error: 'invalid_json', requestId: id }, { status: 400 });
  }
  const currentPage = await loadEditablePage(context.env.DB, pageKey);
  if (Object.prototype.hasOwnProperty.call(body || {}, 'expectedUpdatedAt')) {
    const expectedUpdatedAt = body?.expectedUpdatedAt || null;
    if (Boolean(currentPage?.persisted) !== Boolean(expectedUpdatedAt) ||
        (currentPage?.persisted && currentPage.updatedAt !== expectedUpdatedAt)) {
      return json({
        ok: false,
        error: 'version_conflict',
        currentUpdatedAt: currentPage?.updatedAt || null,
        requestId: id
      }, { status: 409 });
    }
  }
  const page = {
    title_tr: clean(body?.titleTr, 500),
    title_en: clean(body?.titleEn, 500),
    body_tr: clean(body?.bodyTr, 100000),
    body_en: clean(body?.bodyEn, 100000)
  };
  await context.env.DB.batch([
    context.env.DB.prepare(`
      INSERT INTO site_pages (page_key, title_tr, title_en, body_tr, body_en, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      ON CONFLICT(page_key) DO UPDATE SET title_tr=excluded.title_tr, title_en=excluded.title_en,
        body_tr=excluded.body_tr, body_en=excluded.body_en, updated_at=excluded.updated_at
    `).bind(pageKey, page.title_tr, page.title_en, page.body_tr, page.body_en),
    context.env.DB.prepare(`
      INSERT INTO audit_log (action, entity_type, entity_id, request_id, metadata_json)
      VALUES ('page_updated', 'page', ?1, ?2, ?3)
    `).bind(pageKey, id, JSON.stringify({ titles: [page.title_tr, page.title_en] }))
  ]);
  return json({ ok: true, page: await loadEditablePage(context.env.DB, pageKey), requestId: id });
}

export async function handleEditorApi(context, pathname) {
  if (pathname === '/api/editor/login') return login(context);
  if (pathname === '/api/editor/session') return session(context);
  if (pathname === '/api/editor/logout') return logout(context);
  if (pathname === '/api/editor/terms') return termsCollection(context);
  if (pathname === '/api/editor/source-suggestions') return sourceSuggestions(context);
  if (pathname === '/api/editor/bibliography-sync') return bibliographySync(context);
  if (pathname === '/api/editor/admiralty-1920-import') return admiralty1920Import(context);
  const termMatch = pathname.match(/^\/api\/editor\/terms\/([^/]+)$/);
  if (termMatch) return termItem(context, decodeURIComponent(termMatch[1]));
  if (pathname === '/api/editor/pages') return pagesCollection(context);
  const pageMatch = pathname.match(/^\/api\/editor\/pages\/([^/]+)$/);
  if (pageMatch) return pagesCollection(context, decodeURIComponent(pageMatch[1]));
  return json({ ok: false, error: 'not_found' }, { status: 404 });
}
