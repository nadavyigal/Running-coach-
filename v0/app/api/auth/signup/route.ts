import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create admin client for server-side auth operations
// This REQUIRES the service role key to use admin functions
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured')
  }

  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for signup')
  }

  return createClient(url, serviceKey, {
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
    const normalizedEmail = email.trim().toLowerCase()

    console.log('[API Signup] Attempting signup for:', normalizedEmail.substring(0, 3) + '***')

    // Use admin API to create user with auto-confirmation
    // This bypasses the email confirmation requirement since SMTP is not configured
    const { data: authData, error: signupError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true, // Auto-confirm the email
    })

    if (signupError) {
      console.error('[API Signup] Auth error:', signupError)

      // Handle specific errors
      if (signupError.message.includes('already been registered') ||
          signupError.message.includes('already registered') ||
          signupError.message.includes('User already registered')) {
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

    console.log('[API Signup] User created and confirmed:', authData.user.id)

    // Create profile for the user
    const { error: profileError } = await supabase.from('profiles').insert({
      auth_user_id: authData.user.id,
      email: normalizedEmail,
      goal: 'habit',
      experience: 'beginner',
      preferred_times: [],
      days_per_week: 3,
      onboarding_complete: false,
      is_beta_user: false,
    })

    if (profileError) {
      console.error('[API Signup] Profile error:', profileError)
      // Don't fail the signup if profile creation fails
      // The profile can be created later during onboarding
    } else {
      console.log('[API Signup] Profile created successfully')
    }

    // Sign in the user to get a session (admin.createUser doesn't return a session)
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (signInError) {
      console.error('[API Signup] Sign-in error after creation:', signInError)
      // User was created but we couldn't sign them in - they can still log in manually
    } else {
      console.log('[API Signup] User signed in successfully')
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully!',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        emailConfirmedAt: authData.user.email_confirmed_at,
      },
      session: signInData?.session ? {
        accessToken: signInData.session.access_token,
        refreshToken: signInData.session.refresh_token,
        expiresAt: signInData.session.expires_at,
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
