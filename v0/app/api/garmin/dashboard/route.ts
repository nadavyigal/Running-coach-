import { NextResponse } from 'next/server'

import { extractGarminBodyBatteryTimeseries } from '@/lib/garminBodyBattery'
import { computeGarminAcwrMetrics } from '@/lib/garminAcwr'
import { computeGarminReadiness, type GarminReadinessDay } from '@/lib/garminReadinessComputer'
import { extractGarminWellnessDays, type GarminDailyMetricsRow } from '@/lib/garminWellnessExtractor'
import { getGarminOAuthState } from '@/lib/server/garmin-oauth-store'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface GarminRunRow {
  completed_at: string
  duration: number | null
  distance: number | null
  heart_rate: number | null
}

interface TrainingDerivedMetricsRow {
  date: string
  acute_load_7d: number | null
  chronic_load_28d: number | null
  acwr: number | null
}

interface MergedDay {
  date: string
  bodyBattery: number | null
  bodyBatterySource: 'direct' | 'balance' | 'none'
  bodyBatteryBalance: number | null
  spo2: number | null
  hrv: number | null
  sleepScore: number | null
  restingHr: number | null
  stress: number | null
  activeMinutes: number | null
  deepSleep: number | null
  lightSleep: number | null
  remSleep: number | null
  awakeSleep: number | null
}

