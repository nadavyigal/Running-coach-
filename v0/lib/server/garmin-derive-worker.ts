import 'server-only'

import { Worker, type Job } from 'bullmq'
import { computeGarminAcwrMetrics } from '@/lib/garminAcwr'
import { extractGarminBodyBatteryTimeseries } from '@/lib/garminBodyBattery'
import { computeGarminReadiness } from '@/lib/garminReadinessComputer'
import { extractGarminWellnessDays, type GarminDailyMetricsRow } from '@/lib/garminWellnessExtractor'
import { logger } from '@/lib/logger'
import { downloadFitFile, parseFitBuffer } from '@/lib/server/garmin-fit-processor'
import { findRunSmartUserIdsByGarminUserId, getGarminOAuthState, getValidGarminAccessToken } from '@/lib/server/garmin-oauth-store'
import {
  enqueueAiInsightsJob,
  type GarminDeriveJobPayload,
} from '@/lib/server/garmin-sync-queue'
import { createAdminClient } from '@/lib/supabase/admin'

type QueueConnection = {
  host: string
  port: number
  password?: string
  tls?: Record<string, never>
}

interface GarminActivityRow {
  activity_id: string | null
  start_time: string | null
  duration_s: number | null
  avg_hr: number | null
  distance_m: number | null
}

export interface GarminDeriveRunSummary {
  userId: number
  date: string
  acwr: number | null
  readinessScore: number
  confidence: 'high' | 'medium' | 'low'
  flags: string[]
  aiInsightsQueued: boolean
}

export interface GarminDeriveJobResult {
  processedUsers: number
  skippedUsers: number
  summaries: GarminDeriveRunSummary[]
}

const WINDOW_DAYS = 28
const DEFAULT_ACWR_THRESHOLD_HR = 170
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

function parseRedisConnection(): QueueConnection | null {
  const redisUrl = process.env.REDIS_URL?.trim()
  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl)
      const port = Number.parseInt(parsed.port || '6379', 10)
      const connection: QueueConnection = {
        host: parsed.hostname,
        port: Number.isFinite(port) ? port : 6379,
      }
      if (parsed.password) connection.password = parsed.password
      if (parsed.protocol === 'rediss:') connection.tls = {}
      return connection
    } catch (error) {
      logger.warn('Failed to parse REDIS_URL for Garmin derive worker:', error)
      return null
    }
  }

  const host = process.env.REDIS_HOST?.trim()
  if (!host) return null

  const portValue = process.env.REDIS_PORT?.trim()
  const parsedPort = portValue ? Number.parseInt(portValue, 10) : 6379
  const connection: QueueConnection = {
    host,
    port: Number.isFinite(parsedPort) ? parsedPort : 6379,
  }
  const password = process.env.REDIS_PASSWORD?.trim()
  if (password) connection.password = password
  if (process.env.REDIS_TLS === 'true') connection.tls = {}
  return connection
}

function shiftIsoDate(dateIso: string, deltaDays: number): string {
  const parsed = Date.parse(`${dateIso}T00:00:00.000Z`)
  return new Date(parsed + deltaDays * MILLISECONDS_PER_DAY).toISOString().slice(0, 10)
}

function parseThresholdHeartRate(): number {
  const raw = process.env.GARMIN_ACWR_THRESHOLD_HR?.trim()
  const parsed = raw ? Number(raw) : NaN
  if (Number.isFinite(parsed) && parsed > 0) return parsed
  return DEFAULT_ACWR_THRESHOLD_HR
}

async function resolveTargetUsers(payload: GarminDeriveJobPayload): Promise<number[]> {
  if (payload.userId != null) return [payload.userId]
  if (payload.garminUserId) {
    return findRunSmartUserIdsByGarminUserId(payload.garminUserId)
  }
  return []
}

async function fetchGarminWindowData(params: {
  userId: number
  endDate: string
}): Promise<{
  activities: GarminActivityRow[]
  dailyRows: GarminDailyMetricsRow[]
}> {
  const { userId, endDate } = params
  const startDate = shiftIsoDate(endDate, -(WINDOW_DAYS - 1))
  const startDateIso = `${startDate}T00:00:00.000Z`
  const endDateIso = `${endDate}T23:59:59.999Z`

  const supabase = createAdminClient()
  const [activitiesQuery, dailyQuery] = await Promise.all([
    supabase
      .from('garmin_activities')
      .select('activity_id,start_time,duration_s,avg_hr,distance_m')
      .eq('user_id', userId)
      .gte('start_time', startDateIso)
      .lte('start_time', endDateIso),
    supabase
      .from('garmin_daily_metrics')
      .select('date,body_battery,hrv,sleep_score,resting_hr,stress,raw_json')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true }),
  ])

  if (activitiesQuery.error) {
    throw new Error(`Failed to fetch garmin_activities: ${activitiesQuery.error.message}`)
  }
  if (dailyQuery.error) {
    throw new Error(`Failed to fetch garmin_daily_metrics: ${dailyQuery.error.message}`)
  }

  return {
    activities: ((activitiesQuery.data ?? []) as GarminActivityRow[]).filter((row) => row.start_time != null),
    dailyRows: (dailyQuery.data ?? []) as GarminDailyMetricsRow[],
  }
}

