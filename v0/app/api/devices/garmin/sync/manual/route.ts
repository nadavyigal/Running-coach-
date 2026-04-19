import { NextResponse } from 'next/server'

import { syncGarminUser } from '@/lib/garmin/sync/syncUser'
import { getGarminConfidenceLabel, getGarminFreshnessLabel } from '@/lib/garmin/ui/freshness'

export const dynamic = 'force-dynamic'

async function readBodySafely(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = (await req.json()) as unknown
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function parseUserIdFromRequest(req: Request, body: Record<string, unknown>): number | null {
  const fromHeader = req.headers.get('x-user-id')?.trim() ?? ''
  if (fromHeader) {
    const parsed = Number.parseInt(fromHeader, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  const { searchParams } = new URL(req.url)
  const fromQuery = searchParams.get('userId')?.trim() ?? ''
  if (fromQuery) {
    const parsed = Number.parseInt(fromQuery, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  const fromBody = body.userId
  if (typeof fromBody === 'number' && Number.isFinite(fromBody) && fromBody > 0) return fromBody
  if (typeof fromBody === 'string' && fromBody.trim().length > 0) {
    const parsed = Number.parseInt(fromBody, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  return null
}

export async function POST(req: Request) {
  const body = await readBodySafely(req)
  const userId = parseUserIdFromRequest(req, body)

  if (!userId) {
    return NextResponse.json(
      {
        success: false,
        connected: false,
        connectionStatus: 'disconnected',
        syncState: 'disconnected',
        needsReauth: false,
        lastSyncAt: null,
        lastSuccessfulSyncAt: null,
        lastDataReceivedAt: null,
        pendingJobs: 0,
        datasetCounts: {},
        datasetCompleteness: {
          missingDatasets: [],
          usedFallbackDatasets: [],
        },
        persistence: null,
        notices: [],
        error: 'Valid userId is required',
        detail: { message: 'Valid userId is required' },
      },
      { status: 400 }
    )
  }

  let result: Awaited<ReturnType<typeof syncGarminUser>>
  try {
    result = await syncGarminUser({
      userId,
      trigger: 'manual',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal sync error'
    return NextResponse.json(
      {
        success: false,
        connected: false,
        connectionStatus: 'error',
        syncState: 'error',
        needsReauth: false,
        lastSyncAt: null,
        lastSuccessfulSyncAt: null,
        lastDataReceivedAt: null,
        pendingJobs: 0,
        datasetCounts: {},
        datasetCompleteness: {
          missingDatasets: [],
          usedFallbackDatasets: [],
        },
        persistence: null,
        notices: [],
        error: message,
        detail: { message },
      },
      { status: 500 }
    )
  }

  const freshnessLabel = getGarminFreshnessLabel(result.lastSuccessfulSyncAt ?? result.lastSyncAt)
  const confidenceLabel = getGarminConfidenceLabel(result.lastSuccessfulSyncAt ?? result.lastSyncAt)

  return NextResponse.json(
    {
      success: result.status === 200,
      connected: result.connected,
      connectionStatus: result.connectionStatus,
      syncState: result.syncState,
      needsReauth: result.needsReauth,
      lastSyncAt: result.lastSyncAt,
      lastSuccessfulSyncAt: result.lastSuccessfulSyncAt,
      lastDataReceivedAt: result.lastDataReceivedAt,
      pendingJobs: result.pendingJobs,
      datasetCounts: result.datasetCounts,
      datasetCompleteness: result.datasetCompleteness,
      persistence: result.persistence,
      notices: result.warnings,
      error: result.error ?? null,
      detail: result.body,
      noOp: result.noOp,
      activitiesUpserted: result.activitiesUpserted,
      dailyMetricsUpserted: result.dailyMetricsUpserted,
      duplicateActivitiesSkipped: result.duplicateActivitiesSkipped,
      activityFilesProcessed: result.activityFilesProcessed,
      reason: result.reason ?? null,
      retryAfterSeconds: result.retryAfterSeconds ?? null,
      freshnessLabel,
      confidenceLabel,
      trigger: 'manual',
      triggeredAt: new Date().toISOString(),
    },
    { status: result.status }
  )
}
