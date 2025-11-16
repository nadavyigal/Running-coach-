# Supabase Integration Fix - Implementation Guide

This guide provides step-by-step instructions to fix the "cannot find user" errors and implement proper user session management.

## 🎯 Overview

**Problem:** Application uses hardcoded test user ID causing data conflicts and "cannot find user" errors.

**Solution:** Implement session-based user identification with proper data synchronization.

**Time Required:** 2-4 hours

## 📋 Pre-Implementation Checklist

- [ ] Backup current database state
- [ ] Ensure all tests are passing
- [ ] Have development environment running (`npm run dev`)
- [ ] Supabase connection is working (verified ✅)

## 🔧 Step-by-Step Implementation

### Step 1: Update Profile API Route (15 minutes)

**File:** `app/api/profile/me/route.ts`

Replace the hardcoded user ID logic:

```typescript
import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase/server'
import { UserService, extractUserIdFromRequest } from '../../../../lib/userService'

// Disable Next.js caching for this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    // Get user ID from request context
    const userId = extractUserIdFromRequest(request)
    
    console.log('🔍 Fetching profile for user:', userId)

    // Try to find user's profile
    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding_complete, id, name, goal, experience')
      .eq('auth_user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No profile found for this user
        console.log('🔍 No profile found for user:', userId)
        return NextResponse.json({ 
          onboardingComplete: false,
          profileExists: false,
          shouldShowOnboarding: true,
          userId: userId
        })
      }
      
      console.error('❌ Error fetching profile:', error)
      return NextResponse.json({ 
        error: `Failed to fetch profile: ${error.message}` 
      }, { status: 500 })
    }

    const result = {
      onboardingComplete: data?.onboarding_complete || false,
      profileExists: true,
      profile: data,
      userId: userId
    }

    console.log('✅ Profile fetched successfully:', result)
    return NextResponse.json(result)

  } catch (error: any) {
    console.error('❌ Unexpected error fetching profile:', error)
    return NextResponse.json({ 
      error: error?.message || 'Unexpected server error' 
    }, { status: 500 })
  }
}
```

### Step 2: Update Onboarding Finalization API (20 minutes)

**File:** `app/api/onboarding/finalize/route.ts`

Add user context to the onboarding process:

```typescript
import { NextResponse } from 'next/server'
import { supabase } from '../../../../lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'
import { extractUserIdFromRequest } from '../../../../lib/userService'

// Disable Next.js caching for this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { profile, idempotencyKey } = body || {}
    
    if (!profile) {
      return NextResponse.json({ error: 'Profile data is required' }, { status: 400 })
    }

    // Validate required profile fields
    if (!profile.goal || !profile.experience || !profile.daysPerWeek) {
      return NextResponse.json({ 
        error: 'Missing required profile fields: goal, experience, daysPerWeek' 
      }, { status: 400 })
    }

    // Get user ID from request context
    const userId = extractUserIdFromRequest(req)
    
    // Add user ID to profile data
    const profileWithUser = {
      ...profile,
      auth_user_id: userId
    }

    // Generate idempotency key if not provided
    const key = idempotencyKey || `onboarding_${userId}_${Date.now()}`

    console.log('🚀 Finalizing onboarding for user:', userId, 'with profile:', profileWithUser)

    // Call the RPC function
    const { data, error } = await supabase.rpc('finalize_onboarding', {
      p_profile: profileWithUser,
      p_idempotency_key: key
    })

    if (error) {
      console.error('❌ RPC finalize_onboarding failed:', error)
      return NextResponse.json({ 
        error: `Onboarding finalization failed: ${error.message}` 
      }, { status: 500 })
    }

    if (!data || !data.success) {
      console.error('❌ RPC returned invalid result:', data)
      return NextResponse.json({ 
        error: 'Onboarding finalization returned invalid result' 
      }, { status: 500 })
    }

    console.log('✅ Onboarding finalized successfully for user:', userId, 'result:', data)

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        userId: userId
      }
    })

  } catch (error: any) {
    console.error('❌ Unexpected error in finalize onboarding:', error)
    return NextResponse.json({ 
      error: error?.message || 'Unexpected server error' 
    }, { status: 500 })
  }
}
```

### Step 3: Update Supabase RPC Function (15 minutes)

**File:** `supabase/migrations/004_update_finalize_onboarding.sql`

Create this new migration file:

