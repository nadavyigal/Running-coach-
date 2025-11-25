// Debug script to test the chat API
// Run this in browser console on localhost:3005

console.log('🧪 Testing Chat API...');

async function testChatAPI() {
  try {
    console.log('📤 Sending test request to /api/chat...');
    
    const testPayload = {
      messages: [
        { role: 'user', content: 'Hello, can you help me with my running training?' }
      ],
      userId: '1',
      userContext: 'Test user context'
    };
    
    console.log('📝 Request payload:', testPayload);
    
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      try {
        const errorJson = JSON.parse(errorText);
        console.error('❌ Parsed Error:', errorJson);
      } catch {
        console.error('❌ Raw Error Text:', errorText);
      }
      return;
    }
    
    console.log('✅ Response is OK, reading stream...');
    
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    
    while (reader) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('✅ Stream complete');
        break;
      }
      
      const chunk = decoder.decode(value);
      console.log('📦 Received chunk:', chunk);
      fullResponse += chunk;
    }
    
    console.log('✅ Full response received:', fullResponse);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  }
}

// Test different scenarios
async function runAllTests() {
  console.log('🧪 Running comprehensive chat API tests...');
  console.log('='.repeat(50));
  
  // Test 1: Basic chat
  console.log('🧪 Test 1: Basic chat request');
  await testChatAPI();
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 2: Empty message
  console.log('\n🧪 Test 2: Empty message');
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [],
        userId: '1'
      }),
    });
    console.log('📊 Empty message response:', response.status);
    const text = await response.text();
    console.log('📊 Empty message body:', text);
  } catch (error) {
    console.error('❌ Empty message test failed:', error);
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 3: Invalid JSON
  console.log('\n🧪 Test 3: Invalid JSON');
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json',
    });
    console.log('📊 Invalid JSON response:', response.status);
    const text = await response.text();
    console.log('📊 Invalid JSON body:', text);
  } catch (error) {
    console.error('❌ Invalid JSON test failed:', error);
  }
  
  console.log('\n✅ All tests completed');
}

// Auto-run tests
runAllTests();

// Export test function for manual use
window.debugChat = {
  test: testChatAPI,
  runAllTests: runAllTests,
  testBasic: testChatAPI
};

console.log('🔧 Debug functions available:');
console.log('- debugChat.test() - Test basic chat');
console.log('- debugChat.runAllTests() - Run comprehensive tests');