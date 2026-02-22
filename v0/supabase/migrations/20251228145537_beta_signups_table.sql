-- Migration: Beta signups waitlist table

CREATE TABLE IF NOT EXISTS beta_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  experience_level experience_level NOT NULL,
  goals TEXT NOT NULL,
  hear_about_us TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invited_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_beta_signups_created_at ON beta_signups (created_at);

ALTER TABLE beta_signups ENABLE ROW LEVEL SECURITY;;
