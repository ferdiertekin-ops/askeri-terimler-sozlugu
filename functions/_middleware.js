import { handleEditorApi, hasEditorSession } from './_lib/editor.js';
import { handleCommunityApi, sendCommunityNotification } from './_lib/community.js';
import { json, methodNotAllowed } from './_lib/http.js';
import { renderEditablePage, renderEditablePageJson, renderRobots, renderSitemap, renderTermPage, renderTermsIndex } from './_lib/site.js';

const CANONICAL_HOST = 'askeriterimlersozlugu.com';
const SEARCH_NOINDEX = { 'X-Robots-Tag': 'noindex, follow' };

const DICTIONARY_VISUAL_POLISH = `
<style id="ats-visual-polish">
:root{--claude-canvas:#f8f8f6;--claude-surface:#ffffff;--ats-navy:#2f4e71;--ats-navy-deep:#20395a}
html,body{background:#f8f8f6!important}
body{background-image:none!important;background-color:#f8f8f6!important}
.preview-brand{gap:0!important}
.preview-brand__name{display:none!important}
.preview-hero{padding:12px 0 8px!important}
.preview-eyebrow{margin-bottom:7px!important;gap:14px!important;font-size:10px!important;letter-spacing:.21em!important}
.preview-eyebrow::before,.preview-eyebrow::after{width:54px!important}
.preview-title{gap:4px!important}
.preview-title__top{font-size:14px!important;letter-spacing:.33em!important;text-indent:.33em!important}
.preview-title__main{font-size:clamp(42px,5vw,64px)!important;line-height:1.02!important;letter-spacing:-.02em!important}
.preview-title__date{gap:18px!important;font-size:13px!important;letter-spacing:.24em!important;text-indent:.24em!important}
.preview-title__date::before,.preview-title__date::after{width:52px!important}
.preview-beta{margin-top:2px!important;font-size:10.5px!important;letter-spacing:.14em!important}
.preview-search-tools{margin-top:6px!important}
.preview-search-tools.is-stuck{background:rgba(248,248,246,.96)!important}
.preview-search-row{background:#ffffff!important;border-color:#deded8!important;box-shadow:0 1px 2px rgba(30,39,50,.05),0 14px 32px -26px rgba(32,57,90,.34),inset 0 1px 0 rgba(255,255,255,.96)!important}
.preview-search-row:hover{border-color:#b8c2cd!important}
.preview-search-row:focus-within{border-color:#7f95ad!important;box-shadow:0 0 0 3px rgba(47,78,113,.10),0 16px 34px -28px rgba(32,57,90,.34)!important}
.list-head{background:linear-gradient(180deg,#2f4e71 0%,#294766 100%)!important;border-top-color:#20395a!important;border-bottom-color:#20395a!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 5px 14px -12px rgba(32,57,90,.58)}
.list-head span{color:#f8f8f6!important;text-shadow:0 1px 0 rgba(0,0,0,.14)}
.community-auth-nav{display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
.community-auth-nav a{min-height:36px;display:inline-flex;align-items:center;justify-content:center;padding:0 11px;border-radius:8px;text-decoration:none;font:600 12px Cambria,Georgia,serif}
.community-auth-nav .community-login{border:1px solid #cfc7b8;background:#fffefa;color:#2f4e71}
.community-auth-nav .community-signup{border:1px solid #2f4e71;background:#2f4e71;color:#fffefa}
.community-editor-access{margin:8px 0 0;text-align:center;font:10px/1.2 Calibri,"Segoe UI",sans-serif}.community-editor-access a{color:#9b9994;text-decoration:none}
@media(max-width:760px){
  .preview-hero{padding:11px 0 7px!important}
  .preview-eyebrow{font-size:9.5px!important;letter-spacing:.18em!important;gap:10px!important}
  .preview-eyebrow::before,.preview-eyebrow::after{width:32px!important}
  .preview-title__top{font-size:13px!important}
  .preview-title__main{font-size:clamp(36px,9vw,50px)!important;line-height:1.04!important}
  .preview-title__date{font-size:12px!important;gap:14px!important}
  .preview-title__date::before,.preview-title__date::after{width:36px!important}
}
@media(max-width:560px){.community-auth-nav{gap:5px}.community-auth-nav a{min-height:32px;padding:0 8px;font-size:10.5px}}
</style>`;

