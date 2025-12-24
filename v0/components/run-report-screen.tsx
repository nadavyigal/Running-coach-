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

type CoachNotes = {
  shortSummary: string
  positives: string[]
  flags: string[]
  recoveryNext24h: string
  suggestedNextWorkout: string
}

type RunReportPayload = {
  report: CoachNotes
  source: 'ai' | 'fallback'
}

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

function safeParseCoachNotes(raw: string | undefined): CoachNotes | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as CoachNotes
  } catch {
    return null
  }
}

export function RunReportScreen({ runId, onBack }: { runId: number | null; onBack: () => void }) {
  const { toast } = useToast()

  const [run, setRun] = useState<Run | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  const path: LatLng[] = useMemo(() => parseGpsPath(run?.gpsPath), [run?.gpsPath])

  const coachNotes = useMemo(() => safeParseCoachNotes(run?.runReport), [run?.runReport])

  const avgPace = useMemo(() => {
    if (!run) return 0
    return run.distance > 0 ? run.duration / run.distance : 0
  }, [run])

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
      const response = await fetch('/api/run-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run: {
            id: runId,
            type: run.type,
            distanceKm: run.distance,
            durationSeconds: run.duration,
            avgPaceSecondsPerKm: run.distance > 0 ? run.duration / run.distance : 0,
            completedAt: run.completedAt,
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
  }, [loadRun, path.length, run, runId, toast])

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
