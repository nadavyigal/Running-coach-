import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Use placeholder values during build if env vars are not set
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  // Debug log in development or if placeholders are being used
  if (url.includes('placeholder') || anonKey.includes('placeholder')) {
    console.error('[Supabase Client] WARNING: Using placeholder values! Environment variables not set at build time.')
    console.error('[Supabase Client] NEXT_PUBLIC_SUPABASE_URL:', url.substring(0, 30))
  }

  return createBrowserClient(url, anonKey)
}
