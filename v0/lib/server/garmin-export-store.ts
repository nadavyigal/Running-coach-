import { createAdminClient } from '@/lib/supabase/admin'

const TABLE_NAME = 'user_memory_snapshots'
const DEVICE_PREFIX = 'garmin_export'
const READ_PAGE_SIZE = 1000
const MAX_READ_ROWS = 20000

export const GARMIN_HISTORY_DAYS = 56

export type GarminDatasetKey =
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

export interface GarminStoredSummaryRow {
  garminUserId: string
  datasetKey: GarminDatasetKey
  summaryId: string
  source: 'ping_pull' | 'push'
  recordedAt: string
  receivedAt: string
  payload: Record<string, unknown>
}

export interface GarminStoreOperationResult {
  ok: boolean
  storeAvailable: boolean
  storeError?: string
  storedRows: number
  droppedRows: number
}

export interface GarminStoreReadResult {
  ok: boolean
  storeAvailable: boolean
  storeError?: string
  rows: GarminStoredSummaryRow[]
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isMissingTableError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42P01') return true
  const message = error.message?.toLowerCase() ?? ''
  return message.includes('could not find the table') || message.includes('schema cache')
}

function simpleHash(value: string): string {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function buildSummaryId(datasetKey: GarminDatasetKey, row: Record<string, unknown>, index: number): string {
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
      return `${datasetKey}:${value.trim()}`
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `${datasetKey}:${value}`
    }
  }

  return `${datasetKey}:row-${index}-${simpleHash(JSON.stringify(row))}`
}

function getRecordedAtIso(row: Record<string, unknown>): string {
  const startSeconds = getNumber(row.startTimeInSeconds)
  if (startSeconds != null) {
    return new Date(startSeconds * 1000).toISOString()
  }

  const calendarDate = getString(row.calendarDate)
  if (calendarDate) {
    const parsedDate = new Date(`${calendarDate}T00:00:00.000Z`)
    if (!Number.isNaN(parsedDate.getTime())) return parsedDate.toISOString()
  }

  const isoDate = getString(row.startTimeGMT) ?? getString(row.startTimeLocal) ?? getString(row.date)
  if (isoDate) {
    const parsedDate = new Date(isoDate)
    if (!Number.isNaN(parsedDate.getTime())) return parsedDate.toISOString()
  }

  return new Date().toISOString()
}

function extractGarminUserId(
  row: Record<string, unknown>,
  fallbackGarminUserId: string | null
): string | null {
  const direct =
    getString(row.userId) ??
    getString(row.userID) ??
    getString(row.ownerUserId) ??
    getString(row.garminUserId)
  return direct ?? fallbackGarminUserId
}

function normalizeDeviceId(component: string): string {
  return component.replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, 160)
}

function buildDeviceId(garminUserId: string, datasetKey: GarminDatasetKey, summaryId: string): string {
  return `${DEVICE_PREFIX}:${normalizeDeviceId(garminUserId)}:${datasetKey}:${simpleHash(summaryId)}`
}

export function lookbackStartIso(days: number = GARMIN_HISTORY_DAYS): string {
  const now = Date.now()
  const ms = days * 24 * 60 * 60 * 1000
  return new Date(now - ms).toISOString()
}

export async function storeGarminExportRows(params: {
  datasetKey: GarminDatasetKey
  rows: Record<string, unknown>[]
  source: 'ping_pull' | 'push'
  fallbackGarminUserId?: string | null
}): Promise<GarminStoreOperationResult> {
  const { datasetKey, rows, source, fallbackGarminUserId } = params

  let supabase
  try {
    supabase = createAdminClient()
  } catch {
    return {
      ok: false,
      storeAvailable: false,
      storeError: 'Supabase admin client unavailable',
      storedRows: 0,
      droppedRows: rows.length,
    }
  }

  const receivedAt = new Date().toISOString()
  const dedupedPayload = new Map<string, Record<string, unknown>>()
  let droppedRows = 0

  for (let index = 0; index < rows.length; index += 1) {
    const row: Record<string, unknown> = rows[index] ?? {}
    const garminUserId = extractGarminUserId(row, fallbackGarminUserId ?? null)
    if (!garminUserId) {
      droppedRows += 1
      continue
    }

    const summaryId = buildSummaryId(datasetKey, row, index)
    const deviceId = buildDeviceId(garminUserId, datasetKey, summaryId)
    dedupedPayload.set(deviceId, {
      device_id: deviceId,
      user_id: null,
      snapshot: {
        kind: 'garmin_export_record',
        garminUserId,
        datasetKey,
        summaryId,
        source,
        recordedAt: getRecordedAtIso(row),
        receivedAt,
        payload: row,
      },
      summary: {
        datasetKey,
        source,
      },
      last_seen_at: receivedAt,
      updated_at: receivedAt,
    })
  }

  if (dedupedPayload.size === 0) {
    return {
      ok: true,
      storeAvailable: true,
      storedRows: 0,
      droppedRows,
    }
  }

  const { error } = await supabase
    .from(TABLE_NAME)
    .upsert(Array.from(dedupedPayload.values()), { onConflict: 'device_id' })

  if (error) {
    if (isMissingTableError(error)) {
      return {
        ok: false,
        storeAvailable: false,
        storeError: `${TABLE_NAME} table is missing`,
        storedRows: 0,
        droppedRows: rows.length,
      }
    }
    return {
      ok: false,
      storeAvailable: true,
      storeError: error.message,
      storedRows: 0,
      droppedRows: rows.length,
    }
  }

  return {
    ok: true,
    storeAvailable: true,
    storedRows: dedupedPayload.size,
    droppedRows,
  }
}

