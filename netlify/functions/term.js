const {
  htmlHeaders, readContent, allRecords, termTitle, termSlug, slugify, field,
  escapeHtml, canonicalBase, pageShell, langFromEvent
} = require('./_shared');

const CARD_FIELDS = [
  { key: 'Harf', tr: 'Harf', en: 'Letter', names: ['Harf'] },
  { key: 'Madde Başı', tr: 'Madde Başı', en: 'Headword', names: ['Madde Başı', 'İngilizce Terim', 'Terim', 'Madde', 'Başlık'] },
  { key: 'Varyant/Kısaltma', tr: 'Varyant/Kısaltma', en: 'Variant / abbreviation', names: ['Varyant/Kısaltma', 'Varyant', 'Kısaltma'] },
  { key: 'Osmanlıca / Dönem Karşılığı', tr: 'Osmanlıca / Dönem Karşılığı', en: 'Ottoman / period equivalent', names: ['Osmanlıca / Dönem Karşılığı', 'Osmanlıca', 'Dönem Karşılığı', 'Nihai Türkçe Karşılık', 'Karşılık'] },
  { key: 'Günümüz Türkçesi', tr: 'Günümüz Türkçesi', en: 'Modern Turkish', names: ['Günümüz Türkçesi', 'Modern Türkçe', 'Türkçe Karşılık', 'Standart Türkçe Karşılık'] },
  { key: 'Kategori', tr: 'Kategori', en: 'Category', names: ['Kategori', 'Tür'] },
  { key: 'Açıklama', tr: 'Açıklama', en: 'Explanation', names: ['Açıklama', 'Bağlam / Editör Notu', 'Editör Notu', 'Not', 'Kritik Not', 'Kullanım Notu', 'Açıklamalar'], wide: true },
  { key: 'Künye/Kaynak', tr: 'Künye/Kaynak', en: 'Bibliographic citation / source', names: ['Künye/Kaynak', 'Künye', 'Kaynak', 'Bibliyografik Künye', 'Atıf', 'Kaynakça', 'Arşiv Kodu', 'Belge Kodu', 'Belge', 'Dosya', 'Kaynak Dosyadaki Karşılık'], wide: true }
];

function cleanSlug(value) {
  return decodeURIComponent(String(value || ''))
    .split('?')[0]
    .replace(/^\/+|\/+$/g, '')
    .trim();
}

