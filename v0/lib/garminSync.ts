"use client"

import { db, type GarminSummaryRecord, type Run, type SleepData, type WearableDevice } from '@/lib/db'
import { deduplicateGarminRuns } from '@/lib/dbUtils'
import { syncGarminRunsToClient } from '@/lib/garmin/client-sync'

export interface GarminEnablementItem {
  key: string
  permission: string
  description: string
  supportedByRunSmart: boolean
}

export interface GarminDatasetCapability {
  key:
    | 'activities'
    | 'manuallyUpdatedActivities'
    | 'activityDetails'
    | 'dailies'
    | 'epochs'
    | 'sleeps'
    | 'bodyComps'
    | 'stressDetails'
    | 'userMetrics'
    | 'pulseox'
    | 'allDayRespiration'
    | 'healthSnapshot'
    | 'hrv'
    | 'bloodPressures'
    | 'skinTemp'
    | 'workoutImport'
  label: string
  permissionGranted: boolean
  endpointReachable: boolean
  enabledForSync: boolean
  supportedByRunSmart: boolean
  reason?: string
}

export interface GarminDatasetImportStat {
  imported: number
  skipped: number
}

export interface GarminSyncCatalogResult {
  syncName: string
  permissions: string[]
  availableToEnable: GarminEnablementItem[]
  capabilities: GarminDatasetCapability[]
  ingestion?: {
    lookbackDays: number
    storeAvailable: boolean
    storeError?: string
    recordsInWindow: number
    latestReceivedAt: string | null
  }
  needsReauth: boolean
  errors: string[]
}

export interface GarminEnabledSyncResult extends GarminSyncCatalogResult {
  lastSyncAt: Date | null
  activitiesImported: number
  activitiesSkipped: number
  sleepImported: number
  sleepSkipped: number
  additionalSummaryImported: number
  additionalSummarySkipped: number
  fitFilesProcessed: number
  datasetImports: Record<string, GarminDatasetImportStat>
  notices: string[]
}

interface GarminSyncApiResponse {
  success?: boolean
  syncName?: string
  permissions?: unknown
  availableToEnable?: unknown
  capabilities?: unknown
  ingestion?: unknown
  datasets?: unknown
  datasetCounts?: unknown
  activities?: unknown
  sleep?: unknown
  notices?: unknown
  error?: string
  detail?: unknown
  needsReauth?: boolean
}

interface GarminManualSyncApiResponse {
  success?: boolean
  connected?: boolean
  lastSyncAt?: string | null
  activitiesUpserted?: unknown
  dailyMetricsUpserted?: unknown
  duplicateActivitiesSkipped?: unknown
  activityFilesProcessed?: unknown
  warnings?: unknown
  error?: string
}

interface GarminSyncRequestOptions {
  trigger?: 'manual' | 'backfill'
}

interface GarminActivityPayload {
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

interface GarminSleepPayload {
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
        overall?: {
          value?: number
        }
      }
    | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

function parseEnablementItems(value: unknown): GarminEnablementItem[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => asRecord(entry))
    .map((entry) => ({
      key: String(entry.key ?? ''),
      permission: String(entry.permission ?? ''),
      description: String(entry.description ?? ''),
      supportedByRunSmart: Boolean(entry.supportedByRunSmart),
    }))
    .filter((entry) => entry.key.length > 0 && entry.permission.length > 0)
}

function parseCapabilities(value: unknown): GarminDatasetCapability[] {
  if (!Array.isArray(value)) return []

  const validKeys = new Set([
    'activities',
    'manuallyUpdatedActivities',
    'activityDetails',
    'dailies',
    'epochs',
    'sleeps',
    'bodyComps',
    'stressDetails',
    'userMetrics',
    'pulseox',
    'allDayRespiration',
    'healthSnapshot',
    'hrv',
    'bloodPressures',
    'skinTemp',
    'workoutImport',
  ])

  return value
    .map((entry) => asRecord(entry))
    .map((entry) => {
      const key = String(entry.key ?? '')
      if (!validKeys.has(key)) return null

      return {
        key: key as GarminDatasetCapability['key'],
        label: String(entry.label ?? key),
        permissionGranted: Boolean(entry.permissionGranted),
        endpointReachable: Boolean(entry.endpointReachable),
        enabledForSync: Boolean(entry.enabledForSync),
        supportedByRunSmart: Boolean(entry.supportedByRunSmart),
        ...(getString(entry.reason) ? { reason: String(entry.reason) } : {}),
      }
    })
    .filter((entry): entry is GarminDatasetCapability => entry != null)
}

