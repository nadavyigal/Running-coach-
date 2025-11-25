const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://biilxiuhufkextvwqdob.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpaWx4aXVodWZrZXh0dndxZG9iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTEwMzU4MSwiZXhwIjoyMDcwNjc5NTgxfQ.WELaOUC7sYIoIUmpG0xyHRTPDcInoZZF73AyBLyOk4A'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function testConnection() {
  try {
    console.log('🔌 Testing Supabase connection...')
    
    // Test basic connection
    const { data, error } = await supabase
      .from('_realtime')
      .select('*')
      .limit(1)
    
    if (error && error.code !== 'PGRST106') {
      console.error('❌ Connection test failed:', error)
      return false
    }
    
    console.log('✅ Supabase connection successful!')
    
    // Check if profiles table exists
    const { data: tables, error: tablesError } = await supabase.rpc('exec', {
      sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles';"
    })
    
    if (tablesError) {
      console.log('⚠️ Tables check returned error (table might not exist yet):', tablesError.message)
    } else {
      console.log('📊 Profiles table exists:', tables && tables.length > 0)
    }
    
    return true
  } catch (error) {
    console.error('❌ Connection test failed:', error)
    return false
  }
}

testConnection()