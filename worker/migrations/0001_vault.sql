PRAGMA foreign_keys = ON;

CREATE TABLE accounts (
  email TEXT PRIMARY KEY,
  salt TEXT NOT NULL,
  verifier TEXT NOT NULL,
  iv TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES accounts(email) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);
CREATE INDEX sessions_account ON sessions(email);
CREATE INDEX sessions_expires ON sessions(expires);

CREATE TABLE rate_limits (
  scope TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  hits INTEGER NOT NULL,
  PRIMARY KEY (scope, bucket)
);
CREATE INDEX rate_limits_bucket ON rate_limits(bucket);