function parseActivities(value: unknown): GarminActivityPayload[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => asRecord(entry))
    .map((entry) => {
      const activityType = String(entry.activityType ?? '')
      if (!activityType) return null

      const activityIdRaw = entry.activityId
      return {
        activityId: activityIdRaw == null ? null : String(activityIdRaw),
        activityName: String(entry.activityName ?? 'Garmin activity'),
        activityType,
        startTimeGMT: getString(entry.startTimeGMT),
        distance: getNumber(entry.distance) ?? 0,
        duration: Math.max(0, Math.round(getNumber(entry.duration) ?? 0)),
        averageHR: getNumber(entry.averageHR),
        maxHR: getNumber(entry.maxHR),
        calories: getNumber(entry.calories),
        averagePace: getNumber(entry.averagePace),
        elevationGain: getNumber(entry.elevationGain),
      }
    })
    .filter((entry): entry is GarminActivityPayload => entry != null)
}

function parseSleep(value: unknown): GarminSleepPayload[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => asRecord(entry))
    .map((entry): GarminSleepPayload | null => {
      const date = getString(entry.date)
      if (!date) return null

      const sleepScoresRecord = asRecord(entry.sleepScores)
      const overallRecord = asRecord(sleepScoresRecord.overall)
      const overallValue = getNumber(overallRecord.value)

      return {
        date,
        sleepStartTimestampGMT: getNumber(entry.sleepStartTimestampGMT),
        sleepEndTimestampGMT: getNumber(entry.sleepEndTimestampGMT),
        totalSleepSeconds: getNumber(entry.totalSleepSeconds),
        deepSleepSeconds: getNumber(entry.deepSleepSeconds),
        lightSleepSeconds: getNumber(entry.lightSleepSeconds),
        remSleepSeconds: getNumber(entry.remSleepSeconds),
        awakeSleepSeconds: getNumber(entry.awakeSleepSeconds),
        sleepScores:
          Object.keys(overallRecord).length > 0
            ? { overall: { ...(overallValue != null ? { value: overallValue } : {}) } }
            : null,
      }
    })
    .filter((entry): entry is GarminSleepPayload => entry != null)
}

function parseDatasetRows(value: unknown): Record<string, Record<string, unknown>[]> {
  const parsed: Record<string, Record<string, unknown>[]> = {}
  if (typeof value !== 'object' || value == null) return parsed

  for (const [key, rows] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(rows)) {
      parsed[key] = []
      continue
    }

    parsed[key] = rows
      .map((entry) => asRecord(entry))
      .filter((entry) => Object.keys(entry).length > 0)
  }

  return parsed
}

function parseNotices(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
}

function parseIngestion(value: unknown): GarminSyncCatalogResult['ingestion'] {
  const record = asRecord(value)
  const lookbackDays = getNumber(record.lookbackDays)
  const recordsInWindow = getNumber(record.recordsInWindow)
  const storeAvailable = typeof record.storeAvailable === 'boolean' ? record.storeAvailable : null

  if (lookbackDays == null || recordsInWindow == null || storeAvailable == null) {
    return undefined
  }

  return {
    lookbackDays,
    storeAvailable,
    ...(getString(record.storeError) ? { storeError: String(record.storeError) } : {}),
    recordsInWindow,
    latestReceivedAt: getString(record.latestReceivedAt),
  }
}

function summarizeGarminDetail(detail: unknown): string {
  if (detail == null) return ''

  const raw = typeof detail === 'string' ? detail : JSON.stringify(detail)
  const trimmed = raw.trim()
  if (!trimmed) return ''

  try {
    const parsed = JSON.parse(trimmed) as {
      errorMessage?: unknown
      message?: unknown
      error?: unknown
    }
    const message = [parsed.errorMessage, parsed.message, parsed.error].find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0
    )
    if (message) return message.slice(0, 240)
  } catch {
    // Keep original text when body is not JSON.
  }

  if (/<!doctype html|<html/i.test(trimmed)) {
    return 'Garmin returned an HTML error page'
  }

  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed
}

