import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { persistGarminSyncSnapshot } from '@/lib/server/garmin-analytics-store'
import { runGarminDeriveForPayload } from '@/lib/server/garmin-derive-worker'
import {
  GARMIN_HISTORY_DAYS,
  type GarminDatasetKey,
  groupRowsByDataset,
  lookbackStartIso,
  readGarminExportRows,
} from '@/lib/server/garmin-export-store'
import {
  getGarminOAuthState,
  getValidGarminAccessToken,
  markGarminAuthError,
  markGarminSyncState,
  refreshGarminAccessToken,
} from '@/lib/server/garmin-oauth-store'
import { evaluateGarminSyncRateLimit } from '@/lib/server/garmin-rate-limiter'
import { enqueueGarminDeriveJob } from '@/lib/server/garmin-sync-queue'
import { captureServerEvent } from '@/lib/server/posthog'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const GARMIN_API_BASE = 'https://apis.garmin.com'
const GARMIN_MAX_WINDOW_SECONDS = 86400
const SYNC_NAME = 'RunSmart Garmin Export Sync'
const DEFAULT_INCREMENTAL_DAYS = 7
const DEFAULT_ACTIVITY_SYNC_DAYS = 7
const BACKFILL_DAILY_DAYS = 56
const BACKFILL_ACTIVITY_DAYS = 56

type GarminPermission = 'ACTIVITY_EXPORT' | 'HEALTH_EXPORT'
type GarminSyncDatasetKey = GarminDatasetKey | 'workoutImport'
export type GarminSyncTrigger = 'manual' | 'incremental' | 'nightly' | 'backfill'

export interface GarminSyncExecutionOptions {
  trigger: GarminSyncTrigger
  enforceRateLimit: boolean
  defaultLookbackDays: number
  activityLookbackDays: number
  sinceIso?: string | null
}

interface GarminDatasetConfig {
  key: GarminDatasetKey
  label: string
  permission: GarminPermission
  description: string
}

interface GarminEnablementItem {
  key: string
  permission: string
  description: string
  supportedByRunSmart: boolean
}

interface GarminDatasetCapability {
  key: GarminSyncDatasetKey
  label: string
  permissionGranted: boolean
  endpointReachable: boolean
  enabledForSync: boolean
  supportedByRunSmart: boolean
  reason?: string
}

interface GarminCatalogResult {
  permissions: string[]
  capabilities: GarminDatasetCapability[]
  datasets: Record<GarminDatasetKey, Record<string, unknown>[]>
  datasetCounts: Record<GarminDatasetKey, number>
  ingestion: {
    lookbackDays: number
    storeAvailable: boolean
    storeError?: string
    recordsInWindow: number
    latestReceivedAt: string | null
  }
}

class GarminUpstreamError extends Error {
  status: number
  body: string
  source: 'permissions' | 'profile'

  constructor(source: 'permissions' | 'profile', status: number, body: string) {
    super(`Garmin ${source} returned ${status}`)
    this.name = 'GarminUpstreamError'
    this.status = status
    this.body = body
    this.source = source
  }
}

class GarminActivitiesFallbackError extends Error {
  status: number
  body: string
  source: 'wellness-upload' | 'wellness-backfill'

  constructor(source: 'wellness-upload' | 'wellness-backfill', status: number, body: string) {
    super(`Garmin ${source} returned ${status}`)
    this.name = 'GarminActivitiesFallbackError'
    this.status = status
    this.body = body
    this.source = source
  }
}

class GarminSleepFallbackError extends Error {
  status: number
  body: string
  source: 'sleep-upload' | 'sleep-backfill'

  constructor(source: 'sleep-upload' | 'sleep-backfill', status: number, body: string) {
    super(`Garmin ${source} returned ${status}`)
    this.name = 'GarminSleepFallbackError'
    this.status = status
    this.body = body
    this.source = source
  }
}

class GarminDailiesFallbackError extends Error {
  status: number
  body: string
  source: 'dailies-upload' | 'dailies-backfill'

  constructor(source: 'dailies-upload' | 'dailies-backfill', status: number, body: string) {
    super(`Garmin ${source} returned ${status}`)
    this.name = 'GarminDailiesFallbackError'
    this.status = status
    this.body = body
    this.source = source
  }
}

const DATASET_CONFIGS: GarminDatasetConfig[] = [
  {
    key: 'activities',
    label: 'Activities',
    permission: 'ACTIVITY_EXPORT',
    description: 'Activity summaries from Garmin Activity API.',
  },
  {
    key: 'manuallyUpdatedActivities',
    label: 'Manually Updated Activities',
    permission: 'ACTIVITY_EXPORT',
    description: 'Manually edited activities from Garmin Activity API.',
  },
  {
    key: 'activityDetails',
    label: 'Activity Details',
    permission: 'ACTIVITY_EXPORT',
    description: 'Detailed activity summaries from Garmin Activity API.',
  },
  {
    key: 'dailies',
    label: 'Dailies',
    permission: 'HEALTH_EXPORT',
    description: 'Daily wellness summaries from Garmin Health API.',
  },
  {
    key: 'epochs',
    label: 'Epochs',
    permission: 'HEALTH_EXPORT',
    description: 'Epoch-level wellness samples from Garmin Health API.',
  },
  {
    key: 'sleeps',
    label: 'Sleeps',
    permission: 'HEALTH_EXPORT',
    description: 'Sleep summaries from Garmin Health API.',
  },
  {
    key: 'bodyComps',
    label: 'Body Comps',
    permission: 'HEALTH_EXPORT',
    description: 'Body composition summaries from Garmin Health API.',
  },
  {
    key: 'stressDetails',
    label: 'Stress Details',
    permission: 'HEALTH_EXPORT',
    description: 'Stress detail summaries from Garmin Health API.',
  },
  {
    key: 'userMetrics',
    label: 'User Metrics',
    permission: 'HEALTH_EXPORT',
    description: 'User metric summaries from Garmin Health API.',
  },
  {
    key: 'pulseox',
    label: 'Pulse Ox',
    permission: 'HEALTH_EXPORT',
    description: 'Pulse ox summaries from Garmin Health API.',
  },
  {
    key: 'allDayRespiration',
    label: 'All Day Respiration',
    permission: 'HEALTH_EXPORT',
    description: 'All-day respiration summaries from Garmin Health API.',
  },
  {
    key: 'healthSnapshot',
    label: 'Health Snapshot',
    permission: 'HEALTH_EXPORT',
    description: 'Health snapshot summaries from Garmin Health API.',
  },
  {
    key: 'hrv',
    label: 'HRV',
    permission: 'HEALTH_EXPORT',
    description: 'HRV summaries from Garmin Health API.',
  },
  {
    key: 'bloodPressures',
    label: 'Blood Pressures',
    permission: 'HEALTH_EXPORT',
    description: 'Blood pressure summaries from Garmin Health API.',
  },
  {
    key: 'skinTemp',
    label: 'Skin Temp',
    permission: 'HEALTH_EXPORT',
    description: 'Skin temperature summaries from Garmin Health API.',
  },
]

const AVAILABLE_TO_ENABLE: GarminEnablementItem[] = [
  ...DATASET_CONFIGS.map((dataset) => ({
    key: dataset.key,
    permission: dataset.permission,
    description: dataset.description,
    supportedByRunSmart: true,
  })),
  {
    key: 'historical_data_export',
    permission: 'HISTORICAL_DATA_EXPORT',
    description: 'Historical export support through Garmin-provisioned backfill endpoints (optional).',
    supportedByRunSmart: false,
  },
  {
    key: 'workout_import',
    permission: 'WORKOUT_IMPORT',
    description: 'Workout import into Garmin (outbound write path, not yet supported).',
    supportedByRunSmart: false,
  },
]

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

