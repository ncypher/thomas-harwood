CREATE TABLE IF NOT EXISTS usage_counters (
  bucket TEXT PRIMARY KEY,
  used INTEGER NOT NULL CHECK (used >= 0),
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS usage_expiry ON usage_counters(expires_at);
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  site TEXT, name TEXT, contact TEXT NOT NULL, org TEXT, start TEXT, team TEXT, tools TEXT,
  brief TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  note TEXT
);
