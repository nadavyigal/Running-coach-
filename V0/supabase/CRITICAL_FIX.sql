-- CRITICAL FIX: Add missing unique constraint
-- This fixes the "no unique or exclusion constraint matching the ON CONFLICT specification" error

-- Step 1: Add the missing unique constraint on profiles.auth_user_id
ALTER TABLE profiles ADD CONSTRAINT profiles_auth_user_id_unique UNIQUE (auth_user_id);

-- Step 2: Verify the constraint was added
SELECT 
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint 
WHERE conname = 'profiles_auth_user_id_unique';

-- Expected result: Should return one row showing the constraint exists
-- constraint_name: profiles_auth_user_id_unique
-- constraint_type: u (for unique)

-- Step 3: Test that the finalize_onboarding function now works
SELECT finalize_onboarding(
    '{"name": "Test User", "goal": "habit", "experience": "beginner", "daysPerWeek": 3, "preferredTimes": ["07:00"], "consents": {"data": true, "gdpr": true, "push": false}}'::jsonb,
    'test-constraint-fix'
);

-- Expected result: Should return success JSON without errors