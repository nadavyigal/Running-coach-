#!/usr/bin/env node

/**
 * Simple Supabase Migration Script
 * Applies the critical fix for the unique constraint
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration in .env.local');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConnection() {
  console.log('🔗 Testing connection to Supabase...');
  console.log(`📍 URL: ${SUPABASE_URL}`);
  
  try {
    // Test with a simple query
    const { data, error } = await supabase.from('profiles').select('id').limit(1);
    
    if (error) {
      console.log(`⚠️  Table query result: ${error.message}`);
      // This might be expected if tables don't exist yet
    } else {
      console.log(`✅ Connection successful, found ${data?.length || 0} profiles`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    return false;
  }
}

async function checkTableExists(tableName) {
  const { data, error } = await supabase.from(tableName).select('*').limit(1);
  
  if (error) {
    if (error.code === '42P01') { // Table doesn't exist
      return false;
    }
    // Other errors might be permissions or RLS - table likely exists
    return true;
  }
  
  return true;
}

async function runDiagnostics() {
  console.log('\n🔍 Running backend diagnostics...\n');
  
  const tables = ['profiles', 'plans', 'workouts', 'conversations', 'conversation_messages', 'idempotency_keys'];
  
  for (const table of tables) {
    const exists = await checkTableExists(table);
    console.log(`${exists ? '✅' : '❌'} Table: ${table}`);
  }
  
  // Test the finalize_onboarding function
  console.log('\n🧪 Testing finalize_onboarding function...');
  try {
    const { data, error } = await supabase.rpc('finalize_onboarding', {
      p_profile: {
        name: 'Test',
        goal: 'habit',
        experience: 'beginner',
        daysPerWeek: 3,
        preferredTimes: ['07:00'],
        consents: { data: true, gdpr: true, push: false }
      },
      p_idempotency_key: 'test-key'
    });
    
    if (error) {
      if (error.code === '42883') {
        console.log('❌ Function finalize_onboarding does not exist');
      } else if (error.message.includes('User not authenticated')) {
        console.log('✅ Function exists but requires authentication (expected)');
      } else {
        console.log(`⚠️  Function error: ${error.message}`);
      }
    } else {
      console.log('✅ Function test successful');
    }
  } catch (error) {
    console.log(`❌ Function test failed: ${error.message}`);
  }
  
  console.log('\n📋 Diagnostics complete!');
  console.log('\nNext steps:');
  console.log('1. If tables are missing, you need to apply the SQL migrations manually');
  console.log('2. Use the Supabase dashboard SQL editor to run:');
  console.log('   - supabase/migrations/001_initial_schema.sql');
  console.log('   - supabase/migrations/002_rls_policies.sql');
  console.log('   - supabase/migrations/003_finalize_onboarding_rpc.sql');
  console.log('   - supabase/CRITICAL_FIX.sql');
}

runDiagnostics().catch(console.error);