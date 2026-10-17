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

// Keep word boundaries in the main key. A second, lower-ranked key only joins
// punctuation inside words, so C.O.S./COS and a’yan/ayan can also match.
function joinedSearch(value) {
  return normalizeSearch(String(value || '').replace(/[.'’‘ʼʻʾʿ\u2010-\u2015-]/g, ''));
}

function containsPhrase(text, phrase) {
  return (` ${text} `).includes(` ${phrase} `);
}

function containsWords(text, tokens) {
  const remaining = text.split(' ');
  // Match longer prefixes first and consume each word once.
  return [...tokens].sort((a, b) => b.length - a.length).every(token => {
    const index = remaining.findIndex(word => word === token || (token.length >= 3 && word.startsWith(token)));
    if (index < 0) return false;
    remaining.splice(index, 1);
    return true;
  });
}

function fieldScore(value, query, weight) {
  const text = normalizeSearch(value);
  const needle = query.text;
  if (!text || !needle) return 0;
  if (text === needle) return 1000 + weight;
  if (containsPhrase(text, needle)) return 800 + weight - Math.min(text.split(' ').length, 40);
  if (text.startsWith(needle)) return 600 + weight;

  const joined = joinedSearch(value);
  if (query.joined.length >= 3 && (joined !== text || query.joined !== needle)) {
    if (joined === query.joined) return 550 + weight;
    if (containsPhrase(joined, query.joined)) return 450 + weight;
    if (joined.startsWith(query.joined)) return 400 + weight;
  }

  if (text.includes(needle)) return 300 + weight;
  if (query.tokens.length > 1 && containsWords(text, query.tokens)) return 200 + weight;
  return 0;
}

function searchScore(row, query) {
  // JSON preserves variant boundaries, including punctuation inside a variant.
  // Score each variant independently; never form a phrase across two variants.
  const variants = JSON.parse(row.variants_search || '[]');
  return Math.max(
    fieldScore(row.headword_en, query, 80),
    fieldScore(row.ottoman_period_term, query, 70),
    fieldScore(row.modern_equivalent_tr, query, 60),
    variants.reduce((best, variant) => Math.max(best, fieldScore(variant, query, 40)), 0),
    fieldScore(row.category, query, 10)
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
               (SELECT json_group_array(v.variant) FROM term_variants v WHERE v.term_id = t.id) AS variants_search
        FROM terms t
        WHERE t.status = 'published'
        ORDER BY t.headword_en COLLATE NOCASE, t.id
      `).all();

      const needle = normalizeSearch(q);
      const query = { text: needle, joined: joinedSearch(q), tokens: needle.split(' ').filter(Boolean) };
      const matches = (allRows.results || [])
        .filter(row => !letter || termLetter(row.headword_en) === letter)
        .map(row => ({ ...row, search_score: searchScore(row, query) }))
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
