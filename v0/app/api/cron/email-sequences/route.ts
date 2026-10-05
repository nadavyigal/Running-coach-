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

/**
 * GET handler for cron job execution
 * Vercel Cron Jobs call this endpoint on schedule
 */
export async function GET(request: Request) {
  // Verify the request is from Vercel Cron (optional but recommended)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    logger.warn('Unauthorized cron job attempt')
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    logger.info('Starting email sequence cron job')

    const stats = await processEmailSequences()

    logger.info('Email sequence cron job completed:', stats)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats,
    })
  } catch (error) {
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
 * POST handler for manual execution (testing)
 * Call this endpoint to manually trigger email sequence processing
 *
 * Example:
 * curl -X POST http://localhost:3000/api/cron/email-sequences \
 *   -H "Content-Type: application/json"
 */
export async function POST(request: Request) {
  // In development, allow manual triggering without auth
  if (process.env.NODE_ENV !== 'development') {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
  }

  try {
    logger.info('Manual email sequence execution triggered')

    const stats = await processEmailSequences()

    return NextResponse.json({
      success: true,
      manual: true,
      timestamp: new Date().toISOString(),
      stats,
    })
  } catch (error) {
    logger.error('Manual email sequence execution failed:', error)

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
