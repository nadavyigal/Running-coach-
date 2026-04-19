import 'server-only'

import { getGarminOAuthState, getValidGarminAccessToken, markGarminAuthError } from '@/lib/server/garmin-oauth-store'
import { GARMIN_HEALTH_API_BASE_URL } from '@/lib/server/garmin-endpoints'
import type {
  GarminDatasetKey,
  GarminNormalizedActivity,
  GarminOAuthConnection,
  GarminServiceError,
} from '@/lib/integrations/garmin/types'
const GARMIN_MAX_WINDOW_SECONDS = 86400
const DEFAULT_BACKOFF_MS = 750
const MAX_ATTEMPTS = 3

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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

function summarizeBody(body: string): string {
  const trimmed = body.trim()
  if (!trimmed) return 'empty response'
  return trimmed.slice(0, 300)
}

export function buildGarminServiceError(params: {
  type: GarminServiceError['type']
  message: string
  statusCode?: number
  retryable?: boolean
}): GarminServiceError {
  return {
    name: 'GarminServiceError',
    type: params.type,
    message: params.message,
    retryable: params.retryable ?? false,
    ...(params.statusCode !== undefined ? { statusCode: params.statusCode } : {}),
  }
}

export function isGarminServiceError(error: unknown): error is GarminServiceError {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'name' in error &&
      (error as { name?: unknown }).name === 'GarminServiceError'
  )
}

export function classifyGarminError(status: number, body: string): GarminServiceError {
  const message = summarizeBody(body)
  if (status === 401 || status === 403) {
    return buildGarminServiceError({
      type: 'auth_error',
      statusCode: status,
      message: `Garmin authorization failed (${status}): ${message}`,
    })
  }

  if (status === 404) {
    return buildGarminServiceError({
      type: 'not_found',
      statusCode: status,
      message: `Garmin resource not found (${status}): ${message}`,
    })
  }

  if (status === 429) {
    return buildGarminServiceError({
      type: 'rate_limit',
      statusCode: status,
      retryable: true,
      message: `Garmin rate limit reached (${status}): ${message}`,
    })
  }

  if (status >= 500) {
    return buildGarminServiceError({
      type: 'temporary_upstream',
      statusCode: status,
      retryable: true,
      message: `Garmin upstream error (${status}): ${message}`,
    })
  }

  return buildGarminServiceError({
    type: 'permanent_schema_issue',
    statusCode: status,
    message: `Garmin request failed (${status}): ${message}`,
  })
}

async function garminFetchJson<T>(params: {
  accessToken: string
  url: string
  method?: string
  headers?: Record<string, string>
}): Promise<T> {
  let lastError: GarminServiceError | null = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(params.url, {
      method: params.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        Accept: 'application/json',
        ...params.headers,
      },
    })
    const responseText = await response.text()

    if (!response.ok) {
      const error = classifyGarminError(response.status, responseText)
      lastError = error
      if (!error.retryable || attempt === MAX_ATTEMPTS) {
        throw error
      }
      await sleep(DEFAULT_BACKOFF_MS * 2 ** (attempt - 1))
      continue
    }

    try {
      return (responseText ? JSON.parse(responseText) : null) as T
    } catch {
      throw buildGarminServiceError({
        type: 'permanent_schema_issue',
        message: `Garmin returned invalid JSON for ${params.url}`,
      })
    }
  }

  throw lastError ?? buildGarminServiceError({ type: 'temporary_upstream', message: 'Garmin request failed' })
}

function extractActivityTypeKey(activity: Record<string, unknown>): string {
  const direct = getString(activity.activityType) ?? getString(activity.sport) ?? getString(activity.type)
  if (direct) return direct.toLowerCase()

  const dto = asRecord(activity.activityTypeDTO)
  const dtoKey = getString(dto.typeKey)
  if (dtoKey) return dtoKey.toLowerCase()

  const activityName = getString(activity.activityName)?.toLowerCase()
  if (activityName?.includes('run')) return 'running'
  return 'unknown'
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = getNumber(record[key])
    if (value != null) return value
  }
  return null
}

function pickRecordArray(record: Record<string, unknown>, keys: string[]): Record<string, unknown>[] {
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) {
      return value
        .map((entry) => asRecord(entry))
        .filter((entry) => Object.keys(entry).length > 0)
    }
  }
  return []
}

