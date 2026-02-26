"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Award, ChevronDown, ChevronUp, MapPin, Play, Zap } from "lucide-react"

import type { Route, Workout } from "@/lib/db"
import type { StructuredWorkout } from "@/lib/workout-steps"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { WorkoutPhasesDisplay } from "@/components/workout-phases-display"

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
  if (isLoading) {
    return (
      <Card className="border-border/70">
        <CardContent className="space-y-3 p-5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-11 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!workout || workout.type === "rest") {
    return (
      <Card className="border-border/70 bg-card shadow-sm">
        <CardContent className="space-y-4 p-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <Award className="h-6 w-6 text-emerald-700" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Rest Day</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Recovery today improves tomorrow&apos;s quality session.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={onStartRun} className="h-11 gap-2">
              <Play className="h-4 w-4" />
              Record Run
            </Button>
            <Button variant="outline" onClick={onSelectRoute} className="h-11 gap-2">
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
      <Card className="border-border/70 bg-card shadow-sm">
        <CardHeader className="space-y-2 pb-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Today&apos;s workout</p>
              <CardTitle id="today-workout-heading" className="mt-1 text-xl">
                {workoutName}
              </CardTitle>
            </div>
            <Badge variant="outline" className="border-emerald-300 text-emerald-700">
              Planned
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground">Target distance / duration</p>
            <p className="mt-1 text-3xl font-semibold text-foreground">{workoutDistanceLabel}</p>
            <Progress value={Math.max(10, Math.min(100, goalProgressPercent || 0))} className="mt-3 h-2" />
          </div>

          <div className="rounded-xl border border-border/70 bg-background p-3">
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-emerald-700" />
              Coach cue
            </div>
            <p className="text-sm leading-relaxed text-foreground">{workoutCoachCue}</p>
          </div>

          {selectedRoute ? (
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2 text-sm">
              <span className="inline-flex items-center gap-2 font-medium text-foreground">
                <MapPin className="h-4 w-4 text-emerald-700" />
                {selectedRoute.name || "Selected route"}
              </span>
              {selectedRoute.distance ? <span className="text-muted-foreground">{selectedRoute.distance} km</span> : null}
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-2">
            <Button onClick={onStartRun} className="col-span-2 h-11 gap-2 font-semibold">
              <Play className="h-4 w-4" />
              Start Run
            </Button>
            <Button variant="outline" onClick={onSelectRoute} className="h-11">
              <MapPin className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="ghost"
            className="h-10 w-full justify-between text-sm"
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
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
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