const COMMUNITY_ROUTES = new Set([
  '/uye-ol/','/oturum-ac/','/hesabim/','/parola-yenile/','/uyelik-aydinlatma/',
  '/en/sign-up/','/en/sign-in/','/en/account/','/en/reset-password/','/en/membership-notice/',
  '/editor/community/'
]);

const EDITABLE_ROUTES = new Map([
  ['/yayin-notu/', ['publication-note', 'tr']], ['/en/publication-note/', ['publication-note', 'en']],
  ['/kaynakca/', ['bibliography', 'tr']], ['/en/bibliography/', ['bibliography', 'en']],
  ['/gizlilik-politikasi/', ['privacy', 'tr']], ['/en/privacy-policy/', ['privacy', 'en']],
  ['/cerez-politikasi/', ['cookies', 'tr']], ['/en/cookie-policy/', ['cookies', 'en']],
  ['/kullanim-sartlari/', ['terms-of-use', 'tr']], ['/en/terms-of-use/', ['terms-of-use', 'en']],
  ['/iletisim/', ['contact', 'tr']], ['/en/contact/', ['contact', 'en']]
]);

const LEGACY_REDIRECTS = new Map([
  ['/gizlilik', '/gizlilik-politikasi/'], ['/gizlilik/', '/gizlilik-politikasi/'],
  ['/cerezler', '/cerez-politikasi/'], ['/cerezler/', '/cerez-politikasi/'],
  ['/en/privacy', '/en/privacy-policy/'], ['/en/privacy/', '/en/privacy-policy/'],
  ['/en/cookies', '/en/cookie-policy/'], ['/en/cookies/', '/en/cookie-policy/']
]);

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function communityEnabled(env) {
  return enabled(env.COMMUNITY_FEATURE_ENABLED) &&
    Boolean(env.DB) &&
    String(env.COMMUNITY_SECURITY_SECRET || '').trim().length >= 32 &&
    Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY) &&
    Boolean(env.CF_ACCOUNT_ID && env.CF_EMAIL_API_TOKEN && env.COMMUNITY_EMAIL_FROM);
}

function ttsEnabled(env) {
  return enabled(env.TTS_FEATURE_ENABLED) && Boolean(env.GOOGLE_TTS_CLIENT_EMAIL && env.GOOGLE_TTS_PRIVATE_KEY);
}

function redirect(url, pathname, status = 308) {
  const target = new URL(url); target.pathname = pathname; return Response.redirect(target.toString(), status);
}

