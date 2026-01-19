import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Protect /admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Use placeholder values during build if env vars are not set
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

    const supabase = createServerClient(
      url,
      anonKey,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set() {
            // Middleware can't set cookies directly
          },
          remove() {
            // Middleware can't remove cookies directly
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    // Admin email whitelist
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [
      'nadav@example.com',
      'admin@runsmart.ai'
    ]
    const isAdmin = user && adminEmails.includes(user.email || '')

    if (!isAdmin) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*',
}
