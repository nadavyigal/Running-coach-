import 'server-only'

import crypto from 'crypto'

import { logger } from '@/lib/logger'
import { persistGarminSyncSnapshot } from '@/lib/server/garmin-analytics-store'
import { runGarminDeriveForPayload } from '@/lib/server/garmin-derive-worker'
import { enqueueGarminDeriveJob } from '@/lib/server/garmin-sync-queue'
import { createAdminClient } from '@/lib/supabase/admin'
import { GarminClient, buildGarminServiceError, isGarminServiceError, mapGarminPayloadToNormalizedActivity } from '@/lib/integrations/garmin/client'
import { importGarminActivity } from '@/lib/integrations/garmin/importGarminActivity'
import type {
  GarminDatasetKey,
  GarminImportJobRecord,
  GarminOAuthConnection,
  GarminSyncTrustState,
  GarminWebhookDatasetRow,
  GarminWebhookEventRecord,
} from '@/lib/integrations/garmin/types'
import {
  getGarminConnectionByProviderUserId,
  getGarminOAuthState,
  markGarminAuthError,
  upsertGarminConnection,
} from '@/lib/server/garmin-oauth-store'

const ACTIVITY_WEBHOOK_DATASETS: GarminDatasetKey[] = [
  'activities',
  'manuallyUpdatedActivities',
  'activityDetails',
]

const HEALTH_WEBHOOK_DATASETS: GarminDatasetKey[] = [
  'dailies',
  'sleeps',
  'epochs',
  'stressDetails',
  'hrv',
  'pulseox',
  'allDayRespiration',
  'bodyComps',
  'userMetrics',
  'healthSnapshot',
  'skinTemp',
  'bloodPressures',
]

const SUPPORTED_WEBHOOK_DATASETS: GarminDatasetKey[] = [
  ...ACTIVITY_WEBHOOK_DATASETS,
  ...HEALTH_WEBHOOK_DATASETS,
]

const DELAYED_SYNC_THRESHOLD_MS = 30 * 60 * 1000
const HEALTHY_SYNC_THRESHOLD_MS = 12 * 60 * 60 * 1000
const BACKFILL_LOOKBACK_DAYS = 90

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function parseRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => asRecord(entry))
      .filter((entry) => Object.keys(entry).length > 0)
  }

  if (value && typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(nested)) {
        return nested
          .map((entry) => asRecord(entry))
          .filter((entry) => Object.keys(entry).length > 0)
      }
    }
  }

  return []
}

function computeDeliveryKey(rawBody: string): string {
  return crypto.createHash('sha256').update(rawBody).digest('hex')
}

function extractProviderUserId(payload: Record<string, unknown>): string | null {
  for (const datasetKey of SUPPORTED_WEBHOOK_DATASETS) {
    const rows = parseRows(payload[datasetKey])
    for (const row of rows) {
      const providerUserId = getString(row.userId) ?? getString(row.ownerUserId) ?? getString(row.userID)
      if (providerUserId) return providerUserId
    }
  }
  return null
}

function extractActivityId(row: Record<string, unknown>): string | null {
  const activityId = row.activityId ?? row.summaryId ?? row.id
  return activityId != null ? String(activityId) : null
}

function extractWebhookDatasetRows(payload: Record<string, unknown>): GarminWebhookDatasetRow[] {
  const rows: GarminWebhookDatasetRow[] = []

  for (const datasetKey of SUPPORTED_WEBHOOK_DATASETS) {
    for (const row of parseRows(payload[datasetKey])) {
      rows.push({
        datasetKey,
        providerUserId: getString(row.userId) ?? getString(row.ownerUserId) ?? null,
        callbackUrl: getString(row.callbackURL) ?? getString(row.callbackUrl),
        activityId: extractActivityId(row),
        payload: row,
      })
    }
  }

  return rows
}

function serializeError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim().length > 0) {
      return message
    }
  }
  return error instanceof Error ? error.message : String(error)
}

function isRetryableError(error: unknown): boolean {
  return isGarminServiceError(error) ? Boolean(error.retryable) : false
}

function backoffSeconds(attemptCount: number): number {
  return Math.min(300, 30 * 2 ** Math.max(0, attemptCount - 1))
}

