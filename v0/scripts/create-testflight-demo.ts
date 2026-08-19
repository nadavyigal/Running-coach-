/**
 * Create TestFlight Demo Account
 * Usage: npx tsx scripts/create-testflight-demo.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEMO_EMAIL = 'testflight@runsmart-ai.com'
const DEMO_PASSWORD = 'TestFlight2024!'

async function createDemoAccount() {
  console.log('Creating TestFlight demo account...')

  const { data, error } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'TestFlight Tester' },
  })

  if (error) {
    if (error.message.includes('already been registered') || error.message.includes('already exists')) {
      console.log('✅ Demo account already exists:', DEMO_EMAIL)
      console.log('Password:', DEMO_PASSWORD)
      return
    }
    console.error('❌ Error creating user:', error.message)
    process.exit(1)
  }

  console.log('✅ Demo account created:', DEMO_EMAIL)
  console.log('User ID:', data.user.id)
  console.log('Password:', DEMO_PASSWORD)

  // Create a profile for the demo account
  if (data.user) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      auth_user_id: data.user.id,
      name: 'TestFlight Tester',
      goal: 'habit',
      experience: 'intermediate',
      days_per_week: 3,
      onboarding_complete: true,
    })

    if (profileError) {
      console.warn('⚠️  Could not create profile (may already exist):', profileError.message)
    } else {
      console.log('✅ Profile created')
    }
  }
}

createDemoAccount()
