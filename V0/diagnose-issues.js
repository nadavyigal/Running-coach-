/**
 * Comprehensive Diagnostic Script for Running Coach App Issues
 * 
 * This script checks:
 * 1. Database schema integrity and connectivity
 * 2. User onboarding status and plan creation
 * 3. OpenAI API configuration
 * 4. Goals system functionality
 * 5. Chat system health
 */

const path = require('path');

// Set up the environment to load the same config as the app
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

console.log('🔍 Running Coach App Diagnostic Script');
console.log('=====================================\n');

async function runDiagnostics() {
  try {
    console.log('📊 1. Environment Check');
    console.log('----------------------');
    
    // Check environment variables
    const requiredEnvVars = ['OPENAI_API_KEY', 'DATABASE_URL'];
    const optionalEnvVars = ['NEXT_PUBLIC_POSTHOG_KEY', 'NEXT_PUBLIC_POSTHOG_HOST'];
    
    console.log('Required Environment Variables:');
    requiredEnvVars.forEach(envVar => {
      const value = process.env[envVar];
      const status = value ? '✅ Set' : '❌ Missing';
      const preview = value ? `(${value.substring(0, 10)}...)` : '';
      console.log(`  ${envVar}: ${status} ${preview}`);
    });
    
    console.log('\nOptional Environment Variables:');
    optionalEnvVars.forEach(envVar => {
      const value = process.env[envVar];
      const status = value ? '✅ Set' : '⚠️  Not set';
      console.log(`  ${envVar}: ${status}`);
    });

    console.log('\n🗄️  2. Database Schema Check');
    console.log('---------------------------');
    
    try {
      // Import database utilities
      const { db } = await import('./lib/db.js');
      const { dbUtils } = await import('./lib/dbUtils.js');
      
      console.log('✅ Database module loaded successfully');
      
      // Check if we can access the database
      console.log('Checking database connectivity...');
      
      try {
        // Try to get the current user
        const currentUser = await dbUtils.getCurrentUser();
        console.log(`✅ Database connection: Working`);
        console.log(`📱 Current user: ${currentUser ? `ID ${currentUser.id} (${currentUser.name || 'No name'})` : 'None found'}`);
        
        if (currentUser) {
          // Check onboarding status
          console.log(`📋 Onboarding complete: ${currentUser.onboardingComplete ? '✅ Yes' : '❌ No'}`);
          
          // Check for active plan
          try {
            const activePlan = await dbUtils.getActivePlan(currentUser.id);
            console.log(`🎯 Active plan: ${activePlan ? `✅ Found (ID: ${activePlan.id}, Title: "${activePlan.title}")` : '❌ Not found'}`);
            
            if (activePlan) {
              console.log(`   - Start Date: ${activePlan.startDate}`);
              console.log(`   - End Date: ${activePlan.endDate}`);
              console.log(`   - Plan Type: ${activePlan.planType}`);
              console.log(`   - Total Weeks: ${activePlan.totalWeeks}`);
            }
          } catch (planError) {
            console.log(`❌ Error getting active plan: ${planError.message}`);
          }
          
          // Check goals
          try {
            const goals = await db.goals.where('userId').equals(currentUser.id).toArray();
            console.log(`🎯 Goals count: ${goals.length}`);
          } catch (goalError) {
            console.log(`❌ Error getting goals: ${goalError.message}`);
          }
          
          // Check coaching profile
          try {
            const coachingProfile = await dbUtils.getCoachingProfile(currentUser.id);
            console.log(`🤖 Coaching profile: ${coachingProfile ? '✅ Found' : '❌ Not found'}`);
          } catch (coachingError) {
            console.log(`❌ Error getting coaching profile: ${coachingError.message}`);
          }
        }
        
      } catch (dbError) {
        console.log(`❌ Database connection failed: ${dbError.message}`);
      }
      
    } catch (importError) {
      console.log(`❌ Failed to import database module: ${importError.message}`);
    }

    console.log('\n🎯 3. Goals System Check');
    console.log('------------------------');
    
    try {
      // Test goals API endpoint
      const goalApiUrl = 'http://localhost:3002/api/goals';
      console.log(`Testing Goals API: ${goalApiUrl}`);
      
      const fetch = (await import('node-fetch')).default;
      const goalResponse = await fetch(goalApiUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log(`Goals API status: ${goalResponse.status}`);
      if (!goalResponse.ok) {
        const errorText = await goalResponse.text();
        console.log(`Goals API error: ${errorText}`);
      } else {
        console.log('✅ Goals API responding');
      }
    } catch (goalApiError) {
      console.log(`❌ Goals API test failed: ${goalApiError.message}`);
    }

    console.log('\n💬 4. Chat System Check');
    console.log('----------------------');
    
    // Check OpenAI configuration
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      console.log('❌ OPENAI_API_KEY not set - this will cause chat to fail');
    } else {
      console.log('✅ OPENAI_API_KEY is configured');
      
      // Test a simple OpenAI request
      try {
        const fetch = (await import('node-fetch')).default;
        const openaiResponse = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (openaiResponse.ok) {
          console.log('✅ OpenAI API key is valid');
        } else {
          console.log(`❌ OpenAI API key invalid: ${openaiResponse.status}`);
        }
      } catch (openaiError) {
        console.log(`❌ OpenAI connectivity test failed: ${openaiError.message}`);
      }
    }
    
    // Test chat API endpoint
    try {
      const chatApiUrl = 'http://localhost:3002/api/chat';
      console.log(`Testing Chat API: ${chatApiUrl}`);
      
      const fetch = (await import('node-fetch')).default;
      const chatResponse = await fetch(chatApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'test' }],
          userId: 1
        })
      });
      
      console.log(`Chat API status: ${chatResponse.status}`);
      if (!chatResponse.ok) {
        const errorText = await chatResponse.text();
        console.log(`Chat API error: ${errorText}`);
      } else {
        console.log('✅ Chat API responding');
      }
    } catch (chatApiError) {
      console.log(`❌ Chat API test failed: ${chatApiError.message}`);
    }

    console.log('\n📋 5. Summary & Recommendations');
    console.log('===============================');
    
    // Provide recommendations based on findings
    console.log('\n🔧 Potential Issues Found:');
    
    if (!process.env.OPENAI_API_KEY) {
      console.log('❌ Missing OPENAI_API_KEY - Chat will not work');
      console.log('   Solution: Add OPENAI_API_KEY to your .env.local file');
    }
    
    console.log('\n💡 Next Steps:');
    console.log('1. Fix any missing environment variables');
    console.log('2. Ensure user has completed onboarding');
    console.log('3. Check if active plan exists after onboarding');
    console.log('4. Test goals creation manually');
    console.log('5. Verify chat system with valid OpenAI key');

  } catch (error) {
    console.log(`❌ Diagnostic script failed: ${error.message}`);
    console.log(error.stack);
  }
}

// Run diagnostics if this file is executed directly
if (require.main === module) {
  runDiagnostics().catch(console.error);
}

module.exports = { runDiagnostics };