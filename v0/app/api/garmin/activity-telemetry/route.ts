import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface GarminLapLike {
  index: number
  distanceKm: number | null
  durationSec: number | null
  paceSecPerKm: number | null
  avgHr: number | null
  avgCadence: number | null
  elevationGainM: number | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => asRecord(entry))
    .filter((entry) => Object.keys(entry).length > 0)
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function getNestedValue(record: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = record
  for (const key of path) {
    if (!current || typeof current !== 'object') return null
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

function pickNumber(record: Record<string, unknown>, paths: string[][]): number | null {
  for (const path of paths) {
    const value = getNumber(getNestedValue(record, path))
    if (value != null) return value
  }
  return null
}

function parseUserId(value: string | null): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function normalizeLapLikeRow(entry: Record<string, unknown>, index: number): GarminLapLike {
  const distanceMeters = pickNumber(entry, [
    ['distanceInMeters'],
    ['distanceMeters'],
    ['distance_m'],
    ['distance'],
  ])
  const durationSec = pickNumber(entry, [
    ['durationInSeconds'],
    ['durationSeconds'],
    ['duration_s'],
    ['duration'],
  ])
  const averageSpeedMps = pickNumber(entry, [
    ['averageSpeedInMetersPerSecond'],
    ['avgSpeedMps'],
    ['averageSpeed'],
  ])
  const paceSecFromSpeed =
    averageSpeedMps != null && averageSpeedMps > 0 ? 1000 / averageSpeedMps : null
  const paceSecFromDuration =
    durationSec != null && distanceMeters != null && distanceMeters > 0
      ? durationSec / (distanceMeters / 1000)
      : null

  return {
    index: index + 1,
    distanceKm: distanceMeters != null ? Number((distanceMeters / 1000).toFixed(2)) : null,
    durationSec: durationSec != null ? Math.round(durationSec) : null,
    paceSecPerKm:
      paceSecFromDuration != null
        ? Math.round(paceSecFromDuration)
        : paceSecFromSpeed != null
          ? Math.round(paceSecFromSpeed)
          : null,
    avgHr: pickNumber(entry, [
      ['averageHeartRateInBeatsPerMinute'],
      ['avg_hr'],
      ['averageHR'],
    ]),
    avgCadence: pickNumber(entry, [
      ['averageRunCadenceInStepsPerMinute'],
      ['averageCadenceInStepsPerMinute'],
      ['avg_cadence_spm'],
      ['averageCadence'],
    ]),
    elevationGainM: pickNumber(entry, [
      ['totalElevationGainInMeters'],
      ['elevationGain'],
      ['elevation_gain_m'],
    ]),
  }
}

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value))
  if (valid.length === 0) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function stdDev(values: number[]): number | null {
  if (values.length === 0) return null
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function splitHalfPace(values: GarminLapLike[]): { firstHalfSec: number | null; secondHalfSec: number | null } {
  const paces = values.map((entry) => entry.paceSecPerKm).filter((value): value is number => value != null)
  if (paces.length < 2) return { firstHalfSec: null, secondHalfSec: null }
  const mid = Math.floor(paces.length / 2)
  const first = paces.slice(0, mid)
  const second = paces.slice(mid)
  return {
    firstHalfSec: average(first),
    secondHalfSec: average(second),
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const userId = parseUserId(searchParams.get('userId'))
  const activityId = searchParams.get('activityId')?.trim() ?? ''
  const date = searchParams.get('date')?.trim() ?? ''

  if (!userId) {
    return NextResponse.json({ error: 'Valid userId is required' }, { status: 400 })
  }

  if (!activityId && !date) {
    return NextResponse.json({ error: 'Either activityId or date is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let query = supabase
    .from('garmin_activities')
    .select(
      'activity_id,start_time,sport,duration_s,distance_m,avg_hr,max_hr,avg_pace,elevation_gain_m,elevation_loss_m,max_speed_mps,avg_cadence_spm,max_cadence_spm,calories,lap_summaries,split_summaries,interval_summaries,telemetry_json,raw_json,updated_at'
    )
    .eq('user_id', userId)
    .eq('auth_user_id', user.id)
    .order('start_time', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)

  if (activityId) {
    query = query.eq('activity_id', activityId)
  } else if (date) {
    query = query.gte('start_time', `${date}T00:00:00.000Z`).lte('start_time', `${date}T23:59:59.999Z`)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    console.error('[api/garmin/activity-telemetry] Query failed:', error)
    return NextResponse.json({ error: 'Failed to fetch Garmin telemetry' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ telemetry: null })
  }

  const row = asRecord(data)
  const rawJson = asRecord(row.raw_json)
  const telemetryJson = asRecord(row.telemetry_json)
  const merged = { ...rawJson, ...telemetryJson }

  const lapRows = asRecordArray(row.lap_summaries).length
    ? asRecordArray(row.lap_summaries)
    : asRecordArray(merged.lapSummaries ?? merged.laps)
  const splitRows = asRecordArray(row.split_summaries).length
    ? asRecordArray(row.split_summaries)
    : asRecordArray(merged.splitSummaries ?? merged.splits)
  const intervalRows = asRecordArray(row.interval_summaries).length
    ? asRecordArray(row.interval_summaries)
    : asRecordArray(merged.intervalSummaries ?? merged.intervals)

  const laps = lapRows.map((entry, index) => normalizeLapLikeRow(entry, index))
  const splits = splitRows.map((entry, index) => normalizeLapLikeRow(entry, index))
  const intervals = intervalRows.map((entry, index) => normalizeLapLikeRow(entry, index))
  const paceSource = splits.length > 0 ? splits : laps
  const cadenceSource = splits.length > 0 ? splits : laps

  const paceValues = paceSource
    .map((entry) => entry.paceSecPerKm)
    .filter((value): value is number => value != null && Number.isFinite(value))
  const cadenceValues = cadenceSource
    .map((entry) => entry.avgCadence)
    .filter((value): value is number => value != null && Number.isFinite(value))

  const firstThirdCadence =
    cadenceValues.length >= 3 ? average(cadenceValues.slice(0, Math.ceil(cadenceValues.length / 3))) : null
  const lastThirdCadence =
    cadenceValues.length >= 3 ? average(cadenceValues.slice(-Math.ceil(cadenceValues.length / 3))) : null
  const cadenceDriftPct =
    firstThirdCadence != null && lastThirdCadence != null && firstThirdCadence > 0
      ? Number((((lastThirdCadence - firstThirdCadence) / firstThirdCadence) * 100).toFixed(1))
      : null

  const halfPace = splitHalfPace(paceSource)
  const intervalPaces = intervals
    .map((entry) => entry.paceSecPerKm)
    .filter((value): value is number => value != null && Number.isFinite(value))
  const intervalFastest = intervalPaces.length ? Math.min(...intervalPaces) : null
  const intervalSlowest = intervalPaces.length ? Math.max(...intervalPaces) : null
  const intervalStd = stdDev(intervalPaces)
  const intervalConsistencyPct =
    intervalPaces.length >= 2 && intervalStd != null
      ? Math.max(0, Math.min(100, Math.round(100 - (intervalStd / Math.max(1, average(intervalPaces) ?? 1)) * 100)))
      : null

  return NextResponse.json({
    telemetry: {
      activityId: getString(row.activity_id),
      startTime: getString(row.start_time),
      sport: getString(row.sport),
      distanceKm:
        getNumber(row.distance_m) != null ? Number((Number(getNumber(row.distance_m)) / 1000).toFixed(2)) : null,
      durationSec: getNumber(row.duration_s) != null ? Math.round(Number(getNumber(row.duration_s))) : null,
      avgHr: getNumber(row.avg_hr) ?? getNumber(merged.averageHR),
      maxHr: getNumber(row.max_hr) ?? getNumber(merged.maxHR),
      avgPaceSecPerKm: getNumber(row.avg_pace) ?? getNumber(merged.averagePace),
      avgCadenceSpm: getNumber(row.avg_cadence_spm) ?? getNumber(merged.averageCadence),
      maxCadenceSpm: getNumber(row.max_cadence_spm) ?? getNumber(merged.maxCadence),
      elevationGainM: getNumber(row.elevation_gain_m) ?? getNumber(merged.elevationGain),
      elevationLossM: getNumber(row.elevation_loss_m) ?? getNumber(merged.elevationLoss),
      maxSpeedMps: getNumber(row.max_speed_mps) ?? getNumber(merged.maxSpeedMps),
      calories: getNumber(row.calories) ?? getNumber(merged.calories),
      laps,
      splits,
      intervals,
      analytics: {
        pacing: {
          count: paceValues.length,
          variabilitySecPerKm: stdDev(paceValues),
          firstHalfPaceSecPerKm: halfPace.firstHalfSec,
          secondHalfPaceSecPerKm: halfPace.secondHalfSec,
          splitDeltaSecPerKm:
            halfPace.firstHalfSec != null && halfPace.secondHalfSec != null
              ? halfPace.secondHalfSec - halfPace.firstHalfSec
              : null,
        },
        cadence: {
          avgSpm: average(cadenceValues),
          maxSpm:
            cadenceValues.length > 0 ? Math.max(...cadenceValues) : getNumber(row.max_cadence_spm) ?? null,
          driftPct: cadenceDriftPct,
        },
        intervals: {
          count: intervals.length,
          fastestPaceSecPerKm: intervalFastest,
          slowestPaceSecPerKm: intervalSlowest,
          consistencyPct: intervalConsistencyPct,
        },
      },
    },
  })
}

