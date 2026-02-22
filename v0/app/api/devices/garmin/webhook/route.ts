import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import {
  type GarminDatasetKey,
  storeGarminExportRows,
} from '@/lib/server/garmin-export-store'

export const dynamic = 'force-dynamic'

const SUPPORTED_DATASETS: GarminDatasetKey[] = [
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
]

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function parseRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => asRecord(entry))
      .filter((entry) => Object.keys(entry).length > 0)
  }

  if (typeof value === 'object' && value !== null) {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(nested)) {
        return nested
          .map((entry) => asRecord(entry))
          .filter((entry) => Object.keys(entry).length > 0)
      }
    }
  }

  return []
}

function summarizeUpstreamBody(body: string): string {
  const trimmed = body.trim()
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
    if (message) return message.slice(0, 500)
  } catch {
    // keep text body
  }

  if (/<!doctype html|<html/i.test(trimmed)) {
    return 'Garmin returned an HTML error page'
  }

  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}...` : trimmed
}

function getWebhookAuthResult(req: Request): { authorized: boolean; status: number; error?: string } {
  const configuredSecret = process.env.GARMIN_WEBHOOK_SECRET?.trim()
  if (!configuredSecret) {
    return {
      authorized: false,
      status: 503,
      error: 'Webhook secret is not configured. Set GARMIN_WEBHOOK_SECRET before enabling Garmin webhooks.',
    }
  }

  const url = new URL(req.url)
  const querySecret = url.searchParams.get('secret')?.trim()
  const headerSecret = req.headers.get('x-garmin-webhook-secret')?.trim()

  if (querySecret === configuredSecret || headerSecret === configuredSecret) {
    return { authorized: true, status: 200 }
  }

  return {
    authorized: false,
    status: 401,
    error: 'Unauthorized Garmin webhook request',
  }
}

async function fetchPingPullRows(callbackUrl: string): Promise<{
  ok: boolean
  rows: Record<string, unknown>[]
  error?: string
}> {
  try {
    const response = await fetch(callbackUrl, {
      headers: {
        Accept: 'application/json',
      },
    })

    const bodyText = await response.text()
    if (!response.ok) {
      return {
        ok: false,
        rows: [],
        error: `callbackURL returned ${response.status}: ${summarizeUpstreamBody(bodyText)}`,
      }
    }

    let bodyJson: unknown = null
    try {
      bodyJson = bodyText ? JSON.parse(bodyText) : null
    } catch {
      bodyJson = bodyText
    }

    return {
      ok: true,
      rows: parseRows(bodyJson),
    }
  } catch (error) {
    return {
      ok: false,
      rows: [],
      error: error instanceof Error ? error.message : 'Failed to fetch callbackURL',
    }
  }
}

export async function GET(req: Request) {
  const authResult = getWebhookAuthResult(req)
  if (!authResult.authorized) {
    return NextResponse.json(
      { ok: false, error: authResult.error ?? 'Unauthorized Garmin webhook request' },
      { status: authResult.status }
    )
  }

  return NextResponse.json({
    ok: true,
    message: 'RunSmart Garmin webhook endpoint is reachable',
    supportedDatasets: SUPPORTED_DATASETS,
  })
}

export async function POST(req: Request) {
  const authResult = getWebhookAuthResult(req)
  if (!authResult.authorized) {
    return NextResponse.json(
      { ok: false, error: authResult.error ?? 'Unauthorized Garmin webhook request' },
      { status: authResult.status }
    )
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid Garmin webhook JSON payload' }, { status: 400 })
  }

  const payloadRecord = asRecord(payload)
  const storeErrors: string[] = []
  const callbackErrors: string[] = []
  let acceptedRows = 0
  let droppedRows = 0

  for (const datasetKey of SUPPORTED_DATASETS) {
    const entries = parseRows(payloadRecord[datasetKey])
    if (entries.length === 0) continue

    for (const entry of entries) {
      const callbackUrl = getString(entry.callbackURL) ?? getString(entry.callbackUrl)
      const fallbackGarminUserId = getString(entry.userId)

      if (callbackUrl) {
        const pulled = await fetchPingPullRows(callbackUrl)
        if (!pulled.ok) {
          callbackErrors.push(`${datasetKey}: ${pulled.error ?? 'callbackURL request failed'}`)
          continue
        }

        const storeResult = await storeGarminExportRows({
          datasetKey,
          rows: pulled.rows,
          source: 'ping_pull',
          fallbackGarminUserId,
        })

        acceptedRows += storeResult.storedRows
        droppedRows += storeResult.droppedRows
        if (!storeResult.ok) {
          storeErrors.push(storeResult.storeError ?? `${datasetKey}: failed to store rows`)
        }
        continue
      }

      const storeResult = await storeGarminExportRows({
        datasetKey,
        rows: [entry],
        source: 'push',
        fallbackGarminUserId,
      })

      acceptedRows += storeResult.storedRows
      droppedRows += storeResult.droppedRows
      if (!storeResult.ok) {
        storeErrors.push(storeResult.storeError ?? `${datasetKey}: failed to store rows`)
      }
    }
  }

  if (storeErrors.length > 0) {
    logger.error('Garmin webhook store errors:', storeErrors)
  }
  if (callbackErrors.length > 0) {
    logger.warn('Garmin webhook callbackURL errors:', callbackErrors)
  }

  return NextResponse.json({
    ok: storeErrors.length === 0,
    acceptedRows,
    droppedRows,
    callbackErrors,
    storeErrors,
  })
}