export function mapGarminPayloadToNormalizedActivity(
  payload: Record<string, unknown>,
  metadata?: Partial<Pick<GarminNormalizedActivity, 'sourcePayloadRef' | 'sourceExternalId'>>
): GarminNormalizedActivity | null {
  const activityIdValue = payload.activityId ?? payload.summaryId ?? payload.id
  const activityId = activityIdValue != null ? String(activityIdValue) : null
  if (!activityId) return null

  const startSeconds =
    getNumber(payload.startTimeInSeconds) ??
    getNumber(payload.startTimeLocalInSeconds) ??
    getNumber(payload.summaryStartTimeInSeconds)
  const startTime = startSeconds != null
    ? new Date(startSeconds * 1000).toISOString()
    : getString(payload.startTimeGMT) ?? getString(payload.startTime)

  if (!startTime) return null

  const distanceMeters = pickNumber(payload, ['distanceInMeters', 'distance']) ?? 0
  const durationSeconds = pickNumber(payload, ['durationInSeconds', 'duration']) ?? 0
  const averageSpeed = pickNumber(payload, ['averageSpeedInMetersPerSecond', 'averageSpeed'])
  const routePoints = pickRecordArray(payload, ['samples', 'geoPoints', 'waypoints', 'routePoints'])
  const lapSummaries = pickRecordArray(payload, ['lapSummaries', 'laps'])
  const splitSummaries = pickRecordArray(payload, ['splitSummaries', 'splits'])

  return {
    activityId,
    sourceProvider: 'garmin',
    sourceExternalId: metadata?.sourceExternalId ?? getString(payload.summaryId),
    sourcePayloadRef: metadata?.sourcePayloadRef ?? null,
    name: getString(payload.activityName) ?? 'Garmin Activity',
    typeKey: extractActivityTypeKey(payload),
    startTime,
    timezone: getString(asRecord(payload.timeZoneUnitDTO).timeZone),
    distanceMeters,
    durationSeconds: Math.max(0, Math.round(durationSeconds)),
    movingDurationSeconds: pickNumber(payload, ['movingDurationInSeconds', 'movingDuration']),
    averagePaceSecondsPerKm: averageSpeed && averageSpeed > 0 ? Math.round(1000 / averageSpeed) : null,
    elevationGainMeters: pickNumber(payload, ['totalElevationGainInMeters', 'elevationGain']),
    averageHeartRate: pickNumber(payload, ['averageHeartRateInBeatsPerMinute', 'averageHR']),
    maxHeartRate: pickNumber(payload, ['maxHeartRateInBeatsPerMinute', 'maxHR']),
    calories: pickNumber(payload, ['activeKilocalories', 'calories']),
    routePoints,
    polyline: getString(payload.polyline),
    lapSummaries,
    splitSummaries,
    raw: payload,
  }
}

function dedupeActivities(activities: GarminNormalizedActivity[]): GarminNormalizedActivity[] {
  const map = new Map<string, GarminNormalizedActivity>()
  for (const activity of activities) {
    const existing = map.get(activity.activityId)
    if (!existing) {
      map.set(activity.activityId, activity)
      continue
    }

    map.set(activity.activityId, {
      ...existing,
      ...activity,
      routePoints: activity.routePoints.length > 0 ? activity.routePoints : existing.routePoints,
      lapSummaries: activity.lapSummaries.length > 0 ? activity.lapSummaries : existing.lapSummaries,
      splitSummaries: activity.splitSummaries.length > 0 ? activity.splitSummaries : existing.splitSummaries,
      raw: { ...existing.raw, ...activity.raw },
    })
  }
  return Array.from(map.values())
}

export class GarminClient {
  constructor(private readonly connection: GarminOAuthConnection) {}

  static async forUser(userId: number): Promise<GarminClient> {
    const state = await getGarminOAuthState(userId)
    if (!state) {
      throw buildGarminServiceError({
        type: 'auth_error',
        message: 'Garmin connection not found',
      })
    }

    return new GarminClient({
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
    })
  }

