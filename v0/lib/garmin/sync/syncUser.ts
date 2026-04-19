import 'server-only'

import {
  buildExecutionOptions,
  runGarminSyncForUser,
} from '@/app/api/devices/garmin/sync/route'
import {
  enqueueGarminBackfillJob,
  getGarminSyncState,
  processPendingGarminJobs,
} from '@/lib/integrations/garmin/service'
import type {
  GarminDatasetCompletenessSummary,
  GarminPersistenceSummary,
} from '@/lib/server/garmin-api-response'
import type { GarminDatasetKey } from '@/lib/server/garmin-export-store'
import { getGarminOAuthState } from '@/lib/server/garmin-oauth-store'
import { evaluateGarminRateLimit } from '@/lib/garmin/sync/rateLimit'

type GarminSyncTrigger = 'manual' | 'backfill'

export interface GarminConnectionStatus {
  connected: boolean
  status: string
  lastSyncAt: string | null
  lastSyncCursor: string | null
  errorState: Record<string, unknown> | null
}

export interface GarminSyncUserResult {
  status: number
  connected: boolean
  connectionStatus: string
  syncState: string
  needsReauth: boolean
  lastSyncAt: string | null
  lastSuccessfulSyncAt: string | null
  lastDataReceivedAt: string | null
  pendingJobs: number
  datasetCounts: Record<string, number>
  datasetCompleteness: GarminDatasetCompletenessSummary
  persistence: GarminPersistenceSummary
  errorState: Record<string, unknown> | null
  noOp: boolean
  activitiesUpserted: number
  dailyMetricsUpserted: number
  duplicateActivitiesSkipped: number
  warnings: string[]
  error?: string | null
  retryAfterSeconds?: number
  reason?: string
  body: Record<string, unknown>
}

function sumWorkerStats(
  left: Awaited<ReturnType<typeof processPendingGarminJobs>>,
  right: Awaited<ReturnType<typeof processPendingGarminJobs>>
) {
  return {
    claimed: left.claimed + right.claimed,
    succeeded: left.succeeded + right.succeeded,
    retried: left.retried + right.retried,
    failed: left.failed + right.failed,
    deadLettered: left.deadLettered + right.deadLettered,
    imported: left.imported + right.imported,
    duplicates: left.duplicates + right.duplicates,
  }
}

export async function getGarminConnectionStatus(userId: number): Promise<GarminConnectionStatus> {
  const state = await getGarminOAuthState(userId)
  if (!state) {
    return {
      connected: false,
      status: 'disconnected',
      lastSyncAt: null,
      lastSyncCursor: null,
      errorState: null,
    }
  }

  return {
    connected: state.status === 'connected',
    status: state.status,
    lastSyncAt: state.lastSuccessfulSyncAt ?? state.lastSyncAt,
    lastSyncCursor: state.lastSyncCursor,
    errorState: state.errorState,
  }
}

