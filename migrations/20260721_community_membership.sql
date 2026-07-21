-- Askerî Terimler Sözlüğü · Topluluk / Üyelik katmanı
-- Üyelik sözlüğe erişim için zorunlu değildir. Editör kimlik doğrulamasından tamamen ayrıdır.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS community_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  display_name TEXT,
  institution TEXT,
  interest_area TEXT,
  locale TEXT NOT NULL DEFAULT 'tr' CHECK (locale IN ('tr','en')),
  notify_new_terms INTEGER NOT NULL DEFAULT 0 CHECK (notify_new_terms IN (0,1)),
  notify_updates INTEGER NOT NULL DEFAULT 0 CHECK (notify_updates IN (0,1)),
  email_verified_at TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))
);

CREATE INDEX IF NOT EXISTS idx_community_users_verified
  ON community_users(email_verified_at, is_active);
CREATE INDEX IF NOT EXISTS idx_community_users_notifications
  ON community_users(is_active, email_verified_at, notify_new_terms, notify_updates);

CREATE TABLE IF NOT EXISTS community_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES community_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_community_sessions_user ON community_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_community_sessions_expiry ON community_sessions(expires_at);

CREATE TABLE IF NOT EXISTS community_verification_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES community_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_community_verification_user ON community_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_community_verification_expiry ON community_verification_tokens(expires_at);

CREATE TABLE IF NOT EXISTS community_favorites (
  user_id TEXT NOT NULL,
  term_slug TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, term_slug),
  FOREIGN KEY (user_id) REFERENCES community_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_community_favorites_slug ON community_favorites(term_slug);

CREATE TABLE IF NOT EXISTS community_contributions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  term_slug TEXT,
  suggestion_type TEXT NOT NULL DEFAULT 'correction' CHECK (suggestion_type IN ('correction','source','new-term','other')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed','accepted','rejected')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES community_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_community_contributions_status ON community_contributions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_community_contributions_user ON community_contributions(user_id, created_at);

-- İsteğe bağlı bildirim açık rızaları aydınlatma kaydından ayrı tutulur.
CREATE TABLE IF NOT EXISTS community_consents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('notify_new_terms','notify_updates')),
  granted INTEGER NOT NULL CHECK (granted IN (0,1)),
  consent_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES community_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_community_consents_user ON community_consents(user_id, consent_type, created_at);

-- IP adresinin kendisi tutulmaz; HMAC ile üretilmiş kova anahtarı saklanır.
CREATE TABLE IF NOT EXISTS community_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_community_rate_limits_window ON community_rate_limits(window_started_at);
