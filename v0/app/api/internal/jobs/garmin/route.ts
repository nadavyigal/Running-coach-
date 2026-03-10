import { NextResponse } from 'next/server'

import { processPendingGarminJobs } from '@/lib/integrations/garmin/service'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isAuthorized(request: Request): boolean {
  const internalSecret = process.env.INTERNAL_JOBS_SECRET?.trim() || process.env.CRON_SECRET?.trim()
  if (!internalSecret) return true
  return request.headers.get('authorization') === `Bearer ${internalSecret}`
}

function parseLimit(request: Request): number {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('limit')
  const parsed = raw ? Number.parseInt(raw, 10) : 10
  if (!Number.isFinite(parsed) || parsed <= 0) return 10
  return Math.min(parsed, 50)
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    logger.warn('Unauthorized Garmin internal jobs request')
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const limit = parseLimit(request)
    const stats = await processPendingGarminJobs({
      limit,
      workerId: 'vercel-garmin-worker',
    })

    return NextResponse.json({
      success: true,
      stats,
      processedAt: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Garmin worker route failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown Garmin worker error',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return POST(request)
}
