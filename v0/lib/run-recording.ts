import type { Goal, Run, Workout } from "@/lib/db"

import { dbUtils } from "@/lib/dbUtils"
import { trackAnalyticsEvent } from "@/lib/analytics"
import { ENABLE_COMPLETION_LOOP } from "@/lib/featureFlags"
import { endOfDayUTC, startOfDayUTC } from "@/lib/timezone-utils"

export type RunImportMeta = {
  requestId?: string
  confidence?: number
  method?: string
  model?: string
  parserVersion?: string
  hasRouteMap?: boolean
  routeType?: string
  gpsCoordinates?: Array<{ lat: number; lng: number }>
  mapImageDescription?: string
}

export type RecordRunWithSideEffectsInput = {
  userId: number
  distanceKm: number
  durationSeconds: number
  completedAt: Date
  type?: Run["type"]
  paceSecondsPerKm?: number
  calories?: number
  notes?: string
  gpsPath?: string
  gpsAccuracyData?: string
  route?: string
  startAccuracy?: number
  endAccuracy?: number
  averageAccuracy?: number
  workoutId?: number
  importSource?: Run["importSource"]
  importMeta?: RunImportMeta
  autoMatchWorkout?: boolean
}

export type AdaptationReason = 'performance_below_target' | 'distance_not_met' | 'consecutive_misses'

export type RecordRunWithSideEffectsResult = {
  runId: number
  workoutId?: number
  matchedWorkout?: Workout
  adaptationTriggered?: boolean
  adaptationReason?: AdaptationReason
}

const estimateCalories = (distanceKm: number) => Math.round(distanceKm * 60)

const normalizeDistanceKm = (distanceKm: number) => {
  if (!Number.isFinite(distanceKm)) return null
  const rounded = Math.round(distanceKm * 1000) / 1000
  return rounded > 0 ? rounded : null
}

const normalizeDurationSeconds = (durationSeconds: number) => {
  if (!Number.isFinite(durationSeconds)) return null
  const rounded = Math.round(durationSeconds)
  return rounded > 0 ? rounded : null
}

const normalizeDate = (value: unknown) => {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value)
    return Number.isFinite(parsed.getTime()) ? parsed : null
  }
  return null
}

const WORKOUT_DISTANCE_TOLERANCE = 0.2

const isSameDayLocal = (a: Date, b: Date) => a.toDateString() === b.toDateString()

const isSameDayUTC = (a: Date, b: Date) =>
  a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()

type ResolveWorkoutOptions = {
  userId: number
  completedAt: Date
  workoutId?: number
  autoMatchWorkout?: boolean
  preferredPlanId?: number
  excludedWorkoutIds?: Set<number>
}

const pickClosestWorkout = (workouts: Workout[], completedAt: Date) => {
  if (workouts.length === 0) return undefined
  return workouts
    .slice()
    .sort((a, b) => {
      const aTime = Math.abs(new Date(a.scheduledDate).getTime() - completedAt.getTime())
      const bTime = Math.abs(new Date(b.scheduledDate).getTime() - completedAt.getTime())
      return aTime - bTime
    })
    .at(0)
}

