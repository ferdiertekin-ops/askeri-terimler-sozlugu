const { htmlHeaders, readContent, allRecords, termTitle, termSlug, field, escapeHtml, canonicalBase, pageShell, langFromEvent } = require('./_shared');
exports.handler = async function(event) {
  const lang = langFromEvent(event);
  const content = await readContent();
  const rawSlug = (event.queryStringParameters && event.queryStringParameters.slug) || '';
  const slug = decodeURIComponent(rawSlug).replace(/^\/+|\/+$/g,'');
  const rec = allRecords(content).find(r => termSlug(r) === slug);
  if (!rec) {
    const title = lang === 'en' ? 'Term not found' : 'Terim bulunamadı';
    const back = lang === 'en' ? '<p><a href="/en/terms/">Return to the terms index</a></p>' : '<p><a href="/terimler/">Terimler dizinine dön</a></p>';
    const body = `<p class="lead">${lang === 'en' ? 'The requested term was not found in the dictionary.' : 'Aradığınız terim sözlükte bulunamadı.'}</p>${back}`;
    return { statusCode:404, headers:htmlHeaders(), body:pageShell({ title, description:title, canonical:canonicalBase(event)+(lang==='en'?'/en/terms/':'/terimler/'), body, lang, content }) };
  }
  const title = termTitle(rec);
  const ottoman = field(rec, ['Osmanlıca / Dönem Karşılığı','Osmanlıca','Dönem Karşılığı','Nihai Türkçe Karşılık','Karşılık','Standart Türkçe','Eşiti','Not','İçerik']);
  const modern = field(rec, ['Günümüz Türkçesi','Modern Türkçe','Türkçe Karşılık','Standart Türkçe Karşılık','Metrik Karşılık']);
  const desc = `${title}${modern ? ' — ' + modern : ''}${ottoman ? ' — ' + ottoman : ''}`.slice(0,155);
  const details = (rec.sheet.headers||[]).map((h,i)=>{ const v=rec.row[i]==null||rec.row[i]===''?'—':String(rec.row[i]); return `<div class="detail-row"><small>${escapeHtml(h)}</small><div>${escapeHtml(v)}</div></div>`; }).join('');
  const label = lang === 'en' ? 'Dictionary entry' : 'Sözlük maddesi';
  const meta = lang === 'en' ? 'Live content last updated' : 'Canlı içerik son güncelleme';
  const body = `<p class="lead">${escapeHtml(rec.sheet.name || label)}</p><div class="detail-grid">${details}</div><p class="meta">${meta}: ${escapeHtml(content.updatedAt || '')}.</p>`;
  const canonical = canonicalBase(event) + (lang === 'en' ? '/en/term/' : '/terim/') + encodeURIComponent(termSlug(rec)) + '/';
  return { statusCode:200, headers:htmlHeaders(), body:pageShell({ title, description:desc, canonical, body, lang, content }) };
};
