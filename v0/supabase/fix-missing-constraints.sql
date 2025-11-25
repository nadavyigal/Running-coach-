-- Fix Missing Database Constraints
-- Run this in Supabase SQL Editor to fix the missing unique constraint

-- Step 1: Add unique constraint on auth_user_id for profiles table
-- This is critical for the finalize_onboarding function to work
DO $$ BEGIN
    ALTER TABLE profiles ADD CONSTRAINT profiles_auth_user_id_unique UNIQUE (auth_user_id);
    RAISE NOTICE 'Added unique constraint on profiles.auth_user_id';
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Unique constraint on profiles.auth_user_id already exists, skipping';
END $$;

-- Step 2: Verify the constraint was added
DO $$ 
DECLARE
    constraint_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = 'profiles' 
        AND constraint_name = 'profiles_auth_user_id_unique'
        AND constraint_type = 'UNIQUE'
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        RAISE NOTICE '✅ Unique constraint verification: profiles_auth_user_id_unique exists';
    ELSE
        RAISE NOTICE '❌ Unique constraint verification: profiles_auth_user_id_unique NOT found';
    END IF;
END $$;

-- Step 3: Test the finalize_onboarding function with a sample call
DO $$ 
DECLARE
    test_result JSONB;
BEGIN
    -- Test the function
    SELECT finalize_onboarding(
        '{"name": "Test User", "goal": "habit", "experience": "beginner", "daysPerWeek": 3, "timezone": "UTC"}'::JSONB,
        'test-constraint-fix-' || extract(epoch from now())::text
    ) INTO test_result;
    
    RAISE NOTICE '✅ Function test result: %', test_result;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Function test failed: %', SQLERRM;
END $$;

-- Success message
DO $$ BEGIN
    RAISE NOTICE '🎉 Constraint fix completed!';
    RAISE NOTICE 'The finalize_onboarding function should now work correctly.';
    RAISE NOTICE 'You can test your application profile API endpoint.';
END $$;