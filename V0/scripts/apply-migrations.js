const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = 'https://biilxiuhufkextvwqdob.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpaWx4aXVodWZrZXh0dndxZG9iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTEwMzU4MSwiZXhwIjoyMDcwNjc5NTgxfQ.WELaOUC7sYIoIUmpG0xyHRTPDcInoZZF73AyBLyOk4A'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyMigrations() {
  console.log('🚀 Starting migration process...')

  try {
    // Check current tables
    console.log('📋 Checking existing tables...')
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')

    if (tablesError) {
      console.log('⚠️ Error checking tables (expected if first run):', tablesError.message)
    } else {
      console.log('📊 Current tables:', tables?.map(t => t.table_name) || [])
    }

    // Migration 1: Create types and tables
    console.log('\n🔧 Applying Migration 1: Schema creation...')
    
    const migration1 = `
      -- Create custom types for enums
      DO $$ BEGIN
        CREATE TYPE goal_type AS ENUM ('habit', 'distance', 'speed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE experience_level AS ENUM ('beginner', 'intermediate', 'advanced');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE conversation_role AS ENUM ('user', 'assistant', 'system');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      -- Profiles table (based on User interface)
      CREATE TABLE IF NOT EXISTS profiles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          auth_user_id UUID DEFAULT gen_random_uuid(),
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
      CREATE TABLE IF NOT EXISTS plans (
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
          target_time INTEGER,
          fitness_level experience_level,
          training_days_per_week INTEGER CHECK (training_days_per_week >= 1 AND training_days_per_week <= 7),
          peak_weekly_volume DECIMAL,
          created_in_timezone TEXT DEFAULT 'UTC',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Ensure only one active plan per user
      CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_single_active 
      ON plans (profile_id) 
      WHERE is_active = TRUE;

      -- Workouts table
      CREATE TABLE IF NOT EXISTS workouts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
          week INTEGER NOT NULL,
          day TEXT NOT NULL CHECK (day IN ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')),
          type TEXT NOT NULL CHECK (type IN ('easy', 'tempo', 'intervals', 'long', 'time-trial', 'hill', 'rest', 'race-pace', 'recovery', 'fartlek')),
          distance DECIMAL NOT NULL,
          duration INTEGER,
          pace INTEGER,
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
      CREATE TABLE IF NOT EXISTS conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
          title TEXT,
          context JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Conversation messages table
      CREATE TABLE IF NOT EXISTS conversation_messages (
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
      CREATE TABLE IF NOT EXISTS idempotency_keys (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          key TEXT NOT NULL UNIQUE,
          profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
          operation_type TEXT NOT NULL,
          result JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
      );
    `

    const { error: migration1Error } = await supabase.rpc('exec', { sql: migration1 })
    if (migration1Error) {
      console.error('❌ Migration 1 failed:', migration1Error)
      throw migration1Error
    }
    console.log('✅ Migration 1 completed successfully')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

applyMigrations()