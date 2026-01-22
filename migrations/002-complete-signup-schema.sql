-- Migration: Complete signup schema for beta and application signups
-- Date: 2026-01-22
-- Author: RunSmart Team
-- Description: Creates both beta_signups and profiles tables with proper relationships
-- Business Logic:
--   1. Beta signup → creates beta_signups entry + Supabase Auth user + profiles entry
--   2. App signup → creates Supabase Auth user + profiles entry only

-- ============================================================================
-- PART 1: Beta Signups Table (Marketing/Waitlist)
-- ============================================================================

-- Create beta_signups table
CREATE TABLE IF NOT EXISTS beta_signups (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  experience_level TEXT NOT NULL CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  goals TEXT NOT NULL, -- JSON array stored as text
  hear_about_us TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invited_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  -- Link to actual user account if they complete signup
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  profile_id BIGINT
);

-- Indexes for beta_signups
CREATE INDEX IF NOT EXISTS idx_beta_signups_email ON beta_signups(email);
CREATE INDEX IF NOT EXISTS idx_beta_signups_created_at ON beta_signups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_signups_auth_user_id ON beta_signups(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Comments for beta_signups
COMMENT ON TABLE beta_signups IS 'Beta waitlist signups - these users get auto-created accounts';
COMMENT ON COLUMN beta_signups.auth_user_id IS 'Links to auth.users when account is created';
COMMENT ON COLUMN beta_signups.profile_id IS 'Links to profiles table';
COMMENT ON COLUMN beta_signups.converted_at IS 'When beta signup converted to full account';

-- ============================================================================
-- PART 2: Profiles Table (Application User Accounts)
-- ============================================================================

-- Create profiles table for application users
CREATE TABLE IF NOT EXISTS profiles (
  id BIGSERIAL PRIMARY KEY,
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  
  -- Onboarding data
  goal TEXT CHECK (goal IN ('habit', 'race', 'fitness', 'weight_loss', 'injury_prevention')),
  experience TEXT CHECK (experience IN ('beginner', 'intermediate', 'advanced')),
  preferred_times TEXT[], -- Array of time preferences
  days_per_week INTEGER CHECK (days_per_week >= 1 AND days_per_week <= 7),
  onboarding_complete BOOLEAN DEFAULT FALSE,
  
  -- Optional profile data
  age INTEGER CHECK (age >= 13 AND age <= 120),
  rpe INTEGER CHECK (rpe >= 1 AND rpe <= 10),
  average_weekly_km NUMERIC(10, 2) CHECK (average_weekly_km >= 0),
  
  -- Subscription data
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium', 'enterprise')),
  subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'cancelled', 'expired')),
  trial_start_date TIMESTAMPTZ,
  trial_end_date TIMESTAMPTZ,
  
  -- Beta user flag
  is_beta_user BOOLEAN DEFAULT FALSE,
  beta_signup_id BIGINT REFERENCES beta_signups(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_beta_user ON profiles(is_beta_user) WHERE is_beta_user = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_subscription ON profiles(subscription_tier, subscription_status);

-- Comments for profiles
COMMENT ON TABLE profiles IS 'Application user profiles - one per authenticated user';
COMMENT ON COLUMN profiles.is_beta_user IS 'TRUE if user came from beta signup';
COMMENT ON COLUMN profiles.beta_signup_id IS 'Links back to beta_signups if applicable';

-- ============================================================================
-- PART 3: Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE beta_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Allow anonymous inserts" ON beta_signups;
DROP POLICY IF EXISTS "Allow authenticated inserts" ON beta_signups;
DROP POLICY IF EXISTS "Service role full access" ON beta_signups;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Service role full access profiles" ON profiles;

-- Beta signups policies
CREATE POLICY "Allow anonymous inserts"
  ON beta_signups
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated inserts"
  ON beta_signups
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role full access"
  ON beta_signups
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Profiles policies
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = auth_user_id);

-- Allow service role to access during signup
CREATE POLICY "Service role full access profiles"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow anon to create profiles during beta signup
CREATE POLICY "Allow anon profile creation"
  ON profiles
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- ============================================================================
-- PART 4: Trigger to Update updated_at on profiles
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 5: Helper Function to Link Beta Signup to Profile
-- ============================================================================

CREATE OR REPLACE FUNCTION link_beta_signup_to_profile(
  p_email TEXT,
  p_auth_user_id UUID,
  p_profile_id BIGINT
)
RETURNS VOID AS $$
BEGIN
  UPDATE beta_signups
  SET 
    auth_user_id = p_auth_user_id,
    profile_id = p_profile_id,
    converted_at = NOW()
  WHERE email = p_email
    AND auth_user_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION link_beta_signup_to_profile(TEXT, UUID, BIGINT) TO authenticated, service_role, anon;

-- ============================================================================
-- VERIFICATION QUERIES (commented out - run manually to test)
-- ============================================================================

-- Check beta signups
-- SELECT id, email, experience_level, auth_user_id, profile_id, created_at, converted_at FROM beta_signups ORDER BY created_at DESC LIMIT 10;

-- Check profiles
-- SELECT id, email, goal, experience, is_beta_user, beta_signup_id, created_at FROM profiles ORDER BY created_at DESC LIMIT 10;

-- Check linked records
-- SELECT 
--   bs.email,
--   bs.experience_level,
--   bs.created_at as beta_signup_date,
--   p.id as profile_id,
--   p.onboarding_complete,
--   bs.converted_at
-- FROM beta_signups bs
-- LEFT JOIN profiles p ON bs.profile_id = p.id
-- ORDER BY bs.created_at DESC;
