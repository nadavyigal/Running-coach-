-- Migration: Initial Supabase Schema for Running Coach App
-- Story 9.4 - Supabase Migration

-- Create custom types for enums
CREATE TYPE goal_type AS ENUM ('habit', 'distance', 'speed');
CREATE TYPE experience_level AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE conversation_role AS ENUM ('user', 'assistant', 'system');

-- Profiles table (based on User interface)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    goal goal_type NOT NULL,
    experience experience_level NOT NULL,
    preferred_times TEXT[] NOT NULL DEFAULT '{}',
    days_per_week INTEGER NOT NULL CHECK (days_per_week >= 1 AND days_per_week <= 7),
    consents JSONB NOT NULL DEFAULT '{"data": false, "gdpr": false, "push": false}',
    onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
    timezone TEXT DEFAULT 'UTC',
    motivations TEXT[] DEFAULT '{}',
    barriers TEXT[] DEFAULT '{}',
    coaching_style TEXT CHECK (coaching_style IN ('supportive', 'challenging', 'analytical', 'encouraging')),
    goal_inferred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Plans table with single active plan constraint
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_weeks INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    plan_type TEXT NOT NULL DEFAULT 'basic' CHECK (plan_type IN ('basic', 'advanced', 'periodized')),
    complexity_level TEXT DEFAULT 'basic' CHECK (complexity_level IN ('basic', 'standard', 'advanced')),
    complexity_score INTEGER DEFAULT 0 CHECK (complexity_score >= 0 AND complexity_score <= 100),
    target_distance DECIMAL,
    target_time INTEGER, -- seconds
    fitness_level experience_level,
    training_days_per_week INTEGER CHECK (training_days_per_week >= 1 AND training_days_per_week <= 7),
    peak_weekly_volume DECIMAL,
    created_in_timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure only one active plan per user
CREATE UNIQUE INDEX idx_plans_single_active 
ON plans (profile_id) 
WHERE is_active = TRUE;

-- Workouts table
CREATE TABLE workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    week INTEGER NOT NULL,
    day TEXT NOT NULL CHECK (day IN ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')),
    type TEXT NOT NULL CHECK (type IN ('easy', 'tempo', 'intervals', 'long', 'time-trial', 'hill', 'rest', 'race-pace', 'recovery', 'fartlek')),
    distance DECIMAL NOT NULL,
    duration INTEGER, -- minutes
    pace INTEGER, -- seconds per km
    intensity TEXT CHECK (intensity IN ('easy', 'moderate', 'threshold', 'vo2max', 'anaerobic')),
    training_phase TEXT CHECK (training_phase IN ('base', 'build', 'peak', 'taper')),
    workout_structure JSONB,
    notes TEXT,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    scheduled_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversations table for chat
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT,
    context JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversation messages table
CREATE TABLE conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role conversation_role NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER,
    ai_context TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys table for ensuring atomic operations
CREATE TABLE idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    operation_type TEXT NOT NULL,
    result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Indexes for performance
CREATE INDEX idx_profiles_auth_user_id ON profiles(auth_user_id);
CREATE INDEX idx_profiles_onboarding_complete ON profiles(onboarding_complete);
CREATE INDEX idx_plans_profile_id ON plans(profile_id);
CREATE INDEX idx_plans_is_active ON plans(is_active);
CREATE INDEX idx_workouts_plan_id ON workouts(plan_id);
CREATE INDEX idx_workouts_scheduled_date ON workouts(scheduled_date);
CREATE INDEX idx_conversations_profile_id ON conversations(profile_id);
CREATE INDEX idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX idx_conversation_messages_created_at ON conversation_messages(created_at);
CREATE INDEX idx_idempotency_keys_key ON idempotency_keys(key);
CREATE INDEX idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);

-- Updated at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workouts_updated_at BEFORE UPDATE ON workouts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cleanup expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void AS $$
BEGIN
    DELETE FROM idempotency_keys WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup every hour (you can set this up as a cron job or edge function)
-- SELECT cron.schedule('cleanup-idempotency-keys', '0 * * * *', 'SELECT cleanup_expired_idempotency_keys();');