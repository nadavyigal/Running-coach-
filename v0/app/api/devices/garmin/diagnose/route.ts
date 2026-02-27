import { NextResponse } from 'next/server'
import {
  GARMIN_HISTORY_DAYS,
  type GarminStoredSummaryRow,
  groupRowsByDataset,
  lookbackStartIso,
  readGarminExportRows,
} from '@/lib/server/garmin-export-store'
import {
  getValidGarminAccessToken,
  markGarminAuthError,
  refreshGarminAccessToken,
} from '@/lib/server/garmin-oauth-store'
import { getGarminWebhookSecret } from '@/lib/server/garmin-webhook-secret'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const GARMIN_API_BASE = 'https://apis.garmin.com'

interface EndpointResult {
  url: string
  status: number
  ok: boolean
  body: unknown
}

interface ProbeResult {
  ok: boolean
  error?: string
}

interface BackendReadinessResult {
  env: {
    supabaseUrlConfigured: boolean
    supabaseServiceRoleConfigured: boolean
    garminClientIdConfigured: boolean
    garminClientSecretConfigured: boolean
    garminWebhookSecretConfigured: boolean
  }
  tables: Record<string, ProbeResult>
  columns: Record<string, ProbeResult>
  blockers: string[]
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function includesPermission(permissions: string[], name: string): boolean {
  return permissions.includes(name)
}

async function testEndpoint(token: string, url: string): Promise<EndpointResult> {
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })
    let body: unknown
    const text = await res.text()
    try {
      body = JSON.parse(text)
    } catch {
      body = /<!doctype html|<html/i.test(text.trim()) ? 'Garmin returned an HTML error page' : text
    }
    return { url, status: res.status, ok: res.ok, body }
  } catch (e) {
    return { url, status: -1, ok: false, body: String(e) }
  }
}

function parsePermissions(result: EndpointResult): string[] {
  if (!result.ok || result.body == null) return []
  // Garmin returns a bare JSON array: ["ACTIVITY_EXPORT", "HEALTH_EXPORT", ...]
  if (Array.isArray(result.body)) {
    return result.body.filter((entry): entry is string => typeof entry === 'string')
  }
  if (typeof result.body !== 'object') return []
  // Fallback: handle object-wrapped form { permissions: [...] }
  const permissions = (result.body as { permissions?: unknown }).permissions
  return Array.isArray(permissions)
    ? permissions.filter((entry): entry is string => typeof entry === 'string')
    : []
}

async function safeMarkAuthError(userId: number, message: string): Promise<void> {
  try {
    await markGarminAuthError(userId, message)
  } catch {
    // Diagnostics should still return even if auth-state persistence fails.
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

async function runDiagnosticProbe(accessToken: string) {
  const [profile, permissionsResult] = await Promise.all([
    testEndpoint(accessToken, `${GARMIN_API_BASE}/wellness-api/rest/user/id`),
    testEndpoint(accessToken, `${GARMIN_API_BASE}/wellness-api/rest/user/permissions`),
  ])
  return { profile, permissionsResult }
}

function summarizeProbeError(error: unknown): string {
  if (!error) return 'Unknown error'
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '')
    return message.length > 0 ? message : 'Unknown error'
  }
  return String(error)
}

