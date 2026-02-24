import { compute28DayBaseline, type DailySignalSample, type ReadinessBaseline } from '@/lib/garmin/metrics/baseline'
import { calculateReadinessConfidence, type ReadinessConfidence } from '@/lib/garmin/metrics/confidence'
import { evaluateUnderRecoverySignature } from '@/lib/garmin/metrics/underRecovery'
import { createAdminClient } from '@/lib/supabase/admin'

export type ReadinessState = 'ready' | 'steady' | 'caution'

export interface ReadinessDriver {
  signal: 'hrv' | 'resting_hr' | 'sleep_score' | 'stress' | 'body_battery'
  impact: 'positive' | 'negative' | 'neutral' | 'missing'
  value: number | null
  baseline: number | null
  contribution: number
  explanation: string
}

export interface UnderRecoverySignature {
  flagged: boolean
  triggerCount: number
  triggers: string[]
  confidence: 'high' | 'medium' | 'low'
  recommendation: string
}

export interface ReadinessComputationResult {
  score: number
  state: ReadinessState
  drivers: ReadinessDriver[]
  confidence: ReadinessConfidence
  confidenceReason: string
  lastSyncAt: string | null
  missingSignals: string[]
  underRecovery: UnderRecoverySignature
  load: {
    acuteLoad7d: number | null
    chronicLoad28d: number | null
    acwr: number | null
  }
  baseline: ReadinessBaseline
}

export type ReadinessApiResponse = Omit<ReadinessComputationResult, 'baseline'>

interface GarminDailyMetricRow {
  date: string
  hrv: number | null
  resting_hr: number | null
  sleep_score: number | null
  stress: number | null
  body_battery: number | null
}

interface TrainingDerivedRow {
  date: string
  acute_load_7d: number | null
  chronic_load_28d: number | null
  acwr: number | null
}

function round(value: number, precision = 1): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function safePercentDelta(current: number | null, baseline: number | null): number | null {
  if (current == null || baseline == null || baseline === 0) return null
  return ((current - baseline) / baseline) * 100
}

function toState(score: number): ReadinessState {
  if (score >= 75) return 'ready'
  if (score >= 55) return 'steady'
  return 'caution'
}

function computeSignalScore(params: {
  signal: ReadinessDriver['signal']
  value: number | null
  baseline: number | null
}): { score: number | null; impact: ReadinessDriver['impact']; explanation: string } {
  const { signal, value, baseline } = params

  if (value == null) {
    return {
      score: null,
      impact: 'missing',
      explanation: `${signal.replace('_', ' ')} is missing today.`,
    }
  }

  if (signal === 'sleep_score') {
    const score = clamp(value, 0, 100)
    return {
      score,
      impact: score >= 70 ? 'positive' : score >= 55 ? 'neutral' : 'negative',
      explanation: `Sleep score is ${Math.round(score)}.`,
    }
  }

  if (signal === 'body_battery') {
    const score = clamp(value, 0, 100)
    return {
      score,
      impact: score >= 60 ? 'positive' : score >= 45 ? 'neutral' : 'negative',
      explanation: `Body battery is ${Math.round(score)}.`,
    }
  }

  if (signal === 'stress') {
    const normalized = clamp(100 - value, 0, 100)
    return {
      score: normalized,
      impact: normalized >= 60 ? 'positive' : normalized >= 45 ? 'neutral' : 'negative',
      explanation: `Stress is ${Math.round(value)} (lower is better).`,
    }
  }

  if (signal === 'hrv') {
    const deltaPct = safePercentDelta(value, baseline)
    const score = clamp(50 + (deltaPct ?? 0) * 2.5, 0, 100)
    const impact: ReadinessDriver['impact'] =
      deltaPct == null ? 'neutral' : deltaPct >= 6 ? 'positive' : deltaPct <= -6 ? 'negative' : 'neutral'

    const explanation =
      deltaPct == null
        ? `HRV is ${Math.round(value)} with no baseline yet.`
        : `HRV is ${Math.round(Math.abs(deltaPct))}% ${deltaPct >= 0 ? 'above' : 'below'} baseline.`

    return { score, impact, explanation }
  }

  const delta = baseline != null ? baseline - value : 0
  const score = clamp(50 + delta * 8, 0, 100)
  const impact: ReadinessDriver['impact'] =
    baseline == null ? 'neutral' : delta >= 3 ? 'positive' : delta <= -3 ? 'negative' : 'neutral'
  const explanation =
    baseline == null
      ? `Resting HR is ${Math.round(value)} with no baseline yet.`
      : `Resting HR is ${Math.round(Math.abs(delta))} bpm ${delta >= 0 ? 'below' : 'above'} baseline.`

  return { score, impact, explanation }
}

