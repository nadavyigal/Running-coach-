-- Migration: Finalize Onboarding RPC Function
-- Story 9.4 - Atomic finalize_onboarding with idempotency

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
    -- Get current authenticated user
    v_auth_user_id := auth.uid();
    
    IF v_auth_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
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