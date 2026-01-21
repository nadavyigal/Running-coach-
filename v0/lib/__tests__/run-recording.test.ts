import { describe, expect, it, beforeEach, vi } from "vitest"
import type { Run, Workout } from "@/lib/db"

const mockGetWorkoutsForDateRange = vi.fn()
const mockGetActivePlan = vi.fn()
const mockGetUserGoals = vi.fn()
const mockUpdateGoal = vi.fn()
const mockGetRunsInTimeRange = vi.fn()
const mockCalculateGoalProgressPercentage = vi.fn()
const mockRecordGoalProgress = vi.fn()
const mockCreateRun = vi.fn()
const mockMarkWorkoutCompleted = vi.fn()
const mockUpdateWorkout = vi.fn()
const mockTrackAnalyticsEvent = vi.fn()

vi.mock("@/lib/dbUtils", () => ({
  dbUtils: {
    getWorkoutsForDateRange: mockGetWorkoutsForDateRange,
    getActivePlan: mockGetActivePlan,
    getUserGoals: mockGetUserGoals,
    updateGoal: mockUpdateGoal,
    getRunsInTimeRange: mockGetRunsInTimeRange,
    calculateGoalProgressPercentage: mockCalculateGoalProgressPercentage,
    recordGoalProgress: mockRecordGoalProgress,
    createRun: mockCreateRun,
    markWorkoutCompleted: mockMarkWorkoutCompleted,
    updateWorkout: mockUpdateWorkout,
  },
}))

vi.mock("@/lib/analytics", () => ({
  trackAnalyticsEvent: mockTrackAnalyticsEvent,
}))

const loadRunRecording = async () => {
  vi.resetModules()
  return import("@/lib/run-recording")
}

const buildWorkout = (overrides?: Partial<Workout>): Workout => ({
  id: overrides?.id ?? 1,
  planId: overrides?.planId ?? 1,
  week: overrides?.week ?? 1,
  day: overrides?.day ?? "Tue",
  type: overrides?.type ?? "tempo",
  distance: overrides?.distance ?? 5,
  duration: overrides?.duration ?? 60,
  pace: overrides?.pace ?? 300,
  intensity: overrides?.intensity ?? "threshold",
  trainingPhase: overrides?.trainingPhase ?? "base",
  workoutStructure: overrides?.workoutStructure ?? null,
  notes: overrides?.notes,
  completed: overrides?.completed ?? false,
  scheduledDate: overrides?.scheduledDate ?? new Date("2025-01-15T00:00:00Z"),
  createdAt: overrides?.createdAt ?? new Date(),
  updatedAt: overrides?.updatedAt ?? new Date(),
})

beforeEach(async () => {
  vi.resetAllMocks()
  process.env.NEXT_PUBLIC_ENABLE_COMPLETION_LOOP = "true"
  mockGetWorkoutsForDateRange.mockResolvedValue([])
  mockGetActivePlan.mockResolvedValue(null)
  mockGetUserGoals.mockResolvedValue([])
  mockGetRunsInTimeRange.mockResolvedValue([])
  mockCalculateGoalProgressPercentage.mockReturnValue(0)
})

describe("findMatchingWorkout", () => {
  it("returns the workout with the smallest distance difference when type and distance match", async () => {
    const runRecording = await loadRunRecording()
    const run: Run = {
      id: 1,
      userId: 1,
      type: "tempo",
      distance: 5,
      duration: 1800,
      completedAt: new Date("2025-01-15T09:00:00Z"),
      createdAt: new Date(),
    }

    mockGetWorkoutsForDateRange.mockResolvedValue([
      buildWorkout({ id: 2, distance: 5 }),
      buildWorkout({ id: 3, distance: 4 }),
    ])

    const matched = await runRecording.findMatchingWorkout(run)
    expect(matched?.id).toBe(2)
  })

  it("returns null when the distance variance exceeds the 20% tolerance", async () => {
    const runRecording = await loadRunRecording()
    const run: Run = {
      id: 1,
      userId: 2,
      type: "tempo",
      distance: 6.5,
      duration: 2000,
      completedAt: new Date("2025-01-15T09:00:00Z"),
      createdAt: new Date(),
    }

    mockGetWorkoutsForDateRange.mockResolvedValue([
      buildWorkout({ id: 5, distance: 5 }),
    ])

    const matched = await runRecording.findMatchingWorkout(run)
    expect(matched).toBeNull()
  })
})

