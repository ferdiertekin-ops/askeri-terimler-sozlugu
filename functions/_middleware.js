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

  if (getOrHead && (path === '/' || path === '/index.html')) {
    return assetRequest(context, '/dictionary-d1-preview');
  }

  if (getOrHead && path === '/en') return redirect(url, '/en/');
  if (getOrHead && (path === '/en/' || path === '/en/index.html')) {
    return assetRequest(context, '/dictionary-d1-preview-en');
  }

  if (getOrHead && path === '/editor') return redirect(url, '/editor/');
  return context.next();
}
