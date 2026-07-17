(() => {
  'use strict';

  const PAGE_SIZE = 100;
  const LIST_ENDPOINT = '/api/terms';
  const DETAIL_ENDPOINT = '/api/terms/';
  const detailCache = new Map();

  function legacyRow(term) {
    return {
      'Harf': String(term.headword_en || '').trim().charAt(0).toLocaleUpperCase('tr-TR'),
      'Madde Başı': term.headword_en || '',
      'Varyant/Kısaltma': '',
      'Osmanlıca / Dönem Karşılığı': term.ottoman_period_term || '',
      'Günümüz Karşılığı': term.modern_equivalent_tr || '',
      'Günümüz Türkçesi': term.modern_equivalent_tr || '',
      'Kategori': term.category || '',
      'Açıklama': term.explanation_tr || '',
      'Künye/Kaynak': '',
      '__d1Slug': term.slug,
      '__d1Id': term.id,
      '__d1Version': term.version
    };
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }
    return data;
  }

  async function loadPublishedTerms() {
    const rows = [];
    let offset = 0;
    let total = null;

    do {
      const url = `${LIST_ENDPOINT}?limit=${PAGE_SIZE}&offset=${offset}`;
      const data = await fetchJson(url);
      total = Number(data.total || 0);
      rows.push(...(data.items || []).map(legacyRow));
      offset += data.items?.length || 0;
      if (!data.items?.length) break;
    } while (rows.length < total);

    if (rows.length !== total) {
      throw new Error(`D1 kayıt sayısı uyuşmuyor: ${rows.length}/${total}`);
    }

    return {
      source: 'cloudflare-d1',
      total,
      data: [{
        name: 'Ana Sözlük',
        headers: [
          'Harf',
          'Madde Başı',
          'Varyant/Kısaltma',
          'Osmanlıca / Dönem Karşılığı',
          'Günümüz Karşılığı',
          'Kategori',
          'Açıklama',
          'Künye/Kaynak'
        ],
        rows
      }]
    };
  }

  async function loadTermDetail(slug) {
    if (!slug) throw new Error('Eksik D1 slug değeri.');
    if (!detailCache.has(slug)) {
      detailCache.set(slug, fetchJson(`${DETAIL_ENDPOINT}${encodeURIComponent(slug)}`));
    }
    const data = await detailCache.get(slug);
    const term = data.term;
    return {
      ...legacyRow(term),
      'Varyant/Kısaltma': (term.variants || []).map(item => item.variant).filter(Boolean).join('; '),
      'Künye/Kaynak': (term.sources || []).map(item => item.citation).filter(Boolean).join('\n')
    };
  }

  window.ATSD1 = Object.freeze({
    loadPublishedTerms,
    loadTermDetail,
    legacyRow
  });
})();
