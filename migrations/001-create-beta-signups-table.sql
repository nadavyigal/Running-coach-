-- Migration: Create beta_signups table for beta waitlist signups
-- Date: 2026-01-22
-- Author: RunSmart Team
-- Issue: Beta signup form fails because table doesn't exist

-- Create beta_signups table with all required columns
CREATE TABLE IF NOT EXISTS beta_signups (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  experience_level TEXT NOT NULL CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  goals TEXT NOT NULL, -- JSON array stored as text (e.g., '["habit","race"]')
  hear_about_us TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invited_at TIMESTAMPTZ, -- When we sent beta invite
  converted_at TIMESTAMPTZ -- When they signed up for full account
);

-- Add comment to table
COMMENT ON TABLE beta_signups IS 'Stores beta waitlist signups from landing page';
COMMENT ON COLUMN beta_signups.email IS 'User email address (unique)';
COMMENT ON COLUMN beta_signups.experience_level IS 'Running experience: beginner, intermediate, or advanced';
COMMENT ON COLUMN beta_signups.goals IS 'JSON array of goals: habit, race, fitness, injury_prevention';
COMMENT ON COLUMN beta_signups.hear_about_us IS 'How they heard about RunSmart';
COMMENT ON COLUMN beta_signups.invited_at IS 'When we sent them a beta invite';
COMMENT ON COLUMN beta_signups.converted_at IS 'When they created a full account';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_beta_signups_email ON beta_signups(email);
CREATE INDEX IF NOT EXISTS idx_beta_signups_created_at ON beta_signups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_signups_invited_at ON beta_signups(invited_at) WHERE invited_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_beta_signups_converted_at ON beta_signups(converted_at) WHERE converted_at IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE beta_signups ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Allow anonymous inserts" ON beta_signups;
DROP POLICY IF EXISTS "Allow authenticated inserts" ON beta_signups;
DROP POLICY IF EXISTS "Service role full access" ON beta_signups;

-- Policy 1: Allow anonymous users to insert (for public signup form)
CREATE POLICY "Allow anonymous inserts"
  ON beta_signups
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy 2: Allow authenticated users to insert
CREATE POLICY "Allow authenticated inserts"
  ON beta_signups
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy 3: Only service role can read/update/delete (admin access only)
CREATE POLICY "Service role full access"
  ON beta_signups
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Verification queries (run these to test)
-- SELECT * FROM beta_signups LIMIT 10;
-- SELECT COUNT(*) as total_signups FROM beta_signups;
-- SELECT COUNT(*) as invited FROM beta_signups WHERE invited_at IS NOT NULL;
-- SELECT COUNT(*) as converted FROM beta_signups WHERE converted_at IS NOT NULL;
