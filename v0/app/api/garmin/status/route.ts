import { NextResponse } from 'next/server'

import { getGarminConnectionStatus } from '@/lib/garmin/sync/syncUser'
import { getGarminConfidenceLabel, getGarminFreshnessLabel } from '@/lib/garmin/ui/freshness'

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

export async function GET(req: Request) {
  const userId = parseUserId(req)
  if (!userId) {
    return NextResponse.json(
      {
        connected: false,
        lastSyncAt: null,
        errorState: { message: 'Valid userId is required' },
        freshnessLabel: 'unknown',
        confidenceLabel: 'low',
      },
      { status: 400 }
    )
  }

  const status = await getGarminConnectionStatus(userId)
  const freshnessLabel = getGarminFreshnessLabel(status.lastSyncAt)
  const confidenceLabel = getGarminConfidenceLabel(status.lastSyncAt)

  return NextResponse.json({
    connected: status.connected,
    connectionStatus: status.status,
    lastSyncAt: status.lastSyncAt,
    errorState: status.errorState,
    freshnessLabel,
    confidenceLabel,
  })
}

