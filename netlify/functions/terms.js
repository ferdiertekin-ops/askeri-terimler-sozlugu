const { htmlHeaders, readContent, allRecords, termTitle, termSlug, escapeHtml, canonicalBase, pageShell, langFromEvent } = require('./_shared');

function formatEditorialBody(value) {
  const raw = String(value == null ? '' : value).replace(/\r\n?/g, '\n').trim();
  if (!raw) return '';
  if (/<[a-z][\s\S]*>/i.test(raw)) return `<div class="editorial-content">${raw}</div>`;
  const paragraphs = raw.split(/\n{2,}/).map(block => block.trim()).filter(Boolean);
  return `<div class="editorial-content">${paragraphs.map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('\n')}</div>`;
}

exports.handler = async function(event) {
  const lang = langFromEvent(event);
  const locale = lang === 'en' ? 'en' : 'tr';
  const content = await readContent();
  const seen = new Set();
  const items = [];

  for (const rec of allRecords(content)) {
    const title = termTitle(rec).trim();
    if (!title) continue;
    const slug = termSlug(rec);
    const key = title.toLocaleLowerCase(locale);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ title, slug });
  }

  items.sort((a, b) => a.title.localeCompare(b.title, locale, { sensitivity: 'base', numeric: true }));

  const pages = lang === 'en' ? (content.pages_en || {}) : (content.pages || {});
  const fallbackLead = lang === 'en'
    ? '<p class="lead">This index is generated from live data so that dictionary entries can be read directly by search engines.</p>'
    : '<p class="lead">Bu dizin, sözlük maddelerinin arama motorları tarafından doğrudan okunabilmesi için canlı veriden üretilir.</p>';
  const lead = pages.terimler ? formatEditorialBody(pages.terimler) : fallbackLead;
  const base = lang === 'en' ? '/en/term/' : '/terim/';
  const title = lang === 'en' ? 'Terms Index' : 'Terimler Dizini';
  const desc = lang === 'en' ? 'Live terms index of the Military Terms Dictionary.' : 'Askerî Terimler Sözlüğü canlı terimler dizini.';
  const canonical = canonicalBase(event) + (lang === 'en' ? '/en/terms/' : '/terimler/');
  const meta = lang === 'en'
    ? `Live content last updated: ${escapeHtml(content.updatedAt || '')}. Total entries: ${items.length}.`
    : `Canlı içerik son güncelleme: ${escapeHtml(content.updatedAt || '')}. Toplam madde: ${items.length}.`;
  const list = `${lead}<ul class="term-list">${items.map(t => `<li><a href="${base}${encodeURIComponent(t.slug)}/">${escapeHtml(t.title)}</a></li>`).join('')}</ul><p class="meta">${meta}</p>`;

  return {
    statusCode: 200,
    headers: htmlHeaders({ 'CDN-Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store' }),
    body: pageShell({ title, description: desc, canonical, body: list, lang })
  };
};