```sql
-- Migration: Update finalize_onboarding to handle explicit user IDs
-- Fixes the hardcoded auth.uid() issue for development/testing

CREATE OR REPLACE FUNCTION finalize_onboarding(
    p_profile JSONB,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_id UUID;
    v_auth_user_id UUID;
    v_plan_id UUID;
    v_existing_key RECORD;
    v_conversation_id UUID;
    v_result JSONB;
    v_workout_data JSONB[];
    i INTEGER;
BEGIN
    -- Get user ID from profile data or fallback to auth.uid()
    v_auth_user_id := COALESCE(
        (p_profile->>'auth_user_id')::UUID,
        auth.uid(),
        '00000000-0000-0000-0000-000000000000'::UUID
    );
    
    IF v_auth_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID not provided and not authenticated';
    END IF;

    -- Check for existing idempotency key
    SELECT * INTO v_existing_key 
    FROM idempotency_keys 
    WHERE key = p_idempotency_key 
    AND expires_at > NOW();
    
    IF v_existing_key.id IS NOT NULL THEN
        -- Return existing result for this idempotency key
        RETURN v_existing_key.result;
    END IF;

    -- Start atomic transaction
    BEGIN
        -- Upsert profile
        INSERT INTO profiles (
            auth_user_id,
            name,
            goal,
            experience,
            preferred_times,
            days_per_week,
            consents,
            onboarding_complete,
            timezone,
            motivations,
            barriers,
            coaching_style,
            goal_inferred
        )
        VALUES (
            v_auth_user_id,
            COALESCE((p_profile->>'name'), 'Runner'),
            (p_profile->>'goal')::goal_type,
            (p_profile->>'experience')::experience_level,
            COALESCE(
                ARRAY(SELECT jsonb_array_elements_text(p_profile->'preferredTimes')),
                ARRAY['07:00']
            ),
            COALESCE((p_profile->>'daysPerWeek')::INTEGER, 3),
            COALESCE(p_profile->'consents', '{"data": true, "gdpr": true, "push": false}'::JSONB),
            TRUE, -- onboarding_complete
            COALESCE((p_profile->>'timezone'), 'UTC'),
            COALESCE(
                ARRAY(SELECT jsonb_array_elements_text(p_profile->'motivations')),
                ARRAY[]::TEXT[]
            ),
            COALESCE(
                ARRAY(SELECT jsonb_array_elements_text(p_profile->'barriers')),
                ARRAY[]::TEXT[]
            ),
            COALESCE((p_profile->>'coachingStyle'), 'supportive'),
            COALESCE((p_profile->>'goalInferred')::BOOLEAN, FALSE)
        )
        ON CONFLICT (auth_user_id) 
        DO UPDATE SET
            name = EXCLUDED.name,
            goal = EXCLUDED.goal,
            experience = EXCLUDED.experience,
            preferred_times = EXCLUDED.preferred_times,
            days_per_week = EXCLUDED.days_per_week,
            consents = EXCLUDED.consents,
            onboarding_complete = TRUE,
            timezone = EXCLUDED.timezone,
            motivations = EXCLUDED.motivations,
            barriers = EXCLUDED.barriers,
            coaching_style = EXCLUDED.coaching_style,
            goal_inferred = EXCLUDED.goal_inferred,
            updated_at = NOW()
        RETURNING id INTO v_profile_id;

        -- Deactivate any existing active plans
        UPDATE plans 
        SET is_active = FALSE, updated_at = NOW()
        WHERE profile_id = v_profile_id AND is_active = TRUE;

        -- Check if we already have a plan for this profile
        SELECT id INTO v_plan_id
        FROM plans
        WHERE profile_id = v_profile_id
        ORDER BY created_at DESC
        LIMIT 1;

        -- Create new plan if none exists or activate existing one
        IF v_plan_id IS NULL THEN
            INSERT INTO plans (
                profile_id,
                title,
                description,
                start_date,
                end_date,
                total_weeks,
                is_active,
                plan_type,
                training_days_per_week,
                created_in_timezone
            )
            VALUES (
                v_profile_id,
                'Personalized Running Plan',
                'Generated based on your preferences and goals',
                CURRENT_DATE,
                CURRENT_DATE + INTERVAL '12 weeks',
                12,
                TRUE,
                'basic',
                COALESCE((p_profile->>'daysPerWeek')::INTEGER, 3),
                COALESCE((p_profile->>'timezone'), 'UTC')
            )
            RETURNING id INTO v_plan_id;
        ELSE
            -- Activate existing plan
            UPDATE plans 
            SET is_active = TRUE, updated_at = NOW()
            WHERE id = v_plan_id;
        END IF;

        -- Check if workouts already exist for this plan
        IF NOT EXISTS (SELECT 1 FROM workouts WHERE plan_id = v_plan_id) THEN
            -- Create basic workout structure for first week
            v_workout_data := ARRAY[
                '{"day": "Mon", "type": "easy", "distance": 3.0, "week": 1}',
                '{"day": "Wed", "type": "easy", "distance": 4.0, "week": 1}',
                '{"day": "Fri", "type": "easy", "distance": 3.5, "week": 1}'
            ];

            -- Insert the 3 seed workouts
            FOR i IN 1..3 LOOP
                INSERT INTO workouts (
                    plan_id,
                    week,
                    day,
                    type,
                    distance,
                    scheduled_date
                )
                VALUES (
                    v_plan_id,
                    ((v_workout_data[i])::JSONB->>'week')::INTEGER,
                    (v_workout_data[i])::JSONB->>'day',
                    (v_workout_data[i])::JSONB->>'type',
                    ((v_workout_data[i])::JSONB->>'distance')::DECIMAL,
                    CURRENT_DATE + 
                    CASE (v_workout_data[i])::JSONB->>'day'
                        WHEN 'Mon' THEN INTERVAL '0 days'
                        WHEN 'Wed' THEN INTERVAL '2 days'
                        WHEN 'Fri' THEN INTERVAL '4 days'
                    END
                );
            END LOOP;
        END IF;

        -- Create a default conversation if none exists
        IF NOT EXISTS (
            SELECT 1 FROM conversations WHERE profile_id = v_profile_id
        ) THEN
            INSERT INTO conversations (profile_id, title)
            VALUES (v_profile_id, 'Welcome Chat')
            RETURNING id INTO v_conversation_id;

            -- Add welcome message
            INSERT INTO conversation_messages (
                conversation_id,
                role,
                content
            )
            VALUES (
                v_conversation_id,
                'assistant',
                'Welcome to your personalized running coach! I''m here to help you achieve your running goals. How are you feeling about getting started?'
            );
        END IF;

        -- Prepare result
        v_result := jsonb_build_object(
            'success', true,
            'profile_id', v_profile_id,
            'plan_id', v_plan_id,
            'auth_user_id', v_auth_user_id,
            'onboarding_complete', true,
            'workouts_created', 3,
            'message', 'Onboarding completed successfully'
        );

        -- Store idempotency key with result
        INSERT INTO idempotency_keys (
            key,
            profile_id,
            operation_type,
            result
        )
        VALUES (
            p_idempotency_key,
            v_profile_id,
            'finalize_onboarding',
            v_result
        );

        RETURN v_result;

    EXCEPTION WHEN OTHERS THEN
        -- Log error and re-raise
        RAISE EXCEPTION 'Onboarding finalization failed: %', SQLERRM;
    END;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION finalize_onboarding(JSONB, TEXT) TO authenticated;
```

