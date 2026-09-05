-- BE-04: Initial database schema migration
-- Tieout — employment verification aggregate tables
--
-- This migration creates all 11 required tables with proper
-- foreign keys, unique constraints, and indexes.
--
-- Run: psql -d recheq -f db/migrations/0001_initial_schema.sql

BEGIN;

-- ─── Extensions ─────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Organizations ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(500) NOT NULL,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─── Users ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID         NOT NULL REFERENCES organizations(id),
  email       VARCHAR(320) NOT NULL UNIQUE,
  name        VARCHAR(500) NOT NULL,
  role        VARCHAR(50)  NOT NULL DEFAULT 'verifier',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─── Cases ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID           NOT NULL REFERENCES organizations(id),
  created_by       UUID           NOT NULL REFERENCES users(id),
  employer_name    VARCHAR(500)   NOT NULL,
  candidate_name   VARCHAR(500)   NOT NULL,
  title            VARCHAR(1000)  NOT NULL,
  claimed_ctc      NUMERIC(15,2)  NOT NULL,
  employment_start DATE           NOT NULL,
  employment_end   DATE           NOT NULL,
  uan              VARCHAR(20),
  status           VARCHAR(30)    NOT NULL DEFAULT 'draft',
  verdict          VARCHAR(30),
  risk_score       INTEGER        CHECK (risk_score IS NULL OR (risk_score >= 0 AND risk_score <= 100)),
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cases_org_id ON cases(org_id);

-- ─── Consents ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID         NOT NULL REFERENCES cases(id),
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
  consent_text    TEXT         NOT NULL,
  consent_version VARCHAR(50)  NOT NULL,
  granted_at      TIMESTAMPTZ,
  ip_address      VARCHAR(45),
  user_agent      TEXT,
  withdrawn_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  token_hash      VARCHAR(64)  UNIQUE
);

-- ─── Documents ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id           UUID         NOT NULL REFERENCES cases(id),
  kind              VARCHAR(20)  NOT NULL,
  status            VARCHAR(20)  NOT NULL DEFAULT 'pending',
  original_filename VARCHAR(500) NOT NULL,
  mime_type         VARCHAR(100) NOT NULL,
  sha256            VARCHAR(64)  NOT NULL,
  size_bytes        INTEGER      NOT NULL,
  storage_path      TEXT         NOT NULL,
  uploaded_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT uq_documents_case_sha256 UNIQUE (case_id, sha256)
);

-- ─── Extractions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS extractions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID         NOT NULL REFERENCES documents(id),
  model_id        VARCHAR(100),
  schema_version  VARCHAR(20)  NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
  extracted_data  JSONB,
  token_usage     JSONB,
  error_message   TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

-- ─── Forensics ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forensics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       UUID         NOT NULL UNIQUE REFERENCES documents(id),
  producer          TEXT,
  creator           TEXT,
  creation_date     TIMESTAMPTZ,
  modification_date TIMESTAMPTZ,
  font_runs         JSONB,
  monetary_anomalies JSONB,
  metadata_raw      JSONB,
  status            VARCHAR(20)  NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

-- ─── EPFO Records ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS epfo_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id             UUID         NOT NULL REFERENCES cases(id),
  uan                 VARCHAR(20)  NOT NULL,
  consent_id          UUID         NOT NULL REFERENCES consents(id),
  employment_history  JSONB,
  status              VARCHAR(20)  NOT NULL DEFAULT 'pending',
  error_message       TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ
);

-- ─── Findings ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS findings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id              UUID         NOT NULL REFERENCES cases(id),
  rule_id              VARCHAR(100) NOT NULL,
  severity             VARCHAR(10)  NOT NULL,
  status               VARCHAR(20)  NOT NULL DEFAULT 'open',
  title                VARCHAR(500) NOT NULL,
  explanation          TEXT         NOT NULL,
  expected             TEXT,
  observed             TEXT,
  source_document_ids  UUID[],
  dispute_reason       TEXT,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─── Employer Requests ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employer_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID         NOT NULL REFERENCES cases(id),
  token_hash      VARCHAR(64)  UNIQUE,
  employer_email  VARCHAR(320) NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
  sent_at         TIMESTAMPTZ,
  responded_at    TIMESTAMPTZ,
  response_data   JSONB,
  reminder_count  INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ  NOT NULL
);

-- ─── Audit Events ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID         NOT NULL REFERENCES cases(id),
  seq         INTEGER      NOT NULL,
  kind        VARCHAR(50)  NOT NULL,
  payload     JSONB        NOT NULL,
  hash        VARCHAR(64)  NOT NULL,
  prev_hash   VARCHAR(64),
  actor       VARCHAR(200) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT uq_events_case_seq UNIQUE (case_id, seq)
);

COMMIT;
