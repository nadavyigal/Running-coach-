import { NextResponse } from 'next/server'

import { getLatestPlanAdjustments, recordPlanAdjustment } from '@/lib/server/plan-adjustments'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function parseUserIdFromValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value)
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

function parseUserId(req: Request, body?: Record<string, unknown>): number | null {
  const fromHeader = parseUserIdFromValue(req.headers.get('x-user-id'))
  if (fromHeader) return fromHeader

  const fromQuery = parseUserIdFromValue(new URL(req.url).searchParams.get('userId'))
  if (fromQuery) return fromQuery

  if (body) {
    const fromBody = parseUserIdFromValue(body.userId)
    if (fromBody) return fromBody
  }

  return null
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = (await req.json()) as unknown
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export async function GET(req: Request) {
  const userId = parseUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Valid userId is required' }, { status: 400 })
  }

  try {
    const rows = await getLatestPlanAdjustments({
      userId,
      limit: parseUserIdFromValue(new URL(req.url).searchParams.get('limit')) ?? 1,
    })

    return NextResponse.json({
      adjustments: rows,
      latest: rows[0] ?? null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch plan adjustments',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const body = await readBody(req)
  const userId = parseUserId(req, body)
  if (!userId) {
    return NextResponse.json({ error: 'Valid userId is required' }, { status: 400 })
  }

  let authUserId: string | null = null

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    authUserId = user?.id ?? null
  } catch {
    authUserId = null
  }

  try {
    await recordPlanAdjustment({
      userId,
      authUserId,
      sessionDate: typeof body.sessionDate === 'string' ? body.sessionDate : null,
      oldSession:
        body.oldSession && typeof body.oldSession === 'object' && !Array.isArray(body.oldSession)
          ? (body.oldSession as Record<string, unknown>)
          : null,
      newSession:
        body.newSession && typeof body.newSession === 'object' && !Array.isArray(body.newSession)
          ? (body.newSession as Record<string, unknown>)
          : null,
      reasons: body.reasons ?? null,
      evidence: body.evidence ?? null,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to write plan adjustment log',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
