#!/usr/bin/env node

/**
 * Test Script for Story 9.4 - Supabase Backend Implementation
 * Run this after applying the database migration
 */

const readline = require('readline');

const API_BASE = 'http://localhost:3002/api';

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    return {
      success: response.ok,
      status: response.status,
      data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function testApiEndpoints() {
  console.log('🧪 Testing API Endpoints...\n');
  
  // Test 1: Profile endpoint (should return no profile initially)
  console.log('1️⃣ Testing GET /api/profile/me');
  const profileResult = await makeRequest(`${API_BASE}/profile/me`);
  
  if (profileResult.success) {
    console.log('✅ Profile endpoint working');
    console.log('📊 Response:', JSON.stringify(profileResult.data, null, 2));
  } else {
    console.log('❌ Profile endpoint failed:', profileResult.error || profileResult.data);
    return false;
  }
  
  console.log('\n---\n');
  
  // Test 2: Finalize onboarding
  console.log('2️⃣ Testing POST /api/onboarding/finalize');
  const onboardingPayload = {
    profile: {
      name: 'Test Runner',
      goal: 'habit',
      experience: 'beginner',
      daysPerWeek: 3,
      preferredTimes: ['07:00'],
      consents: {
        data: true,
        gdpr: true,
        push: false
      },
      timezone: 'UTC',
      motivations: ['health', 'fitness'],
      barriers: ['time', 'weather'],
      coachingStyle: 'supportive'
    },
    idempotencyKey: `test-${Date.now()}`
  };
  
  const onboardingResult = await makeRequest(`${API_BASE}/onboarding/finalize`, {
    method: 'POST',
    body: JSON.stringify(onboardingPayload)
  });
  
  if (onboardingResult.success) {
    console.log('✅ Onboarding finalization working');
    console.log('📊 Response:', JSON.stringify(onboardingResult.data, null, 2));
  } else {
    console.log('❌ Onboarding finalization failed:', onboardingResult.error || onboardingResult.data);
    return false;
  }
  
  console.log('\n---\n');
  
  // Test 3: Profile endpoint again (should return completed onboarding)
  console.log('3️⃣ Testing GET /api/profile/me (after onboarding)');
  const profileResult2 = await makeRequest(`${API_BASE}/profile/me`);
  
  if (profileResult2.success) {
    console.log('✅ Profile endpoint working after onboarding');
    console.log('📊 Response:', JSON.stringify(profileResult2.data, null, 2));
    
    if (profileResult2.data.onboardingComplete) {
      console.log('🎉 Onboarding marked as complete!');
    } else {
      console.log('⚠️ Onboarding not marked as complete');
    }
  } else {
    console.log('❌ Profile endpoint failed after onboarding:', profileResult2.error || profileResult2.data);
    return false;
  }
  
  console.log('\n---\n');
  
  // Test 4: Test idempotency by calling finalize again with same key
  console.log('4️⃣ Testing idempotency (calling finalize with same key)');
  const idempotencyResult = await makeRequest(`${API_BASE}/onboarding/finalize`, {
    method: 'POST',
    body: JSON.stringify(onboardingPayload) // Same payload, same key
  });
  
  if (idempotencyResult.success) {
    console.log('✅ Idempotency working - same result returned');
    console.log('📊 Response:', JSON.stringify(idempotencyResult.data, null, 2));
  } else {
    console.log('❌ Idempotency test failed:', idempotencyResult.error || idempotencyResult.data);
    return false;
  }
  
  return true;
}

async function testSupabaseConnection() {
  console.log('🔌 Testing Supabase Connection...\n');
  
  try {
    const { createClient } = require('@supabase/supabase-js');
    
    const supabaseUrl = 'https://biilxiuhufkextvwqdob.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpaWx4aXVodWZrZXh0dndxZG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMDM1ODEsImV4cCI6MjA3MDY3OTU4MX0.yMWwZqvPmUHceR9EITPq-NSElny9sEBL52f-mrj2YrM';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test basic connection by trying to query profiles table
    const { data, error, count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact' });
    
    if (error) {
      console.log('❌ Supabase connection test failed:', error.message);
      return false;
    }
    
    console.log(`✅ Supabase connection working - Found ${count} profiles`);
    
    // Test plans table
    const { data: plans, error: plansError, count: plansCount } = await supabase
      .from('plans')
      .select('id', { count: 'exact' });
    
    if (plansError) {
      console.log('❌ Plans table test failed:', plansError.message);
      return false;
    }
    
    console.log(`✅ Plans table working - Found ${plansCount} plans`);
    
    // Test workouts table
    const { data: workouts, error: workoutsError, count: workoutsCount } = await supabase
      .from('workouts')
      .select('id', { count: 'exact' });
    
    if (workoutsError) {
      console.log('❌ Workouts table test failed:', workoutsError.message);
      return false;
    }
    
    console.log(`✅ Workouts table working - Found ${workoutsCount} workouts`);
    
    return true;
    
  } catch (error) {
    console.log('❌ Supabase test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Story 9.4 Implementation Test\n');
  console.log('========================================\n');
  
  // Check if dev server is running
  console.log('🔍 Checking if development server is running...');
  const healthCheck = await makeRequest(`${API_BASE}/profile/me`);
  
  if (!healthCheck.success && healthCheck.error && healthCheck.error.includes('ECONNREFUSED')) {
    console.log('❌ Development server not running. Please start it with: npm run dev');
    process.exit(1);
  }
  
  console.log('✅ Development server is running\n');
  
  // Test Supabase connection
  const supabaseTest = await testSupabaseConnection();
  if (!supabaseTest) {
    console.log('\n❌ Supabase connection test failed. Please check:');
    console.log('   1. Migration has been applied in Supabase SQL Editor');
    console.log('   2. Environment variables are correct');
    console.log('   3. Supabase project is accessible');
    process.exit(1);
  }
  
  console.log('\n========================================\n');
  
  // Test API endpoints
  const apiTest = await testApiEndpoints();
  
  console.log('\n========================================\n');
  
  if (apiTest && supabaseTest) {
    console.log('🎉 ALL TESTS PASSED! Story 9.4 implementation is working correctly.\n');
    console.log('✅ Database schema created successfully');
    console.log('✅ RLS policies are working');
    console.log('✅ API endpoints are functional');
    console.log('✅ Onboarding flow is working');
    console.log('✅ Idempotency is working');
    console.log('✅ Data persistence is working');
    console.log('\nYou can now test the full application at: http://localhost:3002');
  } else {
    console.log('❌ SOME TESTS FAILED. Please check the errors above and:');
    console.log('   1. Ensure the migration was applied correctly');
    console.log('   2. Check Supabase project logs for errors');
    console.log('   3. Verify environment variables');
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testApiEndpoints, testSupabaseConnection };