async function computeAndPersistForUser(params: {
  userId: number
  payload: GarminDeriveJobPayload
}): Promise<GarminDeriveRunSummary> {
  const { userId, payload } = params
  const nowIso = new Date().toISOString()
  const dateIso = nowIso.slice(0, 10)
  const thresholdHeartRate = parseThresholdHeartRate()

  const { activities, dailyRows } = await fetchGarminWindowData({
    userId,
    endDate: dateIso,
  })

  const acwr = computeGarminAcwrMetrics({
    endDate: dateIso,
    thresholdHeartRate,
    activities: activities.map((activity) => ({
      startTime: activity.start_time ?? dateIso,
      durationSeconds: activity.duration_s,
      averageHeartRate: activity.avg_hr,
      distanceMeters: activity.distance_m,
    })),
  })

  const wellnessDays = extractGarminWellnessDays(dailyRows)
  const readiness = computeGarminReadiness({
    endDate: dateIso,
    days: wellnessDays.map((day) => ({
      date: day.date,
      hrv: day.hrv,
      sleepScore: day.sleepScore,
      restingHr: day.restingHr,
      stress: day.stress,
    })),
  })
  const bodyBatterySeries = extractGarminBodyBatteryTimeseries(dailyRows)

  let authUserId: string | null = null
  try {
    const oauthState = await getGarminOAuthState(userId)
    authUserId = oauthState?.authUserId ?? null
  } catch (error) {
    logger.warn(`Unable to read Garmin OAuth state for user ${userId}:`, error)
  }

  const combinedConfidence =
    acwr.evidence.confidence === 'low' || readiness.confidence === 'low'
      ? 'low'
      : acwr.evidence.confidence === 'medium' || readiness.confidence === 'medium'
        ? 'medium'
        : 'high'

  const combinedFlags = Array.from(new Set([...acwr.flags, ...readiness.flags]))
  const flagsJson = {
    source: payload.source,
    datasetKey: payload.datasetKey ?? null,
    generatedAt: nowIso,
    confidence: combinedConfidence,
    acwr: {
      acuteLoad7d: acwr.acuteLoad7d,
      chronicLoad28d: acwr.chronicLoad28d,
      acwr: acwr.acwr,
      monotony7d: acwr.monotony7d,
      strain7d: acwr.strain7d,
      zone: acwr.zone,
      evidence: acwr.evidence,
      flags: acwr.flags,
      insight: acwr.insight,
      disclaimer: acwr.disclaimer,
    },
    readiness: {
      score: readiness.score,
      label: readiness.label,
      confidence: readiness.confidence,
      evidence: readiness.evidence,
      flags: readiness.flags,
      components: readiness.components,
      userExplanation: readiness.userExplanation,
      insight: readiness.insight,
      disclaimer: readiness.disclaimer,
    },
    bodyBattery: {
      sampleCount: bodyBatterySeries.length,
      latestSample: bodyBatterySeries.length > 0 ? bodyBatterySeries[bodyBatterySeries.length - 1] : null,
    },
    flags: combinedFlags,
  }

  const supabase = createAdminClient()
  const { error: upsertError } = await supabase.from('training_derived_metrics').upsert(
    {
      user_id: userId,
      auth_user_id: authUserId,
      date: dateIso,
      acute_load_7d: acwr.acuteLoad7d,
      chronic_load_28d: acwr.chronicLoad28d,
      acwr: acwr.acwr,
      monotony_7d: acwr.monotony7d,
      strain_7d: acwr.strain7d,
      weekly_volume_m: acwr.weeklyVolumeMeters7d,
      // Temporary storage for readiness until schema adds a dedicated readiness_score column.
      weekly_intensity_score: readiness.score,
      flags_json: flagsJson,
      updated_at: nowIso,
    },
    { onConflict: 'user_id,date' }
  )

  if (upsertError) {
    throw new Error(`Failed to upsert training_derived_metrics: ${upsertError.message}`)
  }

  const dailyInsightQueueResult = await enqueueAiInsightsJob({
    userId,
    insightType: 'daily',
    requestedAt: nowIso,
    derivedSummary: {
      acwr: acwr.acwr,
      readinessScore: readiness.score,
      readinessLabel: readiness.label,
      confidence: combinedConfidence,
      flags: combinedFlags,
    },
  })

  if (!dailyInsightQueueResult.queued) {
    logger.warn(
      `Garmin derive worker could not enqueue ai-insights job for user ${userId}: ${
        dailyInsightQueueResult.reason ?? 'unknown error'
      }`
    )
  }

  const todayUtcDay = new Date(`${dateIso}T00:00:00.000Z`).getUTCDay()
  if (todayUtcDay === 0) {
    const weeklyQueueResult = await enqueueAiInsightsJob({
      userId,
      insightType: 'weekly',
      requestedAt: nowIso,
      derivedSummary: {
        acwr: acwr.acwr,
        readinessScore: readiness.score,
        readinessLabel: readiness.label,
        confidence: combinedConfidence,
        flags: combinedFlags,
      },
    })
    if (!weeklyQueueResult.queued) {
      logger.warn(
        `Garmin derive worker could not enqueue weekly ai-insight for user ${userId}: ${
          weeklyQueueResult.reason ?? 'unknown error'
        }`
      )
    }
  }

  const latestActivity = activities
    .filter((activity) => activity.start_time != null)
    .sort((a, b) => {
      const aMs = Date.parse(a.start_time ?? '')
      const bMs = Date.parse(b.start_time ?? '')
      return bMs - aMs
    })[0]

  if (latestActivity?.start_time) {
    const postRunQueueResult = await enqueueAiInsightsJob({
      userId,
      insightType: 'post_run',
      requestedAt: nowIso,
      activityId: latestActivity.activity_id,
      activityDate: latestActivity.start_time.slice(0, 10),
      derivedSummary: {
        acwr: acwr.acwr,
        readinessScore: readiness.score,
        readinessLabel: readiness.label,
        confidence: combinedConfidence,
        flags: combinedFlags,
      },
    })

    if (!postRunQueueResult.queued) {
      logger.warn(
        `Garmin derive worker could not enqueue post-run ai-insight for user ${userId}: ${
          postRunQueueResult.reason ?? 'unknown error'
        }`
      )
    }
  }

  return {
    userId,
    date: dateIso,
    acwr: acwr.acwr,
    readinessScore: readiness.score,
    confidence: combinedConfidence,
    flags: combinedFlags,
    aiInsightsQueued: dailyInsightQueueResult.queued,
  }
}

