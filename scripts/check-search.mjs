import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { onRequest } from '../functions/api/terms.js';

// Exercise the real endpoint and SQL against an isolated SQLite database.
// These fixtures test spelling and ranking, not historical equivalences.
const sqlite = new DatabaseSync(':memory:');
const migrationDirectory = new URL('../migrations/', import.meta.url);
for (const file of (await readdir(migrationDirectory)).filter(name => name.endsWith('.sql')).sort()) {
  sqlite.exec(await readFile(new URL(file, migrationDirectory), 'utf8'));
}
const insert = sqlite.prepare(`INSERT INTO terms
  (id, slug, headword_en, ottoman_period_term, modern_equivalent_tr, category, status)
  VALUES (?, ?, ?, ?, ?, ?, ?)`);
const fixtures = [
  [1, 'second-lieutenant', 'Second Lieutenant', 'Mülâzım-ı Sânî', 'Asteğmen', 'Rütbe', 'published'],
  [2, 'first-lieutenant', 'First Lieutenant', 'Mülâzım-ı Evvel', 'Üsteğmen', 'Rütbe', 'published'],
  [3, 'abbreviation-test', 'Abbreviation fixture', '', '', '', 'published'],
  [4, 'separate-variants', 'Separate variants fixture', '', '', '', 'published'],
  [5, 'chief-of-staff', 'Chief of Staff', 'Erkân-ı Harbiye', '', '', 'published'],
  [6, 'single-variant', 'Single variant fixture', '', '', '', 'published'],
  [7, 'chief', 'Chief', '', '', '', 'published'],
  [8, 'apostrophe', 'Apostrophe fixture', 'a’yan', '', '', 'published'],
  [9, 'unpublished', 'Unpublished sentinel', 'Mülâzım-ı Sânî', '', '', 'draft'],
  [10, 'ascii-acronym', 'ASCII abbreviation fixture', '', '', '', 'published']
];
for (const row of fixtures) insert.run(...row);
const addVariant = sqlite.prepare('INSERT INTO term_variants (term_id, variant) VALUES (?, ?)');
for (const pair of [[3, 'C.O.S.'], [4, 'alpha'], [4, 'bravo'], [5, 'Army Chief'], [5, 'General Staff'], [6, 'Army Chief'], [10, 'RNR']]) {
  addVariant.run(...pair);
}

const db = {
  prepare(sql) {
    const statement = sqlite.prepare(sql);
    let values = [];
    return {
      bind(...args) { values = args; return this; },
      async all() { return { results: statement.all(...values) }; },
      async first() { return statement.get(...values); }
    };
  }
};
let checks = 0;
async function search(q, extra = {}) {
  const url = new URL('https://example.test/api/terms');
  if (q !== undefined) url.searchParams.set('q', q);
  for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
  const response = await onRequest({ request: new Request(url, { headers: { 'cf-ray': 'search-test' } }), env: { DB: db } });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  checks++;
  return data;
}
const ids = data => data.items.map(row => row.id);
async function expectIds(q, expected, extra) {
  assert.deepEqual(ids(await search(q, extra)), expected, q);
}

try {
  for (const q of ['mülâzım', 'MULAZIM', 'MÜLÂZIM', 'mu\u0308la\u0302zım']) await expectIds(q, [1, 2]);
  for (const q of ['Mülâzım-ı Sânî', 'mulazim i sani', 'MÜLÂZIM–I SÂNÎ', 'sani mulazim', 'sân mül']) await expectIds(q, [1]);
  for (const q of ['astegmen', 'ASTEĞMEN']) await expectIds(q, [1]);
  for (const q of ['C.O.S.', 'COS', 'cos']) await expectIds(q, [3]);
  for (const q of ['RNR', 'R.N.R.']) await expectIds(q, [10]);
  for (const q of ['a’yan', "a'yan", 'ayan']) await expectIds(q, [8]);
  await expectIds('staff chief', [5]);
  await expectIds('Army Chief', [5, 6]);
  assert.equal(ids(await search('chief'))[0], 7, 'Exact headword must rank first');
  for (const q of ['alpha bravo', 'bravo alpha', 'alpha', 'bravo']) {
    await expectIds(q, q.includes(' ') ? [] : [4]);
  }
  await expectIds('army erkan', []); // Do not manufacture matches across fields.
  for (const q of ['???', '   --- ', 'unpublished sentinel', 'mulazim sani unrelated']) await expectIds(q, []);
  await expectIds('mulazim', [2], { letter: 'F' });
  const page = await search('mulazim', { limit: '1', offset: '1' });
  assert.deepEqual(ids(page), [2]);
  assert.equal(page.total, 2);
  assert.equal(page.hasPrevious, true);
  assert.equal(page.hasNext, false);
  assert.equal(page.normalizedQuery, 'mulazim');
  assert.ok(!Object.hasOwn(page.items[0], 'variants_search'));
  const listing = await search(undefined, { limit: '2' });
  assert.equal(listing.total, 9);
  assert.equal(listing.items.length, 2);
  assert.equal(listing.hasNext, true);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM terms').get().n, 10);
  console.log(`Search checks passed: ${checks} endpoint requests, real SQLite SQL, ranking, variants, publication filter and pagination.`);
} finally {
  sqlite.close();
}
