PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  headword_en TEXT NOT NULL,
  ottoman_period_term TEXT,
  modern_equivalent_tr TEXT,
  category TEXT,
  explanation_tr TEXT,
  explanation_en TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','review','published','suspended')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  published_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS term_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  variant TEXT NOT NULL,
  variant_type TEXT,
  language TEXT,
  UNIQUE(term_id, variant)
);

CREATE TABLE IF NOT EXISTS term_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  citation TEXT NOT NULL,
  url TEXT,
  source_type TEXT,
  page_reference TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS term_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  revision_no INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  change_note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(term_id, revision_no)
);

CREATE TABLE IF NOT EXISTS site_pages (
  page_key TEXT PRIMARY KEY,
  title_tr TEXT,
  title_en TEXT,
  body_tr TEXT,
  body_en TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  request_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_terms_headword_en ON terms(headword_en);
CREATE INDEX IF NOT EXISTS idx_terms_modern_equivalent_tr ON terms(modern_equivalent_tr);
CREATE INDEX IF NOT EXISTS idx_terms_status ON terms(status);
CREATE INDEX IF NOT EXISTS idx_variants_variant ON term_variants(variant);
CREATE INDEX IF NOT EXISTS idx_sources_term_sort ON term_sources(term_id, sort_order);
