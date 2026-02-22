import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { runGarminDeriveForPayload } from '@/lib/server/garmin-derive-worker'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_USERS_PER_RUN = 20

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) return true
  return request.headers.get('authorization') === `Bearer ${cronSecret}`
}

async function fetchPendingUserIds(): Promise<number[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('garmin_activity_files')
    .select('user_id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(MAX_USERS_PER_RUN * 5)

  if (error) {
    throw new Error(`Failed to query pending activity files: ${error.message}`)
  }

  // Deduplicate user IDs while preserving order
  const seen = new Set<number>()
  const userIds: number[] = []
  for (const row of data ?? []) {
    if (row.user_id != null && !seen.has(row.user_id)) {
      seen.add(row.user_id)
      userIds.push(row.user_id)
      if (userIds.length >= MAX_USERS_PER_RUN) break
    }
  }
  return userIds
}

async function processPendingFitFiles(): Promise<{
  pendingUserCount: number
  processedUsers: number
  errors: string[]
}> {
  const userIds = await fetchPendingUserIds()
  if (userIds.length === 0) {
    return { pendingUserCount: 0, processedUsers: 0, errors: [] }
  }

  const errors: string[] = []
  let processedUsers = 0

  for (const userId of userIds) {
    try {
      await runGarminDeriveForPayload({
        userId,
        datasetKey: 'activityFiles',
        source: 'webhook',
        requestedAt: new Date().toISOString(),
      })
      processedUsers++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(`garmin-fit-derive cron: error for user ${userId}: ${msg}`)
      errors.push(`user ${userId}: ${msg}`)
    }
  }

  return { pendingUserCount: userIds.length, processedUsers, errors }
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    logger.warn('Unauthorized garmin-fit-derive cron request')
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const stats = await processPendingFitFiles()
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats,
    })
  } catch (error) {
    logger.error('garmin-fit-derive cron failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
