'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { trackAnalyticsEvent } from '@/lib/analytics'
import type { Run } from '@/lib/db'
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
import { CoreSummaryCard } from './run-report/CoreSummaryCard'
import { EffortAnalysis } from './run-report/EffortAnalysis'
import { HRZoneWheel } from './run-report/HRZoneWheel'
import { KeyInsights, type Insight } from './run-report/KeyInsights'
import { NextStepCard } from './run-report/NextStepCard'
import { PaceHRDualChart } from './run-report/PaceHRDualChart'
import { RouteTimeline } from './run-report/RouteTimeline'
import { RunReportHeader } from './run-report/RunReportHeader'
import { ShareRunCTA } from './run-report/ShareRunCTA'
import { SplitsTable } from './run-report/SplitsTable'

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

  // Full dark Garmin report: only when we have actual telemetry splits to show
  const isGarminFullReport = useMemo(
    () => hasGarminData && telemetrySplits.length > 0,
    [hasGarminData, telemetrySplits.length]
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
  const onSaveToPlan = () => toast({ title: 'Saved to plan', description: 'Workout added to your schedule.' })

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
      <EffortAnalysis
        key="effort"
        avgHr={(garminTelemetry?.avgHr ?? run.heartRate) as any}
        maxHr={(garminTelemetry?.maxHr ?? run.maxHR) as any}
        {...(runEffort !== undefined ? { effortScore: runEffort } : {})}
        {...(pacingInsight?.paceConsistency ? { paceConsistency: pacingInsight.paceConsistency } : {})}
        variant="garmin"
      />,
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
      (garminTelemetry?.avgHr ?? run.heartRate) != null && (
        <HRZoneWheel
          key="hr-wheel"
          avgHr={(garminTelemetry?.avgHr ?? run.heartRate) as number}
          maxHr={(garminTelemetry?.maxHr ?? run.maxHR) as any}
        />
      ),
      <AdvancedDetails
        key="advanced"
        runId={run.id!}
        hasGarminData={hasGarminData}
        gpsQualityScore={gpsQuality?.score as any}
        metrics={sharedMetrics}
        variant="garmin"
      />,
      <KeyInsights
        key="insights"
        insights={createInsightArray(coachNotes, pacingInsight, garminInsight)}
        isGenerating={isGenerating || isGarminInsightLoading}
        onRegenerate={() => void generateNotes()}
        variant="garmin"
      />,
      coachNotes?.suggestedNextWorkout && (
        <div key="next" className="mx-4">
          <NextStepCard
            suggestedRun={coachNotes.suggestedNextWorkout}
            rationale={coachNotes.recoveryNext24h || "Based on today's effort."}
            onSaveToPlan={onSaveToPlan}
          />
        </div>
      ),
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
    coachNotes?.suggestedNextWorkout && (
      <NextStepCard
        key="next"
        suggestedRun={coachNotes.suggestedNextWorkout}
        rationale={coachNotes.recoveryNext24h || "Based on today's effort."}
        onSaveToPlan={onSaveToPlan}
      />
    ),
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
  garmin: GarminInsightResponse | null
): Insight[] {
  const insights: Insight[] = []

  if (notes) {
    if (notes.positives && notes.positives.length > 0) {
      insights.push({
        type: 'general',
        title: 'What went well',
        message: notes.positives[0] ?? '',
        confidence: 'High',
        isPositive: true
      })
    }

    if (notes.flags && notes.flags.length > 0) {
      insights.push({
        type: 'effort',
        title: 'Area for improvement',
        message: notes.flags[0] ?? '',
        confidence: 'Med',
        isPositive: false
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
      isPositive: isConsistent
    })
  } else if (garmin?.insight_markdown) {
    // Fallback to unstructured Garmin insight if no structured pacing insight
    insights.push({
      type: 'general',
      title: 'Garmin Coach Analysis',
      message: garmin.insight_markdown.substring(0, 150) + (garmin.insight_markdown.length > 150 ? '...' : ''),
      confidence: (garmin.confidence ?? 0) > 0.8 ? 'High' : 'Med'
    })
  }

  return insights
}

export default RunReportScreen


