const PREVIEW_HOST = 'askeri-terimler-sozlugu-preview.pages.dev';

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (
    url.hostname === PREVIEW_HOST &&
    context.request.method === 'GET' &&
    (url.pathname === '/' || url.pathname === '/index.html')
  ) {
    const previewUrl = new URL('/dictionary-d1-preview.html', url);
    return context.env.ASSETS.fetch(new Request(previewUrl, context.request));
  }

  return context.next();
}
