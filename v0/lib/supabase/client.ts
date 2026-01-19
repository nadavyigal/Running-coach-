import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Use placeholder values during build if env vars are not set
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  return createBrowserClient(url, anonKey)
}