async function runBackendReadinessProbe(): Promise<BackendReadinessResult> {
  const env = {
    supabaseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseServiceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    garminClientIdConfigured: Boolean(process.env.GARMIN_CLIENT_ID),
    garminClientSecretConfigured: Boolean(process.env.GARMIN_CLIENT_SECRET),
    garminWebhookSecretConfigured: Boolean(getGarminWebhookSecret().value),
  }

  const blockers: string[] = []
  if (!env.supabaseUrlConfigured) blockers.push('NEXT_PUBLIC_SUPABASE_URL is not configured.')
  if (!env.supabaseServiceRoleConfigured) blockers.push('SUPABASE_SERVICE_ROLE_KEY is not configured.')
  if (!env.garminClientIdConfigured) blockers.push('GARMIN_CLIENT_ID is not configured.')
  if (!env.garminClientSecretConfigured) blockers.push('GARMIN_CLIENT_SECRET is not configured.')
  if (!env.garminWebhookSecretConfigured) blockers.push('GARMIN_WEBHOOK_SECRET is not configured.')

  const tables: Record<string, ProbeResult> = {}
  const columns: Record<string, ProbeResult> = {}

  if (!env.supabaseUrlConfigured || !env.supabaseServiceRoleConfigured) {
    return {
      env,
      tables,
      columns,
      blockers,
    }
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (error) {
    return {
      env,
      tables,
      columns,
      blockers: [...blockers, `Supabase admin client could not be created: ${summarizeProbeError(error)}`],
    }
  }

  const tableProbes: Array<{ name: string; select: string }> = [
    { name: 'garmin_connections', select: 'id,user_id,garmin_user_id' },
    { name: 'garmin_tokens', select: 'id,user_id,expires_at' },
    { name: 'garmin_activities', select: 'id,user_id,activity_id,start_time' },
    { name: 'garmin_daily_metrics', select: 'id,user_id,date,body_battery' },
    { name: 'user_memory_snapshots', select: 'id,device_id,updated_at' },
  ]

  for (const probe of tableProbes) {
    const { error } = await admin.from(probe.name).select(probe.select).limit(1)
    if (error) {
      tables[probe.name] = { ok: false, error: error.message }
      blockers.push(`Supabase table probe failed for ${probe.name}: ${error.message}`)
    } else {
      tables[probe.name] = { ok: true }
    }
  }

  const columnProbes: Array<{ name: string; table: string; select: string }> = [
    {
      name: 'garmin_daily_metrics_body_battery_columns',
      table: 'garmin_daily_metrics',
      select: 'body_battery,body_battery_charged,body_battery_drained,body_battery_balance,raw_json',
    },
    {
      name: 'garmin_activities_telemetry_columns',
      table: 'garmin_activities',
      select: 'lap_summaries,split_summaries,interval_summaries,telemetry_json',
    },
  ]

  for (const probe of columnProbes) {
    const { error } = await admin.from(probe.table).select(probe.select).limit(1)
    if (error) {
      columns[probe.name] = { ok: false, error: error.message }
      blockers.push(`Supabase column probe failed for ${probe.table}: ${error.message}`)
    } else {
      columns[probe.name] = { ok: true }
    }
  }

  return {
    env,
    tables,
    columns,
    blockers,
  }
}

export async function GET(req: Request) {
  const userId = parseUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Valid userId is required' }, { status: 401 })
  }

  let accessToken = ''
  try {
    accessToken = await getValidGarminAccessToken(userId)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Garmin auth unavailable'
    await safeMarkAuthError(userId, message)
    return NextResponse.json({ error: message, needsReauth: true }, { status: 401 })
  }

  let profile: EndpointResult
  let permissionsResult: EndpointResult

  try {
    const initial = await runDiagnosticProbe(accessToken)
    profile = initial.profile
    permissionsResult = initial.permissionsResult

    const authFailed = [profile, permissionsResult].some((entry) => entry.status === 401 || entry.status === 403)
    if (authFailed) {
      const refreshed = await refreshGarminAccessToken(userId)
      const retried = await runDiagnosticProbe(refreshed.accessToken)
      profile = retried.profile
      permissionsResult = retried.permissionsResult
    }
  } catch (error) {
    await safeMarkAuthError(userId, error instanceof Error ? error.message : 'Garmin diagnose failed')
    return NextResponse.json({ error: 'Failed to run Garmin diagnostics' }, { status: 500 })
  }

  const permissions = parsePermissions(permissionsResult)
  const profileBody = asRecord(profile.body)
  const garminUserId = getString(profileBody.userId) ?? getString(profileBody.id)
  const backendReadiness = await runBackendReadinessProbe()

  const exportRowsResult = garminUserId
    ? await readGarminExportRows({
        garminUserId,
        sinceIso: lookbackStartIso(GARMIN_HISTORY_DAYS),
      })
    : { ok: false, storeAvailable: false, storeError: 'Garmin userId unavailable', rows: [] as GarminStoredSummaryRow[] }

  const groupedRows = groupRowsByDataset(exportRowsResult.rows)
  const datasetCounts = Object.fromEntries(
    Object.entries(groupedRows).map(([key, rows]) => [key, rows.length])
  )

  const now = new Date()
  const start = new Date(now.getTime() - GARMIN_HISTORY_DAYS * 24 * 60 * 60 * 1000)
  const origin = new URL(req.url).origin
  const { value: configuredSecret, source: configuredSecretSource } = getGarminWebhookSecret()
  const webhookUrl = configuredSecret
    ? `${origin}/api/devices/garmin/webhook/${encodeURIComponent(configuredSecret)}`
    : `${origin}/api/devices/garmin/webhook/<GARMIN_WEBHOOK_SECRET>`
  const latestReceivedAt = exportRowsResult.rows.reduce<string | null>((latest, row) => {
    if (!row.receivedAt) return latest
    if (!latest) return row.receivedAt
    return Date.parse(row.receivedAt) > Date.parse(latest) ? row.receivedAt : latest
  }, null)
  const hasRecentIngestion =
    latestReceivedAt != null &&
    Number.isFinite(Date.parse(latestReceivedAt)) &&
    Date.parse(latestReceivedAt) >= Date.now() - 7 * 24 * 60 * 60 * 1000

  const blockers: string[] = []
  const warnings: string[] = []
  if (!includesPermission(permissions, 'ACTIVITY_EXPORT')) {
    blockers.push('Missing ACTIVITY_EXPORT permission.')
  }
  if (!includesPermission(permissions, 'HEALTH_EXPORT')) {
    blockers.push('Missing HEALTH_EXPORT permission.')
  }
  if (!exportRowsResult.storeAvailable) {
    blockers.push(exportRowsResult.storeError ?? 'Garmin webhook storage is unavailable.')
  } else if (exportRowsResult.rows.length === 0) {
    blockers.push(`No Garmin webhook export records found in the last ${GARMIN_HISTORY_DAYS} days.`)
  }
  if (!configuredSecret) {
    if (hasRecentIngestion) {
      warnings.push(
        'GARMIN_WEBHOOK_SECRET is not visible to the diagnostics runtime, but webhook ingestion is active.'
      )
    } else {
      blockers.push('GARMIN_WEBHOOK_SECRET is not configured.')
    }
  }
  for (const backendBlocker of backendReadiness.blockers) {
    if (!blockers.includes(backendBlocker)) {
      blockers.push(backendBlocker)
    }
  }

  return NextResponse.json({
    timestamp: now.toISOString(),
    timeRange: {
      startIso: start.toISOString(),
      endIso: now.toISOString(),
      days: GARMIN_HISTORY_DAYS,
    },
    capabilities: {
      permissions,
      activityExportEnabled: includesPermission(permissions, 'ACTIVITY_EXPORT'),
      healthExportEnabled: includesPermission(permissions, 'HEALTH_EXPORT'),
      workoutImportEnabled: includesPermission(permissions, 'WORKOUT_IMPORT'),
      webhookStoreAvailable: exportRowsResult.storeAvailable,
    },
    webhook: {
      endpoint: webhookUrl,
      mode: 'Garmin ping/pull + push',
      secretSource: configuredSecretSource,
    },
    backendReadiness,
    blockers,
    warnings,
    results: {
      profile,
      permissions: permissionsResult,
      ingestion: {
        storeAvailable: exportRowsResult.storeAvailable,
        storeError: exportRowsResult.storeError ?? null,
        recordCount: exportRowsResult.rows.length,
        latestReceivedAt,
        datasetCounts,
      },
    },
  })
}