### Step 4: Update Frontend Components (30 minutes)

**File:** `lib/repos/onboardingRepo.ts`

Update the repository to use user context:

```typescript
import { supabase } from '../supabase/server'
import { UserService, addUserContextToFetch } from '../userService'
import { v4 as uuidv4 } from 'uuid'

// ... keep existing interfaces ...

export class OnboardingRepository {
  /**
   * Finalize user onboarding with atomic transaction
   */
  async finalizeOnboarding(
    profile: OnboardingProfile,
    idempotencyKey?: string
  ): Promise<OnboardingResult> {
    try {
      const userId = UserService.getCurrentUserId()
      
      // Generate idempotency key if not provided
      const key = idempotencyKey || `onboarding_${userId}_${Date.now()}`
      
      // Add user ID to profile
      const profileWithUser = {
        ...profile,
        auth_user_id: userId
      }
      
      // Call the RPC function with the profile data
      const { data, error } = await supabase.rpc('finalize_onboarding', {
        p_profile: profileWithUser,
        p_idempotency_key: key
      })

      if (error) {
        console.error('❌ Onboarding finalization failed:', error)
        throw new Error(`Onboarding failed: ${error.message}`)
      }

      if (!data || !data.success) {
        throw new Error('Onboarding finalization returned invalid result')
      }

      console.log('✅ Onboarding finalized successfully for user:', userId, data)
      return data as OnboardingResult

    } catch (error) {
      console.error('❌ Error in finalizeOnboarding:', error)
      throw error
    }
  }

  /**
   * Check if a user has completed onboarding
   */
  async getOnboardingComplete(authUserId?: string): Promise<boolean> {
    try {
      const userId = authUserId || UserService.getCurrentUserId()
      
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_complete')
        .eq('auth_user_id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('🔍 No profile found for user:', userId)
          return false
        }
        console.error('❌ Error checking onboarding status:', error)
        throw new Error(`Failed to check onboarding status: ${error.message}`)
      }

      const isComplete = data?.onboarding_complete || false
      console.log(`✅ Onboarding status for user ${userId}: ${isComplete}`)
      return isComplete

    } catch (error) {
      console.error('❌ Error in getOnboardingComplete:', error)
      return false
    }
  }

  // ... rest of the methods updated similarly
}

// Update legacy API functions
export async function finalizeOnboarding(profile: any, idempotencyKey: string) {
  const res = await fetch('/api/onboarding/finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, idempotencyKey }),
    ...addUserContextToFetch()
  })
  
  if (!res.ok) {
    let message = 'finalize failed'
    try { const j = await res.json(); message = j.error || message } catch {}
    throw new Error(message)
  }
  
  const json = await res.json()
  return json.data
}

export async function getOnboardingComplete(): Promise<boolean> {
  try {
    console.log('🔍 Checking onboarding completion status...')
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      console.warn('⏰ Onboarding check timeout after 5 seconds')
      controller.abort()
    }, 5000)
    
    const res = await fetch('/api/profile/me', { 
      cache: 'no-store',
      signal: controller.signal,
      ...addUserContextToFetch()
    })
    
    clearTimeout(timeoutId)
    
    if (!res.ok) {
      console.warn('⚠️ Profile API returned non-OK status:', res.status)
      return false
    }
    
    const json = await res.json()
    const isComplete = json.onboardingComplete === true
    console.log('✅ Onboarding status retrieved:', isComplete)
    return isComplete
  } catch (error) {
    console.error('❌ Onboarding check failed:', error)
    return false
  }
}
```

