const PREVIEW_HOST = 'askeri-terimler-sozlugu-preview.pages.dev';
const SPEECH_SCRIPT = '<script src="/speech-pronunciation.js" defer></script>';

async function injectSpeechLayer(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const html = await response.text();
  const body = html.includes(SPEECH_SCRIPT)
    ? html
    : html.replace('</body>', `${SPEECH_SCRIPT}</body>`);

  const headers = new Headers(response.headers);
  headers.delete('content-length');

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (
    url.hostname === PREVIEW_HOST &&
    context.request.method === 'GET' &&
    (url.pathname === '/' || url.pathname === '/index.html')
  ) {
    const previewUrl = new URL('/dictionary-d1-preview.html', url);
    const response = await context.env.ASSETS.fetch(
      new Request(previewUrl, context.request),
    );
    return injectSpeechLayer(response);
  }

  if (
    url.hostname === PREVIEW_HOST &&
    context.request.method === 'GET' &&
    url.pathname === '/dictionary-d1-preview.html'
  ) {
    return injectSpeechLayer(await context.next());
  }

  return context.next();
}
