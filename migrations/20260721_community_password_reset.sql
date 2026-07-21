CREATE TABLE IF NOT EXISTS community_password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES community_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_community_password_reset_user ON community_password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_community_password_reset_expiry ON community_password_reset_tokens(expires_at);
