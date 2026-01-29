import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type SessionPayload = {
  expires_at?: number
  user?: {
    id?: string
    email?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

function parseSessionCookie(rawValue: string | undefined): SessionPayload | null {
  if (!rawValue) return null
  try {
    return JSON.parse(rawValue)
  } catch {
    try {
      return JSON.parse(decodeURIComponent(rawValue))
    } catch {
      try {
        const trimmed = rawValue.startsWith('base64-') ? rawValue.slice(7) : rawValue
        const decoded = Buffer.from(trimmed, 'base64').toString('utf8')
        return JSON.parse(decoded)
      } catch {
        return null
      }
    }
  }
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)/)?.[1] ?? null
  const cookieName = projectRef ? `sb-${projectRef}-auth-token` : null

  if (!cookieName) {
    return NextResponse.json({ user: null, profileId: null })
  }

  const rawCookie = request.cookies.get(cookieName)?.value
  const session = parseSessionCookie(rawCookie)

  if (!session?.user?.id) {
    return NextResponse.json({ user: null, profileId: null })
  }

  const expiresAt = typeof session.expires_at === 'number' ? session.expires_at : null
  if (expiresAt && expiresAt * 1000 < Date.now()) {
    return NextResponse.json({ user: null, profileId: null })
  }

  let profileId: string | null = null

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', session.user.id)
      .single()

    if (!error) {
      profileId = data?.id ?? null
    }
  } catch {
    profileId = null
  }

  return NextResponse.json({
    user: session.user,
    profileId,
  })
}
