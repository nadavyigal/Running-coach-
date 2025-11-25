// Test script for onboarding chat API
// Using built-in fetch (available in Node.js 18+)

async function testOnboardingAPI() {
  const baseUrl = 'http://localhost:3000'; // Updated to port 3000
  
  console.log('🧪 Testing Onboarding Chat API...');
  
  // Test 1: Empty request body
  console.log('\n1. Testing empty request body...');
  try {
    const response1 = await fetch(`${baseUrl}/api/onboarding/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: ''
    });
    const data1 = await response1.json();
    console.log('Status:', response1.status);
    console.log('Response:', data1);
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  // Test 2: Invalid JSON
  console.log('\n2. Testing invalid JSON...');
  try {
    const response2 = await fetch(`${baseUrl}/api/onboarding/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json'
    });
    const data2 = await response2.json();
    console.log('Status:', response2.status);
    console.log('Response:', data2);
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  // Test 3: Missing required fields
  console.log('\n3. Testing missing required fields...');
  try {
    const response3 = await fetch(`${baseUrl}/api/onboarding/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '123' })
    });
    const data3 = await response3.json();
    console.log('Status:', response3.status);
    console.log('Response:', data3);
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  // Test 4: Valid request (should work with API key)
  console.log('\n4. Testing valid request...');
  try {
    const response4 = await fetch(`${baseUrl}/api/onboarding/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'Hello, I want to start running' }
        ],
        userId: '123',
        currentPhase: 'motivation',
        userContext: 'New user starting onboarding'
      })
    });
    const data4 = await response4.json();
    console.log('Status:', response4.status);
    console.log('Response:', data4);
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n✅ API testing complete!');
}

// Run the test
testOnboardingAPI().catch(console.error); 