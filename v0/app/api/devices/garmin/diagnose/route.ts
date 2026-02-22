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

export const dynamic = 'force-dynamic'

const GARMIN_API_BASE = 'https://apis.garmin.com'

interface EndpointResult {
  url: string
  status: number
  ok: boolean
  body: unknown
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
