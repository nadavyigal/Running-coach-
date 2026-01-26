'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { trackAnalyticsEvent } from '@/lib/analytics'
import { ENABLE_COMPLETION_LOOP } from '@/lib/featureFlags'
import { daysBetweenUTC } from '@/lib/timezone-utils'
import type { Workout } from '@/lib/db'
import { cueDouble } from '@/lib/coaching-cues'

const motivationalMessages = [
  'Great job sticking to the plan!',
  "You're building consistent habits!",
  'Your training is on track!',
]

const confettiPalette = ['#FACC15', '#38BDF8', '#EC4899', '#A855F7', '#F97316']

const typeLabels: Record<Workout['type'], string> = {
  easy: 'Easy Run',
  tempo: 'Tempo Run',
  intervals: 'Intervals',
  long: 'Long Run',
  'time-trial': 'Time Trial',
  hill: 'Hill Repeats',
  rest: 'Rest Day',
  'race-pace': 'Race Effort',
  recovery: 'Recovery Run',
  fartlek: 'Fartlek',
}

const formatDistance = (value?: number) =>
  typeof value === 'number' ? `${Number(value.toFixed(1))}km` : '—'

const formatDuration = (value?: number) =>
  typeof value === 'number' ? `${Math.round(value)}min` : '—'

const formatPace = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  const minutes = Math.floor(value / 60)
  const seconds = Math.round(value % 60)
    .toString()
    .padStart(2, '0')
  return `${minutes}:${seconds}`
}

const getPaceIndicator = (planned?: number, actual?: number) => {
  if (!planned || !actual) return ''
  if (actual < planned) return '⚡ Faster'
  if (actual > planned) return '🐢 Slower'
  return '✅ On target'
}

type WorkoutCompletionModalProps = {
  isOpen: boolean
  onClose: () => void
  onViewPlan?: () => void
  completedWorkout: Workout
  nextWorkout?: Workout
}

