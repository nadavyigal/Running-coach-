import { NextResponse } from 'next/server'
import {
  GARMIN_HISTORY_DAYS,
  type GarminStoredSummaryRow,
  groupRowsByDataset,
  lookbackStartIso,
  readGarminExportRows,
} from '@/lib/server/garmin-export-store'

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

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No Bearer token provided' }, { status: 401 })
  }

  const accessToken = authHeader.slice(7)
  const [profile, permissionsResult] = await Promise.all([
    testEndpoint(accessToken, `${GARMIN_API_BASE}/wellness-api/rest/user/id`),
    testEndpoint(accessToken, `${GARMIN_API_BASE}/wellness-api/rest/user/permissions`),
  ])

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
  const configuredSecret = process.env.GARMIN_WEBHOOK_SECRET?.trim()
  const webhookUrl = configuredSecret
    ? `${origin}/api/devices/garmin/webhook?secret=${encodeURIComponent(configuredSecret)}`
    : `${origin}/api/devices/garmin/webhook`

  const blockers: string[] = []
  if (!includesPermission(permissions, 'ACTIVITY_EXPORT')) {
    blockers.push('Missing ACTIVITY_EXPORT permission.')
  }
  if (!includesPermission(permissions, 'HEALTH_EXPORT')) {
    blockers.push('Missing HEALTH_EXPORT permission.')
  }
  if (!exportRowsResult.storeAvailable) {
    blockers.push(exportRowsResult.storeError ?? 'Garmin webhook storage is unavailable.')
  } else if (exportRowsResult.rows.length === 0) {
    blockers.push('No Garmin webhook export records found in the last 30 days.')
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
    },
    blockers,
    results: {
      profile,
      permissions: permissionsResult,
      ingestion: {
        storeAvailable: exportRowsResult.storeAvailable,
        storeError: exportRowsResult.storeError ?? null,
        recordCount: exportRowsResult.rows.length,
        datasetCounts,
      },
    },
  })
}
