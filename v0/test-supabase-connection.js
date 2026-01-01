#!/usr/bin/env node

/**
 * Quick test script to verify Supabase connection
 * Run with: node test-supabase-connection.js
 */

require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n🔍 SUPABASE CONNECTION TEST\n');
console.log('============================\n');

// Check environment variables
console.log('1. Checking environment variables...\n');

if (!SUPABASE_URL) {
  console.log('❌ NEXT_PUBLIC_SUPABASE_URL is not set');
  process.exit(1);
}
console.log(`✅ Supabase URL: ${SUPABASE_URL}`);

if (!ANON_KEY) {
  console.log('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  process.exit(1);
}

// Check if key format is correct (JWT starts with eyJ)
if (ANON_KEY.startsWith('eyJ')) {
  console.log(`✅ Anon key format: Valid JWT (${ANON_KEY.substring(0, 20)}...)`);
} else {
  console.log(`⚠️  Anon key format: ${ANON_KEY}`);
  console.log('   Warning: Real Supabase keys start with "eyJ"');
  console.log('   This looks like a placeholder key!');
}

if (!SERVICE_KEY) {
  console.log('❌ SUPABASE_SERVICE_ROLE_KEY is not set');
  process.exit(1);
}

if (SERVICE_KEY.startsWith('eyJ')) {
  console.log(`✅ Service key format: Valid JWT (${SERVICE_KEY.substring(0, 20)}...)`);
} else {
  console.log(`⚠️  Service key format: ${SERVICE_KEY}`);
  console.log('   Warning: Real Supabase keys start with "eyJ"');
  console.log('   This looks like a placeholder key!');
}

console.log('\n2. Testing connection...\n');

// Test connection
const testUrl = `${SUPABASE_URL}/rest/v1/beta_signups?select=count`;

async function testConnection() {
  try {
    const response = await fetch(testUrl, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      }
    });

    const text = await response.text();

    if (response.ok) {
      console.log('✅ Connection successful!');
      console.log(`   Response: ${text}`);
      console.log('\n3. Testing insert permission...\n');

      // Test insert
      const insertUrl = `${SUPABASE_URL}/rest/v1/beta_signups`;
      const testData = {
        email: `test-${Date.now()}@example.com`,
        experience_level: 'beginner',
        goals: '["habit"]',
        hear_about_us: 'test'
      };

      const insertResponse = await fetch(insertUrl, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(testData)
      });

      if (insertResponse.ok) {
        console.log('✅ Test insert successful!');
        console.log('   Your Supabase connection is working correctly!');
        console.log('\n✅ ALL TESTS PASSED! Beta signup should work now.\n');
      } else {
        const errorText = await insertResponse.text();
        console.log(`❌ Test insert failed: ${insertResponse.status}`);
        console.log(`   Error: ${errorText}`);
      }

    } else {
      console.log(`❌ Connection failed: ${response.status}`);
      console.log(`   Response: ${text}`);

      if (text.includes('Invalid API key')) {
        console.log('\n🔧 FIX NEEDED:');
        console.log('   Your API keys are invalid or placeholder keys.');
        console.log('   Get real keys from: https://supabase.com/dashboard/project/dxqglotcyirxzyqaxqln/settings/api');
        console.log('   Real keys start with "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."');
      }
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

testConnection();
