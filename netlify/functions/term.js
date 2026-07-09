const { htmlHeaders, readContent, allRecords, termTitle, termSlug, slugify, field, escapeHtml, canonicalBase, pageShell, langFromEvent } = require('./_shared');

const SUMMARY_EXCLUDE_FIELDS = new Set(['Harf', 'Madde Başı', 'Güven Durumu', 'Güven', 'Kaynak Dosyadaki Karşılık', 'Bağlam / Editör Notu', 'Editör Notu', 'Not', 'Kritik Not', 'Açıklama', 'Künye', 'Kaynak', 'Kaynakça', 'Atıf', 'Bibliyografik Künye', 'Arşiv Kodu', 'Belge Kodu']);
const EXPLANATION_FIELD_NAMES = ['Açıklama', 'Bağlam / Editör Notu', 'Editör Notu', 'Not', 'Kritik Not', 'Kullanım Notu', 'Açıklamalar'];
const CITATION_FIELD_NAMES = ['Künye', 'Kaynak', 'Kaynakça', 'Atıf', 'Bibliyografik Künye', 'Arşiv Kodu', 'Belge Kodu', 'Belge', 'Dosya', 'Kaynak Dosyadaki Karşılık', 'Güven Durumu', 'Güven'];
const EN_FIELD_LABELS = {
  'Künye': 'Bibliographic citation',
  'Kaynak': 'Source',
  'Kaynakça': 'Bibliography',
  'Atıf': 'Citation',
  'Bibliyografik Künye': 'Bibliographic citation',
  'Arşiv Kodu': 'Archive code',
  'Belge Kodu': 'Document code',
  'Belge': 'Document',
  'Dosya': 'File',
  'Kaynak Dosyadaki Karşılık': 'Source-file equivalent',
  'Güven Durumu': 'Reliability status',
  'Güven': 'Reliability',
  'Madde Başı': 'Headword',
  'Osmanlıca / Dönem Karşılığı': 'Ottoman / period equivalent',
  'Günümüz Türkçesi': 'Modern Turkish',
  'Kategori': 'Category',
  'Varyant/Kısaltma': 'Variant / abbreviation'
};

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
  for (const rec of records) {
    if (wanted.has(termSlug(rec))) return rec;
  }
  for (const rec of records) {
    if (recordSlugCandidates(rec).some(s => wanted.has(s))) return rec;
  }
  return null;
}

function hasDisplayValue(value) {
  return value != null && String(value).trim() !== '' && String(value).trim() !== '—';
}

function headerIndex(sheet, wanted) {
  const n = String(wanted || '').toLocaleLowerCase('tr').trim();
  return (sheet.headers || []).findIndex(h => String(h || '').toLocaleLowerCase('tr').trim() === n);
}

function collectNamedFields(rec, names) {
  const out = [];
  const seen = new Set();
  names.forEach(name => {
    const i = headerIndex(rec.sheet, name);
    if (i < 0 || seen.has(i)) return;
    const value = rec.row[i];
    if (!hasDisplayValue(value)) return;
    out.push([rec.sheet.headers[i], value]);
    seen.add(i);
  });
  return out;
}

function fieldLabel(header, lang) {
  return lang === 'en' ? (EN_FIELD_LABELS[header] || header) : header;
}

function detailRow(header, value, lang) {
  const shown = value == null || value === '' ? '—' : String(value);
  return `<div class="detail-row"><small>${escapeHtml(fieldLabel(header, lang))}</small><div>${escapeHtml(shown)}</div></div>`;
}

