import { json, previewOnly, requestId } from '../../_lib/http.js';

const SOURCE_URL = 'https://askeriterimlersozlugu.com/api/content';

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeKey(value) {
  return clean(value)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function headerLabel(header, index) {
  if (typeof header === 'string') return header;
  if (header && typeof header === 'object') {
    return clean(header.label) || clean(header.name) || clean(header.key) || clean(header.title) || `column_${index + 1}`;
  }
  return `column_${index + 1}`;
}

function rowToObject(row, headers) {
  if (row && typeof row === 'object' && !Array.isArray(row)) return row;
  if (!Array.isArray(row)) return null;
  const result = {};
  row.forEach((value, index) => {
    const label = headerLabel(headers[index], index);
    result[normalizeKey(label) || `column_${index + 1}`] = value;
  });
  return result;
}

function slugify(value) {
  return clean(value)
    .toLocaleLowerCase('en-US')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150) || 'term';
}

export async function onRequestGet(context) {
  if (!previewOnly(context)) return json({ ok: false, error: 'preview_only' }, { status: 403 });
  const id = requestId(context.request);
  try {
    const response = await fetch(SOURCE_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'ATS-Cloudflare-Collision-Audit/1.1' },
      cf: { cacheTtl: 0, cacheEverything: false }
    });
    if (!response.ok) {
      return json({ ok: false, error: 'source_fetch_failed', status: response.status, requestId: id }, { status: 502 });
    }

    const snapshot = await response.json();
    const sections = Array.isArray(snapshot?.data) ? snapshot.data : [];
    const groups = new Map();

    sections.forEach((section, sectionIndex) => {
      const headers = Array.isArray(section?.headers) ? section.headers : [];
      const rows = Array.isArray(section?.rows) ? section.rows : [];
      rows.forEach((rawRow, rowIndex) => {
        const row = rowToObject(rawRow, headers);
        if (!row) return;
        const headword = clean(row.madde_basi);
        if (!headword) return;
        const baseSlug = slugify(headword);
        const item = {
          section: clean(section?.name) || `section_${sectionIndex + 1}`,
          sectionIndex,
          rowIndex,
          headword,
          ottoman_period_term: clean(row.osmanlica_donem_karsiligi),
          modern_equivalent_tr: clean(row.gunumuz_turkcesi),
          variant: clean(row.varyant_kisaltma),
          category: clean(row.kategori),
          explanation_tr: clean(row.aciklama || row.baglam_editor_notu),
          source_text: clean(row.kunye_kaynak || row.kunye || row.kaynak_dosyadaki_karsilik)
        };
        const current = groups.get(baseSlug) || [];
        current.push(item);
        groups.set(baseSlug, current);
      });
    });

    const collisions = [...groups.entries()]
      .filter(([, items]) => items.length > 1)
      .map(([baseSlug, items]) => ({
        baseSlug,
        count: items.length,
        exactFieldMatch: items.every(item => JSON.stringify(item) === JSON.stringify(items[0])),
        items
      }))
      .sort((a, b) => a.baseSlug.localeCompare(b.baseSlug));

    return json({
      ok: true,
      removedFields: ['Güven Durumu'],
      collisionGroupCount: collisions.length,
      collisions,
      writePerformed: false,
      requestId: id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return json({ ok: false, error: 'collision_audit_failed', message: String(error?.message || error), requestId: id }, { status: 500 });
  }
}
