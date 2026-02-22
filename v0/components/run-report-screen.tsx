'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Gauge, Heart, Loader2, Mountain, Sparkles, Timer, Watch } from 'lucide-react'
import { MapErrorBoundary } from '@/components/maps/MapErrorBoundary'
import { RunMap } from '@/components/maps/RunMap'
import { PaceChart } from '@/components/pace-chart'
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

function formatVariance(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--'
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDistance(distanceKm: number | null | undefined): string {
  return typeof distanceKm === 'number' && Number.isFinite(distanceKm) && distanceKm > 0
    ? `${distanceKm.toFixed(2)} km`
    : '--'
}

function formatDuration(seconds: number | null | undefined): string {
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? formatTime(seconds) : '--:--'
}

function formatPaceFromTelemetry(secondsPerKm: number | null | undefined): string {
  return typeof secondsPerKm === 'number' && Number.isFinite(secondsPerKm) && secondsPerKm > 0
    ? `${formatPace(secondsPerKm)}/km`
    : '--:--'
}

function formatOptionalNumber(
  value: number | null | undefined,
  options?: { digits?: number; suffix?: string }
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  const digits = options?.digits ?? 0
  const suffix = options?.suffix ?? ''
  return `${value.toFixed(digits)}${suffix}`
}

function getGpsQualityStyles(level: GPSQuality['level']) {
  switch (level) {
    case 'Excellent':
      return { bar: 'bg-primary', badge: 'bg-primary/10 text-primary' }
    case 'Good':
      return { bar: 'bg-primary/80', badge: 'bg-primary/10 text-primary/80' }
    case 'Fair':
      return { bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700' }
    default:
      return { bar: 'bg-rose-500', badge: 'bg-rose-100 text-rose-700' }
  }
}

function getPaceConsistencyStyles(
  consistency: RunInsight['paceConsistency']
): { badge: string; label: string } | null {
  switch (consistency) {
    case 'consistent':
      return { badge: 'bg-primary/10 text-primary', label: 'Consistent' }
    case 'negative-split':
      return { badge: 'bg-sky-100 text-sky-700', label: 'Negative split' }
    case 'fading':
      return { badge: 'bg-amber-100 text-amber-700', label: 'Fading' }
    case 'erratic':
      return { badge: 'bg-rose-100 text-rose-700', label: 'Erratic' }
    default:
      return null
  }
}

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
  const [isGarminTelemetryLoading, setIsGarminTelemetryLoading] = useState(false)
  const [garminTelemetryResolved, setGarminTelemetryResolved] = useState(false)

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
  const gpsQuality = useMemo(
    () => (gpsQualityEnabled ? extractGpsQuality(run?.runReport) : null),
    [gpsQualityEnabled, run?.runReport]
  )
  const pacingInsight = useMemo(
    () => (paceChartEnabled ? extractPacingInsight(run?.runReport) : null),
    [paceChartEnabled, run?.runReport]
  )
  const paceConsistencyBadge = useMemo(
    () => getPaceConsistencyStyles(pacingInsight?.paceConsistency),
    [pacingInsight?.paceConsistency]
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
  const gpsQualityStyles = gpsQuality ? getGpsQualityStyles(gpsQuality.level) : null

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
    if (!run || run.importSource !== 'garmin') {
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
  }, [run])

  useEffect(() => {
    if (!run || run.importSource !== 'garmin') {
      setGarminTelemetry(null)
      setIsGarminTelemetryLoading(false)
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
      setIsGarminTelemetryLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('userId', String(run.userId))
        if (activityIdParam) params.set('activityId', activityIdParam)
        else if (dateParam) params.set('date', dateParam)

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
        setIsGarminTelemetryLoading(false)
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
    if (run.importSource === 'garmin' && !garminTelemetryResolved) return
    void generateNotes()
  }, [generateNotes, garminTelemetryResolved, isGenerating, run, runId])

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

  return (
    <div className="min-h-screen bg-[oklch(var(--surface-2))] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back to Today Screen">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">Run Report</h1>
        <div className="w-8" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xl font-bold text-primary">{run.distance.toFixed(2)}</div>
              <div className="text-xs text-foreground/60">km</div>
            </div>
            <div>
              <div className="text-xl font-bold text-primary">{formatTime(run.duration)}</div>
              <div className="text-xs text-foreground/60">time</div>
            </div>
            <div>
              <div className="text-xl font-bold text-primary">{formatPace(avgPace)}</div>
              <div className="text-xs text-foreground/60">pace</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {run.importSource === 'garmin' && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4 text-sm text-foreground/80">
              {(run.elevationGain != null || garminTelemetry?.elevationGainM != null) && (
                <div className="flex items-center gap-1.5">
                  <Mountain className="h-4 w-4 text-emerald-600" />
                  <span>
                    Elevation +{Math.round(garminTelemetry?.elevationGainM ?? run.elevationGain ?? 0)} m
                  </span>
                </div>
              )}
              {(run.maxHR != null || garminTelemetry?.maxHr != null) && (
                <div className="flex items-center gap-1.5">
                  <Heart className="h-4 w-4 text-rose-600" />
                  <span>Max HR {Math.round(garminTelemetry?.maxHr ?? run.maxHR ?? 0)} bpm</span>
                </div>
              )}
              {(run.heartRate != null || garminTelemetry?.avgHr != null) && (
                <div className="flex items-center gap-1.5">
                  <Heart className="h-4 w-4 text-primary" />
                  <span>Avg HR {Math.round(garminTelemetry?.avgHr ?? run.heartRate ?? 0)} bpm</span>
                </div>
              )}
              {garminTelemetry?.avgCadenceSpm != null && (
                <div className="flex items-center gap-1.5">
                  <Gauge className="h-4 w-4 text-violet-600" />
                  <span>
                    Cadence {Math.round(garminTelemetry.avgCadenceSpm)} spm
                    {garminTelemetry.maxCadenceSpm != null
                      ? ` (max ${Math.round(garminTelemetry.maxCadenceSpm)})`
                      : ''}
                  </span>
                </div>
              )}
              {garminTelemetry?.analytics?.intervals?.count != null &&
                garminTelemetry.analytics.intervals.count > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Timer className="h-4 w-4 text-amber-600" />
                    <span>
                      Intervals {garminTelemetry.analytics.intervals.count}
                      {typeof garminTelemetry.analytics.intervals.consistencyPct === 'number'
                        ? ` • Consistency ${Math.round(garminTelemetry.analytics.intervals.consistencyPct)}%`
                        : ''}
                    </span>
                  </div>
                )}
              {garminTelemetry?.elevationLossM != null && (
                <div className="flex items-center gap-1.5">
                  <Mountain className="h-4 w-4 text-emerald-700" />
                  <span>Elevation -{Math.round(garminTelemetry.elevationLossM)} m</span>
                </div>
              )}
              {garminTelemetry?.maxSpeedMps != null && (
                <div className="flex items-center gap-1.5">
                  <Gauge className="h-4 w-4 text-sky-600" />
                  <span>Top speed {formatOptionalNumber(garminTelemetry.maxSpeedMps * 3.6, { digits: 1 })} km/h</span>
                </div>
              )}
              {isGarminTelemetryLoading && (
                <div className="text-xs text-foreground/60">
                  Loading telemetry...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {run.importSource === 'garmin' && (isGarminInsightLoading || garminInsight?.insight_markdown) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium flex items-center gap-2">
                <Watch className="h-4 w-4 text-primary" />
                Coach Analysis
              </h3>
              {typeof garminInsight?.confidence === 'number' && (
                <span className="text-xs rounded-full px-2 py-1 bg-primary/10 text-primary">
                  Confidence{' '}
                  {Math.round(garminInsight.confidence <= 1 ? garminInsight.confidence * 100 : garminInsight.confidence)}
                  %
                </span>
              )}
            </div>
            {isGarminInsightLoading ? (
              <div className="text-sm text-foreground/60">Loading Garmin coach insight...</div>
            ) : (
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">{garminInsight?.insight_markdown}</p>
            )}
          </CardContent>
        </Card>
      )}

      {run.importSource === 'garmin' && garminTelemetry?.analytics && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-medium">Garmin Performance Analytics</h3>
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div className="rounded-md bg-[oklch(var(--surface-3))] p-2">
                <div className="text-xs text-foreground/60">Pace Variability</div>
                <div className="font-medium">
                  {formatOptionalNumber(garminTelemetry.analytics.pacing?.variabilitySecPerKm, {
                    digits: 0,
                    suffix: 's',
                  })}
                </div>
              </div>
              <div className="rounded-md bg-[oklch(var(--surface-3))] p-2">
                <div className="text-xs text-foreground/60">Split Delta</div>
                <div className="font-medium">
                  {formatOptionalNumber(garminTelemetry.analytics.pacing?.splitDeltaSecPerKm, {
                    digits: 0,
                    suffix: 's/km',
                  })}
                </div>
              </div>
              <div className="rounded-md bg-[oklch(var(--surface-3))] p-2">
                <div className="text-xs text-foreground/60">Cadence Drift</div>
                <div className="font-medium">
                  {formatOptionalNumber(garminTelemetry.analytics.cadence?.driftPct, { digits: 1, suffix: '%' })}
                </div>
              </div>
              <div className="rounded-md bg-[oklch(var(--surface-3))] p-2">
                <div className="text-xs text-foreground/60">Interval Consistency</div>
                <div className="font-medium">
                  {formatOptionalNumber(garminTelemetry.analytics.intervals?.consistencyPct, {
                    digits: 0,
                    suffix: '%',
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {run.importSource === 'garmin' && telemetrySplits.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-medium">Splits</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-foreground/60">
                  <tr>
                    <th className="py-1 text-start font-medium">Split</th>
                    <th className="py-1 text-start font-medium">Distance</th>
                    <th className="py-1 text-start font-medium">Time</th>
                    <th className="py-1 text-start font-medium">Pace</th>
                    <th className="py-1 text-start font-medium">Avg HR</th>
                    <th className="py-1 text-start font-medium">Cadence</th>
                  </tr>
                </thead>
                <tbody>
                  {telemetrySplits.map((split) => (
                    <tr key={`split-${split.index}`} className="border-t border-border/50">
                      <td className="py-1.5">{split.index}</td>
                      <td className="py-1.5">{formatDistance(split.distanceKm)}</td>
                      <td className="py-1.5">{formatDuration(split.durationSec)}</td>
                      <td className="py-1.5">{formatPaceFromTelemetry(split.paceSecPerKm)}</td>
                      <td className="py-1.5">{formatOptionalNumber(split.avgHr)}</td>
                      <td className="py-1.5">{formatOptionalNumber(split.avgCadence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {run.importSource === 'garmin' && telemetryIntervals.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-medium">Interval Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-foreground/60">
                  <tr>
                    <th className="py-1 text-start font-medium">Rep</th>
                    <th className="py-1 text-start font-medium">Distance</th>
                    <th className="py-1 text-start font-medium">Time</th>
                    <th className="py-1 text-start font-medium">Pace</th>
                    <th className="py-1 text-start font-medium">Avg HR</th>
                    <th className="py-1 text-start font-medium">Cadence</th>
                  </tr>
                </thead>
                <tbody>
                  {telemetryIntervals.map((interval) => (
                    <tr key={`interval-${interval.index}`} className="border-t border-border/50">
                      <td className="py-1.5">{interval.index}</td>
                      <td className="py-1.5">{formatDistance(interval.distanceKm)}</td>
                      <td className="py-1.5">{formatDuration(interval.durationSec)}</td>
                      <td className="py-1.5">{formatPaceFromTelemetry(interval.paceSecPerKm)}</td>
                      <td className="py-1.5">{formatOptionalNumber(interval.avgHr)}</td>
                      <td className="py-1.5">{formatOptionalNumber(interval.avgCadence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {run.importSource === 'garmin' && telemetryLaps.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-medium">Laps</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-foreground/60">
                  <tr>
                    <th className="py-1 text-start font-medium">Lap</th>
                    <th className="py-1 text-start font-medium">Distance</th>
                    <th className="py-1 text-start font-medium">Time</th>
                    <th className="py-1 text-start font-medium">Pace</th>
                    <th className="py-1 text-start font-medium">Avg HR</th>
                    <th className="py-1 text-start font-medium">Cadence</th>
                  </tr>
                </thead>
                <tbody>
                  {telemetryLaps.map((lap) => (
                    <tr key={`lap-${lap.index}`} className="border-t border-border/50">
                      <td className="py-1.5">{lap.index}</td>
                      <td className="py-1.5">{formatDistance(lap.distanceKm)}</td>
                      <td className="py-1.5">{formatDuration(lap.durationSec)}</td>
                      <td className="py-1.5">{formatPaceFromTelemetry(lap.paceSecPerKm)}</td>
                      <td className="py-1.5">{formatOptionalNumber(lap.avgHr)}</td>
                      <td className="py-1.5">{formatOptionalNumber(lap.avgCadence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {gpsQualityEnabled && gpsQuality && gpsQualityStyles && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">GPS Quality</h3>
              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${gpsQualityStyles.badge}`}
              >
                {gpsQuality.level}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-foreground/70">
                <span>{gpsQuality.score}%</span>
                <span>{gpsQuality.averageAccuracy.toFixed(1)}m avg accuracy</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[oklch(var(--surface-3))]">
                <div
                  className={`h-2 rounded-full ${gpsQualityStyles.bar}`}
                  style={{ width: `${gpsQuality.score}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium mb-3">Route</h3>
          <div className="relative h-64 rounded-lg overflow-hidden">
            <MapErrorBoundary fallbackMessage="Route map temporarily unavailable">
              <RunMap
                height="100%"
                userLocation={null}
                path={path}
                followUser={false}
                interactive={false}
                showStartEndMarkers={true}
              />
            </MapErrorBoundary>
          </div>
        </CardContent>
      </Card>

      {paceChartEnabled && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium mb-3">Pace Over Distance</h3>
            <p className="text-xs text-foreground/60 mb-3">Your pace (min/km) at each kilometer of your run</p>
            <PaceChart gpsPath={pacePath} />
          </CardContent>
        </Card>
      )}

      {paceChartEnabled && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Pacing Analysis</h3>
              {paceConsistencyBadge ? (
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${paceConsistencyBadge.badge}`}>
                  {paceConsistencyBadge.label}
                </span>
              ) : null}
            </div>

            {pacingInsight?.pacingAnalysis ? (
              <p className="text-sm text-foreground/70">{pacingInsight.pacingAnalysis}</p>
            ) : (
              <p className="text-sm text-foreground/60">Pacing analysis unavailable.</p>
            )}

            {typeof pacingInsight?.paceVariability === 'number' && (
              <div
                className={`text-sm ${
                  pacingInsight.paceVariability > 30 ? 'text-red-600' : 'text-foreground/60'
                }`}
              >
                Variability: {formatVariance(pacingInsight.paceVariability)}/km
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Coach Notes</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void generateNotes()}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Regenerate
                </>
              )}
            </Button>
          </div>

          {coachNotes ? (
            <div className="space-y-3 text-sm">
              <p className="text-foreground">{coachNotes.shortSummary}</p>

              {coachNotes.positives.length > 0 && (
                <div>
                  <div className="font-medium text-foreground mb-1">Positives</div>
                  <ul className="list-disc list-inside space-y-1 text-foreground/70">
                    {coachNotes.positives.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {coachNotes.flags.length > 0 && (
                <div>
                  <div className="font-medium text-foreground mb-1">Flags</div>
                  <ul className="list-disc list-inside space-y-1 text-foreground/70">
                    {coachNotes.flags.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div className="font-medium text-foreground mb-1">Recovery (next 24h)</div>
                <p className="text-foreground/70">{coachNotes.recoveryNext24h}</p>
              </div>

              <div>
                <div className="font-medium text-foreground mb-1">Suggested next workout</div>
                <p className="text-foreground/70">{coachNotes.suggestedNextWorkout}</p>
              </div>
            </div>
          ) : (
            <div className="text-sm text-foreground/60">
              {isGenerating ? 'Generating coach notes...' : 'Coach notes will appear here.'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default RunReportScreen


