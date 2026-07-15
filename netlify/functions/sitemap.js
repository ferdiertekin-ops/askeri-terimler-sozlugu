const { xmlHeaders, readContent, allRecords, termSlug, canonicalBase, xmlEscape } = require('./_shared');

function altPair(path) {
  const staticPairs = {
    '/': '/en/',
    '/terimler/': '/en/terms/',
    '/yayin-notu/': '/en/publication-note/',
    '/kaynakca/': '/en/bibliography/',
    '/gizlilik-politikasi/': '/en/privacy-policy/',
    '/cerez-politikasi/': '/en/cookie-policy/',
    '/kullanim-sartlari/': '/en/terms-of-use/',
    '/iletisim/': '/en/contact/'
  };
  for (const [tr, en] of Object.entries(staticPairs)) {
    if (path === tr || path === en) return { tr, en };
  }
  if (path.startsWith('/terim/')) return { tr: path, en: path.replace('/terim/', '/en/term/') };
  if (path.startsWith('/en/term/')) return { tr: path.replace('/en/term/', '/terim/'), en: path };
  return { tr: '/', en: '/en/' };
}

function urlEntry(base, path, lastmod) {
  const alt = altPair(path);
  return `  <url>\n    <loc>${xmlEscape(base + path)}</loc>\n    <xhtml:link rel="alternate" hreflang="tr" href="${xmlEscape(base + alt.tr)}" />\n    <xhtml:link rel="alternate" hreflang="en" href="${xmlEscape(base + alt.en)}" />\n    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(base + alt.tr)}" />\n    <lastmod>${xmlEscape(lastmod)}</lastmod>\n  </url>`;
}

exports.handler = async function(event) {
  const content = await readContent();
  const base = 'https://askeriterimlersozlugu.com';
  const urls = ['/', '/en/', '/terimler/', '/en/terms/', '/yayin-notu/', '/en/publication-note/', '/kaynakca/', '/en/bibliography/'];
  const seen = new Set(urls);
  for (const rec of allRecords(content)) {
    const slug = encodeURIComponent(termSlug(rec));
    for (const u of ['/terim/' + slug + '/', '/en/term/' + slug + '/']) {
      if (!seen.has(u)) { urls.push(u); seen.add(u); }
    }
  }
  const lastmod = new Date(content.updatedAt || Date.now()).toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.map(u => urlEntry(base, u, lastmod)).join('\n')}\n</urlset>\n`;
  return { statusCode:200, headers:xmlHeaders(), body };
};
