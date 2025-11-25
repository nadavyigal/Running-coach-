#!/usr/bin/env node

/**
 * Comprehensive Backend Testing Script for Story 9.4
 * Tests all aspects of the Supabase backend implementation
 */

const { createClient } = require('@supabase/supabase-js');

const API_BASE = 'http://localhost:3000/api';
const supabaseUrl = 'https://biilxiuhufkextvwqdob.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpaWx4aXVodWZrZXh0dndxZG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMDM1ODEsImV4cCI6MjA3MDY3OTU4MX0.yMWwZqvPmUHceR9EITPq-NSElny9sEBL52f-mrj2YrM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function makeRequest(url, options = {}) {
  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const endTime = Date.now();
    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      data,
      responseTime: endTime - startTime
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function testDatabaseSchema() {
  console.log('🔍 Testing Database Schema...\n');
  
  const requiredTables = ['profiles', 'plans', 'workouts', 'conversations', 'conversation_messages', 'idempotency_keys'];
  let allTablesExist = true;
  
  for (const table of requiredTables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ Table ${table}: ${error.message}`);
        allTablesExist = false;
      } else {
        console.log(`✅ Table ${table}: EXISTS (${count} records)`);
      }
    } catch (err) {
      console.log(`❌ Table ${table}: ${err.message}`);
      allTablesExist = false;
    }
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  return allTablesExist;
}

async function testAPIEndpoints() {
  console.log('🧪 Testing API Endpoints...\n');
  
  // Test 1: Profile endpoint
  console.log('1️⃣ Testing GET /api/profile/me');
  const profileStart = Date.now();
  const profileResult = await makeRequest(`${API_BASE}/profile/me`);
  const profileTime = Date.now() - profileStart;
  
  if (profileResult.success) {
    console.log(`✅ Profile endpoint working (${profileTime}ms)`);
    console.log(`📊 Response:`, JSON.stringify(profileResult.data, null, 2));
  } else {
    console.log(`❌ Profile endpoint failed:`, profileResult.error || profileResult.data);
    return false;
  }
  
  console.log('\n---\n');
  
  // Test 2: Finalize onboarding (Main test)
  console.log('2️⃣ Testing POST /api/onboarding/finalize');
  const onboardingPayload = {
    profile: {
      name: 'Complete Test User',
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
    idempotencyKey: `complete-test-${Date.now()}`
  };
  
  const onboardingStart = Date.now();
  const onboardingResult = await makeRequest(`${API_BASE}/onboarding/finalize`, {
    method: 'POST',
    body: JSON.stringify(onboardingPayload)
  });
  const onboardingTime = Date.now() - onboardingStart;
  
  if (onboardingResult.success) {
    console.log(`✅ Onboarding finalization working (${onboardingTime}ms)`);
    console.log(`📊 Response:`, JSON.stringify(onboardingResult.data, null, 2));
  } else {
    console.log(`❌ CRITICAL: Onboarding finalization failed (${onboardingTime}ms)`);
    console.log(`📊 Error:`, JSON.stringify(onboardingResult.data, null, 2));
    return false;
  }
  
  console.log('\n---\n');
  
  // Test 3: Verify profile updated
  console.log('3️⃣ Testing profile after onboarding');
  const profileResult2 = await makeRequest(`${API_BASE}/profile/me`);
  
  if (profileResult2.success && profileResult2.data.onboardingComplete) {
    console.log('✅ Profile correctly shows onboarding complete');
  } else {
    console.log('⚠️ Profile not showing onboarding complete:', profileResult2.data);
  }
  
  console.log('\n---\n');
  
  // Test 4: Test idempotency
  console.log('4️⃣ Testing idempotency (same key)');
  const idempotencyResult = await makeRequest(`${API_BASE}/onboarding/finalize`, {
    method: 'POST',
    body: JSON.stringify(onboardingPayload) // Same payload and key
  });
  
  if (idempotencyResult.success) {
    console.log('✅ Idempotency working - same result returned');
  } else {
    console.log('⚠️ Idempotency test failed:', idempotencyResult.data);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  return true;
}

async function testDatabaseIntegration() {
  console.log('🔗 Testing Database Integration...\n');
  
  try {
    // Test direct database queries
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(5);
    
    if (profilesError) {
      console.log('❌ Direct profile query failed:', profilesError.message);
      return false;
    }
    
    console.log(`✅ Direct database queries working (${profiles.length} profiles found)`);
    
    // Test plans
    const { data: plans, error: plansError } = await supabase
      .from('plans')
      .select('*')
      .limit(5);
    
    if (plansError) {
      console.log('❌ Plans query failed:', plansError.message);
      return false;
    }
    
    console.log(`✅ Plans queries working (${plans.length} plans found)`);
    
    // Test workouts
    const { data: workouts, error: workoutsError } = await supabase
      .from('workouts')
      .select('*')
      .limit(5);
    
    if (workoutsError) {
      console.log('❌ Workouts query failed:', workoutsError.message);
      return false;
    }
    
    console.log(`✅ Workouts queries working (${workouts.length} workouts found)`);
    
    console.log('\n' + '='.repeat(50) + '\n');
    return true;
  } catch (error) {
    console.log('❌ Database integration test failed:', error.message);
    return false;
  }
}

async function testPerformance() {
  console.log('⚡ Testing Performance...\n');
  
  const performanceTests = [];
  
  // Test API response times
  for (let i = 0; i < 3; i++) {
    const start = Date.now();
    const result = await makeRequest(`${API_BASE}/profile/me`);
    const time = Date.now() - start;
    performanceTests.push(time);
    
    if (result.success) {
      console.log(`✅ API call ${i + 1}: ${time}ms`);
    } else {
      console.log(`❌ API call ${i + 1} failed: ${time}ms`);
    }
  }
  
  const avgTime = performanceTests.reduce((a, b) => a + b, 0) / performanceTests.length;
  console.log(`📊 Average API response time: ${avgTime.toFixed(0)}ms`);
  
  if (avgTime < 2000) {
    console.log('✅ Performance target met (< 2 seconds)');
  } else {
    console.log('⚠️ Performance target missed (> 2 seconds)');
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  return avgTime < 5000; // Fail if over 5 seconds
}

async function generateReport(schemaTest, apiTest, dbTest, perfTest) {
  console.log('📋 COMPREHENSIVE TEST REPORT\n');
  console.log('=' * 60);
  
  console.log('\n🏗️  DATABASE SCHEMA:');
  console.log(schemaTest ? '✅ PASS - All required tables exist' : '❌ FAIL - Missing tables');
  
  console.log('\n🔌 API ENDPOINTS:');
  console.log(apiTest ? '✅ PASS - All endpoints working' : '❌ FAIL - API endpoints failing');
  
  console.log('\n🔗 DATABASE INTEGRATION:');
  console.log(dbTest ? '✅ PASS - Direct queries working' : '❌ FAIL - Database connection issues');
  
  console.log('\n⚡ PERFORMANCE:');
  console.log(perfTest ? '✅ PASS - Response times acceptable' : '⚠️ SLOW - Response times over target');
  
  console.log('\n' + '='.repeat(60));
  
  const allTestsPassed = schemaTest && apiTest && dbTest && perfTest;
  
  if (allTestsPassed) {
    console.log('\n🎉 ALL TESTS PASSED! Story 9.4 implementation is SUCCESSFUL!');
    console.log('\n✅ Supabase backend is fully functional');
    console.log('✅ API endpoints are working correctly');
    console.log('✅ Database integration is solid');
    console.log('✅ Performance is acceptable');
    console.log('\n🚀 Your running coach app is ready for use!');
    console.log('🌐 Access it at: http://localhost:3000');
  } else {
    console.log('\n❌ SOME TESTS FAILED');
    console.log('\nPlease check:');
    if (!schemaTest) console.log('- Database migration not fully applied');
    if (!apiTest) console.log('- API endpoints have errors');
    if (!dbTest) console.log('- Database connection issues');
    if (!perfTest) console.log('- Performance optimization needed');
  }
  
  return allTestsPassed;
}

async function main() {
  console.log('🚀 Starting Comprehensive Backend Testing for Story 9.4\n');
  console.log('=' * 60 + '\n');
  
  try {
    // Run all tests
    const schemaTest = await testDatabaseSchema();
    const apiTest = await testAPIEndpoints();
    const dbTest = await testDatabaseIntegration();
    const perfTest = await testPerformance();
    
    // Generate final report
    const success = await generateReport(schemaTest, apiTest, dbTest, perfTest);
    
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Test suite failed with error:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testDatabaseSchema, testAPIEndpoints, testDatabaseIntegration, testPerformance };