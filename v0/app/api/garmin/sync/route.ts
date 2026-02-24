import { NextResponse } from 'next/server'

import { syncGarminUser } from '@/lib/garmin/sync/syncUser'
import { getGarminConfidenceLabel, getGarminFreshnessLabel } from '@/lib/garmin/ui/freshness'

export const dynamic = 'force-dynamic'

type GarminSyncTrigger = 'manual' | 'backfill'

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

function parseTrigger(value: unknown): GarminSyncTrigger {
  return value === 'backfill' ? 'backfill' : 'manual'
}

async function readBodySafely(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = (await req.json()) as unknown
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export async function POST(req: Request) {
  const body = await readBodySafely(req)
  const userId = parseUserIdFromRequest(req, body)
  if (!userId) {
    return NextResponse.json(
      {
        success: false,
        connected: false,
        error: 'Valid userId is required',
      },
      { status: 400 }
    )
  }

  const { searchParams } = new URL(req.url)
  const trigger = parseTrigger(body.trigger ?? searchParams.get('trigger'))

  const result = await syncGarminUser({
    userId,
    trigger,
  })

  const freshnessLabel = getGarminFreshnessLabel(result.lastSyncAt)
  const confidenceLabel = getGarminConfidenceLabel(result.lastSyncAt)

  return NextResponse.json(
    {
      success: result.status === 200,
      connected: result.connected,
      lastSyncAt: result.lastSyncAt,
      errorState: result.errorState,
      noOp: result.noOp,
      activitiesUpserted: result.activitiesUpserted,
      dailyMetricsUpserted: result.dailyMetricsUpserted,
      reason: result.reason ?? null,
      retryAfterSeconds: result.retryAfterSeconds ?? null,
      freshnessLabel,
      confidenceLabel,
      details: result.body,
    },
    { status: result.status }
  )
}

