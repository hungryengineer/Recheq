-- Tokens: purpose-bound invite tokens (consent, employer).
-- Only the SHA-256 hash of the raw token is stored.
CREATE TABLE IF NOT EXISTS tokens (
  hash        VARCHAR(64)  PRIMARY KEY,
  case_id     UUID         NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  purpose     VARCHAR(20)  NOT NULL,
  expires_at  TIMESTAMPTZ  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tokens_case_id ON tokens (case_id);