export function WorkoutCompletionModal({
  isOpen,
  onClose,
  onViewPlan,
  completedWorkout,
  nextWorkout,
}: WorkoutCompletionModalProps) {
  if (!ENABLE_COMPLETION_LOOP) return null

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [motivation, setMotivation] = useState(motivationalMessages[0])

  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      return
    }

    cueDouble()
    timerRef.current = setTimeout(onClose, 8000)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    setMotivation(
      motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)]
    )

    void trackAnalyticsEvent('workout_completion_modal_viewed', {
      workout_id: completedWorkout.id ?? null,
      workout_type: completedWorkout.type,
    })
  }, [completedWorkout, isOpen])

  const confettiPieces = useMemo(() => {
    if (!isOpen) return []
    return Array.from({ length: 28 }, (_, index) => ({
      id: index,
      color: confettiPalette[index % confettiPalette.length],
      offset: `${Math.random() * 100}%`,
      start: `${Math.random() * 100}%`,
      delay: Math.random() * 0.5,
    }))
  }, [isOpen])

  const plannedDistance = completedWorkout.distance
  const actualDistance =
    completedWorkout.actualDistanceKm ?? completedWorkout.distance ?? undefined
  const plannedDuration = completedWorkout.duration
  const actualDuration = completedWorkout.actualDurationMinutes
  const plannedPace = completedWorkout.pace
  const actualPace = completedWorkout.actualPace

  const distanceIndicator =
    typeof plannedDistance === 'number' &&
    typeof actualDistance === 'number' &&
    actualDistance >= plannedDistance
      ? '✓'
      : ''

  const durationIndicator =
    typeof plannedDuration === 'number' &&
    typeof actualDuration === 'number' &&
    actualDuration <= plannedDuration
      ? '✓'
      : ''

  const paceIndicator = getPaceIndicator(plannedPace, actualPace)

  const handleViewPlan = () => {
    if (nextWorkout) {
      const daysUntil = Math.max(
        0,
        daysBetweenUTC(new Date(), nextWorkout.scheduledDate)
      )
      void trackAnalyticsEvent('next_workout_previewed', {
        next_workout_type: nextWorkout.type,
        days_until: daysUntil,
      })
      onViewPlan?.()
    }

    onClose()
  }

  const workoutLabel = typeLabels[completedWorkout.type] ?? 'Workout'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        hideClose
        className="!w-full !h-screen !max-w-none !rounded-none !p-0"
      >
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-6 py-8 text-white">
          <div className="pointer-events-none absolute inset-0">
            {confettiPieces.map((piece) => (
              <span
                key={piece.id}
                className="absolute h-2 w-2 rounded-full animate-bounce opacity-80"
                style={{
                  backgroundColor: piece.color,
                  left: piece.offset,
                  top: piece.start,
                  animationDelay: `${piece.delay}s`,
                }}
              />
            ))}
          </div>

          <DialogHeader className="relative z-10 text-center">
            <div className="mx-auto mb-3 inline-flex rounded-full border border-white/40 px-4 py-1 text-xs uppercase tracking-wide text-white/80">
              Workout Completed! 🎉
            </div>
            <DialogTitle className="relative z-10 text-3xl font-bold">
              {workoutLabel}
            </DialogTitle>
            <div className="relative z-10 mt-2 flex items-center justify-center gap-2">
              <Badge variant="secondary">{workoutLabel}</Badge>
              <span className="text-xs uppercase text-white/70">
                {formatDistance(plannedDistance)}
              </span>
            </div>
          </DialogHeader>

          <div className="relative z-10 mt-6 flex flex-1 flex-col gap-4 sm:mt-8">
            <div className="grid w-full gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/20 bg-white/5 p-4">
                <p className="text-xs uppercase text-white/60">Distance</p>
                <p className="text-sm text-white/70">
                  Planned: {formatDistance(plannedDistance)}
                </p>
                <p className="text-lg font-semibold text-white flex items-center gap-2">
                  You: {formatDistance(actualDistance)}{' '}
                  {distanceIndicator && (
                    <span className="text-sm text-emerald-300">{distanceIndicator}</span>
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-white/20 bg-white/5 p-4">
                <p className="text-xs uppercase text-white/60">Duration</p>
                <p className="text-sm text-white/70">
                  Planned: {formatDuration(plannedDuration)}
                </p>
                <p className="text-lg font-semibold text-white flex items-center gap-2">
                  You: {formatDuration(actualDuration)}{' '}
                  {durationIndicator && (
                    <span className="text-sm text-emerald-300">{durationIndicator}</span>
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-white/20 bg-white/5 p-4">
                <p className="text-xs uppercase text-white/60">Pace</p>
                <p className="text-sm text-white/70">
                  Target: {formatPace(plannedPace)}
                </p>
                <p className="text-lg font-semibold text-white">
                  You: {formatPace(actualPace)}
                </p>
                {paceIndicator && (
                  <p className="mt-1 text-xs uppercase tracking-wide text-yellow-300">
                    {paceIndicator}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/30 bg-white/5 p-4">
              <p className="text-sm uppercase text-white/60">Encouragement</p>
              <p className="text-lg font-semibold text-white">{motivation}</p>
            </div>

            {nextWorkout && (
              <Card className="rounded-3xl border border-white/30 bg-white/10 shadow-2xl shadow-indigo-900/40">
                <CardContent className="space-y-3">
                  <p className="text-xs uppercase tracking-wide text-white/70">
                    What's Next?
                  </p>
                  <p className="text-2xl font-semibold text-white">
                    {nextWorkout.day} · {typeLabels[nextWorkout.type] ?? 'Workout'} ·{' '}
                    {formatDistance(nextWorkout.distance)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {nextWorkout.day}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {typeLabels[nextWorkout.type] ?? nextWorkout.type}
                    </Badge>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleViewPlan}
                    className="mt-2 w-full justify-center"
                  >
                    View Full Plan
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="relative z-10 mt-6 flex justify-center">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
