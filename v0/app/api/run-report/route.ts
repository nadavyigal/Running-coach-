import { NextResponse } from 'next/server'
import { openai } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'

import { withSecureOpenAI } from '@/lib/apiKeyManager'
import { logError } from '@/lib/backendMonitoring'
import { calculateGPSQualityScore, getGPSQualityLevel, type GPSAccuracyData } from '@/lib/gps-monitoring'
import { ENABLE_AUTO_PAUSE, ENABLE_PACE_CHART } from '@/lib/featureFlags'
import { logger } from '@/lib/logger'
import { withApiSecurity, type ApiRequest } from '@/lib/security.middleware'

const RUN_TYPES = ['easy', 'tempo', 'intervals', 'long', 'time-trial', 'hill', 'other'] as const
type RunType = (typeof RUN_TYPES)[number]

const WorkoutSchema = z
  .object({
    date: z.string().optional(),
    sessionType: z.string().optional(),
    durationMinutes: z.coerce.number().min(0).optional(),
    targetPace: z.string().optional(),
    targetHrZone: z.string().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough()

const DerivedMetricsSchema = z
  .object({
    paceStability: z.string().optional(),
    cadenceNote: z.string().optional(),
    hrNote: z.string().optional(),
  })
  .passthrough()

const RunReportRequestSchema = z
  .object({
    run: z
      .object({
        id: z.coerce.number().int().positive().optional(),
        type: z.string().optional(),
        distanceKm: z.coerce.number().min(0),
        durationSeconds: z.coerce.number().min(0),
        avgPaceSecondsPerKm: z.coerce.number().min(0).optional(),
        completedAt: z.union([z.string(), z.date()]).optional(),
        notes: z.string().optional(),
        heartRateBpm: z.coerce.number().min(0).optional(),
        calories: z.coerce.number().min(0).optional(),
        gpsAccuracyData: z.string().optional(),
      })
      .passthrough(),
    gps: z
      .object({
        points: z.coerce.number().int().min(0).optional(),
        startAccuracy: z.coerce.number().min(0).optional(),
        endAccuracy: z.coerce.number().min(0).optional(),
        averageAccuracy: z.coerce.number().min(0).optional(),
      })
      .passthrough()
      .optional(),
    paceData: z
      .array(
        z
          .object({
            distanceKm: z.coerce.number().min(0),
            paceMinPerKm: z.coerce.number().min(0),
            timestamp: z.union([z.coerce.number(), z.string(), z.date()]).optional(),
          })
          .passthrough()
      )
      .optional(),
    derivedMetrics: DerivedMetricsSchema.optional(),
    upcomingWorkouts: z.array(WorkoutSchema).optional(),
    userFeedback: z
      .object({
        rpe: z.coerce.number().min(0).max(10).optional(),
        soreness: z.string().optional(),
      })
      .optional(),
  })
  .passthrough()

const SafetyFlagSchema = z.object({
  code: z.enum(['load_spike', 'injury_signal', 'heat_risk', 'missing_data', 'uncertain']),
  severity: z.enum(['low', 'medium', 'high']),
  message: z.string().min(1),
})

const InsightSchema = z.object({
  runId: z.number().int().nonnegative(),
  summary: z.array(z.string().min(1)).min(1).max(4),
  effort: z.enum(['easy', 'moderate', 'hard']),
  metrics: z.object({
    paceStability: z.string().min(1),
    cadenceNote: z.string().optional(),
    hrNote: z.string().optional(),
  }),
  pacingAnalysis: z.string().min(1).optional(),
  paceConsistency: z.enum(['consistent', 'fading', 'negative-split', 'erratic']).optional(),
  paceVariability: z.coerce.number().min(0).optional(),
  recovery: z.object({
    priority: z.array(z.string().min(1)).min(1),
    optional: z.array(z.string().min(1)).optional(),
  }),
  nextSessionNudge: z.string().optional(),
  safetyFlags: z.array(SafetyFlagSchema).optional(),
})

type RunInsight = z.infer<typeof InsightSchema>

type NormalizedRunReportInput = {
  runId: number
  runType: RunType
  distanceKm: number
  durationSeconds: number
  avgPaceSecondsPerKm: number
  completedAt: string
  notes?: string
  heartRateBpm?: number
  calories?: number
  gpsAccuracyData?: string
  gps: {
    points: number
    startAccuracy?: number
    endAccuracy?: number
    averageAccuracy?: number
  }
  paceData: Array<{
    distanceKm: number
    paceMinPerKm: number
  }>
  derivedMetrics: {
    paceStability: string
    cadenceNote?: string
    hrNote?: string
  }
  upcomingWorkouts: Array<z.infer<typeof WorkoutSchema>>
  userFeedback?: {
    rpe?: number
    soreness?: string
  }
}

const RUN_REPORT_MODEL = process.env.RUN_REPORT_MODEL || 'gpt-4o-mini'
const MIN_DISTANCE_FOR_PACE_KM = 0.05
const PACE_VARIABILITY_ERRATIC_MIN = 0.5
const PACE_SPLIT_THRESHOLD_MIN = 0.15

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function formatPace(secondsPerKm: number): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '--:--'
  const mins = Math.floor(secondsPerKm / 60)
  const secs = Math.round(secondsPerKm % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function normalizeRunType(value: unknown): RunType {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if ((RUN_TYPES as readonly string[]).includes(trimmed)) {
      return trimmed as RunType
    }
  }
  return 'other'
}

function normalizeDate(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString()
  }
  return new Date().toISOString()
}

function hasInjurySignal(text?: string): boolean {
  if (!text) return false
  const normalized = text.toLowerCase()
  return ['pain', 'injury', 'dizzy', 'dizziness', 'sharp', 'strain'].some((flag) =>
    normalized.includes(flag)
  )
}

function selectEffort(input: NormalizedRunReportInput): 'easy' | 'moderate' | 'hard' {
  const rpe = input.userFeedback?.rpe
  if (typeof rpe === 'number') {
    if (rpe >= 7) return 'hard'
    if (rpe >= 4) return 'moderate'
    return 'easy'
  }

  if (['tempo', 'intervals', 'hill', 'time-trial'].includes(input.runType)) {
    return 'hard'
  }

  if (input.distanceKm >= 10 || input.durationSeconds >= 75 * 60) return 'hard'
  if (input.distanceKm >= 5 || input.durationSeconds >= 40 * 60) return 'moderate'
  return 'easy'
}

function buildDerivedMetrics(input: {
  distanceKm: number
  gpsPoints: number
  averageAccuracy?: number
  heartRateBpm?: number
  override?: z.infer<typeof DerivedMetricsSchema>
}): { paceStability: string; cadenceNote?: string; hrNote?: string } {
  const override = input.override ?? {}
  const hrNote =
    typeof override.hrNote === 'string'
      ? override.hrNote
      : input.heartRateBpm
        ? `Avg HR ${Math.round(input.heartRateBpm)} bpm.`
        : 'HR data not available; effort based on pace and duration.'

  const paceStability =
    typeof override.paceStability === 'string'
      ? override.paceStability
      : input.distanceKm < 0.5 || input.gpsPoints < 4
        ? 'Not enough GPS data to judge pacing.'
        : input.averageAccuracy && input.averageAccuracy > 80
          ? 'GPS accuracy was low; pacing may be noisy.'
          : input.gpsPoints >= 20
            ? 'Pace looked steady overall.'
            : 'Pace varied across segments.'

  return {
    paceStability,
    ...(typeof override.cadenceNote === 'string' ? { cadenceNote: override.cadenceNote } : {}),
    hrNote,
  }
}

type PaceSegment = {
  startKm: number
  endKm: number
  paceMinPerKm: number
}

type PaceStats = {
  avgPaceMinPerKm: number
  minPaceMinPerKm: number
  maxPaceMinPerKm: number
  variabilityMinPerKm: number
  firstKmPaceMinPerKm?: number
  lastKmPaceMinPerKm?: number
  totalDistanceKm: number
}

function normalizePaceData(
  paceData?: Array<{ distanceKm?: number; paceMinPerKm?: number }>
): Array<{ distanceKm: number; paceMinPerKm: number }> {
  if (!paceData || paceData.length === 0) return []
  const normalized: Array<{ distanceKm: number; paceMinPerKm: number }> = []
  for (const entry of paceData) {
    const distanceKm = typeof entry.distanceKm === 'number' ? entry.distanceKm : NaN
    const paceMinPerKm = typeof entry.paceMinPerKm === 'number' ? entry.paceMinPerKm : NaN
    if (!Number.isFinite(distanceKm) || !Number.isFinite(paceMinPerKm)) continue
    if (distanceKm <= 0 || paceMinPerKm <= 0) continue
    normalized.push({ distanceKm, paceMinPerKm })
  }
  return normalized
}

function buildPaceSegments(
  paceData: Array<{ distanceKm: number; paceMinPerKm: number }>
): PaceSegment[] {
  if (paceData.length === 0) return []
  const segments: PaceSegment[] = []
  let previousDistance = 0
  for (const entry of paceData) {
    if (entry.distanceKm <= previousDistance) continue
    segments.push({
      startKm: previousDistance,
      endKm: entry.distanceKm,
      paceMinPerKm: entry.paceMinPerKm,
    })
    previousDistance = entry.distanceKm
  }
  return segments
}

function averagePaceForRange(segments: PaceSegment[], startKm: number, endKm: number): number | null {
  if (segments.length === 0 || endKm <= startKm) return null
  let weightedTotal = 0
  let totalDistance = 0
  for (const segment of segments) {
    const overlapStart = Math.max(segment.startKm, startKm)
    const overlapEnd = Math.min(segment.endKm, endKm)
    if (overlapEnd <= overlapStart) continue
    const overlapDistance = overlapEnd - overlapStart
    weightedTotal += overlapDistance * segment.paceMinPerKm
    totalDistance += overlapDistance
  }
  return totalDistance > 0 ? weightedTotal / totalDistance : null
}

function calculatePaceStats(
  paceData: Array<{ distanceKm: number; paceMinPerKm: number }>
): PaceStats | null {
  if (paceData.length === 0) return null
  const segments = buildPaceSegments(paceData)
  if (segments.length === 0) return null

  const totalDistanceKm = segments[segments.length - 1].endKm
  if (!Number.isFinite(totalDistanceKm) || totalDistanceKm <= 0) return null

  let weightedSum = 0
  let weightedVariance = 0
  let distanceSum = 0
  let minPace = Number.POSITIVE_INFINITY
  let maxPace = 0

  for (const segment of segments) {
    const distance = segment.endKm - segment.startKm
    if (!Number.isFinite(distance) || distance <= 0) continue
    distanceSum += distance
    weightedSum += distance * segment.paceMinPerKm
    minPace = Math.min(minPace, segment.paceMinPerKm)
    maxPace = Math.max(maxPace, segment.paceMinPerKm)
  }

  if (distanceSum <= 0) return null
  const avgPaceMinPerKm = weightedSum / distanceSum

  for (const segment of segments) {
    const distance = segment.endKm - segment.startKm
    if (!Number.isFinite(distance) || distance <= 0) continue
    const diff = segment.paceMinPerKm - avgPaceMinPerKm
    weightedVariance += distance * diff * diff
  }

  const variabilityMinPerKm = Math.sqrt(weightedVariance / distanceSum)
  const firstKmPaceMinPerKm =
    totalDistanceKm >= 1 ? averagePaceForRange(segments, 0, 1) ?? undefined : undefined
  const lastKmPaceMinPerKm =
    totalDistanceKm >= 1
      ? averagePaceForRange(segments, Math.max(0, totalDistanceKm - 1), totalDistanceKm) ??
        undefined
      : undefined

  if (!Number.isFinite(minPace) || !Number.isFinite(maxPace)) return null

  return {
    avgPaceMinPerKm,
    minPaceMinPerKm: minPace,
    maxPaceMinPerKm: maxPace,
    variabilityMinPerKm,
    firstKmPaceMinPerKm,
    lastKmPaceMinPerKm,
    totalDistanceKm,
  }
}

function classifyPaceConsistency(stats: PaceStats): RunInsight['paceConsistency'] {
  if (stats.variabilityMinPerKm >= PACE_VARIABILITY_ERRATIC_MIN) return 'erratic'

  if (
    typeof stats.firstKmPaceMinPerKm === 'number' &&
    typeof stats.lastKmPaceMinPerKm === 'number'
  ) {
    const splitDiff = stats.lastKmPaceMinPerKm - stats.firstKmPaceMinPerKm
    if (splitDiff >= PACE_SPLIT_THRESHOLD_MIN) return 'fading'
    if (splitDiff <= -PACE_SPLIT_THRESHOLD_MIN) return 'negative-split'
    return 'consistent'
  }

  return stats.variabilityMinPerKm <= PACE_SPLIT_THRESHOLD_MIN ? 'consistent' : 'erratic'
}

function normalizeInput(input: z.infer<typeof RunReportRequestSchema>): NormalizedRunReportInput {
  const runType = normalizeRunType(input.run.type)
  const distanceKm = Number.isFinite(input.run.distanceKm) ? Math.max(0, input.run.distanceKm) : 0
  const durationSeconds = Number.isFinite(input.run.durationSeconds)
    ? Math.max(0, input.run.durationSeconds)
    : 0
  const avgPaceSecondsPerKm =
    typeof input.run.avgPaceSecondsPerKm === 'number' && input.run.avgPaceSecondsPerKm > 0
      ? input.run.avgPaceSecondsPerKm
      : distanceKm >= MIN_DISTANCE_FOR_PACE_KM && durationSeconds > 0
        ? durationSeconds / distanceKm
        : 0

  const gpsPoints = input.gps?.points ?? 0
  const paceData = normalizePaceData(input.paceData)
  const derivedMetrics = buildDerivedMetrics({
    distanceKm,
    gpsPoints,
    averageAccuracy: input.gps?.averageAccuracy,
    heartRateBpm: input.run.heartRateBpm,
    override: input.derivedMetrics,
  })

  return {
    runId: input.run.id ?? 0,
    runType,
    distanceKm,
    durationSeconds,
    avgPaceSecondsPerKm,
    completedAt: normalizeDate(input.run.completedAt),
    notes: input.run.notes,
    heartRateBpm: input.run.heartRateBpm,
    calories: input.run.calories,
    gpsAccuracyData: input.run.gpsAccuracyData,
    gps: {
      points: gpsPoints,
      startAccuracy: input.gps?.startAccuracy,
      endAccuracy: input.gps?.endAccuracy,
      averageAccuracy: input.gps?.averageAccuracy,
    },
    paceData,
    derivedMetrics,
    upcomingWorkouts: input.upcomingWorkouts ?? [],
    userFeedback: input.userFeedback,
  }
}

function parseGpsAccuracyData(raw?: string): GPSAccuracyData[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is GPSAccuracyData =>
        item && typeof item === 'object' && Number.isFinite(item.accuracyRadius)
    )
  } catch {
    return []
  }
}