const resolveWorkoutCandidate = async (input: ResolveWorkoutOptions): Promise<Workout | undefined> => {
  if (typeof input.workoutId === "number") return undefined
  if (input.autoMatchWorkout === false) return undefined

  const completedAt = normalizeDate(input.completedAt)
  if (!completedAt) return undefined

  const rangeStart = new Date(completedAt)
  rangeStart.setDate(rangeStart.getDate() - 1)
  rangeStart.setHours(0, 0, 0, 0)

  const rangeEnd = new Date(completedAt)
  rangeEnd.setDate(rangeEnd.getDate() + 1)
  rangeEnd.setHours(23, 59, 59, 999)

  const workouts = await dbUtils.getWorkoutsForDateRange(input.userId, rangeStart, rangeEnd, { limit: 200 })
  if (workouts.length === 0) return undefined

  const activePlanId =
    typeof input.preferredPlanId === "number"
      ? input.preferredPlanId
      : (await dbUtils.getActivePlan(input.userId))?.id

  const candidateWorkouts = workouts.filter((workout) => {
    if (workout.type === "rest") return false
    if (input.excludedWorkoutIds?.has(workout.id ?? -1)) return false
    return true
  })
  if (candidateWorkouts.length === 0) return undefined

  const preferredPool = typeof activePlanId === "number"
    ? candidateWorkouts.filter((workout) => workout.planId === activePlanId)
    : []
  const pooledCandidates = preferredPool.length > 0 ? preferredPool : candidateWorkouts

  const incompleteCandidates = pooledCandidates.filter((workout) => !workout.completed)
  const pool = incompleteCandidates.length > 0 ? incompleteCandidates : pooledCandidates

  const localMatches = pool.filter((workout) => isSameDayLocal(new Date(workout.scheduledDate), completedAt))
  if (localMatches.length === 1) return localMatches[0]
  if (localMatches.length > 1) return pickClosestWorkout(localMatches, completedAt)

  const utcMatches = pool.filter((workout) => isSameDayUTC(new Date(workout.scheduledDate), completedAt))
  if (utcMatches.length === 1) return utcMatches[0]
  if (utcMatches.length > 1) return pickClosestWorkout(utcMatches, completedAt)

  return undefined
}

const mapWorkoutToRunType = (workoutType: Workout["type"]): Run["type"] => {
  switch (workoutType) {
    case "easy":
    case "tempo":
    case "intervals":
    case "long":
    case "time-trial":
    case "hill":
      return workoutType
    case "race-pace":
      return "tempo"
    case "recovery":
      return "easy"
    case "fartlek":
      return "intervals"
    default:
      return "other"
  }
}

export const workoutTypeToRunType = mapWorkoutToRunType

const computeDistanceVariancePct = (runDistance: number, plannedDistance: number): number | null => {
  if (!Number.isFinite(runDistance) || !Number.isFinite(plannedDistance) || plannedDistance === 0) {
    return null
  }
  return (Math.abs(runDistance - plannedDistance) / plannedDistance) * 100
}

export async function findMatchingWorkout(run: Run): Promise<Workout | null> {
  const completedAt = normalizeDate(run.completedAt ?? run.createdAt)
  if (!completedAt) return null

  if (!Number.isFinite(run.distance) || run.distance <= 0) {
    return null
  }

  const rangeStart = startOfDayUTC(completedAt)
  const rangeEnd = endOfDayUTC(completedAt)

  const workouts = await dbUtils.getWorkoutsForDateRange(run.userId, rangeStart, rangeEnd, { limit: 100 })
  if (workouts.length === 0) return null

  const matches = workouts.filter((workout) => {
    if (workout.completed) return false
    if (typeof workout.id !== "number") return false
    if (!Number.isFinite(workout.distance) || workout.distance <= 0) return false
    const workoutRunType = mapWorkoutToRunType(workout.type)
    if (workoutRunType !== run.type) return false
    return Math.abs(run.distance - workout.distance) / workout.distance <= WORKOUT_DISTANCE_TOLERANCE
  })

  if (matches.length === 0) return null

  const sortedMatches = matches.slice().sort((a, b) => {
    const aVariance = Math.abs(run.distance - a.distance)
    const bVariance = Math.abs(run.distance - b.distance)
    return aVariance - bVariance
  })

  return sortedMatches.at(0) ?? null
}

export async function confirmWorkoutCompletion(run: Run): Promise<Workout | null> {
  if (!ENABLE_COMPLETION_LOOP) return null

  const matchedWorkout = await findMatchingWorkout(run)
  const variancePct =
    matchedWorkout && Number.isFinite(run.distance)
      ? computeDistanceVariancePct(run.distance, matchedWorkout.distance)
      : null

  try {
    await trackAnalyticsEvent("workout_completion_confirmed", {
      workout_id: matchedWorkout?.id ?? null,
      matched_plan_workout: Boolean(matchedWorkout),
      distance_variance_pct: variancePct,
    })
  } catch (error) {
    console.warn("Failed to track workout completion analytics", error)
  }

  if (!matchedWorkout?.id) {
    return matchedWorkout ?? null
  }

  const completionTimestamp = new Date()
  await dbUtils.updateWorkout(matchedWorkout.id, {
    completed: true,
    completedAt: completionTimestamp,
    actualDistanceKm: run.distance,
    actualDurationMinutes: run.duration / 60,
    actualPace: run.pace,
  })
  await dbUtils.markWorkoutCompleted(matchedWorkout.id)

  return {
    ...matchedWorkout,
    completed: true,
    completedAt: completionTimestamp,
    actualDistanceKm: run.distance,
    actualDurationMinutes: run.duration / 60,
    actualPace: run.pace,
  }
}

