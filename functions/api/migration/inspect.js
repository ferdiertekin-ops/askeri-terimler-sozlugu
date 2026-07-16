import { json, requestId as getRequestId } from '../../_lib/http.js';

const SOURCE_URL = 'https://askeriterimlersozlugu.com/api/content';
const HEADWORD_KEYS = [
  'term', 'headword', 'headword_en', 'english', 'en', 'ana_terim',
  'ana_terim_ingilizce', 'madde', 'madde_basi', 'title'
];

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

function normalizedValue(value) {
  return clean(value).toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
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

function chooseHeadword(row) {
  for (const key of HEADWORD_KEYS) {
    const value = clean(row && row[key]);
    if (value) return { key, value };
  }

  const entries = Object.entries(row || {});
  const likely = entries.find(([key, value]) => {
    const normalizedKey = normalizeKey(key);
    return clean(value) && (
      normalizedKey.includes('ana_terim') ||
      normalizedKey.includes('madde') ||
      normalizedKey.includes('ingilizce') ||
      normalizedKey.includes('english') ||
      normalizedKey.includes('headword')
    );
  });
  if (likely) return { key: likely[0], value: clean(likely[1]) };

  const firstText = entries.find(([, value]) => clean(value));
  return firstText ? { key: firstText[0], value: clean(firstText[1]) } : { key: null, value: '' };
}

export async function onRequestGet(context) {
  const reqId = getRequestId(context.request);
  try {
    const response = await fetch(SOURCE_URL, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'ATS-Cloudflare-Migration-Audit/1.1' },
      cf: { cacheTtl: 0, cacheEverything: false }
    });
    if (!response.ok) {
      return json({ ok: false, error: 'source_fetch_failed', status: response.status, requestId: reqId }, { status: 502 });
    }

    const snapshot = await response.json();
    const sections = Array.isArray(snapshot?.data) ? snapshot.data : [];
    const sectionReport = [];
    const flattenedRows = [];

    sections.forEach((section, sectionIndex) => {
      const headers = Array.isArray(section?.headers) ? section.headers : [];
      const rows = Array.isArray(section?.rows) ? section.rows : [];
      const normalizedHeaders = headers.map((header, index) => ({
        label: headerLabel(header, index),
        key: normalizeKey(headerLabel(header, index)) || `column_${index + 1}`
      }));

      let invalidRows = 0;
      rows.forEach((row, rowIndex) => {
        const mapped = rowToObject(row, headers);
        if (!mapped) {
          invalidRows += 1;
          return;
        }
        flattenedRows.push({
          ...mapped,
          __sectionIndex: sectionIndex,
          __rowIndex: rowIndex,
          __sectionName: clean(section?.name) || `section_${sectionIndex + 1}`
        });
      });

      sectionReport.push({
        index: sectionIndex,
        name: clean(section?.name) || `section_${sectionIndex + 1}`,
        rowCount: rows.length,
        invalidRows,
        headers: normalizedHeaders,
        rowStorageType: rows.length ? (Array.isArray(rows[0]) ? 'array' : typeof rows[0]) : 'empty'
      });
    });

    const keyCounts = new Map();
    const headwordKeyCounts = new Map();
    const duplicates = new Map();
    let emptyHeadwords = 0;

    flattenedRows.forEach((row, index) => {
      Object.keys(row)
        .filter(key => !key.startsWith('__'))
        .forEach(key => keyCounts.set(key, (keyCounts.get(key) || 0) + 1));

      const chosen = chooseHeadword(row);
      if (!chosen.value) {
        emptyHeadwords += 1;
        return;
      }
      headwordKeyCounts.set(chosen.key, (headwordKeyCounts.get(chosen.key) || 0) + 1);
      const norm = normalizedValue(chosen.value);
      const current = duplicates.get(norm) || { value: chosen.value, locations: [] };
      current.locations.push({
        flatIndex: index,
        section: row.__sectionName,
        rowIndex: row.__rowIndex
      });
      duplicates.set(norm, current);
    });

    const allDuplicateGroups = [...duplicates.values()]
      .filter(item => item.locations.length > 1)
      .sort((a, b) => b.locations.length - a.locations.length || a.value.localeCompare(b.value));

    const sortedKeys = [...keyCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ key, count }));

    return json({
      ok: true,
      source: SOURCE_URL,
      sourceStatus: response.status,
      expectedVisibleCount: 1234,
      containerCount: sections.length,
      actualRowCount: flattenedRows.length,
      countMatchesVisibleSite: flattenedRows.length === 1234,
      sections: sectionReport,
      pagesTrCount: snapshot?.pages && typeof snapshot.pages === 'object' ? Object.keys(snapshot.pages).length : 0,
      pagesEnCount: snapshot?.pages_en && typeof snapshot.pages_en === 'object' ? Object.keys(snapshot.pages_en).length : 0,
      metaKeys: snapshot?.meta && typeof snapshot.meta === 'object' ? Object.keys(snapshot.meta).sort() : [],
      rowShape: {
        emptyHeadwords,
        detectedHeadwordKeys: [...headwordKeyCounts.entries()].map(([key, count]) => ({ key, count })),
        fields: sortedKeys
      },
      duplicates: {
        groupCount: allDuplicateGroups.length,
        sample: allDuplicateGroups.slice(0, 100)
      },
      writePerformed: false,
      requestId: reqId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return json({ ok: false, error: 'inspection_failed', message: String(error?.message || error), requestId: reqId }, { status: 500 });
  }
}
