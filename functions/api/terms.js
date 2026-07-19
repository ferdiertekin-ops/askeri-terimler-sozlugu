import { json, methodNotAllowed, normalizeQuery, requestId } from '../_lib/http.js';
import { termLetter } from '../_lib/term-letter.js';

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

function fieldScore(value, needle, weight) {
  const text = normalizeSearch(value);
  if (!text || !needle) return 0;
  if (text === needle) return 1000 + weight;
  const wholePhrase = text.startsWith(needle + ' ') || text.endsWith(' ' + needle) || text.includes(' ' + needle + ' ');
  if (wholePhrase) return 800 + weight - Math.min(text.split(' ').length, 40);
  if (text.startsWith(needle)) return 600 + weight;
  if (text.includes(needle)) return 300 + weight;
  return 0;
}

function searchScore(row, needle) {
  return Math.max(
    fieldScore(row.headword_en, needle, 80),
    fieldScore(row.ottoman_period_term, needle, 70),
    fieldScore(row.modern_equivalent_tr, needle, 60),
    fieldScore(row.variants_search, needle, 40),
    fieldScore(row.category, needle, 10)
  );
}

export async function onRequest(context) {
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  if (!context.env.DB) return json({ ok: false, error: 'database_not_configured' }, { status: 503 });

  const url = new URL(context.request.url);
  const q = normalizeQuery(url.searchParams.get('q'));
  const requestedLetter = String(url.searchParams.get('letter') || '').trim().toUpperCase();
  const letter = /^[A-Z]$/.test(requestedLetter) ? requestedLetter : '';
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
      const matches = (allRows.results || [])
        .filter(row => !letter || termLetter(row.headword_en) === letter)
        .map(row => ({ ...row, search_score: searchScore(row, needle) }))
        .filter(row => row.search_score > 0)
        .sort((left, right) => right.search_score - left.search_score || Number(left.id) - Number(right.id));

      const total = matches.length;
      const items = matches.slice(offset, offset + limit).map(({ variants_search, search_score, ...row }) => ({
        ...row,
        letter: termLetter(row.headword_en)
      }));
      return json({
        ok: true,
        items,
        total,
        limit,
        offset,
        hasPrevious: offset > 0,
        hasNext: offset + limit < total,
        query: q,
        letter,
        normalizedQuery: needle,
        requestId: id
      });
    }

    const rowsStatement = letter
      ? context.env.DB.prepare(`
          SELECT id, slug, headword_en, ottoman_period_term, modern_equivalent_tr, category,
                 explanation_tr, explanation_en, updated_at, version
          FROM terms
          WHERE status = 'published' AND UPPER(SUBSTR(LTRIM(headword_en), 1, 1)) = ?1
          ORDER BY headword_en COLLATE NOCASE, id
          LIMIT ?2 OFFSET ?3
        `).bind(letter, limit, offset)
      : context.env.DB.prepare(`
          SELECT id, slug, headword_en, ottoman_period_term, modern_equivalent_tr, category,
                 explanation_tr, explanation_en, updated_at, version
          FROM terms
          WHERE status = 'published'
          ORDER BY headword_en COLLATE NOCASE, id
          LIMIT ?1 OFFSET ?2
        `).bind(limit, offset);
    const countStatement = letter
      ? context.env.DB.prepare(`
          SELECT COUNT(*) AS count
          FROM terms
          WHERE status = 'published' AND UPPER(SUBSTR(LTRIM(headword_en), 1, 1)) = ?1
        `).bind(letter)
      : context.env.DB.prepare(`
          SELECT COUNT(*) AS count FROM terms WHERE status = 'published'
        `);
    const [rows, countRow] = await Promise.all([rowsStatement.all(), countStatement.first()]);

    const total = Number(countRow?.count || 0);
    return json({
      ok: true,
      items: (rows.results || []).map(term => ({ ...term, letter: termLetter(term.headword_en) })),
      total,
      limit,
      offset,
      hasPrevious: offset > 0,
      hasNext: offset + limit < total,
      query: q,
      letter,
      requestId: id
    });
  } catch (error) {
    return json({ ok: false, error: 'query_failed', requestId: id }, { status: 500 });
  }
}
