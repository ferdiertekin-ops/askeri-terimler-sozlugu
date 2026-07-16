import { json, requestId } from '../../_lib/http.js';

const SOURCE_URL = 'https://askeriterimlersozlugu.com/api/content';

const SECTION_STATUS = {
  'Ana Sözlük': 'published',
  'Kontrol ve Askıda': 'suspended',
  'Kurum Standardı': 'review',
  'Kısaltmalar': 'published',
  'Ölü ve Para': 'suspended',
  'Editör Notları': 'draft',
  'Kullanım İlkeleri': 'draft'
};

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
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

function rowObject(section, row) {
  if (!row || typeof row !== 'object') return null;
  if (!Array.isArray(row)) return row;
  const headers = Array.isArray(section.headers) ? section.headers : [];
  const obj = {};
  headers.forEach((header, index) => {
    const key = typeof header === 'string' ? header : header?.key;
    if (key) obj[key] = row[index];
  });
  return obj;
}

function parseSources(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  const text = clean(value);
  if (!text) return [];
  return text.split(/\n+/).map(clean).filter(Boolean);
}

export async function onRequestGet(context) {
  const id = requestId(context.request);
  try {
    const response = await fetch(SOURCE_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'ATS-Cloudflare-Migration-Plan/1.0' },
      cf: { cacheTtl: 0, cacheEverything: false }
    });
    if (!response.ok) {
      return json({ ok: false, error: 'source_fetch_failed', status: response.status, requestId: id }, { status: 502 });
    }

    const snapshot = await response.json();
    const sections = Array.isArray(snapshot?.data) ? snapshot.data : [];
    const usedSlugs = new Map();
    const collisions = [];
    const records = [];
    const sectionSummary = [];

    for (const section of sections) {
      const sectionName = clean(section?.name) || 'Bilinmeyen Bölüm';
      const status = SECTION_STATUS[sectionName] || 'review';
      const rows = Array.isArray(section?.rows) ? section.rows : [];
      let valid = 0;
      let skipped = 0;

      rows.forEach((rawRow, rowIndex) => {
        const row = rowObject(section, rawRow);
        if (!row) {
          skipped += 1;
          return;
        }

        const headword = clean(row.madde_basi);
        if (!headword) {
          skipped += 1;
          return;
        }

        const baseSlug = slugify(headword);
        const seen = usedSlugs.get(baseSlug) || 0;
        usedSlugs.set(baseSlug, seen + 1);
        const slug = seen === 0 ? baseSlug : `${baseSlug}-${seen + 1}`;
        if (seen > 0) {
          collisions.push({ headword, baseSlug, assignedSlug: slug, section: sectionName, rowIndex });
        }

        const sources = parseSources(row.kunye_kaynak || row.kunye || row.kaynak_dosyadaki_karsilik);
        records.push({
          slug,
          headword_en: headword,
          ottoman_period_term: clean(row.osmanlica_donem_karsiligi),
          modern_equivalent_tr: clean(row.gunumuz_turkcesi),
          category: clean(row.kategori),
          explanation_tr: clean(row.aciklama || row.baglam_editor_notu),
          explanation_en: '',
          confidence: clean(row.guven_durumu),
          status,
          variant: clean(row.varyant_kisaltma),
          sources,
          source_section: sectionName,
          source_row_index: rowIndex
        });
        valid += 1;
      });

      sectionSummary.push({ section: sectionName, status, sourceRows: rows.length, plannedRecords: valid, skippedRows: skipped });
    }

    const statusCounts = records.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});

    const sourceCount = records.reduce((sum, row) => sum + row.sources.length, 0);
    const variantCount = records.reduce((sum, row) => sum + (row.variant ? 1 : 0), 0);

    return json({
      ok: true,
      source: SOURCE_URL,
      sourceStatus: response.status,
      terminology: { sourceLabel: 'Günümüz Türkçesi', canonicalLabel: 'Günümüz Karşılığı' },
      expectedVisibleCount: 1234,
      plannedTermCount: records.length,
      countMatchesVisibleSite: records.length === 1234,
      statusCounts,
      plannedVariantCount: variantCount,
      plannedSourceCount: sourceCount,
      slugCollisionCount: collisions.length,
      slugCollisions: collisions,
      sections: sectionSummary,
      sampleMappings: records.slice(0, 5),
      writePerformed: false,
      requestId: id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return json({ ok: false, error: 'plan_failed', message: String(error?.message || error), requestId: id }, { status: 500 });
  }
}
