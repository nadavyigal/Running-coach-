-- Migration 007: Row-Level Security Policies for Authenticated Users
-- Ensures users can only access their own data with proper authentication
-- Author: Claude Code
-- Date: 2026-01-18

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================

ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_progress_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE shoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE hrv_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE heart_rate_zones ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTION: Get Profile ID from Auth User
-- ============================================================================

CREATE OR REPLACE FUNCTION get_profile_id_for_auth_user()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT id FROM profiles
        WHERE auth_user_id = auth.uid()
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- RUNS TABLE POLICIES
-- ============================================================================

-- Users can view their own runs
CREATE POLICY "Users can view own runs"
    ON runs FOR SELECT
    USING (profile_id = get_profile_id_for_auth_user());

-- Users can insert their own runs
CREATE POLICY "Users can insert own runs"
    ON runs FOR INSERT
    WITH CHECK (profile_id = get_profile_id_for_auth_user());

-- Users can update their own runs
CREATE POLICY "Users can update own runs"
    ON runs FOR UPDATE
    USING (profile_id = get_profile_id_for_auth_user())
    WITH CHECK (profile_id = get_profile_id_for_auth_user());

-- Users can delete their own runs
CREATE POLICY "Users can delete own runs"
    ON runs FOR DELETE
    USING (profile_id = get_profile_id_for_auth_user());

-- ============================================================================
-- GOALS TABLE POLICIES
-- ============================================================================

-- Users can view their own goals
CREATE POLICY "Users can view own goals"
    ON goals FOR SELECT
    USING (profile_id = get_profile_id_for_auth_user());

-- Users can insert their own goals
CREATE POLICY "Users can insert own goals"
    ON goals FOR INSERT
    WITH CHECK (profile_id = get_profile_id_for_auth_user());

-- Users can update their own goals
CREATE POLICY "Users can update own goals"
    ON goals FOR UPDATE
    USING (profile_id = get_profile_id_for_auth_user())
    WITH CHECK (profile_id = get_profile_id_for_auth_user());

-- Users can delete their own goals
CREATE POLICY "Users can delete own goals"
    ON goals FOR DELETE
    USING (profile_id = get_profile_id_for_auth_user());

-- ============================================================================
-- GOAL PROGRESS HISTORY POLICIES
-- ============================================================================

-- Users can view progress for their own goals
CREATE POLICY "Users can view own goal progress"
    ON goal_progress_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM goals
            WHERE goals.id = goal_progress_history.goal_id
            AND goals.profile_id = get_profile_id_for_auth_user()
        )
    );

-- Users can insert progress for their own goals
CREATE POLICY "Users can insert own goal progress"
    ON goal_progress_history FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM goals
            WHERE goals.id = goal_progress_history.goal_id
            AND goals.profile_id = get_profile_id_for_auth_user()
        )
    );

-- Users can update progress for their own goals
CREATE POLICY "Users can update own goal progress"
    ON goal_progress_history FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM goals
            WHERE goals.id = goal_progress_history.goal_id
            AND goals.profile_id = get_profile_id_for_auth_user()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM goals
            WHERE goals.id = goal_progress_history.goal_id
            AND goals.profile_id = get_profile_id_for_auth_user()
        )
    );

-- Users can delete progress for their own goals
CREATE POLICY "Users can delete own goal progress"
    ON goal_progress_history FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM goals
            WHERE goals.id = goal_progress_history.goal_id
            AND goals.profile_id = get_profile_id_for_auth_user()
        )
    );

-- ============================================================================
-- SHOES TABLE POLICIES
-- ============================================================================

-- Users can view their own shoes
CREATE POLICY "Users can view own shoes"
    ON shoes FOR SELECT
    USING (profile_id = get_profile_id_for_auth_user());

-- Users can insert their own shoes
CREATE POLICY "Users can insert own shoes"
    ON shoes FOR INSERT
    WITH CHECK (profile_id = get_profile_id_for_auth_user());

-- Users can update their own shoes
CREATE POLICY "Users can update own shoes"
    ON shoes FOR UPDATE
    USING (profile_id = get_profile_id_for_auth_user())
    WITH CHECK (profile_id = get_profile_id_for_auth_user());

-- Users can delete their own shoes
CREATE POLICY "Users can delete own shoes"
    ON shoes FOR DELETE
    USING (profile_id = get_profile_id_for_auth_user());

-- ============================================================================
-- SLEEP DATA POLICIES
-- ============================================================================

-- Users can view their own sleep data
CREATE POLICY "Users can view own sleep data"
    ON sleep_data FOR SELECT
    USING (profile_id = get_profile_id_for_auth_user());

-- Users can insert their own sleep data
CREATE POLICY "Users can insert own sleep data"
    ON sleep_data FOR INSERT
    WITH CHECK (profile_id = get_profile_id_for_auth_user());

-- Users can update their own sleep data
CREATE POLICY "Users can update own sleep data"
    ON sleep_data FOR UPDATE
    USING (profile_id = get_profile_id_for_auth_user())
    WITH CHECK (profile_id = get_profile_id_for_auth_user());

-- Users can delete their own sleep data
CREATE POLICY "Users can delete own sleep data"
    ON sleep_data FOR DELETE
    USING (profile_id = get_profile_id_for_auth_user());

-- ============================================================================
-- HRV MEASUREMENTS POLICIES
-- ============================================================================

-- Users can view their own HRV measurements
CREATE POLICY "Users can view own hrv measurements"
    ON hrv_measurements FOR SELECT
    USING (profile_id = get_profile_id_for_auth_user());

-- Users can insert their own HRV measurements
CREATE POLICY "Users can insert own hrv measurements"
    ON hrv_measurements FOR INSERT
    WITH CHECK (profile_id = get_profile_id_for_auth_user());