function garminActivityTypeToRunType(typeKey: string): Run['type'] {
  switch (typeKey) {
    case 'running':
    case 'track_running':
    case 'treadmill_running':
      return 'easy'
    case 'tempo_running':
      return 'tempo'
    case 'trail_running':
      return 'long'
    default:
      return 'other'
  }
}

function simpleHash(value: string): string {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash.toString(16)
}

function buildSummaryId(datasetKey: string, row: Record<string, unknown>, index: number): string {
  const candidateKeys = [
    'summaryId',
    'activityId',
    'sleepSummaryId',
    'calendarDate',
    'startTimeInSeconds',
    'startTimeGMT',
    'date',
  ]

  for (const key of candidateKeys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return `${datasetKey}:${value}`
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `${datasetKey}:${value}`
    }
  }

  return `${datasetKey}:row-${index}-${simpleHash(JSON.stringify(row))}`
}

function getRecordedAt(row: Record<string, unknown>): Date {
  const startSeconds = getNumber(row.startTimeInSeconds)
  if (startSeconds != null) {
    return new Date(startSeconds * 1000)
  }

  const calendarDate = getString(row.calendarDate)
  if (calendarDate) {
    const parsedDate = new Date(`${calendarDate}T00:00:00`)
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate
    }
  }

  const startIso = getString(row.startTimeGMT) ?? getString(row.startTimeLocal) ?? getString(row.date)
  if (startIso) {
    const parsedIso = new Date(startIso)
    if (!Number.isNaN(parsedIso.getTime())) {
      return parsedIso
    }
  }

  return new Date()
}

async function getConnectedGarminDevice(userId: number): Promise<WearableDevice | null> {
  const device = await db.wearableDevices
    .where('[userId+type]')
    .equals([userId, 'garmin'])
    .first()

  if (!device || device.connectionStatus === 'disconnected') return null
  return device as WearableDevice
}

async function markDeviceForReauth(device: WearableDevice): Promise<void> {
  if (!device.id) return
  await db.wearableDevices.update(device.id, {
    connectionStatus: 'error',
    updatedAt: new Date(),
  })
}

async function runGarminSyncRequest(
  userId: number,
  method: 'GET' | 'POST',
  options?: GarminSyncRequestOptions
): Promise<{
  device: WearableDevice | null
  data: GarminSyncApiResponse | null
  needsReauth: boolean
  errors: string[]
}> {
  const device = await getConnectedGarminDevice(userId)
  if (!device) {
    return { device: null, data: null, needsReauth: false, errors: ['No connected Garmin device found'] }
  }

  try {
    const params = new URLSearchParams({
      userId: String(userId),
    })

    if (method === 'POST' && options?.trigger === 'backfill') {
      params.set('trigger', 'backfill')
    }

    const res = await fetch(`/api/devices/garmin/sync?${params.toString()}`, {
      method,
      headers: { 'x-user-id': String(userId) },
    })

    const data = (await res.json()) as GarminSyncApiResponse
    const needsReauth = Boolean(data.needsReauth) || res.status === 401

    if (needsReauth) {
      await markDeviceForReauth(device)
      return {
        device,
        data,
        needsReauth: true,
        errors: ['Garmin authentication expired - please reconnect'],
      }
    }

    if (!data.success) {
      const detail = summarizeGarminDetail(data.detail)
      const message = [data.error || 'Garmin sync request failed', detail].filter(Boolean).join(' ')
      return { device, data, needsReauth: false, errors: [message] }
    }

    return { device, data, needsReauth: false, errors: [] }
  } catch (error) {
    return {
      device,
      data: null,
      needsReauth: false,
      errors: [error instanceof Error ? error.message : 'Unknown Garmin sync error'],
    }
  }
}

