import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../netlify/functions/preview-public-api.js', import.meta.url), 'utf8');

function response({ status = 200, contentType = 'application/json', body = '{"ok":true}' } = {}) {
  return {
    status,
    headers: { get: name => String(name).toLowerCase() === 'content-type' ? contentType : null },
    text: async () => body
  };
}

function loadHandlers(fetchImpl) {
  const sandbox = {
    exports: {},
    fetch: fetchImpl,
    URL,
    AbortController,
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(source, sandbox, { filename: 'preview-public-api.js' });
  return {
    terms: sandbox.exports.createHandler('terms'),
    term: sandbox.exports.createHandler('term'),
    sitePage: sandbox.exports.createHandler('site-page'),
    editorSession: sandbox.exports.createHandler('editor-session')
  };
}

async function call(handler, queryStringParameters = {}, httpMethod = 'GET') {
  return handler({ httpMethod, queryStringParameters });
}

function parsed(result) {
  return result.body ? JSON.parse(result.body) : null;
}

{
  let fetchCalls = 0;
  const handler = loadHandlers(async () => { fetchCalls += 1; return response(); }).terms;
  const result = await call(handler, {}, 'POST');
  assert.equal(result.statusCode, 405);
  assert.equal(parsed(result).error, 'method_not_allowed');
  assert.equal(result.headers.Allow, 'GET, HEAD, OPTIONS');
  assert.equal(fetchCalls, 0, 'POST must never reach the live API');
}

{
  let fetchCalls = 0;
  const handler = loadHandlers(async () => { fetchCalls += 1; return response(); }).editorSession;
  const result = await call(handler);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(parsed(result), { ok: true, authenticated: false });
  assert.equal(fetchCalls, 0, 'editor session must be answered locally');
}

{
  let request;
  const handler = loadHandlers(async (url, options) => {
    request = { url: String(url), options };
    return response({ body: '{"ok":true,"items":[]}' });
  }).terms;
  const result = await call(handler, {
    limit: '10', offset: '20', q: 'army corps', ignored: 'secret'
  });
  assert.equal(result.statusCode, 200);
  assert.equal(request.url, 'https://askeriterimlersozlugu.com/api/terms?limit=10&offset=20&q=army+corps');
  assert.equal(request.options.method, 'GET');
  assert.equal(request.options.headers.Accept, 'application/json');
  assert.equal('Authorization' in request.options.headers, false);
  assert.equal('Cookie' in request.options.headers, false);
  assert.equal(result.headers['X-Robots-Tag'], 'noindex, nofollow, noarchive');
}

{
  let requestUrl;
  const handler = loadHandlers(async url => {
    requestUrl = String(url);
    return response({ status: 404, body: '{"ok":false,"error":"not_found"}' });
  }).term;
  const result = await call(handler, { slug: 'absolute-government' });
  assert.equal(requestUrl, 'https://askeriterimlersozlugu.com/api/terms/absolute-government');
  assert.equal(result.statusCode, 404, 'JSON upstream status must be preserved');
}

{
  let fetchCalls = 0;
  const handler = loadHandlers(async () => { fetchCalls += 1; return response(); }).term;
  for (const slug of ['../editor', 'bad%2Fslug', '%E0%A4%A']) {
    const result = await call(handler, { slug });
    assert.equal(result.statusCode, 400);
  }
  assert.equal(fetchCalls, 0, 'invalid path tokens must not reach the live API');
}

{
  let requestUrl;
  const handler = loadHandlers(async url => {
    requestUrl = String(url);
    return response({ body: '{"ok":true,"page":{"bodyTr":"Duyuru"}}' });
  }).sitePage;
  const result = await call(handler, { key: 'home-notice' });
  assert.equal(requestUrl, 'https://askeriterimlersozlugu.com/api/site-pages/home-notice');
  assert.equal(result.statusCode, 200);
}

{
  const handler = loadHandlers(async () => response({ contentType: 'text/html', body: '<!doctype html>' })).terms;
  const result = await call(handler);
  assert.equal(result.statusCode, 502);
  assert.equal(parsed(result).error, 'invalid_upstream_response');
}

{
  const handler = loadHandlers(async () => response({ body: 'not-json' })).terms;
  const result = await call(handler);
  assert.equal(result.statusCode, 502);
  assert.equal(parsed(result).error, 'invalid_upstream_json');
}

{
  const handler = loadHandlers(async () => { throw new Error('offline'); }).terms;
  const result = await call(handler);
  assert.equal(result.statusCode, 502);
  assert.equal(parsed(result).error, 'upstream_unavailable');
}

{
  let method;
  const handler = loadHandlers(async (_url, options) => {
    method = options.method;
    return response();
  }).terms;
  const result = await call(handler, {}, 'HEAD');
  assert.equal(method, 'HEAD');
  assert.equal(result.statusCode, 200);
  assert.equal(result.body, '');
}

console.log('Netlify Deploy Preview API kontrolleri başarılı.');