describe("confirmWorkoutCompletion", () => {
  it("updates workout stats and tracks analytics when a match exists", async () => {
    const runRecording = await loadRunRecording()
    const run: Run = {
      id: 10,
      userId: 1,
      type: "tempo",
      distance: 5,
      duration: 1500,
      completedAt: new Date("2025-01-15T09:00:00Z"),
      createdAt: new Date(),
      workoutId: undefined,
    }

    const workout = buildWorkout({ id: 1, distance: 5 })
    mockGetWorkoutsForDateRange.mockResolvedValue([workout])

    const result = await runRecording.confirmWorkoutCompletion(run)

    expect(mockUpdateWorkout).toHaveBeenCalledWith(workout.id, {
      completed: true,
      completedAt: expect.any(Date),
      actualDistanceKm: run.distance,
      actualDurationMinutes: run.duration / 60,
      actualPace: run.pace,
    })
    expect(mockMarkWorkoutCompleted).toHaveBeenCalledWith(workout.id)
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
      "workout_completion_confirmed",
      expect.objectContaining({
        matched_plan_workout: true,
        workout_id: workout.id,
      })
    )
    expect(result?.actualDistanceKm).toBe(run.distance)

  })

  it("reports matched_plan_workout false and skips updates when no match is found", async () => {
    const runRecording = await loadRunRecording()
    const run: Run = {
      id: 11,
      userId: 1,
      type: "tempo",
      distance: 5,
      duration: 1500,
      completedAt: new Date("2025-01-15T09:00:00Z"),
      createdAt: new Date(),
    }

    const result = await runRecording.confirmWorkoutCompletion(run)

    expect(mockUpdateWorkout).not.toHaveBeenCalled()
    expect(mockMarkWorkoutCompleted).not.toHaveBeenCalled()
    expect(mockTrackAnalyticsEvent).toHaveBeenCalledWith(
      "workout_completion_confirmed",
      expect.objectContaining({ matched_plan_workout: false, workout_id: null })
    )
    expect(result).toBeNull()

  })

  it("short circuits when the completion loop flag is disabled", async () => {
    process.env.NEXT_PUBLIC_ENABLE_COMPLETION_LOOP = "false"
    const runRecording = await loadRunRecording()
    const run: Run = {
      id: 12,
      userId: 1,
      type: "tempo",
      distance: 5,
      duration: 1500,
      completedAt: new Date("2025-01-15T09:00:00Z"),
      createdAt: new Date(),
    }

    const result = await runRecording.confirmWorkoutCompletion(run)

    expect(result).toBeNull()
    expect(mockTrackAnalyticsEvent).not.toHaveBeenCalled()
    process.env.NEXT_PUBLIC_ENABLE_COMPLETION_LOOP = "true"
  })
})

describe("determineAdaptationReason", () => {
  it("returns performance_below_target when pace is slower than planned", async () => {
    const runRecording = await loadRunRecording()
    const run: Run = {
      id: 20,
      userId: 1,
      type: "tempo",
      distance: 5,
      duration: 1800,
      pace: 340,
      completedAt: new Date("2025-01-15T09:00:00Z"),
      createdAt: new Date(),
    }

    const workout = buildWorkout({ pace: 300 })

    const reason = await runRecording.determineAdaptationReason(run, workout)
    expect(reason).toBe("performance_below_target")
  })

  it("returns distance_not_met when distance deficit exceeds 20%", async () => {
    const runRecording = await loadRunRecording()
    const run: Run = {
      id: 21,
      userId: 1,
      type: "tempo",
      distance: 3.8,
      duration: 1500,
      pace: 310,
      completedAt: new Date("2025-01-15T09:00:00Z"),
      createdAt: new Date(),
    }

    const workout = buildWorkout({ distance: 5 })

    const reason = await runRecording.determineAdaptationReason(run, workout)
    expect(reason).toBe("distance_not_met")
  })

  it("returns consecutive_misses when the missed streak threshold is reached", async () => {
    const runRecording = await loadRunRecording()
    const run: Run = {
      id: 22,
      userId: 1,
      type: "tempo",
      distance: 5,
      duration: 1500,
      pace: 300,
      completedAt: new Date("2025-01-15T09:00:00Z"),
      createdAt: new Date(),
    }

    const workout = buildWorkout({ scheduledDate: new Date("2025-01-15T00:00:00Z") })

    mockGetWorkoutsForDateRange.mockResolvedValueOnce([
      {
        ...buildWorkout({
          id: 2,
          scheduledDate: new Date("2025-01-13T00:00:00Z"),
          completed: false,
        }),
      },
      {
        ...buildWorkout({
          id: 3,
          scheduledDate: new Date("2025-01-14T00:00:00Z"),
          completed: false,
        }),
      },
    ])

    const reason = await runRecording.determineAdaptationReason(run, workout)
    expect(reason).toBe("consecutive_misses")
  })
})
