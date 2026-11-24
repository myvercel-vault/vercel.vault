ALTER TABLE accounts ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;

CREATE TABLE email_challenges (
  email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL,
  PRIMARY KEY (email, purpose),
  FOREIGN KEY(email) REFERENCES accounts(email) ON DELETE CASCADE
);

CREATE INDEX email_challenges_expires ON email_challenges(expires);

UPDATE accounts SET email_verified = 1;