### Step 5: Apply Database Migration (10 minutes)

```bash
# Navigate to V0 directory
cd V0

# Apply the new migration
node -e "
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://biilxiuhufkextvwqdob.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpaWx4aXVodWZrZXh0dndxZG9iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTEwMzU4MSwiZXhwIjoyMDcwNjc5NTgxfQ.WELaOUC7sYIoIUmpG0xyHRTPDcInoZZF73AyBLyOk4A';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    const migration = fs.readFileSync('supabase/migrations/004_update_finalize_onboarding.sql', 'utf8');
    console.log('📋 Applying migration...');
    
    const { error } = await supabase.rpc('exec', { sql: migration });
    
    if (error) {
      console.error('❌ Migration failed:', error);
    } else {
      console.log('✅ Migration applied successfully');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

applyMigration();
"
```

## 🧪 Testing the Implementation

### Test 1: Multiple Users
1. Open the app in browser 1
2. Complete onboarding with test data
3. Open the app in incognito/private browser 2
4. Verify second user sees fresh onboarding
5. Complete onboarding in browser 2
6. Verify both users have separate data

### Test 2: Data Persistence
1. Complete onboarding
2. Refresh the page
3. Verify user data persists
4. Check Supabase database for correct user separation

### Test 3: API Endpoints
```bash
# Test profile endpoint
curl -X GET http://localhost:3000/api/profile/me \
  -H "x-user-id: test-user-123"

# Test onboarding endpoint
curl -X POST http://localhost:3000/api/onboarding/finalize \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-user-123" \
  -d '{"profile": {"goal": "habit", "experience": "beginner", "daysPerWeek": 3}}'
```

## 🔄 Rollback Plan

If anything goes wrong:

1. **Database Rollback:**
   ```sql
   -- Remove the new migration
   DROP FUNCTION IF EXISTS finalize_onboarding(JSONB, TEXT);
   -- Re-apply the previous version from 003_finalize_onboarding_rpc.sql
   ```

2. **Code Rollback:**
   - Revert API files to use hardcoded user ID
   - Remove userService.ts import statements

3. **Data Recovery:**
   - Existing data in Supabase is safe
   - Local IndexedDB data is unchanged

## ✅ Success Criteria

After implementation, verify:

- [ ] Multiple users can use the app simultaneously
- [ ] Each user sees their own data
- [ ] "Cannot find user" errors are eliminated
- [ ] Onboarding completion works correctly
- [ ] Data persists across browser sessions
- [ ] No data conflicts between users

## 📞 Support

If you encounter issues during implementation:
1. Check browser console for errors
2. Verify Supabase connectivity
3. Test API endpoints individually
4. Check database state with provided test scripts

**Estimated implementation time:** 2-4 hours
**Risk level:** Low (existing data preserved)
**Complexity:** Medium