function isOptionalDeriveQueueNotice(reason: string | null | undefined): boolean {
  const normalized = (reason ?? '').toLowerCase()
  if (!normalized) return false
  return normalized.includes('redis not configured') || normalized.includes('derive queue unavailable')
}

export async function recordGarminWebhookDelivery(params: {
  rawBody: string
  payload: Record<string, unknown>
  eventType?: string
}): Promise<{ event: GarminWebhookEventRecord | null; duplicate: boolean }> {
  const supabase = createAdminClient()
  const deliveryKey = computeDeliveryKey(params.rawBody)
  const providerUserId = extractProviderUserId(params.payload)
  const eventType = params.eventType ?? 'garmin_delivery'

  const { data: existing, error: existingError } = await supabase
    .from('garmin_webhook_events')
    .select('*')
    .eq('delivery_key', deliveryKey)
    .maybeSingle()

  if (existingError) {
    throw new Error(`Failed to read garmin_webhook_events: ${existingError.message}`)
  }

  if (existing) {
    logger.info('[garmin] metric=webhook_duplicate', {
      delivery_key: deliveryKey,
      webhook_event_id: existing.id,
    })
    return {
      event: existing as GarminWebhookEventRecord,
      duplicate: true,
    }
  }

  const { data, error } = await supabase
    .from('garmin_webhook_events')
    .insert({
      delivery_key: deliveryKey,
      event_type: eventType,
      provider_user_id: providerUserId,
      raw_payload: params.payload,
      status: 'received',
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to persist garmin_webhook_events: ${error.message}`)
  }

  logger.info('[garmin] metric=webhook_received', {
    webhook_event_id: data.id,
    provider_user_id: providerUserId,
  })

  return {
    event: data as GarminWebhookEventRecord,
    duplicate: false,
  }
}

async function processHealthWebhookData(params: {
  payload: Record<string, unknown>
  userId: number
}): Promise<{ dailyMetricsUpserted: number }> {
  const { payload, userId } = params
  const datasets: Record<GarminDatasetKey, Record<string, unknown>[]> = {} as Record<GarminDatasetKey, Record<string, unknown>[]>

  for (const datasetKey of HEALTH_WEBHOOK_DATASETS) {
    const rows = parseRows(payload[datasetKey])
    if (rows.length > 0) {
      datasets[datasetKey] = rows
    }
  }

  // Also initialize empty arrays for datasets not present to satisfy the type
  for (const key of SUPPORTED_WEBHOOK_DATASETS) {
    if (!datasets[key]) {
      datasets[key] = []
    }
  }

  const hasData = HEALTH_WEBHOOK_DATASETS.some((key) => (datasets[key]?.length ?? 0) > 0)
  if (!hasData) {
    return { dailyMetricsUpserted: 0 }
  }

  const result = await persistGarminSyncSnapshot({
    userId,
    activities: [],
    sleep: [],
    datasets,
  })

  return { dailyMetricsUpserted: result.dailyMetricsUpserted }
}

export async function enqueueGarminImportJobsForEvent(event: GarminWebhookEventRecord): Promise<{
  queuedJobs: number
  jobs: GarminImportJobRecord[]
  healthMetricsUpserted: number
}> {
  const supabase = createAdminClient()
  const datasetRows = extractWebhookDatasetRows(asRecord(event.raw_payload))
  const insertedJobs: GarminImportJobRecord[] = []
  let healthMetricsUpserted = 0

  // Process health datasets directly (persist to garmin_daily_metrics)
  const providerUserId = extractProviderUserId(asRecord(event.raw_payload))
  if (providerUserId || event.provider_user_id) {
    const connection = await getGarminConnectionByProviderUserId(providerUserId ?? event.provider_user_id ?? '')
    if (connection?.userId != null) {
      try {
        const healthResult = await processHealthWebhookData({
          payload: asRecord(event.raw_payload),
          userId: connection.userId,
        })
        healthMetricsUpserted = healthResult.dailyMetricsUpserted

        if (healthMetricsUpserted > 0) {
          // Trigger derive worker for readiness/ACWR recalculation
          const derivePayload = {
            userId: connection.userId,
            datasetKey: 'dailies' as const,
            source: 'webhook' as const,
            requestedAt: new Date().toISOString(),
          }
          const queued = await enqueueGarminDeriveJob(derivePayload)
          if (!queued.queued && isOptionalDeriveQueueNotice(queued.reason)) {
            await runGarminDeriveForPayload(derivePayload)
          }
        }
      } catch (error) {
        logger.warn('[garmin] metric=health_webhook_process_failed', {
          provider_user_id: providerUserId,
          error: serializeError(error),
        })
      }
    }
  }

  // Process activity datasets via import jobs
  for (const row of datasetRows) {
    // Skip health datasets — already processed above
    if (HEALTH_WEBHOOK_DATASETS.includes(row.datasetKey)) continue

    let connection = row.providerUserId ? await getGarminConnectionByProviderUserId(row.providerUserId) : null
    if (!connection && event.provider_user_id) {
      connection = await getGarminConnectionByProviderUserId(event.provider_user_id)
    }

    const dedupeQuery = supabase
      .from('garmin_import_jobs')
      .select('*')
      .eq('webhook_event_id', event.id)
      .eq('job_type', 'activity_import')

    if (connection?.userId != null) {
      dedupeQuery.eq('user_id', connection.userId)
    } else {
      dedupeQuery.is('user_id', null)
    }

    if (row.activityId != null) {
      dedupeQuery.eq('source_activity_id', row.activityId)
    } else {
      dedupeQuery.is('source_activity_id', null)
    }

    const { data: existingJob, error: existingJobError } = await dedupeQuery.maybeSingle()
    if (existingJobError) {
      throw new Error(`Failed to query garmin_import_jobs for dedupe: ${existingJobError.message}`)
    }
    if (existingJob) {
      insertedJobs.push(existingJob as GarminImportJobRecord)
      continue
    }

    const jobPayload = {
      webhook_event_id: event.id,
      user_id: connection?.userId ?? null,
      profile_id: connection?.profileId ?? null,
      provider_user_id: row.providerUserId ?? event.provider_user_id ?? null,
      source_activity_id: row.activityId,
      job_type: 'activity_import',
      status: 'pending',
      priority: row.callbackUrl ? 10 : 25,
      payload: {
        datasetKey: row.datasetKey,
        callbackUrl: row.callbackUrl,
        row: row.payload,
      },
    }

    const { data: insertedJob, error: insertError } = await supabase
      .from('garmin_import_jobs')
      .insert(jobPayload)
      .select('*')
      .single()

    if (insertError) {
      throw new Error(`Failed to insert garmin_import_job: ${insertError.message}`)
    }

    insertedJobs.push(insertedJob as GarminImportJobRecord)

    if (connection?.userId) {
      await upsertGarminConnection({
        userId: connection.userId,
        lastWebhookReceivedAt: new Date().toISOString(),
      })
    }
  }

  if (insertedJobs.length === 0 && healthMetricsUpserted === 0) {
    await supabase
      .from('garmin_webhook_events')
      .update({ status: 'failed', error_message: 'No supported Garmin data rows found' })
      .eq('id', event.id)
    return { queuedJobs: 0, jobs: [], healthMetricsUpserted: 0 }
  }

  await supabase
    .from('garmin_webhook_events')
    .update({ status: insertedJobs.length > 0 ? 'queued' : 'processed' })
    .eq('id', event.id)

  return {
    queuedJobs: insertedJobs.length,
    jobs: insertedJobs,
    healthMetricsUpserted,
  }
}

export async function enqueueGarminBackfillJob(params: {
  userId: number
  profileId?: string | null
  providerUserId?: string | null
  runAfter?: string | null
}): Promise<GarminImportJobRecord | null> {
  const supabase = createAdminClient()
  const dedupeSourceActivityId = `backfill:${params.userId}`
  const { data: existingJob, error: existingJobError } = await supabase
    .from('garmin_import_jobs')
    .select('*')
    .eq('user_id', params.userId)
    .eq('job_type', 'backfill')
    .eq('source_activity_id', dedupeSourceActivityId)
    .in('status', ['pending', 'retry', 'running'])
    .maybeSingle()

  if (existingJobError) {
    throw new Error(`Failed to query existing Garmin backfill job: ${existingJobError.message}`)
  }
  if (existingJob) {
    return existingJob as GarminImportJobRecord
  }

  const { data, error } = await supabase
    .from('garmin_import_jobs')
    .insert({
      user_id: params.userId,
      profile_id: params.profileId ?? null,
      provider_user_id: params.providerUserId ?? null,
      source_activity_id: dedupeSourceActivityId,
      job_type: 'backfill',
      status: 'pending',
      priority: 100,
      run_after: params.runAfter ?? new Date().toISOString(),
      payload: {
        lookbackDays: BACKFILL_LOOKBACK_DAYS,
      },
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to enqueue Garmin backfill job: ${error.message}`)
  }

  return data as GarminImportJobRecord
}

