PRAGMA foreign_keys = ON;

ALTER TABLE terms RENAME COLUMN modern_tr TO modern_equivalent_tr;
DROP INDEX IF EXISTS idx_terms_modern_tr;
CREATE INDEX IF NOT EXISTS idx_terms_modern_equivalent_tr ON terms(modern_equivalent_tr);
