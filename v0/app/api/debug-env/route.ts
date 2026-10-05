import { NextResponse } from 'next/server'

export async function GET() {
  // Only show partial values for security
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET'
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'NOT SET'

  // Mask the values for security
  const maskedUrl = supabaseUrl.includes('placeholder')
    ? 'PLACEHOLDER (env vars not set at build time!)'
    : supabaseUrl.substring(0, 30) + '...'

  const maskedKey = anonKey === 'NOT SET' || anonKey.includes('placeholder')
    ? 'PLACEHOLDER (env vars not set at build time!)'
    : anonKey.substring(0, 20) + '...'

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: {
      supabaseUrl: maskedUrl,
      anonKeySet: maskedKey,
      nodeEnv: process.env.NODE_ENV,
    },
    diagnosis: supabaseUrl.includes('placeholder') || anonKey.includes('placeholder')
      ? 'ERROR: Environment variables were not set at build time. Redeploy with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY set.'
      : 'Environment variables appear to be configured correctly'
  })
}
