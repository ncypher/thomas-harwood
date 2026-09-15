CREATE TABLE IF NOT EXISTS usage_counters (
  bucket TEXT PRIMARY KEY,
  used INTEGER NOT NULL CHECK (used >= 0),
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS usage_expiry ON usage_counters(expires_at);
