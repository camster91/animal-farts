-- Additive Cloudflare v1 schema. Never run against or replace the VPS database.
CREATE TABLE IF NOT EXISTS recordings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, emoji TEXT NOT NULL, device_id TEXT NOT NULL,
  kid_name TEXT, filename TEXT NOT NULL UNIQUE, duration_sec REAL,
  upvotes INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
  client_operation_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_recordings_device_id ON recordings(device_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recordings_device_operation
  ON recordings(device_id, client_operation_id) WHERE client_operation_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS share_codes (
  code TEXT PRIMARY KEY, audio_url TEXT NOT NULL, name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '💨', created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_share_codes_created ON share_codes(created_at);
CREATE INDEX IF NOT EXISTS idx_share_codes_audio ON share_codes(audio_url);
CREATE TABLE IF NOT EXISTS recording_deletions (
  device_id TEXT NOT NULL, operation_id TEXT NOT NULL,
  recording_id INTEGER NOT NULL, created_at INTEGER NOT NULL,
  PRIMARY KEY (device_id, operation_id)
);
CREATE INDEX IF NOT EXISTS idx_recording_deletions_created ON recording_deletions(created_at);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT NOT NULL, window INTEGER NOT NULL, n INTEGER NOT NULL,
  PRIMARY KEY (key, window)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window);