const PACE_THRESHOLD_SECONDS = 30
const DISTANCE_DEFICIT_RATIO = 0.2
const MISSED_WORKOUT_STREAK_THRESHOLD = 2
const MISSED_WORKOUT_WINDOW_DAYS = 14

const normalizePlannedPace = (workout: Workout): number | null => {
  if (typeof workout.pace === "number" && Number.isFinite(workout.pace) && workout.pace > 0) {
    return workout.pace
  }
  if (
    typeof workout.duration === "number" &&
    Number.isFinite(workout.duration) &&
    workout.duration > 0 &&
    typeof workout.distance === "number" &&
    Number.isFinite(workout.distance) &&
    workout.distance > 0
  ) {
    return (workout.duration * 60) / workout.distance
  }
  return null
}

const normalizeActualPace = (run: Run): number | null => {
  if (typeof run.pace === "number" && Number.isFinite(run.pace) && run.pace > 0) {
    return run.pace
  }
  if (
    typeof run.duration === "number" &&
    Number.isFinite(run.duration) &&
    run.duration > 0 &&
    typeof run.distance === "number" &&
    Number.isFinite(run.distance) &&
    run.distance > 0
  ) {
    return run.duration / run.distance
  }
  return null
}

const shouldConsiderWorkoutForStreak = (workout: Workout, referenceDate: Date) => {
  if (workout.type === "rest") return false
  const scheduled = normalizeDate(workout.scheduledDate)
  if (!scheduled) return false
  return scheduled.getTime() < referenceDate.getTime()
}

const getMissedWorkoutStreak = async (userId: number, workout: Workout): Promise<number> => {
  if (!userId || !workout.planId || !workout.scheduledDate) return 0
  const referenceDate = new Date(workout.scheduledDate)
  const windowStart = new Date(referenceDate)
  windowStart.setDate(windowStart.getDate() - MISSED_WORKOUT_WINDOW_DAYS)
  const workouts = await dbUtils.getWorkoutsForDateRange(userId, windowStart, referenceDate, { limit: 200 })
  const relevant = workouts
    .filter((candidate) => candidate.planId === workout.planId && shouldConsiderWorkoutForStreak(candidate, referenceDate))
    .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())

  let streak = 0
  for (const candidate of relevant) {
    if (candidate.completed) break
    streak += 1
    if (streak >= MISSED_WORKOUT_STREAK_THRESHOLD) break
  }

  return streak
}

export async function determineAdaptationReason(run: Run, workout: Workout): Promise<AdaptationReason | null> {
  const plannedPace = normalizePlannedPace(workout)
  const actualPace = normalizeActualPace(run)
  if (plannedPace !== null && actualPace !== null && actualPace - plannedPace > PACE_THRESHOLD_SECONDS) {
    return "performance_below_target"
  }

  const plannedDistance = workout.distance
  const actualDistance = run.distance
  if (
    Number.isFinite(plannedDistance) &&
    plannedDistance > 0 &&
    Number.isFinite(actualDistance) &&
    actualDistance < plannedDistance * (1 - DISTANCE_DEFICIT_RATIO)
  ) {
    return "distance_not_met"
  }

  const missedStreak = await getMissedWorkoutStreak(run.userId, workout)
  if (missedStreak >= MISSED_WORKOUT_STREAK_THRESHOLD) {
    return "consecutive_misses"
  }

  return null
}

const serializeRunForAdaptation = (run: Run) => ({
  ...run,
  completedAt: run.completedAt instanceof Date ? run.completedAt.toISOString() : run.completedAt,
  createdAt: run.createdAt instanceof Date ? run.createdAt.toISOString() : run.createdAt,
  updatedAt: run.updatedAt instanceof Date ? run.updatedAt.toISOString() : run.updatedAt,
})