function slugCandidatesFromEvent(event) {
  const out = [];
  const q = event.queryStringParameters || {};
  if (q.slug) out.push(q.slug);
  if (event.path) out.push(String(event.path).replace(/^.*\/(?:terim|term)\//, ''));
  if (event.rawUrl) {
    try {
      const u = new URL(event.rawUrl);
      const parts = u.pathname.split('/').filter(Boolean);
      const iTr = parts.indexOf('terim');
      const iEn = parts.indexOf('term');
      if (iTr >= 0 && parts[iTr + 1]) out.push(parts.slice(iTr + 1).join('/'));
      if (iEn >= 0 && parts[iEn + 1]) out.push(parts.slice(iEn + 1).join('/'));
    } catch (e) {}
  }
  return [...new Set(out.map(cleanSlug).filter(Boolean))];
}

function recordSlugCandidates(rec) {
  const values = [termTitle(rec)];
  const aliasFields = [
    'Varyant/Kısaltma', 'Varyant', 'Kısaltma', 'İngilizce Terim', 'Terim', 'Madde Başı',
    'Kaynak Dosyadaki Karşılık', 'Osmanlıca / Dönem Karşılığı', 'Günümüz Türkçesi'
  ];
  for (const name of aliasFields) {
    const v = field(rec, [name]);
    if (v) values.push(v);
  }
  const candidates = [];
  for (const v of values) {
    String(v || '').split(/[;,/|]+/).map(x => x.trim()).filter(Boolean).forEach(x => candidates.push(slugify(x)));
  }
  candidates.push(termSlug(rec));
  return [...new Set(candidates.filter(Boolean))];
}

function findRecord(content, requestedSlugs) {
  const normalized = requestedSlugs.flatMap(s => [s, slugify(s)]).map(cleanSlug).filter(Boolean);
  const wanted = new Set(normalized);
  const records = allRecords(content);
  for (const rec of records) if (wanted.has(termSlug(rec))) return rec;
  for (const rec of records) if (recordSlugCandidates(rec).some(s => wanted.has(s))) return rec;
  return null;
}

function sheetLabel(name, lang) {
  if (lang !== 'en') return name;
  const labels = {
    'Ana Sözlük': 'Main Dictionary',
    'Kontrol ve Askıda': 'Review and Pending',
    'Kurum Standardı': 'Institutional Standard',
    'Kısaltmalar': 'Abbreviations',
    'Ölçü ve Para': 'Measures and Currency',
    'Editör Notları': 'Editorial Notes',
    'Kullanım İlkeleri': 'Usage Principles'
  };
  return labels[name] || name;
}

function linkifyUrls(value) {
  const source = String(value == null ? '' : value);
  const urlPattern = /https?:\/\/[^\s<>"']+/gi;
  let html = '';
  let lastIndex = 0;
  let match;
  while ((match = urlPattern.exec(source)) !== null) {
    html += escapeHtml(source.slice(lastIndex, match.index));
    let url = match[0];
    let trailing = '';
    while (/[.,;:!?\)\]]$/.test(url)) {
      trailing = url.slice(-1) + trailing;
      url = url.slice(0, -1);
    }
    if (url) {
      html += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
    }
    html += escapeHtml(trailing);
    lastIndex = match.index + match[0].length;
  }
  html += escapeHtml(source.slice(lastIndex));
  return html;
}

function splitCitationEntries(value) {
  return String(value == null ? '' : value)
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function renderCitationList(value) {
  const items = splitCitationEntries(value);
  if (!items.length) return '—';
  return `<ol class="citation-list">${items.map(item => `<li class="citation-item">${linkifyUrls(item)}</li>`).join('')}</ol>`;
}

function renderTermCard(rec, lang) {
  const rows = CARD_FIELDS.map(def => {
    const value = field(rec, def.names);
    const label = lang === 'en' ? def.en : def.tr;
    const shown = value || '—';
    const rendered = def.key === 'Künye/Kaynak' ? renderCitationList(shown) : escapeHtml(shown);
    return `<div class="detail-row${def.wide ? ' wide' : ''}"><small>${escapeHtml(label)}</small><div>${rendered}</div></div>`;
  }).join('');
  return `<style>
.term-card-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:22px}
.term-card-grid .wide{grid-column:1/-1}
.term-card-grid .detail-row{position:relative;border:1px solid var(--line);border-radius:14px;padding:14px 15px;background:linear-gradient(180deg,#fff,#fbfaf7);min-width:0;box-shadow:0 10px 24px -23px rgba(30,39,50,.55)}
.term-card-grid .detail-row::before{content:"";position:absolute;left:0;top:13px;bottom:13px;width:2px;background:var(--brass);opacity:.55}
.term-card-grid .detail-row small{display:block;color:var(--ink-soft);font-size:11px;margin-bottom:6px;text-transform:uppercase;letter-spacing:.09em;font-weight:700}
.term-card-grid .detail-row div{white-space:pre-wrap;overflow-wrap:anywhere;font-weight:600}
.term-card-grid .detail-row a{color:var(--accent);text-decoration:underline;text-underline-offset:2px;overflow-wrap:anywhere}
.citation-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}.citation-item{padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.68);white-space:pre-wrap;overflow-wrap:anywhere;font-weight:500}.citation-item a{color:var(--accent);text-decoration:underline;text-underline-offset:2px;overflow-wrap:anywhere}
@media(max-width:640px){.term-card-grid{grid-template-columns:1fr}.term-card-grid .wide{grid-column:1}}
</style><div class="term-card-grid">${rows}</div>`;
}

exports.handler = async function(event) {
  const lang = langFromEvent(event);
  const content = await readContent();
  const requestedSlugs = slugCandidatesFromEvent(event);
  const rec = findRecord(content, requestedSlugs);

  if (!rec) {
    const title = lang === 'en' ? 'Term not found' : 'Terim bulunamadı';
    const back = lang === 'en'
      ? '<p><a href="/en/terms/">Return to the terms index</a></p>'
      : '<p><a href="/terimler/">Terimler dizinine dön</a></p>';
    const body = `<p class="lead">${lang === 'en' ? 'The requested term was not found in the dictionary.' : 'Aradığınız terim sözlükte bulunamadı.'}</p>${back}`;
    return {
      statusCode: 404,
      headers: htmlHeaders(),
      body: pageShell({
        title,
        description: title,
        canonical: canonicalBase(event) + (lang === 'en' ? '/en/terms/' : '/terimler/'),
        body,
        lang
      })
    };
  }

  const title = termTitle(rec);
  const ottoman = field(rec, ['Osmanlıca / Dönem Karşılığı', 'Osmanlıca', 'Dönem Karşılığı', 'Nihai Türkçe Karşılık', 'Karşılık']);
  const modern = field(rec, ['Günümüz Türkçesi', 'Modern Türkçe', 'Türkçe Karşılık', 'Standart Türkçe Karşılık']);
  const desc = `${title}${modern ? ' — ' + modern : ''}${ottoman ? ' — ' + ottoman : ''}`.slice(0, 155);
  const meta = lang === 'en' ? 'Live content last updated' : 'Canlı içerik son güncelleme';
  const card = renderTermCard(rec, lang);
  const body = `<p class="lead">${escapeHtml(sheetLabel(rec.sheet.name || '', lang))}</p>${card}<p class="meta">${meta}: ${escapeHtml(content.updatedAt || '')}.</p>`;
  const canonical = canonicalBase(event) + (lang === 'en' ? '/en/term/' : '/terim/') + encodeURIComponent(termSlug(rec)) + '/';

  return {
    statusCode: 200,
    headers: htmlHeaders(),
    body: pageShell({ title, description: desc, canonical, body, lang })
  };
};
