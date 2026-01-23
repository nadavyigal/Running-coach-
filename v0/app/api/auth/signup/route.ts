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

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // Get the origin for redirect URL
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://runsmart-ai.com'
    const redirectUrl = `${origin}/auth/callback`

    console.log('[API Signup] Attempting signup for:', email.substring(0, 3) + '***')
    console.log('[API Signup] Redirect URL:', redirectUrl)

    // Create the user
    const { data: authData, error: signupError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    })

    if (signupError) {
      console.error('[API Signup] Auth error:', signupError)

      // Handle specific errors
      if (signupError.message.includes('already registered')) {
        return NextResponse.json(
          { error: 'This email is already registered. Please log in instead.' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: signupError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Signup failed: No user returned' },
        { status: 500 }
      )
    }

    console.log('[API Signup] User created:', authData.user.id)

    // Create profile for the user
    const { error: profileError } = await supabase.from('profiles').insert({
      auth_user_id: authData.user.id,
      email: email.trim().toLowerCase(),
      goal: 'habit',
      experience: 'beginner',
      preferred_times: [],
      days_per_week: 3,
      onboarding_complete: false,
      is_beta_user: false,
    })

    if (profileError) {
      console.error('[API Signup] Profile error:', profileError)
      // Don't fail the signup if profile creation fails - user can still confirm email
      // The profile can be created later during onboarding
    } else {
      console.log('[API Signup] Profile created successfully')
    }

    return NextResponse.json({
      success: true,
      message: 'Account created! Please check your email to confirm.',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        emailConfirmedAt: authData.user.email_confirmed_at,
      },
      session: authData.session ? {
        accessToken: authData.session.access_token,
        refreshToken: authData.session.refresh_token,
        expiresAt: authData.session.expires_at,
      } : null,
    })

  } catch (error) {
    console.error('[API Signup] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
