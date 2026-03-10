import { describe, expect, it, beforeEach, vi } from "vitest"
import type { Run, Workout } from "@/lib/db"

const mockGetWorkoutsForDateRange = vi.fn()
const mockGetActivePlan = vi.fn()
const mockGetPlan = vi.fn()
const mockGetUserGoals = vi.fn()
const mockUpdateGoal = vi.fn()
const mockGetRunsInTimeRange = vi.fn()
const mockCalculateGoalProgressPercentage = vi.fn()
const mockRecordGoalProgress = vi.fn()
const mockCreateRun = vi.fn()
const mockMarkWorkoutCompleted = vi.fn()
const mockUpdateWorkout = vi.fn()
const mockUpdatePlan = vi.fn()
const mockCreatePlan = vi.fn()
const mockCreateWorkout = vi.fn()
const mockGetCurrentUser = vi.fn()
const mockGetWorkoutById = vi.fn()
const mockGetRunById = vi.fn()
const mockTrackAnalyticsEvent = vi.fn()
const mockGeneratePlan = vi.fn()
const mockGenerateFallbackPlan = vi.fn()
const fetchMock = vi.fn()

vi.mock("@/lib/dbUtils", () => ({
  dbUtils: {
    getWorkoutsForDateRange: mockGetWorkoutsForDateRange,
    getActivePlan: mockGetActivePlan,
    getPlan: mockGetPlan,
    getUserGoals: mockGetUserGoals,
    updateGoal: mockUpdateGoal,
    getRunsInTimeRange: mockGetRunsInTimeRange,
    calculateGoalProgressPercentage: mockCalculateGoalProgressPercentage,
    recordGoalProgress: mockRecordGoalProgress,
    createRun: mockCreateRun,
    markWorkoutCompleted: mockMarkWorkoutCompleted,
    updateWorkout: mockUpdateWorkout,
    updatePlan: mockUpdatePlan,
    createPlan: mockCreatePlan,
    createWorkout: mockCreateWorkout,
    getCurrentUser: mockGetCurrentUser,
    getWorkoutById: mockGetWorkoutById,
    getRunById: mockGetRunById,
  },
}))

vi.mock("@/lib/analytics", () => ({
  trackAnalyticsEvent: mockTrackAnalyticsEvent,
}))