function renderTermTabs(rec, lang) {
  const summaryFields = (rec.sheet.headers || [])
    .map((h, i) => [h, rec.row[i]])
    .filter(([h, v]) => !SUMMARY_EXCLUDE_FIELDS.has(h) && hasDisplayValue(v));
  const explanationFields = collectNamedFields(rec, EXPLANATION_FIELD_NAMES);
  const citationFields = collectNamedFields(rec, CITATION_FIELD_NAMES);
  const panels = lang === 'en'
    ? [
        { key: 'summary', title: 'Summary', fields: summaryFields, empty: 'No summary record is available for this entry.' },
        { key: 'citation', title: 'Bibliography', fields: citationFields, empty: 'No bibliographic record is available for this entry.' }
      ]
    : [
        { key: 'summary', title: 'Özet', fields: summaryFields, empty: 'Bu madde için özet karşılık kaydı bulunmuyor.' },
        { key: 'explanation', title: 'Açıklama', fields: explanationFields, empty: 'Bu madde için açıklama kaydı bulunmuyor.' },
        { key: 'citation', title: 'Künye', fields: citationFields, empty: 'Bu madde için künye veya kaynak kaydı bulunmuyor.' }
      ];
  const active = panels.find(p => p.fields.length)?.key || panels[0].key;
  const tabs = panels.map(p => `<button type="button" class="term-tab${p.key === active ? ' active' : ''}" data-tab="${p.key}" aria-selected="${p.key === active ? 'true' : 'false'}">${escapeHtml(p.title)}</button>`).join('');
  const body = panels.map(p => {
    const html = p.fields.length ? p.fields.map(([h, v]) => detailRow(h, v, lang)).join('') : `<p class="term-empty">${escapeHtml(p.empty)}</p>`;
    return `<div class="term-panel detail-grid" data-panel="${p.key}"${p.key === active ? '' : ' hidden'}>${html}</div>`;
  }).join('');
  const aria = lang === 'en' ? 'Entry details' : 'Madde ayrıntıları';
  return `<style>.term-tabs{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:18px 0 12px}.term-tab{border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--accent);padding:8px 14px;font-family:Cambria,Georgia,serif;font-weight:700;cursor:pointer}.term-tab.active{background:var(--accent);color:#fff}.term-panel[hidden]{display:none}.term-empty{text-align:center;color:var(--ink-soft);margin:18px 0}</style><div class="term-tabs" role="tablist" aria-label="${escapeHtml(aria)}">${tabs}</div>${body}<script>(function(){var tabs=document.querySelectorAll('.term-tab');tabs.forEach(function(tab){tab.addEventListener('click',function(){var key=tab.getAttribute('data-tab');tabs.forEach(function(t){var on=t===tab;t.classList.toggle('active',on);t.setAttribute('aria-selected',on?'true':'false')});document.querySelectorAll('.term-panel').forEach(function(p){p.hidden=p.getAttribute('data-panel')!==key})})})})();</script>`;
}

exports.handler = async function(event) {
  const lang = langFromEvent(event);
  const content = await readContent();
  const requestedSlugs = slugCandidatesFromEvent(event);
  const rec = findRecord(content, requestedSlugs);
  if (!rec) {
    const title = lang === 'en' ? 'Term not found' : 'Terim bulunamadı';
    const back = lang === 'en' ? '<p><a href="/en/terms/">Return to the terms index</a></p>' : '<p><a href="/terimler/">Terimler dizinine dön</a></p>';
    const body = `<p class="lead">${lang === 'en' ? 'The requested term was not found in the dictionary.' : 'Aradığınız terim sözlükte bulunamadı.'}</p>${back}`;
    return { statusCode:404, headers:htmlHeaders(), body:pageShell({ title, description:title, canonical:canonicalBase(event)+(lang==='en'?'/en/terms/':'/terimler/'), body, lang }) };
  }
  const title = termTitle(rec);
  const ottoman = field(rec, ['Osmanlıca / Dönem Karşılığı','Osmanlıca','Dönem Karşılığı','Nihai Türkçe Karşılık','Karşılık','Standart Türkçe','Eşiti','Not','İçerik']);
  const modern = field(rec, ['Günümüz Türkçesi','Modern Türkçe','Türkçe Karşılık','Standart Türkçe Karşılık','Metrik Karşılık']);
  const desc = `${title}${modern ? ' — ' + modern : ''}${ottoman ? ' — ' + ottoman : ''}`.slice(0,155);
  const label = lang === 'en' ? 'Dictionary entry' : 'Sözlük maddesi';
  const meta = lang === 'en' ? 'Live content last updated' : 'Canlı içerik son güncelleme';
  const tabs = renderTermTabs(rec, lang);
  const body = `<p class="lead">${escapeHtml(rec.sheet.name || label)}</p>${tabs}<p class="meta">${meta}: ${escapeHtml(content.updatedAt || '')}.</p>`;
  const canonical = canonicalBase(event) + (lang === 'en' ? '/en/term/' : '/terim/') + encodeURIComponent(termSlug(rec)) + '/';
  return { statusCode:200, headers:htmlHeaders(), body:pageShell({ title, description:desc, canonical, body, lang }) };
};
