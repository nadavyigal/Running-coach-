// Test script for AI functionality with API key
// Using built-in fetch (available in Node.js 18+)

async function testAIFunctionality() {
  const baseUrl = 'http://localhost:3000'; // Updated to port 3000
  
  console.log('🧪 Testing AI Functionality...');
  
  // Test valid request with proper data
  console.log('\n1. Testing valid AI request...');
  try {
    const response = await fetch(`${baseUrl}/api/onboarding/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'Hello, I want to start running and improve my fitness' }
        ],
        userId: '123',
        currentPhase: 'motivation',
        userContext: 'New user starting onboarding process'
      })
    });
    
    console.log('Status:', response.status);
    
    if (response.status === 200) {
      console.log('✅ AI request successful!');
      console.log('Headers:', {
        'X-Coaching-Interaction-Id': response.headers.get('X-Coaching-Interaction-Id'),
        'X-Coaching-Confidence': response.headers.get('X-Coaching-Confidence'),
        'X-Onboarding-Next-Phase': response.headers.get('X-Onboarding-Next-Phase')
      });
      
      // Try to read the streaming response
      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let content = '';
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            content += chunk;
          }
          console.log('✅ Streaming response received successfully');
          console.log('Response length:', content.length, 'characters');
        } catch (streamError) {
          console.log('⚠️ Streaming error (this might be normal):', streamError.message);
        }
      }
    } else {
      const errorData = await response.json();
      console.log('❌ AI request failed:', errorData);
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
  
  console.log('\n✅ AI functionality testing complete!');
}

// Run the test
testAIFunctionality().catch(console.error); 