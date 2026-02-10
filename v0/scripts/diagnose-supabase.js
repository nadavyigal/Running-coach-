#!/usr/bin/env node

/**
 * Diagnose Supabase Connection Issues
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match && !line.startsWith('#')) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  })
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dxqglotcyirxzyqaxqln.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🔍 Supabase Diagnostics\n')
console.log('='.repeat(60))

function makeRequest(url, headers) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) })
        } catch {
          resolve({ status: res.statusCode, data })
        }
      })
    }).on('error', reject)
  })
}

async function checkTable(keyName, key) {
  console.log(`\n📊 Checking analytics_events table with ${keyName}...`)

  if (!key) {
    console.log(`❌ ${keyName} not found in environment`)
    return false
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/analytics_events?limit=5`
    const headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }

    const result = await makeRequest(url, headers)

    if (result.status === 200) {
      console.log(`✅ Table accessible with ${keyName}`)
      console.log(`   Found ${result.data.length} rows`)
      return true
    } else if (result.status === 401) {
      console.log(`❌ Authentication failed with ${keyName}`)
      console.log(`   Status: ${result.status}`)
      return false
    } else if (result.status === 404) {
      console.log(`❌ Table 'analytics_events' not found`)
      console.log(`   Status: ${result.status}`)
      return false
    } else {
      console.log(`⚠️  Unexpected response with ${keyName}`)
      console.log(`   Status: ${result.status}`)
      console.log(`   Response:`, result.data)
      return false
    }
  } catch (error) {
    console.log(`❌ Error with ${keyName}:`, error.message)
    return false
  }
}

async function checkRLS() {
  console.log('\n🔒 Checking Row Level Security (RLS)...')

  if (!SUPABASE_SERVICE_KEY) {
    console.log('⚠️  Cannot check RLS without service role key')
    return
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/rpc/analytics_events_rls_status`
    const headers = {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json'
    }

    const result = await makeRequest(url, headers)
    console.log('RLS Status:', result)
  } catch (error) {
    console.log('⚠️  Could not check RLS status:', error.message)
  }
}

async function testInsert(keyName, key) {
  console.log(`\n✍️  Testing INSERT with ${keyName}...`)

  if (!key) {
    console.log(`❌ ${keyName} not found`)
    return false
  }

  try {
    const testEvent = {
      event_name: 'test_diagnostic_event',
      user_id: 'test-user-' + Date.now(),
      properties: { source: 'diagnostic', timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString()
    }

    const url = `${SUPABASE_URL}/rest/v1/analytics_events`
    const options = {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    }

    const result = await new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) })
          } catch {
            resolve({ status: res.statusCode, data })
          }
        })
      })

      req.on('error', reject)
      req.write(JSON.stringify(testEvent))
      req.end()
    })

    if (result.status === 201) {
      console.log(`✅ INSERT successful with ${keyName}`)
      return true
    } else {
      console.log(`❌ INSERT failed with ${keyName}`)
      console.log(`   Status: ${result.status}`)
      console.log(`   Response:`, result.data)
      return false
    }
  } catch (error) {
    console.log(`❌ INSERT error with ${keyName}:`, error.message)
    return false
  }
}

async function main() {
  console.log('\n📋 Configuration:')
  console.log(`   SUPABASE_URL: ${SUPABASE_URL}`)
  console.log(`   ANON_KEY: ${SUPABASE_ANON_KEY ? 'Set ✅' : 'Missing ❌'}`)
  console.log(`   SERVICE_KEY: ${SUPABASE_SERVICE_KEY ? 'Set ✅' : 'Missing ❌'}`)

  // Check with anon key
  const anonWorks = await checkTable('ANON_KEY', SUPABASE_ANON_KEY)

  // Check with service key
  const serviceWorks = await checkTable('SERVICE_KEY', SUPABASE_SERVICE_KEY)

  // Test inserts
  if (anonWorks) {
    await testInsert('ANON_KEY', SUPABASE_ANON_KEY)
  }

  if (serviceWorks) {
    await testInsert('SERVICE_KEY', SUPABASE_SERVICE_KEY)
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n📊 DIAGNOSIS SUMMARY\n')

  if (!anonWorks && !serviceWorks) {
    console.log('❌ CRITICAL: analytics_events table is not accessible')
    console.log('\n🔧 Solutions:')
    console.log('1. Create the table in Supabase:')
    console.log('   - Go to Supabase SQL Editor')
    console.log('   - Run the migration from V0/migrations/create_analytics_events.sql')
    console.log('\n2. Check RLS policies:')
    console.log('   - Disable RLS temporarily for testing')
    console.log('   - Or add policies to allow inserts/selects')
  } else if (!anonWorks && serviceWorks) {
    console.log('⚠️  Table exists but RLS is blocking anon key access')
    console.log('\n🔧 Solutions:')
    console.log('1. Add RLS policy for anonymous access:')
    console.log('   ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;')
    console.log('   CREATE POLICY "Allow anonymous inserts" ON analytics_events')
    console.log('     FOR INSERT TO anon WITH CHECK (true);')
    console.log('   CREATE POLICY "Allow anonymous selects" ON analytics_events')
    console.log('     FOR SELECT TO anon USING (true);')
    console.log('\n2. OR use service role key in production API routes')
  } else if (anonWorks) {
    console.log('✅ analytics_events table is accessible!')
    console.log('\n✨ Your analytics are working correctly.')
    console.log('   Events should flow to both PostHog and PostgreSQL.')
  }

  console.log('\n' + '='.repeat(60))
}

main().catch(console.error)