const triggerPlanAdaptation = async (
  userId: number,
  planId: number,
  run: Run,
  adaptationReason: AdaptationReason
) => {
  if (!userId || !planId) return
  try {
    const response = await fetch("/api/plan/adapt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        planId,
        userId,
        adaptationReason,
        recentRun: serializeRunForAdaptation(run),
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => null)
      console.warn("Plan adaptation request failed", response.status, errorBody)
      return
    }

    void trackAnalyticsEvent("plan_adapted", {
      adaptation_reason: adaptationReason,
      plan_id: planId,
      trigger: "workout_completion",
    })
  } catch (error) {
    console.warn("Failed to trigger plan adaptation", error)
  }
}

const resolveRunDate = (run: Run) => normalizeDate(run.completedAt ?? run.createdAt)

const resolveGoalWindow = (goal: Goal, measurementDate: Date) => {
  const start = normalizeDate(goal.timeBound?.startDate) ?? normalizeDate(goal.createdAt) ?? new Date(0)
  const deadline = normalizeDate(goal.timeBound?.deadline)
  const end = deadline && deadline.getTime() < measurementDate.getTime() ? deadline : measurementDate
  if (!start || !end || end.getTime() < start.getTime()) return null
  return { start, end }
}

const filterRunsForGoal = (runs: Run[], start: Date, end: Date) =>
  runs.filter((run) => {
    const runDate = resolveRunDate(run)
    if (!runDate) return false
    return runDate.getTime() >= start.getTime() && runDate.getTime() <= end.getTime()
  })

const computeGoalMeasurement = (goal: Goal, runs: Run[]) => {
  if (runs.length === 0) return null

  switch (goal.goalType) {
    case "distance_achievement":
    case "race_completion": {
      const distances = runs
        .map((run) => run.distance)
        .filter((distance) => Number.isFinite(distance) && distance > 0)
      if (distances.length === 0) return null
      return Math.max(...distances)
    }
    case "frequency":
    case "consistency":
    case "health":
      return runs.length
    case "time_improvement": {
      // Count ALL runs toward progress - track total training volume
      // Progress is based on cumulative distance run toward the goal
      const totalDistance = runs.reduce((sum, run) => {
        if (!Number.isFinite(run.distance) || run.distance <= 0) return sum
        return sum + run.distance
      }, 0)

      if (totalDistance <= 0) return null

      // Return total distance as progress metric (will be compared to target volume)
      return totalDistance
    }
    default:
      return null
  }
}

const shouldRecordGoalProgress = (goal: Goal, measuredValue: number, progressPercentage: number) => {
  const currentValue = Number.isFinite(goal.currentValue) ? goal.currentValue : goal.baselineValue
  const currentProgress = Number.isFinite(goal.progressPercentage) ? goal.progressPercentage : 0
  const valueChanged = !Number.isFinite(currentValue) || Math.abs(measuredValue - currentValue) > 0.001
  const progressChanged = !Number.isFinite(currentProgress) || Math.abs(progressPercentage - currentProgress) > 0.01
  return valueChanged || progressChanged
}

type UpdateGoalsFromRunsInput = {
  userId: number
  measurementDate: Date
  contributingRunId?: number
  runs?: Run[]
  source?: "run-save" | "sync"
}

