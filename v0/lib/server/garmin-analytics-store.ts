import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { getGarminOAuthState } from '@/lib/server/garmin-oauth-store'
import type { GarminDatasetKey } from '@/lib/server/garmin-export-store'

interface GarminSyncActivity {
  activityId: string | null
  activityName: string
  activityType: string
  startTimeGMT: string | null
  distance: number
  duration: number
  averageHR: number | null
  maxHR: number | null
  calories: number | null
  averagePace: number | null
  elevationGain: number | null
}

interface GarminSyncSleepRecord {
  date: string
  totalSleepSeconds: number | null
  sleepScores: {
    overall?: {
      value?: number
    }
  } | null
}

export interface PersistGarminSyncInput {
  userId: number
  activities: GarminSyncActivity[]
  sleep: GarminSyncSleepRecord[]
  datasets: Record<GarminDatasetKey, Record<string, unknown>[]>
}

export interface PersistGarminSyncResult {
  activitiesUpserted: number
  dailyMetricsUpserted: number
}

interface DailyMetricAccumulator {
  date: string
  steps: number | null
  sleepScore: number | null
  sleepDurationS: number | null
  hrv: number | null
  restingHr: number | null
  stress: number | null
  bodyBattery: number | null
  trainingReadiness: number | null
  vo2max: number | null
  weight: number | null
  rawJson: Record<string, unknown>
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function getDateString(value: unknown): string | null {
  const raw = getString(value)
  if (!raw) return null

  const dateOnlyMatch = raw.match(/^\d{4}-\d{2}-\d{2}$/)
  if (dateOnlyMatch) return raw

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function getDateFromEpochSeconds(value: unknown): string | null {
  const seconds = getNumber(value)
  if (seconds == null) return null
  const parsed = new Date(seconds * 1000)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = getNumber(record[key])
    if (value != null) return value
  }
  return null
}

function pickNestedNumber(record: Record<string, unknown>, paths: string[][]): number | null {
  for (const path of paths) {
    let current: unknown = record
    for (const key of path) {
      if (!current || typeof current !== 'object') {
        current = null
        break
      }
      current = (current as Record<string, unknown>)[key]
    }
    const value = getNumber(current)
    if (value != null) return value
  }
  return null
}

function normalizeWeightKg(value: number | null): number | null {
  if (value == null) return null
  if (value > 250) return Number((value / 1000).toFixed(2))
  return Number(value.toFixed(2))
}

function getOrCreateDailyMetric(map: Map<string, DailyMetricAccumulator>, date: string): DailyMetricAccumulator {
  const existing = map.get(date)
  if (existing) return existing

  const created: DailyMetricAccumulator = {
    date,
    steps: null,
    sleepScore: null,
    sleepDurationS: null,
    hrv: null,
    restingHr: null,
    stress: null,
    bodyBattery: null,
    trainingReadiness: null,
    vo2max: null,
    weight: null,
    rawJson: {},
  }

  map.set(date, created)
  return created
}

function addRawDataset(
  metric: DailyMetricAccumulator,
  datasetKey: GarminDatasetKey,
  payload: Record<string, unknown>
): void {
  const existing = metric.rawJson[datasetKey]
  if (Array.isArray(existing)) {
    metric.rawJson[datasetKey] = [...existing, payload]
    return
  }
  metric.rawJson[datasetKey] = [payload]
}

function buildDailyMetricsRows(input: {
  datasets: Record<GarminDatasetKey, Record<string, unknown>[]>
  sleep: GarminSyncSleepRecord[]
}): DailyMetricAccumulator[] {
  const { datasets, sleep } = input
  const byDate = new Map<string, DailyMetricAccumulator>()

  for (const entry of sleep) {
    const date = getDateString(entry.date)
    if (!date) continue

    const metric = getOrCreateDailyMetric(byDate, date)
    metric.sleepDurationS = entry.totalSleepSeconds ?? metric.sleepDurationS
    const score = getNumber(entry.sleepScores?.overall?.value)
    metric.sleepScore = score ?? metric.sleepScore
  }

  for (const sleepRecord of datasets.sleeps ?? []) {
    const date =
      getDateString(sleepRecord.calendarDate) ??
      getDateString(sleepRecord.date) ??
      getDateFromEpochSeconds(sleepRecord.startTimeInSeconds)
    if (!date) continue

    const metric = getOrCreateDailyMetric(byDate, date)
    metric.sleepDurationS =
      pickNumber(sleepRecord, ['durationInSeconds', 'totalSleepSeconds']) ?? metric.sleepDurationS
    metric.sleepScore =
      pickNumber(sleepRecord, ['overallSleepScore', 'sleepScore']) ??
      pickNestedNumber(sleepRecord, [['sleepScores', 'overall', 'value']]) ??
      metric.sleepScore
    addRawDataset(metric, 'sleeps', sleepRecord)
  }

  for (const daily of datasets.dailies ?? []) {
    const date =
      getDateString(daily.calendarDate) ??
      getDateString(daily.date) ??
      getDateFromEpochSeconds(daily.startTimeInSeconds)
    if (!date) continue

    const metric = getOrCreateDailyMetric(byDate, date)
    metric.steps = pickNumber(daily, ['steps', 'totalSteps', 'stepsCount']) ?? metric.steps
    metric.restingHr =
      pickNumber(daily, ['restingHeartRateInBeatsPerMinute', 'restingHeartRate', 'restingHeartRateBpm']) ??
      metric.restingHr
    metric.stress =
      pickNumber(daily, ['averageStressLevel', 'stressLevel', 'overallStressLevel']) ?? metric.stress
    metric.bodyBattery = pickNumber(daily, ['bodyBattery', 'bodyBatteryMostRecentValue']) ?? metric.bodyBattery
    metric.trainingReadiness =
      pickNumber(daily, ['trainingReadiness', 'trainingReadinessScore']) ?? metric.trainingReadiness
    addRawDataset(metric, 'dailies', daily)
  }

  for (const metricRow of datasets.userMetrics ?? []) {
    const date =
      getDateString(metricRow.calendarDate) ??
      getDateString(metricRow.measurementDate) ??
      getDateString(metricRow.date)
    if (!date) continue

    const metric = getOrCreateDailyMetric(byDate, date)
    metric.vo2max = pickNumber(metricRow, ['vo2Max', 'vo2max']) ?? metric.vo2max
    metric.weight = normalizeWeightKg(pickNumber(metricRow, ['weight', 'bodyMassInKilograms'])) ?? metric.weight
    addRawDataset(metric, 'userMetrics', metricRow)
  }

  for (const metricRow of datasets.bodyComps ?? []) {
    const date =
      getDateString(metricRow.calendarDate) ??
      getDateString(metricRow.measurementDate) ??
      getDateString(metricRow.date)
    if (!date) continue

    const metric = getOrCreateDailyMetric(byDate, date)
    metric.weight = normalizeWeightKg(pickNumber(metricRow, ['weight', 'bodyMassInGrams', 'bodyMass'])) ?? metric.weight
    addRawDataset(metric, 'bodyComps', metricRow)
  }

  for (const hrv of datasets.hrv ?? []) {
    const date =
      getDateString(hrv.calendarDate) ??
      getDateString(hrv.date) ??
      getDateFromEpochSeconds(hrv.startTimeInSeconds)
    if (!date) continue

    const metric = getOrCreateDailyMetric(byDate, date)
    metric.hrv = pickNumber(hrv, ['hrvValue', 'value', 'dailyAvg', 'lastNightAvg']) ?? metric.hrv
    addRawDataset(metric, 'hrv', hrv)
  }

  for (const stressDetail of datasets.stressDetails ?? []) {
    const date =
      getDateString(stressDetail.calendarDate) ??
      getDateString(stressDetail.date) ??
      getDateFromEpochSeconds(stressDetail.startTimeInSeconds)
    if (!date) continue

    const metric = getOrCreateDailyMetric(byDate, date)
    metric.stress =
      pickNumber(stressDetail, ['stressLevel', 'averageStressLevel', 'stressLevelValue']) ?? metric.stress
    addRawDataset(metric, 'stressDetails', stressDetail)
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function dedupeByKey<T>(items: T[], keySelector: (item: T) => string): T[] {
  const deduped = new Map<string, T>()
  for (const item of items) {
    deduped.set(keySelector(item), item)
  }
  return Array.from(deduped.values())
}

export async function persistGarminSyncSnapshot(input: PersistGarminSyncInput): Promise<PersistGarminSyncResult> {
  const { userId, activities, sleep, datasets } = input

  const supabase = createAdminClient()
  const oauthState = await getGarminOAuthState(userId)
  const authUserId = oauthState?.authUserId ?? null
  const nowIso = new Date().toISOString()

  const activityRows = dedupeByKey(
    activities
    .filter((activity) => typeof activity.activityId === 'string' && activity.activityId.length > 0)
    .map((activity) => ({
      user_id: userId,
      auth_user_id: authUserId,
      activity_id: String(activity.activityId),
      start_time: activity.startTimeGMT,
      sport: activity.activityType,
      duration_s: Number.isFinite(activity.duration) ? Math.round(activity.duration) : null,
      distance_m: Number.isFinite(activity.distance) ? Number((activity.distance * 1000).toFixed(2)) : null,
      avg_hr: activity.averageHR,
      max_hr: activity.maxHR,
      avg_pace: activity.averagePace,
      elevation_gain_m: activity.elevationGain,
      calories: activity.calories,
      source: 'garmin_sync',
      raw_json: activity,
      updated_at: nowIso,
    })),
    (row) => `${row.user_id}:${row.activity_id}`
  )

  const dailyRows = dedupeByKey(
    buildDailyMetricsRows({ datasets, sleep }).map((row) => ({
      user_id: userId,
      auth_user_id: authUserId,
      date: row.date,
      steps: row.steps,
      sleep_score: row.sleepScore,
      sleep_duration_s: row.sleepDurationS,
      hrv: row.hrv,
      resting_hr: row.restingHr,
      stress: row.stress,
      body_battery: row.bodyBattery,
      training_readiness: row.trainingReadiness,
      vo2max: row.vo2max,
      weight: row.weight,
      raw_json: row.rawJson,
      updated_at: nowIso,
    })),
    (row) => `${row.user_id}:${row.date}`
  )

  for (const activityChunk of chunk(activityRows, 500)) {
    if (activityChunk.length === 0) continue
    const { error } = await supabase
      .from('garmin_activities')
      .upsert(activityChunk, { onConflict: 'user_id,activity_id' })
    if (error) {
      throw new Error(`Failed to upsert garmin_activities: ${error.message}`)
    }
  }

  for (const dailyChunk of chunk(dailyRows, 500)) {
    if (dailyChunk.length === 0) continue
    const { error } = await supabase
      .from('garmin_daily_metrics')
      .upsert(dailyChunk, { onConflict: 'user_id,date' })
    if (error) {
      throw new Error(`Failed to upsert garmin_daily_metrics: ${error.message}`)
    }
  }

  return {
    activitiesUpserted: activityRows.length,
    dailyMetricsUpserted: dailyRows.length,
  }
}
