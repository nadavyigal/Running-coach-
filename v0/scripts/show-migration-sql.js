#!/usr/bin/env node

/**
 * Display Migration SQL for Copy/Paste
 * Shows the SQL needed to create analytics_events table
 */

const fs = require('fs')
const path = require('path')

// Load environment
const envPath = path.join(__dirname, '..', '.env.local')
let SUPABASE_URL = 'https://dxqglotcyirxzyqaxqln.supabase.co'

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/)
    if (match) {
      SUPABASE_URL = match[1].replace(/^["']|["']$/g, '')
    }
  })
}

const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1] || 'YOUR_PROJECT'

console.log('\n' + '='.repeat(70))
console.log('📋  ANALYTICS EVENTS MIGRATION SQL')
console.log('='.repeat(70))
console.log('\n🎯 INSTRUCTIONS:\n')
console.log('1. Open Supabase SQL Editor:')
console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql\n`)
console.log('2. Click "New query" button\n')
console.log('3. Copy ALL the SQL below (including comments)\n')
console.log('4. Paste into the SQL editor\n')
console.log('5. Click "Run" (or press Ctrl/Cmd + Enter)\n')
console.log('6. Wait for "Success. No rows returned"\n')
console.log('7. Run verification: node scripts/diagnose-supabase.js\n')
console.log('='.repeat(70))
console.log('\n📝 SQL TO COPY:\n')
console.log('='.repeat(70))

// Read and display the migration
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '010_complete_analytics_setup.sql')
const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

console.log(migrationSQL)

console.log('='.repeat(70))
console.log('\n✅ After running the SQL, verify with:\n')
console.log('   cd V0')
console.log('   node scripts/diagnose-supabase.js\n')
console.log('Expected output:')
console.log('   ✅ Table accessible with ANON_KEY')
console.log('   ✅ INSERT successful with ANON_KEY')
console.log('   ✅ analytics_events table is accessible!\n')
console.log('='.repeat(70))
console.log('\n')
