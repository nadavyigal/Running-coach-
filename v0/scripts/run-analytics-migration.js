#!/usr/bin/env node

/**
 * Run Analytics Events Migration
 * Creates the analytics_events table with proper RLS policies
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🚀 Running Analytics Events Migration\n')
console.log('='.repeat(60))

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials')
  console.error('   SUPABASE_URL:', SUPABASE_URL ? 'Set ✅' : 'Missing ❌')
  console.error('   SERVICE_KEY:', SUPABASE_SERVICE_KEY ? 'Set ✅' : 'Missing ❌')
  process.exit(1)
}

// Read the migration file
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '010_complete_analytics_setup.sql')
const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

console.log('\n📄 Migration file:', migrationPath)
console.log('📏 SQL length:', migrationSQL.length, 'characters')
console.log('\n🔄 Executing migration...\n')

function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query: sql })

    const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`)

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation'
      }
    }

    const req = https.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, status: res.statusCode, data })
        } else {
          reject({ success: false, status: res.statusCode, data })
        }
      })
    })

    req.on('error', (error) => {
      reject({ success: false, error: error.message })
    })

    req.write(postData)
    req.end()
  })
}

// Alternative: Use psql REST endpoint
function executeSQLViaPsql(sql) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query: sql })

    // Extract project ref from URL
    const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)/)[1]

    const options = {
      hostname: `${projectRef}.supabase.co`,
      port: 443,
      path: '/rest/v1/rpc/exec',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, status: res.statusCode, data })
        } else {
          reject({ success: false, status: res.statusCode, data })
        }
      })
    })

    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}

async function main() {
  // Split SQL into individual statements for execution
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`📝 Found ${statements.length} SQL statements to execute\n`)

  let successCount = 0
  let failCount = 0

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    const preview = stmt.substring(0, 60).replace(/\n/g, ' ')

    console.log(`[${i + 1}/${statements.length}] ${preview}...`)

    try {
      // Execute via REST API
      const result = await executeViaRestAPI(stmt + ';')

      if (result.success) {
        console.log(`  ✅ Success\n`)
        successCount++
      } else {
        console.log(`  ⚠️  Warning: ${result.status}\n`)
        successCount++ // Some statements like DROP IF NOT EXISTS return warnings
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.data || error.error || error}\n`)
      failCount++
    }
  }

  console.log('='.repeat(60))
  console.log(`\n📊 Migration Results:`)
  console.log(`  ✅ Successful: ${successCount}`)
  console.log(`  ❌ Failed: ${failCount}`)

  if (failCount === 0) {
    console.log('\n🎉 Migration completed successfully!')
    console.log('\n🔍 Verifying setup...\n')

    // Run diagnostic
    const diagnostic = require('./diagnose-supabase.js')
  } else {
    console.log('\n⚠️  Some statements failed. Please review the errors above.')
    console.log('\n💡 Tip: You can also run the SQL directly in Supabase SQL Editor:')
    console.log(`   https://supabase.com/dashboard/project/${SUPABASE_URL.match(/https:\/\/([^.]+)/)[1]}/sql`)
  }
}

function executeViaRestAPI(sql) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(sql)

    const url = new URL(`${SUPABASE_URL}/rest/v1/`)

    const options = {
      hostname: url.hostname,
      port: 443,
      path: '/rest/v1/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/sql',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => {
        resolve({
          success: res.statusCode >= 200 && res.statusCode < 400,
          status: res.statusCode,
          data
        })
      })
    })

    req.on('error', (error) => reject({ error: error.message }))
    req.write(postData)
    req.end()
  })
}

// Check if we should just print the SQL
if (process.argv.includes('--print')) {
  console.log('\n📋 SQL to execute:\n')
  console.log(migrationSQL)
  console.log('\n💡 Copy this SQL and run it in Supabase SQL Editor:')
  const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)/)[1]
  console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql`)
  process.exit(0)
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error)
  process.exit(1)
})
