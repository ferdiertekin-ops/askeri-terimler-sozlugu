import { handleEditorApi, hasEditorSession } from './_lib/editor.js';
import { renderEditablePage, renderEditablePageJson, renderRobots, renderSitemap, renderTermPage, renderTermsIndex } from './_lib/site.js';

const CANONICAL_HOST = 'askeriterimlersozlugu.com';
const SEARCH_NOINDEX = { 'X-Robots-Tag': 'noindex, follow' };

const DICTIONARY_VISUAL_POLISH = `
<style id="ats-visual-polish">
:root{
  --claude-canvas:#f8f8f6;
  --claude-surface:#ffffff;
  --ats-navy:#2f4e71;
  --ats-navy-deep:#20395a;
}
html,body{
  background:#f8f8f6!important;
}
body{
  background-image:none!important;
  background-color:#f8f8f6!important;
}
.preview-search-tools.is-stuck{
  background:rgba(248,248,246,.96)!important;
}
.preview-search-row{
  background:#ffffff!important;
  border-color:#deded8!important;
  box-shadow:0 1px 2px rgba(30,39,50,.05),0 14px 32px -26px rgba(32,57,90,.34),inset 0 1px 0 rgba(255,255,255,.96)!important;
}
.preview-search-row:hover{
  border-color:#b8c2cd!important;
}
.preview-search-row:focus-within{
  border-color:#7f95ad!important;
  box-shadow:0 0 0 3px rgba(47,78,113,.10),0 16px 34px -28px rgba(32,57,90,.34)!important;
}
.list-head{
  background:linear-gradient(180deg,#2f4e71 0%,#294766 100%)!important;
  border-top-color:#20395a!important;
  border-bottom-color:#20395a!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 5px 14px -12px rgba(32,57,90,.58);
}
.list-head span{
  color:#f8f8f6!important;
  text-shadow:0 1px 0 rgba(0,0,0,.14);
}
</style>`;

const TURKISH_TTS_CLIENT = '<script src="/assets/ats-tr-tts.js" defer></script>';

const EDITABLE_ROUTES = new Map([
  ['/yayin-notu/', ['publication-note', 'tr']],
  ['/en/publication-note/', ['publication-note', 'en']],
  ['/kaynakca/', ['bibliography', 'tr']],
  ['/en/bibliography/', ['bibliography', 'en']],
  ['/gizlilik-politikasi/', ['privacy', 'tr']],
  ['/en/privacy-policy/', ['privacy', 'en']],
  ['/cerez-politikasi/', ['cookies', 'tr']],
  ['/en/cookie-policy/', ['cookies', 'en']],
  ['/kullanim-sartlari/', ['terms-of-use', 'tr']],
  ['/en/terms-of-use/', ['terms-of-use', 'en']],
  ['/iletisim/', ['contact', 'tr']],
  ['/en/contact/', ['contact', 'en']]
]);

const LEGACY_REDIRECTS = new Map([
  ['/gizlilik', '/gizlilik-politikasi/'],
  ['/gizlilik/', '/gizlilik-politikasi/'],
  ['/cerezler', '/cerez-politikasi/'],
  ['/cerezler/', '/cerez-politikasi/'],
  ['/en/privacy', '/en/privacy-policy/'],
  ['/en/privacy/', '/en/privacy-policy/'],
  ['/en/cookies', '/en/cookie-policy/'],
  ['/en/cookies/', '/en/cookie-policy/']
]);

function redirect(url, pathname, status = 308) {
  const target = new URL(url);
  target.pathname = pathname;
  return Response.redirect(target.toString(), status);
}

