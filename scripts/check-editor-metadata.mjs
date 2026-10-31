import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { handleEditorApi } from '../functions/_lib/editor.js';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(await readFile(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8'));
const editorHtml = await readFile(new URL('../editor-panel-private.html', import.meta.url), 'utf8');
const parserStart = editorHtml.indexOf('function sourceUrl(value)');
const parserEnd = editorHtml.indexOf('function readSourceMemory()', parserStart);
assert.ok(parserStart >= 0 && parserEnd > parserStart, 'Source parser helpers must remain present');
const sourceParsers = new Function(
  'sourceSuggestionMap',
  `${editorHtml.slice(parserStart, parserEnd)}; return { parseSourceLine };`
)(new Map([['synthetic citation', { url: 'https://suggested.example/item' }]]));
assert.deepEqual(sourceParsers.parseSourceLine('Synthetic citation', false), {
  citation: 'Synthetic citation',
  url: ''
});
assert.deepEqual(sourceParsers.parseSourceLine('Synthetic citation | ', false), {
  citation: 'Synthetic citation',
  url: ''
});
assert.deepEqual(sourceParsers.parseSourceLine('Synthetic citation', true), {
  citation: 'Synthetic citation',
  url: 'https://suggested.example/item'
});

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
let checks = 3;

async function request(path, { method = 'GET', body, expectStatus } = {}) {
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
  if (expectStatus) {
    assert.equal(response.status, expectStatus, `${method} ${path}: ${JSON.stringify(data)}`);
    return data;
  }
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
        url: 'https://archive.example/item',
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
  const initial = metadataTerm.term;
  assert.deepEqual(initial.variants, [
    { variant: 'Synthetic spelling', variant_type: 'period-form', language: 'ota' },
    { variant: 'Synthetic alternate', variant_type: null, language: null }
  ]);
  assert.deepEqual(initial.sources, [
    {
      id: initial.sources[0].id,
      citation: 'Synthetic archival citation',
      url: 'https://archive.example/item',
      source_type: 'archive',
      page_reference: 'file 12, folio 4r',
      sort_order: 7
    },
    {
      id: initial.sources[1].id,
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
      { citation: 'Synthetic archival citation', url: 'https://archive.example/item' },
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

  const changedUrl = await request(`/api/editor/terms/${initial.slug}`, {
    method: 'PUT',
    body: {
      ...legacyShape,
      sources: [
        { source_id: initial.sources[0].id, citation: 'Synthetic archival citation', url: 'https://archive.example/revised' },
        { source_id: initial.sources[1].id, citation: 'Synthetic unclassified source', url: '' }
      ],
      expected_version: noChange.term.version
    }
  });
  assert.deepEqual(changedUrl.term.sources, [
    {
      id: initial.sources[0].id,
      citation: 'Synthetic archival citation',
      url: 'https://archive.example/revised',
      source_type: 'archive',
      page_reference: 'file 12, folio 4r',
      sort_order: 7
    },
    initial.sources[1]
  ]);
  checks += 1;

  const clearedUrl = await request(`/api/editor/terms/${initial.slug}`, {
    method: 'PUT',
    body: {
      ...legacyShape,
      sources: [
        { source_id: initial.sources[0].id, citation: 'Synthetic archival citation', url: '' },
        { source_id: initial.sources[1].id, citation: 'Synthetic unclassified source', url: '' }
      ],
      expected_version: changedUrl.term.version
    }
  });
  assert.deepEqual(clearedUrl.term.sources, [
    {
      id: initial.sources[0].id,
      citation: 'Synthetic archival citation',
      url: null,
      source_type: 'archive',
      page_reference: 'file 12, folio 4r',
      sort_order: 7
    },
    initial.sources[1]
  ]);
  checks += 1;

  const changedCitation = await request(`/api/editor/terms/${initial.slug}`, {
    method: 'PUT',
    body: {
      ...legacyShape,
      sources: [
        { source_id: initial.sources[0].id, citation: 'Synthetic revised citation', url: '' },
        { source_id: initial.sources[1].id, citation: 'Synthetic unclassified source', url: '' }
      ],
      expected_version: clearedUrl.term.version
    }
  });
  assert.equal(changedCitation.term.sources[0].citation, 'Synthetic revised citation');
  assert.equal(changedCitation.term.sources[0].url, null);
  assert.equal(changedCitation.term.sources[0].source_type, 'archive');
  assert.equal(changedCitation.term.sources[0].page_reference, 'file 12, folio 4r');
  assert.equal(changedCitation.term.sources[0].sort_order, 7);
  checks += 1;

  const edited = await request(`/api/editor/terms/${initial.slug}`, {
    method: 'PUT',
    body: {
      ...legacyShape,
      category: 'Synthetic edited category',
      sources: [
        { source_id: initial.sources[0].id, citation: 'Synthetic revised citation', url: '' },
        { source_id: initial.sources[1].id, citation: 'Synthetic unclassified source', url: '' }
      ],
      expected_version: changedCitation.term.version
    }
  });
  assert.equal(edited.term.category, 'Synthetic edited category');
  assert.deepEqual(edited.term.variants, initial.variants);
  assert.equal(edited.term.sources[0].citation, 'Synthetic revised citation');
  const revision = sqlite.prepare(`
    SELECT snapshot_json FROM term_revisions WHERE term_id = ?1 ORDER BY revision_no DESC LIMIT 1
  `).get(initial.id);
  const snapshot = JSON.parse(revision.snapshot_json);
  assert.deepEqual(snapshot.variants, initial.variants);
  assert.deepEqual(snapshot.sources.map(source => ({
    citation: source.citation,
    url: source.url,
    source_type: source.source_type,
    page_reference: source.page_reference,
    sort_order: source.sort_order
  })), edited.term.sources.map(source => ({
    citation: source.citation,
    url: source.url,
    source_type: source.source_type,
    page_reference: source.page_reference,
    sort_order: source.sort_order
  })));
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
    id: legacyCreate.term.sources[0].id,
    citation: 'Synthetic legacy source',
    url: null,
    source_type: null,
    page_reference: null,
    sort_order: 0
  }]);
  checks += 1;

  const duplicateCitations = await request('/api/editor/terms', {
    method: 'POST',
    body: {
      headword_en: 'Synthetic Duplicate Citation Entry',
      slug: 'synthetic-duplicate-citation-entry',
      sources: [
        { citation: 'Synthetic duplicate citation', url: 'https://first.example/item', source_type: 'archive', page_reference: 'folio 1', sort_order: 3 },
        { citation: 'Synthetic duplicate citation', url: 'https://second.example/item', source_type: 'catalogue', page_reference: 'page 8', sort_order: 6 }
      ]
    }
  });
  const duplicateSources = duplicateCitations.term.sources;
  assert.equal(duplicateSources.length, 2);

  const duplicateUpdate = await request(`/api/editor/terms/${duplicateCitations.term.slug}`, {
    method: 'PUT',
    body: {
      headword_en: duplicateCitations.term.headword_en,
      slug: duplicateCitations.term.slug,
      status: duplicateCitations.term.status,
      sources: [
        { source_id: duplicateSources[0].id, citation: 'Synthetic duplicate citation', url: 'https://first.example/updated' },
        { source_id: duplicateSources[1].id, citation: 'Synthetic duplicate citation revised', url: 'https://second.example/updated' },
        { citation: 'Synthetic added source', url: 'https://added.example/item' }
      ],
      expected_version: duplicateCitations.term.version
    }
  });
  assert.deepEqual(duplicateUpdate.term.sources, [
    {
      id: duplicateUpdate.term.sources.find(source => source.citation === 'Synthetic added source').id,
      citation: 'Synthetic added source',
      url: 'https://added.example/item',
      source_type: null,
      page_reference: null,
      sort_order: 2
    },
    {
      id: duplicateSources[0].id,
      citation: 'Synthetic duplicate citation',
      url: 'https://first.example/updated',
      source_type: 'archive',
      page_reference: 'folio 1',
      sort_order: 3
    },
    {
      id: duplicateSources[1].id,
      citation: 'Synthetic duplicate citation revised',
      url: 'https://second.example/updated',
      source_type: 'catalogue',
      page_reference: 'page 8',
      sort_order: 6
    }
  ]);
  const deletedSource = await request(`/api/editor/terms/${duplicateUpdate.term.slug}`, {
    method: 'PUT',
    body: {
      headword_en: duplicateUpdate.term.headword_en,
      slug: duplicateUpdate.term.slug,
      status: duplicateUpdate.term.status,
      sources: [{ source_id: duplicateSources[0].id, citation: 'Synthetic duplicate citation', url: 'https://first.example/updated' }],
      expected_version: duplicateUpdate.term.version
    }
  });
  assert.equal(deletedSource.term.sources.length, 1);
  assert.equal(deletedSource.term.sources[0].id, duplicateSources[0].id);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM term_sources WHERE term_id = ?1')
    .get(duplicateCitations.term.id).count, 1);
  checks += 1;

  const ambiguousSources = await request('/api/editor/terms', {
    method: 'POST',
    body: {
      headword_en: 'Synthetic Ambiguous Citation Entry',
      slug: 'synthetic-ambiguous-citation-entry',
      sources: [
        { citation: 'Synthetic ambiguous citation', url: 'https://ambiguous-a.example/item', source_type: 'archive', page_reference: 'folio A', sort_order: 4 },
        { citation: 'Synthetic ambiguous citation', url: 'https://ambiguous-b.example/item', source_type: 'catalogue', page_reference: 'folio B', sort_order: 8 }
      ]
    }
  });
  const ambiguousLegacyUpdate = await request(`/api/editor/terms/${ambiguousSources.term.slug}`, {
    method: 'PUT',
    body: {
      headword_en: ambiguousSources.term.headword_en,
      slug: ambiguousSources.term.slug,
      status: ambiguousSources.term.status,
      sources: [{ citation: 'Synthetic ambiguous citation', url: 'https://ambiguous-new.example/item' }],
      expected_version: ambiguousSources.term.version
    },
    expectStatus: 400
  });
  assert.equal(ambiguousLegacyUpdate.error, 'ambiguous_source_identity');
  const unchangedAmbiguous = (await request(`/api/editor/terms/${ambiguousSources.term.slug}`)).term;
  assert.deepEqual(unchangedAmbiguous.sources, ambiguousSources.term.sources);
  checks += 1;

  console.log(`Editor metadata checks passed: ${checks} authenticated create/edit/no-op and legacy-payload scenarios.`);
} finally {
  sqlite.close();
}
