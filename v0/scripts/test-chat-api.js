/**
 * Test the chat API endpoint to verify it's working
 */

async function testChatAPI() {
  console.log('\n💬 Testing Chat API...');

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'Hello! This is a test message.'
          }
        ]
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      // Chat API returns a streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        fullResponse += chunk;
        process.stdout.write(chunk);
      }

      console.log('\n\n✅ Chat API is working!');
      console.log('Full response length:', fullResponse.length);
      return true;
    } else {
      const error = await response.text();
      console.error('❌ Chat API failed:', response.status, error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error testing Chat API:', error.message);
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 Chat API Test');
  console.log('='.repeat(60));
  console.log('Note: Make sure the dev server is running at http://localhost:3000');
  console.log('='.repeat(60));

  const result = await testChatAPI();

  console.log('\n' + '='.repeat(60));
  if (result) {
    console.log('✅ TEST PASSED - Chat API is working with new OpenAI key');
  } else {
    console.log('❌ TEST FAILED - Chat API has issues');
  }
  console.log('='.repeat(60));

  process.exit(result ? 0 : 1);
}

main();
