/**
 * Check production environment health and configuration
 */

const PRODUCTION_URL = 'https://running-coach-nadavyigal-gmailcoms-projects.vercel.app';

async function checkHealth() {
  console.log('='.repeat(70));
  console.log('🏥 Production Environment Health Check');
  console.log('='.repeat(70));
  console.log();

  try {
    console.log('1️⃣  Checking diagnostic endpoint...');
    const response = await fetch(`${PRODUCTION_URL}/api/health?diagnostic=true`);

    if (!response.ok) {
      console.error(`❌ Health check failed: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();
    console.log('✅ Diagnostic endpoint responding\n');

    console.log('📊 Environment Check Results:');
    console.log('━'.repeat(70));
    console.log(`Environment: ${data.environment}`);
    console.log(`Timestamp:   ${data.timestamp}`);
    console.log();

    console.log('🔑 API Key Configuration:');
    console.log('━'.repeat(70));
    console.log(`OpenAI Configured: ${data.checks.openai.configured ? '✅ YES' : '❌ NO'}`);
    console.log(`OpenAI Prefix:     ${data.checks.openai.prefix}`);
    console.log(`Valid Environment: ${data.checks.openai.valid ? '✅ YES' : '❌ NO'}`);
    console.log();

    if (data.checks.issues && data.checks.issues.length > 0) {
      console.log('⚠️  Configuration Issues Found:');
      console.log('━'.repeat(70));
      data.checks.issues.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue}`);
      });
      console.log();
    }

    console.log('='.repeat(70));

    if (!data.checks.openai.configured) {
      console.log('❌ PROBLEM FOUND: OpenAI API key not configured on Vercel');
      console.log();
      console.log('🔧 TO FIX:');
      console.log('1. Go to: https://vercel.com/nadavyigal-gmailcoms-projects/running-coach/settings/environment-variables');
      console.log('2. Make sure OPENAI_API_KEY is set');
      console.log('3. Value should start with: sk-proj-');
      console.log('4. After updating, redeploy the application');
    } else if (!data.checks.openai.valid) {
      console.log('❌ PROBLEM FOUND: OpenAI API key configured but invalid');
      console.log();
      console.log('🔧 TO FIX:');
      console.log('1. Go to: https://vercel.com/nadavyigal-gmailcoms-projects/running-coach/settings/environment-variables');
      console.log('2. Check that OPENAI_API_KEY value is correct');
      console.log('3. Get a new key from: https://platform.openai.com/api-keys');
      console.log('4. Update the value and redeploy');
    } else {
      console.log('✅ Environment configuration looks good!');
      console.log('   The 500 error might be caused by something else.');
    }

    console.log('='.repeat(70));
    console.log();

  } catch (error) {
    console.error('❌ Failed to check health:', error.message);
    console.log();
    console.log('This might mean:');
    console.log('1. The diagnostic endpoint hasn\'t deployed yet (wait 2-3 minutes)');
    console.log('2. The deployment failed');
    console.log('3. There\'s a network issue');
  }
}

checkHealth();
