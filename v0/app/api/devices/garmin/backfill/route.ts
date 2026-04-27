import { NextResponse } from 'next/server'
import { syncGarminUser } from '@/lib/garmin/sync/syncUser'
import { logger } from '@/lib/logger'
import { enqueueGarminSyncJob } from '@/lib/server/garmin-sync-queue'

export const dynamic = 'force-dynamic'

const BACKFILL_DAILY_DAYS = 90
const BACKFILL_ACTIVITY_DAYS = 90

function parseUserId(req: Request): number | null {
  const headerValue = req.headers.get('x-user-id')?.trim() ?? ''
  if (headerValue) {
    const parsed = Number.parseInt(headerValue, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  const url = new URL(req.url)
  const queryValue = url.searchParams.get('userId')?.trim() ?? ''
  if (!queryValue) return null

  const parsed = Number.parseInt(queryValue, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function POST(req: Request) {
  const userId = parseUserId(req)
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Valid userId is required', needsReauth: true },
      { status: 401 }
    )
  }

  const enqueued = await enqueueGarminSyncJob({
    userId,
    trigger: 'backfill',
    dailyLookbackDays: BACKFILL_DAILY_DAYS,
    activityLookbackDays: BACKFILL_ACTIVITY_DAYS,
    sinceIso: null,
    requestedAt: new Date().toISOString(),
  })

  if (!enqueued.queued) {
    logger.warn('Garmin backfill queue unavailable; falling back to inline sync/drain', {
      userId,
      reason: enqueued.reason ?? 'Backfill queue unavailable',
    })

    try {
      const fallback = await syncGarminUser({
        userId,
        trigger: 'backfill',
      })

      return NextResponse.json(
        {
          success: fallback.status === 200,
          accepted: true,
          status: 'inline_processed',
          queued: false,
          queueFallbackReason: enqueued.reason ?? 'Backfill queue unavailable',
          trigger: 'backfill',
          pendingJobs: fallback.pendingJobs,
          workerStats: fallback.body.workerStats ?? null,
          activitiesUpserted: fallback.activitiesUpserted,
          dailyMetricsUpserted: fallback.dailyMetricsUpserted,
          duplicateActivitiesSkipped: fallback.duplicateActivitiesSkipped,
          notices: fallback.warnings,
          needsReauth: fallback.needsReauth,
          error: fallback.error ?? null,
          processedAt: new Date().toISOString(),
        },
        { status: fallback.status === 200 ? 200 : fallback.status }
      )
    } catch (error) {
      logger.error('Garmin inline backfill fallback failed:', error)
      const message = error instanceof Error ? error.message : 'Inline Garmin backfill failed'
      return NextResponse.json(
        {
          success: false,
          error: message,
          queueFallbackReason: enqueued.reason ?? 'Backfill queue unavailable',
        },
        { status: 500 }
      )
    }
  }

  return NextResponse.json(
    {
      success: true,
      accepted: true,
      status: 'queued',
      jobId: enqueued.jobId,
      trigger: 'backfill',
      lookbackDays: {
        dailyMetrics: BACKFILL_DAILY_DAYS,
        activities: BACKFILL_ACTIVITY_DAYS,
      },
      queuedAt: new Date().toISOString(),
    },
    { status: 202 }
  )
}
