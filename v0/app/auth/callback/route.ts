import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const type = requestUrl.searchParams.get('type')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[Auth Callback] Failed to exchange code for session:', error.message)
      return NextResponse.redirect(new URL('/?auth_error=callback_failed', requestUrl.origin))
    }

    // Redirect to password update page for recovery flows
    if (type === 'recovery') {
      return NextResponse.redirect(new URL('/auth/update-password', requestUrl.origin))
    }
  }

  // Password recovery flow — redirect to the reset password page so the
  // user can actually set a new password using the established recovery session.
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/auth/reset-password', requestUrl.origin))
  }

  // Default: redirect to home after email confirmation or magic link login.
  return NextResponse.redirect(new URL('/', requestUrl.origin))
}