vi.mock("@/lib/planGenerator", () => ({
  generatePlan: mockGeneratePlan,
  generateFallbackPlan: mockGenerateFallbackPlan,
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
  vi.stubGlobal("fetch", fetchMock)
  process.env.NEXT_PUBLIC_ENABLE_COMPLETION_LOOP = "true"
  mockGetWorkoutsForDateRange.mockResolvedValue([])
  mockGetActivePlan.mockResolvedValue(null)
  mockGetPlan.mockResolvedValue(null)
  mockGetUserGoals.mockResolvedValue([])
  mockGetRunsInTimeRange.mockResolvedValue([])
  mockCalculateGoalProgressPercentage.mockReturnValue(0)
  mockUpdatePlan.mockResolvedValue(undefined)
  mockCreatePlan.mockResolvedValue(101)
  mockCreateWorkout.mockResolvedValue(201)
  mockGetCurrentUser.mockResolvedValue({
    id: 1,
    goal: "habit",
    experience: "beginner",
    daysPerWeek: 3,
    preferredTimes: ["morning"],
  })
  mockGetWorkoutById.mockResolvedValue(null)
  mockGetRunById.mockResolvedValue(null)
  mockTrackAnalyticsEvent.mockResolvedValue(undefined)
  mockGeneratePlan.mockResolvedValue({
    plan: {
      userId: 1,
      title: "Adapted plan",
      description: "Adapted description",
      startDate: new Date("2025-01-15T00:00:00Z"),
      endDate: new Date("2025-02-12T00:00:00Z"),
      totalWeeks: 4,
      isActive: true,
      planType: "basic",
      fitnessLevel: "beginner",
      trainingDaysPerWeek: 3,
    },
    workouts: [
      {
        planId: 0,
        week: 1,
        day: "Thu",
        type: "easy",
        distance: 4,
        completed: false,
        scheduledDate: new Date("2025-01-16T00:00:00Z"),
      },
    ],
  })
  mockGenerateFallbackPlan.mockResolvedValue({
    plan: {
      userId: 1,
      title: "Fallback plan",
      description: "Fallback description",
      startDate: new Date("2025-01-15T00:00:00Z"),
      endDate: new Date("2025-02-12T00:00:00Z"),
      totalWeeks: 4,
      isActive: true,
      planType: "basic",
      fitnessLevel: "beginner",
      trainingDaysPerWeek: 3,
    },
    workouts: [],
  })
  fetchMock.mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({ success: true }),
    text: vi.fn().mockResolvedValue(""),
  })
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

  it("still confirms an explicitly linked workout when the adaptation loop flag is disabled", async () => {
    process.env.NEXT_PUBLIC_ENABLE_COMPLETION_LOOP = "false"
    const runRecording = await loadRunRecording()
    const linkedWorkout = buildWorkout({ id: 12, distance: 5 })
    const run: Run = {
      id: 12,
      userId: 1,
      type: "tempo",
      distance: 5,
      duration: 1500,
      completedAt: new Date("2025-01-15T09:00:00Z"),
      createdAt: new Date(),
      workoutId: 12,
    }

    mockGetWorkoutById.mockResolvedValue(linkedWorkout)
    const result = await runRecording.confirmWorkoutCompletion(run)

    expect(mockGetWorkoutById).toHaveBeenCalledWith(12)
    expect(result?.id).toBe(12)
    expect(mockMarkWorkoutCompleted).toHaveBeenCalledWith(12)
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

describe("recordRunWithSideEffects", () => {
  it("persists the run, links the planned workout, and completes adaptation when a linked workout underperforms", async () => {
    const runRecording = await loadRunRecording()
    const linkedWorkout = buildWorkout({
      id: 31,
      planId: 91,
      type: "tempo",
      distance: 5,
      pace: 300,
    })

    mockCreateRun.mockResolvedValue(501)
    mockGetWorkoutById.mockResolvedValue(linkedWorkout)
    mockGetPlan.mockResolvedValue({
      id: 91,
      userId: 1,
      title: "Current plan",
      description: "Current plan description",
      startDate: new Date("2025-01-01T00:00:00Z"),
      endDate: new Date("2025-02-12T00:00:00Z"),
      totalWeeks: 4,
      isActive: true,
    })

    const result = await runRecording.recordRunWithSideEffects({
      userId: 1,
      workoutId: 31,
      distanceKm: 4,
      durationSeconds: 1500,
      completedAt: new Date("2025-01-15T09:00:00Z"),
      type: "tempo",
      paceSecondsPerKm: 375,
      autoMatchWorkout: true,
      importSource: "manual",
    })

    expect(mockCreateRun).toHaveBeenCalledWith(
      expect.objectContaining({
        workoutId: 31,
        userId: 1,
      })
    )
    expect(mockUpdateWorkout).toHaveBeenCalledWith(
      31,
      expect.objectContaining({
        completed: true,
        actualDistanceKm: 4,
      })
    )
    expect(mockUpdatePlan).toHaveBeenCalledWith(91, { isActive: false })
    expect(mockCreatePlan).toHaveBeenCalled()
    expect(mockCreateWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: 101,
      })
    )
    expect(result.workoutId).toBe(31)
    expect(result.adaptation.status).toBe("completed")
    expect(result.adaptation.reason).toBe("performance_below_target")
    expect(result.adaptation.planId).toBe(101)
    expect(result.adaptationTriggered).toBe(true)
  })

  it("keeps the run saved and returns a retryable failure when adaptation cannot complete", async () => {
    const runRecording = await loadRunRecording()
    const linkedWorkout = buildWorkout({
      id: 44,
      planId: 144,
      type: "tempo",
      distance: 5,
      pace: 300,
    })

    mockCreateRun.mockResolvedValue(777)
    mockGetWorkoutById.mockResolvedValue(linkedWorkout)
    mockGetPlan.mockResolvedValue({
      id: 144,
      userId: 1,
      title: "Current plan",
      description: "Current plan description",
      startDate: new Date("2025-01-01T00:00:00Z"),
      endDate: new Date("2025-02-12T00:00:00Z"),
      totalWeeks: 4,
      isActive: true,
    })
    mockGeneratePlan.mockRejectedValueOnce(new Error("AI down"))
    mockGenerateFallbackPlan.mockRejectedValueOnce(new Error("Fallback unavailable"))

    const result = await runRecording.recordRunWithSideEffects({
      userId: 1,
      workoutId: 44,
      distanceKm: 4,
      durationSeconds: 1500,
      completedAt: new Date("2025-01-15T09:00:00Z"),
      type: "tempo",
      paceSecondsPerKm: 375,
      autoMatchWorkout: true,
      importSource: "manual",
    })

    expect(mockCreateRun).toHaveBeenCalled()
    expect(result.runId).toBe(777)
    expect(result.adaptation.status).toBe("failed")
    expect(result.adaptation.reason).toBe("performance_below_target")
    expect(result.adaptation.retryable).toBe(true)
    expect(mockUpdatePlan).not.toHaveBeenCalled()
  })
})
