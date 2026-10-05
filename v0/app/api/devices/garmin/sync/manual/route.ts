import { NextResponse } from 'next/server'
import { POST as runGarminSync } from '@/app/api/devices/garmin/sync/route'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const syncResponse = await runGarminSync(req)

  let body: Record<string, unknown>
  try {
    body = (await syncResponse.json()) as Record<string, unknown>
  } catch {
    return syncResponse
  }

  return NextResponse.json(
    {
      ...body,
      trigger: 'manual',
      triggeredAt: new Date().toISOString(),
    },
    { status: syncResponse.status }
  )
}
