import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import {
  GARMIN_HISTORY_DAYS,
  type GarminDatasetKey,
  groupRowsByDataset,
  lookbackStartIso,
  readGarminExportRows,
} from '@/lib/server/garmin-export-store'

export const dynamic = 'force-dynamic'

const GARMIN_API_BASE = 'https://apis.garmin.com'
const SYNC_NAME = 'RunSmart Garmin Export Sync'

type GarminPermission = 'ACTIVITY_EXPORT' | 'HEALTH_EXPORT'
type GarminSyncDatasetKey = GarminDatasetKey | 'workoutImport'

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

function toRunSmartActivity(activity: Record<string, unknown>) {
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
  }
}

function toRunSmartSleepRecord(entry: Record<string, unknown>) {
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
}): GarminDatasetCapability[] {
  const { permissions, datasetCounts, storeAvailable, storeError } = params

  const capabilities = DATASET_CONFIGS.map((config) => {
    const permissionGranted = permissions.includes(config.permission)
    const rowCount = datasetCounts[config.key] ?? 0

    let reason: string | undefined
    if (!permissionGranted) {
      reason = `Missing ${config.permission} permission.`
    } else if (!storeAvailable) {
      reason = storeError ?? 'RunSmart Garmin webhook storage is not configured.'
    } else if (rowCount === 0) {
      reason = 'No Garmin export notifications received for this dataset in the last 30 days.'
    }

    return {
      key: config.key,
      label: config.label,
      permissionGranted,
      endpointReachable: permissionGranted && storeAvailable,
      enabledForSync: permissionGranted && storeAvailable,
      supportedByRunSmart: true,
      ...(reason ? { reason } : {}),
    } satisfies GarminDatasetCapability
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

async function computeCatalog(accessToken: string): Promise<GarminCatalogResult> {
  const [permissions, garminUserId] = await Promise.all([
    fetchGarminPermissions(accessToken),
    fetchGarminUserId(accessToken),
  ])

  const readResult = await readGarminExportRows({
    garminUserId,
    sinceIso: lookbackStartIso(GARMIN_HISTORY_DAYS),
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
      storeError: readResult.storeError,
    }),
    datasets,
    datasetCounts,
    ingestion: {
      lookbackDays: GARMIN_HISTORY_DAYS,
      storeAvailable: readResult.storeAvailable,
      ...(readResult.storeError ? { storeError: readResult.storeError } : {}),
      recordsInWindow: readResult.rows.length,
      latestReceivedAt,
    },
  }
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}

export async function GET(req: Request) {
  const accessToken = getBearerToken(req)
  if (!accessToken) {
    return NextResponse.json(
      { success: false, error: 'Authorization token required', needsReauth: true },
      { status: 401 }
    )
  }

  try {
    const { permissions, capabilities, ingestion } = await computeCatalog(accessToken)

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

    logger.error('Garmin sync catalog error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load Garmin sync capabilities' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const accessToken = getBearerToken(req)
  if (!accessToken) {
    return NextResponse.json(
      { success: false, error: 'Authorization token required', needsReauth: true },
      { status: 401 }
    )
  }

  try {
    const { permissions, capabilities, datasets, datasetCounts, ingestion } = await computeCatalog(accessToken)
    const notices: string[] = []

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
    if (ingestion.storeAvailable && totalRows === 0) {
      notices.push(
        'No Garmin export records received in the last 30 days. Ensure Garmin ping/pull or push notifications point to /api/devices/garmin/webhook.'
      )
    }

    const activityRows = [
      ...datasets.activities,
      ...datasets.manuallyUpdatedActivities,
      ...datasets.activityDetails,
    ]

    const mappedActivities = activityRows
      .map((entry) => toRunSmartActivity(entry))
      .filter((activity) => activity.activityType.includes('run'))

    const uniqueActivities: typeof mappedActivities = []
    const seenActivityIds = new Set<string>()

    for (const activity of mappedActivities) {
      const dedupeKey = activity.activityId ?? `${activity.startTimeGMT ?? 'unknown'}-${activity.activityName}`
      if (seenActivityIds.has(dedupeKey)) continue
      seenActivityIds.add(dedupeKey)
      uniqueActivities.push(activity)
    }

    const sleep = datasets.sleeps
      .map((entry) => toRunSmartSleepRecord(entry))
      .filter((entry): entry is NonNullable<typeof entry> => entry != null)

    return NextResponse.json({
      success: true,
      syncName: SYNC_NAME,
      permissions,
      availableToEnable: AVAILABLE_TO_ENABLE,
      capabilities,
      ingestion,
      datasets,
      datasetCounts,
      activities: uniqueActivities,
      sleep,
      notices,
    })
  } catch (error) {
    if (error instanceof GarminUpstreamError && isAuthError(error.status, error.body)) {
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

    logger.error('Garmin enabled sync error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to run Garmin enabled sync' },
      { status: 500 }
    )
  }
}
