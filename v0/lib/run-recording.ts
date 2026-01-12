import type { Goal, Run, Workout } from "@/lib/db"

import { dbUtils } from "@/lib/dbUtils"

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

export type RecordRunWithSideEffectsResult = {
  runId: number
  workoutId?: number
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

const goalMetricDistanceKm = (metric?: string) => {
  if (!metric) return null
  const normalized = metric.toLowerCase()

  const metricMap: Record<string, number> = {
    "5k_time": 5,
    "10k_time": 10,
    "half_marathon_time": 21.097,
    "marathon_time": 42.195,
    "10_mile_time": 16.093,
  }

  if (metricMap[normalized]) return metricMap[normalized]

  if (normalized.includes("half") && normalized.includes("marathon")) return 21.097
  if (normalized.includes("marathon")) return 42.195

  const mileMatch = normalized.match(/(\d+(?:\.\d+)?)_?mile/)
  if (mileMatch) {
    const miles = Number.parseFloat(mileMatch[1])
    return Number.isFinite(miles) ? miles * 1.60934 : null
  }

  const kmMatch = normalized.match(/(\d+(?:\.\d+)?)(?:k|km)/)
  if (kmMatch) {
    const km = Number.parseFloat(kmMatch[1])
    return Number.isFinite(km) ? km : null
  }

  return null
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
          ...(typeof resolvedWorkoutId === "number" ? { workoutId: resolvedWorkoutId } : {}),
        },
      })
    )
  } catch {
    // Ignore environments without window/custom events
  }

  return { runId, ...(typeof resolvedWorkoutId === "number" ? { workoutId: resolvedWorkoutId } : {}) }
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
