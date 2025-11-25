// Debug script for onboarding chat AI communication issues
// Run this in browser console on localhost:3005

console.log('🧪 Testing Onboarding Chat API...');

async function testOnboardingChatAPI() {
  try {
    console.log('📤 Sending test request to /api/onboarding/chat...');
    
    const testPayload = {
      messages: [
        { role: 'user', content: 'Hello, I want to start running. Can you help me set some goals?' }
      ],
      userId: '1',
      userContext: 'New user looking to start running',
      currentPhase: 'motivation'
    };
    
    console.log('📝 Request payload:', testPayload);
    
    const response = await fetch('/api/onboarding/chat', {
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
        
        if (errorJson.fallback) {
          console.log('🔄 This is a fallback response, not a real error');
          return;
        }
      } catch {
        console.error('❌ Raw Error Text:', errorText);
      }
      return;
    }
    
    console.log('✅ Response is OK, reading stream...');
    
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    
    if (!reader) {
      console.error('❌ No reader available');
      return;
    }
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('✅ Stream complete');
          break;
        }
        
        const chunk = decoder.decode(value);
        console.log('📦 Received chunk:', chunk);
        fullResponse += chunk;
      }
    } catch (streamError) {
      console.error('❌ Streaming error:', streamError);
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

// Test onboarding session initialization
async function testOnboardingSessionInit() {
  console.log('🧪 Testing onboarding session initialization...');
  
  try {
    // Check if required libraries are available
    if (typeof window.indexedDB === 'undefined') {
      console.error('❌ IndexedDB not available');
      return;
    }
    
    // Try to access the database
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('RunSmartDB');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    console.log('✅ Database accessible');
    
    // Check for users table
    const transaction = db.transaction(['users'], 'readonly');
    const userStore = transaction.objectStore('users');
    const userCount = await new Promise((resolve, reject) => {
      const countRequest = userStore.count();
      countRequest.onsuccess = () => resolve(countRequest.result);
      countRequest.onerror = () => reject(countRequest.error);
    });
    
    console.log(`👥 Users in database: ${userCount}`);
    
    if (userCount === 0) {
      console.log('⚠️ No users found - onboarding should create a new user');
    }
    
    db.close();
    
  } catch (error) {
    console.error('❌ Session init test failed:', error);
  }
}

// Test environment variables and API keys
async function testEnvironment() {
  console.log('🧪 Testing environment configuration...');
  
  try {
    const response = await fetch('/api/test-chat');
    const data = await response.json();
    
    console.log('🔧 Environment status:', data);
    
    if (data.openaiKey === 'Missing') {
      console.error('❌ OpenAI API key is missing!');
      console.log('💡 Check your .env.local file');
    } else {
      console.log('✅ OpenAI API key is configured');
    }
    
  } catch (error) {
    console.error('❌ Environment test failed:', error);
  }
}

// Test chat history loading
async function testChatHistoryLoading() {
  console.log('🧪 Testing chat history loading...');
  
  try {
    // Check localStorage for conversation data
    const keys = Object.keys(localStorage);
    const conversationKeys = keys.filter(key => 
      key.includes('conversation') || 
      key.includes('onboarding') ||
      key.includes('session')
    );
    
    console.log('💾 Conversation-related localStorage keys:', conversationKeys);
    
    if (conversationKeys.length > 0) {
      conversationKeys.forEach(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          console.log(`📋 ${key}:`, data);
        } catch {
          console.log(`📋 ${key}:`, localStorage.getItem(key));
        }
      });
    } else {
      console.log('📭 No conversation history found in localStorage');
    }
    
  } catch (error) {
    console.error('❌ Chat history test failed:', error);
  }
}

// Comprehensive onboarding chat diagnostic
async function diagnoseOnboardingChat() {
  console.log('🔍 Starting comprehensive onboarding chat diagnosis...');
  console.log('='.repeat(60));
  
  await testEnvironment();
  console.log('-'.repeat(30));
  
  await testOnboardingSessionInit();
  console.log('-'.repeat(30));
  
  await testChatHistoryLoading();
  console.log('-'.repeat(30));
  
  await testOnboardingChatAPI();
  
  console.log('='.repeat(60));
  console.log('📋 Diagnosis complete!');
  console.log('');
  console.log('💡 Common issues and fixes:');
  console.log('1. If API key is missing: Check .env.local file');
  console.log('2. If database errors: Run debugOnboarding.quickFix()');
  console.log('3. If chat hangs: Check network tab for failed requests');
  console.log('4. If history not loading: Clear localStorage and refresh');
}

// Quick fix for common onboarding chat issues
async function quickFixOnboardingChat() {
  console.log('🚀 Applying quick fix for onboarding chat...');
  
  // Clear potentially problematic localStorage
  const keysToRemove = [
    'onboardingSession',
    'conversationHistory',
    'currentSession',
    'onboardingComplete'
  ];
  
  keysToRemove.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      console.log(`🗑️ Cleared ${key}`);
    }
  });
  
  // Reset database if needed
  try {
    const deleteRequest = indexedDB.deleteDatabase('RunSmartDB');
    deleteRequest.onsuccess = () => {
      console.log('🔄 Database reset');
      console.log('✅ Quick fix complete - refresh the page!');
    };
  } catch (error) {
    console.error('❌ Database reset failed:', error);
  }
}

// Export functions for manual use
window.debugOnboardingChat = {
  diagnose: diagnoseOnboardingChat,
  testAPI: testOnboardingChatAPI,
  testSession: testOnboardingSessionInit,
  testEnvironment: testEnvironment,
  testHistory: testChatHistoryLoading,
  quickFix: quickFixOnboardingChat
};

// Auto-run diagnosis
diagnoseOnboardingChat();

console.log('🔧 Debug functions available:');
console.log('- debugOnboardingChat.diagnose() - Run full diagnosis');
console.log('- debugOnboardingChat.testAPI() - Test onboarding chat API');
console.log('- debugOnboardingChat.testSession() - Test session initialization');
console.log('- debugOnboardingChat.quickFix() - Apply quick fix');