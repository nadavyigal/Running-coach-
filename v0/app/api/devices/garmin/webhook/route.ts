import { NextResponse } from 'next/server'

import { GARMIN_WEBHOOK_DATASET_KEYS } from '@/lib/garmin/datasets'
import { logger } from '@/lib/logger'
import {
  enqueueGarminImportJobsForEvent,
  handleGarminUserDeregistrations,
  recordGarminWebhookDelivery,
} from '@/lib/integrations/garmin/service'
import { getGarminWebhookSecret } from '@/lib/server/garmin-webhook-secret'

export const dynamic = 'force-dynamic'

const SUPPORTED_DATASETS = [...GARMIN_WEBHOOK_DATASET_KEYS]

function payloadContainsSupportedDatasets(payload: Record<string, unknown>): boolean {
  return SUPPORTED_DATASETS.some((datasetKey) => {
    const value = payload[datasetKey]
    if (Array.isArray(value)) return value.length > 0
    if (value && typeof value === 'object') {
      return Object.values(value as Record<string, unknown>).some((nested) => Array.isArray(nested) && nested.length > 0)
    }
    return false
  })
}

function getWebhookAuthResult(req: Request): { authorized: boolean; status: number; error?: string } {
  const { value: configuredSecret } = getGarminWebhookSecret()
  if (!configuredSecret) {
    return {
      authorized: false,
      status: 503,
      error: 'Webhook secret is not configured. Set GARMIN_WEBHOOK_SECRET before enabling Garmin webhooks.',
    }
  }

  const headerSecret = req.headers.get('x-garmin-webhook-secret')?.trim()
  const querySecret = new URL(req.url).searchParams.get('secret')?.trim()

  if (headerSecret === configuredSecret || querySecret === configuredSecret) {
    return { authorized: true, status: 200 }
  }

  return {
    authorized: false,
    status: 401,
    error: 'Unauthorized Garmin webhook request',
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

export async function processGarminWebhookPayload(rawBody: string, payload: Record<string, unknown>) {
  const { event, duplicate } = await recordGarminWebhookDelivery({
    rawBody,
    payload,
    eventType: 'garmin_push',
  })

  if (!event) {
    throw new Error('Failed to persist Garmin webhook event')
  }

  await handleGarminUserDeregistrations(payload)

  if (duplicate || !payloadContainsSupportedDatasets(payload)) {
    return {
      duplicate,
      queuedJobs: 0,
      webhookEventId: event.id,
    }
  }

  const enqueueResult = await enqueueGarminImportJobsForEvent(event)
  return {
    duplicate: false,
    queuedJobs: enqueueResult.queuedJobs,
    webhookEventId: event.id,
  }
}

export async function POST(req: Request) {
  const authResult = getWebhookAuthResult(req)
  if (!authResult.authorized) {
    logger.warn('Rejected unauthorized Garmin webhook POST request', {
      hasHeaderSecret: Boolean(req.headers.get('x-garmin-webhook-secret')),
      hasQuerySecret: Boolean(new URL(req.url).searchParams.get('secret')),
    })
    return NextResponse.json(
      { ok: false, error: authResult.error ?? 'Unauthorized Garmin webhook request' },
      { status: authResult.status }
    )
  }

  let rawBody = ''
  let payload: Record<string, unknown> = {}

  try {
    rawBody = await req.text()
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {}
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid Garmin webhook JSON payload' }, { status: 400 })
  }

  const responsePromise = NextResponse.json({ status: 'ok' }, { status: 200 })

  void processGarminWebhookPayload(rawBody, payload).catch((error) => {
    logger.error('Garmin webhook processing error:', error)
  })

  return responsePromise
}
