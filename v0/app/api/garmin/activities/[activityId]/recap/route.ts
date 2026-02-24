import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface GarminActivityRow {
  activity_id: string
  distance_m: number | null
  duration_s: number | null
  avg_hr: number | null
  avg_cadence_spm: number | null
  split_summaries: Array<Record<string, unknown>> | null
  start_time: string | null
}

function parseUserId(req: Request): number | null {
  const fromHeader = req.headers.get('x-user-id')?.trim() ?? ''
  if (fromHeader.length > 0) {
    const parsed = Number.parseInt(fromHeader, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  const fromQuery = new URL(req.url).searchParams.get('userId')?.trim() ?? ''
  if (!fromQuery) return null

  const parsed = Number.parseInt(fromQuery, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function avg(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value))
  if (valid.length === 0) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function deriveOneThingToImprove(params: {
  activity: GarminActivityRow
  recentRuns: GarminActivityRow[]
}): {
  oneThing: string
  why: string
  confidence: 'high' | 'medium' | 'low'
  evidence: string[]
} {
  const { activity, recentRuns } = params

  const thisPaceSecPerKm =
    activity.duration_s != null && activity.distance_m != null && activity.distance_m > 0
      ? activity.duration_s / (activity.distance_m / 1000)
      : null
  const recentPaceSecPerKm = avg(
    recentRuns.map((run) =>
      run.duration_s != null && run.distance_m != null && run.distance_m > 0
        ? run.duration_s / (run.distance_m / 1000)
        : null
    )
  )

  const splitPaces = Array.isArray(activity.split_summaries)
    ? activity.split_summaries
        .map((split) => {
          const explicitPace =
            toNumber(split.paceSecPerKm) ??
            toNumber(split.pace_sec_per_km) ??
            toNumber(split.avgPaceSecPerKm)
          if (explicitPace != null) return explicitPace

          const durationSec = toNumber(split.durationSec)
          const distanceKm = toNumber(split.distanceKm)
          if (durationSec != null && distanceKm != null && distanceKm > 0) {
            return durationSec / distanceKm
          }

          return null
        })
        .filter((value): value is number => value != null)
    : []

  const splitRange = splitPaces.length > 1 ? Math.max(...splitPaces) - Math.min(...splitPaces) : null

  const evidence: string[] = []

  if (splitRange != null && splitRange >= 35) {
    evidence.push(`Split pace range was ${Math.round(splitRange)} sec/km.`)
    return {
      oneThing: 'Start 10-15 sec/km easier for the first third of the run.',
      why: 'Your splits varied more than ideal. A calmer start improves pacing control late in the run.',
      confidence: splitPaces.length >= 4 ? 'high' : 'medium',
      evidence,
    }
  }

  if (activity.avg_cadence_spm != null && activity.avg_cadence_spm < 164) {
    evidence.push(`Average cadence was ${Math.round(activity.avg_cadence_spm)} spm.`)
    return {
      oneThing: 'Increase cadence by 3-5 spm on easy sections.',
      why: 'A slightly quicker cadence can improve efficiency without increasing effort.',
      confidence: 'medium',
      evidence,
    }
  }

  if (
    activity.avg_hr != null &&
    recentRuns.length >= 3 &&
    recentPaceSecPerKm != null &&
    thisPaceSecPerKm != null &&
    thisPaceSecPerKm > recentPaceSecPerKm * 1.03
  ) {
    evidence.push(`Average HR was ${Math.round(activity.avg_hr)} bpm at a slower-than-usual pace.`)
    return {
      oneThing: 'Prioritize hydration and an easier effort in your next session.',
      why: 'Elevated effort at slower pace can indicate accumulated fatigue.',
      confidence: 'medium',
      evidence,
    }
  }

  return {
    oneThing: 'Hold your current pacing strategy and add a short form check every 10 minutes.',
    why: 'No clear risk pattern was detected. Maintaining form cues helps preserve efficiency.',
    confidence: 'low',
    evidence,
  }
}

export async function GET(req: Request, context: { params: { activityId: string } }) {
  const userId = parseUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Valid userId is required' }, { status: 400 })
  }

  const activityId = context.params.activityId?.trim()
  if (!activityId) {
    return NextResponse.json({ error: 'Valid activityId is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: activity, error: activityError } = await supabase
    .from('garmin_activities')
    .select('activity_id,distance_m,duration_s,avg_hr,avg_cadence_spm,split_summaries,start_time')
    .eq('user_id', userId)
    .eq('activity_id', activityId)
    .maybeSingle()

  if (activityError) {
    return NextResponse.json({ error: 'Failed to load Garmin activity' }, { status: 500 })
  }

  if (!activity) {
    return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
  }

  const { data: recentRows, error: recentError } = await supabase
    .from('garmin_activities')
    .select('activity_id,distance_m,duration_s,avg_hr,avg_cadence_spm,split_summaries,start_time')
    .eq('user_id', userId)
    .order('start_time', { ascending: false })
    .limit(8)

  if (recentError) {
    return NextResponse.json({ error: 'Failed to load recent Garmin runs' }, { status: 500 })
  }

  const recentRuns = ((recentRows ?? []) as GarminActivityRow[]).filter((row) => row.activity_id !== activityId)
  const recap = deriveOneThingToImprove({
    activity: activity as GarminActivityRow,
    recentRuns,
  })

  return NextResponse.json({
    activityId,
    ...recap,
  })
}
