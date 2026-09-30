-- Encrypted sync data. The id and the auth secret are derived from the
-- student's sync key on her device; the server stores only a hash of the auth
-- secret and never sees the key or the decrypted contents. version -1 marks a
-- vault that was erased.
CREATE TABLE IF NOT EXISTS vaults (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  auth_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS vaults_updated_at ON vaults (updated_at);