const updateGoalsFromRuns = async ({
  userId,
  measurementDate,
  contributingRunId,
  runs,
  source = "run-save",
}: UpdateGoalsFromRunsInput) => {
  const goals = await dbUtils.getUserGoals(userId, "active")
  if (goals.length === 0) return 0

  const resolvedMeasurementDate = normalizeDate(measurementDate) ?? new Date()
  let updatedGoals = 0

  for (const goal of goals) {
    if (typeof goal.id !== "number") continue

    // Fix stale goals with invalid currentValue - set to baseline
    const needsCurrentValueFix =
      typeof goal.currentValue !== "number" ||
      !Number.isFinite(goal.currentValue) ||
      goal.currentValue === 0

    if (needsCurrentValueFix && typeof goal.baselineValue === "number" && Number.isFinite(goal.baselineValue)) {
      await dbUtils.updateGoal(goal.id, {
        currentValue: goal.baselineValue,
        progressPercentage: 0,
      })
      // Update local copy for subsequent calculations
      goal.currentValue = goal.baselineValue
      goal.progressPercentage = 0
      updatedGoals += 1
      console.log(`[updateGoalsFromRuns] Fixed stale goal ${goal.id}: set currentValue to baselineValue (${goal.baselineValue})`)
    }

    const window = resolveGoalWindow(goal, resolvedMeasurementDate)
    if (!window) continue

    const runsForGoal = runs
      ? filterRunsForGoal(runs, window.start, window.end)
      : await dbUtils.getRunsInTimeRange(userId, window.start, window.end)
    const measuredValue = computeGoalMeasurement(goal, runsForGoal)

    // For time_improvement goals without matching runs, keep current progress as-is
    // but ensure the goal state is valid (already fixed above if needed)
    if (measuredValue === null) continue

    const progressPercentage = dbUtils.calculateGoalProgressPercentage(
      goal.baselineValue,
      measuredValue,
      goal.targetValue,
      goal.goalType
    )

    if (!shouldRecordGoalProgress(goal, measuredValue, progressPercentage)) continue

    await dbUtils.recordGoalProgress({
      goalId: goal.id,
      measurementDate: resolvedMeasurementDate,
      measuredValue,
      progressPercentage,
      contributingActivityId: typeof contributingRunId === "number" ? contributingRunId : null,
      contributingActivityType: "run",
      autoRecorded: true,
      context: { source },
    })
    updatedGoals += 1
  }

  return updatedGoals
}

