/**
 * Test script to verify API keys are working correctly
 * Run with: node scripts/test-api-keys.js
 */

// Load environment variables from .env.local manually
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      process.env[key] = value;
    }
  });
}

async function testOpenAI() {
  console.log('\n🔑 Testing OpenAI API Key...');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in .env.local');
    return false;
  }

  if (!apiKey.startsWith('sk-')) {
    console.error('❌ Invalid OpenAI API key format (should start with sk-)');
    return false;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      console.log('✅ OpenAI API Key is valid and working');
      return true;
    } else {
      const error = await response.text();
      console.error('❌ OpenAI API Key validation failed:', response.status, error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing OpenAI API:', error.message);
    return false;
  }
}

async function testResend() {
  console.log('\n📧 Testing Resend API Key...');

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('❌ RESEND_API_KEY not found in .env.local');
    return false;
  }

  if (!apiKey.startsWith('re_')) {
    console.error('❌ Invalid Resend API key format (should start with re_)');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    // Resend returns 200 for valid keys, even if no emails exist
    if (response.status === 200 || response.status === 401) {
      if (response.status === 200) {
        console.log('✅ Resend API Key is valid and working');
        return true;
      } else {
        console.error('❌ Resend API Key is invalid or unauthorized');
        return false;
      }
    } else {
      const error = await response.text();
      console.error('❌ Resend API Key validation failed:', response.status, error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing Resend API:', error.message);
    return false;
  }
}

async function testPostHog() {
  console.log('\n📊 Testing PostHog API Key...');

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.NEXT_PUBLIC_POSTHOG_API_KEY;
  if (!apiKey) {
    console.error('❌ NEXT_PUBLIC_POSTHOG_KEY not found in .env.local (legacy NEXT_PUBLIC_POSTHOG_API_KEY also accepted)');
    return false;
  }

  if (!apiKey.startsWith('phc_')) {
    console.error('❌ Invalid PostHog API key format (should start with phc_)');
    return false;
  }

  console.log('✅ PostHog API Key format is valid');
  console.log('   Note: PostHog client-side keys are verified on first use');
  return true;
}

async function main() {
  console.log('='.repeat(60));
  console.log('🔐 API Key Validation Test');
  console.log('='.repeat(60));

  const results = {
    openai: await testOpenAI(),
    resend: await testResend(),
    posthog: await testPostHog(),
  };

  console.log('\n' + '='.repeat(60));
  console.log('📋 Summary:');
  console.log('='.repeat(60));
  console.log(`OpenAI:  ${results.openai ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Resend:  ${results.resend ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`PostHog: ${results.posthog ? '✅ PASS' : '❌ FAIL'}`);
  console.log('='.repeat(60));

  const allPassed = Object.values(results).every(r => r);

  if (allPassed) {
    console.log('\n🎉 All API keys are valid and working!');
    console.log('✅ Ready for production build\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some API keys failed validation');
    console.log('⚠️  Please check your .env.local file and update the keys\n');
    process.exit(1);
  }
}

main();
