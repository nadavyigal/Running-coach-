// Simple test to verify the database operations
console.log('🔍 Starting simple database test...')

// This test will only work in the browser, not in Node.js
if (typeof window === 'undefined') {
  console.log('❌ This test needs to run in the browser')
  console.log('📋 Open the browser console and paste this code')
  process.exit(1)
}

async function testDatabase() {
  try {
    console.log('📦 Importing database utilities...')
    const { dbUtils } = await import('./lib/db.js')
    
    console.log('🧹 Clearing database...')
    await dbUtils.clearDatabase()
    
    console.log('📋 Creating user...')
    const userData = {
      goal: 'habit',
      experience: 'beginner',
      preferredTimes: ['morning'],
      daysPerWeek: 3,
      consents: {
        data: true,
        gdpr: true,
        push: false
      },
      onboardingComplete: true,
      age: 25
    }
    
    console.log('📊 User data to create:', userData)
    const userId = await dbUtils.createUser(userData)
    console.log('✅ User created with ID:', userId)
    
    console.log('📋 Retrieving user with getCurrentUser()...')
    const user = await dbUtils.getCurrentUser()
    
    if (user) {
      console.log('✅ SUCCESS: getCurrentUser() returned:', user)
      console.log('🔍 User ID:', user.id)
      console.log('🔍 onboardingComplete:', user.onboardingComplete, typeof user.onboardingComplete)
    } else {
      console.log('❌ FAILED: getCurrentUser() returned null')
      
      // Let's check what's in the database directly
      console.log('📋 Checking database directly...')
      const { getDatabase } = await import('./lib/db.js')
      const database = getDatabase()
      
      if (database) {
        const allUsers = await database.users.toArray()
        console.log('📊 All users in database:', allUsers)
        
        const completedUsers = await database.users.where('onboardingComplete').equals(true).toArray()
        console.log('📊 Users with onboardingComplete=true:', completedUsers)
        
        const completedUsersAlt = await database.users.where('onboardingComplete').equals(1).toArray()
        console.log('📊 Users with onboardingComplete=1:', completedUsersAlt)
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Only run in browser
if (typeof window !== 'undefined') {
  testDatabase()
} else {
  module.exports = { testDatabase }
}