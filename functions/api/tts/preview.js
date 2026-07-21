import { handleTtsApi } from '../../_lib/tts.js';

export async function onRequest(context) {
  return handleTtsApi(context, new URL(context.request.url).pathname);
}
