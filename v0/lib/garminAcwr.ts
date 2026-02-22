export type DerivedConfidence = 'high' | 'medium' | 'low'

export interface DerivedEvidence {
  dataPointsUsed: number
  missingDays: number
  confidence: DerivedConfidence
  flags: string[]
  userExplanation: string
}

export interface GarminActivityLoadSample {
  startTime: string | Date
  durationSeconds: number | null
  averageHeartRate?: number | null
  thresholdHeartRate?: number | null
  distanceMeters?: number | null
}

export interface ComputeGarminAcwrInput {
  activities: GarminActivityLoadSample[]
  endDate?: string | Date
  thresholdHeartRate?: number | null
}

export type AcwrZone = 'underload' | 'sweet_zone' | 'elevated' | 'high'

export interface GarminAcwrMetrics {
  acuteLoad7d: number
  chronicLoad28d: number
  acwr: number | null
  monotony7d: number | null
  strain7d: number
  weeklyVolumeMeters7d: number | null
  zone: AcwrZone
  evidence: DerivedEvidence
  flags: string[]
  insight: string
  disclaimer: string
  dailyLoads7d: number[]
  dailyLoads28d: number[]
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
  const total = values.reduce((sum, value) => sum + value, 0)
  return total / values.length
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  const average = mean(values)
  const variance = mean(values.map((value) => (value - average) ** 2))
  return Math.sqrt(variance)
}

function computeConfidenceLevel(dataPointsUsed: number): DerivedConfidence {
  if (dataPointsUsed >= 21) return 'high'
  if (dataPointsUsed < 7) return 'low'
  return 'medium'
}

export function buildDerivedEvidence(params: {
  dataPointsUsed: number
  windowDays?: number
  dataLabel?: string
}): DerivedEvidence {
  const windowDays = params.windowDays ?? 28
  const dataPointsUsed = Math.max(0, Math.min(windowDays, Math.round(params.dataPointsUsed)))
  const missingDays = Math.max(0, windowDays - dataPointsUsed)
  const confidence = computeConfidenceLevel(dataPointsUsed)
  const dataLabel = params.dataLabel ?? 'data'
  const flags: string[] = []

  if (missingDays > 0) {
    flags.push(`Missing ${dataLabel} for ${missingDays} days`)
  }

  if (confidence === 'low') {
    flags.push('Low data confidence')
  }

  return {
    dataPointsUsed,
    missingDays,
    confidence,
    flags,
    userExplanation: `Based on your last ${windowDays} days of training.`,
  }
}

function computeInternalLoad(params: {
  durationSeconds: number | null
  averageHeartRate: number | null
  thresholdHeartRate: number | null
}): number {
  const duration = toNumber(params.durationSeconds)
  if (duration == null || duration <= 0) return 0

  const averageHeartRate = toNumber(params.averageHeartRate)
  const thresholdHeartRate = toNumber(params.thresholdHeartRate)

  let intensityProxy = 1
  if (averageHeartRate != null && averageHeartRate > 0 && thresholdHeartRate != null && thresholdHeartRate > 0) {
    intensityProxy = clamp(averageHeartRate / thresholdHeartRate, 0.5, 2)
  }

  return duration * intensityProxy
}

function resolveAcwrZone(acwr: number | null): AcwrZone {
  if (acwr == null) return 'underload'
  if (acwr < 0.8) return 'underload'
  if (acwr <= 1.3) return 'sweet_zone'
  if (acwr <= 1.5) return 'elevated'
  return 'high'
}

function buildAcwrInsight(zone: AcwrZone): string {
  if (zone === 'sweet_zone') {
    return `Your recent load may indicate a balanced training zone. ${MEDICAL_DISCLAIMER}`
  }
  if (zone === 'underload') {
    return `Your load may indicate a lighter-than-usual week. Build gradually and monitor how you feel. ${MEDICAL_DISCLAIMER}`
  }
  return `Your load may be elevated, consider an easy day. ${MEDICAL_DISCLAIMER}`
}