async function assetRequest(context, pathname, extraHeaders = {}) {
  const target = new URL(context.request.url); target.pathname = pathname; target.search = '';
  const response = await context.env.ASSETS.fetch(new Request(target, context.request));
  if (!Object.keys(extraHeaders).length) return response;
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function stripInstallLinks(html) {
  return html.replace(/\s*<a class="install-app-link" href="[^"]*">[^<]*<\/a>\s*/gi, ' ').replace(/\s*·\s*·\s*/g, ' · ');
}

function stripBrandName(html) {
  return html.replace(/\s*<span class="preview-brand__name">[^<]*<\/span>\s*/gi, '\n');
}

function applyEditorShortcut(html, authenticated, lang) {
  if (!authenticated) return html;
  const tr = lang !== 'en';
  const href = tr ? '/editor/panel/?new=1&return=%2F' : '/editor/panel/?new=1&return=%2Fen%2F';
  const label = tr ? '＋ Yeni madde' : '＋ New entry';
  const title = tr ? 'Yeni sözlük maddesi ekle' : 'Add a new dictionary entry';
  return html.replace(/<a class="preview-editor-link" href="\/editor\/"[^>]*>[^<]*<\/a>/i, `<a class="preview-editor-link" href="${href}" title="${title}">${label}</a>`);
}

function communityNav(lang) {
  const tr = lang !== 'en';
  return `<nav class="community-auth-nav" data-community-nav data-lang="${tr ? 'tr' : 'en'}" aria-label="${tr ? 'Üyelik' : 'Membership'}"><a class="community-login" href="${tr ? '/oturum-ac/' : '/en/sign-in/'}">${tr ? 'Oturum Aç' : 'Sign in'}</a><a class="community-signup" href="${tr ? '/uye-ol/' : '/en/sign-up/'}">${tr ? 'Üye Ol' : 'Join'}</a></nav>`;
}

function applyCommunityControls(html, editorAuthenticated, lang) {
  const nav = communityNav(lang);
  const editorSpan = /<span data-nosnippet>\s*<a class="preview-editor-link"[^>]*>[^<]*<\/a>\s*<\/span>/i;
  let result;
  if (editorAuthenticated) {
    const dashboard = `<a class="preview-editor-link" href="/editor/community/" title="${lang === 'en' ? 'Community dashboard' : 'Topluluk paneli'}">${lang === 'en' ? 'Community' : 'Topluluk'}</a>`;
    result = html.replace(editorSpan, match => `${nav}${dashboard}${match}`);
  } else {
    result = html.replace(editorSpan, nav);
    const label = lang === 'en' ? 'Editor' : 'Editör';
    if (!result.includes('community-editor-access')) result = result.replace('</footer>', `<p class="community-editor-access" data-nosnippet><a href="/editor/">${label}</a></p></footer>`);
  }
  if (!result.includes('/assets/community-nav.js')) result = result.replace('</body>', '<script src="/assets/community-nav.js" defer></script>\n<script src="/assets/community-dictionary.js" defer></script>\n</body>');
  return result;
}

function injectTurkishTtsClient(html) {
  if (html.includes('/assets/ats-tr-tts.js')) return html;
  return html.replace('</body>', '<script src="/assets/ats-tr-tts.js" defer></script>\n</body>');
}

function applyDictionaryVisualPolish(html, authenticated = false, lang = 'tr', features = {}) {
  let cleaned = stripInstallLinks(html);
  cleaned = stripBrandName(cleaned);
  cleaned = applyEditorShortcut(cleaned, authenticated, lang);
  if (features.community) cleaned = applyCommunityControls(cleaned, authenticated, lang);
  if (features.tts) cleaned = injectTurkishTtsClient(cleaned);
  if (cleaned.includes('id="ats-visual-polish"')) return cleaned;
  return cleaned.replace('</head>', `${DICTIONARY_VISUAL_POLISH}\n</head>`);
}

async function dictionaryAssetRequest(context, pathname, lang, extraHeaders = {}) {
  const response = await assetRequest(context, pathname, extraHeaders);
  if (context.request.method === 'HEAD' || !response.ok) return response;
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html')) return response;
  const authenticated = await hasEditorSession(context);
  const html = applyDictionaryVisualPolish(await response.text(), authenticated, lang, {
    community: communityEnabled(context.env),
    tts: ttsEnabled(context.env)
  });
  const headers = new Headers(response.headers);
  headers.delete('Content-Length'); headers.delete('Content-Encoding'); headers.delete('ETag');
  headers.set('Cache-Control', 'no-cache, must-revalidate');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

async function communityRenderedResponse(response, request, env) {
  if (!response || request.method === 'HEAD' || !response.ok) return response;
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html')) return response;
  let html = await response.text();
  if (communityEnabled(env) && !html.includes('/assets/community-nav.js')) html = html.replace('</body>', '<script src="/assets/community-nav.js" defer></script>\n</body>');
  if (ttsEnabled(env)) html = injectTurkishTtsClient(html);
  const headers = new Headers(response.headers);
  headers.delete('Content-Length'); headers.delete('Content-Encoding'); headers.delete('ETag');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}

async function editorCommunitySummary(context) {
  if (!communityEnabled(context.env)) return json({ ok:false, error:'membership_not_enabled' }, { status:503 });
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  if (!(await hasEditorSession(context))) return json({ ok:false, error:'unauthorized' }, { status:401 });
  if (!context.env.DB) return json({ ok:false, error:'database_not_configured' }, { status:503 });
  try {
    const [counts, recent, interests, contributions] = await Promise.all([
      context.env.DB.prepare(`SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN email_verified_at IS NOT NULL AND is_active=1 THEN 1 ELSE 0 END) AS verified,
        SUM(CASE WHEN email_verified_at IS NOT NULL AND is_active=1 AND created_at>=datetime('now','-30 days') THEN 1 ELSE 0 END) AS last30,
        SUM(CASE WHEN notify_new_terms=1 AND email_verified_at IS NOT NULL AND is_active=1 THEN 1 ELSE 0 END) AS new_term_optins,
        SUM(CASE WHEN notify_updates=1 AND email_verified_at IS NOT NULL AND is_active=1 THEN 1 ELSE 0 END) AS update_optins,
        (SELECT COUNT(*) FROM community_favorites) AS favorites,
        (SELECT COUNT(*) FROM community_contributions WHERE status='new') AS open_contributions
        FROM community_users`).first(),
      context.env.DB.prepare(`SELECT email,display_name,institution,interest_area,locale,created_at,last_login_at
        FROM community_users WHERE email_verified_at IS NOT NULL AND is_active=1 ORDER BY created_at DESC LIMIT 40`).all(),
      context.env.DB.prepare(`SELECT COALESCE(NULLIF(interest_area,''),'unspecified') AS interest_area,COUNT(*) AS count
        FROM community_users WHERE email_verified_at IS NOT NULL AND is_active=1 GROUP BY COALESCE(NULLIF(interest_area,''),'unspecified') ORDER BY count DESC`).all(),
      context.env.DB.prepare(`SELECT c.id,c.term_slug,c.suggestion_type,c.message,c.status,c.created_at,u.email,u.display_name
        FROM community_contributions c JOIN community_users u ON u.id=c.user_id ORDER BY c.created_at DESC LIMIT 50`).all()
    ]);
    return json({ ok:true, counts:{
      total:Number(counts?.total||0), verified:Number(counts?.verified||0), last30:Number(counts?.last30||0),
      newTermOptins:Number(counts?.new_term_optins||0), updateOptins:Number(counts?.update_optins||0),
      favorites:Number(counts?.favorites||0), openContributions:Number(counts?.open_contributions||0)
    }, recentMembers:recent.results||[], interests:interests.results||[], contributions:contributions.results||[] });
  } catch (error) {
    return json({ ok:false, error:'community_schema_not_ready', message:String(error?.message||error) }, { status:503 });
  }
}

async function handleEditorApiWithNotifications(context, path) {
  const response = await handleEditorApi(context, path);
  const isCreate = path === '/api/editor/terms' && context.request.method === 'POST';
  const isUpdate = /^\/api\/editor\/terms\/[^/]+$/.test(path) && context.request.method === 'PUT';
  if (!response.ok || (!isCreate && !isUpdate) || !communityEnabled(context.env)) return response;
  try {
    const data = await response.clone().json();
    const term = data?.term;
    if (data?.ok && term?.status === 'published') {
      context.waitUntil(sendCommunityNotification(context.env, {
        kind: isCreate ? 'new-term' : 'update',
        slug: term.slug,
        headword: term.headword_en,
        modern: term.modern_equivalent_tr || '',
        explanation: term.explanation_tr || ''
      }));
    }
  } catch {}
  return response;
}

function unavailable(type = 'text/html; charset=utf-8') {
  let body = '<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="robots" content="noindex,follow"><title>Geçici olarak kullanılamıyor</title><p>Hizmet kısa süre içinde yeniden denenecektir.</p></html>';
  if (type.startsWith('application/json')) body = JSON.stringify({ ok:false, error:'service_unavailable' });
  if (type.startsWith('application/xml')) body = '<?xml version="1.0" encoding="UTF-8"?><error>service_unavailable</error>';
  return new Response(body, { status:503, headers:{ 'Content-Type':type, 'Cache-Control':'no-store', 'Retry-After':'300', 'X-Robots-Tag':'noindex, follow' } });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const getOrHead = context.request.method === 'GET' || context.request.method === 'HEAD';
  const communityOn = communityEnabled(context.env);

  if (url.hostname === `www.${CANONICAL_HOST}`) { url.protocol='https:'; url.hostname=CANONICAL_HOST; return Response.redirect(url.toString(),301); }
  if (getOrHead && path.endsWith('/index.html')) return redirect(url, path.slice(0,-'index.html'.length)||'/',301);
  if (getOrHead && (path === '/dictionary-d1-preview' || path === '/dictionary-d1-preview.html')) return redirect(url,'/',301);
  if (getOrHead && (path === '/dictionary-d1-preview-en' || path === '/dictionary-d1-preview-en.html')) return redirect(url,'/en/',301);

  const legacyTarget = LEGACY_REDIRECTS.get(path);
  if (getOrHead && legacyTarget) return redirect(url,legacyTarget,301);
  if (getOrHead && !path.endsWith('/')) {
    const slashPath = `${path}/`;
    if (EDITABLE_ROUTES.has(slashPath) || COMMUNITY_ROUTES.has(slashPath) || slashPath==='/en/' || slashPath==='/terimler/' || slashPath==='/en/terms/' || slashPath==='/editor/') return redirect(url,slashPath,301);
  }

  if (path === '/api/account/config') {
    if (communityOn) return handleCommunityApi(context,path);
    return json({
      ok:true,
      featureEnabled:false,
      turnstileSiteKey:'',
      turnstileConfigured:false,
      emailConfigured:false,
      registrationReady:false,
      consentVersion:'2026-07-21'
    });
  }
  if (path.startsWith('/api/account/')) {
    if (!communityOn) return json({ ok:false, error:'membership_not_enabled' }, { status:503 });
    return handleCommunityApi(context,path);
  }
  if (path === '/api/editor/community-summary') return editorCommunitySummary(context);
  if (path.startsWith('/api/editor/')) return handleEditorApiWithNotifications(context,path);

  const publicPageApi = path.match(/^\/api\/site-pages\/([^/]+)$/);
  if (getOrHead && publicPageApi) {
    if (!context.env.DB) return unavailable('application/json; charset=utf-8');
    return renderEditablePageJson(context.env.DB,decodeURIComponent(publicPageApi[1]));
  }

  const editorPanelRequest = path==='/editor/panel' || path==='/editor/panel/' || path==='/editor/panel/index.html';
  const privatePanelAsset = path==='/editor-panel-private' || path==='/editor-panel-private.html';
  const communityPanelRequest = path==='/editor/community' || path==='/editor/community/' || path==='/editor/community/index.html';
  const privateCommunityAsset = path==='/editor-community-private' || path==='/editor-community-private.html';
  if (getOrHead && (editorPanelRequest || privatePanelAsset || communityPanelRequest || privateCommunityAsset)) {
    if (!(await hasEditorSession(context))) return redirect(url,'/editor/',303);
    if ((communityPanelRequest || privateCommunityAsset) && !communityOn) return redirect(url,'/',303);
    if (path==='/editor/panel') return redirect(url,'/editor/panel/');
    if (path==='/editor/community') return redirect(url,'/editor/community/');
    if (communityPanelRequest || privateCommunityAsset) return assetRequest(context,'/editor-community-private');
    return assetRequest(context,'/editor-panel-private');
  }

  if (getOrHead && path==='/') return dictionaryAssetRequest(context,'/dictionary-d1-preview','tr',url.searchParams.has('q')?SEARCH_NOINDEX:{});
  if (getOrHead && path==='/en/') return dictionaryAssetRequest(context,'/dictionary-d1-preview-en','en',url.searchParams.has('q')?SEARCH_NOINDEX:{});

  const editableRoute = EDITABLE_ROUTES.get(path);
  if (getOrHead && editableRoute) {
    if (!context.env.DB) return unavailable();
    const rendered = await renderEditablePage(context.env.DB,editableRoute[0],editableRoute[1]);
    if (rendered) return communityRenderedResponse(rendered,context.request,context.env);
  }

  if (getOrHead && path==='/terimler/') {
    if (!context.env.DB) return unavailable();
    return communityRenderedResponse(await renderTermsIndex(context.env.DB,'tr'),context.request,context.env);
  }
  if (getOrHead && path==='/en/terms/') {
    if (!context.env.DB) return unavailable();
    return communityRenderedResponse(await renderTermsIndex(context.env.DB,'en'),context.request,context.env);
  }

  const trTerm = path.match(/^\/terim\/([^/]+)(\/?)$/);
  if (getOrHead && trTerm) {
    if (!trTerm[2]) return redirect(url,`/terim/${trTerm[1]}/`,301);
    if (!context.env.DB) return unavailable();
    return communityRenderedResponse(await renderTermPage(context.env.DB,decodeURIComponent(trTerm[1]),'tr'),context.request,context.env);
  }
  const enTerm = path.match(/^\/en\/term\/([^/]+)(\/?)$/);
  if (getOrHead && enTerm) {
    if (!enTerm[2]) return redirect(url,`/en/term/${enTerm[1]}/`,301);
    if (!context.env.DB) return unavailable();
    return communityRenderedResponse(await renderTermPage(context.env.DB,decodeURIComponent(enTerm[1]),'en'),context.request,context.env);
  }

  if (getOrHead && path==='/sitemap.xml') {
    if (!context.env.DB) return unavailable('application/xml; charset=utf-8');
    return renderSitemap(context.env.DB);
  }
  if (getOrHead && path==='/robots.txt') return renderRobots();
  return context.next();
}
