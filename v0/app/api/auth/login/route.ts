import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Cookie options for auth tokens
const cookieOptions = {
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 7, // 7 days
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

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !anonKey) {
      throw new Error('Supabase configuration missing')
    }

    // Track cookies that need to be set on the response
    const cookiesToSet: { name: string; value: string; options: typeof cookieOptions }[] = []

    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            cookiesToSet.push({ name, value, options: { ...cookieOptions, ...options } })
          })
        },
      },
    })

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
    console.log('[API Login] Setting', cookiesToSet.length, 'auth cookies')

    // Get the user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, onboarding_complete')
      .eq('auth_user_id', data.user.id)
      .single()

    // Create the response with cookies
    const response = NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        emailConfirmedAt: data.user.email_confirmed_at,
      },
      profile: profile ? {
        id: profile.id,
        onboardingComplete: profile.onboarding_complete,
      } : null,
    })

    // Set the auth cookies on the response
    cookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options)
    })

    return response

  } catch (error) {
    console.error('[API Login] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
