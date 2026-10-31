import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { handleEditorApi } from '../functions/_lib/editor.js';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(await readFile(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8'));

const db = {
  prepare(sql) {
    const statement = sqlite.prepare(sql);
    let values = [];
    return {
      bind(...args) {
        values = args;
        return this;
      },
      async all() {
        return { results: statement.all(...values) };
      },
      async first() {
        return statement.get(...values);
      },
      async run() {
        const result = statement.run(...values);
        return { meta: { last_row_id: Number(result.lastInsertRowid || 0) } };
      }
    };
  },
  async batch(statements) {
    return statements.map(statement => statement.run());
  }
};

const password = 'Synthetic editor password';
const env = {
  DB: db,
  EDITOR_PASSWORD_HASH: createHash('sha256').update(password).digest('hex'),
  SESSION_SECRET: 'synthetic-session-secret-that-is-long-enough'
};
const origin = 'https://editor-metadata.test';
let cookie = '';
let csrfToken = '';
let checks = 0;

async function request(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (cookie) headers.Cookie = cookie;
  if (method !== 'GET') {
    headers.Origin = origin;
    headers['X-CSRF-Token'] = csrfToken;
    headers['Content-Type'] = 'application/json';
  }
  const response = await handleEditorApi({
    request: new Request(`${origin}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    }),
    env
  }, path.split('?')[0]);
  const data = await response.json();
  assert.equal(response.ok, true, `${method} ${path}: ${JSON.stringify(data)}`);
  assert.equal(data.ok, true);
  return data;
}

try {
  const loginResponse = await handleEditorApi({
    request: new Request(`${origin}/api/editor/login`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    }),
    env
  }, '/api/editor/login');
  const login = await loginResponse.json();
  assert.equal(loginResponse.status, 200);
  assert.equal(login.ok, true);
  cookie = loginResponse.headers.get('set-cookie').split(';', 1)[0];
  csrfToken = login.csrfToken;
  checks += 1;

  const metadataTerm = await request('/api/editor/terms', {
    method: 'POST',
    body: {
      headword_en: 'Synthetic Metadata Entry',
      slug: 'synthetic-metadata-entry',
      status: 'draft',
      variants: [
        { variant: 'Synthetic spelling', variant_type: 'period-form', language: 'ota' },
        { variant: 'Synthetic alternate', variant_type: null, language: null }
      ],
      sources: [{
        citation: 'Synthetic archival citation',
        url: 'https://example.test',
        source_type: 'archive',
        page_reference: 'file 12, folio 4r',
        sort_order: 7
      }, {
        citation: 'Synthetic unclassified source',
        url: '',
        source_type: null,
        page_reference: null,
        sort_order: 9
      }]
    }
  });
  const createdTerm = metadataTerm.term;
  sqlite.prepare('UPDATE term_sources SET url = ?1 WHERE term_id = ?2 AND citation = ?3')
    .run('https://example.test', createdTerm.id, 'Synthetic archival citation');
  const initial = (await request(`/api/editor/terms/${createdTerm.slug}`)).term;
  assert.deepEqual(initial.variants, [
    { variant: 'Synthetic spelling', variant_type: 'period-form', language: 'ota' },
    { variant: 'Synthetic alternate', variant_type: null, language: null }
  ]);
  assert.deepEqual(initial.sources, [
    {
      citation: 'Synthetic archival citation',
      url: 'https://example.test',
      source_type: 'archive',
      page_reference: 'file 12, folio 4r',
      sort_order: 7
    },
    {
      citation: 'Synthetic unclassified source',
      url: null,
      source_type: null,
      page_reference: null,
      sort_order: 9
    }
  ]);
  checks += 1;

  const legacyShape = {
    headword_en: initial.headword_en,
    slug: initial.slug,
    ottoman_period_term: initial.ottoman_period_term || '',
    modern_equivalent_tr: initial.modern_equivalent_tr || '',
    category: initial.category || '',
    explanation_tr: initial.explanation_tr || '',
    explanation_en: initial.explanation_en || '',
    status: initial.status,
    variants: ['Synthetic spelling', 'Synthetic alternate'],
    sources: [
      { citation: 'Synthetic archival citation', url: 'https://example.test/' },
      { citation: 'Synthetic unclassified source', url: '' }
    ]
  };

  const noChange = await request(`/api/editor/terms/${initial.slug}`, {
    method: 'PUT',
    body: { ...legacyShape, expected_version: initial.version }
  });
  assert.deepEqual(noChange.term.variants, initial.variants);
  assert.deepEqual(noChange.term.sources, initial.sources);
  checks += 1;

  const edited = await request(`/api/editor/terms/${initial.slug}`, {
    method: 'PUT',
    body: {
      ...legacyShape,
      category: 'Synthetic edited category',
      expected_version: noChange.term.version
    }
  });
  assert.equal(edited.term.category, 'Synthetic edited category');
  assert.deepEqual(edited.term.variants, initial.variants);
  assert.deepEqual(edited.term.sources, initial.sources);
  const revision = sqlite.prepare(`
    SELECT snapshot_json FROM term_revisions WHERE term_id = ?1 ORDER BY revision_no DESC LIMIT 1
  `).get(initial.id);
  const snapshot = JSON.parse(revision.snapshot_json);
  assert.deepEqual(snapshot.variants, initial.variants);
  assert.deepEqual(snapshot.sources, initial.sources);
  checks += 1;

  const legacyCreate = await request('/api/editor/terms', {
    method: 'POST',
    body: {
      headword_en: 'Synthetic Legacy Entry',
      slug: 'synthetic-legacy-entry',
      variants: ['Legacy variant'],
      sources: [{ citation: 'Synthetic legacy source', url: '' }]
    }
  });
  assert.deepEqual(legacyCreate.term.variants, [{
    variant: 'Legacy variant',
    variant_type: 'editor',
    language: 'en'
  }]);
  assert.deepEqual(legacyCreate.term.sources, [{
    citation: 'Synthetic legacy source',
    url: null,
    source_type: null,
    page_reference: null,
    sort_order: 0
  }]);
  checks += 1;

  console.log(`Editor metadata checks passed: ${checks} authenticated create/edit/no-op and legacy-payload scenarios.`);
} finally {
  sqlite.close();
}
