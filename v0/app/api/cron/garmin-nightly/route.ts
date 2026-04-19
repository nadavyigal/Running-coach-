import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { listConnectedGarminUserIds } from '@/lib/server/garmin-oauth-store'
import { enqueueGarminSyncJob } from '@/lib/server/garmin-sync-queue'
import {
  runGarminSyncForUser,
  buildExecutionOptions,
} from '@/app/api/devices/garmin/sync/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH_SIZE = 500

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) return true
  return request.headers.get('authorization') === `Bearer ${cronSecret}`
}

async function collectConnectedUsers(): Promise<number[]> {
  const userIds: number[] = []
  let offset = 0

  while (true) {
    const page = await listConnectedGarminUserIds({
      limit: BATCH_SIZE,
      offset,
    })

    userIds.push(...page)
    if (page.length < BATCH_SIZE) break
    offset += BATCH_SIZE
  }

  return userIds
}

async function runNightlySyncEnqueue() {
  const connectedUserIds = await collectConnectedUsers()
  let queuedCount = 0
  let skippedCount = 0
  let directSyncCount = 0
  let directSyncErrors = 0

  for (const userId of connectedUserIds) {
    const queued = await enqueueGarminSyncJob({
      userId,
      trigger: 'nightly',
      dailyLookbackDays: 7,
      activityLookbackDays: 7,
      sinceIso: null,
      requestedAt: new Date().toISOString(),
    })

    if (queued.queued) {
      queuedCount += 1
    } else {
      // Redis/BullMQ not available — run sync directly inline
      try {
        const options = buildExecutionOptions('nightly')
        const result = await runGarminSyncForUser({ userId, options })
        if (result.status >= 200 && result.status < 300) {
          directSyncCount += 1
        } else if (result.status === 429) {
          // Rate limited — skip, not an error
          skippedCount += 1
        } else {
          directSyncErrors += 1
          logger.warn(`Garmin direct sync failed for user ${userId}`, {
            status: result.status,
            body: result.body,
          })
        }
      } catch (error) {
        directSyncErrors += 1
        logger.error(`Garmin direct sync error for user ${userId}:`, error)
      }
    }
  }

  return {
    connectedUsers: connectedUserIds.length,
    queued: queuedCount,
    directSync: directSyncCount,
    directSyncErrors,
    skipped: skippedCount,
  }
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    logger.warn('Unauthorized Garmin nightly cron request')
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const stats = await runNightlySyncEnqueue()
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats,
    })
  } catch (error) {
    logger.error('Garmin nightly cron failed:', error)
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
