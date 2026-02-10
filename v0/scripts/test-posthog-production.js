#!/usr/bin/env node

/**
 * PostHog Production Verification Script
 * Tests that PostHog is properly initialized and sending events in production
 */

const PRODUCTION_URL = 'https://www.runsmart-ai.com'
const POSTHOG_API_URL = 'https://us.i.posthog.com/decide'

console.log('🔍 PostHog Production Verification\n')
console.log('=' .repeat(60))

async function checkPostHogEndpoint() {
  console.log('\n1️⃣  Checking PostHog API endpoint...')

  try {
    const response = await fetch(POSTHOG_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.NEXT_PUBLIC_POSTHOG_API_KEY || 'phc_2RcjPhReYKSisINOVVehHusghrUtyyiR6sN87SzJLZ6',
        distinct_id: 'test-user',
      })
    })

    if (response.ok) {
      console.log('✅ PostHog API is reachable')
      return true
    } else {
      console.log(`❌ PostHog API returned ${response.status}`)
      return false
    }
  } catch (error) {
    console.log(`❌ PostHog API error: ${error.message}`)
    return false
  }
}

async function checkProductionEnvVars() {
  console.log('\n2️⃣  Checking production environment variables...')

  try {
    // Fetch the production page HTML to see if PostHog is initialized
    const response = await fetch(PRODUCTION_URL)
    const html = await response.text()

    // Check if PostHog script is present
    if (html.includes('posthog') || html.includes('us.i.posthog.com')) {
      console.log('✅ PostHog initialization code found in production HTML')
      return true
    } else {
      console.log('⚠️  PostHog initialization code NOT found in production HTML')
      console.log('   This may indicate missing environment variables in Vercel')
      return false
    }
  } catch (error) {
    console.log(`❌ Error checking production: ${error.message}`)
    return false
  }
}

async function testEventSending() {
  console.log('\n3️⃣  Testing event capture...')

  // Try to send a test event directly to PostHog
  try {
    const response = await fetch('https://us.i.posthog.com/capture/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.NEXT_PUBLIC_POSTHOG_API_KEY || 'phc_2RcjPhReYKSisINOVVehHusghrUtyyiR6sN87SzJLZ6',
        event: 'test_production_verification',
        properties: {
          distinct_id: 'test-script',
          source: 'verification_script',
          timestamp: new Date().toISOString(),
        },
      })
    })

    if (response.ok) {
      console.log('✅ Test event sent successfully to PostHog')
      console.log('   Check PostHog Live Events: https://us.posthog.com/project/171597/events')
      return true
    } else {
      console.log(`❌ Failed to send test event: ${response.status}`)
      const text = await response.text()
      console.log(`   Response: ${text}`)
      return false
    }
  } catch (error) {
    console.log(`❌ Error sending test event: ${error.message}`)
    return false
  }
}

async function checkAnalyticsAPI() {
  console.log('\n4️⃣  Checking internal analytics API...')

  try {
    const response = await fetch(`${PRODUCTION_URL}/api/analytics/events?days=1&limit=10`)

    if (response.ok) {
      const data = await response.json()
      console.log(`✅ Analytics API is working`)
      console.log(`   Total events (last 24h): ${data.totalCount || 0}`)

      if (data.totalCount > 0) {
        console.log(`   Event types:`, Object.keys(data.eventCounts || {}).join(', '))
      }
      return true
    } else {
      console.log(`❌ Analytics API returned ${response.status}`)
      return false
    }
  } catch (error) {
    console.log(`❌ Analytics API error: ${error.message}`)
    return false
  }
}

async function checkDashboard() {
  console.log('\n5️⃣  Checking admin dashboard...')

  try {
    const response = await fetch(`${PRODUCTION_URL}/admin/analytics`)

    if (response.ok) {
      console.log('✅ Admin analytics dashboard is accessible')
      return true
    } else {
      console.log(`❌ Dashboard returned ${response.status}`)
      return false
    }
  } catch (error) {
    console.log(`❌ Dashboard error: ${error.message}`)
    return false
  }
}

async function main() {
  const results = {
    posthogApi: await checkPostHogEndpoint(),
    productionEnv: await checkProductionEnvVars(),
    eventSending: await testEventSending(),
    analyticsApi: await checkAnalyticsAPI(),
    dashboard: await checkDashboard(),
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n📊 VERIFICATION SUMMARY\n')

  const passed = Object.values(results).filter(Boolean).length
  const total = Object.values(results).length

  Object.entries(results).forEach(([key, value]) => {
    console.log(`${value ? '✅' : '❌'} ${key}`)
  })

  console.log(`\n${passed}/${total} checks passed`)

  if (passed === total) {
    console.log('\n🎉 All checks passed! PostHog should be working.')
    console.log('\n📌 Next Steps:')
    console.log('1. Visit your production site: https://www.runsmart-ai.com')
    console.log('2. Interact with the app (sign up, complete onboarding, etc.)')
    console.log('3. Check PostHog Live Events: https://us.posthog.com/project/171597/events')
    console.log('4. Check your custom dashboard: https://us.posthog.com/project/171597/dashboard/424735')
  } else {
    console.log('\n⚠️  Some checks failed. Please review the errors above.')

    if (!results.productionEnv) {
      console.log('\n🔧 Troubleshooting:')
      console.log('1. Verify Vercel environment variables:')
      console.log('   vercel env ls')
      console.log('2. Add missing variables if needed:')
      console.log('   vercel env add NEXT_PUBLIC_POSTHOG_API_KEY')
      console.log('3. Redeploy if variables were added:')
      console.log('   vercel --prod')
    }
  }

  console.log('\n' + '='.repeat(60))
}

main().catch(console.error)