-- Users can update their own HRV measurements
CREATE POLICY "Users can update own hrv measurements"
    ON hrv_measurements FOR UPDATE
    USING (profile_id = get_profile_id_for_auth_user())
    WITH CHECK (profile_id = get_profile_id_for_auth_user());

-- Users can delete their own HRV measurements
CREATE POLICY "Users can delete own hrv measurements"
    ON hrv_measurements FOR DELETE
    USING (profile_id = get_profile_id_for_auth_user());

-- ============================================================================
-- RECOVERY SCORES POLICIES
-- ============================================================================

-- Users can view their own recovery scores
CREATE POLICY "Users can view own recovery scores"
    ON recovery_scores FOR SELECT
    USING (profile_id = get_profile_id_for_auth_user());

-- Users can insert their own recovery scores
CREATE POLICY "Users can insert own recovery scores"
    ON recovery_scores FOR INSERT
    WITH CHECK (profile_id = get_profile_id_for_auth_user());

-- Users can update their own recovery scores
CREATE POLICY "Users can update own recovery scores"
    ON recovery_scores FOR UPDATE
    USING (profile_id = get_profile_id_for_auth_user())
    WITH CHECK (profile_id = get_profile_id_for_auth_user());

-- Users can delete their own recovery scores
CREATE POLICY "Users can delete own recovery scores"
    ON recovery_scores FOR DELETE
    USING (profile_id = get_profile_id_for_auth_user());

-- ============================================================================
-- PERSONAL RECORDS POLICIES
-- ============================================================================

-- Users can view their own personal records
CREATE POLICY "Users can view own personal records"
    ON personal_records FOR SELECT
    USING (profile_id = get_profile_id_for_auth_user());

-- Users can insert their own personal records
CREATE POLICY "Users can insert own personal records"
    ON personal_records FOR INSERT
    WITH CHECK (profile_id = get_profile_id_for_auth_user());

-- Users can update their own personal records
CREATE POLICY "Users can update own personal records"
    ON personal_records FOR UPDATE
    USING (profile_id = get_profile_id_for_auth_user())
    WITH CHECK (profile_id = get_profile_id_for_auth_user());

-- Users can delete their own personal records
CREATE POLICY "Users can delete own personal records"
    ON personal_records FOR DELETE
    USING (profile_id = get_profile_id_for_auth_user());

-- ============================================================================
-- HEART RATE ZONES POLICIES
-- ============================================================================

-- Users can view their own heart rate zones
CREATE POLICY "Users can view own heart rate zones"
    ON heart_rate_zones FOR SELECT
    USING (profile_id = get_profile_id_for_auth_user());

-- Users can insert their own heart rate zones
CREATE POLICY "Users can insert own heart rate zones"
    ON heart_rate_zones FOR INSERT
    WITH CHECK (profile_id = get_profile_id_for_auth_user());

-- Users can update their own heart rate zones
CREATE POLICY "Users can update own heart rate zones"
    ON heart_rate_zones FOR UPDATE
    USING (profile_id = get_profile_id_for_auth_user())
    WITH CHECK (profile_id = get_profile_id_for_auth_user());

-- Users can delete their own heart rate zones
CREATE POLICY "Users can delete own heart rate zones"
    ON heart_rate_zones FOR DELETE
    USING (profile_id = get_profile_id_for_auth_user());

-- ============================================================================
-- ADMIN READ-ONLY ACCESS (Optional)
-- Grant admins read access to all data for analytics dashboard
-- To enable, set user metadata role = 'admin' in Supabase auth
-- ============================================================================

-- Admin policy for runs (read-only)
CREATE POLICY "Admins can view all runs"
    ON runs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Admin policy for goals (read-only)
CREATE POLICY "Admins can view all goals"
    ON goals FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Admin policy for shoes (read-only)
CREATE POLICY "Admins can view all shoes"
    ON shoes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Admin policy for sleep data (read-only)
CREATE POLICY "Admins can view all sleep data"
    ON sleep_data FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Admin policy for HRV measurements (read-only)
CREATE POLICY "Admins can view all hrv measurements"
    ON hrv_measurements FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Admin policy for recovery scores (read-only)
CREATE POLICY "Admins can view all recovery scores"
    ON recovery_scores FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Admin policy for personal records (read-only)
CREATE POLICY "Admins can view all personal records"
    ON personal_records FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Admin policy for heart rate zones (read-only)
CREATE POLICY "Admins can view all heart rate zones"
    ON heart_rate_zones FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- ============================================================================
-- GRANT PERMISSIONS
-- Grant necessary permissions for authenticated users
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant permissions on tables
GRANT SELECT, INSERT, UPDATE, DELETE ON runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON goal_progress_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON shoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sleep_data TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON hrv_measurements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON recovery_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON personal_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON heart_rate_zones TO authenticated;

-- Grant sequence permissions (for auto-increment)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- SECURITY COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_profile_id_for_auth_user() IS 'Helper function to get profile_id for authenticated user. Used in RLS policies.';

COMMENT ON POLICY "Users can view own runs" ON runs IS 'Users can only view runs associated with their profile';
COMMENT ON POLICY "Admins can view all runs" ON runs IS 'Admin users can view all runs for analytics dashboard (read-only)';

-- ============================================================================
-- VERIFY RLS IS ENABLED
-- Query to verify RLS is enabled on all tables
-- ============================================================================

-- Run this query to verify RLS status:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('runs', 'goals', 'goal_progress_history', 'shoes', 'sleep_data', 'hrv_measurements', 'recovery_scores', 'personal_records', 'heart_rate_zones');