async function claimGarminImportJobs(limit: number, workerId: string): Promise<GarminImportJobRecord[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('claim_garmin_import_jobs', {
    p_limit: limit,
    p_worker_id: workerId,
  })

  if (error) {
    throw new Error(`Failed to claim Garmin import jobs: ${error.message}`)
  }

  return (data ?? []) as GarminImportJobRecord[]
}

async function markJobSuccess(jobId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('garmin_import_jobs')
    .update({
      status: 'success',
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  if (error) {
    throw new Error(`Failed to mark Garmin job success: ${error.message}`)
  }
}

async function markWebhookEventProcessed(eventId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from('garmin_webhook_events')
    .update({
      status: 'processed',
      processed_at: new Date().toISOString(),
    })
    .eq('id', eventId)
}

async function requeueJob(job: GarminImportJobRecord, errorMessage: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.rpc('requeue_garmin_import_job', {
    p_job_id: job.id,
    p_last_error: errorMessage,
    p_run_after: new Date(Date.now() + backoffSeconds(job.attempt_count) * 1000).toISOString(),
  })

  if (error) {
    throw new Error(`Failed to requeue Garmin job: ${error.message}`)
  }

  logger.warn('[garmin] metric=job_retry', { job_id: job.id, error: errorMessage })
}

async function failJob(job: GarminImportJobRecord, errorMessage: string, deadLetter = false): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.rpc('fail_garmin_import_job', {
    p_job_id: job.id,
    p_last_error: errorMessage,
    p_dead_letter: deadLetter,
  })

  if (error) {
    throw new Error(`Failed to fail Garmin job: ${error.message}`)
  }

  if (job.webhook_event_id) {
    await supabase
      .from('garmin_webhook_events')
      .update({
        status: 'failed',
        error_message: errorMessage,
      })
      .eq('id', job.webhook_event_id)
  }

  logger.error('[garmin] metric=job_failed', { job_id: job.id, error: errorMessage, dead_letter: deadLetter })
}

async function resolveConnectionForJob(job: GarminImportJobRecord): Promise<GarminOAuthConnection> {
  if (job.user_id != null) {
    const state = await getGarminOAuthState(job.user_id)
    if (state) {
      return {
        userId: state.userId,
        authUserId: state.authUserId,
        profileId: state.profileId,
        providerUserId: state.providerUserId ?? state.garminUserId,
        scopes: state.scopes,
        status: state.status,
        connectedAt: state.connectedAt,
        lastSyncAt: state.lastSyncAt,
        lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
        lastSyncError: state.lastSyncError,
        lastWebhookReceivedAt: state.lastWebhookReceivedAt,
      }
    }
  }

  if (job.provider_user_id) {
    const state = await getGarminConnectionByProviderUserId(job.provider_user_id)
    if (state) {
      return {
        userId: state.userId,
        authUserId: state.authUserId,
        profileId: state.profileId,
        providerUserId: state.providerUserId ?? state.garminUserId,
        scopes: state.scopes,
        status: state.status,
        connectedAt: state.connectedAt,
        lastSyncAt: state.lastSyncAt,
        lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
        lastSyncError: state.lastSyncError,
        lastWebhookReceivedAt: state.lastWebhookReceivedAt,
      }
    }
  }

  throw buildGarminServiceError({
    type: 'auth_error',
    message: 'Garmin connection could not be resolved for job',
  })
}

async function processActivityImportJob(job: GarminImportJobRecord, connection: GarminOAuthConnection) {
  const payload = asRecord(job.payload)
  const datasetKey = (getString(payload.datasetKey) ?? 'activities') as GarminDatasetKey
  const row = asRecord(payload.row)
  const callbackUrl = getString(payload.callbackUrl)
  const client = await GarminClient.forUser(connection.userId)

  const activities = callbackUrl
    ? await client.fetchActivitiesFromCallbackUrl({
        callbackUrl,
        datasetKey,
        sourcePayloadRef: job.webhook_event_id ? `garmin_webhook_events:${job.webhook_event_id}` : null,
      })
    : (() => {
        const normalized = mapGarminPayloadToNormalizedActivity(row, {
          sourceExternalId: getString(row.summaryId),
          sourcePayloadRef: job.webhook_event_id ? `garmin_webhook_events:${job.webhook_event_id}` : null,
        })
        return normalized ? [normalized] : []
      })()

  let imported = 0
  let duplicates = 0

  for (const activity of activities) {
    if (job.source_activity_id && activity.activityId !== job.source_activity_id) continue

    const result = await importGarminActivity({
      connection,
      activity,
      webhookEventId: job.webhook_event_id,
    })

    if (result.imported) {
      imported += 1
      logger.info('[garmin] metric=import_upserted', {
        job_id: job.id,
        source_activity_id: activity.activityId,
      })
    } else if (result.duplicate) {
      duplicates += 1
      logger.info('[garmin] metric=import_skipped_duplicate', {
        job_id: job.id,
        source_activity_id: activity.activityId,
      })
    }
  }

  return { imported, duplicates }
}

async function processBackfillJob(job: GarminImportJobRecord, connection: GarminOAuthConnection) {
  const payload = asRecord(job.payload)
  const lookbackDays = getNumber(payload.lookbackDays) ?? BACKFILL_LOOKBACK_DAYS
  const sinceIso = getString(payload.sinceIso)
  const now = new Date()
  const start = sinceIso
    ? new Date(sinceIso)
    : new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000)

  const client = await GarminClient.forUser(connection.userId)
  const activities = await client.fetchActivitiesInRange({
    startTimeInSeconds: Math.floor(start.getTime() / 1000),
    endTimeInSeconds: Math.floor(now.getTime() / 1000),
    mode: 'backfill',
    sourcePayloadRef: `garmin_import_jobs:${job.id}`,
  })

  let imported = 0
  let duplicates = 0

  for (const activity of activities) {
    const result = await importGarminActivity({
      connection,
      activity,
    })
    if (result.imported) imported += 1
    else if (result.duplicate) duplicates += 1
  }

  return { imported, duplicates }
}

