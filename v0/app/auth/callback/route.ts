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

  // Redirect to home page after confirmation
  return NextResponse.redirect(new URL('/', requestUrl.origin))
}
