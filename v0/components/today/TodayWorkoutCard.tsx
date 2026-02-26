"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Award, ChevronDown, ChevronUp, HeartPulse, MapPin, Play, Zap } from "lucide-react"
import { todayCardVariants, todayStatusBadgeVariants } from "@/components/today/today-ui"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { WorkoutPhasesDisplay } from "@/components/workout-phases-display"
import type { Route, Workout } from "@/lib/db"
import type { StructuredWorkout } from "@/lib/workout-steps"

interface TodayWorkoutCardProps {
  isLoading: boolean
  workout: Workout | null
  structuredWorkout: StructuredWorkout | null
  selectedRoute: Route | null
  workoutDistanceLabel: string
  workoutCoachCue: string
  goalProgressPercent: number
  showBreakdown: boolean
  onToggleBreakdown: () => void
  onStartRun: () => void
  onSelectRoute: () => void
}

export function TodayWorkoutCard({
  isLoading,
  workout,
  structuredWorkout,
  selectedRoute,
  workoutDistanceLabel,
  workoutCoachCue,
  goalProgressPercent,
  showBreakdown,
  onToggleBreakdown,
  onStartRun,
  onSelectRoute,
}: TodayWorkoutCardProps) {
  const prefersReducedMotion = useReducedMotion()

  if (isLoading) {
    return (
      <Card className={todayCardVariants({ level: "primary" })}>
        <CardContent className="space-y-3.5 p-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-11 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!workout || workout.type === "rest") {
    return (
      <Card className={todayCardVariants({ level: "primary", interactive: true })}>
        <CardContent className="space-y-4 p-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100/90">
            <Award className="h-6 w-6 text-emerald-700" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Rest Day</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Recovery today improves tomorrow&apos;s quality session.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-3 text-left text-sm">
            <p className="flex items-center gap-2 font-medium text-emerald-900">
              <HeartPulse className="h-4 w-4" />
              Recovery marker
            </p>
            <p className="mt-1 text-emerald-800/90">Light mobility or a short walk helps absorb previous training load.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={onStartRun} className="h-11 gap-2 rounded-xl">
              <Play className="h-4 w-4" />
              Record Run
            </Button>
            <Button variant="outline" onClick={onSelectRoute} className="h-11 gap-2 rounded-xl">
              <MapPin className="h-4 w-4" />
              Route
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const workoutName =
    structuredWorkout?.name ??
    `${workout.type.charAt(0).toUpperCase()}${workout.type.slice(1)} Run`

  return (
    <section aria-labelledby="today-workout-heading">
      <Card className={todayCardVariants({ level: "primary", interactive: true })}>
        <CardHeader className="space-y-2 pb-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Today&apos;s workout</p>
              <CardTitle id="today-workout-heading" className="mt-1 text-[1.45rem] leading-tight">
                {workoutName}
              </CardTitle>
            </div>
            <Badge variant="outline" className={todayStatusBadgeVariants({ tone: "positive" })}>
              Planned
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Target distance / duration</p>
              <span className={todayStatusBadgeVariants({ tone: goalProgressPercent >= 65 ? "positive" : "info" })}>
                Goal {Math.round(goalProgressPercent)}%
              </span>
            </div>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{workoutDistanceLabel}</p>
            <Progress value={Math.max(10, Math.min(100, goalProgressPercent || 0))} className="mt-3 h-2.5" />
          </div>

          <div className="rounded-xl border border-border/70 bg-background p-3.5">
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Coach cue
            </div>
            <p className="text-sm leading-relaxed text-foreground">{workoutCoachCue}</p>
          </div>

          {selectedRoute ? (
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2 text-sm">
              <span className="inline-flex items-center gap-2 font-medium text-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                {selectedRoute.name || "Selected route"}
              </span>
              {selectedRoute.distance ? <span className="text-muted-foreground">{selectedRoute.distance} km</span> : null}
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-2">
            <Button onClick={onStartRun} className="col-span-2 h-11 gap-2 rounded-xl font-semibold">
              <Play className="h-4 w-4" />
              Start Run
            </Button>
            <Button variant="outline" onClick={onSelectRoute} className="h-11 rounded-xl">
              <MapPin className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="ghost"
            className="h-10 w-full justify-between rounded-xl border border-transparent text-sm hover:border-border/65 hover:bg-muted/30"
            onClick={onToggleBreakdown}
            aria-expanded={showBreakdown}
            aria-controls="today-workout-breakdown"
          >
            Workout breakdown
            {showBreakdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          <AnimatePresence initial={false}>
            {showBreakdown ? (
              <motion.div
                id="today-workout-breakdown"
                initial={prefersReducedMotion ? false : { opacity: 0, y: -6 }}
                animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                transition={prefersReducedMotion ? undefined : { duration: 0.18 }}
                className="rounded-xl border border-border/70 bg-background p-3"
              >
                {structuredWorkout ? (
                  <WorkoutPhasesDisplay workout={structuredWorkout} compact />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Workout phases are loading. You can still start the run now.
                  </p>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </CardContent>
      </Card>
    </section>
  )
}
