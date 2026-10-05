'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { db, type Run, type Workout } from '@/lib/db'
import { dbUtils } from '@/lib/dbUtils'
import { ENABLE_AUTO_PAUSE, ENABLE_PACE_CHART } from '@/lib/featureFlags'
import type { LatLng } from '@/lib/mapConfig'
import {
  calculateSegmentPaces,
  downsamplePaceData,
  smoothPaceData,
  type GPSPoint as PaceGPSPoint,
} from '@/lib/pace-calculations'
import { parseGpsPath } from '@/lib/routeUtils'
import { AdvancedDetails } from './run-report/AdvancedDetails'
import { BiomechanicsCard, type Biomechanics, type RunningDynamicsData } from './run-report/BiomechanicsCard'
import { CoachScoreRing, type CoachScore } from './run-report/CoachScoreRing'
import { CoreSummaryCard } from './run-report/CoreSummaryCard'
import { DarkPaceChart } from './run-report/DarkPaceChart'
import { DarkRouteMap } from './run-report/DarkRouteMap'
import { EffortAnalysis } from './run-report/EffortAnalysis'
import { KeyInsights, type Insight } from './run-report/KeyInsights'
import { NextStepCard } from './run-report/NextStepCard'
import { PaceHRDualChart } from './run-report/PaceHRDualChart'
import { RecoveryTimeline, type DetailedRecovery } from './run-report/RecoveryTimeline'
import { RouteTimeline } from './run-report/RouteTimeline'
import { RunReportHeader } from './run-report/RunReportHeader'
import { ShareRunCTA } from './run-report/ShareRunCTA'
import { SplitsTable } from './run-report/SplitsTable'
import { StructuredWorkoutCard, type StructuredWorkout } from './run-report/StructuredWorkoutCard'

type GPSQuality = {
  score: number
  level: 'Excellent' | 'Good' | 'Fair' | 'Poor'
  averageAccuracy: number
}

type CoachNotes = {
  shortSummary: string
  positives: string[]
  flags: string[]
  recoveryNext24h: string
  suggestedNextWorkout: string
}

type SafetyFlag = {
  code: string
  severity: string
  message: string
}

type RunInsight = {
  runId: number
  summary: string[]
  effort: 'easy' | 'moderate' | 'hard'
  gpsQuality?: GPSQuality
  metrics?: {
    paceStability: string
    cadenceNote?: string
    hrNote?: string
  }
  pacingAnalysis?: string
  paceConsistency?: 'consistent' | 'fading' | 'negative-split' | 'erratic'
  paceVariability?: number
  recovery?: {
    priority: string[]
    optional?: string[]
  }
  nextSessionNudge?: string
  safetyFlags?: SafetyFlag[]
}

type RunReportPayload = {
  report: CoachNotes | RunInsight
  source: 'ai' | 'fallback'
}

type GarminInsightResponse = {
  insight_markdown: string | null
  confidence?: number | null
}

type GarminTelemetryLap = {
  index: number
  distanceKm: number | null
  durationSec: number | null
  paceSecPerKm: number | null
  avgHr: number | null
  avgCadence: number | null
  elevationGainM: number | null
}

type GarminTelemetry = {
  activityId?: string | null
  startTime?: string | null
  sport?: string | null
  distanceKm?: number | null
  durationSec?: number | null
  avgPaceSecPerKm?: number | null
  avgCadenceSpm?: number | null
  maxCadenceSpm?: number | null
  maxHr?: number | null
  avgHr?: number | null
  elevationGainM?: number | null
  elevationLossM?: number | null
  maxSpeedMps?: number | null
  calories?: number | null
  laps?: GarminTelemetryLap[]
  splits?: GarminTelemetryLap[]
  intervals?: GarminTelemetryLap[]
  analytics?: {
    pacing?: {
      count?: number | null
      variabilitySecPerKm?: number | null
      firstHalfPaceSecPerKm?: number | null
      secondHalfPaceSecPerKm?: number | null
      splitDeltaSecPerKm?: number | null
    }
    cadence?: {
      avgSpm?: number | null
      maxSpm?: number | null
      driftPct?: number | null
    }
    intervals?: {
      count?: number | null
      fastestPaceSecPerKm?: number | null
      slowestPaceSecPerKm?: number | null
      consistencyPct?: number | null
    }
  }
}

type GarminTelemetryResponse = {
  telemetry: GarminTelemetry | null
}

const MIN_DISTANCE_FOR_PACE_KM = 0.05




function isCoachNotes(value: unknown): value is CoachNotes {
  if (!value || typeof value !== 'object') return false
  const parsed = value as CoachNotes
  return (
    typeof parsed.shortSummary === 'string' &&
    Array.isArray(parsed.positives) &&
    Array.isArray(parsed.flags) &&
    typeof parsed.recoveryNext24h === 'string' &&
    typeof parsed.suggestedNextWorkout === 'string'
  )
}

function isRunInsight(value: unknown): value is RunInsight {
  if (!value || typeof value !== 'object') return false
  const parsed = value as RunInsight
  return (
    Array.isArray(parsed.summary) &&
    typeof parsed.effort === 'string' &&
    typeof parsed.runId === 'number'
  )
}

