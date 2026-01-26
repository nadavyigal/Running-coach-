import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)/)?.[1] ?? null
  const cookieName = projectRef ? `sb-${projectRef}-auth-token` : null

  const response = NextResponse.json({ success: true })

  if (cookieName) {
    response.cookies.set(cookieName, '', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 0,
    })
  }

  return response
}
