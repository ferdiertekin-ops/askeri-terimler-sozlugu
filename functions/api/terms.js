import { json, methodNotAllowed, normalizeQuery, requestId } from '../_lib/http.js';

function normalizeSearch(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export async function onRequest(context) {
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  if (!context.env.DB) return json({ ok: false, error: 'database_not_configured' }, { status: 503 });

  const url = new URL(context.request.url);
  const q = normalizeQuery(url.searchParams.get('q'));
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 100);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
  const id = requestId(context.request);

  try {
    if (q) {
      const allRows = await context.env.DB.prepare(`
        SELECT t.id, t.slug, t.headword_en, t.ottoman_period_term, t.modern_equivalent_tr,
               t.category, t.explanation_tr, t.explanation_en, t.updated_at, t.version,
               COALESCE(GROUP_CONCAT(v.variant, ' '), '') AS variants_search
        FROM terms t
        LEFT JOIN term_variants v ON v.term_id = t.id
        WHERE t.status = 'published'
        GROUP BY t.id
        ORDER BY t.headword_en COLLATE NOCASE, t.id
      `).all();

      const needle = normalizeSearch(q);
      const matches = (allRows.results || []).filter(row => normalizeSearch([
        row.headword_en,
        row.ottoman_period_term,
        row.modern_equivalent_tr,
        row.category,
        row.variants_search
      ].filter(Boolean).join(' ')).includes(needle));

      const total = matches.length;
      const items = matches.slice(offset, offset + limit).map(({ variants_search, ...row }) => row);
      return json({
        ok: true,
        items,
        total,
        limit,
        offset,
        hasPrevious: offset > 0,
        hasNext: offset + limit < total,
        query: q,
        normalizedQuery: needle,
        requestId: id
      });
    }

    const [rows, countRow] = await Promise.all([
      context.env.DB.prepare(`
        SELECT id, slug, headword_en, ottoman_period_term, modern_equivalent_tr, category,
               explanation_tr, explanation_en, updated_at, version
        FROM terms
        WHERE status = 'published'
        ORDER BY headword_en COLLATE NOCASE, id
        LIMIT ?1 OFFSET ?2
      `).bind(limit, offset).all(),
      context.env.DB.prepare(`
        SELECT COUNT(*) AS count FROM terms WHERE status = 'published'
      `).first()
    ]);

    const total = Number(countRow?.count || 0);
    return json({
      ok: true,
      items: rows.results || [],
      total,
      limit,
      offset,
      hasPrevious: offset > 0,
      hasNext: offset + limit < total,
      query: q,
      requestId: id
    });
  } catch (error) {
    return json({ ok: false, error: 'query_failed', requestId: id }, { status: 500 });
  }
}