export async function processGarminImportJob(job: GarminImportJobRecord): Promise<{
  imported: number
  duplicates: number
}> {
  const connection = await resolveConnectionForJob(job)

  if (connection.status === 'reauth_required' || connection.status === 'revoked' || connection.status === 'disconnected') {
    throw buildGarminServiceError({
      type: 'auth_error',
      message: 'Garmin connection requires reauthentication',
    })
  }

  const result = job.job_type === 'backfill'
    ? await processBackfillJob(job, connection)
    : await processActivityImportJob(job, connection)

  const nowIso = new Date().toISOString()
  await upsertGarminConnection({
    userId: connection.userId,
    profileId: connection.profileId,
    providerUserId: connection.providerUserId,
    status: 'connected',
    lastSyncAt: nowIso,
    lastSuccessfulSyncAt: nowIso,
    lastSyncError: null,
    errorState: null,
  })

  return result
}

export async function processPendingGarminJobs(params?: {
  limit?: number
  workerId?: string
}): Promise<{
  claimed: number
  succeeded: number
  retried: number
  failed: number
  deadLettered: number
  imported: number
  duplicates: number
}> {
  const limit = Math.max(1, params?.limit ?? 10)
  const workerId = params?.workerId ?? 'garmin-worker'
  const jobs = await claimGarminImportJobs(limit, workerId)

  let succeeded = 0
  let retried = 0
  let failed = 0
  let deadLettered = 0
  let imported = 0
  let duplicates = 0

  for (const job of jobs) {
    try {
      const result = await processGarminImportJob(job)
      imported += result.imported
      duplicates += result.duplicates
      await markJobSuccess(job.id)
      if (job.webhook_event_id) {
        await markWebhookEventProcessed(job.webhook_event_id)
      }
      logger.info('[garmin] metric=job_success', { job_id: job.id, imported: result.imported })
      succeeded += 1
    } catch (error) {
      const errorMessage = serializeError(error)

      if (isGarminServiceError(error) && error.type === 'auth_error' && job.user_id != null) {
        await markGarminAuthError(job.user_id, errorMessage)
      }

      if (isRetryableError(error) && job.attempt_count < 5) {
        await requeueJob(job, errorMessage)
        retried += 1
      } else {
        const shouldDeadLetter = job.attempt_count >= 5
        await failJob(job, errorMessage, shouldDeadLetter)
        if (shouldDeadLetter) deadLettered += 1
        else failed += 1
      }
    }
  }

  return {
    claimed: jobs.length,
    succeeded,
    retried,
    failed,
    deadLettered,
    imported,
    duplicates,
  }
}

