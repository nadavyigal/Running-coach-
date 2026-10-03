/**
 * Email Sequence Cron Job
 *
 * This API route processes all automated email sequences on a daily schedule.
 * Configure in vercel.json with:
 *
 * {
 *   "crons": [{
 *     "path": "/api/cron/email-sequences",
 *     "schedule": "0 6 * * *"
 *   }]
 * }
 *
 * Schedule format: "0 6 * * *" = Daily at 6:00 AM UTC
 *
 * @see https://vercel.com/docs/cron-jobs
 * @see V0/lib/email/sequences.ts for sequence logic
 */

import { NextResponse } from 'next/server'
import { processEmailSequences } from '@/lib/email/sequences'
import { logger } from '@/lib/logger'
import {
  EmailSequenceDataSourceError,
  isEmailSequenceStoreConfigured,
} from '@/lib/server/email-sequence-store'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) return true
  return request.headers.get('authorization') === `Bearer ${cronSecret}`
}

function buildDataSourceErrorResponse(error: EmailSequenceDataSourceError) {
  const status = error.code === 'not_configured' ? 503 : 500

  return NextResponse.json(
    {
      success: false,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
    },
    { status }
  )
}

async function handleCronExecution(request: Request, manual = false) {
  if (!isAuthorizedCronRequest(request)) {
    logger.warn('Unauthorized email sequence cron attempt')
    return new NextResponse('Unauthorized', { status: 401 })
  }

  if (!isEmailSequenceStoreConfigured()) {
    const message =
      'Email sequence data source is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    logger.error(message)
    return NextResponse.json(
      {
        success: false,
        error: message,
        code: 'not_configured',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }

  try {
    logger.info(manual ? 'Manual email sequence execution triggered' : 'Starting email sequence cron job')

    const stats = await processEmailSequences()

    logger.info('Email sequence cron job completed:', stats)

    return NextResponse.json({
      success: true,
      manual,
      timestamp: new Date().toISOString(),
      stats,
    })
  } catch (error) {
    if (error instanceof EmailSequenceDataSourceError) {
      logger.error('Email sequence data source error:', error)
      return buildDataSourceErrorResponse(error)
    }

    logger.error('Email sequence cron job failed:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * GET handler for cron job execution
 * Vercel Cron Jobs call this endpoint on schedule
 */
export async function GET(request: Request) {
  return handleCronExecution(request)
}

/**
 * POST handler for manual execution (testing)
 * Call this endpoint to manually trigger email sequence processing
 *
 * Example:
 * curl -X POST http://localhost:3000/api/cron/email-sequences \
 *   -H "Content-Type: application/json"
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development' && !isAuthorizedCronRequest(request)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  return handleCronExecution(request, true)
}
