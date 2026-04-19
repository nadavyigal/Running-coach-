import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimiter } from '@/lib/security.config'

/**
 * POST /api/auth/reset-password-email
 *
 * Sends a Supabase password-reset email from the server so that:
 * 1. The redirectTo URL is always the canonical NEXT_PUBLIC_SITE_URL (which is
 *    pre-whitelisted in Supabase Auth → URL Configuration → Redirect URLs).
 * 2. The call never depends on window.location.origin, making it work
 *    identically from the web browser and the iOS PWA.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'A valid email address is required.' },
        { status: 400 }
      )
    }

    // Rate limit: 3 reset attempts per hour per IP to prevent abuse
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimitKey = `reset-password:${ip}`
    const rateLimitResult = await rateLimiter.check(rateLimitKey, {
      windowMs: 60 * 60 * 1000,
      max: 3,
      message: 'Too many password reset attempts',
      standardHeaders: true,
      legacyHeaders: false,
    })
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many reset attempts. Please wait an hour before trying again.' },
        { status: 429 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ''

    if (!supabaseUrl || !anonKey) {
      console.error('[ResetPasswordEmail] Supabase env vars missing')
      return NextResponse.json(
        { error: 'Server configuration error. Please contact support.' },
        { status: 500 }
      )
    }

    // Use anon key — resetPasswordForEmail is a public auth operation.
    // The service role key is NOT needed and should not be used here.
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Use the canonical site URL from env so this value is always whitelisted
    // in Supabase Auth → URL Configuration → Redirect URLs.
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
      'https://runsmart-ai.com'

    const redirectTo = `${siteUrl}/auth/callback?type=recovery`

    console.log('[ResetPasswordEmail] Sending reset for:', email.substring(0, 3) + '***')
    console.log('[ResetPasswordEmail] Redirect URL:', redirectTo)

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo }
    )

    if (error) {
      console.error('[ResetPasswordEmail] Supabase error:', error.message, error.status)

      // Supabase returns an error when the redirectTo URL is not whitelisted.
      // Provide an actionable message so we can diagnose quickly.
      if (
        error.message.toLowerCase().includes('redirect') ||
        error.message.toLowerCase().includes('invalid url') ||
        error.message.toLowerCase().includes('not allowed')
      ) {
        return NextResponse.json(
          {
            error:
              'Password reset is not configured correctly. Please contact support.',
            debug: error.message,
          },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    // Always return success — Supabase does not leak whether an email exists
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ResetPasswordEmail] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected server error.' },
      { status: 500 }
    )
  }
}
