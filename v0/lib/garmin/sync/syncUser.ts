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
  lastSyncAt: string | null
  errorState: Record<string, unknown> | null
  noOp: boolean
  activitiesUpserted: number
  dailyMetricsUpserted: number
  duplicateActivitiesSkipped: number
  warnings: string[]
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

  const connection = await getGarminOAuthState(userId)
  if (!connection || connection.status !== 'connected') {
    return {
      status: 401,
      connected: false,
      lastSyncAt: connection?.lastSuccessfulSyncAt ?? connection?.lastSyncAt ?? null,
      errorState: connection?.errorState ?? null,
      noOp: true,
      activitiesUpserted: 0,
      dailyMetricsUpserted: 0,
      duplicateActivitiesSkipped: 0,
      warnings: [],
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
      lastSyncAt,
      errorState: connection.errorState,
      noOp: true,
      activitiesUpserted: 0,
      dailyMetricsUpserted: 0,
      duplicateActivitiesSkipped: 0,
      warnings: [],
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
        lastSyncAt: connection.lastSuccessfulSyncAt ?? connection.lastSyncAt,
        errorState: connection.errorState,
        noOp: true,
        activitiesUpserted: workerStats.imported,
        dailyMetricsUpserted: 0,
        duplicateActivitiesSkipped: workerStats.duplicates,
        warnings,
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
    lastSyncAt: refreshedStatus.lastSuccessfulSyncAt ?? refreshedStatus.lastSyncAt,
    errorState: refreshedStatus.errorState,
    noOp:
      workerStats.imported === 0 &&
      dailyMetricsUpserted === 0,
    activitiesUpserted: workerStats.imported,
    dailyMetricsUpserted,
    duplicateActivitiesSkipped: workerStats.duplicates,
    warnings,
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
