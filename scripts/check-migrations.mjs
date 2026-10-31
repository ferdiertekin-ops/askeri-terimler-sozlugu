import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

const migrationDirectory = new URL('../migrations/', import.meta.url);
const migrationFiles = (await readdir(migrationDirectory))
  .filter(file => file.endsWith('.sql'))
  .sort();
assert.ok(migrationFiles.length > 0, 'Migration directory must contain SQL migrations');

async function applyMigration(db, file) {
  db.exec(await readFile(new URL(file, migrationDirectory), 'utf8'));
}

function assertFinalSchema(db) {
  const columns = db.prepare('PRAGMA table_info(terms)').all().map(column => column.name);
  assert.ok(columns.includes('modern_equivalent_tr'));
  assert.ok(!columns.includes('modern_tr'));
  assert.ok(!columns.includes('confidence'));
  assert.ok(db.prepare(`
    SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'community_users'
  `).get());
  assert.ok(db.prepare(`
    SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'community_password_reset_tokens'
  `).get());
}

const emptyDatabase = new DatabaseSync(':memory:');
try {
  for (const file of migrationFiles) await applyMigration(emptyDatabase, file);
  assertFinalSchema(emptyDatabase);
} finally {
  emptyDatabase.close();
}

const seededDatabase = new DatabaseSync(':memory:');
try {
  await applyMigration(seededDatabase, migrationFiles[0]);
  const termId = Number(seededDatabase.prepare(`
    INSERT INTO terms (slug, headword_en, modern_tr, confidence)
    VALUES ('synthetic-migration-check', 'Synthetic term', 'Synthetic equivalent', 'high')
  `).run().lastInsertRowid);
  seededDatabase.prepare(`
    INSERT INTO term_variants (term_id, variant, variant_type, language)
    VALUES (?1, 'Synthetic variant', 'period-form', 'ota')
  `).run(termId);
  seededDatabase.prepare(`
    INSERT INTO term_sources (term_id, citation, url, source_type, page_reference, sort_order)
    VALUES (?1, 'Synthetic citation', 'https://example.test/source', 'archive', 'folio 1', 4)
  `).run(termId);
  seededDatabase.prepare(`
    INSERT INTO term_revisions (term_id, revision_no, snapshot_json, change_note)
    VALUES (?1, 1, '{"synthetic":true}', 'synthetic migration check')
  `).run(termId);

  for (const file of migrationFiles.slice(1)) await applyMigration(seededDatabase, file);
  assertFinalSchema(seededDatabase);
  assert.deepEqual({ ...seededDatabase.prepare(`
    SELECT slug, headword_en, modern_equivalent_tr FROM terms WHERE id = ?1
  `).get(termId) }, {
    slug: 'synthetic-migration-check',
    headword_en: 'Synthetic term',
    modern_equivalent_tr: 'Synthetic equivalent'
  });
  assert.equal(seededDatabase.prepare('SELECT COUNT(*) AS count FROM term_variants WHERE term_id = ?1').get(termId).count, 1);
  assert.equal(seededDatabase.prepare('SELECT COUNT(*) AS count FROM term_sources WHERE term_id = ?1').get(termId).count, 1);
  assert.equal(seededDatabase.prepare('SELECT COUNT(*) AS count FROM term_revisions WHERE term_id = ?1').get(termId).count, 1);
} finally {
  seededDatabase.close();
}

console.log(`Migration checks passed: ${migrationFiles.length} ordered migrations on an empty database and synthetic data preservation.`);
