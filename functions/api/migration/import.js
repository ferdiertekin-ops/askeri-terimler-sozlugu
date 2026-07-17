import { json, methodNotAllowed, requestId } from '../../_lib/http.js';
import { buildMigrationDataset, fetchMigrationSnapshot } from '../../_lib/migration-data.js';

const MAX_STATEMENTS_PER_BATCH = 8;
const EXPECTED_SOURCE_ROWS = 1234;
const EXPECTED_TERMS = 1232;
const ALLOWED_HOST = 'askeri-terimler-sozlugu-preview.pages.dev';
const DATASET_CACHE_URL = `https://${ALLOWED_HOST}/__internal/migration-dataset-v3.json`;

function hex(buffer) {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a, b) {
  const left = String(a || '').toLowerCase();
  const right = String(b || '').toLowerCase();
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

async function authenticate(context, body) {
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!password || password.length > 256) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return constantTimeEqual(hex(digest), context.env.EDITOR_PASSWORD_HASH);
}

function previewAllowed(context) {
  const url = new URL(context.request.url);
  const origin = context.request.headers.get('Origin');
  const branch = String(context.env.CF_PAGES_BRANCH || '');
  return url.hostname === ALLOWED_HOST && origin === url.origin && branch !== 'main';
}

async function databaseCounts(db) {
  const [terms, variants, sources] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS count FROM terms').first(),
    db.prepare('SELECT COUNT(*) AS count FROM term_variants').first(),
    db.prepare('SELECT COUNT(*) AS count FROM term_sources').first()
  ]);
  return {
    terms: Number(terms?.count || 0),
    variants: Number(variants?.count || 0),
    sources: Number(sources?.count || 0)
  };
}

async function schemaCheck(db) {
  const result = await db.prepare('PRAGMA table_info(terms)').all();
  const names = (result.results || []).map(row => row.name);
  return {
    hasCanonicalColumn: names.includes('modern_equivalent_tr'),
    hasLegacyColumn: names.includes('modern_tr'),
    hasConfidence: names.includes('confidence'),
    columns: names
  };
}

function statusesMatch(actual, expected) {
  const keys = new Set([...Object.keys(actual || {}), ...Object.keys(expected || {})]);
  return [...keys].every(key => Number(actual?.[key] || 0) === Number(expected?.[key] || 0));
}

async function getDataset() {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const cacheKey = new Request(DATASET_CACHE_URL, { method: 'GET' });
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return { dataset: await hit.json(), cache: 'hit' };
  }

  const snapshot = await fetchMigrationSnapshot();
  const dataset = buildMigrationDataset(snapshot);
  if (cache) {
    const response = new Response(JSON.stringify(dataset), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=86400'
      }
    });
    await cache.put(cacheKey, response);
  }
  return { dataset, cache: 'miss' };
}

function statementsForRecord(db, record) {
  const statements = [
    db.prepare(`
      INSERT OR IGNORE INTO terms (
        id, slug, headword_en, ottoman_period_term, modern_equivalent_tr,
        category, explanation_tr, explanation_en, status, published_at, version
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
        CASE WHEN ?9 = 'published' THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE NULL END,
        1
      )
    `).bind(
      record.id,
      record.slug,
      record.headword_en,
      record.ottoman_period_term || null,
      record.modern_equivalent_tr || null,
      record.category || null,
      record.explanation_tr || null,
      record.explanation_en || null,
      record.status
    )
  ];

  for (const item of record.variants) {
    statements.push(db.prepare(`
      INSERT OR IGNORE INTO term_variants (id, term_id, variant, variant_type, language)
      VALUES (?1, ?2, ?3, 'source_variant', 'en')
    `).bind(item.id, record.id, item.variant));
  }

  for (const item of record.sources) {
    statements.push(db.prepare(`
      INSERT OR IGNORE INTO term_sources (id, term_id, citation, sort_order)
      VALUES (?1, ?2, ?3, ?4)
    `).bind(item.id, record.id, item.citation, item.sortOrder));
  }
  return statements;
}

function buildChunk(db, records, cursor) {
  const statements = [];
  let nextCursor = cursor;
  while (nextCursor < records.length) {
    const candidate = statementsForRecord(db, records[nextCursor]);
    if (statements.length > 0 && statements.length + candidate.length > MAX_STATEMENTS_PER_BATCH) break;
    if (candidate.length > MAX_STATEMENTS_PER_BATCH) {
      throw new Error(`record_statement_limit:${records[nextCursor].slug}:${candidate.length}`);
    }
    statements.push(...candidate);
    nextCursor += 1;
  }
  return { statements, nextCursor };
}

