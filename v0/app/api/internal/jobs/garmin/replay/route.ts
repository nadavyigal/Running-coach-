import { NextResponse } from 'next/server'

import { logger } from '@/lib/logger'
import { requeueGarminJob } from '@/lib/integrations/garmin/service'

export const dynamic = 'force-dynamic'

function isAuthorized(request: Request): boolean {
  const internalSecret = process.env.INTERNAL_JOBS_SECRET?.trim() || process.env.CRON_SECRET?.trim()
  if (!internalSecret) return true
  return request.headers.get('authorization') === `Bearer ${internalSecret}`
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    logger.warn('Unauthorized Garmin replay request')
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 })
  }

  const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : ''
  if (!jobId) {
    return NextResponse.json({ success: false, error: 'jobId is required' }, { status: 400 })
  }

  try {
    await requeueGarminJob(jobId)
    return NextResponse.json({ success: true, jobId })
  } catch (error) {
    logger.error('Garmin replay failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to replay Garmin job',
      },
      { status: 500 }
    )
  }
}