function formatRecoveryText(recovery: RunInsight['recovery'] | undefined): string | null {
  if (!recovery) return null
  const priority = Array.isArray(recovery.priority) ? recovery.priority.filter(Boolean) : []
  const optional = Array.isArray(recovery.optional) ? recovery.optional.filter(Boolean) : []
  if (priority.length === 0 && optional.length === 0) return null
  const parts: string[] = []
  if (priority.length) parts.push(priority.join(' '))
  if (optional.length) parts.push(`Optional: ${optional.join(' ')}`)
  return parts.join(' ')
}

function runInsightToCoachNotes(insight: RunInsight): CoachNotes {
  const summary = Array.isArray(insight.summary) ? insight.summary.filter(Boolean) : []
  const shortSummary = summary[0] || 'Run logged.'
  const positives = summary.length > 1 ? summary.slice(1) : []
  const flags = Array.isArray(insight.safetyFlags)
    ? insight.safetyFlags.map((flag) => flag.message).filter(Boolean)
    : []
  const recoveryNext24h =
    formatRecoveryText(insight.recovery) ||
    'Hydrate, eat a normal meal, and prioritize sleep.'
  const suggestedNextWorkout =
    insight.nextSessionNudge || 'Easy 20-40 min or rest, depending on how you feel.'

  return {
    shortSummary,
    positives,
    flags,
    recoveryNext24h,
    suggestedNextWorkout,
  }
}

function safeParseCoachNotes(raw: string | undefined): CoachNotes | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (isCoachNotes(parsed)) return parsed
    if (isRunInsight(parsed)) return runInsightToCoachNotes(parsed)
    return null
  } catch {
    return null
  }
}

function extractEffort(raw: string | undefined): RunInsight['effort'] | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    if (isRunInsight(parsed) && parsed.effort) return parsed.effort
    return undefined
  } catch {
    return undefined
  }
}

function extractGpsQuality(raw: string | undefined): GPSQuality | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { gpsQuality?: GPSQuality }
    if (!parsed?.gpsQuality || typeof parsed.gpsQuality !== 'object') return null
    const { score, level, averageAccuracy } = parsed.gpsQuality
    if (!Number.isFinite(score) || !Number.isFinite(averageAccuracy) || typeof level !== 'string') {
      return null
    }
    if (!['Excellent', 'Good', 'Fair', 'Poor'].includes(level)) return null
    return { score, level: level as GPSQuality['level'], averageAccuracy }
  } catch {
    return null
  }
}

function extractPacingInsight(raw: string | undefined) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!isRunInsight(parsed)) return null
    return {
      pacingAnalysis:
        typeof parsed.pacingAnalysis === 'string' ? parsed.pacingAnalysis : undefined,
      paceConsistency: parsed.paceConsistency as RunInsight['paceConsistency'] | undefined,
      paceVariability:
        typeof parsed.paceVariability === 'number' ? parsed.paceVariability : undefined,
    }
  } catch {
    return null
  }
}

function extractCoachScore(raw: string | undefined): CoachScore | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed?.coachScore || typeof parsed.coachScore.overall !== 'number') return null
    return parsed.coachScore as CoachScore
  } catch {
    return null
  }
}

function extractDetailedRecovery(raw: string | undefined): DetailedRecovery | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed?.detailedRecovery || typeof parsed.detailedRecovery.immediate !== 'string') return null
    return parsed.detailedRecovery as DetailedRecovery
  } catch {
    return null
  }
}

function extractStructuredWorkout(raw: string | undefined): StructuredWorkout | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed?.structuredNextWorkout || typeof parsed.structuredNextWorkout.sessionType !== 'string') return null
    return parsed.structuredNextWorkout as StructuredWorkout
  } catch {
    return null
  }
}

function extractBiomechanics(raw: string | undefined): Biomechanics | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed?.biomechanics) return null
    return parsed.biomechanics as Biomechanics
  } catch {
    return null
  }
}

function extractRunningDynamics(raw: string | undefined): RunningDynamicsData | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    // Check for dynamics data in historicalContext or direct field
    const dynamics = parsed?.historicalContext?.runningDynamics
    if (!dynamics) return null
    return dynamics as RunningDynamicsData
  } catch {
    return null
  }
}

function parsePaceGpsPath(gpsPath: string | undefined): PaceGPSPoint[] {
  if (!gpsPath) return []
  try {
    const parsed = JSON.parse(gpsPath)
    if (!Array.isArray(parsed)) return []

    const normalized: PaceGPSPoint[] = []

    for (const point of parsed) {
      if (!point || typeof point !== 'object') continue
      const record = point as Record<string, unknown>
      const lat =
        typeof record.lat === 'number'
          ? record.lat
          : typeof record.latitude === 'number'
            ? record.latitude
            : null
      const lng =
        typeof record.lng === 'number'
          ? record.lng
          : typeof record.longitude === 'number'
            ? record.longitude
            : null
      const timestamp =
        typeof record.timestamp === 'number' && Number.isFinite(record.timestamp)
          ? record.timestamp
          : null

      if (lat === null || lng === null || timestamp === null) continue

      normalized.push({
        lat,
        lng,
        timestamp,
        ...(typeof record.accuracy === 'number' ? { accuracy: record.accuracy } : {}),
      })
    }

    return normalized
  } catch {
    return []
  }
}

