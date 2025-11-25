// Test database connection and basic functionality
console.log('🧪 Testing database connection...');

async function testDatabase() {
  try {
    // Import the database
    const { dbUtils } = await import('./lib/dbUtils.js');
    
    console.log('✅ Database imported successfully');
    
    // Test getting current user
    const user = await dbUtils.getCurrentUser();
    console.log('👤 Current user:', user ? 'Found' : 'Not found');
    
    if (user) {
      console.log('📋 User details:', {
        id: user.id,
        name: user.name,
        onboardingComplete: user.onboardingComplete
      });
    } else {
      console.log('ℹ️ No user found - this is normal for new installations');
    }
    
    console.log('✅ Database test completed successfully');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

testDatabase(); 