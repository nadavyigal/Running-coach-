import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function parseUserId(value: string | null): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseDays(value: string | null): number {
  if (!value) return 90
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return 90
  return Math.min(365, Math.max(7, parsed))
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const userId = parseUserId(searchParams.get('userId'))
  const days = parseDays(searchParams.get('days'))

  if (!userId) {
    return NextResponse.json({ error: 'Valid userId is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rangeStart = new Date()
  rangeStart.setHours(0, 0, 0, 0)
  rangeStart.setDate(rangeStart.getDate() - (days - 1))
  const startDateIso = rangeStart.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('training_derived_metrics')
    .select('date, acute_load_7d, chronic_load_28d')
    .eq('user_id', userId)
    .eq('auth_user_id', user.id)
    .gte('date', startDateIso)
    .order('date', { ascending: true })

  if (error) {
    console.error('[api/garmin/pmc] Query failed:', error)
    return NextResponse.json({ error: 'Failed to fetch PMC metrics' }, { status: 500 })
  }

  const timeline = (data ?? []).map((entry) => {
    const atl = typeof entry.acute_load_7d === 'number' ? entry.acute_load_7d : null
    const ctl = typeof entry.chronic_load_28d === 'number' ? entry.chronic_load_28d : null
    return {
      date: entry.date,
      atl,
      ctl,
      tsb: atl != null && ctl != null ? ctl - atl : null,
    }
  })

  return NextResponse.json({ points: timeline })
}