export function computeDeterministicReadiness(input: {
  samples: DailySignalSample[]
  lastSyncAt: string | null
  load: {
    acuteLoad7d: number | null
    chronicLoad28d: number | null
    acwr: number | null
  }
}): ReadinessComputationResult {
  const sorted = [...input.samples].sort((a, b) => a.date.localeCompare(b.date))
  const today =
    sorted.at(-1) ?? {
      date: new Date().toISOString().slice(0, 10),
      hrv: null,
      resting_hr: null,
      sleep_score: null,
      stress: null,
      body_battery: null,
    }

  const baselinePool = sorted.slice(0, Math.max(0, sorted.length - 1))
  const baseline = compute28DayBaseline(baselinePool)

  const weightedSignals: Array<{ signal: ReadinessDriver['signal']; weight: number }> = [
    { signal: 'hrv', weight: 0.28 },
    { signal: 'sleep_score', weight: 0.28 },
    { signal: 'resting_hr', weight: 0.2 },
    { signal: 'stress', weight: 0.14 },
    { signal: 'body_battery', weight: 0.1 },
  ]

  const drivers: ReadinessDriver[] = weightedSignals.map(({ signal, weight }) => {
    const value = today[signal]
    const baselineValue = baseline[signal]
    const scored = computeSignalScore({ signal, value, baseline: baselineValue })

    return {
      signal,
      impact: scored.impact,
      value,
      baseline: baselineValue,
      contribution: scored.score == null ? 0 : round(scored.score * weight, 2),
      explanation: scored.explanation,
    }
  })

  const availableDriverScores = drivers
    .map((driver, index) => ({
      score: driver.value == null ? null : driver.contribution,
      weight: weightedSignals[index]?.weight ?? 0,
    }))
    .filter((entry): entry is { score: number; weight: number } => entry.score != null)

  const numerator = availableDriverScores.reduce((sum, entry) => sum + entry.score, 0)
  const denominator = availableDriverScores.reduce((sum, entry) => sum + entry.weight, 0)
  const score = denominator > 0 ? clamp(Math.round(numerator / denominator), 0, 100) : 50

  const availableSignalsToday = drivers.filter((driver) => driver.value != null).length
  const confidence = calculateReadinessConfidence({
    baselineSampleCount: baseline.sampleCount,
    availableSignalsToday,
    lastSyncAt: input.lastSyncAt,
  })

  const underRecovery = evaluateUnderRecoverySignature({
    today,
    baseline,
  })

  const missingSignals = drivers
    .filter((driver) => driver.value == null)
    .map((driver) => driver.signal)

  return {
    score,
    state: toState(score),
    drivers,
    confidence: confidence.confidence,
    confidenceReason: confidence.confidenceReason,
    lastSyncAt: input.lastSyncAt,
    missingSignals,
    underRecovery,
    load: input.load,
    baseline,
  }
}

export async function getReadinessPayloadForUser(params: {
  userId: number
  authUserId?: string | null
}): Promise<ReadinessComputationResult> {
  const { userId, authUserId = null } = params
  const supabase = createAdminClient()

  const [dailyQuery, derivedQuery, connectionQuery] = await Promise.all([
    supabase
      .from('garmin_daily_metrics')
      .select('date,hrv,resting_hr,sleep_score,stress,body_battery')
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .limit(35),
    supabase
      .from('training_derived_metrics')
      .select('date,acute_load_7d,chronic_load_28d,acwr')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('garmin_connections')
      .select('last_sync_at')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (dailyQuery.error) {
    throw new Error(`Failed to load garmin_daily_metrics: ${dailyQuery.error.message}`)
  }

  if (derivedQuery.error) {
    throw new Error(`Failed to load training_derived_metrics: ${derivedQuery.error.message}`)
  }

  if (connectionQuery.error) {
    throw new Error(`Failed to load garmin_connections: ${connectionQuery.error.message}`)
  }

  const dailyRows = (dailyQuery.data ?? []) as GarminDailyMetricRow[]
  const derivedRow = (derivedQuery.data as TrainingDerivedRow | null) ?? null
  const lastSyncAt = (connectionQuery.data as { last_sync_at?: string | null } | null)?.last_sync_at ?? null

  const computed = computeDeterministicReadiness({
    samples: dailyRows,
    lastSyncAt,
    load: {
      acuteLoad7d: derivedRow?.acute_load_7d ?? null,
      chronicLoad28d: derivedRow?.chronic_load_28d ?? null,
      acwr: derivedRow?.acwr ?? null,
    },
  })

  const todayIso = new Date().toISOString().slice(0, 10)

  try {
    await supabase
      .from('training_derived_metrics')
      .upsert(
        {
          user_id: userId,
          ...(authUserId ? { auth_user_id: authUserId } : {}),
          date: todayIso,
          readiness_score: computed.score,
          readiness_state: computed.state,
          drivers: computed.drivers,
          confidence: computed.confidence,
          confidence_reason: computed.confidenceReason,
          flags_json: {
            missingSignals: computed.missingSignals,
            underRecovery: computed.underRecovery,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,date' }
      )
      .throwOnError()
  } catch {
    // Keep readiness endpoint resilient even if write-back fails.
  }

  return computed
}
