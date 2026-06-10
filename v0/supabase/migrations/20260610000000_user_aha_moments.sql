-- Run via: supabase db push or Supabase dashboard

CREATE TABLE IF NOT EXISTS user_aha_moments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users NOT NULL,
  moment_id     TEXT NOT NULL,
  context       TEXT,
  variant       TEXT,
  fired_at      TIMESTAMPTZ DEFAULT NOW(),
  cta_clicked   BOOLEAN DEFAULT FALSE,
  dismissed_at  TIMESTAMPTZ,
  shared        BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, moment_id, context)
);

CREATE INDEX IF NOT EXISTS idx_user_aha_moments_user_id ON user_aha_moments(user_id);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS runner_identity TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS goal_timeline_weeks INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS projected_goal_date DATE;
