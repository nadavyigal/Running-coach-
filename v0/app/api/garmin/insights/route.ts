import { NextRequest, NextResponse } from 'next/server'
import { getGarminOAuthState } from '@/lib/server/garmin-oauth-store'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function parseUserId(value: string | null): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function isDateParamValid(value: string | null): value is string {
  if (!value) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime())
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const userId = parseUserId(searchParams.get('userId'))
  const date = searchParams.get('date')
  const type = searchParams.get('type')

  if (!userId) {
    return NextResponse.json({ error: 'Valid userId is required' }, { status: 400 })
  }

  if (!isDateParamValid(date)) {
    return NextResponse.json({ error: 'Valid date (YYYY-MM-DD) is required' }, { status: 400 })
  }

  if (type && type !== 'post_run') {
    return NextResponse.json({ error: 'Only post_run insights are supported' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const oauthState = await getGarminOAuthState(userId)
  if (!oauthState) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Older Garmin connections may not have auth_user_id backfilled yet.
  if (oauthState.authUserId && oauthState.authUserId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('ai_insights')
    .select('insight_markdown, confidence, period_start, period_end, created_at')
    .eq('user_id', userId)
    .eq('type', 'post_run')
    .lte('period_start', date)
    .gte('period_end', date)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[api/garmin/insights] Query failed:', error)
    return NextResponse.json({ error: 'Failed to fetch Garmin insight' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ insight_markdown: null, confidence: null })
  }

  return NextResponse.json({
    insight_markdown: data.insight_markdown,
    confidence: data.confidence,
  })
}

