import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { onRequest } from '../functions/_middleware.js';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function bounded(promise, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), 300); })
    ]);
  } finally { clearTimeout(timer); }
}

// An unresponsive maintenance query must not prevent either home page opening.
const blockedCleanup = deferred();
for (const path of ['/', '/en/']) {
  const background = [];
  const response = await bounded(onRequest({
    request: new Request(`https://askeriterimlersozlugu.com${path}`),
    env: {
      DB: { prepare: () => ({ all: () => blockedCleanup.promise }) },
      ASSETS: { fetch: async () => new Response('<!doctype html><head></head><body>Dictionary</body>', {
        headers: { 'Content-Type': 'text/html' }
      }) }
    },
    waitUntil: promise => background.push(promise),
    next: async () => new Response('next')
  }), 'Home page waited for publication maintenance');
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Dictionary/);
  assert.equal(background.length, 1);
}
blockedCleanup.resolve({ results: [
  { page_key: 'home-notice', body_tr: 'Published notice' },
  { page_key: 'publication-note', body_tr: 'Published note' }
] });

const flush = () => new Promise(resolve => setImmediate(resolve));
const jsonResponse = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const term = slug => ({ slug, headword_en: slug, ottoman_period_term: 'Period term', sources: [] });

async function clientHarness(filename) {
  const html = await readFile(new URL(`../${filename}`, import.meta.url), 'utf8');
  const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]).find(source => source.includes('const LIMIT=30;'));
  assert.ok(script);
  const elements = new Map();
  function element() {
    const classes = new Set();
    return {
      value: '', textContent: '', innerHTML: '', style: {}, disabled: false,
      classList: {
        add: value => classes.add(value), remove: value => classes.delete(value),
        contains: value => classes.has(value), toggle() {}
      },
      setAttribute() {}, addEventListener() {}, focus() {},
      querySelector(selector) { return selector === '.detail-editor-actions' && this.innerHTML.includes('detail-editor-actions') ? {} : null; },
      insertAdjacentHTML(_position, value) { this.innerHTML += value; }
    };
  }
  const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  const timers = new Map();
  const calls = new Map();
  const responders = new Map();
  const session = deferred();
  let clock = 1000;
  let timerId = 0;
  const location = new URL('https://askeriterimlersozlugu.com/');
  const context = vm.createContext({
    URL, URLSearchParams, AbortController, console,
    Date: class extends Date { static now() { return clock; } },
    location, history: { replaceState() {} }, scrollTo() {},
    document: {
      getElementById: get, querySelector: () => null,
      documentElement: element(), body: element(), addEventListener() {}
    },
    window: { location, scrollY: 0, addEventListener() {} },
    requestAnimationFrame: () => 1,
    setTimeout(callback, ms) { const id = ++timerId; timers.set(id, { callback, ms }); return id; },
    clearTimeout: id => timers.delete(id),
    async fetch(input, options = {}) {
      const path = new URL(String(input), location).pathname;
      calls.set(path, (calls.get(path) || 0) + 1);
      if (path === '/api/editor/session') return session.promise;
      if (path === '/api/site-pages/home-notice') return jsonResponse({ ok: true, page: {} });
      if (path === '/api/terms') return jsonResponse({ ok: true, items: [], total: 0 });
      if (responders.has(path)) return responders.get(path)(options);
      return jsonResponse({ ok: true, term: term(path.split('/').pop()) });
    }
  });
  const source = script.replace(/\}\)\(\);\s*$/, 'globalThis.app={detail,closeDrawer};})();');
  vm.runInContext(source, context, { timeout: 1000 });
  await flush();
  return { app: context.app, get, calls, responders, session, timers, advance: ms => { clock += ms; } };
}

for (const filename of ['dictionary-d1-preview.html', 'dictionary-d1-preview-en.html']) {
  const h = await clientHarness(filename);
  // Keep the editor request unresolved throughout these public-entry checks.
  await bounded(h.app.detail('fast'), 'Public entry waited for the editor session');
  assert.equal(h.get('detailTitle').textContent, 'fast');
  assert.ok(h.get('drawer').classList.contains('open'));
  h.app.closeDrawer();
  await h.app.detail('fast');
  assert.equal(h.calls.get('/api/terms/fast'), 1, 'A recent entry should reuse its response');
  h.advance(30001);
  await h.app.detail('fast');
  assert.equal(h.calls.get('/api/terms/fast'), 2, 'Expired entries must be refreshed');

  const older = deferred(), newer = deferred();
  h.responders.set('/api/terms/older', () => older.promise);
  h.responders.set('/api/terms/newer', () => newer.promise);
  const oldOpen = h.app.detail('older'), newOpen = h.app.detail('newer');
  newer.resolve(jsonResponse({ ok: true, term: term('newer') }));
  await newOpen;
  older.resolve(jsonResponse({ ok: true, term: term('older') }));
  await oldOpen;
  assert.equal(h.get('detailTitle').textContent, 'newer', 'A late response replaced the newer selection');

  const same = deferred();
  h.responders.set('/api/terms/same', () => same.promise);
  const first = h.app.detail('same'), second = h.app.detail('same');
  same.resolve(jsonResponse({ ok: true, term: term('same') }));
  await Promise.all([first, second]);
  assert.equal(h.calls.get('/api/terms/same'), 1, 'Concurrent clicks should share one request');

  const closed = deferred();
  h.responders.set('/api/terms/closed', () => closed.promise);
  const closing = h.app.detail('closed');
  h.app.closeDrawer();
  closed.resolve(jsonResponse({ ok: true, term: term('closed') }));
  await closing;
  assert.ok(!h.get('drawer').classList.contains('open'), 'A late response reopened a closed drawer');

  h.responders.set('/api/terms/timeout', ({ signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }));
  const timeout = h.app.detail('timeout');
  const deadline = [...h.timers.values()].find(timer => timer.ms === 12000);
  assert.ok(deadline);
  deadline.callback();
  await timeout;
  assert.match(h.get('status').textContent, filename.includes('-en') ? /too long/ : /yanıtı gecikti/);

  // The editor link still appears when authentication arrives after public data.
  await h.app.detail('fast');
  h.session.resolve(jsonResponse({ ok: true, authenticated: true }));
  await flush();
  assert.match(h.get('detail').innerHTML, /\/editor\/panel\/\?term=fast/);
}
console.log('Response checks passed: stalled maintenance/session, cache expiry, shared requests, stale responses, close, timeout and delayed editor controls in both languages.');
