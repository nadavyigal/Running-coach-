"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react"
import type { User, Plan, Goal, Run, Workout } from "@/lib/db"
import { dbUtils } from "@/lib/dbUtils"
import { syncUserRunData } from "@/lib/run-recording"

// ============================================================================
// TYPES
// ============================================================================

export type WeeklyStats = {
  runsCompleted: number
  totalDistanceKm: number
  totalDurationSeconds: number
  plannedWorkouts: number
  completedWorkouts: number
  consistencyRate: number
}

export type AllTimeStats = {
  totalRuns: number
  totalDistanceKm: number
  totalDurationSeconds: number
}

export type DataContextValue = {
  // Core entities
  user: User | null
  userId: number | null
  plan: Plan | null
  primaryGoal: Goal | null
  activeGoals: Goal[]

  // Weekly data (for TodayScreen, ChatScreen)
  weeklyRuns: Run[]
  weeklyStats: WeeklyStats
  weeklyWorkouts: Workout[]

  // All-time data (for ProfileScreen)
  recentRuns: Run[]
  allTimeStats: AllTimeStats

  // Loading/error states
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  // Actions
  refresh: () => Promise<void>
  refreshGoals: () => Promise<void>
  refreshRuns: () => Promise<void>
  syncData: () => Promise<{ linkedRuns: number; updatedGoals: number; updatedWorkouts: number }>
}

const DataContext = createContext<DataContextValue | null>(null)

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getWeekBoundaries(): { start: Date; end: Date } {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - today.getDay()) // Sunday
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6) // Saturday
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function calculateWeeklyStats(runs: Run[], workouts: Workout[]): WeeklyStats {
  const runsCompleted = runs.length
  const totalDistanceKm = runs.reduce((sum, r) => sum + (r.distance || 0), 0)
  const totalDurationSeconds = runs.reduce((sum, r) => sum + (r.duration || 0), 0)

  const plannedWorkouts = workouts.filter(w => w.type !== "rest").length
  const completedWorkouts = workouts.filter(w => w.completed && w.type !== "rest").length
  const consistencyRate = plannedWorkouts > 0
    ? Math.round((completedWorkouts / plannedWorkouts) * 100)
    : 0

  return {
    runsCompleted,
    totalDistanceKm,
    totalDurationSeconds,
    plannedWorkouts,
    completedWorkouts,
    consistencyRate,
  }
}

