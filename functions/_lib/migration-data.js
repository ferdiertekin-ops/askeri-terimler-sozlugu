const SOURCE_URL = 'https://askeriterimlersozlugu.com/api/content';

const SECTION_STATUS = {
  'Ana Sözlük': 'published',
  'Kontrol ve Askıda': 'suspended',
  'Kurum Standardı': 'review',
  'Kısaltmalar': 'published',
  'Ölçü ve Para': 'suspended',
  'Editör Notları': 'draft',
  'Kullanım İlkeleri': 'draft'
};

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanMeaning(value) {
  const text = clean(value);
  return text === '-' || text === '—' ? '' : text;
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

function rowObject(section, row) {
  if (!row || typeof row !== 'object') return null;
  if (!Array.isArray(row)) return row;
  const headers = Array.isArray(section?.headers) ? section.headers : [];
  const mapped = {};
  row.forEach((value, index) => {
    mapped[normalizeKey(headerLabel(headers[index], index)) || `column_${index + 1}`] = value;
  });
  return mapped;
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

function parseLines(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  const text = clean(value);
  if (!text) return [];
  return text.split(/\n+/).map(clean).filter(Boolean);
}

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function resolvedSlug(baseSlug, category) {
  const normalizedCategory = clean(category).toLocaleLowerCase('tr-TR');
  if (baseSlug === 'captain') return normalizedCategory.includes('deniz') ? 'captain-naval' : 'captain-army';
  if (baseSlug === 'lieutenant') return normalizedCategory.includes('deniz') ? 'lieutenant-naval' : 'lieutenant-army';
  return baseSlug;
}

function applyEditorialRules(record) {
  if (record.slug === 'artillery-artilleryman') {
    record.ottoman_period_term = 'Topçu askeri [topçu neferi]';
    record.modern_equivalent_tr = 'Topçu';
  }
  if (record.slug === 'gun-cotton') {
    record.ottoman_period_term = 'Pamuk barutu';
    record.modern_equivalent_tr = 'Pamuk barutu';
    record.sources = record.sources.filter(source => source.toLocaleLowerCase('tr-TR') !== 'pamuk barutu');
  }
  return record;
}

export async function fetchMigrationSnapshot() {
  const response = await fetch(SOURCE_URL, {
    headers: { Accept: 'application/json', 'User-Agent': 'ATS-Cloudflare-D1-Importer/2.0' },
    cf: { cacheTtl: 0, cacheEverything: false }
  });
  if (!response.ok) throw new Error(`source_fetch_failed:${response.status}`);
  return response.json();
}

export function buildMigrationDataset(snapshot) {
  const sections = Array.isArray(snapshot?.data) ? snapshot.data : [];
  const sourceRows = [];

  sections.forEach((section, sectionIndex) => {
    const sectionName = clean(section?.name) || `section_${sectionIndex + 1}`;
    const status = SECTION_STATUS[sectionName] || 'review';
    const rows = Array.isArray(section?.rows) ? section.rows : [];
    rows.forEach((rawRow, rowIndex) => {
      const row = rowObject(section, rawRow);
      if (!row) return;
      const headword = clean(row.madde_basi);
      if (!headword) return;
      const category = clean(row.kategori);
      const baseSlug = slugify(headword);
      sourceRows.push({
        sourceOrder: sourceRows.length,
        sourceSection: sectionName,
        sourceRowIndex: rowIndex,
        slug: resolvedSlug(baseSlug, category),
        headword_en: headword,
        ottoman_period_term: cleanMeaning(row.osmanlica_donem_karsiligi),
        modern_equivalent_tr: cleanMeaning(row.gunumuz_turkcesi),
        category,
        explanation_tr: clean(row.aciklama || row.baglam_editor_notu),
        explanation_en: '',
        status,
        variants: parseLines(row.varyant_kisaltma),
        sources: parseLines(row.kunye_kaynak || row.kunye || row.kaynak_dosyadaki_karsilik)
      });
    });
  });

  const groups = new Map();
  for (const row of sourceRows) {
    const existing = groups.get(row.slug);
    if (!existing) {
      groups.set(row.slug, { ...row, variants: [...row.variants], sources: [...row.sources] });
      continue;
    }
    existing.ottoman_period_term ||= row.ottoman_period_term;
    existing.modern_equivalent_tr ||= row.modern_equivalent_tr;
    existing.category ||= row.category;
    existing.explanation_tr ||= row.explanation_tr;
    existing.explanation_en ||= row.explanation_en;
    existing.variants.push(...row.variants);
    existing.sources.push(...row.sources);
  }

  const records = [...groups.values()]
    .sort((a, b) => a.sourceOrder - b.sourceOrder)
    .map((record, index) => applyEditorialRules({
      ...record,
      id: index + 1,
      variants: unique(record.variants),
      sources: unique(record.sources)
    }));

  let variantId = 1;
  let sourceId = 1;
  records.forEach(record => {
    record.variants = record.variants.map(variant => ({ id: variantId++, variant }));
    record.sources = record.sources.map((citation, sortOrder) => ({ id: sourceId++, citation, sortOrder }));
  });

  const statusCounts = records.reduce((acc, record) => {
    acc[record.status] = (acc[record.status] || 0) + 1;
    return acc;
  }, {});

  return {
    sourceRowCount: sourceRows.length,
    records,
    termCount: records.length,
    variantCount: variantId - 1,
    sourceCount: sourceId - 1,
    statusCounts,
    collisionPolicy: {
      merged: ['artillery-artilleryman', 'gun-cotton'],
      separated: ['captain-naval', 'captain-army', 'lieutenant-naval', 'lieutenant-army']
    }
  };
}
