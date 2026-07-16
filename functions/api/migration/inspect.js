import { json, withRequestId } from '../../_lib/http.js';

const SOURCE_URL = 'https://askeriterimlersozlugu.com/api/content';
const HEADWORD_KEYS = ['term','headword','headword_en','english','en','anaTerim','ana_terim','madde','title'];

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalized(value) {
  return clean(value).toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
}

function chooseHeadword(row) {
  for (const key of HEADWORD_KEYS) {
    const value = clean(row && row[key]);
    if (value) return { key, value };
  }
  return { key: null, value: '' };
}

export async function onRequestGet(context) {
  const requestId = withRequestId(context.request);
  try {
    const response = await fetch(SOURCE_URL, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'ATS-Cloudflare-Migration-Audit/1.0' },
      cf: { cacheTtl: 0, cacheEverything: false }
    });
    if (!response.ok) {
      return json({ ok: false, error: 'source_fetch_failed', status: response.status, requestId }, 502);
    }

    const snapshot = await response.json();
    const rows = Array.isArray(snapshot?.data) ? snapshot.data : [];
    const keyCounts = new Map();
    const headwordKeyCounts = new Map();
    const duplicates = new Map();
    let nonObjectRows = 0;
    let emptyHeadwords = 0;

    rows.forEach((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        nonObjectRows += 1;
        return;
      }
      Object.keys(row).forEach(key => keyCounts.set(key, (keyCounts.get(key) || 0) + 1));
      const chosen = chooseHeadword(row);
      if (!chosen.value) {
        emptyHeadwords += 1;
        return;
      }
      headwordKeyCounts.set(chosen.key, (headwordKeyCounts.get(chosen.key) || 0) + 1);
      const norm = normalized(chosen.value);
      const current = duplicates.get(norm) || { value: chosen.value, indexes: [] };
      current.indexes.push(index);
      duplicates.set(norm, current);
    });

    const duplicateGroups = [...duplicates.values()]
      .filter(item => item.indexes.length > 1)
      .sort((a, b) => b.indexes.length - a.indexes.length || a.value.localeCompare(b.value))
      .slice(0, 100);

    const sortedKeys = [...keyCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ key, count }));

    return json({
      ok: true,
      source: SOURCE_URL,
      sourceStatus: response.status,
      expectedVisibleCount: 1234,
      actualRowCount: rows.length,
      countMatchesVisibleSite: rows.length === 1234,
      pagesTrCount: snapshot?.pages && typeof snapshot.pages === 'object' ? Object.keys(snapshot.pages).length : 0,
      pagesEnCount: snapshot?.pages_en && typeof snapshot.pages_en === 'object' ? Object.keys(snapshot.pages_en).length : 0,
      metaKeys: snapshot?.meta && typeof snapshot.meta === 'object' ? Object.keys(snapshot.meta).sort() : [],
      rowShape: {
        nonObjectRows,
        emptyHeadwords,
        detectedHeadwordKeys: [...headwordKeyCounts.entries()].map(([key, count]) => ({ key, count })),
        fields: sortedKeys
      },
      duplicates: {
        groupCount: duplicateGroups.length,
        sample: duplicateGroups
      },
      writePerformed: false,
      requestId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return json({ ok: false, error: 'inspection_failed', message: String(error?.message || error), requestId }, 500);
  }
}
