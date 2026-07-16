import { json, methodNotAllowed, normalizeQuery, requestId } from '../_lib/http.js';

export async function onRequest(context) {
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  if (!context.env.DB) return json({ ok: false, error: 'database_not_configured' }, { status: 503 });

  const url = new URL(context.request.url);
  const q = normalizeQuery(url.searchParams.get('q'));
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 100);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
  const id = requestId(context.request);

  try {
    let statement;
    if (q) {
      const pattern = `%${q}%`;
      statement = context.env.DB.prepare(`
        SELECT id, slug, headword_en, ottoman_period_term, modern_tr, category,
               explanation_tr, explanation_en, updated_at, version
        FROM terms
        WHERE status = 'published'
          AND (headword_en LIKE ?1 COLLATE NOCASE
            OR ottoman_period_term LIKE ?1 COLLATE NOCASE
            OR modern_tr LIKE ?1 COLLATE NOCASE
            OR EXISTS (
              SELECT 1 FROM term_variants v
              WHERE v.term_id = terms.id AND v.variant LIKE ?1 COLLATE NOCASE
            ))
        ORDER BY headword_en COLLATE NOCASE
        LIMIT ?2 OFFSET ?3
      `).bind(pattern, limit, offset);
    } else {
      statement = context.env.DB.prepare(`
        SELECT id, slug, headword_en, ottoman_period_term, modern_tr, category,
               explanation_tr, explanation_en, updated_at, version
        FROM terms
        WHERE status = 'published'
        ORDER BY headword_en COLLATE NOCASE
        LIMIT ?1 OFFSET ?2
      `).bind(limit, offset);
    }

    const result = await statement.all();
    return json({ ok: true, items: result.results || [], limit, offset, query: q, requestId: id });
  } catch (error) {
    return json({ ok: false, error: 'query_failed', requestId: id }, { status: 500 });
  }
}
