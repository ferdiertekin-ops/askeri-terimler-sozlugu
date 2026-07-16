import { json, methodNotAllowed, requestId } from '../../_lib/http.js';

export async function onRequest(context) {
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  if (!context.env.DB) return json({ ok: false, error: 'database_not_configured' }, { status: 503 });

  const slug = String(context.params.slug || '').trim().slice(0, 180);
  const id = requestId(context.request);
  if (!slug) return json({ ok: false, error: 'missing_slug', requestId: id }, { status: 400 });

  try {
    const term = await context.env.DB.prepare(`
      SELECT id, slug, headword_en, ottoman_period_term, modern_tr, category,
             explanation_tr, explanation_en, confidence, updated_at, published_at, version
      FROM terms
      WHERE slug = ?1 AND status = 'published'
      LIMIT 1
    `).bind(slug).first();

    if (!term) return json({ ok: false, error: 'not_found', requestId: id }, { status: 404 });

    const [variants, sources] = await Promise.all([
      context.env.DB.prepare(`
        SELECT variant, variant_type, language
        FROM term_variants
        WHERE term_id = ?1
        ORDER BY id
      `).bind(term.id).all(),
      context.env.DB.prepare(`
        SELECT citation, url, source_type, page_reference
        FROM term_sources
        WHERE term_id = ?1
        ORDER BY sort_order, id
      `).bind(term.id).all()
    ]);

    return json({
      ok: true,
      term: {
        ...term,
        variants: variants.results || [],
        sources: sources.results || []
      },
      requestId: id
    });
  } catch (error) {
    return json({ ok: false, error: 'query_failed', requestId: id }, { status: 500 });
  }
}
