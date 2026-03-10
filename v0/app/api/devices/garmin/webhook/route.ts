import { NextResponse } from 'next/server'

import { logger } from '@/lib/logger'
import {
  enqueueGarminImportJobsForEvent,
  recordGarminWebhookDelivery,
} from '@/lib/integrations/garmin/service'
import { getGarminWebhookSecret } from '@/lib/server/garmin-webhook-secret'

export const dynamic = 'force-dynamic'

const SUPPORTED_DATASETS = ['activities', 'manuallyUpdatedActivities', 'activityDetails', 'activityFiles']

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

  try {
    const { event, duplicate } = await recordGarminWebhookDelivery({
      rawBody,
      payload,
      eventType: 'garmin_push',
    })

    if (!event) {
      return NextResponse.json({ ok: false, error: 'Failed to persist Garmin webhook event' }, { status: 500 })
    }

    if (duplicate) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        queuedJobs: 0,
        webhookEventId: event.id,
      })
    }

    const enqueueResult = await enqueueGarminImportJobsForEvent(event)
    return NextResponse.json({
      ok: true,
      duplicate: false,
      queuedJobs: enqueueResult.queuedJobs,
      webhookEventId: event.id,
    })
  } catch (error) {
    logger.error('Garmin webhook persistence failure:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to process Garmin webhook',
      },
      { status: 500 }
    )
  }
}
