import { NextResponse } from 'next/server'

import { generateGarminFirstAha } from '@/lib/server/garmin-first-aha-service'
import { getGarminOAuthState } from '@/lib/server/garmin-oauth-store'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function parseUserId(req: Request): number | null {
  const headerValue = req.headers.get('x-user-id')?.trim() ?? ''
  if (headerValue) {
    const parsed = Number.parseInt(headerValue, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  const queryValue = new URL(req.url).searchParams.get('userId')?.trim() ?? ''
  if (!queryValue) return null

  const parsed = Number.parseInt(queryValue, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function GET(req: Request) {
  const userId = parseUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Valid userId is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const oauthState = await getGarminOAuthState(userId)
  if (!oauthState) {
    return NextResponse.json({ error: 'Garmin connection not found' }, { status: 404 })
  }

  if (oauthState.authUserId && oauthState.authUserId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const result = await generateGarminFirstAha(userId)
    if (result.status === 'error') {
      return NextResponse.json(result, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('[api/garmin/first-aha] Failed:', error)
    return NextResponse.json(
      {
        status: 'error',
        error: 'Failed to generate Garmin First Aha result',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
