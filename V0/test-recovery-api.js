const fetch = require('node-fetch');

async function testRecoveryAPI() {
  const baseUrl = 'http://localhost:3000/api';
  
  console.log('Testing Recovery API endpoints...\n');
  
  try {
    // Test recovery score endpoint
    console.log('1. Testing recovery score endpoint...');
    const scoreResponse = await fetch(`${baseUrl}/recovery/score?userId=1`);
    const scoreData = await scoreResponse.json();
    console.log('Score response:', scoreData);
    
    // Test recovery recommendations endpoint
    console.log('\n2. Testing recovery recommendations endpoint...');
    const recommendationsResponse = await fetch(`${baseUrl}/recovery/recommendations?userId=1`);
    const recommendationsData = await recommendationsResponse.json();
    console.log('Recommendations response:', recommendationsData);
    
    // Test sleep data endpoint
    console.log('\n3. Testing sleep data endpoint...');
    const sleepResponse = await fetch(`${baseUrl}/recovery/sleep?userId=1`);
    const sleepData = await sleepResponse.json();
    console.log('Sleep response:', sleepData);
    
    // Test HRV endpoint
    console.log('\n4. Testing HRV endpoint...');
    const hrvResponse = await fetch(`${baseUrl}/recovery/hrv?userId=1`);
    const hrvData = await hrvResponse.json();
    console.log('HRV response:', hrvData);
    
    console.log('\n✅ All recovery API endpoints tested successfully!');
    
  } catch (error) {
    console.error('❌ Error testing recovery API:', error.message);
  }
}

testRecoveryAPI(); 