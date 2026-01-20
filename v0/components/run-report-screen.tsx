'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RunMap } from '@/components/maps/RunMap'
import { MapErrorBoundary } from '@/components/maps/MapErrorBoundary'
import { useToast } from '@/hooks/use-toast'
import { dbUtils } from '@/lib/dbUtils'
import type { Run } from '@/lib/db'
import type { LatLng } from '@/lib/mapConfig'
import { parseGpsPath } from '@/lib/routeUtils'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { ENABLE_AUTO_PAUSE } from '@/lib/featureFlags'

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

function getGpsQualityStyles(level: GPSQuality['level']) {
  switch (level) {
    case 'Excellent':
      return { bar: 'bg-green-500', badge: 'bg-green-100 text-green-700' }
    case 'Good':
      return { bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' }
    case 'Fair':
      return { bar: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700' }
    default:
      return { bar: 'bg-red-500', badge: 'bg-red-100 text-red-700' }
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

export function RunReportScreen({ runId, onBack }: { runId: number | null; onBack: () => void }) {
  const { toast } = useToast()

  const [run, setRun] = useState<Run | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  const gpsQualityEnabled = ENABLE_AUTO_PAUSE
  const path: LatLng[] = useMemo(() => parseGpsPath(run?.gpsPath), [run?.gpsPath])

  const coachNotes = useMemo(() => safeParseCoachNotes(run?.runReport), [run?.runReport])
  const gpsQuality = useMemo(
    () => (gpsQualityEnabled ? extractGpsQuality(run?.runReport) : null),
    [gpsQualityEnabled, run?.runReport]
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
  }, [gpsQualityEnabled, loadRun, path.length, run, runId, toast])

  useEffect(() => {
    loadRun()
  }, [loadRun])

  useEffect(() => {
    if (!runId || !run) return
    if (run.runReport) return
    if (isGenerating) return
    void generateNotes()
  }, [generateNotes, isGenerating, run, runId])

  if (!runId) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">Run Report</h1>
          <div className="w-8" />
        </div>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-700">No run selected.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 space-y-4">
        <Card>
          <CardContent className="p-6 flex items-center justify-center gap-2 text-sm text-gray-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading run...
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">Run Report</h1>
          <div className="w-8" />
        </div>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-700">Run not found.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 space-y-4">
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
              <div className="text-xl font-bold text-blue-600">{run.distance.toFixed(2)}</div>
              <div className="text-xs text-gray-600">km</div>
            </div>
            <div>
              <div className="text-xl font-bold text-green-600">{formatTime(run.duration)}</div>
              <div className="text-xs text-gray-600">time</div>
            </div>
            <div>
              <div className="text-xl font-bold text-purple-600">{formatPace(avgPace)}</div>
              <div className="text-xs text-gray-600">pace</div>
            </div>
          </div>
        </CardContent>
      </Card>

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
              <div className="flex items-center justify-between text-sm text-gray-700">
                <span>{gpsQuality.score}%</span>
                <span>{gpsQuality.averageAccuracy.toFixed(1)}m avg accuracy</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100">
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
              <p className="text-gray-800">{coachNotes.shortSummary}</p>

              {coachNotes.positives.length > 0 && (
                <div>
                  <div className="font-medium text-gray-900 mb-1">Positives</div>
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    {coachNotes.positives.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {coachNotes.flags.length > 0 && (
                <div>
                  <div className="font-medium text-gray-900 mb-1">Flags</div>
                  <ul className="list-disc list-inside space-y-1 text-gray-700">
                    {coachNotes.flags.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div className="font-medium text-gray-900 mb-1">Recovery (next 24h)</div>
                <p className="text-gray-700">{coachNotes.recoveryNext24h}</p>
              </div>

              <div>
                <div className="font-medium text-gray-900 mb-1">Suggested next workout</div>
                <p className="text-gray-700">{coachNotes.suggestedNextWorkout}</p>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              {isGenerating ? 'Generating coach notes...' : 'Coach notes will appear here.'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
