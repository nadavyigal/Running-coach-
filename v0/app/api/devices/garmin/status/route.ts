import { NextResponse } from 'next/server'

import { GARMIN_EXPORT_DATASET_KEYS } from '@/lib/garmin/datasets'
import { getGarminConfidenceLabel, getGarminFreshnessLabel } from '@/lib/garmin/ui/freshness'
import { getGarminSyncState } from '@/lib/integrations/garmin/service'
import {
  createEmptyGarminCanonicalStatusResponse,
  createEmptyGarminDatasetCounts,
  createEmptyGarminDatasetCompleteness,
} from '@/lib/server/garmin-api-response'
import { groupRowsByDataset, lookbackStartIso, readGarminExportRows } from '@/lib/server/garmin-export-store'
import { getGarminOAuthState } from '@/lib/server/garmin-oauth-store'

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

function latestIso(values: Array<string | null | undefined>): string | null {
  const sorted = values
    .filter((value): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))

  return sorted[0] ?? null
}

export async function GET(req: Request) {
  const userId = parseUserId(req)
  if (!userId) {
    const response = createEmptyGarminCanonicalStatusResponse()
    response.error = 'Valid userId is required'
    response.detail = { message: 'Valid userId is required' }
    return NextResponse.json(
      {
        ...response,
        errorState: { message: 'Valid userId is required' },
        freshnessLabel: 'unknown',
        confidenceLabel: 'low',
      },
      { status: 400 }
    )
  }

  const [connection, syncState] = await Promise.all([
    getGarminOAuthState(userId),
    getGarminSyncState(userId),
  ])

  if (!connection?.garminUserId) {
    const lastSyncAt = syncState.lastSuccessfulSyncAt ?? syncState.lastSyncAt
    const response = createEmptyGarminCanonicalStatusResponse()
    response.success = true
    response.connected = syncState.connected
    response.connectionStatus = syncState.connectionStatus
    response.syncState = syncState.syncState
    response.needsReauth = syncState.syncState === 'reauth_required'
    response.lastSyncAt = syncState.lastSyncAt
    response.lastSuccessfulSyncAt = syncState.lastSuccessfulSyncAt
    response.lastDataReceivedAt = syncState.lastWebhookReceivedAt
    response.pendingJobs = syncState.pendingJobs
    response.error = syncState.lastSyncError
    response.detail = syncState.errorState

    return NextResponse.json({
      ...response,
      lastWebhookReceivedAt: syncState.lastWebhookReceivedAt,
      lastSyncError: syncState.lastSyncError,
      errorState: syncState.errorState,
      freshnessLabel: getGarminFreshnessLabel(lastSyncAt),
      confidenceLabel: getGarminConfidenceLabel(lastSyncAt),
    })
  }

  const readResult = await readGarminExportRows({
    garminUserId: connection.garminUserId,
    sinceIso: lookbackStartIso(),
  })

  const datasetCounts = createEmptyGarminDatasetCounts()
  const datasetCompleteness = createEmptyGarminDatasetCompleteness()
  const notices: string[] = []
  let latestReceivedAt: string | null = null

  if (readResult.storeAvailable) {
    const groupedRows = groupRowsByDataset(readResult.rows)
    for (const key of GARMIN_EXPORT_DATASET_KEYS) {
      datasetCounts[key] = groupedRows[key]?.length ?? 0
      if (
        datasetCounts[key] === 0 &&
        ((key === 'activities' || key === 'manuallyUpdatedActivities' || key === 'activityDetails')
          ? connection.scopes.includes('ACTIVITY_EXPORT')
          : connection.scopes.includes('HEALTH_EXPORT'))
      ) {
        datasetCompleteness.missingDatasets.push(key)
      }
    }

    latestReceivedAt = latestIso(readResult.rows.map((row) => row.receivedAt))
    if (readResult.rows.length === 0) {
      notices.push('No Garmin export records were found in the current sync window.')
    }
  } else {
    notices.push(readResult.storeError ?? 'Garmin export store is unavailable.')
    for (const key of GARMIN_EXPORT_DATASET_KEYS) {
      datasetCompleteness.missingDatasets.push(key)
    }
  }

  if (!connection.scopes.includes('ACTIVITY_EXPORT')) {
    notices.push('Missing ACTIVITY_EXPORT permission.')
  }
  if (!connection.scopes.includes('HEALTH_EXPORT')) {
    notices.push('Missing HEALTH_EXPORT permission.')
  }

  const lastSyncAt = syncState.lastSuccessfulSyncAt ?? syncState.lastSyncAt
  const lastDataReceivedAt = latestIso([latestReceivedAt, syncState.lastWebhookReceivedAt])

  return NextResponse.json({
    success: true,
    connected: syncState.connected,
    connectionStatus: syncState.connectionStatus,
    syncState: syncState.syncState,
    needsReauth: syncState.syncState === 'reauth_required',
    lastSyncAt: syncState.lastSyncAt,
    lastSuccessfulSyncAt: syncState.lastSuccessfulSyncAt,
    lastDataReceivedAt,
    pendingJobs: syncState.pendingJobs,
    datasetCounts,
    datasetCompleteness,
    persistence: null,
    notices,
    error: syncState.lastSyncError,
    detail: readResult.storeAvailable ? null : readResult.storeError ?? null,
    lastWebhookReceivedAt: syncState.lastWebhookReceivedAt,
    lastSyncError: syncState.lastSyncError,
    errorState: syncState.errorState,
    freshnessLabel: getGarminFreshnessLabel(lastSyncAt),
    confidenceLabel: getGarminConfidenceLabel(lastSyncAt),
  })
}
