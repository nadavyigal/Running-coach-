import { NextResponse } from 'next/server'
import { enqueueGarminSyncJob } from '@/lib/server/garmin-sync-queue'

export const dynamic = 'force-dynamic'

const BACKFILL_DAILY_DAYS = 56
const BACKFILL_ACTIVITY_DAYS = 21

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
    return NextResponse.json(
      {
        success: false,
        error: enqueued.reason ?? 'Backfill queue unavailable',
      },
      { status: 503 }
    )
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