async function assetRequest(context, pathname, extraHeaders = {}) {
  const target = new URL(context.request.url);
  target.pathname = pathname;
  target.search = '';
  const response = await context.env.ASSETS.fetch(new Request(target, context.request));
  if (!Object.keys(extraHeaders).length) return response;
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function stripInstallLinks(html) {
  return html
    .replace(/\s*<a class="install-app-link" href="[^"]*">[^<]*<\/a>\s*/gi, ' ')
    .replace(/\s*·\s*·\s*/g, ' · ');
}

function applyEditorShortcut(html, authenticated, lang) {
  if (!authenticated) return html;
  const tr = lang !== 'en';
  const href = tr ? '/editor/panel/?new=1&return=%2F' : '/editor/panel/?new=1&return=%2Fen%2F';
  const label = tr ? '＋ Yeni madde' : '＋ New entry';
  const title = tr ? 'Yeni sözlük maddesi ekle' : 'Add a new dictionary entry';
  return html.replace(
    /<a class="preview-editor-link" href="\/editor\/"[^>]*>[^<]*<\/a>/i,
    `<a class="preview-editor-link" href="${href}" title="${title}">${label}</a>`
  );
}

function injectTurkishTtsClient(html) {
  if (html.includes('/assets/ats-tr-tts.js')) return html;
  return html.replace('</body>', `${TURKISH_TTS_CLIENT}\n</body>`);
}

function applyDictionaryVisualPolish(html, authenticated = false, lang = 'tr') {
  let cleaned = stripInstallLinks(html);
  cleaned = applyEditorShortcut(cleaned, authenticated, lang);
  cleaned = injectTurkishTtsClient(cleaned);
  if (cleaned.includes('id="ats-visual-polish"')) return cleaned;
  return cleaned.replace('</head>', `${DICTIONARY_VISUAL_POLISH}\n</head>`);
}

async function dictionaryAssetRequest(context, pathname, lang, extraHeaders = {}) {
  const response = await assetRequest(context, pathname, extraHeaders);
  if (context.request.method === 'HEAD' || !response.ok) return response;

  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html')) return response;

  const authenticated = await hasEditorSession(context);
  const html = applyDictionaryVisualPolish(await response.text(), authenticated, lang);
  const headers = new Headers(response.headers);
  headers.delete('Content-Length');
  headers.delete('Content-Encoding');
  headers.delete('ETag');
  headers.set('Cache-Control', 'no-cache, must-revalidate');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

function unavailable(type = 'text/html; charset=utf-8') {
  let body = '<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="robots" content="noindex,follow"><title>Geçici olarak kullanılamıyor</title><p>Hizmet kısa süre içinde yeniden denenecektir.</p></html>';
  if (type.startsWith('application/json')) body = JSON.stringify({ ok: false, error: 'service_unavailable' });
  if (type.startsWith('application/xml')) body = '<?xml version="1.0" encoding="UTF-8"?><error>service_unavailable</error>';
  return new Response(body, {
    status: 503,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'Retry-After': '300',
      'X-Robots-Tag': 'noindex, follow'
    }
  });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const getOrHead = context.request.method === 'GET' || context.request.method === 'HEAD';

  if (url.hostname === `www.${CANONICAL_HOST}`) {
    url.protocol = 'https:';
    url.hostname = CANONICAL_HOST;
    return Response.redirect(url.toString(), 301);
  }

  if (getOrHead && path.endsWith('/index.html')) {
    const canonicalDirectory = path.slice(0, -'index.html'.length) || '/';
    return redirect(url, canonicalDirectory, 301);
  }

  if (getOrHead && (path === '/dictionary-d1-preview' || path === '/dictionary-d1-preview.html')) {
    return redirect(url, '/', 301);
  }
  if (getOrHead && (path === '/dictionary-d1-preview-en' || path === '/dictionary-d1-preview-en.html')) {
    return redirect(url, '/en/', 301);
  }

  const legacyTarget = LEGACY_REDIRECTS.get(path);
  if (getOrHead && legacyTarget) return redirect(url, legacyTarget, 301);

  if (getOrHead && !path.endsWith('/')) {
    const slashPath = `${path}/`;
    if (EDITABLE_ROUTES.has(slashPath) || slashPath === '/en/' || slashPath === '/terimler/' || slashPath === '/en/terms/' || slashPath === '/editor/') {
      return redirect(url, slashPath, 301);
    }
  }

  if (path.startsWith('/api/editor/')) return handleEditorApi(context, path);

  const publicPageApi = path.match(/^\/api\/site-pages\/([^/]+)$/);
  if (getOrHead && publicPageApi) {
    if (!context.env.DB) return unavailable('application/json; charset=utf-8');
    return renderEditablePageJson(context.env.DB, decodeURIComponent(publicPageApi[1]));
  }

  const editorPanelRequest = path === '/editor/panel' || path === '/editor/panel/' || path === '/editor/panel/index.html';
  const privatePanelAsset = path === '/editor-panel-private' || path === '/editor-panel-private.html';
  if (getOrHead && (editorPanelRequest || privatePanelAsset)) {
    if (!(await hasEditorSession(context))) return redirect(url, '/editor/', 303);
    if (path === '/editor/panel') return redirect(url, '/editor/panel/');
    return assetRequest(context, '/editor-panel-private');
  }

  if (getOrHead && path === '/') {
    return dictionaryAssetRequest(context, '/dictionary-d1-preview', 'tr', url.searchParams.has('q') ? SEARCH_NOINDEX : {});
  }

  if (getOrHead && path === '/en/') {
    return dictionaryAssetRequest(context, '/dictionary-d1-preview-en', 'en', url.searchParams.has('q') ? SEARCH_NOINDEX : {});
  }

  const editableRoute = EDITABLE_ROUTES.get(path);
  if (getOrHead && editableRoute) {
    if (!context.env.DB) return unavailable();
    const rendered = await renderEditablePage(context.env.DB, editableRoute[0], editableRoute[1]);
    if (rendered) return rendered;
  }

  if (getOrHead && path === '/terimler/') {
    if (!context.env.DB) return unavailable();
    return renderTermsIndex(context.env.DB, 'tr');
  }

  if (getOrHead && path === '/en/terms/') {
    if (!context.env.DB) return unavailable();
    return renderTermsIndex(context.env.DB, 'en');
  }

  const trTerm = path.match(/^\/terim\/([^/]+)(\/?)$/);
  if (getOrHead && trTerm) {
    if (!trTerm[2]) return redirect(url, `/terim/${trTerm[1]}/`, 301);
    if (!context.env.DB) return unavailable();
    return renderTermPage(context.env.DB, decodeURIComponent(trTerm[1]), 'tr');
  }

  const enTerm = path.match(/^\/en\/term\/([^/]+)(\/?)$/);
  if (getOrHead && enTerm) {
    if (!enTerm[2]) return redirect(url, `/en/term/${enTerm[1]}/`, 301);
    if (!context.env.DB) return unavailable();
    return renderTermPage(context.env.DB, decodeURIComponent(enTerm[1]), 'en');
  }

  if (getOrHead && path === '/sitemap.xml') {
    if (!context.env.DB) return unavailable('application/xml; charset=utf-8');
    return renderSitemap(context.env.DB);
  }
  if (getOrHead && path === '/robots.txt') return renderRobots();

  return context.next();
}