export async function recordRunWithSideEffects(
  input: RecordRunWithSideEffectsInput
): Promise<RecordRunWithSideEffectsResult> {
  const distanceKm = normalizeDistanceKm(input.distanceKm)
  const durationSeconds = normalizeDurationSeconds(input.durationSeconds)
  const completedAt = normalizeDate(input.completedAt)

  if (!distanceKm) {
    throw new Error("Please provide a valid distance")
  }

  if (!durationSeconds) {
    throw new Error("Please provide a valid duration")
  }

  if (!completedAt) {
    throw new Error("Please provide a valid date")
  }

  const workoutCandidate =
    typeof input.workoutId === "number"
      ? undefined
      : await resolveWorkoutCandidate({
          userId: input.userId,
          completedAt,
          workoutId: input.workoutId,
          autoMatchWorkout: input.autoMatchWorkout,
        })
  const resolvedWorkoutId = typeof input.workoutId === "number" ? input.workoutId : workoutCandidate?.id

  const type =
    input.type ??
    (workoutCandidate ? mapWorkoutToRunType(workoutCandidate.type) : "other")

  const paceSecondsPerKm =
    typeof input.paceSecondsPerKm === "number" && Number.isFinite(input.paceSecondsPerKm) && input.paceSecondsPerKm > 0
      ? input.paceSecondsPerKm
      : durationSeconds / distanceKm

  const calories =
    typeof input.calories === "number" && Number.isFinite(input.calories) && input.calories > 0
      ? Math.round(input.calories)
      : estimateCalories(distanceKm)

  const notes = input.notes?.trim() || undefined

  const runData: Omit<Run, "id" | "createdAt"> = {
    userId: input.userId,
    type,
    distance: distanceKm,
    duration: durationSeconds,
    pace: paceSecondsPerKm,
    calories,
    ...(notes ? { notes } : {}),
    ...(input.gpsPath ? { gpsPath: input.gpsPath } : {}),
    ...(input.gpsAccuracyData ? { gpsAccuracyData: input.gpsAccuracyData } : {}),
    ...(input.route ? { route: input.route } : {}),
    ...(typeof input.startAccuracy === "number" ? { startAccuracy: input.startAccuracy } : {}),
    ...(typeof input.endAccuracy === "number" ? { endAccuracy: input.endAccuracy } : {}),
    ...(typeof input.averageAccuracy === "number" ? { averageAccuracy: input.averageAccuracy } : {}),
    ...(typeof resolvedWorkoutId === "number" ? { workoutId: resolvedWorkoutId } : {}),
    ...(input.importSource ? { importSource: input.importSource } : {}),
    ...(input.importMeta?.requestId ? { importRequestId: input.importMeta.requestId } : {}),
    ...(typeof input.importMeta?.confidence === "number" ? { importConfidencePct: input.importMeta.confidence } : {}),
    ...(input.importMeta?.method ? { importMethod: input.importMeta.method } : {}),
    ...(input.importMeta?.model ? { importModel: input.importMeta.model } : {}),
    ...(input.importMeta?.parserVersion ? { importParserVersion: input.importMeta.parserVersion } : {}),
    completedAt,
  }

  const runId = await dbUtils.createRun(runData)

  if (typeof resolvedWorkoutId === "number") {
    await dbUtils.markWorkoutCompleted(resolvedWorkoutId)
  }

  const runRecord: Run = {
    ...runData,
    id: runId,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const matchedWorkout = await confirmWorkoutCompletion(runRecord)
  const linkedWorkoutId =
    matchedWorkout?.id ?? (typeof resolvedWorkoutId === "number" ? resolvedWorkoutId : undefined)
  let adaptationReason: AdaptationReason | null = null
  if (ENABLE_COMPLETION_LOOP && matchedWorkout) {
    adaptationReason = await determineAdaptationReason(runRecord, matchedWorkout)
    if (adaptationReason) {
      void triggerPlanAdaptation(runRecord.userId, matchedWorkout.planId, runRecord, adaptationReason)
    }
  }
  const adaptationTriggered = Boolean(adaptationReason)

  try {
    await updateGoalsFromRuns({
      userId: input.userId,
      measurementDate: completedAt,
      contributingRunId: runId,
      source: "run-save",
    })
  } catch (error) {
    console.warn("Failed to update goal progress for run", error)
  }

  try {
    window.dispatchEvent(
      new CustomEvent("run-saved", {
        detail: {
          userId: input.userId,
          runId,
          ...(typeof linkedWorkoutId === "number" ? { workoutId: linkedWorkoutId } : {}),
        },
      })
    )
  } catch {
    // Ignore environments without window/custom events
  }

  return {
    runId,
    ...(typeof linkedWorkoutId === "number" ? { workoutId: linkedWorkoutId } : {}),
    ...(matchedWorkout ? { matchedWorkout } : {}),
    ...(adaptationTriggered && adaptationReason
      ? { adaptationTriggered, adaptationReason }
      : {}),
  }
}

export async function syncUserRunData(userId: number): Promise<{
  linkedRuns: number
  updatedGoals: number
  updatedWorkouts: number
}> {
  const runs = await dbUtils.getRunsByUser(userId)
  if (runs.length === 0) {
    return { linkedRuns: 0, updatedGoals: 0, updatedWorkouts: 0 }
  }

  const activePlanId = (await dbUtils.getActivePlan(userId))?.id
  const usedWorkoutIds = new Set<number>()

  runs.forEach((run) => {
    if (typeof run.workoutId === "number") {
      usedWorkoutIds.add(run.workoutId)
    }
  })

  let updatedWorkouts = 0
  for (const workoutId of usedWorkoutIds) {
    await dbUtils.markWorkoutCompleted(workoutId)
    updatedWorkouts += 1
  }

  let linkedRuns = 0
  for (const run of runs) {
    if (typeof run.id !== "number") continue
    if (typeof run.workoutId === "number") continue

    const completedAt = normalizeDate(run.completedAt ?? run.createdAt)
    if (!completedAt) continue

    const candidate = await resolveWorkoutCandidate({
      userId,
      completedAt,
      autoMatchWorkout: true,
      preferredPlanId: activePlanId,
      excludedWorkoutIds: usedWorkoutIds,
    })

    if (!candidate?.id) continue

    await dbUtils.updateRun(run.id, { workoutId: candidate.id })
    await dbUtils.markWorkoutCompleted(candidate.id)
    usedWorkoutIds.add(candidate.id)
    linkedRuns += 1
    updatedWorkouts += 1
  }

  const latestRunDate =
    runs
      .map((run) => normalizeDate(run.completedAt ?? run.createdAt))
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => b.getTime() - a.getTime())
      .at(0) ?? new Date()

  let updatedGoals = 0
  try {
    updatedGoals = await updateGoalsFromRuns({
      userId,
      measurementDate: latestRunDate,
      runs,
      source: "sync",
    })
  } catch (error) {
    console.warn("Failed to sync goal progress", error)
  }

  return { linkedRuns, updatedGoals, updatedWorkouts }
}
