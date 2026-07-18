import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { json } from '../functions/_lib/http.js';
import { renderRobots, renderSitemap, renderTermPage, renderTermsIndex } from '../functions/_lib/site.js';
import { onRequest } from '../functions/_middleware.js';

const ORIGIN = 'https://askeriterimlersozlugu.com';
const terms = [
  {
    id: 1,
    slug: '1st-corps',
    headword_en: '1st Corps',
    ottoman_period_term: 'Birinci Kolordu',
    modern_equivalent_tr: '1. Kolordu',
    category: 'Teşkilat',
    explanation_tr: 'Bir askerî teşkilat terimidir.',
    explanation_en: 'A military organization term.',
    updated_at: '2026-07-16T10:00:00Z',
    published_at: '2026-07-15T10:00:00Z',
    version: 1
  },
  {
    id: 2,
    slug: 'absolute-government',
    headword_en: 'Absolute Government',
    ottoman_period_term: 'Hükûmet-i Mutlaka',
    modern_equivalent_tr: 'Mutlakiyet',
    category: 'Diplomasi/Siyaset',
    explanation_tr: 'Mutlak yönetim.',
    explanation_en: 'Absolute rule.',
    updated_at: '2026-07-17T10:00:00Z',
    published_at: '2026-07-15T10:00:00Z',
    version: 1
  }
];

function fakeDb() {
  return {
    prepare(sql) {
      const statement = {
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async all() {
          if (/FROM term_variants/.test(sql)) {
            return { results: this.args[0] === 2 ? [{ variant: 'Absolute rule', variant_type: 'variant', language: 'en' }] : [] };
          }
          if (/FROM term_sources/.test(sql)) {
            return { results: this.args[0] === 2 ? [{ citation: 'Test source', url: 'https://example.com/source', source_type: 'book', page_reference: '1' }] : [] };
          }
          if (/SELECT slug, headword_en, updated_at/.test(sql)) {
            return { results: terms.map(({ slug, headword_en, updated_at }) => ({ slug, headword_en, updated_at })) };
          }
          throw new Error(`Unhandled all() query: ${sql}`);
        },
        async first() {
          if (/FROM terms/.test(sql) && /WHERE slug/.test(sql)) {
            return terms.find(term => term.slug === this.args[0]) || null;
          }
          if (/FROM site_pages/.test(sql)) {
            const dates = {
              'home-notice': '2026-07-17T09:00:00Z',
              'publication-note': '2026-07-10T09:00:00Z',
              bibliography: '2026-07-11T09:00:00Z'
            };
            return dates[this.args[0]] ? { page_key: this.args[0], updated_at: dates[this.args[0]] } : null;
          }
          throw new Error(`Unhandled first() query: ${sql}`);
        }
      };
      return statement;
    }
  };
}

function jsonLdFrom(html) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match, 'JSON-LD block is missing');
  return JSON.parse(match[1]);
}

