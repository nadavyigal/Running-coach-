import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TABLE_NAME = 'user_memory_snapshots'

const isMissingTableError = (error: { message?: string; code?: string } | null): boolean => {
  if (!error) return false
  if (error.code === '42P01') return true
  const message = error.message?.toLowerCase() ?? ''
  return message.includes('could not find the table') || message.includes('schema cache')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const deviceId = searchParams.get('deviceId')?.trim()

  if (!deviceId) {
    return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 })
  }

  let supabase
  try {
    supabase = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Supabase admin client unavailable' }, { status: 503 })
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('snapshot')
    .eq('device_id', deviceId)
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ snapshot: null, disabled: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ snapshot: data?.snapshot ?? null })
}

export async function PUT(request: Request) {
  let payload: { deviceId?: string; userId?: number; snapshot?: Record<string, unknown> } = {}

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const deviceId = payload.deviceId?.trim()
  if (!deviceId || !payload.snapshot) {
    return NextResponse.json({ error: 'Missing deviceId or snapshot' }, { status: 400 })
  }

  let supabase
  try {
    supabase = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Supabase admin client unavailable' }, { status: 503 })
  }

  const now = new Date().toISOString()
  const { error } = await supabase.from(TABLE_NAME).upsert(
    {
      device_id: deviceId,
      user_id: payload.userId ?? null,
      snapshot: payload.snapshot,
      summary: (payload.snapshot as Record<string, any>).summary ?? null,
      last_seen_at: now,
      updated_at: now,
    },
    { onConflict: 'device_id' }
  )

  if (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ ok: false, disabled: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
