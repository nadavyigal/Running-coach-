-- IMMEDIATE FIX: Create test profile for hardcoded user ID
-- This resolves the "No user available" issue

-- Insert a test profile with the hardcoded UUID that the app expects
INSERT INTO profiles (
    id,
    auth_user_id,
    name,
    goal,
    experience,
    preferred_times,
    days_per_week,
    consents,
    onboarding_complete,
    timezone,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'Test User',
    'habit',
    'beginner',
    ARRAY['07:00'],
    3,
    '{"data": false, "gdpr": false, "push": false}',
    false,  -- This is key - onboarding NOT complete so user sees onboarding screen
    'UTC',
    NOW(),
    NOW()
) ON CONFLICT (auth_user_id) DO UPDATE SET
    onboarding_complete = false,  -- Ensure onboarding shows
    updated_at = NOW();

-- Verify the profile was created
SELECT 
    id,
    auth_user_id,
    name,
    onboarding_complete,
    created_at
FROM profiles 
WHERE auth_user_id = '00000000-0000-0000-0000-000000000000';

-- Expected result: Should return 1 row with onboarding_complete = false