function resolveEndDate(input: ComputeGarminAcwrInput): string {
  const explicit = input.endDate ? resolveDateString(input.endDate) : null
  if (explicit) return explicit

  const latestActivityDate = input.activities
    .map((activity) => resolveDateString(activity.startTime))
    .filter((value): value is string => value != null)
    .sort()
    .pop()
  if (latestActivityDate) return latestActivityDate

  return new Date().toISOString().slice(0, 10)
}

export function computeGarminAcwrMetrics(input: ComputeGarminAcwrInput): GarminAcwrMetrics {
  const endDate = resolveEndDate(input)
  const startDate = shiftIsoDate(endDate, -27)
  const thresholdFromInput = toNumber(input.thresholdHeartRate)

  const loadByDate = new Map<string, number>()
  const distanceByDate = new Map<string, number>()

  for (const activity of input.activities) {
    const activityDate = resolveDateString(activity.startTime)
    if (!activityDate) continue
    if (activityDate < startDate || activityDate > endDate) continue

    const load = computeInternalLoad({
      durationSeconds: activity.durationSeconds,
      averageHeartRate: activity.averageHeartRate ?? null,
      thresholdHeartRate: activity.thresholdHeartRate ?? thresholdFromInput,
    })
    if (load > 0) {
      loadByDate.set(activityDate, (loadByDate.get(activityDate) ?? 0) + load)
    }

    const distanceMeters = toNumber(activity.distanceMeters)
    if (distanceMeters != null && distanceMeters > 0) {
      distanceByDate.set(activityDate, (distanceByDate.get(activityDate) ?? 0) + distanceMeters)
    }
  }

  const datesInWindow: string[] = []
  for (let dayOffset = 27; dayOffset >= 0; dayOffset -= 1) {
    datesInWindow.push(shiftIsoDate(endDate, -dayOffset))
  }

  const dailyLoads28d = datesInWindow.map((dateIso) => round(loadByDate.get(dateIso) ?? 0, 4))
  const dailyLoads7d = dailyLoads28d.slice(-7)
  const dataPointsUsed = dailyLoads28d.filter((load) => load > 0).length

  const acuteLoad7d = round(mean(dailyLoads7d))
  const chronicLoad28d = round(mean(dailyLoads28d))
  const acwr = chronicLoad28d > 0 ? round(acuteLoad7d / chronicLoad28d, 3) : null
  const monotonyStdDev = standardDeviation(dailyLoads7d)
  const monotony7d = monotonyStdDev > 0 ? round(acuteLoad7d / monotonyStdDev, 3) : null
  const strain7d = round(dailyLoads7d.reduce((sum, value) => sum + value, 0) * (monotony7d ?? 0))
  const weeklyVolumeMetersRaw = datesInWindow
    .slice(-7)
    .reduce((sum, dateIso) => sum + (distanceByDate.get(dateIso) ?? 0), 0)
  const weeklyVolumeMeters7d = weeklyVolumeMetersRaw > 0 ? round(weeklyVolumeMetersRaw, 2) : null

  const evidence = buildDerivedEvidence({
    dataPointsUsed,
    windowDays: 28,
    dataLabel: 'training data',
  })
  const zone = resolveAcwrZone(acwr)
  const flags = [...evidence.flags]
  if (acwr != null && acwr > 1.3) flags.push('Load may be elevated, consider an easy day')
  if (monotony7d != null && monotony7d >= 2) flags.push('High 7-day monotony may indicate low load variation')

  return {
    acuteLoad7d,
    chronicLoad28d,
    acwr,
    monotony7d,
    strain7d,
    weeklyVolumeMeters7d,
    zone,
    evidence,
    flags,
    insight: buildAcwrInsight(zone),
    disclaimer: MEDICAL_DISCLAIMER,
    dailyLoads7d,
    dailyLoads28d,
  }
}