function buildCatalogResult(data: GarminSyncApiResponse): Omit<GarminSyncCatalogResult, 'needsReauth' | 'errors'> {
  const ingestion = parseIngestion(data.ingestion)
  return {
    syncName: typeof data.syncName === 'string' ? data.syncName : 'RunSmart Garmin Export Sync',
    permissions: parseStringArray(data.permissions),
    availableToEnable: parseEnablementItems(data.availableToEnable),
    capabilities: parseCapabilities(data.capabilities),
    ...(ingestion !== undefined ? { ingestion } : {}),
  }
}

export async function getGarminSyncCatalog(userId: number): Promise<GarminSyncCatalogResult> {
  const requestResult = await runGarminSyncRequest(userId, 'GET')

  if (!requestResult.data || requestResult.errors.length > 0 || requestResult.needsReauth) {
    return {
      syncName: 'RunSmart Garmin Export Sync',
      permissions: [],
      availableToEnable: [],
      capabilities: [],
      needsReauth: requestResult.needsReauth,
      errors: requestResult.errors,
    }
  }

  return {
    ...buildCatalogResult(requestResult.data),
    needsReauth: false,
    errors: [],
  }
}

async function importGarminSummaryRows(params: {
  userId: number
  datasets: Record<string, Record<string, unknown>[]>
}): Promise<Record<string, GarminDatasetImportStat>> {
  const { userId, datasets } = params
  const result: Record<string, GarminDatasetImportStat> = {}

  for (const [datasetKey, rows] of Object.entries(datasets)) {
    let imported = 0
    let skipped = 0

    for (let index = 0; index < rows.length; index += 1) {
      const row: Record<string, unknown> = rows[index] ?? {}
      const summaryId = buildSummaryId(datasetKey, row, index)

      const existing = await db.garminSummaryRecords
        .where('[userId+datasetKey+summaryId]')
        .equals([userId, datasetKey, summaryId])
        .count()

      if (existing > 0) {
        skipped += 1
        continue
      }

      const record: Omit<GarminSummaryRecord, 'id'> = {
        userId,
        datasetKey,
        summaryId,
        source: 'garmin',
        recordedAt: getRecordedAt(row),
        payload: JSON.stringify(row),
        importedAt: new Date(),
      }

      await db.garminSummaryRecords.add(record as GarminSummaryRecord)
      imported += 1
    }

    result[datasetKey] = { imported, skipped }
  }

  return result
}

async function matchGarminRunToWorkout(userId: number, run: Run): Promise<void> {
  const runDate = new Date(run.completedAt)
  if (Number.isNaN(runDate.getTime())) return

  const dayStart = new Date(runDate)
  dayStart.setDate(dayStart.getDate() - 1)
  dayStart.setHours(0, 0, 0, 0)

  const dayEnd = new Date(runDate)
  dayEnd.setDate(dayEnd.getDate() + 1)
  dayEnd.setHours(23, 59, 59, 999)

  const candidates = await db.workouts
    .where('[userId+scheduledDate]')
    .between([userId, dayStart], [userId, dayEnd])
    .and((workout) => !workout.completed)
    .toArray()

  if (candidates.length === 0) return

  const match =
    candidates.find((workout) => {
      const plannedDistance = Math.max(workout.distance, 0.1)
      const distRatio = Math.abs(workout.distance - run.distance) / plannedDistance
      return distRatio < 0.25
    }) ?? candidates[0]

  if (!match?.id) return

  await db.workouts.update(match.id, {
    completed: true,
    completedAt: run.completedAt,
    actualDistanceKm: run.distance,
    actualDurationMinutes: Math.round(run.duration / 60),
    ...(run.pace != null ? { actualPace: run.pace } : {}),
    updatedAt: new Date(),
  })

  if (run.id) {
    await db.runs.update(run.id, {
      workoutId: match.id,
      updatedAt: new Date(),
    })
  }
}

