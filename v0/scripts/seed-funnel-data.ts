/**
 * Seed Funnel Test Data
 *
 * Run this script to populate the analytics_events table with realistic test data
 * for testing the funnel visualization dashboard.
 *
 * Usage: npx tsx scripts/seed-funnel-data.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Activation funnel: 1000 → 800 → 650 → 520 (52% conversion)
const ACTIVATION_FUNNEL = [
  { event: 'signup_completed', users: 1000 },
  { event: 'onboarding_completed', users: 800 }, // 80% conversion
  { event: 'plan_generated', users: 650 }, // 81% of onboarded
  { event: 'first_run_recorded', users: 520 }, // 80% of plan generated
]

// Challenge funnel: 500 → 400 → 320 → 256 (51% conversion)
const CHALLENGE_FUNNEL = [
  { event: 'challenge_registered', users: 500 },
  { event: 'challenge_day_started', users: 400 }, // 80% conversion
  { event: 'challenge_day_completed', users: 320 }, // 80% of started
  { event: 'challenge_completed', users: 256 }, // 80% of day completed
]

// Retention funnel: 2000 → 1600 → 1280 → 1024 (51% conversion)
const RETENTION_FUNNEL = [
  { event: 'app_opened', users: 2000 },
  { event: 'workout_viewed', users: 1600 }, // 80% conversion
  { event: 'run_started', users: 1280 }, // 80% of viewed
  { event: 'run_completed', users: 1024 }, // 80% of started
]

async function seedEvents() {
  console.log('🌱 Seeding funnel test data...\n')

  // Generate events for the last 30 days
  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

  const allEvents: any[] = []

  // Helper to generate random timestamp in last 30 days
  const randomTimestamp = () => {
    const time = thirtyDaysAgo + Math.random() * (now - thirtyDaysAgo)
    return new Date(time).toISOString()
  }

  // Seed Activation Funnel
  console.log('📊 Activation Funnel:')
  for (const step of ACTIVATION_FUNNEL) {
    console.log(`  - ${step.event}: ${step.users} users`)
    for (let i = 0; i < step.users; i++) {
      allEvents.push({
        event_name: step.event,
        user_id: `user_${i}`,
        properties: {
          funnel: 'activation',
          test_data: true,
          timestamp: randomTimestamp(),
        },
        timestamp: randomTimestamp(),
      })
    }
  }

  // Seed Challenge Funnel
  console.log('\n📊 Challenge Funnel:')
  for (const step of CHALLENGE_FUNNEL) {
    console.log(`  - ${step.event}: ${step.users} users`)
    for (let i = 0; i < step.users; i++) {
      allEvents.push({
        event_name: step.event,
        user_id: `challenge_user_${i}`,
        properties: {
          funnel: 'challenge',
          test_data: true,
          timestamp: randomTimestamp(),
        },
        timestamp: randomTimestamp(),
      })
    }
  }

  // Seed Retention Funnel
  console.log('\n📊 Retention Funnel:')
  for (const step of RETENTION_FUNNEL) {
    console.log(`  - ${step.event}: ${step.users} users`)
    for (let i = 0; i < step.users; i++) {
      allEvents.push({
        event_name: step.event,
        user_id: `retention_user_${i}`,
        properties: {
          funnel: 'retention',
          test_data: true,
          timestamp: randomTimestamp(),
        },
        timestamp: randomTimestamp(),
      })
    }
  }

  // Insert in batches of 500 (Supabase limit is 1000)
  console.log(`\n📤 Inserting ${allEvents.length} events...`)
  const batchSize = 500
  let inserted = 0

  for (let i = 0; i < allEvents.length; i += batchSize) {
    const batch = allEvents.slice(i, i + batchSize)
    const { error } = await supabase.from('analytics_events').insert(batch)

    if (error) {
      console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, error)
      process.exit(1)
    }

    inserted += batch.length
    console.log(`  ✓ Inserted ${inserted}/${allEvents.length} events`)
  }

  console.log('\n✅ Test data seeded successfully!')
  console.log('\n📈 Expected Dashboard Metrics:')
  console.log('  Activation Funnel:')
  console.log('    - Started: 1,000 users')
  console.log('    - Completed: 520 users')
  console.log('    - Conversion: 52%')
  console.log('\n  Challenge Funnel:')
  console.log('    - Started: 500 users')
  console.log('    - Completed: 256 users')
  console.log('    - Conversion: 51.2%')
  console.log('\n  Retention Funnel:')
  console.log('    - Started: 2,000 users')
  console.log('    - Completed: 1,024 users')
  console.log('    - Conversion: 51.2%')
  console.log('\n🔗 Open: http://localhost:3000/admin/analytics')
  console.log('📊 Click "Funnels" tab to see visualization\n')
}

seedEvents().catch((error) => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})
