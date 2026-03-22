"use client"

import { db, type WearableDevice } from '@/lib/db'
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
  warnings?: unknown
  error?: string
  needsReauth?: boolean
  reason?: string | null
  retryAfterSeconds?: unknown
  details?: unknown
}

interface GarminSyncRequestOptions {
  trigger?: 'manual' | 'backfill'
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

async function upsertLocalGarminDeviceState(params: {
  userId: number
  existingDevice: WearableDevice | null
  lastSyncAt: Date | null
  connectionStatus: WearableDevice['connectionStatus']
}): Promise<WearableDevice | null> {
  const { userId, existingDevice, lastSyncAt, connectionStatus } = params

  if (existingDevice?.id) {
    await db.wearableDevices.update(existingDevice.id, {
      lastSync: lastSyncAt,
      connectionStatus,
      updatedAt: new Date(),
    })
    return {
      ...existingDevice,
      lastSync: lastSyncAt,
      connectionStatus,
      updatedAt: new Date(),
    }
  }

  const now = new Date()
  const nextDevice: WearableDevice = {
    userId,
    type: 'garmin',
    name: 'Garmin Connect',
    model: 'Garmin',
    deviceId: `garmin-${userId}`,
    connectionStatus,
    lastSync: lastSyncAt,
    capabilities: [],
    settings: {},
    createdAt: now,
    updatedAt: now,
  }

  const id = await db.wearableDevices.add(nextDevice)
  return {
    ...nextDevice,
    id,
  }
}

function getManualSyncErrorMessage(payload: GarminManualSyncApiResponse): string {
  const directError = getString(payload.error)
  if (directError) return directError

  const details = asRecord(payload.details)
  const detailError = getString(details.error)
  if (detailError) {
    if (payload.reason === 'hourly_limit') {
      const retryAfterSeconds = getNumber(payload.retryAfterSeconds)
      if (retryAfterSeconds != null) {
        return `${detailError} Try again in ${retryAfterSeconds} seconds.`
      }
    }
    return detailError
  }

  return 'Garmin sync request failed'
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
      if (device) {
        await markDeviceForReauth(device)
      }
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

export async function syncGarminEnabledData(
  userId: number,
  options?: GarminSyncRequestOptions
): Promise<GarminEnabledSyncResult> {
  const device = await getConnectedGarminDevice(userId)

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
    const needsReauth = response.status === 401 || payload.connected === false || payload.needsReauth === true
    if (needsReauth) {
      if (device) {
        await markDeviceForReauth(device)
      }
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
  
        datasetImports: {},
        notices: [],
        needsReauth: true,
        errors: [payload.error || 'Garmin authentication expired - please reconnect'],
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
  
        datasetImports: {},
        notices: parseNotices(payload.warnings),
        needsReauth: false,
        errors: [getManualSyncErrorMessage(payload)],
      }
    }

    await syncGarminRunsToClient(userId)

    const lastSyncAt = getString(payload.lastSyncAt)
    const refreshedAt = lastSyncAt ? new Date(lastSyncAt) : new Date()
    await upsertLocalGarminDeviceState({
      userId,
      existingDevice: device,
      lastSyncAt: refreshedAt,
      connectionStatus: 'connected',
    })

    await deduplicateGarminRuns(userId)

    const catalog = await getGarminSyncCatalog(userId)
    const activitiesImported = getNumber(payload.activitiesUpserted) ?? 0
    const activitiesSkipped = getNumber(payload.duplicateActivitiesSkipped) ?? 0
    const additionalSummaryImported = getNumber(payload.dailyMetricsUpserted) ?? 0

    return {
      syncName: catalog.syncName,
      lastSyncAt: refreshedAt,
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
      datasetImports: {
        dailyMetrics: { imported: additionalSummaryImported, skipped: 0 },
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

      datasetImports: {},
      notices: [],
      needsReauth: false,
      errors: [error instanceof Error ? error.message : 'Unknown Garmin sync error'],
    }
  }
}
