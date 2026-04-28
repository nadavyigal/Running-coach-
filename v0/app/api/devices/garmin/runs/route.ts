import { NextResponse } from 'next/server'

import { getGarminOAuthState } from '@/lib/server/garmin-oauth-store'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function parseUserId(req: Request): number | null {
  const fromHeader = req.headers.get('x-user-id')?.trim() ?? ''
  if (fromHeader) {
    const parsed = Number.parseInt(fromHeader, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  const { searchParams } = new URL(req.url)
  const fromQuery = searchParams.get('userId')?.trim() ?? ''
  if (!fromQuery) return null

  const parsed = Number.parseInt(fromQuery, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseLimit(req: Request): number {
  const raw = new URL(req.url).searchParams.get('limit')?.trim() ?? ''
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return 25
  return Math.min(parsed, 100)
}

export async function GET(req: Request) {
  const userId = parseUserId(req)
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Valid userId is required' }, { status: 400 })
  }

  const connection = await getGarminOAuthState(userId)
  if (!connection || connection.status !== 'connected') {
    return NextResponse.json(
      {
        success: false,
        error: 'No connected Garmin account found',
        needsReauth: connection?.status === 'reauth_required',
      },
      { status: 401 }
    )
  }

  if (!connection.profileId) {
    return NextResponse.json(
      {
        success: false,
        error: 'Garmin connection is missing a profile link. Reconnect Garmin to repair the connection.',
      },
      { status: 409 }
    )
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('runs')
    .select(
      [
        'id',
        'profile_id',
        'type',
        'distance',
        'duration',
        'pace',
        'heart_rate',
        'calories',
        'notes',
        'route',
        'completed_at',
        'created_at',
        'updated_at',
        'source_provider',
        'source_activity_id',
        'source_external_id',
        'source_payload_ref',
      ].join(',')
    )
    .eq('profile_id', connection.profileId)
    .eq('source_provider', 'garmin')
    .order('completed_at', { ascending: false })
    .limit(parseLimit(req))

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    userId,
    profileId: connection.profileId,
    runs: data ?? [],
    syncedAt: new Date().toISOString(),
  })
}
