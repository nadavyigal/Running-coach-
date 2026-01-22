-- Migration: Fix beta_signups table schema
-- Date: 2026-01-22
-- Description: Drops and recreates beta_signups with proper columns for account linking
-- Run this INSTEAD of 002-complete-signup-schema.sql

-- ============================================================================
-- STEP 1: Clean up existing table and constraints
-- ============================================================================

-- Drop existing table (safe because we're in development)
DROP TABLE IF EXISTS beta_signups CASCADE;

-- Also drop profiles if it exists to recreate with proper schema
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================================================
-- STEP 2: Create beta_signups table with ALL required columns
-- ============================================================================

CREATE TABLE beta_signups (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  experience_level TEXT NOT NULL CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  goals TEXT NOT NULL,
  hear_about_us TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invited_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  -- Account linkage columns (these were missing!)
  auth_user_id UUID UNIQUE,
  profile_id BIGINT
);

-- Add foreign key constraint AFTER auth.users exists
-- Note: Will be added after we verify auth.users table exists
-- ALTER TABLE beta_signups ADD CONSTRAINT fk_beta_auth_user 
--   FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Indexes for beta_signups
CREATE INDEX idx_beta_signups_email ON beta_signups(email);
CREATE INDEX idx_beta_signups_created_at ON beta_signups(created_at DESC);
CREATE INDEX idx_beta_signups_auth_user_id ON beta_signups(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Comments
COMMENT ON TABLE beta_signups IS 'Beta waitlist signups - automatically creates full accounts';
COMMENT ON COLUMN beta_signups.auth_user_id IS 'Links to auth.users when account is created';
COMMENT ON COLUMN beta_signups.profile_id IS 'Links to profiles table';
COMMENT ON COLUMN beta_signups.converted_at IS 'When beta signup converted to full account';

-- ============================================================================
-- STEP 3: Create profiles table
-- ============================================================================

CREATE TABLE profiles (
  id BIGSERIAL PRIMARY KEY,
  auth_user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  
  -- Onboarding data
  goal TEXT CHECK (goal IN ('habit', 'race', 'fitness', 'weight_loss', 'injury_prevention')),
  experience TEXT CHECK (experience IN ('beginner', 'intermediate', 'advanced')),
  preferred_times TEXT[],
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
  
  -- Beta user tracking
  is_beta_user BOOLEAN DEFAULT FALSE,
  beta_signup_id BIGINT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key constraints AFTER both tables exist
-- Note: auth.users is managed by Supabase, so we skip that FK for now
-- ALTER TABLE profiles ADD CONSTRAINT fk_profiles_auth_user 
--   FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE profiles ADD CONSTRAINT fk_profiles_beta_signup 
  FOREIGN KEY (beta_signup_id) REFERENCES beta_signups(id) ON DELETE SET NULL;

-- Indexes for profiles
CREATE INDEX idx_profiles_auth_user_id ON profiles(auth_user_id);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_beta_user ON profiles(is_beta_user) WHERE is_beta_user = TRUE;
CREATE INDEX idx_profiles_subscription ON profiles(subscription_tier, subscription_status);

-- Comments
COMMENT ON TABLE profiles IS 'Application user profiles - one per authenticated user';
COMMENT ON COLUMN profiles.is_beta_user IS 'TRUE if user came from beta signup';
COMMENT ON COLUMN profiles.beta_signup_id IS 'Links back to beta_signups if applicable';

-- ============================================================================
-- STEP 4: Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
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
DROP POLICY IF EXISTS "Allow anon profile creation" ON profiles;

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

CREATE POLICY "Service role full access profiles"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon profile creation"
  ON profiles
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- ============================================================================
-- STEP 5: Trigger for updated_at
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
-- STEP 6: Helper function to link beta signup to profile
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

GRANT EXECUTE ON FUNCTION link_beta_signup_to_profile(TEXT, UUID, BIGINT) TO authenticated, service_role, anon;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check beta_signups structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'beta_signups'
ORDER BY ordinal_position;

-- Check profiles structure
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
