-- Migration: 001_init.sql for eventhive_issuer

CREATE TABLE IF NOT EXISTS event_keys (
  event_id UUID NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('feedback', 'pulse', 'question', 'qvote')),
  public_key_jwk JSONB NOT NULL,
  private_key_enc BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, purpose)
);

CREATE TABLE IF NOT EXISTS eligibility (
  event_id UUID NOT NULL,
  user_id UUID NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('feedback', 'pulse', 'question', 'qvote')),
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  max_tokens INTEGER NOT NULL,
  issued_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, user_id, purpose)
);

CREATE TABLE IF NOT EXISTS issuance_log (
  event_id UUID NOT NULL,
  user_id UUID NOT NULL,
  purpose TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  blind_signatures JSONB NOT NULL,
  PRIMARY KEY (event_id, user_id, purpose, request_hash)
);
