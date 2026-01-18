import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Protect /admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
