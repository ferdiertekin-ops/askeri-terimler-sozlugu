const { htmlHeaders, readContent, escapeHtml, pageTitleFor, descriptionFor, canonicalBase, pageShell, langFromEvent } = require('./_shared');
exports.handler = async function(event) {
  const lang = langFromEvent(event);
  const content = await readContent();
  const key = (event.queryStringParameters && event.queryStringParameters.key) || 'yayin-notu';
  const allowed = new Set(['yayin-notu','kaynakca','gizlilik-politikasi','cerez-politikasi','kullanim-sartlari','iletisim']);
  if (!allowed.has(key)) {
    const title = lang === 'en' ? 'Page not found' : 'Sayfa bulunamadı';
    const body = `<p class="lead">${lang === 'en' ? 'The requested page was not found.' : 'Aradığınız sayfa bulunamadı.'}</p>`;
    return { statusCode:404, headers:htmlHeaders(), body:pageShell({ title, description:title, canonical:canonicalBase(event)+(lang==='en'?'/en/':'/'), body, lang }) };
  }
  const title = pageTitleFor(key, lang);
  const description = descriptionFor(key, content, lang);
  const pages = lang === 'en' ? (content.pages_en || {}) : (content.pages || {});
  const body = pages[key] ? pages[key] : `<p class="lead">${escapeHtml(title)} ${lang==='en'?'has not yet been published.':'metni henüz yayımlanmamıştır.'}</p>`;
  const routeMap = lang === 'en' ? { 'yayin-notu':'/en/publication-note/','kaynakca':'/en/bibliography/','gizlilik-politikasi':'/en/privacy-policy/','cerez-politikasi':'/en/cookie-policy/','kullanim-sartlari':'/en/terms-of-use/','iletisim':'/en/contact/' } : { 'yayin-notu':'/yayin-notu/','kaynakca':'/kaynakca/','gizlilik-politikasi':'/gizlilik-politikasi/','cerez-politikasi':'/cerez-politikasi/','kullanim-sartlari':'/kullanim-sartlari/','iletisim':'/iletisim/' };
  const canonical = canonicalBase(event) + routeMap[key];
  const meta = `<p class="meta">${lang==='en'?'Live content last updated':'Canlı içerik son güncelleme'}: ${escapeHtml(content.updatedAt || '')}.</p>`;
  return { statusCode:200, headers:htmlHeaders(), body:pageShell({ title, description, canonical, body: body + meta, lang }) };
};
