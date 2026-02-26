import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Create response that we'll modify with updated cookies
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Use placeholder values during build if env vars are not set
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

  // Skip session refresh for static assets and API routes (except auth-related)
  const pathname = request.nextUrl.pathname
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') ||
    (pathname.startsWith('/api') && !pathname.startsWith('/api/auth'))
  ) {
    return response
  }

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Set cookies on the request (for server components to read)
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          // Create new response with updated cookies
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          // Set cookies on the response (to send back to browser)
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refresh the session - this will update cookies if needed
  // Using getUser() instead of getSession() for security (validates with Supabase server)
  const { data: { user } } = await supabase.auth.getUser()

  // Protect /admin routes
  if (pathname.startsWith('/admin')) {
    // Admin email whitelist
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) ?? []
    if (adminEmails.length === 0) {
      console.error('ADMIN_EMAILS not configured — admin routes disabled')
      return NextResponse.redirect(new URL('/', request.url))
    }
    const isAdmin = user && adminEmails.includes(user.email || '')

    if (!isAdmin) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    // Match all routes except static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
