import { handleEditorApi } from './_lib/editor.js';
import { renderRobots, renderSitemap, renderTermPage, renderTermsIndex } from './_lib/site.js';

function redirect(url, pathname, status = 308) {
  const target = new URL(url);
  target.pathname = pathname;
  return Response.redirect(target.toString(), status);
}

function assetRequest(context, pathname) {
  const target = new URL(context.request.url);
  target.pathname = pathname;
  target.search = '';
  return context.env.ASSETS.fetch(new Request(target, context.request));
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const getOrHead = context.request.method === 'GET' || context.request.method === 'HEAD';

  if (path.startsWith('/api/editor/')) return handleEditorApi(context, path);

  if (getOrHead && (path === '/' || path === '/index.html')) {
    return assetRequest(context, '/dictionary-d1-preview');
  }

  if (getOrHead && path === '/en') return redirect(url, '/en/');
  if (getOrHead && (path === '/en/' || path === '/en/index.html')) {
    return assetRequest(context, '/dictionary-d1-preview-en');
  }

  if (getOrHead && path === '/editor') return redirect(url, '/editor/');

  if (getOrHead && path === '/terimler') return redirect(url, '/terimler/');
  if (getOrHead && path === '/terimler/') {
    if (!context.env.DB) return context.next();
    return renderTermsIndex(context.env.DB, 'tr');
  }

  if (getOrHead && path === '/en/terms') return redirect(url, '/en/terms/');
  if (getOrHead && path === '/en/terms/') {
    if (!context.env.DB) return context.next();
    return renderTermsIndex(context.env.DB, 'en');
  }

  const trTerm = path.match(/^\/terim\/([^/]+)(\/?)$/);
  if (getOrHead && trTerm) {
    if (!trTerm[2]) return redirect(url, `/terim/${trTerm[1]}/`);
    if (!context.env.DB) return context.next();
    return renderTermPage(context.env.DB, decodeURIComponent(trTerm[1]), 'tr');
  }

  const enTerm = path.match(/^\/en\/term\/([^/]+)(\/?)$/);
  if (getOrHead && enTerm) {
    if (!enTerm[2]) return redirect(url, `/en/term/${enTerm[1]}/`);
    if (!context.env.DB) return context.next();
    return renderTermPage(context.env.DB, decodeURIComponent(enTerm[1]), 'en');
  }

  if (getOrHead && path === '/sitemap.xml' && context.env.DB) return renderSitemap(context.env.DB);
  if (getOrHead && path === '/robots.txt') return renderRobots();

  return context.next();
}