// ─── Activity Files (FIT binary) processor ───────────────────────────────────

async function processActivityFilesForUser(userId: number): Promise<void> {
  const supabase = createAdminClient()

  const { data: pendingFiles, error: fetchError } = await supabase
    .from('garmin_activity_files')
    .select('id, activity_id, summary_id, callback_url, start_time_seconds')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(5)

  if (fetchError) {
    logger.warn(`FIT processor: failed to fetch pending files for user ${userId}:`, fetchError)
    return
  }

  if (!pendingFiles || pendingFiles.length === 0) return

  let accessToken: string
  try {
    accessToken = await getValidGarminAccessToken(userId)
  } catch (err) {
    logger.error(`FIT processor: cannot get access token for user ${userId}:`, err)
    return
  }

  const nowIso = new Date().toISOString()

  for (const fileRow of pendingFiles) {
    // Mark as downloading to prevent double-processing
    await supabase
      .from('garmin_activity_files')
      .update({ status: 'downloading' })
      .eq('id', fileRow.id)

    try {
      // 1. Download binary FIT file from Garmin Activity API
      const fitBuffer = await downloadFitFile(fileRow.callback_url, accessToken)

      // 2. Parse FIT → structured activity data
      const parsed = await parseFitBuffer(fitBuffer)
      const { session, laps, kmSplits, records } = parsed

      // 3. Store raw FIT binary in Supabase Storage
      const fitPath = `${userId}/${fileRow.activity_id}.fit`
      const { error: storageError } = await supabase.storage
        .from('garmin-fit-files')
        .upload(fitPath, fitBuffer, {
          upsert: true,
          contentType: 'application/octet-stream',
        })

      if (storageError) {
        // Non-fatal: log but continue with DB enrichment
        logger.warn(`FIT processor: storage upload failed for ${fitPath}:`, storageError)
      }

      // 4. UPSERT garmin_activities with enriched FIT data
      const { error: activityError } = await supabase
        .from('garmin_activities')
        .upsert(
          {
            user_id: userId,
            activity_id: fileRow.activity_id,
            sport: session.sportType,
            start_time: session.startTime,
            duration_s: session.totalElapsedS != null ? Math.round(session.totalElapsedS) : null,
            distance_m: session.totalDistanceM,
            avg_hr: session.avgHeartRate,
            max_hr: session.maxHeartRate,
            avg_cadence_spm: session.avgCadenceSpm,
            elevation_gain_m: session.totalAscent,
            elevation_loss_m: session.totalDescent,
            calories: session.totalCalories,
            max_speed_mps: session.maxSpeedMps,
            lap_summaries: laps,
            split_summaries: kmSplits,
            telemetry_json: {
              records,            // per-5s timeseries: HR, cadence, speed, altitude, GPS
              lapCount: laps.length,
              splitCount: kmSplits.length,
            },
            fit_parsed_at: nowIso,
            source: 'garmin_activity_file',
            updated_at: nowIso,
          },
          { onConflict: 'user_id,activity_id' }
        )

      if (activityError) {
        throw new Error(`garmin_activities upsert failed: ${activityError.message}`)
      }

      // 5. Mark file record as done
      await supabase
        .from('garmin_activity_files')
        .update({
          status: 'done',
          fit_file_path: fitPath,
          downloaded_at: nowIso,
          parsed_at: nowIso,
        })
        .eq('id', fileRow.id)

      // 6. Enqueue post-run AI insight using the enriched FIT data
      const activityDate = session.startTime
        ? session.startTime.slice(0, 10)
        : new Date((fileRow.start_time_seconds ?? 0) * 1000).toISOString().slice(0, 10)

      const insightResult = await enqueueAiInsightsJob({
        userId,
        insightType: 'post_run',
        activityId: fileRow.activity_id,
        activityDate,
        requestedAt: nowIso,
      })

      logger.info(
        `FIT processor: enriched activity ${fileRow.activity_id} for user ${userId}` +
          ` (${laps.length} laps, ${kmSplits.length} km splits, ${records.length} records)` +
          ` — insight queued: ${insightResult.queued}`
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      logger.error(`FIT processor: failed for activity ${fileRow.activity_id}, user ${userId}:`, err)
      await supabase
        .from('garmin_activity_files')
        .update({ status: 'error', error_message: errorMessage })
        .eq('id', fileRow.id)
    }
  }
}

export async function runGarminDeriveForPayload(payload: GarminDeriveJobPayload): Promise<GarminDeriveJobResult> {
  const userIds = await resolveTargetUsers(payload)
  if (userIds.length === 0) {
    logger.warn('Garmin derive worker received payload with no resolvable users:', payload)
    return {
      processedUsers: 0,
      skippedUsers: 0,
      summaries: [],
    }
  }

  // Activity Files (FIT binary) — separate pipeline from ACWR/readiness derive
  if (payload.datasetKey === 'activityFiles') {
    for (const userId of userIds) {
      try {
        await processActivityFilesForUser(userId)
      } catch (err) {
        logger.error(`FIT processor: unexpected error for user ${userId}:`, err)
      }
    }
    return {
      processedUsers: userIds.length,
      skippedUsers: 0,
      summaries: [],
    }
  }

  const summaries: GarminDeriveRunSummary[] = []
  let skippedUsers = 0

  for (const userId of userIds) {
    try {
      const summary = await computeAndPersistForUser({
        userId,
        payload,
      })
      summaries.push(summary)
    } catch (error) {
      skippedUsers += 1
      logger.error(`Garmin derive failed for user ${userId}:`, error)
    }
  }

  return {
    processedUsers: summaries.length,
    skippedUsers,
    summaries,
  }
}

export async function processGarminDeriveJob(job: Job<GarminDeriveJobPayload>): Promise<GarminDeriveJobResult> {
  logger.info('Processing Garmin derive job', {
    jobId: job.id,
    payload: job.data,
  })
  return runGarminDeriveForPayload(job.data)
}

export function createGarminDeriveWorker(params?: {
  concurrency?: number
}): Worker<GarminDeriveJobPayload> | null {
  const connection = parseRedisConnection()
  if (!connection) {
    logger.warn('Garmin derive worker not started because Redis is not configured')
    return null
  }

  const worker = new Worker<GarminDeriveJobPayload>('garmin-derive-metrics', processGarminDeriveJob, {
    connection,
    concurrency: Math.max(1, params?.concurrency ?? 2),
  })

  worker.on('completed', (job) => {
    logger.info('Garmin derive worker completed job', { jobId: job.id })
  })

  worker.on('failed', (job, error) => {
    logger.error('Garmin derive worker failed job', {
      jobId: job?.id,
      error: error.message,
    })
  })

  return worker
}

