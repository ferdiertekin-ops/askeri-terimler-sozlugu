const { htmlHeaders, readContent, allRecords, termTitle, termSlug, escapeHtml, canonicalBase, pageShell, langFromEvent } = require('./_shared');
exports.handler = async function(event) {
  const lang = langFromEvent(event);
  const content = await readContent();
  const seen = new Set(); const items=[];
  for (const rec of allRecords(content)) { const title=termTitle(rec).trim(); if(!title) continue; const slug=termSlug(rec); const key=slug+'|'+title.toLocaleLowerCase('tr'); if(seen.has(key)) continue; seen.add(key); items.push({title,slug}); }
  items.sort((a,b)=>a.title.localeCompare(b.title,'tr'));
  const pages = lang === 'en' ? (content.pages_en || {}) : (content.pages || {});
  const lead = pages.terimler || (lang === 'en' ? '<p class="lead">This index is generated from live data so that dictionary entries can be read directly by search engines.</p>' : '<p class="lead">Bu dizin, sözlük maddelerinin arama motorları tarafından doğrudan okunabilmesi için canlı veriden üretilir.</p>');
  const base = lang === 'en' ? '/en/term/' : '/terim/';
  const title = lang === 'en' ? 'Terms Index' : 'Terimler Dizini';
  const desc = lang === 'en' ? 'Live terms index of the Military Terms Dictionary.' : 'Askerî Terimler Sözlüğü canlı terimler dizini.';
  const canonical = canonicalBase(event) + (lang === 'en' ? '/en/terms/' : '/terimler/');
  const meta = lang === 'en' ? `Live content last updated: ${escapeHtml(content.updatedAt || '')}. Total entries: ${items.length}.` : `Canlı içerik son güncelleme: ${escapeHtml(content.updatedAt || '')}. Toplam madde: ${items.length}.`;
  const list = `${lead}<ul class="term-list">${items.map(t=>`<li><a href="${base}${encodeURIComponent(t.slug)}/">${escapeHtml(t.title)}</a></li>`).join('')}</ul><p class="meta">${meta}</p>`;
  return { statusCode:200, headers:htmlHeaders(), body:pageShell({ title, description:desc, canonical, body:list, lang }) };
};