function calculateAllTimeStats(runs: Run[]): AllTimeStats {
  return {
    totalRuns: runs.length,
    totalDistanceKm: runs.reduce((sum, r) => sum + (r.distance || 0), 0),
    totalDurationSeconds: runs.reduce((sum, r) => sum + (r.duration || 0), 0),
  }
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export function DataProvider({ children }: { children: React.ReactNode }) {
  // Core state
  const [user, setUser] = useState<User | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [primaryGoal, setPrimaryGoal] = useState<Goal | null>(null)
  const [activeGoals, setActiveGoals] = useState<Goal[]>([])

  // Weekly data
  const [weeklyRuns, setWeeklyRuns] = useState<Run[]>([])
  const [weeklyWorkouts, setWeeklyWorkouts] = useState<Workout[]>([])

  // All-time data
  const [recentRuns, setRecentRuns] = useState<Run[]>([])
  const [allRuns, setAllRuns] = useState<Run[]>([])

  // Loading state
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const userId = user?.id ?? null

  // Calculate derived stats
  const weeklyStats = useMemo(
    () => calculateWeeklyStats(weeklyRuns, weeklyWorkouts),
    [weeklyRuns, weeklyWorkouts]
  )

  const allTimeStats = useMemo(
    () => calculateAllTimeStats(allRuns),
    [allRuns]
  )

  // Refresh goals
  const refreshGoals = useCallback(async () => {
    if (!userId) return

    try {
      const [primary, active] = await Promise.all([
        dbUtils.getPrimaryGoal(userId),
        dbUtils.getUserGoals(userId, "active"),
      ])
      setPrimaryGoal(primary)
      setActiveGoals(active)
    } catch (err) {
      console.error("[DataContext] Failed to refresh goals:", err)
    }
  }, [userId])

  // Refresh runs
  const refreshRuns = useCallback(async () => {
    if (!userId) return

    try {
      const { start, end } = getWeekBoundaries()

      const [weekly, recent, all] = await Promise.all([
        dbUtils.getRunsInTimeRange(userId, start, end),
        dbUtils.getUserRuns(userId, 10),
        dbUtils.getRunsByUser(userId),
      ])

      setWeeklyRuns(weekly)
      setRecentRuns(recent)
      setAllRuns(all)
    } catch (err) {
      console.error("[DataContext] Failed to refresh runs:", err)
    }
  }, [userId])

  // Full refresh
  const refresh = useCallback(async () => {
    if (!userId) return

    setIsLoading(true)
    setError(null)

    try {
      const { start, end } = getWeekBoundaries()

      // Fetch all data in parallel
      const [
        activePlan,
        primary,
        active,
        weekly,
        recent,
        all,
        workouts,
      ] = await Promise.all([
        dbUtils.getActivePlan(userId),
        dbUtils.getPrimaryGoal(userId),
        dbUtils.getUserGoals(userId, "active"),
        dbUtils.getRunsInTimeRange(userId, start, end),
        dbUtils.getUserRuns(userId, 10),
        dbUtils.getRunsByUser(userId),
        dbUtils.getWorkoutsForDateRange(userId, start, end),
      ])

      setPlan(activePlan)
      setPrimaryGoal(primary)
      setActiveGoals(active)
      setWeeklyRuns(weekly)
      setRecentRuns(recent)
      setAllRuns(all)
      setWeeklyWorkouts(workouts)
    } catch (err) {
      console.error("[DataContext] Failed to refresh data:", err)
      setError("Failed to load data")
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  // Sync data - recalculates goal progress from runs
  const syncData = useCallback(async () => {
    if (!userId) {
      return { linkedRuns: 0, updatedGoals: 0, updatedWorkouts: 0 }
    }

    try {
      const result = await syncUserRunData(userId)
      // Refresh all data after sync
      await refresh()
      return result
    } catch (err) {
      console.error("[DataContext] Failed to sync data:", err)
      return { linkedRuns: 0, updatedGoals: 0, updatedWorkouts: 0 }
    }
  }, [userId, refresh])

  // Initial load
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const currentUser = await dbUtils.getCurrentUser()
        if (!currentUser) {
          setIsLoading(false)
          setIsInitialized(true)
          return
        }

        setUser(currentUser)
      } catch (err) {
        console.error("[DataContext] Failed to initialize:", err)
        setError("Failed to initialize")
        setIsLoading(false)
        setIsInitialized(true)
      }
    }

    initialize()
  }, [])

  // Load data when user is set, and sync on first load to fix stale goal progress
  useEffect(() => {
    if (user?.id) {
      // First, sync to recalculate goal progress from runs (fixes stale data)
      syncUserRunData(user.id)
        .then((result) => {
          if (result.updatedGoals > 0) {
            console.log(`[DataContext] Synced ${result.updatedGoals} goals on startup`)
          }
        })
        .catch((err) => {
          console.warn("[DataContext] Sync on startup failed:", err)
        })
        .finally(() => {
          // Then refresh to load all data
          refresh().then(() => {
            setIsInitialized(true)
          })
        })
    }
  }, [user?.id, refresh])

  // Listen for run-saved events to refresh data
  useEffect(() => {
    const handleRunSaved = () => {
      refreshRuns()
      refreshGoals()
    }

    window.addEventListener("run-saved", handleRunSaved)
    return () => window.removeEventListener("run-saved", handleRunSaved)
  }, [refreshRuns, refreshGoals])

  // Listen for goal updates
  useEffect(() => {
    const handleGoalUpdated = () => {
      refreshGoals()
    }

    window.addEventListener("goal-updated", handleGoalUpdated)
    return () => window.removeEventListener("goal-updated", handleGoalUpdated)
  }, [refreshGoals])

  const value: DataContextValue = {
    user,
    userId,
    plan,
    primaryGoal,
    activeGoals,
    weeklyRuns,
    weeklyStats,
    weeklyWorkouts,
    recentRuns,
    allTimeStats,
    isLoading,
    isInitialized,
    error,
    refresh,
    refreshGoals,
    refreshRuns,
    syncData,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

// ============================================================================
// HOOK
// ============================================================================

export function useData(): DataContextValue {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error("useData must be used within a DataProvider")
  }
  return context
}

// ============================================================================
// UTILITY HOOK FOR GOAL PROGRESS
// ============================================================================

export function useGoalProgress(goal?: Goal | null): number {
  return useMemo(() => {
    if (!goal) return 0

    const baseline = typeof goal.baselineValue === "number" ? goal.baselineValue : 0
    const target = typeof goal.targetValue === "number" ? goal.targetValue : 0
    const current = typeof goal.currentValue === "number" ? goal.currentValue : baseline

    // Use stored progressPercentage if available and valid
    if (typeof goal.progressPercentage === "number" && goal.progressPercentage >= 0) {
      return Math.min(100, Math.max(0, goal.progressPercentage))
    }

    // Calculate from values
    const denominator = target - baseline
    if (denominator === 0) return current === target ? 100 : 0

    // For time improvement goals, lower is better
    if (goal.goalType === "time_improvement") {
      const raw = ((baseline - current) / (baseline - target)) * 100
      return Math.min(100, Math.max(0, raw))
    }

    // For other goals, higher is better
    const raw = ((current - baseline) / denominator) * 100
    return Math.min(100, Math.max(0, raw))
  }, [goal])
}

export function useDaysRemaining(goal?: Goal | null): number | null {
  return useMemo(() => {
    if (!goal?.timeBound?.deadline) return null
    const deadline = new Date(goal.timeBound.deadline)
    const deadlineTime = deadline.getTime()
    if (Number.isNaN(deadlineTime)) return null
    const diff = Math.ceil((deadlineTime - Date.now()) / (1000 * 60 * 60 * 24))
    return diff < 0 ? 0 : diff
  }, [goal])
}
