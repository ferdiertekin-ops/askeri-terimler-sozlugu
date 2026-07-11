const { htmlHeaders, readContent, escapeHtml, pageTitleFor, descriptionFor, canonicalBase, pageShell } = require('./_shared');

const ALLOWED = new Set(['yayin-notu','kaynakca','gizlilik-politikasi','cerez-politikasi','kullanim-sartlari','iletisim']);
const ROUTE_TR = {
  'yayin-notu':'/yayin-notu/',
  'kaynakca':'/kaynakca/',
  'gizlilik-politikasi':'/gizlilik-politikasi/',
  'cerez-politikasi':'/cerez-politikasi/',
  'kullanim-sartlari':'/kullanim-sartlari/',
  'iletisim':'/iletisim/'
};
const ROUTE_EN = {
  'yayin-notu':'/en/publication-note/',
  'kaynakca':'/en/bibliography/',
  'gizlilik-politikasi':'/en/privacy-policy/',
  'cerez-politikasi':'/en/cookie-policy/',
  'kullanim-sartlari':'/en/terms-of-use/',
  'iletisim':'/en/contact/'
};


function formatEditorialBody(value) {
  const raw = String(value == null ? '' : value).replace(/\r\n?/g, '\n').trim();
  if (!raw) return '';
  if (/<[a-z][\s\S]*>/i.test(raw)) return `<div class="editorial-content">${raw}</div>`;
  const paragraphs = raw.split(/\n{2,}/).map(block => block.trim()).filter(Boolean);
  const html = paragraphs.map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('\n');
  return `<div class="editorial-content">${html}</div>`;
}

function keyFromPath(value) {
  const raw = decodeURIComponent(String(value || '')).toLowerCase();
  if (raw.includes('/kaynakca') || raw.includes('/bibliography') || raw.includes('/atif-bilgisi')) return 'kaynakca';
  if (raw.includes('/yayin-notu') || raw.includes('/publication-note')) return 'yayin-notu';
  if (raw.includes('/gizlilik-politikasi') || raw.includes('/privacy-policy')) return 'gizlilik-politikasi';
  if (raw.includes('/cerez-politikasi') || raw.includes('/cookie-policy')) return 'cerez-politikasi';
  if (raw.includes('/kullanim-sartlari') || raw.includes('/terms-of-use')) return 'kullanim-sartlari';
  if (raw.includes('/iletisim') || raw.includes('/contact')) return 'iletisim';
  return '';
}

function langFromRoute(event, explicitLang) {
  if (explicitLang) return explicitLang;
  const q = event.queryStringParameters || {};
  if (String(q.lang || '').toLowerCase() === 'en') return 'en';
  const raw = [event.rawUrl, event.path, event.headers && event.headers.referer].filter(Boolean).join(' ');
  return /\/en\//i.test(raw) ? 'en' : 'tr';
}

function resolvePageKey(event, fixedKey) {
  if (fixedKey) return fixedKey;
  const q = event.queryStringParameters || {};
  const qKey = String(q.key || '').trim();
  if (ALLOWED.has(qKey)) return qKey;
  const candidates = [event.rawUrl, event.path, event.headers && event.headers['x-nf-original-url'], event.headers && event.headers['x-original-uri'], event.headers && event.headers.referer];
  for (const candidate of candidates) {
    const key = keyFromPath(candidate);
    if (key) return key;
  }
  return '';
}

async function renderPage(event, fixedKey, explicitLang) {
  const lang = langFromRoute(event, explicitLang);
  const key = resolvePageKey(event, fixedKey);
  const content = await readContent();
  if (!ALLOWED.has(key)) {
    const title = lang === 'en' ? 'Page not found' : 'Sayfa bulunamadı';
    const body = `<p class="lead">${lang === 'en' ? 'The requested page was not found.' : 'Aradığınız sayfa bulunamadı.'}</p>`;
    return { statusCode:404, headers:htmlHeaders({ 'CDN-Cache-Control':'no-store', 'Netlify-CDN-Cache-Control':'no-store' }), body:pageShell({ title, description:title, canonical:canonicalBase(event)+(lang==='en'?'/en/':'/'), body, lang }) };
  }
  const title = pageTitleFor(key, lang);
  const description = descriptionFor(key, content, lang);
  const pages = lang === 'en' ? (content.pages_en || {}) : (content.pages || {});
  const rawBody = pages[key] ? formatEditorialBody(pages[key]) : `<p class="lead">${escapeHtml(title)} ${lang==='en'?'has not yet been published.':'metni henüz yayımlanmamıştır.'}</p>`;
  const routeMap = lang === 'en' ? ROUTE_EN : ROUTE_TR;
  const canonical = canonicalBase(event) + routeMap[key];
  const meta = `<p class="meta">${lang==='en'?'Live content last updated':'Canlı içerik son güncelleme'}: ${escapeHtml(content.updatedAt || '')}.</p>`;
  return { statusCode:200, headers:htmlHeaders({ 'CDN-Cache-Control':'no-store', 'Netlify-CDN-Cache-Control':'no-store' }), body:pageShell({ title, description, canonical, body: rawBody + meta, lang }) };
}

module.exports = { renderPage };