export async function readGarminExportRows(params: {
  garminUserId: string
  sinceIso?: string
}): Promise<GarminStoreReadResult> {
  const { garminUserId, sinceIso = lookbackStartIso() } = params

  let supabase
  try {
    supabase = createAdminClient()
  } catch {
    return {
      ok: false,
      storeAvailable: false,
      storeError: 'Supabase admin client unavailable',
      rows: [],
    }
  }

  const prefix = `${DEVICE_PREFIX}:${normalizeDeviceId(garminUserId)}:%`
  const allRows: Array<{ snapshot?: unknown; updated_at?: string }> = []
  let page = 0

  while (allRows.length < MAX_READ_ROWS) {
    const from = page * READ_PAGE_SIZE
    const to = from + READ_PAGE_SIZE - 1

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('snapshot,updated_at')
      .like('device_id', prefix)
      .gte('updated_at', sinceIso)
      .order('updated_at', { ascending: false })
      .range(from, to)

    if (error) {
      if (isMissingTableError(error)) {
        return {
          ok: false,
          storeAvailable: false,
          storeError: `${TABLE_NAME} table is missing`,
          rows: [],
        }
      }

      return {
        ok: false,
        storeAvailable: true,
        storeError: error.message,
        rows: [],
      }
    }

    const pageRows = (data ?? []) as Array<{ snapshot?: unknown; updated_at?: string }>
    allRows.push(...pageRows)
    if (pageRows.length < READ_PAGE_SIZE) break

    page += 1
  }

  if (allRows.length >= MAX_READ_ROWS) {
    allRows.length = MAX_READ_ROWS
  }

  const rows: GarminStoredSummaryRow[] = []
  for (const entry of allRows) {
    const snapshot = asRecord((entry as { snapshot?: unknown }).snapshot)
    if (snapshot.kind !== 'garmin_export_record') continue

    const rowUserId = getString(snapshot.garminUserId)
    const datasetKey = getString(snapshot.datasetKey)
    const summaryId = getString(snapshot.summaryId)
    const sourceRaw = getString(snapshot.source)
    const recordedAt = getString(snapshot.recordedAt)
    const receivedAt = getString(snapshot.receivedAt)
    const payload = asRecord(snapshot.payload)

    if (
      !rowUserId ||
      !datasetKey ||
      !summaryId ||
      !recordedAt ||
      !receivedAt ||
      Object.keys(payload).length === 0
    ) {
      continue
    }

    if (rowUserId !== garminUserId) continue

    rows.push({
      garminUserId: rowUserId,
      datasetKey: datasetKey as GarminDatasetKey,
      summaryId,
      source: sourceRaw === 'push' ? 'push' : 'ping_pull',
      recordedAt,
      receivedAt,
      payload,
    })
  }

  return {
    ok: true,
    storeAvailable: true,
    rows,
  }
}

export function groupRowsByDataset(
  rows: GarminStoredSummaryRow[]
): Record<GarminDatasetKey, Record<string, unknown>[]> {
  const grouped: Record<GarminDatasetKey, Record<string, unknown>[]> = {
    activities: [],
    manuallyUpdatedActivities: [],
    activityDetails: [],
    dailies: [],
    epochs: [],
    sleeps: [],
    bodyComps: [],
    stressDetails: [],
    userMetrics: [],
    pulseox: [],
    allDayRespiration: [],
    healthSnapshot: [],
    hrv: [],
    bloodPressures: [],
    skinTemp: [],
  }

  for (const row of rows) {
    if (!(row.datasetKey in grouped)) continue
    grouped[row.datasetKey].push(row.payload)
  }

  return grouped
}
