import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runGarminDeriveForPayload } from '@/lib/server/garmin-derive-worker'

export const dynamic = 'force-dynamic'
export const maxDuration = 55

/**
 * POST /api/garmin/sync-fit
 *
 * Immediately processes any pending Garmin activity file (FIT) rows for the
 * authenticated user — no need to wait for the nightly cron.
 *
 * Auth: Supabase session cookie (ANON_KEY must be correctly set).
 * Falls back to `userId` in request body for older sessions where
 * auth_user_id wasn't yet backfilled in garmin_connections.
 *
 * Returns: { processed: number, message: string }
 */
export async function POST(request: Request) {
  const admin = createAdminClient()

  // 1. Authenticate via Supabase session cookie
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  let garminUserId: number | null = null

  if (!authError && user) {
    // Primary path: look up garmin connection by Supabase auth UUID
    const { data: conn } = await admin
      .from('garmin_connections')
      .select('user_id')
      .eq('auth_user_id', user.id)
      .eq('status', 'connected')
      .maybeSingle()

    garminUserId = (conn?.user_id as number) ?? null
  }

  // 2. Fallback: accept userId from request body (for existing sessions
  //    where auth_user_id wasn't yet populated in garmin_connections)
  if (garminUserId === null) {
    let body: unknown
    try { body = await request.json() } catch { body = null }
    const candidateId = (body as Record<string, unknown> | null)?.userId
    if (typeof candidateId === 'number' && Number.isInteger(candidateId) && candidateId > 0) {
      // Verify this userId has a valid garmin connection before trusting it
      const { data: conn } = await admin
        .from('garmin_connections')
        .select('user_id')
        .eq('user_id', candidateId)
        .eq('status', 'connected')
        .maybeSingle()
      garminUserId = (conn?.user_id as number) ?? null
    }
  }

  if (garminUserId === null) {
    // No auth session AND no valid userId — return 401 only if truly unauthenticated
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Garmin not connected', code: 'not_connected' },
      { status: 404 }
    )
  }

  // 3. Check for pending files before spinning up the full worker
  const { data: pendingRows } = await admin
    .from('garmin_activity_files')
    .select('id')
    .eq('user_id', garminUserId)
    .eq('status', 'pending')
    .limit(1)

  if (!pendingRows?.length) {
    return NextResponse.json({
      processed: 0,
      message: "No pending activities. Garmin usually uploads within 1–2 min of saving a run — try again shortly.",
    })
  }

  // 4. Run the derive worker immediately for this user
  try {
    const result = await runGarminDeriveForPayload({
      userId: garminUserId,
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
