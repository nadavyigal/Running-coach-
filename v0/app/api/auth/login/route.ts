import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create admin client for server-side auth operations
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
  }

  // Prefer service role key, fall back to anon key
  const key = serviceKey || anonKey
  if (!key) {
    throw new Error('No Supabase key configured')
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    console.log('[API Login] Attempting login for:', email.substring(0, 3) + '***')

    // Sign in the user
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (loginError) {
      console.error('[API Login] Auth error:', loginError)

      if (loginError.message.includes('Invalid login credentials')) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        )
      }

      if (loginError.message.includes('Email not confirmed')) {
        return NextResponse.json(
          { error: 'Please confirm your email before logging in' },
          { status: 401 }
        )
      }

      return NextResponse.json(
        { error: loginError.message },
        { status: 400 }
      )
    }

    if (!data.user || !data.session) {
      return NextResponse.json(
        { error: 'Login failed: No session returned' },
        { status: 500 }
      )
    }

    console.log('[API Login] User logged in:', data.user.id)

    // Get the user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, onboarding_complete')
      .eq('auth_user_id', data.user.id)
      .single()

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        emailConfirmedAt: data.user.email_confirmed_at,
      },
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      },
      profile: profile ? {
        id: profile.id,
        onboardingComplete: profile.onboarding_complete,
      } : null,
    })

  } catch (error) {
    console.error('[API Login] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
