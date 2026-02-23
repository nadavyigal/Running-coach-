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
 * Returns:
 *   { processed: number, message: string }
 */
export async function POST() {
  // 1. Authenticate
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Look up this auth user's garmin user_id
  const admin = createAdminClient()
  const { data: connection, error: connError } = await admin
    .from('garmin_connections')
    .select('user_id')
    .eq('auth_user_id', user.id)
    .eq('status', 'connected')
    .maybeSingle()

  if (connError) {
    return NextResponse.json({ error: 'Failed to look up Garmin connection' }, { status: 500 })
  }

  if (!connection?.user_id) {
    return NextResponse.json(
      { error: 'Garmin not connected', code: 'not_connected' },
      { status: 404 }
    )
  }

  const userId = connection.user_id as number

  // 3. Check if there are any pending files before running the full worker
  const { data: pendingRows } = await admin
    .from('garmin_activity_files')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .limit(1)

  if (!pendingRows?.length) {
    return NextResponse.json({
      processed: 0,
      message: 'No pending Garmin activities. Your latest run may still be uploading — try again in a minute.',
    })
  }

  // 4. Run the derive worker for this user's activity files
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
        : 'Nothing new to sync.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Sync failed: ${message}` }, { status: 500 })
  }
}
