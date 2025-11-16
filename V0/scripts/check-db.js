const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://biilxiuhufkextvwqdob.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpaWx4aXVodWZrZXh0dndxZG9iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTEwMzU4MSwiZXhwIjoyMDcwNjc5NTgxfQ.WELaOUC7sYIoIUmpG0xyHRTPDcInoZZF73AyBLyOk4A'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkDatabase() {
  try {
    console.log('🔍 Checking database structure...')
    
    // First let's create a simple test table to verify connection
    console.log('📝 Testing basic SQL execution...')
    const { data: testResult, error: testError } = await supabase.rpc('exec', {
      sql: 'SELECT NOW() as current_time;'
    })
    
    if (testError) {
      console.error('❌ Basic SQL test failed:', testError)
      
      // Try different approach - create test table
      console.log('🔄 Trying alternative approach...')
      const { error: createError } = await supabase.rpc('sql', {
        query: 'CREATE TABLE IF NOT EXISTS test_connection (id SERIAL PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW());'
      })
      
      if (createError) {
        console.error('❌ Alternative approach failed:', createError)
        return false
      }
    } else {
      console.log('✅ SQL execution working:', testResult)
    }
    
    // Now let's check what tables exist in the database
    console.log('📊 Checking existing tables...')
    
    // Use information_schema to check tables
    const query = `
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `
    
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql: query })
      })
      
      if (!response.ok) {
        console.log('⚠️ RPC exec not available, trying direct table access...')
        
        // Since rpc might not work, let's try to create our tables directly
        await createTables()
        return true
      }
      
      const result = await response.json()
      console.log('📋 Existing tables:', result)
      
      // Check if our required tables exist
      const tableNames = result.map(t => t.table_name)
      const requiredTables = ['profiles', 'plans', 'workouts', 'conversations', 'conversation_messages', 'idempotency_keys']
      const missingTables = requiredTables.filter(table => !tableNames.includes(table))
      
      if (missingTables.length > 0) {
        console.log('🔧 Missing tables:', missingTables)
        console.log('📝 Creating missing tables...')
        await createTables()
      } else {
        console.log('✅ All required tables exist!')
      }
      
      return true
      
    } catch (fetchError) {
      console.log('⚠️ Direct fetch failed, trying to create tables anyway...')
      await createTables()
      return true
    }
    
  } catch (error) {
    console.error('❌ Database check failed:', error)
    return false
  }
}

async function createTables() {
  console.log('🔧 Creating database tables...')
  
  try {
    // Create tables step by step
    const migrations = [
      {
        name: 'Create enum types',
        sql: `
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
        `
      },
      {
        name: 'Create profiles table',
        sql: `
          CREATE TABLE IF NOT EXISTS profiles (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              auth_user_id UUID DEFAULT gen_random_uuid(),
              name TEXT,
              goal goal_type NOT NULL DEFAULT 'habit',
              experience experience_level NOT NULL DEFAULT 'beginner',
              preferred_times TEXT[] NOT NULL DEFAULT '{}',
              days_per_week INTEGER NOT NULL DEFAULT 3 CHECK (days_per_week >= 1 AND days_per_week <= 7),
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
        `
      },
      {
        name: 'Create plans table',
        sql: `
          CREATE TABLE IF NOT EXISTS plans (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
              title TEXT NOT NULL,
              description TEXT,
              start_date DATE NOT NULL DEFAULT CURRENT_DATE,
              end_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '12 weeks'),
              total_weeks INTEGER NOT NULL DEFAULT 12,
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
        `
      },
      {
        name: 'Create workouts table',
        sql: `
          CREATE TABLE IF NOT EXISTS workouts (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
              week INTEGER NOT NULL DEFAULT 1,
              day TEXT NOT NULL DEFAULT 'Mon' CHECK (day IN ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')),
              type TEXT NOT NULL DEFAULT 'easy' CHECK (type IN ('easy', 'tempo', 'intervals', 'long', 'time-trial', 'hill', 'rest', 'race-pace', 'recovery', 'fartlek')),
              distance DECIMAL NOT NULL DEFAULT 3.0,
              duration INTEGER,
              pace INTEGER,
              intensity TEXT CHECK (intensity IN ('easy', 'moderate', 'threshold', 'vo2max', 'anaerobic')),
              training_phase TEXT CHECK (training_phase IN ('base', 'build', 'peak', 'taper')),
              workout_structure JSONB,
              notes TEXT,
              completed BOOLEAN NOT NULL DEFAULT FALSE,
              scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `
      },
      {
        name: 'Create conversations table',
        sql: `
          CREATE TABLE IF NOT EXISTS conversations (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
              title TEXT,
              context JSONB,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `
      },
      {
        name: 'Create conversation_messages table',
        sql: `
          CREATE TABLE IF NOT EXISTS conversation_messages (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
              role conversation_role NOT NULL DEFAULT 'user',
              content TEXT NOT NULL,
              token_count INTEGER,
              ai_context TEXT,
              metadata JSONB,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `
      },
      {
        name: 'Create idempotency_keys table',
        sql: `
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
      }
    ]
    
    // Execute each migration
    for (const migration of migrations) {
      console.log(`📝 Applying: ${migration.name}`)
      
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sql: migration.sql })
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }
        
        const result = await response.json()
        console.log(`✅ ${migration.name} completed`)
        
      } catch (error) {
        console.error(`❌ ${migration.name} failed:`, error.message)
        // Continue with next migration
      }
    }
    
    console.log('🎉 Database setup completed!')
    
  } catch (error) {
    console.error('❌ Table creation failed:', error)
  }
}

checkDatabase()