export async function requeueGarminJob(jobId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('garmin_import_jobs')
    .update({
      status: 'pending',
      run_after: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  if (error) {
    throw new Error(`Failed to replay Garmin job ${jobId}: ${error.message}`)
  }
}

export async function getGarminSyncState(userId: number): Promise<{
  connected: boolean
  connectionStatus: string
  syncState: GarminSyncTrustState
  lastSyncAt: string | null
  lastSuccessfulSyncAt: string | null
  lastWebhookReceivedAt: string | null
  pendingJobs: number
  lastSyncError: string | null
  errorState: Record<string, unknown> | null
}> {
  const connection = await getGarminOAuthState(userId)
  if (!connection) {
    return {
      connected: false,
      connectionStatus: 'disconnected',
      syncState: 'disconnected',
      lastSyncAt: null,
      lastSuccessfulSyncAt: null,
      lastWebhookReceivedAt: null,
      pendingJobs: 0,
      lastSyncError: null,
      errorState: null,
    }
  }

  const supabase = createAdminClient()
  const [{ count: pendingJobs }, { count: garminRunCount }] = await Promise.all([
    supabase
      .from('garmin_import_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['pending', 'retry', 'running']),
    connection.profileId
      ? supabase
          .from('runs')
          .select('*', { count: 'exact', head: true })
          .eq('profile_id', connection.profileId)
          .eq('source_provider', 'garmin')
      : Promise.resolve({ count: 0, error: null }),
  ])

  let syncState: GarminSyncTrustState = 'connected'
  const now = Date.now()
  const lastSuccessfulSyncMs = connection.lastSuccessfulSyncAt ? Date.parse(connection.lastSuccessfulSyncAt) : null
  const lastWebhookMs = connection.lastWebhookReceivedAt ? Date.parse(connection.lastWebhookReceivedAt) : null

  if (connection.status === 'reauth_required' || connection.status === 'error' || connection.status === 'revoked') {
    syncState = 'reauth_required'
  } else if ((pendingJobs ?? 0) > 0) {
    syncState = 'syncing'
  } else if ((garminRunCount ?? 0) === 0) {
    syncState = 'waiting_for_first_activity'
  } else if (
    (lastWebhookMs != null && (lastSuccessfulSyncMs == null || lastWebhookMs - lastSuccessfulSyncMs > DELAYED_SYNC_THRESHOLD_MS)) ||
    (lastSuccessfulSyncMs != null && now - lastSuccessfulSyncMs > HEALTHY_SYNC_THRESHOLD_MS)
  ) {
    syncState = 'delayed'
  }

  return {
    connected: connection.status === 'connected',
    connectionStatus: connection.status,
    syncState,
    lastSyncAt: connection.lastSyncAt,
    lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt,
    lastWebhookReceivedAt: connection.lastWebhookReceivedAt,
    pendingJobs: pendingJobs ?? 0,
    lastSyncError: connection.lastSyncError,
    errorState: connection.errorState,
  }
}