export async function syncGarminUser(input: {
  userId: number
  trigger?: GarminSyncTrigger
}): Promise<GarminSyncUserResult> {
  const userId = input.userId
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error('Valid userId is required for Garmin sync')
  }

  const emptyDatasetCounts: Record<string, number> = {}
  const emptyDatasetCompleteness: GarminDatasetCompletenessSummary = {
    missingDatasets: [],
    usedFallbackDatasets: [],
  }
  const emptyPersistence: GarminPersistenceSummary = {
    activitiesUpserted: 0,
    dailyMetricsUpserted: 0,
    duplicateActivitiesSkipped: 0,
    activityFilesProcessed: 0,
  }

  const connection = await getGarminOAuthState(userId)
  if (!connection || connection.status !== 'connected') {
    return {
      status: 401,
      connected: false,
      connectionStatus: connection?.status ?? 'disconnected',
      syncState: connection?.status === 'reauth_required' ? 'reauth_required' : 'disconnected',
      needsReauth: true,
      lastSyncAt: connection?.lastSuccessfulSyncAt ?? connection?.lastSyncAt ?? null,
      lastSuccessfulSyncAt: connection?.lastSuccessfulSyncAt ?? null,
      lastDataReceivedAt: connection?.lastWebhookReceivedAt ?? null,
      pendingJobs: 0,
      datasetCounts: emptyDatasetCounts,
      datasetCompleteness: emptyDatasetCompleteness,
      persistence: emptyPersistence,
      errorState: connection?.errorState ?? null,
      noOp: true,
      activitiesUpserted: 0,
      dailyMetricsUpserted: 0,
      duplicateActivitiesSkipped: 0,
      warnings: [],
      error: 'No Garmin connection found. Connect Garmin first.',
      reason: 'not_connected',
      body: {
        success: false,
        error: 'No Garmin connection found. Connect Garmin first.',
        needsReauth: true,
      },
    }
  }

  const lastSyncAt = connection.lastSuccessfulSyncAt ?? connection.lastSyncAt
  const rateLimit = evaluateGarminRateLimit({
    userId,
    lastSyncAt,
    enforceCooldown: false,
  })

  if (!rateLimit.allowed && input.trigger !== 'backfill') {
    return {
      status: 429,
      connected: true,
      connectionStatus: connection.status,
      syncState: 'connected',
      needsReauth: false,
      lastSyncAt,
      lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt,
      lastDataReceivedAt: connection.lastWebhookReceivedAt,
      pendingJobs: 0,
      datasetCounts: emptyDatasetCounts,
      datasetCompleteness: emptyDatasetCompleteness,
      persistence: emptyPersistence,
      errorState: connection.errorState,
      noOp: true,
      activitiesUpserted: 0,
      dailyMetricsUpserted: 0,
      duplicateActivitiesSkipped: 0,
      warnings: [],
      error: 'Garmin sync rate limit reached. Try again later.',
      ...(rateLimit.retryAfterSeconds !== undefined ? { retryAfterSeconds: rateLimit.retryAfterSeconds } : {}),
      ...(rateLimit.reason !== undefined ? { reason: rateLimit.reason } : {}),
      body: {
        success: false,
        error: 'Garmin sync rate limit reached. Try again later.',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        reason: rateLimit.reason,
      },
    }
  }

  await enqueueGarminBackfillJob({
    userId,
    profileId: connection.profileId,
    providerUserId: connection.providerUserId ?? connection.garminUserId,
  })

  const warnings: string[] = []

  const initialWorkerStats = await processPendingGarminJobs({
    limit: input.trigger === 'backfill' ? 8 : 4,
    workerId: `manual-sync-${userId}`,
  })
  let workerStats = initialWorkerStats

  if (initialWorkerStats.imported === 0) {
    await enqueueGarminBackfillJob({
      userId,
      profileId: connection.profileId,
      providerUserId: connection.providerUserId ?? connection.garminUserId,
    })

    const backfillWorkerStats = await processPendingGarminJobs({
      limit: input.trigger === 'backfill' ? 8 : 4,
      workerId: `manual-sync-backfill-${userId}`,
    })
    workerStats = sumWorkerStats(initialWorkerStats, backfillWorkerStats)
  }

  let dailyMetricsUpserted = 0
  let analyticsBody: Record<string, unknown> | null = null
  let lastDataReceivedAt: string | null = connection.lastWebhookReceivedAt
  let datasetCounts: Record<string, number> = emptyDatasetCounts
  let datasetCompleteness = emptyDatasetCompleteness

  try {
    const analyticsExecution = await runGarminSyncForUser({
      userId,
      options: {
        ...buildExecutionOptions(input.trigger ?? 'manual'),
        enforceRateLimit: false,
      },
    })

    analyticsBody = analyticsExecution.body

    if (analyticsExecution.status === 401) {
      return {
        status: analyticsExecution.status,
        connected: false,
        connectionStatus: 'reauth_required',
        syncState: 'reauth_required',
        needsReauth: true,
        lastSyncAt: connection.lastSuccessfulSyncAt ?? connection.lastSyncAt,
        lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt ?? null,
        lastDataReceivedAt: connection.lastWebhookReceivedAt,
        pendingJobs: 0,
        datasetCounts: emptyDatasetCounts,
        datasetCompleteness: emptyDatasetCompleteness,
        persistence: emptyPersistence,
        errorState: connection.errorState,
        noOp: true,
        activitiesUpserted: workerStats.imported,
        dailyMetricsUpserted: 0,
        duplicateActivitiesSkipped: workerStats.duplicates,
        warnings,
        error:
          typeof analyticsExecution.body.error === 'string'
            ? analyticsExecution.body.error
            : 'Garmin authentication expired or invalid, please reconnect Garmin',
        body: analyticsExecution.body,
      }
    }

    const persistence = analyticsExecution.body.persistence
    if (typeof persistence === 'object' && persistence != null) {
      const upserted = (persistence as { dailyMetricsUpserted?: unknown }).dailyMetricsUpserted
      if (typeof upserted === 'number' && Number.isFinite(upserted)) {
        dailyMetricsUpserted = upserted
      }
    }

    const executionDatasetCounts = analyticsExecution.body.datasetCounts
    if (executionDatasetCounts && typeof executionDatasetCounts === 'object') {
      datasetCounts = Object.fromEntries(
        Object.entries(executionDatasetCounts as Record<string, unknown>).map(([key, value]) => [
          key,
          typeof value === 'number' && Number.isFinite(value) ? value : 0,
        ])
      )
    }

    const executionCompleteness = analyticsExecution.body.datasetCompleteness
    if (executionCompleteness && typeof executionCompleteness === 'object') {
      datasetCompleteness = {
        missingDatasets: Array.isArray((executionCompleteness as { missingDatasets?: unknown }).missingDatasets)
          ? ((executionCompleteness as { missingDatasets?: unknown }).missingDatasets as unknown[])
              .filter((item): item is GarminDatasetKey => typeof item === 'string')
          : [],
        usedFallbackDatasets: Array.isArray(
          (executionCompleteness as { usedFallbackDatasets?: unknown }).usedFallbackDatasets
        )
          ? ((executionCompleteness as { usedFallbackDatasets?: unknown }).usedFallbackDatasets as unknown[])
              .filter((item): item is GarminDatasetKey => typeof item === 'string')
          : [],
      }
    }

    const ingestion = analyticsExecution.body.ingestion
    if (ingestion && typeof ingestion === 'object') {
      const latestReceivedAt = (ingestion as { latestReceivedAt?: unknown }).latestReceivedAt
      if (typeof latestReceivedAt === 'string' && latestReceivedAt.trim().length > 0) {
        lastDataReceivedAt = latestReceivedAt
      }
    }

    const notices = analyticsExecution.body.notices
    if (Array.isArray(notices)) {
      warnings.push(...notices.filter((notice): notice is string => typeof notice === 'string' && notice.trim().length > 0))
    } else if (analyticsExecution.status !== 200) {
      warnings.push('Garmin analytics refresh returned a non-success status during manual sync.')
    }
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : 'Garmin analytics refresh failed during manual sync.')
  }

  const refreshedStatus = await getGarminSyncState(userId)

  return {
    status: 200,
    connected: refreshedStatus.connected,
    connectionStatus: refreshedStatus.connectionStatus,
    syncState: refreshedStatus.syncState,
    needsReauth: refreshedStatus.syncState === 'reauth_required',
    lastSyncAt: refreshedStatus.lastSuccessfulSyncAt ?? refreshedStatus.lastSyncAt,
    lastSuccessfulSyncAt: refreshedStatus.lastSuccessfulSyncAt,
    lastDataReceivedAt,
    pendingJobs: refreshedStatus.pendingJobs,
    datasetCounts,
    datasetCompleteness,
    persistence: {
      activitiesUpserted: workerStats.imported,
      dailyMetricsUpserted,
      duplicateActivitiesSkipped: workerStats.duplicates,
      activityFilesProcessed: 0,
    },
    errorState: refreshedStatus.errorState,
    noOp:
      workerStats.imported === 0 &&
      dailyMetricsUpserted === 0,
    activitiesUpserted: workerStats.imported,
    dailyMetricsUpserted,
    duplicateActivitiesSkipped: workerStats.duplicates,
    warnings,
    error: refreshedStatus.lastSyncError,
    body: {
      success: true,
      syncState: refreshedStatus.syncState,
      pendingJobs: refreshedStatus.pendingJobs,
      workerStats,
      dailyMetricsUpserted,
      warnings,
      ...(analyticsBody ? { analytics: analyticsBody } : {}),
    },
  }
}