export async function onRequest(context) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  const id = requestId(context.request);
  if (!context.env.DB) return json({ ok: false, error: 'database_not_configured', requestId: id }, { status: 503 });
  if (!previewAllowed(context)) return json({ ok: false, error: 'preview_only', requestId: id }, { status: 403 });

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json', requestId: id }, { status: 400 });
  }

  if (!(await authenticate(context, body))) {
    return json({ ok: false, error: 'unauthorized', requestId: id }, { status: 401 });
  }

  const action = String(body.action || 'preflight');

  try {
    if (action === 'status') {
      const counts = await databaseCounts(context.env.DB);
      const prepared = await getDataset();
      const dataset = prepared.dataset;
      const datasetOk = dataset.sourceRowCount === EXPECTED_SOURCE_ROWS && dataset.termCount === EXPECTED_TERMS;
      const nextCursor = Math.max(0, Math.min(counts.terms, EXPECTED_TERMS));
      return json({
        ok: datasetOk,
        action,
        currentCounts: counts,
        nextCursor,
        complete: counts.terms === EXPECTED_TERMS,
        datasetPrepared: datasetOk,
        datasetCache: prepared.cache,
        plannedCounts: {
          terms: dataset.termCount,
          variants: dataset.variantCount,
          sources: dataset.sourceCount
        },
        requestId: id
      }, { status: datasetOk ? 200 : 409 });
    }

    const prepared = await getDataset();
    const dataset = prepared.dataset;
    const invariantChecks = {
      sourceRows: dataset.sourceRowCount === EXPECTED_SOURCE_ROWS,
      transformedTerms: dataset.termCount === EXPECTED_TERMS
    };
    if (!Object.values(invariantChecks).every(Boolean)) {
      return json({ ok: false, error: 'invariant_failed', invariantChecks, requestId: id }, { status: 409 });
    }

    if (action === 'preflight') {
      const [schema, before] = await Promise.all([
        schemaCheck(context.env.DB),
        databaseCounts(context.env.DB)
      ]);
      Object.assign(invariantChecks, {
        canonicalColumn: schema.hasCanonicalColumn,
        legacyColumnRemoved: !schema.hasLegacyColumn,
        confidenceRemoved: !schema.hasConfidence
      });
      const invariantsOk = Object.values(invariantChecks).every(Boolean);
      const databaseEmpty = before.terms === 0 && before.variants === 0 && before.sources === 0;
      return json({
        ok: invariantsOk && databaseEmpty,
        action,
        writePerformed: false,
        invariantChecks,
        databaseEmpty,
        currentCounts: before,
        datasetCache: prepared.cache,
        plannedCounts: {
          sourceRows: dataset.sourceRowCount,
          terms: dataset.termCount,
          variants: dataset.variantCount,
          sources: dataset.sourceCount,
          statuses: dataset.statusCounts
        },
        collisionPolicy: dataset.collisionPolicy,
        requestId: id
      }, { status: invariantsOk && databaseEmpty ? 200 : 409 });
    }

    if (action === 'import') {
      const requestedCursor = Math.max(0, Math.min(Number(body.cursor) || 0, dataset.records.length));
      const existing = await context.env.DB.prepare('SELECT COUNT(*) AS count FROM terms').first();
      const existingTerms = Number(existing?.count || 0);
      if (requestedCursor > existingTerms) {
        return json({ ok: false, error: 'cursor_ahead_of_database', requestedCursor, existingTerms, requestId: id }, { status: 409 });
      }

      const safeCursor = existingTerms;
      const { statements, nextCursor } = buildChunk(context.env.DB, dataset.records, safeCursor);
      if (statements.length === 0 && safeCursor < dataset.records.length) {
        return json({ ok: false, error: 'empty_chunk', cursor: safeCursor, requestId: id }, { status: 500 });
      }
      if (statements.length) await context.env.DB.batch(statements);

      return json({
        ok: true,
        action,
        cursor: safeCursor,
        nextCursor,
        complete: nextCursor >= dataset.records.length,
        processedTerms: nextCursor - safeCursor,
        executedStatements: statements.length,
        datasetCache: prepared.cache,
        expectedFinalCounts: {
          terms: dataset.termCount,
          variants: dataset.variantCount,
          sources: dataset.sourceCount
        },
        requestId: id
      });
    }

    if (action === 'verify') {
      const counts = await databaseCounts(context.env.DB);
      const statusRows = await context.env.DB.prepare('SELECT status, COUNT(*) AS count FROM terms GROUP BY status').all();
      const actualStatuses = Object.fromEntries((statusRows.results || []).map(row => [row.status, Number(row.count)]));
      const countChecks = {
        terms: counts.terms === dataset.termCount,
        variants: counts.variants === dataset.variantCount,
        sources: counts.sources === dataset.sourceCount,
        statuses: statusesMatch(actualStatuses, dataset.statusCounts)
      };
      const sampleSlugs = ['artillery-artilleryman', 'gun-cotton', 'captain-naval', 'captain-army', 'lieutenant-naval', 'lieutenant-army'];
      const placeholders = sampleSlugs.map((_, index) => `?${index + 1}`).join(',');
      const samples = await context.env.DB.prepare(`
        SELECT slug, headword_en, ottoman_period_term, modern_equivalent_tr, category, status
        FROM terms WHERE slug IN (${placeholders}) ORDER BY slug
      `).bind(...sampleSlugs).all();
      const samplesOk = (samples.results || []).length === sampleSlugs.length;
      const ok = Object.values(countChecks).every(Boolean) && samplesOk;

      if (ok) {
        await context.env.DB.prepare(`
          INSERT INTO audit_log (action, entity_type, entity_id, request_id, metadata_json)
          VALUES ('migration_verified', 'dataset', 'cloudflare-d1-v1', ?1, ?2)
        `).bind(id, JSON.stringify({ counts, statuses: actualStatuses, collisionPolicy: dataset.collisionPolicy })).run();
      }

      return json({
        ok,
        action,
        writePerformed: ok,
        counts,
        expectedCounts: { terms: dataset.termCount, variants: dataset.variantCount, sources: dataset.sourceCount },
        countChecks,
        actualStatuses,
        expectedStatuses: dataset.statusCounts,
        samplesOk,
        samples: samples.results || [],
        datasetCache: prepared.cache,
        requestId: id
      }, { status: ok ? 200 : 409 });
    }

    return json({ ok: false, error: 'unknown_action', requestId: id }, { status: 400 });
  } catch (error) {
    return json({ ok: false, error: 'migration_failed', message: String(error?.message || error), requestId: id }, { status: 500 });
  }
}
