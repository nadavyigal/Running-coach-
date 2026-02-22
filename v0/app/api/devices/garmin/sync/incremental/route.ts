import { NextResponse } from 'next/server'
import {
  runGarminSyncForUser,
  type GarminSyncExecutionOptions,
} from '@/app/api/devices/garmin/sync/route'

export const dynamic = 'force-dynamic'

function parseUserId(req: Request): number | null {
  const headerValue = req.headers.get('x-user-id')?.trim() ?? ''
  if (headerValue) {
    const parsed = Number.parseInt(headerValue, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  const url = new URL(req.url)
  const queryValue = url.searchParams.get('userId')?.trim() ?? ''
  if (!queryValue) return null

  const parsed = Number.parseInt(queryValue, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseSinceIso(req: Request): string | null {
  const url = new URL(req.url)
  const raw = url.searchParams.get('since')?.trim() ?? ''
  if (!raw) return null
  const parsed = Date.parse(raw)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString()
}

export async function POST(req: Request) {
  const userId = parseUserId(req)
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Valid userId is required', needsReauth: true },
      { status: 401 }
    )
  }

  const options: GarminSyncExecutionOptions = {
    trigger: 'incremental',
    enforceRateLimit: true,
    defaultLookbackDays: 7,
    activityLookbackDays: 7,
    sinceIso: parseSinceIso(req),
  }

  const execution = await runGarminSyncForUser({
    userId,
    options,
  })

  return NextResponse.json(execution.body, {
    status: execution.status,
    ...(execution.headers ? { headers: execution.headers } : {}),
  })
}