function assertStaticHome(html, { titleStart, canonical, tr, en }) {
  assert.match(html, new RegExp(`<title>${titleStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.equal((html.match(/<link rel="canonical"/g) || []).length, 1);
  assert.ok(html.includes(`<link rel="canonical" href="${canonical}">`));
  assert.ok(html.includes(`<link rel="alternate" hreflang="tr" href="${tr}">`));
  assert.ok(html.includes(`<link rel="alternate" hreflang="en" href="${en}">`));
  assert.ok(html.includes(`<link rel="alternate" hreflang="x-default" href="${ORIGIN}/">`));
  assert.equal(jsonLdFrom(html)['@graph'][0]['@type'], 'WebSite');
}

async function middlewareResponse(path, { host = 'askeriterimlersozlugu.com', db = fakeDb() } = {}) {
  const request = new Request(`https://${host}${path}`);
  return onRequest({
    request,
    env: {
      DB: db,
      ASSETS: {
        fetch: async () => new Response('<!doctype html><title>asset</title>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        })
      }
    },
    next: async () => new Response('next')
  });
}

const [trHome, enHome] = await Promise.all([
  readFile(new URL('../dictionary-d1-preview.html', import.meta.url), 'utf8'),
  readFile(new URL('../dictionary-d1-preview-en.html', import.meta.url), 'utf8')
]);
assertStaticHome(trHome, {
  titleStart: 'Askerî Terimler Sözlüğü',
  canonical: `${ORIGIN}/`,
  tr: `${ORIGIN}/`,
  en: `${ORIGIN}/en/`
});
assertStaticHome(enHome, {
  titleStart: 'Military Terms Dictionary',
  canonical: `${ORIGIN}/en/`,
  tr: `${ORIGIN}/`,
  en: `${ORIGIN}/en/`
});

const db = fakeDb();
const trTerm = await renderTermPage(db, 'absolute-government', 'tr');
const trTermHtml = await trTerm.text();
assert.equal(trTerm.status, 200);
assert.ok(trTermHtml.includes('hreflang="x-default" href="https://askeriterimlersozlugu.com/terim/absolute-government/"'));
assert.ok(trTermHtml.includes('href="/en/term/absolute-government/" lang="en"'));
assert.ok(trTermHtml.includes('<span class="label">Harf</span><div class="value">A</div>'));
assert.ok(jsonLdFrom(trTermHtml)['@graph'].some(node => node['@type'] === 'BreadcrumbList'));

const enTerm = await renderTermPage(db, 'absolute-government', 'en');
const enTermHtml = await enTerm.text();
assert.ok(enTermHtml.includes('href="/terim/absolute-government/" lang="tr"'));
assert.ok(enTermHtml.includes('Modern Turkish: Mutlakiyet.'));

const missing = await renderTermPage(db, 'missing', 'tr');
assert.equal(missing.status, 404);
assert.equal(missing.headers.get('x-robots-tag'), 'noindex, follow');
assert.ok((await missing.text()).includes('name="robots" content="noindex,follow"'));

const indexResponse = await renderTermsIndex(db, 'tr');
const indexHtml = await indexResponse.text();
assert.ok(indexHtml.includes('id="letter-number"'));
assert.ok(indexHtml.includes('id="letter-a"'));
assert.ok(indexHtml.includes('/terim/absolute-government/'));
assert.ok(jsonLdFrom(indexHtml)['@graph'].some(node => node['@type'] === 'CollectionPage'));

const sitemap = await renderSitemap(db);
const sitemapXml = await sitemap.text();
assert.equal((sitemapXml.match(/<loc>/g) || []).length, 12);
assert.ok(sitemapXml.includes('<lastmod>2026-07-17</lastmod>'));
assert.ok(!sitemapXml.includes('/gizlilik-politikasi/'));
assert.ok(!sitemapXml.includes('/en/contact/'));

const robots = await renderRobots();
assert.ok((await robots.text()).includes(`Sitemap: ${ORIGIN}/sitemap.xml`));

const apiResponse = json({ ok: true });
assert.equal(apiResponse.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');

const queryHome = await middlewareResponse('/?q=army');
assert.equal(queryHome.status, 200);
assert.equal(queryHome.headers.get('x-robots-tag'), 'noindex, follow');

for (const [path, location] of [
  ['/index.html', `${ORIGIN}/`],
  ['/en', `${ORIGIN}/en/`],
  ['/dictionary-d1-preview.html', `${ORIGIN}/`],
  ['/gizlilik', `${ORIGIN}/gizlilik-politikasi/`],
  ['/terim/absolute-government', `${ORIGIN}/terim/absolute-government/`]
]) {
  const response = await middlewareResponse(path);
  assert.equal(response.status, 301, `${path} must redirect permanently`);
  assert.equal(response.headers.get('location'), location);
}

const www = await middlewareResponse('/terimler/?test=1', { host: 'www.askeriterimlersozlugu.com' });
assert.equal(www.status, 301);
assert.equal(www.headers.get('location'), `${ORIGIN}/terimler/?test=1`);

const noDbSitemap = await middlewareResponse('/sitemap.xml', { db: null });
assert.equal(noDbSitemap.status, 503);
assert.equal(noDbSitemap.headers.get('x-robots-tag'), 'noindex, follow');

console.log('SEO checks passed.');