interface RunSmartActivity {
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
  elevationLoss: number | null
  maxSpeedMps: number | null
  averageCadence: number | null
  maxCadence: number | null
  lapSummaries: Record<string, unknown>[]
  splitSummaries: Record<string, unknown>[]
  intervalSummaries: Record<string, unknown>[]
  telemetry: Record<string, unknown>
}

interface RunSmartSleepRecord {
  date: string
  sleepStartTimestampGMT: number | null
  sleepEndTimestampGMT: number | null
  totalSleepSeconds: number | null
  deepSleepSeconds: number | null
  lightSleepSeconds: number | null
  remSleepSeconds: number | null
  awakeSleepSeconds: number | null
  sleepScores:
    | {
        overall: {
          value: number
        }
      }
    | null
}

function getNestedValue(record: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = record
  for (const segment of path) {
    if (!current || typeof current !== 'object') return null
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => asRecord(entry))
    .filter((entry) => Object.keys(entry).length > 0)
}

function pickRecordArray(record: Record<string, unknown>, candidatePaths: string[][]): Record<string, unknown>[] {
  for (const path of candidatePaths) {
    const found = getNestedValue(record, path)
    const parsed = asRecordArray(found)
    if (parsed.length > 0) return parsed
  }
  return []
}

function pickNumberWithPaths(record: Record<string, unknown>, candidatePaths: string[][]): number | null {
  for (const path of candidatePaths) {
    const value = getNumber(getNestedValue(record, path))
    if (value != null) return value
  }
  return null
}

