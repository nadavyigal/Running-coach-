import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runGarminDeriveForPayload } from '@/lib/server/garmin-derive-worker'

export const dynamic = 'force-dynamic'
export const maxDuration = 55

/**
 * POST /api/garmin/sync-fit
 * Body: { userId: number }
 *
 * Immediately processes any pending Garmin activity file (FIT) rows for the
 * given local userId — no need to wait for the nightly cron.
 * Uses the same integer userId that the rest of the Garmin system uses
 * (local Dexie user ID, stored in garmin_connections.user_id).
 *
 * Returns: { processed: number, message: string }
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const userId = (body as Record<string, unknown>)?.userId
  if (typeof userId !== 'number' || !Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: 'Valid userId (integer) is required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify a connected garmin account exists for this userId
  const { data: connection, error: connError } = await admin
    .from('garmin_connections')
    .select('user_id, status')
    .eq('user_id', userId)
    .eq('status', 'connected')
    .maybeSingle()

  if (connError) {
    return NextResponse.json({ error: 'Failed to look up Garmin connection' }, { status: 500 })
  }

  if (!connection) {
    return NextResponse.json(
      { error: 'Garmin not connected', code: 'not_connected' },
      { status: 404 }
    )
  }

  // Check if there are any pending files before spinning up the full worker
  const { data: pendingRows } = await admin
    .from('garmin_activity_files')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .limit(1)

  if (!pendingRows?.length) {
    return NextResponse.json({
      processed: 0,
      message: "No pending activities. Garmin usually uploads within 1–2 min of saving a run — try again shortly.",
    })
  }

  // Run the derive worker immediately for this user
  try {
    const result = await runGarminDeriveForPayload({
      userId,
      datasetKey: 'activityFiles',
      source: 'webhook',
      requestedAt: new Date().toISOString(),
    })

    const processed = result.processedUsers ?? 0
    return NextResponse.json({
      processed,
      message: processed > 0
        ? 'Run synced! Your latest activity is now available.'
        : 'Nothing new to sync right now.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Sync failed: ${message}` }, { status: 500 })
  }
}
