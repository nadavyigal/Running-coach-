import type { Run, Workout } from "@/lib/db"

import { dbUtils } from "@/lib/dbUtils"

export type RunImportMeta = {
  requestId?: string
  confidence?: number
  method?: string
  model?: string
  parserVersion?: string
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

const normalizeDate = (date: Date) => {
  if (!(date instanceof Date)) return null
  return Number.isFinite(date.getTime()) ? date : null
}

const isSameDayLocal = (a: Date, b: Date) => a.toDateString() === b.toDateString()

const isSameDayUTC = (a: Date, b: Date) =>
  a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()

const resolveWorkoutCandidate = async (input: RecordRunWithSideEffectsInput): Promise<Workout | undefined> => {
  if (typeof input.workoutId === "number") return undefined
  if (!input.autoMatchWorkout) return undefined

  const completedAt = normalizeDate(input.completedAt)
  if (!completedAt) return undefined

  const rangeStart = new Date(completedAt)
  rangeStart.setDate(rangeStart.getDate() - 1)
  rangeStart.setHours(0, 0, 0, 0)

  const rangeEnd = new Date(completedAt)
  rangeEnd.setDate(rangeEnd.getDate() + 1)
  rangeEnd.setHours(23, 59, 59, 999)

  const workouts = await dbUtils.getWorkoutsForDateRange(input.userId, rangeStart, rangeEnd, { limit: 200 })

  const candidateWorkouts = workouts.filter((workout) => workout.type !== "rest")
  const incompleteCandidates = candidateWorkouts.filter((workout) => !workout.completed)
  const pool = incompleteCandidates.length > 0 ? incompleteCandidates : candidateWorkouts

  const localMatches = pool.filter((workout) => isSameDayLocal(new Date(workout.scheduledDate), completedAt))
  if (localMatches.length === 1) return localMatches[0]

  const utcMatches = pool.filter((workout) => isSameDayUTC(new Date(workout.scheduledDate), completedAt))
  if (utcMatches.length === 1) return utcMatches[0]

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
      : await resolveWorkoutCandidate(input)
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
