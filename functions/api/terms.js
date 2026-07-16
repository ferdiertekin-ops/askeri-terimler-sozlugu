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
    const where = q ? `
      status = 'published'
      AND (headword_en LIKE ?1 COLLATE NOCASE
        OR ottoman_period_term LIKE ?1 COLLATE NOCASE
        OR modern_equivalent_tr LIKE ?1 COLLATE NOCASE
        OR category LIKE ?1 COLLATE NOCASE
        OR EXISTS (
          SELECT 1 FROM term_variants v
          WHERE v.term_id = terms.id AND v.variant LIKE ?1 COLLATE NOCASE
        ))
    ` : `status = 'published'`;

    let rowsStatement;
    let countStatement;
    if (q) {
      const pattern = `%${q}%`;
      rowsStatement = context.env.DB.prepare(`
        SELECT id, slug, headword_en, ottoman_period_term, modern_equivalent_tr, category,
               explanation_tr, explanation_en, updated_at, version
        FROM terms
        WHERE ${where}
        ORDER BY headword_en COLLATE NOCASE, id
        LIMIT ?2 OFFSET ?3
      `).bind(pattern, limit, offset);
      countStatement = context.env.DB.prepare(`
        SELECT COUNT(*) AS count FROM terms WHERE ${where}
      `).bind(pattern);
    } else {
      rowsStatement = context.env.DB.prepare(`
        SELECT id, slug, headword_en, ottoman_period_term, modern_equivalent_tr, category,
               explanation_tr, explanation_en, updated_at, version
        FROM terms
        WHERE ${where}
        ORDER BY headword_en COLLATE NOCASE, id
        LIMIT ?1 OFFSET ?2
      `).bind(limit, offset);
      countStatement = context.env.DB.prepare(`
        SELECT COUNT(*) AS count FROM terms WHERE ${where}
      `);
    }

    const [rows, countRow] = await Promise.all([rowsStatement.all(), countStatement.first()]);
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
