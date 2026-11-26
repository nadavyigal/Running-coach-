import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TABLE_NAME = 'user_memory_snapshots'

// The random device id is the only thing protecting a backup, so only the two
// shapes lib/userMemory.ts generates are accepted. The same table holds raw
// Garmin export rows (`garmin_export:...`), which must stay unreachable here.
const DEVICE_ID_PATTERNS = [
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // crypto.randomUUID()
  /^\d{13}-[0-9a-f]{1,16}$/, // fallback: timestamp-random hex
]

const parseDeviceId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const deviceId = value.trim()
  return DEVICE_ID_PATTERNS.some((pattern) => pattern.test(deviceId)) ? deviceId : null
}

const isMissingTableError = (error: { message?: string; code?: string } | null): boolean => {
  if (!error) return false
  if (error.code === '42P01') return true
  const message = error.message?.toLowerCase() ?? ''
  return message.includes('could not find the table') || message.includes('schema cache')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const deviceId = parseDeviceId(searchParams.get('deviceId'))

  if (!deviceId) {
    return NextResponse.json({ error: 'Missing or invalid deviceId' }, { status: 400 })
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
  // The client also sends `userId`. It is a browser-local number, so it is ignored.
  let payload: { deviceId?: unknown; snapshot?: Record<string, unknown> } = {}

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const deviceId = parseDeviceId(payload?.deviceId)
  if (!deviceId || !payload.snapshot) {
    return NextResponse.json({ error: 'Missing or invalid deviceId or snapshot' }, { status: 400 })
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
