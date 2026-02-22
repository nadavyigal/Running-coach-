import { buildDerivedEvidence, type DerivedConfidence, type DerivedEvidence } from '@/lib/garminAcwr'

export interface GarminReadinessDay {
  date: string
  hrv: number | null
  sleepScore: number | null
  restingHr: number | null
  stress: number | null
}

export interface GarminReadinessComponents {
  hrvScore: number
  sleepScore: number
  rhrTrendScore: number
  stressScore: number
}

export interface ComputeGarminReadinessInput {
  days: GarminReadinessDay[]
  endDate?: string | Date
}

export interface GarminReadinessResult {
  score: number
  label: string
  confidence: DerivedConfidence
  evidence: DerivedEvidence
  flags: string[]
  components: GarminReadinessComponents
  userExplanation: string
  insight: string
  disclaimer: string
}

const MEDICAL_DISCLAIMER =
  'This is not medical advice. If you experience pain or dizziness, stop and consult a professional.'

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function round(value: number, precision = 2): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function resolveDateString(value: string | Date): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 10)
  }

  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  return new Date(parsed).toISOString().slice(0, 10)
}

function shiftIsoDate(dateIso: string, deltaDays: number): string {
  const parsed = Date.parse(`${dateIso}T00:00:00.000Z`)
  return new Date(parsed + deltaDays * MILLISECONDS_PER_DAY).toISOString().slice(0, 10)
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  const average = mean(values)
  const variance = mean(values.map((value) => (value - average) ** 2))
  return Math.sqrt(variance)
}

function normalizeStress(value: number | null): number | null {
  if (value == null) return null
  if (value < 0) return null
  if (value <= 10) return clamp(round(value * 10, 1), 0, 100)
  return clamp(round(value, 1), 0, 100)
}

function mapZScoreToReadiness(zScore: number): number {
  // z = -3 -> 0, z = 0 -> 50, z = +3 -> 100
  return clamp(round(((zScore + 3) / 6) * 100, 1), 0, 100)
}

function mapRhrDeltaToScore(delta: number): number {
  // Negative delta is better. Clamp delta at +/-6 bpm.
  const normalized = clamp(delta, -6, 6)
  return clamp(round(50 - normalized * (50 / 6), 1), 0, 100)
}

function resolveEndDate(input: ComputeGarminReadinessInput): string {
  const explicit = input.endDate ? resolveDateString(input.endDate) : null
  if (explicit) return explicit

  const latest = input.days
    .map((entry) => resolveDateString(entry.date))
    .filter((value): value is string => value != null)
    .sort()
    .pop()
  if (latest) return latest

  return new Date().toISOString().slice(0, 10)
}

function buildReadinessLabel(score: number): string {
  if (score >= 80) return 'High readiness may indicate strong recovery'
  if (score >= 60) return 'Moderate readiness may indicate you can handle planned training'
  if (score >= 40) return 'Cautious readiness may indicate partial recovery'
  return 'Low readiness may indicate recovery strain'
}

function buildReadinessInsight(score: number): string {
  if (score < 60) {
    return `Your load may be elevated, consider an easy day. ${MEDICAL_DISCLAIMER}`
  }
  return `Your readiness may indicate stable recovery for training. ${MEDICAL_DISCLAIMER}`
}

export function computeGarminReadiness(input: ComputeGarminReadinessInput): GarminReadinessResult {
  const endDate = resolveEndDate(input)
  const startDate = shiftIsoDate(endDate, -27)

  const byDate = new Map<string, GarminReadinessDay>()
  for (const entry of input.days) {
    const dateIso = resolveDateString(entry.date)
    if (!dateIso) continue
    if (dateIso < startDate || dateIso > endDate) continue
    byDate.set(dateIso, {
      date: dateIso,
      hrv: toNumber(entry.hrv),
      sleepScore: toNumber(entry.sleepScore),
      restingHr: toNumber(entry.restingHr),
      stress: normalizeStress(toNumber(entry.stress)),
    })
  }

  const dates: string[] = []
  for (let dayOffset = 27; dayOffset >= 0; dayOffset -= 1) {
    dates.push(shiftIsoDate(endDate, -dayOffset))
  }

  const timeline = dates.map((dateIso) => {
    const day = byDate.get(dateIso)
    return day ?? { date: dateIso, hrv: null, sleepScore: null, restingHr: null, stress: null }
  })

  const dayWithSignals = timeline.filter(
    (day) => day.hrv != null || day.sleepScore != null || day.restingHr != null || day.stress != null
  ).length
  const evidence = buildDerivedEvidence({
    dataPointsUsed: dayWithSignals,
    windowDays: 28,
  })

  const today =
    timeline[timeline.length - 1] ??
    {
      date: endDate,
      hrv: null,
      sleepScore: null,
      restingHr: null,
      stress: null,
    }

  const hrvValues = timeline.map((day) => day.hrv).filter((value): value is number => value != null)
  const hrvMean = mean(hrvValues)
  const hrvStdDev = standardDeviation(hrvValues)
  const todayHrv = today.hrv
  const hrvZScoreRaw = todayHrv != null && hrvStdDev > 0 ? (todayHrv - hrvMean) / hrvStdDev : 0
  const hrvZScore = clamp(hrvZScoreRaw, -3, 3)
  const hrvScore = mapZScoreToReadiness(hrvZScore)

  const sleepScore = clamp(round(today.sleepScore ?? 50, 1), 0, 100)

  const rhrValues7d = timeline
    .slice(-7)
    .map((day) => day.restingHr)
    .filter((value): value is number => value != null)
  const rhrAverage7d = rhrValues7d.length > 0 ? mean(rhrValues7d) : null
  const todayRhr = today.restingHr
  const rhrDelta = todayRhr != null && rhrAverage7d != null ? todayRhr - rhrAverage7d : 0
  const rhrTrendScore = mapRhrDeltaToScore(rhrDelta)

  const stressScore = clamp(round(100 - (today.stress ?? 50), 1), 0, 100)

  const weightedScore =
    hrvScore * 0.3 +
    sleepScore * 0.35 +
    rhrTrendScore * 0.2 +
    stressScore * 0.15
  const score = clamp(Math.round(weightedScore), 0, 100)
  const label = buildReadinessLabel(score)

  const flags = [...evidence.flags]
  const missingHrvDays = timeline.filter((day) => day.hrv == null).length
  const missingSleepDays = timeline.filter((day) => day.sleepScore == null).length
  const missingRhrDays = timeline.filter((day) => day.restingHr == null).length
  const missingStressDays = timeline.filter((day) => day.stress == null).length
  if (missingHrvDays > 0) flags.push(`Missing HRV for ${missingHrvDays} days`)
  if (missingSleepDays > 0) flags.push(`Missing sleep score for ${missingSleepDays} days`)
  if (missingRhrDays > 0) flags.push(`Missing resting HR for ${missingRhrDays} days`)
  if (missingStressDays > 0) flags.push(`Missing stress for ${missingStressDays} days`)

  return {
    score,
    label,
    confidence: evidence.confidence,
    evidence,
    flags,
    components: {
      hrvScore: round(hrvScore, 1),
      sleepScore: round(sleepScore, 1),
      rhrTrendScore: round(rhrTrendScore, 1),
      stressScore: round(stressScore, 1),
    },
    userExplanation: evidence.userExplanation,
    insight: buildReadinessInsight(score),
    disclaimer: MEDICAL_DISCLAIMER,
  }
}