function parseUserId(req: Request): number | null {
  const headerValue = req.headers.get('x-user-id')?.trim() ?? ''
  if (headerValue) {
    const parsed = Number.parseInt(headerValue, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  const queryValue = new URL(req.url).searchParams.get('userId')?.trim() ?? ''
  if (!queryValue) return null

  const parsed = Number.parseInt(queryValue, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function round(value: number, precision = 2): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function toDateKey(value: string | Date | number): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }
  return parsed.toISOString().slice(0, 10)
}

function shiftIsoDate(dateIso: string, deltaDays: number): string {
  const base = Date.parse(`${dateIso}T00:00:00.000Z`)
  const dayMs = 24 * 60 * 60 * 1000
  return new Date(base + deltaDays * dayMs).toISOString().slice(0, 10)
}

function buildDateRange(endDateIso: string, days: number): string[] {
  return Array.from({ length: days }, (_, index) => shiftIsoDate(endDateIso, -(days - 1 - index)))
}

function findLatestDateIso(candidates: string[]): string {
  const valid = candidates.filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
  if (valid.length === 0) return new Date().toISOString().slice(0, 10)
  return valid.sort().at(-1) ?? new Date().toISOString().slice(0, 10)
}

function roundOrNull(value: number | null, precision = 2): number | null {
  if (value == null) return null
  return round(value, precision)
}

function extractSleepStages(rows: GarminDailyMetricsRow[]): Map<string, Pick<MergedDay, 'deepSleep' | 'lightSleep' | 'remSleep' | 'awakeSleep' | 'sleepScore'>> {
  const sleepByDate = new Map<string, Pick<MergedDay, 'deepSleep' | 'lightSleep' | 'remSleep' | 'awakeSleep' | 'sleepScore'>>()

  for (const row of rows) {
    const raw = asRecord(row.raw_json)
    const sleeps = asArray(raw.sleeps)
    const entry = sleeps
      .map((value) => asRecord(value))
      .find((value) => Object.keys(value).length > 0)

    if (!entry) continue

    const deepSeconds =
      toNumber(entry.deepSleepSeconds) ??
      toNumber(entry.deepSleepDurationInSeconds) ??
      toNumber(entry.deepSleepDuration)
    const lightSeconds =
      toNumber(entry.lightSleepSeconds) ??
      toNumber(entry.lightSleepDurationInSeconds) ??
      toNumber(entry.lightSleepDuration)
    const remSeconds =
      toNumber(entry.remSleepSeconds) ??
      toNumber(entry.remSleepDurationInSeconds) ??
      toNumber(entry.remSleepDuration)
    const awakeSeconds =
      toNumber(entry.awakeSleepSeconds) ??
      toNumber(entry.awakeDurationInSeconds) ??
      toNumber(entry.awakeDuration)
    const score =
      toNumber(entry.overallSleepScore) ??
      toNumber(asRecord(entry.overall).value) ??
      toNumber(entry.sleepScore) ??
      toNumber(row.sleep_score)

    sleepByDate.set(row.date, {
      deepSleep: deepSeconds != null ? Math.round(deepSeconds / 60) : null,
      lightSleep: lightSeconds != null ? Math.round(lightSeconds / 60) : null,
      remSleep: remSeconds != null ? Math.round(remSeconds / 60) : null,
      awakeSleep: awakeSeconds != null ? Math.round(awakeSeconds / 60) : null,
      sleepScore: score != null ? Math.round(score) : null,
    })
  }

  return sleepByDate
}

function extractRunActiveMinutes(runs: GarminRunRow[]): Map<string, number> {
  const runMap = new Map<string, number>()

  for (const run of runs) {
    if (!run.completed_at || !run.duration || run.duration <= 0) continue
    const key = toDateKey(run.completed_at)
    const current = runMap.get(key) ?? 0
    runMap.set(key, current + run.duration / 60)
  }

  return runMap
}

function buildMergedDays(params: {
  wellnessRows: GarminDailyMetricsRow[]
  runs: GarminRunRow[]
}): Map<string, MergedDay> {
  const wellnessDays = extractGarminWellnessDays(params.wellnessRows)
  const sleepMap = extractSleepStages(params.wellnessRows)
  const runActiveMap = extractRunActiveMinutes(params.runs)
  const merged = new Map<string, MergedDay>()

  const createEmptyDay = (date: string): MergedDay => ({
    date,
    bodyBattery: null,
    bodyBatterySource: 'none',
    bodyBatteryBalance: null,
    spo2: null,
    hrv: null,
    sleepScore: null,
    restingHr: null,
    stress: null,
    activeMinutes: null,
    deepSleep: null,
    lightSleep: null,
    remSleep: null,
    awakeSleep: null,
  })

  for (const day of wellnessDays) {
    merged.set(day.date, {
      ...createEmptyDay(day.date),
      bodyBattery: day.bodyBattery,
      bodyBatterySource: day.bodyBatterySource,
      bodyBatteryBalance: day.bodyBatteryBalance,
      spo2: day.spo2,
      hrv: day.hrv,
      sleepScore: day.sleepScore,
      restingHr: day.restingHr,
      stress: day.stress,
    })
  }

  for (const [date, sleep] of sleepMap) {
    const current = merged.get(date) ?? createEmptyDay(date)
    merged.set(date, {
      ...current,
      sleepScore: sleep.sleepScore ?? current.sleepScore,
      deepSleep: sleep.deepSleep,
      lightSleep: sleep.lightSleep,
      remSleep: sleep.remSleep,
      awakeSleep: sleep.awakeSleep,
    })
  }

  for (const [date, activeMinutes] of runActiveMap) {
    const current = merged.get(date) ?? createEmptyDay(date)
    merged.set(date, {
      ...current,
      activeMinutes: Math.round(activeMinutes),
    })
  }

  return merged
}

function buildConfidenceBadge(readinessDays: GarminReadinessDay[], confidence: 'high' | 'medium' | 'low'): string {
  const missingHrv = readinessDays.filter((day) => day.hrv == null).length
  const missingSleep = readinessDays.filter((day) => day.sleepScore == null).length
  const missingRhr = readinessDays.filter((day) => day.restingHr == null).length
  const missingStress = readinessDays.filter((day) => day.stress == null).length

  const missingParts: string[] = []
  if (missingHrv > 0) missingParts.push(`HRV for ${missingHrv} days`)
  if (missingSleep > 0) missingParts.push(`sleep for ${missingSleep} days`)
  if (missingRhr > 0) missingParts.push(`resting HR for ${missingRhr} days`)
  if (missingStress > 0) missingParts.push(`stress for ${missingStress} days`)

  if (missingParts.length === 0) {
    return `Confidence: ${confidence}`
  }

  return `Low confidence: missing ${missingParts.slice(0, 2).join(' and ')}`
}

function buildAcwrTimeline(params: {
  dates28: string[]
  acwr: ReturnType<typeof computeGarminAcwrMetrics>
  derivedRows: TrainingDerivedMetricsRow[]
}) {
  const derivedByDate = new Map(params.derivedRows.map((row) => [row.date, row]))

  return params.dates28.map((date, index) => {
    const derived = derivedByDate.get(date)
    if (derived) {
      return {
        date,
        acute: derived.acute_load_7d ?? 0,
        chronic: derived.chronic_load_28d ?? 0,
        acwr: derived.acwr,
      }
    }

    const acuteWindow = params.acwr.dailyLoads28d.slice(Math.max(0, index - 6), index + 1)
    const chronicWindow = params.acwr.dailyLoads28d.slice(Math.max(0, index - 27), index + 1)
    const acute = round(mean(acuteWindow), 2)
    const chronic = round(mean(chronicWindow), 2)

    return {
      date,
      acute,
      chronic,
      acwr: chronic > 0 ? round(acute / chronic, 3) : null,
    }
  })
}

export async function GET(req: Request) {
  const userId = parseUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Valid userId is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const oauthState = await getGarminOAuthState(userId)
  if (!oauthState) {
    return NextResponse.json({ error: 'Garmin connection not found' }, { status: 404 })
  }

  if (oauthState.authUserId && oauthState.authUserId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const startDate = shiftIsoDate(new Date().toISOString().slice(0, 10), -119)
  const profileId = oauthState?.profileId ?? null

  const [dailyQuery, derivedQuery, runsQuery] = await Promise.all([
    admin
      .from('garmin_daily_metrics')
      .select('date,body_battery,body_battery_balance,body_battery_charged,body_battery_drained,hrv,sleep_score,resting_hr,stress,raw_json')
      .eq('user_id', userId)
      .gte('date', startDate)
      .order('date', { ascending: true }),
    admin
      .from('training_derived_metrics')
      .select('date,acute_load_7d,chronic_load_28d,acwr')
      .eq('user_id', userId)
      .gte('date', shiftIsoDate(new Date().toISOString().slice(0, 10), -27))
      .order('date', { ascending: true }),
    profileId
      ? admin
          .from('runs')
          .select('completed_at,duration,distance,heart_rate')
          .eq('profile_id', profileId)
          .gte('completed_at', `${startDate}T00:00:00.000Z`)
          .order('completed_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ])

  if (dailyQuery.error) {
    return NextResponse.json({ error: dailyQuery.error.message }, { status: 500 })
  }

  if ('error' in runsQuery && runsQuery.error) {
    return NextResponse.json({ error: runsQuery.error.message }, { status: 500 })
  }

  if (derivedQuery.error) {
    return NextResponse.json({ error: derivedQuery.error.message }, { status: 500 })
  }

  const dailyRows = (dailyQuery.data ?? []) as GarminDailyMetricsRow[]
  const runs = ((runsQuery.data ?? []) as GarminRunRow[]).filter((run) => typeof run.completed_at === 'string')
  const derivedRows = (derivedQuery.data ?? []) as TrainingDerivedMetricsRow[]
  const mergedDays = buildMergedDays({ wellnessRows: dailyRows, runs })
  const bodyBatterySamples = extractGarminBodyBatteryTimeseries(dailyRows)

  const sampleDates = [
    ...Array.from(mergedDays.keys()),
    ...runs.map((run) => toDateKey(run.completed_at)),
    ...bodyBatterySamples.map((sample) => sample.timestamp.slice(0, 10)),
  ]
  const endDateIso = findLatestDateIso(sampleDates)
  const dates7 = buildDateRange(endDateIso, 7)
  const dates28 = buildDateRange(endDateIso, 28)

  const bodyBatteryByDay = new Map<string, { timestamp: string; value: number }>()
  for (const sample of bodyBatterySamples) {
    const key = sample.timestamp.slice(0, 10)
    const current = bodyBatteryByDay.get(key)
    if (!current || sample.timestamp > current.timestamp) {
      bodyBatteryByDay.set(key, { timestamp: sample.timestamp, value: sample.value })
    }
  }

  const bodyBattery7d = dates7.map((date) => {
    const mergedDay = mergedDays.get(date)
    const sampleValue = bodyBatteryByDay.get(date)?.value
    const fallbackValue = mergedDay?.bodyBattery ?? null
    const hasDirectValue = sampleValue != null || fallbackValue != null

    return {
      date,
      value: sampleValue ?? fallbackValue,
      source: hasDirectValue ? 'direct' : (mergedDay?.bodyBatterySource ?? 'none'),
      fallbackBalance: mergedDay?.bodyBatteryBalance ?? null,
    }
  })

  const readinessDays: GarminReadinessDay[] = dates28.map((date) => {
    const day = mergedDays.get(date)
    return {
      date,
      hrv: day?.hrv ?? null,
      sleepScore: day?.sleepScore ?? null,
      restingHr: day?.restingHr ?? null,
      stress: day?.stress ?? null,
    }
  })

  const readiness = computeGarminReadiness({
    days: readinessDays,
    endDate: endDateIso,
  })

  const acwr = computeGarminAcwrMetrics({
    activities: runs.map((run) => ({
      startTime: run.completed_at,
      durationSeconds: run.duration,
      averageHeartRate: run.heart_rate,
      distanceMeters: run.distance != null ? Number(run.distance) * 1000 : null,
    })),
    endDate: endDateIso,
  })

  const payload = {
    endDateIso,
    lastSyncAt: oauthState?.lastSuccessfulSyncAt ?? oauthState?.lastSyncAt ?? null,
    timeline: Array.from(mergedDays.values()).sort((left, right) => left.date.localeCompare(right.date)),
    readiness,
    readinessDays,
    confidenceBadge: buildConfidenceBadge(readinessDays, readiness.confidence),
    acwr,
    acwrTimeline: buildAcwrTimeline({ dates28, acwr, derivedRows }),
    hrvTrend7d: dates7.map((date) => ({
      date,
      value: roundOrNull(mergedDays.get(date)?.hrv ?? null, 2),
    })),
    hrvBaseline28: (() => {
      const values = dates28
        .map((date) => mergedDays.get(date)?.hrv ?? null)
        .filter((value): value is number => value != null)
      return values.length > 0 ? round(mean(values), 2) : null
    })(),
    bodyBatteryToday: bodyBattery7d.at(-1)?.value ?? null,
    bodyBatteryTodaySource: bodyBattery7d.at(-1)?.source ?? 'none',
    bodyBatteryTodayBalance: bodyBattery7d.at(-1)?.fallbackBalance ?? null,
    bodyBattery7d,
    sleepStages7d: dates7.map((date) => {
      const day = mergedDays.get(date)
      return {
        date,
        deep: day?.deepSleep ?? 0,
        light: day?.lightSleep ?? 0,
        rem: day?.remSleep ?? 0,
        awake: day?.awakeSleep ?? 0,
        score: day?.sleepScore ?? null,
      }
    }),
    sleepScoreTrend7d: dates7.map((date) => ({
      date,
      value: mergedDays.get(date)?.sleepScore ?? null,
    })),
    spo2LastNight: dates7.map((date) => mergedDays.get(date)?.spo2 ?? null).at(-1) ?? null,
    spo2Trend7d: dates7.map((date) => ({
      date,
      value: mergedDays.get(date)?.spo2 ?? null,
    })),
    stressActive7d: dates7.map((date) => {
      const day = mergedDays.get(date)
      return {
        date,
        stress: day?.stress ?? null,
        activeMinutes: day?.activeMinutes ?? null,
      }
    }),
  }

  return NextResponse.json(payload)
}