  async getAccessToken(): Promise<string> {
    try {
      return await getValidGarminAccessToken(this.connection.userId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Garmin token unavailable'
      await markGarminAuthError(this.connection.userId, message)
      throw buildGarminServiceError({
        type: 'auth_error',
        message,
      })
    }
  }

  async fetchPermissions(): Promise<string[]> {
    const accessToken = await this.getAccessToken()
    const payload = await garminFetchJson<unknown>({
      accessToken,
      url: `${GARMIN_HEALTH_API_BASE_URL}/wellness-api/rest/user/permissions`,
    })

    if (Array.isArray(payload)) {
      return payload.filter((entry): entry is string => typeof entry === 'string')
    }

    const permissions = asRecord(payload).permissions
    if (Array.isArray(permissions)) {
      return permissions.filter((entry): entry is string => typeof entry === 'string')
    }

    return []
  }

  async fetchProviderUserId(): Promise<string | null> {
    const accessToken = await this.getAccessToken()
    const payload = await garminFetchJson<Record<string, unknown>>({
      accessToken,
      url: `${GARMIN_HEALTH_API_BASE_URL}/wellness-api/rest/user/id`,
    })

    return getString(payload.userId) ?? getString(payload.id)
  }

  async fetchActivitiesInRange(params: {
    startTimeInSeconds: number
    endTimeInSeconds: number
    mode: 'upload' | 'backfill'
    sourcePayloadRef?: string | null
  }): Promise<GarminNormalizedActivity[]> {
    const accessToken = await this.getAccessToken()
    const rawRows: Record<string, unknown>[] = []
    let cursor = params.startTimeInSeconds

    while (cursor <= params.endTimeInSeconds) {
      const windowEnd = Math.min(cursor + GARMIN_MAX_WINDOW_SECONDS - 1, params.endTimeInSeconds)
      const path = params.mode === 'upload'
        ? '/wellness-api/rest/activities'
        : '/wellness-api/rest/backfill/activities'
      const url = new URL(`${GARMIN_HEALTH_API_BASE_URL}${path}`)

      if (params.mode === 'upload') {
        url.searchParams.set('uploadStartTimeInSeconds', String(cursor))
        url.searchParams.set('uploadEndTimeInSeconds', String(windowEnd))
      } else {
        url.searchParams.set('summaryStartTimeInSeconds', String(cursor))
        url.searchParams.set('summaryEndTimeInSeconds', String(windowEnd))
      }

      const payload = await garminFetchJson<unknown[]>({
        accessToken,
        url: url.toString(),
      })

      rawRows.push(
        ...(payload ?? [])
          .map((entry) => asRecord(entry))
          .filter((entry) => Object.keys(entry).length > 0)
      )

      cursor = windowEnd + 1
    }

    return dedupeActivities(
      rawRows
        .map((row) =>
          mapGarminPayloadToNormalizedActivity(row, {
            sourcePayloadRef: params.sourcePayloadRef ?? null,
          })
        )
        .filter((activity): activity is GarminNormalizedActivity => Boolean(activity))
    )
  }

  async fetchActivitiesFromCallbackUrl(params: {
    callbackUrl: string
    datasetKey: GarminDatasetKey
    sourcePayloadRef?: string | null
  }): Promise<GarminNormalizedActivity[]> {
    const response = await fetch(params.callbackUrl, {
      headers: { Accept: 'application/json' },
    })
    const responseText = await response.text()

    if (!response.ok) {
      throw classifyGarminError(response.status, responseText)
    }

    let payload: unknown = null
    try {
      payload = responseText ? JSON.parse(responseText) : []
    } catch {
      throw buildGarminServiceError({
        type: 'permanent_schema_issue',
        message: `Garmin callbackURL returned invalid JSON for ${params.datasetKey}`,
      })
    }

    const rows = Array.isArray(payload)
      ? payload
      : Object.values(asRecord(payload)).find((value) => Array.isArray(value)) ?? []

    return dedupeActivities(
      (Array.isArray(rows) ? rows : [])
        .map((entry) => asRecord(entry))
        .map((row) =>
          mapGarminPayloadToNormalizedActivity(row, {
            sourceExternalId: getString(row.summaryId),
            sourcePayloadRef: params.sourcePayloadRef ?? null,
          })
        )
        .filter((activity): activity is GarminNormalizedActivity => Boolean(activity))
    )
  }

  async fetchActivityFile(callbackUrl: string): Promise<ArrayBuffer> {
    const response = await fetch(callbackUrl, {
      headers: { Accept: '*/*' },
    })

    if (!response.ok) {
      const responseText = await response.text()
      throw classifyGarminError(response.status, responseText)
    }

    return response.arrayBuffer()
  }
}