function summarizeUpstreamBody(body: string): string {
  const trimmed = body.trim()
  if (!trimmed) return ''

  try {
    const parsed = JSON.parse(trimmed) as {
      errorMessage?: unknown
      message?: unknown
      error?: unknown
      path?: unknown
    }
    const message = [parsed.errorMessage, parsed.message, parsed.error, parsed.path].find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0
    )
    if (message) return message.slice(0, 500)
  } catch {
    // keep text body
  }

  if (/<!doctype html|<html/i.test(trimmed)) {
    return 'Garmin returned an HTML error page'
  }

  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}...` : trimmed
}

function isAuthError(status: number, body: string): boolean {
  if (status === 401) return true
  if (status !== 403) return false
  return /Unable to read oAuth header|invalid[_ ]token|expired|unauthorized/i.test(body)
}

function parseJsonArray(text: string): Record<string, unknown>[] {
  if (!text) return []
  const parsed: unknown = JSON.parse(text)
  return Array.isArray(parsed)
    ? parsed
        .map((entry) => asRecord(entry))
        .filter((entry) => Object.keys(entry).length > 0)
    : []
}

function isInvalidPullToken(body: string): boolean {
  return /InvalidPullTokenException|invalid pull token/i.test(body)
}

function isMissingTimeRange(body: string): boolean {
  return /Missing time range parameters/i.test(body)
}

function isFallbackWorthyWellnessStatus(status: number): boolean {
  return status === 400 || status === 404
}

function isActivityBackfillNotProvisioned(body: string): boolean {
  return /Endpoint not enabled for summary type:\s*CONNECT_ACTIVITY/i.test(body)
}

function isSleepBackfillNotProvisioned(body: string): boolean {
  return /Endpoint not enabled for summary type:\s*CONNECT_SLEEP/i.test(body)
}

function isDailiesBackfillNotProvisioned(body: string): boolean {
  return /Endpoint not enabled for summary type:\s*CONNECT_DAIL/i.test(body)
}

function dedupeActivities(rawActivities: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>()
  const deduped: Record<string, unknown>[] = []

  for (const activity of rawActivities) {
    const fallbackId = `${activity.startTimeInSeconds ?? activity.startTimeGMT ?? 'none'}-${activity.durationInSeconds ?? activity.duration ?? 'none'}-${activity.activityType ?? asRecord(activity.activityType).typeKey ?? 'unknown'}`
    const id = String(activity.activityId ?? activity.summaryId ?? fallbackId)
    if (seen.has(id)) continue
    seen.add(id)
    deduped.push(activity)
  }

  return deduped
}

function dedupeSleepRows(rawRows: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>()
  const deduped: Record<string, unknown>[] = []

  for (const row of rawRows) {
    const fallbackId = `${row.calendarDate ?? 'none'}-${row.startTimeInSeconds ?? row.startTimeGMT ?? 'none'}`
    const id = String(row.sleepSummaryId ?? row.summaryId ?? fallbackId)
    if (seen.has(id)) continue
    seen.add(id)
    deduped.push(row)
  }

  return deduped
}

function dedupeDailiesRows(rawRows: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>()
  const deduped: Record<string, unknown>[] = []

  for (const row of rawRows) {
    const fallbackId = `${row.calendarDate ?? row.date ?? 'none'}-${row.startTimeInSeconds ?? row.startTimeGMT ?? 'none'}`
    const id = String(row.summaryId ?? row.dailySummaryId ?? fallbackId)
    if (seen.has(id)) continue
    seen.add(id)
    deduped.push(row)
  }

  return deduped
}

async function fetchWellnessActivities(
  accessToken: string,
  startTime: number,
  endTime: number,
  mode: 'upload' | 'backfill'
): Promise<Record<string, unknown>[]> {
  const source = mode === 'upload' ? 'wellness-upload' : 'wellness-backfill'
  const rawChunks: Record<string, unknown>[] = []
  let windowStart = startTime

  while (windowStart <= endTime) {
    const windowEnd = Math.min(windowStart + GARMIN_MAX_WINDOW_SECONDS - 1, endTime)
    const path = mode === 'upload' ? '/wellness-api/rest/activities' : '/wellness-api/rest/backfill/activities'
    const url = new URL(`${GARMIN_API_BASE}${path}`)

    if (mode === 'upload') {
      url.searchParams.set('uploadStartTimeInSeconds', String(windowStart))
      url.searchParams.set('uploadEndTimeInSeconds', String(windowEnd))
    } else {
      url.searchParams.set('summaryStartTimeInSeconds', String(windowStart))
      url.searchParams.set('summaryEndTimeInSeconds', String(windowEnd))
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    const responseText = await response.text()
    if (!response.ok) {
      throw new GarminActivitiesFallbackError(source, response.status, responseText)
    }

    rawChunks.push(...parseJsonArray(responseText))
    windowStart = windowEnd + 1
  }

  return dedupeActivities(rawChunks)
}

async function fetchWellnessSleep(
  accessToken: string,
  startTime: number,
  endTime: number,
  mode: 'upload' | 'backfill'
): Promise<Record<string, unknown>[]> {
  const source = mode === 'upload' ? 'sleep-upload' : 'sleep-backfill'
  const rawChunks: Record<string, unknown>[] = []
  let windowStart = startTime

  while (windowStart <= endTime) {
    const windowEnd = Math.min(windowStart + GARMIN_MAX_WINDOW_SECONDS - 1, endTime)
    const path = mode === 'upload' ? '/wellness-api/rest/sleeps' : '/wellness-api/rest/backfill/sleeps'
    const url = new URL(`${GARMIN_API_BASE}${path}`)

    if (mode === 'upload') {
      url.searchParams.set('uploadStartTimeInSeconds', String(windowStart))
      url.searchParams.set('uploadEndTimeInSeconds', String(windowEnd))
    } else {
      url.searchParams.set('summaryStartTimeInSeconds', String(windowStart))
      url.searchParams.set('summaryEndTimeInSeconds', String(windowEnd))
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    const responseText = await response.text()
    if (!response.ok) {
      throw new GarminSleepFallbackError(source, response.status, responseText)
    }

    rawChunks.push(...parseJsonArray(responseText))
    windowStart = windowEnd + 1
  }

  return dedupeSleepRows(rawChunks)
}

async function fetchWellnessDailies(
  accessToken: string,
  startTime: number,
  endTime: number,
  mode: 'upload' | 'backfill'
): Promise<Record<string, unknown>[]> {
  const source = mode === 'upload' ? 'dailies-upload' : 'dailies-backfill'
  const rawChunks: Record<string, unknown>[] = []
  let windowStart = startTime

  while (windowStart <= endTime) {
    const windowEnd = Math.min(windowStart + GARMIN_MAX_WINDOW_SECONDS - 1, endTime)
    const path = mode === 'upload' ? '/wellness-api/rest/dailies' : '/wellness-api/rest/backfill/dailies'
    const url = new URL(`${GARMIN_API_BASE}${path}`)

    if (mode === 'upload') {
      url.searchParams.set('uploadStartTimeInSeconds', String(windowStart))
      url.searchParams.set('uploadEndTimeInSeconds', String(windowEnd))
    } else {
      url.searchParams.set('summaryStartTimeInSeconds', String(windowStart))
      url.searchParams.set('summaryEndTimeInSeconds', String(windowEnd))
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    const responseText = await response.text()
    if (!response.ok) {
      throw new GarminDailiesFallbackError(source, response.status, responseText)
    }

    rawChunks.push(...parseJsonArray(responseText))
    windowStart = windowEnd + 1
  }

  return dedupeDailiesRows(rawChunks)
}

async function fetchRecentGarminActivities(
  accessToken: string,
  permissions: string[],
  lookbackDays: number
): Promise<{
  activities: ReturnType<typeof toRunSmartActivity>[]
  source: 'wellness-upload' | 'wellness-backfill'
}> {
  const endTime = Math.floor(Date.now() / 1000)
  const startTime = Math.max(0, endTime - lookbackDays * 86400 + 1)

  let source: 'wellness-upload' | 'wellness-backfill' = 'wellness-upload'
  let rawActivities: Record<string, unknown>[]

  try {
    rawActivities = await fetchWellnessActivities(accessToken, startTime, endTime, 'upload')
  } catch (uploadError) {
    if (
      uploadError instanceof GarminActivitiesFallbackError &&
      uploadError.source === 'wellness-upload' &&
      (isInvalidPullToken(uploadError.body) ||
        isMissingTimeRange(uploadError.body) ||
        isFallbackWorthyWellnessStatus(uploadError.status))
    ) {
      if (!permissions.includes('HISTORICAL_DATA_EXPORT')) {
        throw uploadError
      }

      source = 'wellness-backfill'
      rawActivities = await fetchWellnessActivities(accessToken, startTime, endTime, 'backfill')
    } else {
      throw uploadError
    }
  }

  const mapped = rawActivities.map((activity) => toRunSmartActivity(activity))
  return { activities: mapped, source }
}

async function fetchRecentGarminSleep(
  accessToken: string,
  permissions: string[],
  lookbackDays: number
): Promise<{
  sleep: RunSmartSleepRecord[]
  source: 'sleep-upload' | 'sleep-backfill'
}> {
  const endTime = Math.floor(Date.now() / 1000)
  const startTime = Math.max(0, endTime - lookbackDays * 86400 + 1)

  let source: 'sleep-upload' | 'sleep-backfill' = 'sleep-upload'
  let rawSleep: Record<string, unknown>[]

  try {
    rawSleep = await fetchWellnessSleep(accessToken, startTime, endTime, 'upload')
  } catch (uploadError) {
    if (
      uploadError instanceof GarminSleepFallbackError &&
      uploadError.source === 'sleep-upload' &&
      (isInvalidPullToken(uploadError.body) ||
        isMissingTimeRange(uploadError.body) ||
        isFallbackWorthyWellnessStatus(uploadError.status))
    ) {
      if (!permissions.includes('HISTORICAL_DATA_EXPORT')) {
        throw uploadError
      }

      source = 'sleep-backfill'
      rawSleep = await fetchWellnessSleep(accessToken, startTime, endTime, 'backfill')
    } else {
      throw uploadError
    }
  }

  const mapped = rawSleep
    .map((entry) => toRunSmartSleepRecord(entry))
    .filter((entry): entry is RunSmartSleepRecord => entry != null)
  return { sleep: mapped, source }
}

async function fetchRecentGarminDailies(
  accessToken: string,
  permissions: string[],
  lookbackDays: number
): Promise<{
  dailies: Record<string, unknown>[]
  source: 'dailies-upload' | 'dailies-backfill'
}> {
  const endTime = Math.floor(Date.now() / 1000)
  const startTime = Math.max(0, endTime - lookbackDays * 86400 + 1)

  let source: 'dailies-upload' | 'dailies-backfill' = 'dailies-upload'
  let rawDailies: Record<string, unknown>[]

  try {
    rawDailies = await fetchWellnessDailies(accessToken, startTime, endTime, 'upload')
  } catch (uploadError) {
    if (
      uploadError instanceof GarminDailiesFallbackError &&
      uploadError.source === 'dailies-upload' &&
      (isInvalidPullToken(uploadError.body) ||
        isMissingTimeRange(uploadError.body) ||
        isFallbackWorthyWellnessStatus(uploadError.status))
    ) {
      if (!permissions.includes('HISTORICAL_DATA_EXPORT')) {
        throw uploadError
      }

      source = 'dailies-backfill'
      rawDailies = await fetchWellnessDailies(accessToken, startTime, endTime, 'backfill')
    } else {
      throw uploadError
    }
  }

  return { dailies: rawDailies, source }
}

function getActivityStartSeconds(activity: Record<string, unknown>): number | null {
  const fromSeconds = getNumber(activity.startTimeInSeconds)
  if (fromSeconds != null) return fromSeconds

  const fromStartTimeGmt = getString(activity.startTimeGMT)
  const fromStartTimeLocal = getString(activity.startTimeLocal)
  const dateValue = fromStartTimeGmt ?? fromStartTimeLocal
  if (!dateValue) return null

  const parsed = Date.parse(dateValue)
  if (!Number.isFinite(parsed)) return null
  return Math.floor(parsed / 1000)
}

function toRunSmartActivity(activity: Record<string, unknown>): RunSmartActivity {
  const activityTypeValue = asRecord(activity.activityType).typeKey ?? activity.activityType ?? ''
  const activityTypeRaw = String(activityTypeValue).toLowerCase().trim()
  const normalizedActivityType = activityTypeRaw.replace(/ /g, '_')
  const startInSeconds = getActivityStartSeconds(activity)
  const startIso = startInSeconds != null ? new Date(startInSeconds * 1000).toISOString() : null

  const distanceInMeters = getNumber(activity.distanceInMeters) ?? getNumber(activity.distance) ?? 0
  const durationRaw = getNumber(activity.durationInSeconds) ?? getNumber(activity.duration) ?? 0
  const durationInSeconds = durationRaw > 100_000 ? Math.round(durationRaw / 1000) : Math.round(durationRaw)
  const averageSpeed =
    getNumber(activity.averageSpeedInMetersPerSecond) ?? getNumber(activity.averageSpeed)
  const averageHeartRate =
    getNumber(activity.averageHeartRateInBeatsPerMinute) ?? getNumber(activity.averageHR)
  const maxHeartRate = getNumber(activity.maxHeartRateInBeatsPerMinute) ?? getNumber(activity.maxHR)
  const calories = getNumber(activity.activeKilocalories) ?? getNumber(activity.calories)
  const elevationGain = getNumber(activity.totalElevationGainInMeters) ?? getNumber(activity.elevationGain)
  const elevationLoss = getNumber(activity.totalElevationLossInMeters) ?? getNumber(activity.elevationLoss)
  const maxSpeedMps =
    getNumber(activity.maxSpeedInMetersPerSecond) ?? getNumber(activity.maxSpeedMps)
  const averageCadence = pickNumberWithPaths(activity, [
    ['averageRunCadenceInStepsPerMinute'],
    ['averageCadenceInStepsPerMinute'],
    ['averageCadence'],
    ['cadence', 'average'],
  ])
  const maxCadence = pickNumberWithPaths(activity, [
    ['maxRunCadenceInStepsPerMinute'],
    ['maxCadenceInStepsPerMinute'],
    ['maxCadence'],
    ['cadence', 'max'],
  ])

  const lapSummaries = pickRecordArray(activity, [
    ['lapSummaries'],
    ['laps'],
    ['activityLaps'],
    ['activityDetails', 'laps'],
    ['activityDetails', 'lapSummaries'],
  ])
  const splitSummaries = pickRecordArray(activity, [
    ['splitSummaries'],
    ['splits'],
    ['activitySplits'],
    ['activityDetails', 'splits'],
    ['activityDetails', 'splitSummaries'],
  ])
  const intervalSummaries = pickRecordArray(activity, [
    ['intervalSummaries'],
    ['intervals'],
    ['activityIntervals'],
    ['activityDetails', 'intervals'],
    ['activityDetails', 'intervalSummaries'],
  ])

  const activityName = getString(activity.activityName) ?? (activityTypeRaw || 'Garmin Activity')
  const activityIdRaw = activity.activityId ?? activity.summaryId
  const activityId = activityIdRaw != null ? String(activityIdRaw) : null

  return {
    activityId,
    activityName,
    activityType: normalizedActivityType,
    startTimeGMT: startIso,
    distance: distanceInMeters / 1000,
    duration: durationInSeconds,
    averageHR: averageHeartRate,
    maxHR: maxHeartRate,
    calories,
    averagePace: averageSpeed && averageSpeed > 0 ? Math.round(1000 / averageSpeed) : null,
    elevationGain,
    elevationLoss,
    maxSpeedMps,
    averageCadence,
    maxCadence,
    lapSummaries,
    splitSummaries,
    intervalSummaries,
    telemetry: activity,
  }
}

function mergeTelemetryArrays(
  base: Record<string, unknown>[],
  candidate: Record<string, unknown>[]
): Record<string, unknown>[] {
  if (candidate.length === 0) return base
  if (base.length === 0) return candidate
  return candidate.length >= base.length ? candidate : base
}

function maxNullableNumber(...values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  return valid.length > 0 ? Math.max(...valid) : null
}

function mergeRunSmartActivities(base: RunSmartActivity, candidate: RunSmartActivity): RunSmartActivity {
  return {
    ...base,
    activityName: candidate.activityName || base.activityName,
    activityType: candidate.activityType || base.activityType,
    startTimeGMT: candidate.startTimeGMT ?? base.startTimeGMT,
    distance: candidate.distance > 0 ? candidate.distance : base.distance,
    duration: candidate.duration > 0 ? candidate.duration : base.duration,
    averageHR: candidate.averageHR ?? base.averageHR,
    maxHR: maxNullableNumber(candidate.maxHR, base.maxHR),
    calories: candidate.calories ?? base.calories,
    averagePace: candidate.averagePace ?? base.averagePace,
    elevationGain: candidate.elevationGain ?? base.elevationGain,
    elevationLoss: candidate.elevationLoss ?? base.elevationLoss,
    maxSpeedMps: candidate.maxSpeedMps ?? base.maxSpeedMps,
    averageCadence: candidate.averageCadence ?? base.averageCadence,
    maxCadence: maxNullableNumber(candidate.maxCadence, base.maxCadence),
    lapSummaries: mergeTelemetryArrays(base.lapSummaries, candidate.lapSummaries),
    splitSummaries: mergeTelemetryArrays(base.splitSummaries, candidate.splitSummaries),
    intervalSummaries: mergeTelemetryArrays(base.intervalSummaries, candidate.intervalSummaries),
    telemetry:
      Object.keys(candidate.telemetry).length > Object.keys(base.telemetry).length
        ? candidate.telemetry
        : base.telemetry,
  }
}

function dedupeRunSmartActivities(activities: RunSmartActivity[]): RunSmartActivity[] {
  const deduped = new Map<string, RunSmartActivity>()

  for (const activity of activities) {
    const dedupeKey = activity.activityId ?? `${activity.startTimeGMT ?? 'unknown'}-${activity.activityName}`
    const existing = deduped.get(dedupeKey)
    if (!existing) {
      deduped.set(dedupeKey, activity)
      continue
    }
    deduped.set(dedupeKey, mergeRunSmartActivities(existing, activity))
  }

  return Array.from(deduped.values())
}

async function fetchRecentStoredGarminActivities(
  userId: number,
  lookbackDays: number
): Promise<Array<ReturnType<typeof toRunSmartActivity>>> {
  const supabase = createAdminClient()
  const lookbackCutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000

  const { data, error } = await supabase
    .from('garmin_activities')
    .select(
      'activity_id, start_time, sport, duration_s, distance_m, avg_hr, max_hr, avg_pace, elevation_gain_m, elevation_loss_m, max_speed_mps, avg_cadence_spm, max_cadence_spm, lap_summaries, split_summaries, interval_summaries, telemetry_json, calories, raw_json, updated_at'
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(500)

  if (error) {
    throw new Error(`Failed to query garmin_activities cache: ${error.message}`)
  }

  const mapped = (data ?? [])
    .map((row) => asRecord(row))
    .map((row) => {
      const raw = asRecord(row.raw_json)
      const activityType = getString(row.sport) ?? getString(raw.activityType) ?? 'running'
      const distanceMeters =
        getNumber(row.distance_m) ?? getNumber(raw.distanceInMeters) ?? getNumber(raw.distance) ?? 0
      const durationSeconds =
        getNumber(row.duration_s) ?? getNumber(raw.durationInSeconds) ?? getNumber(raw.duration) ?? 0
      const startTimeGMT = getString(row.start_time) ?? getString(raw.startTimeGMT)
      const updatedAt = getString(row.updated_at)

      return {
        activityId: getString(row.activity_id) ?? getString(raw.activityId),
        activityName: getString(raw.activityName) ?? getString(raw.activity_name) ?? activityType,
        activityType: activityType.toLowerCase().replace(/ /g, '_'),
        startTimeGMT,
        distance: distanceMeters / 1000,
        duration: durationSeconds > 100_000 ? Math.round(durationSeconds / 1000) : Math.round(durationSeconds),
        averageHR: getNumber(row.avg_hr) ?? getNumber(raw.averageHR) ?? getNumber(raw.averageHeartRateInBeatsPerMinute),
        maxHR: getNumber(row.max_hr) ?? getNumber(raw.maxHR) ?? getNumber(raw.maxHeartRateInBeatsPerMinute),
        calories: getNumber(row.calories) ?? getNumber(raw.calories),
        averagePace: getNumber(row.avg_pace) ?? getNumber(raw.averagePace),
        elevationGain:
          getNumber(row.elevation_gain_m) ??
          getNumber(raw.elevationGain) ??
          getNumber(raw.totalElevationGainInMeters),
        elevationLoss:
          getNumber(row.elevation_loss_m) ??
          getNumber(raw.elevationLoss) ??
          getNumber(raw.totalElevationLossInMeters),
        maxSpeedMps:
          getNumber(row.max_speed_mps) ??
          getNumber(raw.maxSpeedMps) ??
          getNumber(raw.maxSpeedInMetersPerSecond),
        averageCadence:
          getNumber(row.avg_cadence_spm) ??
          getNumber(raw.averageCadence) ??
          getNumber(raw.averageRunCadenceInStepsPerMinute),
        maxCadence:
          getNumber(row.max_cadence_spm) ??
          getNumber(raw.maxCadence) ??
          getNumber(raw.maxRunCadenceInStepsPerMinute),
        lapSummaries: asRecordArray(row.lap_summaries),
        splitSummaries: asRecordArray(row.split_summaries),
        intervalSummaries: asRecordArray(row.interval_summaries),
        telemetry: asRecord(row.telemetry_json),
        __updatedAt: updatedAt,
      }
    })
    .filter((entry) => entry.activityType.includes('run') || entry.activityName.toLowerCase().includes('run'))
    .filter((entry) => {
      const startTs = entry.startTimeGMT ? Date.parse(entry.startTimeGMT) : Number.NaN
      if (Number.isFinite(startTs)) return startTs >= lookbackCutoff

      const updatedTs = entry.__updatedAt ? Date.parse(entry.__updatedAt) : Number.NaN
      if (Number.isFinite(updatedTs)) return updatedTs >= lookbackCutoff

      return true
    })
    .map(({ __updatedAt: _ignored, ...entry }) => entry)

  return dedupeRunSmartActivities(mapped).filter((activity) =>
    isActivityWithinLookback(activity, lookbackDays)
  )
}

function toRunSmartSleepRecord(entry: Record<string, unknown>): RunSmartSleepRecord | null {
  const calendarDate = getString(entry.calendarDate)
  if (!calendarDate) return null

  const startTimeInSeconds = getNumber(entry.startTimeInSeconds)
  const durationInSeconds = getNumber(entry.durationInSeconds)
  const overallSleepScoreRaw = asRecord(entry.overallSleepScore).value ?? entry.overallSleepScore
  const overallSleepScore = getNumber(overallSleepScoreRaw)

  return {
    date: calendarDate,
    sleepStartTimestampGMT: startTimeInSeconds != null ? startTimeInSeconds * 1000 : null,
    sleepEndTimestampGMT:
      startTimeInSeconds != null && durationInSeconds != null
        ? (startTimeInSeconds + durationInSeconds) * 1000
        : null,
    totalSleepSeconds: durationInSeconds,
    deepSleepSeconds: getNumber(entry.deepSleepDurationInSeconds),
    lightSleepSeconds: getNumber(entry.lightSleepDurationInSeconds),
    remSleepSeconds: getNumber(entry.remSleepInSeconds),
    awakeSleepSeconds: getNumber(entry.awakeDurationInSeconds),
    sleepScores:
      overallSleepScore != null
        ? {
            overall: {
              value: overallSleepScore,
            },
          }
        : null,
  }
}

async function fetchGarminPermissions(accessToken: string): Promise<string[]> {
  const response = await fetch(`${GARMIN_API_BASE}/wellness-api/rest/user/permissions`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  const responseText = await response.text()
  if (!response.ok) {
    throw new GarminUpstreamError('permissions', response.status, responseText)
  }

  try {
    const parsed: unknown = JSON.parse(responseText)
    // Garmin returns a bare JSON array: ["ACTIVITY_EXPORT", "HEALTH_EXPORT", ...]
    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === 'string')
    }
    // Fallback: handle object-wrapped form { permissions: [...] }
    const permsField = (parsed as Record<string, unknown>)?.permissions
    if (Array.isArray(permsField)) {
      return permsField.filter((entry): entry is string => typeof entry === 'string')
    }
    return []
  } catch {
    return []
  }
}

async function fetchGarminUserId(accessToken: string): Promise<string> {
  const response = await fetch(`${GARMIN_API_BASE}/wellness-api/rest/user/id`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  const responseText = await response.text()
  if (!response.ok) {
    throw new GarminUpstreamError('profile', response.status, responseText)
  }

  const parsed = asRecord(responseText ? JSON.parse(responseText) : null)
  const userId = getString(parsed.userId) ?? getString(parsed.id)
  if (!userId) {
    throw new GarminUpstreamError('profile', 502, 'Garmin profile response did not include userId')
  }

  return userId
}

function buildCapabilities(params: {
  permissions: string[]
  datasetCounts: Record<GarminDatasetKey, number>
  storeAvailable: boolean
  storeError?: string
  lookbackDays: number
}): GarminDatasetCapability[] {
  const { permissions, datasetCounts, storeAvailable, storeError, lookbackDays } = params

  const capabilities: GarminDatasetCapability[] = DATASET_CONFIGS.map((config) => {
    const permissionGranted = permissions.includes(config.permission)
    const rowCount = datasetCounts[config.key] ?? 0

    let reason: string | undefined
    if (!permissionGranted) {
      reason = `Missing ${config.permission} permission.`
    } else if (!storeAvailable) {
      reason = storeError ?? 'RunSmart Garmin webhook storage is not configured.'
    } else if (rowCount === 0) {
      reason = `No Garmin export notifications received for this dataset in the last ${lookbackDays} days.`
    }

    return {
      key: config.key,
      label: config.label,
      permissionGranted,
      endpointReachable: permissionGranted && storeAvailable,
      enabledForSync: permissionGranted && storeAvailable,
      supportedByRunSmart: true,
      ...(reason ? { reason } : {}),
    }
  })

  const hasWorkoutImport = permissions.includes('WORKOUT_IMPORT')
  capabilities.push({
    key: 'workoutImport',
    label: 'Workout Import',
    permissionGranted: hasWorkoutImport,
    endpointReachable: false,
    enabledForSync: false,
    supportedByRunSmart: false,
    reason: hasWorkoutImport
      ? 'Permission granted, but RunSmart currently supports Garmin export import only.'
      : 'Missing WORKOUT_IMPORT permission.',
  })

  return capabilities
}

async function computeCatalog(params: {
  accessToken: string
  sinceIso: string
  lookbackDays: number
}): Promise<GarminCatalogResult> {
  const { accessToken, sinceIso, lookbackDays } = params
  const [permissions, garminUserId] = await Promise.all([
    fetchGarminPermissions(accessToken),
    fetchGarminUserId(accessToken),
  ])

  const readResult = await readGarminExportRows({
    garminUserId,
    sinceIso,
  })

  const datasets = groupRowsByDataset(readResult.rows)
  const datasetCounts = Object.fromEntries(
    DATASET_CONFIGS.map((dataset) => [dataset.key, datasets[dataset.key].length])
  ) as Record<GarminDatasetKey, number>

  const latestReceivedAt = readResult.rows.reduce<string | null>((latest, row) => {
    if (!latest) return row.receivedAt
    return row.receivedAt > latest ? row.receivedAt : latest
  }, null)

  return {
    permissions,
    capabilities: buildCapabilities({
      permissions,
      datasetCounts,
      storeAvailable: readResult.storeAvailable,
      ...(readResult.storeError ? { storeError: readResult.storeError } : {}),
      lookbackDays,
    }),
    datasets,
    datasetCounts,
    ingestion: {
      lookbackDays,
      storeAvailable: readResult.storeAvailable,
      ...(readResult.storeError ? { storeError: readResult.storeError } : {}),
      recordsInWindow: readResult.rows.length,
      latestReceivedAt,
    },
  }
}

function parseUserId(req: Request): number | null {
  const headerValue = req.headers.get('x-user-id')?.trim() ?? ''
  if (headerValue) {
    const parsed = Number.parseInt(headerValue, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  const { searchParams } = new URL(req.url)
  const queryValue = searchParams.get('userId')?.trim() ?? ''
  if (!queryValue) return null

  const parsed = Number.parseInt(queryValue, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

async function computeCatalogWithAutoRefresh(params: {
  userId: number
  sinceIso: string
  lookbackDays: number
}): Promise<GarminCatalogResult> {
  const { userId, sinceIso, lookbackDays } = params
  const accessToken = await getValidGarminAccessToken(userId)

  try {
    return await computeCatalog({ accessToken, sinceIso, lookbackDays })
  } catch (error) {
    if (error instanceof GarminUpstreamError && isAuthError(error.status, error.body)) {
      const refreshed = await refreshGarminAccessToken(userId)
      return computeCatalog({ accessToken: refreshed.accessToken, sinceIso, lookbackDays })
    }

    throw error
  }
}

async function safeMarkAuthError(userId: number, message: string): Promise<void> {
  try {
    await markGarminAuthError(userId, message)
  } catch (error) {
    logger.warn('Failed to persist Garmin auth error state:', error)
  }
}

async function safeMarkSyncState(params: {
  userId: number
  lastSyncAt?: string
  lastSyncCursor?: string | null
  errorState?: Record<string, unknown> | null
}): Promise<void> {
  try {
    await markGarminSyncState(params)
  } catch (error) {
    logger.warn('Failed to persist Garmin sync state:', error)
  }
}

function parseValidIso(value: string | null | undefined): string | null {
  if (!value) return null
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString()
}

function resolveSyncWindow(params: {
  lastSyncCursor: string | null
  defaultLookbackDays: number
  requestedSinceIso?: string | null
}): { sinceIso: string; lookbackDays: number; source: 'requested' | 'cursor' | 'lookback' } {
  const requestedIso = parseValidIso(params.requestedSinceIso)
  if (requestedIso) {
    return {
      sinceIso: requestedIso,
      lookbackDays: params.defaultLookbackDays,
      source: 'requested',
    }
  }

  const cursorIso = parseValidIso(params.lastSyncCursor)
  if (cursorIso) {
    return {
      sinceIso: cursorIso,
      lookbackDays: params.defaultLookbackDays,
      source: 'cursor',
    }
  }

  return {
    sinceIso: lookbackStartIso(params.defaultLookbackDays),
    lookbackDays: params.defaultLookbackDays,
    source: 'lookback',
  }
}

function isActivityWithinLookback(activity: { startTimeGMT: string | null }, lookbackDays: number): boolean {
  if (!activity.startTimeGMT) return true
  const parsed = Date.parse(activity.startTimeGMT)
  if (!Number.isFinite(parsed)) return true
  const cutoffMs = Date.now() - lookbackDays * 24 * 60 * 60 * 1000
  return parsed >= cutoffMs
}

function buildExecutionOptions(trigger: GarminSyncTrigger): GarminSyncExecutionOptions {
  if (trigger === 'backfill') {
    return {
      trigger,
      enforceRateLimit: false,
      defaultLookbackDays: BACKFILL_DAILY_DAYS,
      activityLookbackDays: BACKFILL_ACTIVITY_DAYS,
    }
  }

  return {
    trigger,
    enforceRateLimit: true,
    defaultLookbackDays: DEFAULT_INCREMENTAL_DAYS,
    activityLookbackDays: DEFAULT_ACTIVITY_SYNC_DAYS,
  }
}

function isOptionalDeriveQueueNotice(reason: string | null | undefined): boolean {
  const normalized = (reason ?? '').toLowerCase()
  if (!normalized) return false
  return normalized.includes('redis not configured') || normalized.includes('derive queue unavailable')
}

export async function runGarminSyncForUser(params: {
  userId: number
  options: GarminSyncExecutionOptions
}): Promise<{
  status: number
  body: Record<string, unknown>
  headers?: Record<string, string>
}> {
  const { userId, options } = params
  try {
    const oauthState = await getGarminOAuthState(userId)
    if (!oauthState) {
      return {
        status: 401,
        body: {
          success: false,
          error: 'No Garmin connection found. Connect Garmin first.',
          needsReauth: true,
        },
      }
    }

    if (options.enforceRateLimit) {
      const rateLimit = evaluateGarminSyncRateLimit({
        userId,
        lastSyncAt: oauthState.lastSyncAt,
      })
      if (!rateLimit.allowed) {
        return {
          status: 429,
          body: {
            success: false,
            error: 'Garmin sync rate limit reached. Try again later.',
            retryAfterSeconds: rateLimit.retryAfterSeconds,
            reason: rateLimit.reason,
          },
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        }
      }
    }

    const syncWindow =
      options.trigger === 'backfill'
        ? {
            sinceIso: lookbackStartIso(options.defaultLookbackDays),
            lookbackDays: options.defaultLookbackDays,
            source: 'lookback' as const,
          }
        : resolveSyncWindow({
            lastSyncCursor: oauthState.lastSyncCursor,
            defaultLookbackDays: options.defaultLookbackDays,
            requestedSinceIso: options.sinceIso ?? null,
          })

    const { permissions, capabilities, datasets, datasetCounts, ingestion } = await computeCatalogWithAutoRefresh({
      userId,
      sinceIso: syncWindow.sinceIso,
      lookbackDays: syncWindow.lookbackDays,
    })

    const nowIso = new Date().toISOString()
    const notices: string[] = []
    const webhookEndpointHint = '/api/devices/garmin/webhook/<GARMIN_WEBHOOK_SECRET>'

    if (!ingestion.storeAvailable) {
      notices.push(ingestion.storeError ?? 'RunSmart Garmin webhook storage is unavailable.')
    }

    if (!permissions.includes('ACTIVITY_EXPORT')) {
      notices.push('Activity datasets skipped: Missing ACTIVITY_EXPORT permission.')
    }

    if (!permissions.includes('HEALTH_EXPORT')) {
      notices.push('Health datasets skipped: Missing HEALTH_EXPORT permission.')
    }

    const totalRows = Object.values(datasetCounts).reduce((sum, value) => sum + value, 0)
    const latestIngestionTs = ingestion.latestReceivedAt ? Date.parse(ingestion.latestReceivedAt) : Number.NaN
    const hasRecentIngestion =
      Number.isFinite(latestIngestionTs) &&
      latestIngestionTs >= Date.now() - syncWindow.lookbackDays * 24 * 60 * 60 * 1000

    if (ingestion.storeAvailable && totalRows === 0 && syncWindow.source === 'lookback' && !hasRecentIngestion) {
      notices.push(
        `No Garmin export records received in the last ${syncWindow.lookbackDays} days. Ensure Garmin ping/pull or push notifications point to ${webhookEndpointHint}.`
      )
    } else if (ingestion.storeAvailable && totalRows === 0 && syncWindow.source === 'cursor') {
      notices.push('No new Garmin export records since the previous sync cursor.')
    }

    const activityRows = [
      ...datasets.activities,
      ...datasets.manuallyUpdatedActivities,
      ...datasets.activityDetails,
    ]

    const mappedActivities = activityRows.map((entry) => toRunSmartActivity(entry))
    const filteredActivities = mappedActivities.filter((activity) =>
      isActivityWithinLookback(activity, options.activityLookbackDays)
    )

    const uniqueActivities = dedupeRunSmartActivities(filteredActivities)

    let activitiesForSync = uniqueActivities
    const hasWebhookActivityRows = filteredActivities.length > 0
    let fallbackFailureNotice: string | null = null

    if (activitiesForSync.length === 0 && !hasWebhookActivityRows && permissions.includes('ACTIVITY_EXPORT')) {
      try {
        const fallbackAccessToken = await getValidGarminAccessToken(userId)
        const fallbackResult = await fetchRecentGarminActivities(
          fallbackAccessToken,
          permissions,
          options.activityLookbackDays
        )
        if (fallbackResult.activities.length > 0) {
          activitiesForSync = fallbackResult.activities
          notices.push(
            `Activity webhook feeds were empty, so RunSmart pulled ${fallbackResult.activities.length} activities directly from Garmin ${fallbackResult.source}.`
          )
        } else if (!hasWebhookActivityRows) {
          notices.push(`No activities found from Garmin in the last ${options.activityLookbackDays} days.`)
        }
      } catch (fallbackError) {
        if (fallbackError instanceof GarminActivitiesFallbackError) {
          if (
            fallbackError.source === 'wellness-backfill' &&
            isActivityBackfillNotProvisioned(fallbackError.body)
          ) {
            fallbackFailureNotice =
              'Activity webhook feeds were empty and Garmin activity backfill is not provisioned for this app.'
          } else {
            fallbackFailureNotice =
              `Activity webhook feeds were empty and direct Garmin pull failed (${fallbackError.status} ${fallbackError.source}).`
          }
          logger.warn(
            `Garmin activity fallback error (${fallbackError.status} ${fallbackError.source}): ${summarizeUpstreamBody(fallbackError.body)}`
          )
        } else {
          fallbackFailureNotice = 'Activity webhook feeds were empty and direct Garmin pull failed.'
          logger.warn('Garmin activity fallback error:', fallbackError)
        }
      }
    }

    if (activitiesForSync.length === 0) {
      try {
        const cachedLookbackDays = Math.max(options.activityLookbackDays, 30)
        const cachedActivities = await fetchRecentStoredGarminActivities(userId, cachedLookbackDays)
        if (cachedActivities.length > 0) {
          activitiesForSync = cachedActivities
          notices.push(
            `Webhook feeds were empty, so RunSmart imported ${cachedActivities.length} cached Garmin activities from analytics storage (${cachedLookbackDays}-day window).`
          )
          fallbackFailureNotice = null
        }
      } catch (cachedReadError) {
        logger.warn('Garmin stored activity cache fallback warning:', cachedReadError)
      }
    }

    if (fallbackFailureNotice) {
      notices.push(fallbackFailureNotice)
    }

    const missingDatasetsSet = new Set<string>(
      capabilities
        .filter((capability) => capability.supportedByRunSmart && capability.permissionGranted)
        .filter((capability) => (datasetCounts[capability.key as GarminDatasetKey] ?? 0) === 0)
        .map((capability) => capability.key)
    )
    const usedFallbackDatasets: string[] = []

    let dailies = datasets.dailies
    if (dailies.length > 0) {
      missingDatasetsSet.delete('dailies')
    } else if (permissions.includes('HEALTH_EXPORT')) {
      try {
        const fallbackAccessToken = await getValidGarminAccessToken(userId)
        const fallbackDailies = await fetchRecentGarminDailies(
          fallbackAccessToken,
          permissions,
          syncWindow.lookbackDays
        )
        if (fallbackDailies.dailies.length > 0) {
          dailies = fallbackDailies.dailies
          usedFallbackDatasets.push('dailies')
          missingDatasetsSet.delete('dailies')
          notices.push(
            `Daily wellness webhook feeds were empty, so RunSmart pulled ${fallbackDailies.dailies.length} daily summaries directly from Garmin ${fallbackDailies.source}.`
          )
        } else {
          missingDatasetsSet.add('dailies')
        }
      } catch (fallbackDailiesError) {
        missingDatasetsSet.add('dailies')
        if (fallbackDailiesError instanceof GarminDailiesFallbackError) {
          if (
            fallbackDailiesError.source === 'dailies-backfill' &&
            isDailiesBackfillNotProvisioned(fallbackDailiesError.body)
          ) {
            notices.push('Daily wellness webhook feeds were empty and Garmin dailies backfill is not provisioned for this app.')
          } else {
            notices.push(
              `Daily wellness webhook feeds were empty and direct Garmin dailies pull failed (${fallbackDailiesError.status} ${fallbackDailiesError.source}).`
            )
          }
          logger.warn(
            `Garmin dailies fallback error (${fallbackDailiesError.status} ${fallbackDailiesError.source}): ${summarizeUpstreamBody(fallbackDailiesError.body)}`
          )
        } else {
          notices.push('Daily wellness webhook feeds were empty and direct Garmin dailies pull failed.')
          logger.warn('Garmin dailies fallback error:', fallbackDailiesError)
        }
      }
    }

    const datasetsForSync: Record<GarminDatasetKey, Record<string, unknown>[]> = {
      ...datasets,
      dailies,
    }

    let sleep = datasetsForSync.sleeps
      .map((entry) => toRunSmartSleepRecord(entry))
      .filter((entry): entry is NonNullable<typeof entry> => entry != null)

    if (sleep.length > 0) {
      missingDatasetsSet.delete('sleeps')
    } else if (permissions.includes('HEALTH_EXPORT')) {
      try {
        const fallbackAccessToken = await getValidGarminAccessToken(userId)
        const fallbackSleep = await fetchRecentGarminSleep(
          fallbackAccessToken,
          permissions,
          syncWindow.lookbackDays
        )
        if (fallbackSleep.sleep.length > 0) {
          sleep = fallbackSleep.sleep
          usedFallbackDatasets.push('sleeps')
          missingDatasetsSet.delete('sleeps')
          notices.push(
            `Sleep webhook feeds were empty, so RunSmart pulled ${fallbackSleep.sleep.length} sleep summaries directly from Garmin ${fallbackSleep.source}.`
          )
        } else {
          missingDatasetsSet.add('sleeps')
        }
      } catch (fallbackSleepError) {
        missingDatasetsSet.add('sleeps')
        if (fallbackSleepError instanceof GarminSleepFallbackError) {
          if (
            fallbackSleepError.source === 'sleep-backfill' &&
            isSleepBackfillNotProvisioned(fallbackSleepError.body)
          ) {
            notices.push('Sleep webhook feeds were empty and Garmin sleep backfill is not provisioned for this app.')
          } else {
            notices.push(
              `Sleep webhook feeds were empty and direct Garmin sleep pull failed (${fallbackSleepError.status} ${fallbackSleepError.source}).`
            )
          }
          logger.warn(
            `Garmin sleep fallback error (${fallbackSleepError.status} ${fallbackSleepError.source}): ${summarizeUpstreamBody(fallbackSleepError.body)}`
          )
        } else {
          notices.push('Sleep webhook feeds were empty and direct Garmin sleep pull failed.')
          logger.warn('Garmin sleep fallback error:', fallbackSleepError)
        }
      }
    }

    let persistence: {
      activitiesUpserted: number
      dailyMetricsUpserted: number
    } = {
      activitiesUpserted: 0,
      dailyMetricsUpserted: 0,
    }

    const deriveQueue: {
      queued: boolean
      jobId: string | null
      reason?: string
      inlineFallback?: {
        executed: boolean
        processedUsers: number
        skippedUsers: number
        failed: boolean
        error?: string
      }
    } = {
      queued: false,
      jobId: null,
    }

    try {
      persistence = await persistGarminSyncSnapshot({
        userId,
        activities: activitiesForSync,
        sleep,
        datasets: datasetsForSync,
      })
    } catch (storageError) {
      notices.push('Garmin analytics storage unavailable; sync data was not persisted to analytics tables.')
      logger.warn('Garmin analytics storage warning:', storageError)
    }

    await safeMarkSyncState({
      userId,
      lastSyncAt: nowIso,
      lastSyncCursor: nowIso,
      errorState: null,
    })

    const derivePayload = {
      userId,
      ...(oauthState.garminUserId ? { garminUserId: oauthState.garminUserId } : {}),
      datasetKey: 'post-sync',
      source: 'sync' as const,
      requestedAt: nowIso,
    }

    try {
      const queued = await enqueueGarminDeriveJob(derivePayload)
      deriveQueue.queued = queued.queued
      deriveQueue.jobId = queued.jobId
      if (queued.reason) deriveQueue.reason = queued.reason
      if (!queued.queued && isOptionalDeriveQueueNotice(queued.reason)) {
        try {
          const inlineResult = await runGarminDeriveForPayload(derivePayload)
          deriveQueue.inlineFallback = {
            executed: true,
            processedUsers: inlineResult.processedUsers,
            skippedUsers: inlineResult.skippedUsers,
            failed: false,
          }
        } catch (inlineError) {
          const inlineErrorMessage =
            inlineError instanceof Error ? inlineError.message : 'Inline derive fallback failed'
          deriveQueue.inlineFallback = {
            executed: true,
            processedUsers: 0,
            skippedUsers: 0,
            failed: true,
            error: inlineErrorMessage,
          }
          logger.warn('Garmin inline derive fallback warning:', inlineError)
        }
      }
      if (!queued.queued && !isOptionalDeriveQueueNotice(queued.reason)) {
        notices.push(queued.reason ?? 'Garmin derive job was not queued.')
      }
    } catch (queueError) {
      const reason = queueError instanceof Error ? queueError.message : 'Failed to enqueue Garmin derive job'
      deriveQueue.reason = reason
      if (!isOptionalDeriveQueueNotice(reason)) {
        notices.push(reason)
      }
      logger.warn('Garmin derive enqueue warning:', queueError)
    }

    await captureServerEvent('garmin_sync_completed', {
      userId,
      datasetsCount: totalRows,
      activitiesCount: activitiesForSync.length,
      trigger: options.trigger,
    })

    return {
      status: 200,
      body: {
        success: true,
        syncName: SYNC_NAME,
        trigger: options.trigger,
        syncWindow: {
          source: syncWindow.source,
          sinceIso: syncWindow.sinceIso,
          lookbackDays: syncWindow.lookbackDays,
          activityLookbackDays: options.activityLookbackDays,
        },
        permissions,
        availableToEnable: AVAILABLE_TO_ENABLE,
        capabilities,
        ingestion,
        datasets: datasetsForSync,
        datasetCounts,
        activities: activitiesForSync,
        sleep,
        persistence,
        deriveQueue,
        datasetCompleteness: {
          missingDatasets: Array.from(missingDatasetsSet.values()),
          usedFallbackDatasets,
        },
        notices,
        lastSyncCursor: nowIso,
        lastSyncAt: nowIso,
      },
    }
  } catch (error) {
    if (error instanceof GarminUpstreamError && isAuthError(error.status, error.body)) {
      await safeMarkAuthError(userId, summarizeUpstreamBody(error.body))
      return {
        status: 401,
        body: {
          success: false,
          error: 'Garmin authentication expired or invalid, please reconnect Garmin',
          needsReauth: true,
          detail: summarizeUpstreamBody(error.body),
        },
      }
    }

    if (error instanceof Error && /reconnect garmin|refresh token|no garmin connection/i.test(error.message)) {
      await safeMarkAuthError(userId, error.message)
      return {
        status: 401,
        body: {
          success: false,
          error: 'Garmin authentication expired or invalid, please reconnect Garmin',
          needsReauth: true,
          detail: error.message,
        },
      }
    }

    logger.error('Garmin enabled sync error:', error)
    await safeMarkSyncState({
      userId,
      errorState: {
        message: error instanceof Error ? error.message : 'Unknown Garmin sync error',
        recordedAt: new Date().toISOString(),
      },
    })
    return {
      status: 500,
      body: { success: false, error: 'Failed to run Garmin enabled sync' },
    }
  }
}

export async function GET(req: Request) {
  const userId = parseUserId(req)
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Valid userId is required', needsReauth: true },
      { status: 401 }
    )
  }

  try {
    const { permissions, capabilities, ingestion } = await computeCatalogWithAutoRefresh({
      userId,
      sinceIso: lookbackStartIso(GARMIN_HISTORY_DAYS),
      lookbackDays: GARMIN_HISTORY_DAYS,
    })

    return NextResponse.json({
      success: true,
      syncName: SYNC_NAME,
      permissions,
      availableToEnable: AVAILABLE_TO_ENABLE,
      capabilities,
      ingestion,
    })
  } catch (error) {
    if (error instanceof GarminUpstreamError && isAuthError(error.status, error.body)) {
      await safeMarkAuthError(userId, summarizeUpstreamBody(error.body))
      return NextResponse.json(
        {
          success: false,
          error: 'Garmin authentication expired or invalid, please reconnect Garmin',
          needsReauth: true,
          detail: summarizeUpstreamBody(error.body),
        },
        { status: 401 }
      )
    }

    if (error instanceof Error && /reconnect garmin|refresh token|no garmin connection/i.test(error.message)) {
      await safeMarkAuthError(userId, error.message)
      return NextResponse.json(
        {
          success: false,
          error: 'Garmin authentication expired or invalid, please reconnect Garmin',
          needsReauth: true,
          detail: error.message,
        },
        { status: 401 }
      )
    }

    logger.error('Garmin sync catalog error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load Garmin sync capabilities' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const userId = parseUserId(req)
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Valid userId is required', needsReauth: true },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(req.url)
  const triggerParam = searchParams.get('trigger')?.toLowerCase()
  const trigger: GarminSyncTrigger = triggerParam === 'backfill' ? 'backfill' : 'manual'

  const execution = await runGarminSyncForUser({
    userId,
    options: buildExecutionOptions(trigger),
  })

  return NextResponse.json(execution.body, {
    status: execution.status,
    ...(execution.headers ? { headers: execution.headers } : {}),
  })
}