function getAverageAccuracy(accuracyData: GPSAccuracyData[]): number | null {
  if (accuracyData.length === 0) return null
  const total = accuracyData.reduce((sum, item) => sum + item.accuracyRadius, 0)
  return total / accuracyData.length
}

function buildSkillInput(
  input: NormalizedRunReportInput,
  gpsQuality?: { score: number; level: string; averageAccuracy: number },
  paceStats?: PaceStats | null
) {
  const durationMinutes = input.durationSeconds > 0 ? Math.round((input.durationSeconds / 60) * 10) / 10 : 0
  const avgPaceFormatted =
    input.avgPaceSecondsPerKm > 0 ? formatPace(input.avgPaceSecondsPerKm) : undefined

  const pacingPayload =
    paceStats && input.paceData.length > 0
      ? {
          paceData: input.paceData,
          paceStats: {
            averagePace: formatPace(paceStats.avgPaceMinPerKm * 60),
            minPace: formatPace(paceStats.minPaceMinPerKm * 60),
            maxPace: formatPace(paceStats.maxPaceMinPerKm * 60),
            variabilitySeconds: Math.round(paceStats.variabilityMinPerKm * 60),
            ...(typeof paceStats.firstKmPaceMinPerKm === 'number'
              ? { firstKmPace: formatPace(paceStats.firstKmPaceMinPerKm * 60) }
              : {}),
            ...(typeof paceStats.lastKmPaceMinPerKm === 'number'
              ? { lastKmPace: formatPace(paceStats.lastKmPaceMinPerKm * 60) }
              : {}),
          },
        }
      : undefined

  return {
    run: {
      runId: input.runId,
      date: input.completedAt,
      distanceKm: input.distanceKm,
      durationMinutes,
      ...(avgPaceFormatted ? { avgPace: avgPaceFormatted } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      runType: input.runType,
      ...(typeof input.heartRateBpm === 'number' && input.heartRateBpm > 0
        ? { heartRateBpm: input.heartRateBpm }
        : {}),
      ...(typeof input.calories === 'number' && input.calories > 0 ? { calories: input.calories } : {}),
    },
    ...(gpsQuality ? { gpsQuality } : {}),
            ...(pacingPayload ? { pacing: pacingPayload } : {}),
    derivedMetrics: input.derivedMetrics,
    upcomingWorkouts: input.upcomingWorkouts,
    ...(input.userFeedback ? { userFeedback: input.userFeedback } : {}),
  }
}

function buildFallbackInsight(input: NormalizedRunReportInput): RunInsight {
  const summary: string[] = []
  if (input.distanceKm > 0 && input.durationSeconds > 0) {
    const paceText =
      input.avgPaceSecondsPerKm > 0 ? ` (${formatPace(input.avgPaceSecondsPerKm)}/km)` : ''
    summary.push(
      `Run logged: ${input.distanceKm.toFixed(2)}km in ${formatTime(input.durationSeconds)}${paceText}.`
    )
  } else if (input.durationSeconds > 0) {
    summary.push(`Run logged: ${formatTime(input.durationSeconds)} total.`)
  } else {
    summary.push('Run logged.')
  }

  if (input.distanceKm >= 7) summary.push('Solid aerobic volume for today.')
  else if (input.distanceKm >= 3) summary.push('Nice consistency-building run.')
  else summary.push('Short run still counts for habit building.')

  const effort = selectEffort(input)

  const safetyFlags: RunInsight['safetyFlags'] = []
  if (!input.heartRateBpm) {
    safetyFlags.push({
      code: 'missing_data',
      severity: 'low',
      message: 'Heart rate data missing; effort is based on pace and duration.',
    })
  }
  if (input.gps.averageAccuracy && input.gps.averageAccuracy > 80) {
    safetyFlags.push({
      code: 'uncertain',
      severity: 'low',
      message: 'GPS accuracy was low; distance and pace may be noisy.',
    })
  }
  const injurySignal =
    hasInjurySignal(input.notes) || hasInjurySignal(input.userFeedback?.soreness)
  if (injurySignal) {
    safetyFlags.push({
      code: 'injury_signal',
      severity: 'high',
      message: 'Possible pain or dizziness noted. Stop if symptoms persist and consult a professional.',
    })
  }

  const recoveryPriority: string[] = [
    'Hydrate and eat a carb plus protein snack.',
  ]
  if (effort === 'hard' || input.durationSeconds >= 60 * 60) {
    recoveryPriority.push('Keep the next 24h easy and prioritize sleep.')
  } else {
    recoveryPriority.push('Light mobility or a short walk can help recovery.')
  }

  const recoveryOptional: string[] = []
  if (injurySignal) {
    recoveryOptional.push('Prioritize rest and gentle movement only.')
  }
  if (input.gps.averageAccuracy && input.gps.averageAccuracy > 80) {
    recoveryOptional.push('Review location accuracy settings before the next run.')
  }

  let nextSessionNudge = 'Next session: easy 20-40 min or rest if needed.'
  if (injurySignal) {
    nextSessionNudge = 'Next session: rest or gentle cross-training; stop if pain persists.'
  } else if (effort === 'hard') {
    nextSessionNudge = 'Next session: 30-45 min easy or rest if legs feel heavy.'
  }

  return {
    runId: input.runId,
    summary: summary.slice(0, 4),
    effort,
    metrics: input.derivedMetrics,
    recovery: {
      priority: recoveryPriority,
      ...(recoveryOptional.length ? { optional: recoveryOptional } : {}),
    },
    nextSessionNudge,
    ...(safetyFlags.length ? { safetyFlags } : {}),
  }
}

function normalizeInsight(insight: RunInsight, fallback: RunInsight): RunInsight {
  const summary = Array.isArray(insight.summary)
    ? insight.summary.filter((item) => typeof item === 'string' && item.trim()).slice(0, 4)
    : fallback.summary

  const metrics = insight.metrics?.paceStability
    ? {
        paceStability: insight.metrics.paceStability,
        ...(typeof insight.metrics.cadenceNote === 'string' ? { cadenceNote: insight.metrics.cadenceNote } : {}),
        ...(typeof insight.metrics.hrNote === 'string' ? { hrNote: insight.metrics.hrNote } : {}),
      }
    : fallback.metrics

  const recovery = insight.recovery?.priority?.length
    ? {
        priority: insight.recovery.priority,
        ...(insight.recovery.optional?.length ? { optional: insight.recovery.optional } : {}),
      }
    : fallback.recovery

  const effort = ['easy', 'moderate', 'hard'].includes(insight.effort) ? insight.effort : fallback.effort
  const nextSessionNudge =
    typeof insight.nextSessionNudge === 'string' && insight.nextSessionNudge.trim()
      ? insight.nextSessionNudge
      : fallback.nextSessionNudge

  const safetyFlags =
    Array.isArray(insight.safetyFlags) && insight.safetyFlags.length > 0
      ? insight.safetyFlags
      : fallback.safetyFlags

  return {
    runId: Number.isFinite(insight.runId) ? insight.runId : fallback.runId,
    summary: summary.length ? summary : fallback.summary,
    effort,
    metrics,
    ...(typeof insight.pacingAnalysis === 'string' ? { pacingAnalysis: insight.pacingAnalysis } : {}),
    ...(insight.paceConsistency ? { paceConsistency: insight.paceConsistency } : {}),
    ...(typeof insight.paceVariability === 'number'
      ? { paceVariability: insight.paceVariability }
      : {}),
    recovery,
    ...(nextSessionNudge ? { nextSessionNudge } : {}),
    ...(safetyFlags?.length ? { safetyFlags } : {}),
  }
}

const handler = async (req: ApiRequest) => {
  const requestStartedAt = Date.now()
  let rawBody: unknown = null

  try {
    rawBody = await req.json()
  } catch (error) {
    logger.warn('[run-report] Failed to parse request body; using fallback.', error)
  }

  const parsed = RunReportRequestSchema.safeParse(rawBody)
  if (!parsed.success) {
    logger.warn('[run-report] Invalid payload; using fallback.', parsed.error.flatten())
  }

  const normalized = normalizeInput(
    parsed.success
      ? parsed.data
      : {
          run: {
            distanceKm: 0,
            durationSeconds: 0,
          },
        }
  )

  const gpsQualityEnabled = ENABLE_AUTO_PAUSE
  const paceChartEnabled = ENABLE_PACE_CHART
  const accuracyData = gpsQualityEnabled ? parseGpsAccuracyData(normalized.gpsAccuracyData) : []
  const averageAccuracyFromData = getAverageAccuracy(accuracyData)
  const gpsQuality =
    gpsQualityEnabled && accuracyData.length > 0
      ? (() => {
          const score = calculateGPSQualityScore(accuracyData)
          return {
            score,
            level: getGPSQualityLevel(score),
            averageAccuracy:
              averageAccuracyFromData ??
              (typeof normalized.gps.averageAccuracy === 'number' ? normalized.gps.averageAccuracy : 0),
          }
        })()
      : undefined

  const paceStats =
    paceChartEnabled && normalized.paceData.length > 0
      ? calculatePaceStats(normalized.paceData)
      : null
  const paceConsistency = paceStats ? classifyPaceConsistency(paceStats) : undefined
  const skillInput = buildSkillInput(normalized, gpsQuality, paceStats)
  const fallbackInsight = buildFallbackInsight(normalized)

  logger.info('ai_skill_invoked', {
    skill_name: 'run-insights-recovery',
    run_id: normalized.runId,
    model: RUN_REPORT_MODEL,
  })

  const aiResult = await withSecureOpenAI(async () => {
    const { object } = await generateObject({
      model: openai(RUN_REPORT_MODEL),
      schema: InsightSchema,
      prompt: [
        {
          role: 'system',
          content:
            'You are Run-Smart, an evidence-based running coach. Be supportive, concise, and practical. No medical diagnosis. If pain or dizziness is noted, advise stopping and consulting a professional. Keep total output under 120 words.',
        },
        {
          role: 'user',
          content: `Skill: run-insights-recovery\nInput:\n${JSON.stringify(
            skillInput,
            null,
            2
          )}\n${
            paceStats
              ? `\nPacing Analysis:\n- Was the pace consistent, fading (positive split), or negative split?\n- Average pace: ${formatPace(
                  paceStats.avgPaceMinPerKm * 60
                )}, pace range: ${formatPace(paceStats.minPaceMinPerKm * 60)}-${formatPace(
                  paceStats.maxPaceMinPerKm * 60
                )}\n- Pace variability: ${Math.round(
                  paceStats.variabilityMinPerKm * 60
                )}s (low = consistent, high = erratic)\n- Provide 1-2 sentence pacing assessment\n- If pacing was poor, suggest a specific improvement\n- Include pacingAnalysis (1-2 sentences), paceConsistency, and paceVariability (seconds per km as number)\n- Current paceConsistency suggestion: ${paceConsistency ?? 'unknown'}`
              : '\nPacing Analysis: Pace data unavailable; omit pacingAnalysis, paceConsistency, paceVariability.'
          }\nReturn JSON that matches the provided schema.`,
        },
      ],
    })

    return object
  }, fallbackInsight)

  if (!aiResult.success && aiResult.error) {
    logger.warn('[run-report] AI insight generation failed; using fallback.', aiResult.error)
    logError('run-report.ai', aiResult.error, { runId: normalized.runId })
  }

  const report = normalizeInsight(aiResult.data ?? fallbackInsight, fallbackInsight)
  const reportWithGpsQuality = gpsQuality ? { ...report, gpsQuality } : report
  const source = aiResult.success ? ('ai' as const) : ('fallback' as const)

  logger.info('ai_insight_created', {
    run_id: report.runId,
    effort: report.effort,
    safety_flags: report.safetyFlags?.length ?? 0,
    latency_ms: Date.now() - requestStartedAt,
    source,
  })

  return NextResponse.json({ report: reportWithGpsQuality, source })
}

export const POST = withApiSecurity(handler)
