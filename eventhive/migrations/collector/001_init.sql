-- Migration: 001_init.sql for eventhive_collector

CREATE TABLE IF NOT EXISTS events_public (
  event_id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  feedback_window_ends_at TIMESTAMPTZ NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('open', 'closed')),
  closed_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ,
  sealed BOOLEAN NOT NULL DEFAULT false,
  write_guard UUID NOT NULL DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public_keys (
  event_id UUID NOT NULL,
  purpose TEXT NOT NULL,
  public_key_jwk JSONB NOT NULL,
  fingerprint TEXT NOT NULL,
  PRIMARY KEY (event_id, purpose)
);

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events_public(event_id),
  token_hash CHAR(64) NOT NULL UNIQUE,
  overall SMALLINT NOT NULL CHECK (overall >= 1 AND overall <= 5),
  content SMALLINT NOT NULL CHECK (content >= 1 AND content <= 5),
  delivery SMALLINT NOT NULL CHECK (delivery >= 1 AND delivery <= 5),
  venue SMALLINT NOT NULL CHECK (venue >= 1 AND venue <= 5),
  value SMALLINT NOT NULL CHECK (value >= 1 AND value <= 5),
  topic TEXT NOT NULL,
  would_recommend BOOLEAN NOT NULL,
  comment TEXT CHECK (length(comment) <= 500)
);

CREATE TABLE IF NOT EXISTS spent_tokens (
  purpose TEXT NOT NULL,
  event_id UUID NOT NULL,
  token_hash TEXT NOT NULL,
  CONSTRAINT unique_spent_token UNIQUE (purpose, token_hash)
);

CREATE TABLE IF NOT EXISTS pulse_buckets (
  event_id UUID NOT NULL,
  bucket_start TIMESTAMPTZ NOT NULL,
  mood TEXT NOT NULL CHECK (mood IN ('loving', 'confusing', 'lost', 'too_slow')),
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, bucket_start, mood)
);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  body TEXT NOT NULL CHECK (length(body) <= 200),
  votes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('open', 'answered', 'hidden'))
);

CREATE TABLE IF NOT EXISTS event_reports (
  event_id UUID PRIMARY KEY,
  version INTEGER NOT NULL CHECK (version = 1),
  report JSONB NOT NULL,
  released_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to make event_reports insert-only
CREATE OR REPLACE FUNCTION prevent_report_update_or_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'event_reports rows are insert-only and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_report_update_or_delete ON event_reports;
CREATE TRIGGER trg_prevent_report_update_or_delete
BEFORE UPDATE OR DELETE ON event_reports
FOR EACH ROW
EXECUTE FUNCTION prevent_report_update_or_delete();
