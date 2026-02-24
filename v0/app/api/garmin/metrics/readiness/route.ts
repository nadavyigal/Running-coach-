import { NextResponse } from 'next/server'

import { getGarminOAuthState } from '@/lib/server/garmin-oauth-store'
import { getReadinessPayloadForUser } from '@/lib/garmin/metrics/readiness'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function parseUserId(req: Request): number | null {
  const fromHeader = req.headers.get('x-user-id')?.trim() ?? ''
  if (fromHeader.length > 0) {
    const parsed = Number.parseInt(fromHeader, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  const fromQuery = new URL(req.url).searchParams.get('userId')?.trim() ?? ''
  if (!fromQuery) return null
  const parsed = Number.parseInt(fromQuery, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function GET(req: Request) {
  const userId = parseUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Valid userId is required' }, { status: 400 })
  }

  let authUserId: string | null = null

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    authUserId = user?.id ?? null

    if (authUserId) {
      const oauthState = await getGarminOAuthState(userId)
      if (oauthState?.authUserId && oauthState.authUserId !== authUserId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
  } catch {
    // Allow deterministic readiness for local/offline flows.
  }

  try {
    const readiness = await getReadinessPayloadForUser({ userId, authUserId })

    return NextResponse.json({
      score: readiness.score,
      state: readiness.state,
      drivers: readiness.drivers,
      confidence: readiness.confidence,
      confidenceReason: readiness.confidenceReason,
      lastSyncAt: readiness.lastSyncAt,
      missingSignals: readiness.missingSignals,
      underRecovery: readiness.underRecovery,
      load: readiness.load,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to compute readiness',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
