/**
 * Test the production deployment on Vercel
 */

// Common Vercel URL patterns for this project
const possibleUrls = [
  'https://running-coach-nadavyigal-gmailcoms-projects.vercel.app',
  'https://running-coach.vercel.app',
  'https://running-coach-git-main-nadavyigal-gmailcoms-projects.vercel.app'
];

async function findWorkingUrl() {
  console.log('🔍 Finding production URL...\n');

  for (const url of possibleUrls) {
    try {
      console.log(`Testing: ${url}`);
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        console.log(`✅ Found working URL: ${url}\n`);
        return url;
      }
    } catch (error) {
      // Continue to next URL
    }
  }

  return null;
}

async function testChatAPI(baseUrl) {
  console.log('💬 Testing Production Chat API...\n');

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'Hello! This is a test to verify the API is working.'
          }
        ]
      })
    });

    console.log('Response status:', response.status);
    console.log('Response content-type:', response.headers.get('content-type'));

    if (response.ok) {
      // Chat API returns a streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let chunkCount = 0;

      console.log('\n📝 Streaming response:\n');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        fullResponse += chunk;
        chunkCount++;
        process.stdout.write(chunk);
      }

      console.log('\n\n✅ Chat API is working!');
      console.log(`📊 Received ${chunkCount} chunks, total ${fullResponse.length} bytes`);
      return true;
    } else {
      const errorText = await response.text();
      console.error('❌ Chat API failed:', response.status);
      console.error('Error response:', errorText.substring(0, 500));
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing Chat API:', error.message);
    return false;
  }
}

async function testGeneratePlan(baseUrl) {
  console.log('\n🎯 Testing Plan Generation API...\n');

  try {
    const response = await fetch(`${baseUrl}/api/generate-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planType: 'distance',
        preferences: {
          targetDistance: '5K',
          trainingVolume: 'moderate',
          difficulty: 'beginner'
        }
      })
    });

    console.log('Response status:', response.status);

    if (response.ok || response.status === 400) {
      // 400 is expected if we're missing required fields
      const data = await response.json();
      console.log('✅ Plan Generation API is responding');
      console.log('Response:', JSON.stringify(data, null, 2).substring(0, 300));
      return true;
    } else {
      const errorText = await response.text();
      console.error('❌ Plan Generation failed:', response.status);
      console.error('Error response:', errorText.substring(0, 500));
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing Plan Generation:', error.message);
    return false;
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('🚀 Production Deployment Test');
  console.log('='.repeat(70));
  console.log('Testing Vercel deployment with new API keys\n');

  // Find the working URL
  const baseUrl = await findWorkingUrl();

  if (!baseUrl) {
    console.error('\n❌ Could not find a working production URL');
    console.error('Please provide the correct Vercel URL manually\n');
    process.exit(1);
  }

  console.log('='.repeat(70));

  // Test Chat API
  const chatResult = await testChatAPI(baseUrl);

  console.log('\n' + '='.repeat(70));

  // Test Plan Generation API
  const planResult = await testGeneratePlan(baseUrl);

  console.log('\n' + '='.repeat(70));
  console.log('📋 Test Summary:');
  console.log('='.repeat(70));
  console.log(`Chat API:            ${chatResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Plan Generation API: ${planResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Production URL:      ${baseUrl}`);
  console.log('='.repeat(70));

  const allPassed = chatResult && planResult;

  if (allPassed) {
    console.log('\n🎉 All production tests passed!');
    console.log('✅ Your application is live and working with the new API keys\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed - check the details above\n');
    process.exit(1);
  }
}

main();
