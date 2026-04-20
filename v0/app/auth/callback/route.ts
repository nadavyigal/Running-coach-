import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')

  const supabase = await createClient()

  // PKCE flow: Supabase sends a `code` when the client uses flowType:'pkce'
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[Auth Callback] exchangeCodeForSession failed:', error.message)
      return NextResponse.redirect(new URL('/?auth_error=callback_failed', requestUrl.origin))
    }
    if (type === 'recovery') {
      return NextResponse.redirect(new URL('/auth/reset-password', requestUrl.origin))
    }
    return NextResponse.redirect(new URL('/', requestUrl.origin))
  }

  // Token-hash flow: Supabase sends a `token_hash` when the client uses the
  // default (non-PKCE) auth flow, which is what our server-side API route does.
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'recovery' | 'signup' | 'invite' | 'magiclink' | 'email',
    })
    if (error) {
      console.error('[Auth Callback] verifyOtp failed:', error.message)
      return NextResponse.redirect(new URL('/?auth_error=callback_failed', requestUrl.origin))
    }
    if (type === 'recovery') {
      return NextResponse.redirect(new URL('/auth/reset-password', requestUrl.origin))
    }
    return NextResponse.redirect(new URL('/', requestUrl.origin))
  }

  // Fallback for legacy implicit-flow links that arrive with type but no code/token_hash.
  // The session tokens are in the URL hash which only the browser can read,
  // so we redirect to the reset page and let the client-side onAuthStateChange handle it.
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/auth/reset-password', requestUrl.origin))
  }

  return NextResponse.redirect(new URL('/', requestUrl.origin))
}