export function RunReportScreen({ runId, onBack }: { runId: number | null; onBack: () => void }) {
  const { toast } = useToast()

  const [run, setRun] = useState<Run | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [garminInsight, setGarminInsight] = useState<GarminInsightResponse | null>(null)
  const [isGarminInsightLoading, setIsGarminInsightLoading] = useState(false)
  const [garminTelemetry, setGarminTelemetry] = useState<GarminTelemetry | null>(null)
  const [garminTelemetryResolved, setGarminTelemetryResolved] = useState(false)
  const [historicalContext, setHistoricalContext] = useState<Record<string, unknown> | null>(null)
  const autoRegeneratedRunRef = useRef<number | null>(null)

  const gpsQualityEnabled = ENABLE_AUTO_PAUSE
  const paceChartEnabled = ENABLE_PACE_CHART
  const path: LatLng[] = useMemo(() => parseGpsPath(run?.gpsPath), [run?.gpsPath])
  const pacePath = useMemo(() => parsePaceGpsPath(run?.gpsPath), [run?.gpsPath])
  const paceData = useMemo(() => {
    if (!paceChartEnabled || pacePath.length < 2) return []
    const raw = calculateSegmentPaces(pacePath)
    if (raw.length === 0) return []
    const smoothed = smoothPaceData(raw, 3)
    return downsamplePaceData(smoothed, 200)
  }, [paceChartEnabled, pacePath])
  const paceDataPayload = useMemo(
    () =>
      paceData.map((entry) => ({
        distanceKm: entry.distanceKm,
        paceMinPerKm: entry.paceMinPerKm,
        timestamp: entry.timestamp.getTime(),
      })),
    [paceData]
  )

  const coachNotes = useMemo(() => safeParseCoachNotes(run?.runReport), [run?.runReport])
  const runEffort = useMemo(() => extractEffort(run?.runReport), [run?.runReport])
  const gpsQuality = useMemo(
    () => (gpsQualityEnabled ? extractGpsQuality(run?.runReport) : null),
    [gpsQualityEnabled, run?.runReport]
  )
  const pacingInsight = useMemo(
    () => (paceChartEnabled ? extractPacingInsight(run?.runReport) : null),
    [paceChartEnabled, run?.runReport]
  )
  const coachScore = useMemo(() => extractCoachScore(run?.runReport), [run?.runReport])
  const detailedRecovery = useMemo(() => extractDetailedRecovery(run?.runReport), [run?.runReport])
  const structuredWorkout = useMemo(() => extractStructuredWorkout(run?.runReport), [run?.runReport])
  const biomechanicsData = useMemo(() => extractBiomechanics(run?.runReport), [run?.runReport])
  const runningDynamics = useMemo<RunningDynamicsData | null>(() => {
    // Prefer dynamics from historical context (gathered from Dexie)
    const ctxDyn = historicalContext?.runningDynamics as RunningDynamicsData | undefined
    if (ctxDyn?.avgCadence) return ctxDyn
    // Fallback: try extracting from stored run report
    return extractRunningDynamics(run?.runReport)
  }, [historicalContext, run?.runReport])
  const telemetrySplits = useMemo(
    () => (Array.isArray(garminTelemetry?.splits) ? garminTelemetry.splits.slice(0, 8) : []),
    [garminTelemetry?.splits]
  )
  const telemetryIntervals = useMemo(
    () => (Array.isArray(garminTelemetry?.intervals) ? garminTelemetry.intervals.slice(0, 8) : []),
    [garminTelemetry?.intervals]
  )
  const telemetryLaps = useMemo(
    () => (Array.isArray(garminTelemetry?.laps) ? garminTelemetry.laps.slice(0, 8) : []),
    [garminTelemetry?.laps]
  )

  const avgPace = useMemo(() => {
    if (!run) return 0
    return run.distance >= MIN_DISTANCE_FOR_PACE_KM ? run.duration / run.distance : 0
  }, [run])
  const isGarminCandidateRun = useMemo(
    () => Boolean(run && (run.importSource === 'garmin' || run.importRequestId)),
    [run]
  )
  const hasGarminData = useMemo(
    () => isGarminCandidateRun || Boolean(garminTelemetry),
    [garminTelemetry, isGarminCandidateRun]
  )

  // Full dark Garmin report: any Garmin-imported run once telemetry fetch has resolved
  const isGarminFullReport = useMemo(
    () => isGarminCandidateRun && garminTelemetryResolved,
    [isGarminCandidateRun, garminTelemetryResolved]
  )

  const loadRun = useCallback(async () => {
    if (!runId) {
      setRun(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const stored = await dbUtils.getRunById(runId)
      setRun(stored)
    } finally {
      setIsLoading(false)
    }
  }, [runId])

  const generateNotes = useCallback(async () => {
    if (!runId || !run) return

    setIsGenerating(true)
    try {
      void trackAnalyticsEvent('ai_skill_invoked', {
        skill_name: 'run-insights-recovery',
        run_id: runId,
      })

      const avgPaceSecondsPerKm =
        run.distance >= MIN_DISTANCE_FOR_PACE_KM ? run.duration / run.distance : undefined

      const response = await fetch('/api/run-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run: {
            id: runId,
            type: run.type,
            distanceKm: run.distance,
            durationSeconds: run.duration,
            avgPaceSecondsPerKm,
            completedAt: run.completedAt,
            notes: run.notes,
            heartRateBpm: run.heartRate,
            calories: run.calories,
            gpsAccuracyData: run.gpsAccuracyData,
          },
          gps: {
            points: path.length,
            startAccuracy: run.startAccuracy,
            endAccuracy: run.endAccuracy,
            averageAccuracy: run.averageAccuracy,
          },
          ...(paceChartEnabled && paceDataPayload.length ? { paceData: paceDataPayload } : {}),
          ...(garminTelemetry ? { garminTelemetry } : {}),
          ...(historicalContext ? { historicalContext } : {}),
        }),
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(text || `Request failed (${response.status})`)
      }

      const data = (await response.json()) as RunReportPayload

      await dbUtils.updateRun(runId, {
        runReport: JSON.stringify(data.report),
        runReportSource: data.source,
        runReportCreatedAt: new Date(),
      })

      if (isRunInsight(data.report)) {
        void trackAnalyticsEvent('ai_insight_created', {
          run_id: data.report.runId,
          effort: data.report.effort,
          safety_flags: data.report.safetyFlags?.length ?? 0,
          source: data.source,
        })
      }
      if (gpsQualityEnabled && isRunInsight(data.report) && data.report.gpsQuality) {
        void trackAnalyticsEvent('gps_quality_score', {
          score: data.report.gpsQuality.score,
          confidence_level: data.report.gpsQuality.level,
          run_id: data.report.runId,
        })
      }

      toast({
        title: 'Coach Notes Ready',
        description: data.source === 'ai' ? 'Generated with AI.' : 'Generated with fallback mode.',
      })

      await loadRun()
    } catch (error) {
      console.error('[run-report] Failed to generate coach notes:', error)
      toast({
        title: 'Coach Notes Error',
        description: 'Failed to generate coach notes. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }, [
    gpsQualityEnabled,
    historicalContext,
    loadRun,
    paceChartEnabled,
    paceDataPayload,
    garminTelemetry,
    path.length,
    run,
    runId,
    toast,
  ])

  useEffect(() => {
    loadRun()
  }, [loadRun])

  // Gather historical context from Dexie for richer AI analysis
  useEffect(() => {
    if (!run) {
      setHistoricalContext(null)
      return
    }

    const gatherContext = async () => {
      try {
        const userId = run.userId
        const ctx: Record<string, unknown> = {}

        // Recent runs (last 10, summarized)
        const allRuns = await dbUtils.getRunsByUser(userId)
        const sortedRuns = allRuns
          .filter(r => r.id !== run.id)
          .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
          .slice(0, 10)

        if (sortedRuns.length > 0) {
          ctx.recentRuns = sortedRuns.map(r => ({
            type: r.type,
            distanceKm: r.distance,
            paceSecPerKm: r.distance > 0 ? r.duration / r.distance : undefined,
            date: new Date(r.completedAt).toISOString().slice(0, 10),
            effort: r.rpe ? String(r.rpe) : undefined,
          }))
        }

        // Weekly volumes
        const now = Date.now()
        const runs7d = allRuns.filter(r => now - new Date(r.completedAt).getTime() < 7 * 86400000)
        const runs28d = allRuns.filter(r => now - new Date(r.completedAt).getTime() < 28 * 86400000)
        ctx.weeklyVolume7d = runs7d.reduce((sum, r) => sum + r.distance, 0)
        ctx.weeklyVolume28d = runs28d.reduce((sum, r) => sum + r.distance, 0)
        ctx.weeklyRunCount7d = runs7d.length

        // Latest recovery score
        try {
          const latestRecovery = await db.recoveryScores
            .where('userId').equals(userId)
            .toArray()
          latestRecovery.sort((a: { scoreDate?: Date; date?: Date }, b: { scoreDate?: Date; date?: Date }) =>
            new Date(b.scoreDate ?? b.date ?? 0).getTime() - new Date(a.scoreDate ?? a.date ?? 0).getTime()
          )
          const rec = latestRecovery[0]
          if (rec) {
            ctx.recoveryScore = rec.overallScore
            ctx.sleepScore = rec.sleepScore
            ctx.readinessScore = rec.readinessScore
          }
        } catch { /* table may not exist for all users */ }

        // Running dynamics for this run
        try {
          const allDynamics = await db.runningDynamicsData
            .where('userId').equals(userId)
            .reverse()
            .sortBy('timestamp')
          const dynamics = allDynamics.find((d: { runId: number }) => d.runId === run.id) ?? allDynamics[0]
          if (dynamics) {
            ctx.runningDynamics = {
              avgCadence: dynamics.averageCadence,
              avgGroundContactTime: dynamics.averageGroundContactTime,
              avgVerticalOscillation: dynamics.averageVerticalOscillation,
              avgStrideLength: dynamics.averageStrideLength,
              groundContactBalance: dynamics.groundContactBalance ? `${dynamics.groundContactBalance}%` : undefined,
              verticalRatio: dynamics.verticalRatio,
            }
          }
        } catch { /* table may not exist */ }

        // User's VDOT
        try {
          const user = await dbUtils.getUserById(userId)
          if (user?.calculatedVDOT) {
            ctx.vdot = user.calculatedVDOT
          }
        } catch { /* ignore */ }

        setHistoricalContext(ctx)
      } catch (err) {
        console.warn('[run-report] Failed to gather historical context:', err)
        setHistoricalContext(null)
      }
    }

    void gatherContext()
  }, [run])

  useEffect(() => {
    if (!run || !hasGarminData) {
      setGarminInsight(null)
      setIsGarminInsightLoading(false)
      return
    }

    const completedAt = new Date(run.completedAt)
    if (Number.isNaN(completedAt.getTime())) {
      setGarminInsight(null)
      return
    }

    const dateParam = completedAt.toISOString().slice(0, 10)
    const controller = new AbortController()

    const loadGarminInsight = async () => {
      setIsGarminInsightLoading(true)
      try {
        const response = await fetch(
          `/api/garmin/insights?userId=${encodeURIComponent(String(run.userId))}&date=${encodeURIComponent(dateParam)}&type=post_run`,
          {
            signal: controller.signal,
          }
        )

        if (!response.ok) {
          setGarminInsight(null)
          return
        }

        const data = (await response.json()) as GarminInsightResponse
        if (data.insight_markdown) {
          setGarminInsight(data)
        } else {
          setGarminInsight(null)
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') return
        console.warn('[run-report] Failed to load Garmin insight:', error)
        setGarminInsight(null)
      } finally {
        setIsGarminInsightLoading(false)
      }
    }

    void loadGarminInsight()

    return () => controller.abort()
  }, [hasGarminData, run])

  useEffect(() => {
    if (!run) {
      setGarminTelemetry(null)
      setGarminTelemetryResolved(true)
      return
    }

    const completedAt = new Date(run.completedAt)
    const dateParam = Number.isNaN(completedAt.getTime()) ? '' : completedAt.toISOString().slice(0, 10)
    const activityIdParam = typeof run.importRequestId === 'string' ? run.importRequestId.trim() : ''
    setGarminTelemetryResolved(false)
    if (!activityIdParam && !dateParam) {
      setGarminTelemetry(null)
      setGarminTelemetryResolved(true)
      return
    }

    const controller = new AbortController()

    const loadGarminTelemetry = async () => {
      try {
        const params = new URLSearchParams()
        params.set('userId', String(run.userId))
        if (activityIdParam) params.set('activityId', activityIdParam)
        else if (dateParam) params.set('date', dateParam)
        params.set('distanceKm', String(run.distance))
        params.set('durationSec', String(run.duration))
        const completedAtDate = new Date(run.completedAt)
        if (!Number.isNaN(completedAtDate.getTime())) {
          params.set('completedAt', completedAtDate.toISOString())
        }

        const response = await fetch(`/api/garmin/activity-telemetry?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          setGarminTelemetry(null)
          return
        }
        const data = (await response.json()) as GarminTelemetryResponse
        setGarminTelemetry(data.telemetry ?? null)
      } catch (error) {
        if ((error as Error).name === 'AbortError') return
        console.warn('[run-report] Failed to load Garmin telemetry:', error)
        setGarminTelemetry(null)
      } finally {
        setGarminTelemetryResolved(true)
      }
    }

    void loadGarminTelemetry()
    return () => controller.abort()
  }, [run])

  useEffect(() => {
    if (!runId || !run) return
    if (run.runReport) return
    if (isGenerating) return
    if (isGarminCandidateRun && !garminTelemetryResolved) return
    void generateNotes()
  }, [generateNotes, garminTelemetryResolved, isGarminCandidateRun, isGenerating, run, runId])

  useEffect(() => {
    if (!run?.id) return
    if (!garminTelemetryResolved || !garminTelemetry) return
    if (isGenerating) return

    const shouldRegenerate = hasGarminData && (run.runReportSource !== 'ai' || !run.runReportCreatedAt)

    if (!shouldRegenerate) return
    if (autoRegeneratedRunRef.current === run.id) return

    autoRegeneratedRunRef.current = run.id
    void generateNotes()
  }, [garminTelemetryResolved, garminTelemetry, generateNotes, hasGarminData, isGenerating, run])

  if (!runId) {
    return (
      <div className="min-h-screen bg-[oklch(var(--surface-2))] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">Run Report</h1>
          <div className="w-8" />
        </div>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-foreground/70">No run selected.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[oklch(var(--surface-2))] p-4 space-y-4">
        <Card>
          <CardContent className="p-6 flex items-center justify-center gap-2 text-sm text-foreground/70">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading run...
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-[oklch(var(--surface-2))] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">Run Report</h1>
          <div className="w-8" />
        </div>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-foreground/70">Run not found.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const source: 'garmin' | 'runsmart' | 'manual' =
    run.importSource === 'garmin' || run.importRequestId ? 'garmin'
    : run.importSource === 'manual' ? 'manual'
    : 'runsmart'

  // Build metrics object, only including keys that have defined values
  // (exactOptionalPropertyTypes requires we not assign undefined to optional props)
  const sharedMetrics: {
    paceVariabilitySecPerKm?: number
    splitDeltaSecPerKm?: number
    cadenceDriftPct?: number
    intervalConsistencyPct?: number
    maxSpeedKmph?: number
    elevationLossM?: number
  } = {}
  const _pv = (garminTelemetry?.analytics?.pacing?.variabilitySecPerKm ?? pacingInsight?.paceVariability)
  if (typeof _pv === 'number') sharedMetrics.paceVariabilitySecPerKm = _pv
  const _sd = garminTelemetry?.analytics?.pacing?.splitDeltaSecPerKm
  if (typeof _sd === 'number') sharedMetrics.splitDeltaSecPerKm = _sd
  const _cd = garminTelemetry?.analytics?.cadence?.driftPct
  if (typeof _cd === 'number') sharedMetrics.cadenceDriftPct = _cd
  const _ic = garminTelemetry?.analytics?.intervals?.consistencyPct
  if (typeof _ic === 'number') sharedMetrics.intervalConsistencyPct = _ic
  const _ms = garminTelemetry?.maxSpeedMps
  if (typeof _ms === 'number') sharedMetrics.maxSpeedKmph = _ms * 3.6
  const _el = garminTelemetry?.elevationLossM
  if (typeof _el === 'number') sharedMetrics.elevationLossM = _el

  const onShare = () => toast({ title: 'Share', description: 'Sharing functionality coming soon.' })

  const parseSuggestedWorkout = (suggestion: string): { type: Workout['type']; distance: number; notes: string } => {
    const distanceMatch = suggestion.match(/(\d+\.?\d*)\s*(km|k|miles?)/i)
    const distance = distanceMatch?.[1] ? parseFloat(distanceMatch[1]) : 5

    let type: Workout['type'] = 'easy'
    const lower = suggestion.toLowerCase()
    if (lower.includes('tempo')) type = 'tempo'
    else if (lower.includes('interval')) type = 'intervals'
    else if (lower.includes('long')) type = 'long'
    else if (lower.includes('hill')) type = 'hill'
    else if (lower.includes('race')) type = 'time-trial'
    else if (lower.includes('fartlek')) type = 'fartlek'
    else if (lower.includes('recovery')) type = 'recovery'

    return { type, distance, notes: suggestion }
  }

  const onSaveToPlan = async () => {
    if (!coachNotes?.suggestedNextWorkout) return
    try {
      const user = await dbUtils.getCurrentUser()
      if (!user?.id) {
        toast({ title: 'Not signed in', description: 'Please sign in to save workouts.', variant: 'destructive' })
        return
      }
      const plan = await dbUtils.getActivePlan(user.id)
      if (!plan?.id) {
        toast({ title: 'No active plan', description: 'Create a training plan first.', variant: 'destructive' })
        return
      }
      const { type, distance, notes } = parseSuggestedWorkout(coachNotes.suggestedNextWorkout)

      // Find the next open day (tomorrow first, then up to 7 days)
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const startOfWeek = new Date(startOfDay)
      startOfWeek.setDate(startOfDay.getDate() + 1)
      const endOfSearch = new Date(startOfDay)
      endOfSearch.setDate(startOfDay.getDate() + 7)
      endOfSearch.setHours(23, 59, 59, 999)

      const existingWorkouts = await dbUtils.getWorkoutsForDateRange(user.id, startOfWeek, endOfSearch, { planScope: 'active' })
      const occupiedKeys = new Set(existingWorkouts.map(w => {
        const d = w.scheduledDate
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }))

      let scheduledDate: Date | null = null
      for (let i = 1; i <= 7; i++) {
        const candidate = new Date(startOfDay)
        candidate.setDate(startOfDay.getDate() + i)
        const key = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}-${String(candidate.getDate()).padStart(2, '0')}`
        if (!occupiedKeys.has(key)) {
          scheduledDate = candidate
          break
        }
      }

      if (!scheduledDate) {
        toast({ title: 'No open slot', description: 'All days this week are occupied.', variant: 'destructive' })
        return
      }

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
      const day = dayNames[scheduledDate.getDay()] ?? 'Mon'

      await dbUtils.createWorkout({
        planId: plan.id,
        week: 1,
        day,
        type,
        distance,
        notes,
        completed: false,
        scheduledDate,
      })

      window.dispatchEvent(new CustomEvent('plan-updated'))
      toast({
        title: 'Saved to plan',
        description: `${type} run (${distance}km) added on ${scheduledDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}.`,
      })
    } catch (error) {
      console.error('[run-report] Failed to save to plan:', error)
      toast({ title: 'Error', description: 'Failed to save workout. Please try again.', variant: 'destructive' })
    }
  }

  // ─── FULL GARMIN DARK REPORT ────────────────────────────────────────────
  if (isGarminFullReport) {
    const sections = [
      <RunReportHeader
        key="header"
        runType={run.type}
        completedAt={run.completedAt}
        source={source}
        isGarminImport={isGarminCandidateRun}
        gpsQualityLevel={gpsQuality?.level as any}
        variant="garmin"
      />,
      <CoreSummaryCard
        key="core"
        distanceKm={run.distance}
        durationSec={run.duration}
        avgPaceSecPerKm={avgPace}
        elevationGainM={(garminTelemetry?.elevationGainM ?? run.elevationGain) as any}
        avgHr={(garminTelemetry?.avgHr ?? run.heartRate) as any}
        calories={(garminTelemetry?.calories ?? run.calories) as any}
        cadence={garminTelemetry?.avgCadenceSpm as any}
        relativeEffort={runEffort}
        paceConsistency={pacingInsight?.paceConsistency as any}
        variant="garmin"
      />,
      coachScore && (
        <CoachScoreRing key="coach-score" score={coachScore} variant="garmin" />
      ),
      <EffortAnalysis
        key="effort"
        avgHr={(garminTelemetry?.avgHr ?? run.heartRate) as any}
        maxHr={(garminTelemetry?.maxHr ?? run.maxHR) as any}
        {...(runEffort !== undefined ? { effortScore: runEffort } : {})}
        {...(pacingInsight?.paceConsistency ? { paceConsistency: pacingInsight.paceConsistency } : {})}
        variant="garmin"
      />,
      path.length > 0 && <DarkRouteMap key="route-map" path={path} />,
      paceChartEnabled && pacePath.length >= 10 && (
        <DarkPaceChart key="pace-chart" gpsPath={pacePath} />
      ),
      telemetrySplits.length >= 3 && (
        <PaceHRDualChart key="pace-hr-chart" splits={telemetrySplits} />
      ),
      telemetrySplits.length > 0 && (
        <SplitsTable key="splits-km" splits={telemetrySplits} type="km" variant="garmin" />
      ),
      telemetryIntervals.length > 0 && (
        <SplitsTable key="splits-interval" splits={telemetryIntervals} type="interval" variant="garmin" />
      ),
      telemetryLaps.length > 0 && (
        <SplitsTable key="splits-lap" splits={telemetryLaps} type="lap" variant="garmin" />
      ),
      biomechanicsData && runningDynamics && (
        <BiomechanicsCard
          key="biomechanics"
          biomechanics={biomechanicsData}
          dynamics={runningDynamics}
          variant="garmin"
        />
      ),
      <KeyInsights
        key="insights"
        insights={createInsightArray(coachNotes, pacingInsight, garminInsight, {
          avgPaceSecPerKm: avgPace,
          avgHr: (garminTelemetry?.avgHr ?? run.heartRate) as number | null,
          distanceKm: run.distance,
          effortScore: runEffort,
        })}
        isGenerating={isGenerating || isGarminInsightLoading}
        onRegenerate={() => void generateNotes()}
        variant="garmin"
      />,
      <AdvancedDetails
        key="advanced"
        runId={run.id!}
        hasGarminData={hasGarminData}
        gpsQualityScore={gpsQuality?.score as any}
        metrics={sharedMetrics}
        variant="garmin"
      />,
      detailedRecovery && (
        <RecoveryTimeline key="recovery" recovery={detailedRecovery} variant="garmin" />
      ),
      structuredWorkout ? (
        <StructuredWorkoutCard
          key="next-workout"
          workout={structuredWorkout}
          variant="garmin"
          onSaveToPlan={onSaveToPlan}
        />
      ) : coachNotes?.suggestedNextWorkout ? (
        <div key="next" className="mx-4">
          <NextStepCard
            suggestedRun={coachNotes.suggestedNextWorkout}
            rationale={coachNotes.recoveryNext24h || "Based on today's effort."}
            onSaveToPlan={onSaveToPlan}
          />
        </div>
      ) : null,
      <div key="share" className="mx-4">
        <ShareRunCTA onShare={onShare} />
      </div>,
    ].filter(Boolean)

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-950 relative">
        {/* Sticky dark nav */}
        <div className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Back"
            className="h-9 w-9 text-white/60 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-white/50 capitalize">{run.type} Run</span>
        </div>

        {/* Sections with stagger animation */}
        <div className="max-w-md mx-auto pb-24 space-y-4">
          {sections.map((section, i) => (
            <div
              key={i}
              className="animate-in fade-in-0 slide-in-from-bottom-4"
              style={{ animationDelay: `${i * 55}ms`, animationFillMode: 'backwards' }}
            >
              {section}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── LIGHT REPORT ───────────────────────────────────────────────────────
  const lightSections = [
    <RunReportHeader
      key="header"
      runType={run.type}
      completedAt={run.completedAt}
      source={source}
      isGarminImport={isGarminCandidateRun}
      gpsQualityLevel={gpsQuality?.level as any}
      variant="light"
    />,
    <CoreSummaryCard
      key="core"
      distanceKm={run.distance}
      durationSec={run.duration}
      avgPaceSecPerKm={avgPace}
      elevationGainM={(garminTelemetry?.elevationGainM ?? run.elevationGain) as any}
      avgHr={(garminTelemetry?.avgHr ?? run.heartRate) as any}
      calories={(garminTelemetry?.calories ?? run.calories) as any}
      cadence={garminTelemetry?.avgCadenceSpm as any}
      relativeEffort={runEffort}
      paceConsistency={pacingInsight?.paceConsistency as any}
      variant="light"
    />,
    coachScore && (
      <CoachScoreRing key="coach-score" score={coachScore} variant="light" />
    ),
    (runEffort || pacingInsight?.paceConsistency || (garminTelemetry?.avgHr ?? run.heartRate)) && (
      <EffortAnalysis
        key="effort"
        avgHr={(garminTelemetry?.avgHr ?? run.heartRate) as any}
        maxHr={(garminTelemetry?.maxHr ?? run.maxHR) as any}
        {...(runEffort !== undefined ? { effortScore: runEffort } : {})}
        {...(pacingInsight?.paceConsistency ? { paceConsistency: pacingInsight.paceConsistency } : {})}
        variant="light"
      />
    ),
    <KeyInsights
      key="insights"
      insights={createInsightArray(coachNotes, pacingInsight, garminInsight)}
      isGenerating={isGenerating || isGarminInsightLoading}
      onRegenerate={() => void generateNotes()}
      variant="light"
    />,
    (path.length > 0 || paceChartEnabled) && (
      <RouteTimeline
        key="route"
        gpsPath={path}
        pacePath={pacePath}
        hasPaceChart={paceChartEnabled}
      />
    ),
    telemetrySplits.length > 0 && (
      <SplitsTable key="splits" splits={telemetrySplits} type="km" variant="light" />
    ),
    detailedRecovery && (
      <RecoveryTimeline key="recovery" recovery={detailedRecovery} variant="light" />
    ),
    structuredWorkout ? (
      <StructuredWorkoutCard
        key="next-workout"
        workout={structuredWorkout}
        variant="light"
        onSaveToPlan={onSaveToPlan}
      />
    ) : coachNotes?.suggestedNextWorkout ? (
      <NextStepCard
        key="next"
        suggestedRun={coachNotes.suggestedNextWorkout}
        rationale={coachNotes.recoveryNext24h || "Based on today's effort."}
        onSaveToPlan={onSaveToPlan}
      />
    ) : null,
    <ShareRunCTA key="share" onShare={onShare} />,
  ].filter(Boolean)

  return (
    <div className="min-h-screen bg-[oklch(var(--surface-2))] relative">
      {/* Sticky light nav */}
      <div className="sticky top-0 z-10 bg-[oklch(var(--surface-2))]/90 backdrop-blur-md border-b border-border/40 px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Back"
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold text-foreground/70 capitalize">{run.type} Run</span>
      </div>

      <div className="max-w-md mx-auto px-4 pt-5 pb-20 space-y-5">
        {lightSections.map((section, i) => (
          <div
            key={i}
            className="animate-in fade-in-0 slide-in-from-bottom-4"
            style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}
          >
            {section}
          </div>
        ))}
      </div>
    </div>
  )
}

// Helper to assemble insights for the KeyInsights component
function createInsightArray(
  notes: CoachNotes | null,
  pacing: any,
  garmin: GarminInsightResponse | null,
  extra?: {
    avgPaceSecPerKm?: number | null
    avgHr?: number | null
    distanceKm?: number | null
    effortScore?: string | null
  }
): Insight[] {
  const insights: Insight[] = []

  // Format avg pace as mm:ss min/km
  const fmtPace = (secPerKm: number) => {
    const mins = Math.floor(secPerKm / 60)
    const secs = Math.round(secPerKm % 60)
    return `${mins}:${secs.toString().padStart(2, '0')} min/km`
  }

  if (notes) {
    const insightTitles = ['What went well', 'Training benefit', 'Plan fit']
    if (notes.positives && notes.positives.length > 0) {
      notes.positives.slice(0, 3).forEach((positive, idx) => {
        if (positive) {
          insights.push({
            type: 'general',
            title: insightTitles[idx] ?? 'Coach note',
            message: positive,
            confidence: 'High',
            isPositive: true,
            ...(idx === 0 && extra?.distanceKm ? { metric: `${extra.distanceKm.toFixed(2)} km` } : {}),
          })
        }
      })
    }

    if (notes.flags && notes.flags.length > 0) {
      insights.push({
        type: 'effort',
        title: 'Area for improvement',
        message: notes.flags[0] ?? '',
        confidence: 'Med',
        isPositive: false,
        actionItem: 'Focus on this in your next session',
      })
    }

    // Recovery insight from recoveryNext24h
    if (notes.recoveryNext24h) {
      insights.push({
        type: 'recovery',
        title: 'Recovery',
        message: notes.recoveryNext24h,
        confidence: 'High',
        isPositive: true,
        actionItem: 'Plan your next 24h accordingly',
      })
    }
  }

  if (pacing?.pacingAnalysis) {
    const isConsistent = pacing.paceConsistency === 'consistent' || pacing.paceConsistency === 'negative-split'
    insights.push({
      type: 'pacing',
      title: 'Pacing Strategy',
      message: pacing.pacingAnalysis,
      confidence: 'High',
      isPositive: isConsistent,
      ...(extra?.avgPaceSecPerKm ? { metric: fmtPace(extra.avgPaceSecPerKm) } : {}),
    })
  } else if (garmin?.insight_markdown) {
    insights.push({
      type: 'general',
      title: 'Garmin Coach Analysis',
      message: garmin.insight_markdown.substring(0, 150) + (garmin.insight_markdown.length > 150 ? '...' : ''),
      confidence: (garmin.confidence ?? 0) > 0.8 ? 'High' : 'Med',
    })
  }

  // Training-load insight from effort + distance
  if (extra?.effortScore && extra.distanceKm) {
    const effortLabel = extra.effortScore === 'hard' ? 'high' : extra.effortScore === 'moderate' ? 'moderate' : 'low'
    const isHardLong = extra.effortScore === 'hard' && extra.distanceKm >= 10
    insights.push({
      type: 'effort',
      title: 'Training Load',
      message: isHardLong
        ? `Long run at ${effortLabel} effort — significant training stimulus. Allow 48h before your next hard session.`
        : `${extra.distanceKm.toFixed(1)} km at ${effortLabel} effort contributes to your weekly load.`,
      confidence: 'Med',
      isPositive: !isHardLong,
      ...(extra.avgHr ? { metric: `avg ${extra.avgHr} bpm` } : {}),
      actionItem: isHardLong ? 'Schedule an easy day tomorrow' : undefined,
    })
  }

  return insights
}

export default RunReportScreen


