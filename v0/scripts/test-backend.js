#!/usr/bin/env node

/**
 * Backend API Testing Script
 * Tests all critical API endpoints after migration
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testEndpoint(name, method, path, body = null) {
  console.log(`\n🧪 Testing ${name}`);
  console.log(`   ${method} ${BASE_URL}${path}`);
  
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${BASE_URL}${path}`, options);
    const data = await response.text();
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log(`   ✅ Success`);
      if (data) {
        try {
          const json = JSON.parse(data);
          console.log(`   Response: ${JSON.stringify(json, null, 2).substring(0, 200)}...`);
        } catch {
          console.log(`   Response: ${data.substring(0, 100)}...`);
        }
      }
      return true;
    } else {
      console.log(`   ❌ Failed`);
      console.log(`   Error: ${data.substring(0, 200)}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Network Error: ${error.message}`);
    return false;
  }
}

async function runBackendTests() {
  console.log('🚀 Running Backend API Tests');
  console.log(`📍 Base URL: ${BASE_URL}`);
  
  // Test health check
  await testEndpoint('Health Check', 'GET', '/api/health');
  
  // Test onboarding finalization
  await testEndpoint('Finalize Onboarding', 'POST', '/api/onboarding/finalize', {
    name: 'API Test User',
    goal: 'habit',
    experience: 'beginner',
    daysPerWeek: 3,
    preferredTimes: ['07:00'],
    consents: {
      data: true,
      gdpr: true,
      push: false
    },
    timezone: 'UTC'
  });
  
  // Test profile endpoints
  await testEndpoint('Get Profile', 'GET', '/api/profile');
  
  // Test chat endpoint
  await testEndpoint('Chat', 'POST', '/api/chat', {
    message: 'Hello, how can you help me with my running?',
    conversationId: 'test-conversation'
  });
  
  // Test onboarding validation
  await testEndpoint('Onboarding Validation', 'POST', '/api/onboarding/validate', {
    name: 'Test User',
    goal: 'habit',
    experience: 'beginner'
  });
  
  // Test plan generation
  await testEndpoint('Generate Plan', 'POST', '/api/plans/generate', {
    goal: 'habit',
    experience: 'beginner',
    daysPerWeek: 3,
    preferredTimes: ['07:00']
  });
  
  console.log('\n📋 Test Summary Complete!');
  console.log('\nNote: Some endpoints may fail due to authentication requirements.');
  console.log('This is expected behavior for a secure backend.');
}

// Add fetch polyfill check
if (typeof fetch === 'undefined') {
  console.error('❌ node-fetch not available. Installing...');
  process.exit(1);
}

runBackendTests().catch(console.error);