export async function syncGarminEnabledData(
  userId: number,
  options?: GarminSyncRequestOptions
): Promise<GarminEnabledSyncResult> {
  const device = await getConnectedGarminDevice(userId)

  if (!device) {
    return {
      syncName: 'RunSmart Garmin Export Sync',
      lastSyncAt: null,
      permissions: [],
      availableToEnable: [],
      capabilities: [],
      activitiesImported: 0,
      activitiesSkipped: 0,
      sleepImported: 0,
      sleepSkipped: 0,
      additionalSummaryImported: 0,
      additionalSummarySkipped: 0,
      fitFilesProcessed: 0,
      datasetImports: {},
      notices: [],
      needsReauth: false,
      errors: ['No connected Garmin device found'],
    }
  }

  try {
    const params = new URLSearchParams({ userId: String(userId) })
    if (options?.trigger === 'backfill') {
      params.set('trigger', 'backfill')
    }

    const response = await fetch(`/api/garmin/sync?${params.toString()}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-user-id': String(userId),
      },
      body: JSON.stringify({
        userId,
        trigger: options?.trigger ?? 'manual',
      }),
    })

    const payload = (await response.json()) as GarminManualSyncApiResponse
    if (response.status === 401 || payload.connected === false) {
      await markDeviceForReauth(device)
      return {
        syncName: 'RunSmart Garmin Export Sync',
        lastSyncAt: null,
        permissions: [],
        availableToEnable: [],
        capabilities: [],
        activitiesImported: 0,
        activitiesSkipped: 0,
        sleepImported: 0,
        sleepSkipped: 0,
        additionalSummaryImported: 0,
        additionalSummarySkipped: 0,
        fitFilesProcessed: 0,
        datasetImports: {},
        notices: [],
        needsReauth: true,
        errors: ['Garmin authentication expired - please reconnect'],
      }
    }

    if (!response.ok || !payload.success) {
      return {
        syncName: 'RunSmart Garmin Export Sync',
        lastSyncAt: null,
        permissions: [],
        availableToEnable: [],
        capabilities: [],
        activitiesImported: 0,
        activitiesSkipped: 0,
        sleepImported: 0,
        sleepSkipped: 0,
        additionalSummaryImported: 0,
        additionalSummarySkipped: 0,
        fitFilesProcessed: 0,
        datasetImports: {},
        notices: parseNotices(payload.warnings),
        needsReauth: false,
        errors: [payload.error || 'Garmin sync request failed'],
      }
    }

    await syncGarminRunsToClient(userId)

    const lastSyncAt = getString(payload.lastSyncAt)
    if (device.id) {
      await db.wearableDevices.update(device.id, {
        lastSync: lastSyncAt ? new Date(lastSyncAt) : new Date(),
        connectionStatus: 'connected',
        updatedAt: new Date(),
      })
    }

    await deduplicateGarminRuns(userId)

    const catalog = await getGarminSyncCatalog(userId)
    const activitiesImported = getNumber(payload.activitiesUpserted) ?? 0
    const activitiesSkipped = getNumber(payload.duplicateActivitiesSkipped) ?? 0
    const additionalSummaryImported = getNumber(payload.dailyMetricsUpserted) ?? 0
    const fitFilesProcessed = getNumber(payload.activityFilesProcessed) ?? 0

    return {
      syncName: catalog.syncName,
      lastSyncAt: lastSyncAt ? new Date(lastSyncAt) : new Date(),
      permissions: catalog.permissions,
      availableToEnable: catalog.availableToEnable,
      capabilities: catalog.capabilities,
      ...(catalog.ingestion ? { ingestion: catalog.ingestion } : {}),
      activitiesImported,
      activitiesSkipped,
      sleepImported: 0,
      sleepSkipped: 0,
      additionalSummaryImported,
      additionalSummarySkipped: 0,
      fitFilesProcessed,
      datasetImports: {
        dailyMetrics: { imported: additionalSummaryImported, skipped: 0 },
        activityFiles: { imported: fitFilesProcessed, skipped: 0 },
      },
      notices: parseNotices(payload.warnings),
      needsReauth: false,
      errors: [],
    }
  } catch (error) {
    return {
      syncName: 'RunSmart Garmin Export Sync',
      lastSyncAt: null,
      permissions: [],
      availableToEnable: [],
      capabilities: [],
      activitiesImported: 0,
      activitiesSkipped: 0,
      sleepImported: 0,
      sleepSkipped: 0,
      additionalSummaryImported: 0,
      additionalSummarySkipped: 0,
      fitFilesProcessed: 0,
      datasetImports: {},
      notices: [],
      needsReauth: false,
      errors: [error instanceof Error ? error.message : 'Unknown Garmin sync error'],
    }
  }
}
