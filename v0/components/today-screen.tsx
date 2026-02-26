"use client";

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Sun,
  Plus,
  MapPin,
  Play,
  ChevronDown,
  ChevronUp,
  Zap,
  Loader2,
  Flame,
  BarChart3,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  LogIn,
  LogOut,
  UserPlus,
  Users,
} from "lucide-react"
import { AddRunModal } from "@/components/add-run-modal"
import { AddActivityModal } from "@/components/add-activity-modal"
import { RouteSelectorModal } from "@/components/route-selector-modal"
import { RescheduleModal } from "@/components/reschedule-modal"
import { DateWorkoutModal } from "@/components/date-workout-modal"
import ModalErrorBoundary from "@/components/modal-error-boundary"
import { type Workout, type Route, type Goal, type RecoveryScore, resetDatabaseInstance, db } from "@/lib/db"
import { dbUtils, getUserPaceZones } from "@/lib/dbUtils"
import { useData, useGoalProgress } from "@/contexts/DataContext"
import { WorkoutPhasesDisplay } from "@/components/workout-phases-display"
import { generateStructuredWorkout, type StructuredWorkout } from "@/lib/workout-steps"
import { getDefaultPaceZones } from "@/lib/pace-zones"
import { GoalProgressEngine, type GoalProgress } from "@/lib/goalProgressEngine"
import { useToast } from "@/hooks/use-toast"
import { markRecapNotificationShown, shouldShowWeeklyRecapNotification } from "@/lib/weekly-recap-scheduler"
import { trackAnalyticsEvent } from "@/lib/analytics"
import { CommunityStatsWidget } from "@/components/community-stats-widget"
import { GoalRecommendations } from "@/components/goal-recommendations"
import { HabitAnalyticsWidget } from "@/components/habit-analytics-widget"
import { WeeklyRecapNotificationBanner } from "@/components/weekly-recap-notification-banner"
import { WeeklyRecapWidget } from "@/components/weekly-recap-widget"
import { AuthModal } from "@/components/auth/auth-modal"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ENABLE_WEEKLY_RECAP } from "@/lib/featureFlags"
import { useAuth } from "@/lib/auth-context"
import { SyncStatusIndicator } from "@/components/sync-status-indicator"
import { useBetaSignupCount } from "@/lib/hooks/useBetaSignupCount"
import { RunSmartBrandMark } from "@/components/run-smart-brand-mark"
import { ChallengeProgressRing } from "@/components/challenge-progress-ring"
import { DailyChallengePrompt } from "@/components/daily-challenge-prompt"
import { getActiveChallenge } from "@/lib/challengeEngine"
import type { ChallengeProgress, ChallengeTemplate } from "@/lib/db"
import type { DailyChallengeData } from "@/lib/challengeEngine"
import { RecoveryEngine } from "@/lib/recoveryEngine"
import { calculateCoachConfidence, type CoachConfidenceResult } from "@/lib/coach-confidence"
import { InsightsPanelsDashboard } from "@/components/insights/panels/InsightsPanelsDashboard"
import { PlanAdjustmentNotice } from "@/components/plan/PlanAdjustmentNotice"
import { WeeklyGoalCard } from "@/components/goals/WeeklyGoalCard"
import { DailyFocusCard } from "@/components/today/DailyFocusCard"
import { KeyMetricsGrid, type KeyMetric } from "@/components/today/KeyMetricsGrid"
import { ProgressSummaryChart } from "@/components/today/ProgressSummaryChart"
import { CoachInsightsPanel, type CoachInsight } from "@/components/today/CoachInsightsPanel"
import { TodayWorkoutCard } from "@/components/today/TodayWorkoutCard"
import { AdvancedAnalyticsAccordion } from "@/components/today/AdvancedAnalyticsAccordion"
import { DataQualityBanner } from "@/components/today/DataQualityBanner"

export function TodayScreen() {
  // Get shared data from context
  const {
    user: localUser,
    userId,
    plan,
    primaryGoal,
    weeklyRuns,
    weeklyWorkouts,
    weeklyStats,
    refresh: refreshContext,
  } = useData()
  const { user: authUser, profileId, loading: authLoading, signOut } = useAuth()
  const betaSignups = useBetaSignupCount()

  // Use centralized goal progress calculation
  const goalProgress = useGoalProgress(primaryGoal)
  const [dailyTip, setDailyTip] = useState(
    "Focus on your breathing rhythm today. Try the 3:2 pattern - inhale for 3 steps, exhale for 2 steps. This will help you maintain a steady pace!",
  )

  const [recoverySnapshot, setRecoverySnapshot] = useState<RecoveryScore | null>(null)
  const [recoveryTrend, setRecoveryTrend] = useState<{ delta: number; direction: 'up' | 'down' | 'flat' } | null>(null)
  const [coachConfidence, setCoachConfidence] = useState<CoachConfidenceResult | null>(null)
  const [isLoadingRecovery, setIsLoadingRecovery] = useState(false)

  const [showWorkoutBreakdown, setShowWorkoutBreakdown] = useState(false)
  const [todaysWorkout, setTodaysWorkout] = useState<Workout | null>(null)
  const [isLoadingWorkout, setIsLoadingWorkout] = useState(true)
  const [structuredWorkout, setStructuredWorkout] = useState<StructuredWorkout | null>(null)
  const [engineGoalProgress, setEngineGoalProgress] = useState<GoalProgress | null>(null)
  const [visibleWorkouts, setVisibleWorkouts] = useState<Workout[]>([])
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showAddRunModal, setShowAddRunModal] = useState(false)
  const [showAddActivityModal, setShowAddActivityModal] = useState(false)
  const [showRouteSelectorModal, setShowRouteSelectorModal] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null)
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [showDateWorkoutModal, setShowDateWorkoutModal] = useState(false)
  const [selectedDateWorkout, setSelectedDateWorkout] = useState<any>(null)
  const [activeChallenge, setActiveChallenge] = useState<{ progress: ChallengeProgress; template: ChallengeTemplate; dailyData: DailyChallengeData } | null>(null)
  const [workoutToDelete, setWorkoutToDelete] = useState<number | null>(null)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date())
  const { toast } = useToast()
  const [showWeeklyRecapNotification, setShowWeeklyRecapNotification] = useState(false)
  const [recapOpenSignal, setRecapOpenSignal] = useState(0)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authModalTab, setAuthModalTab] = useState<'signup' | 'login'>('signup')
  const [isGarminFitSyncing, setIsGarminFitSyncing] = useState(false)
  const [garminSyncError, setGarminSyncError] = useState<string | null>(null)
  const [isGarminConnected, setIsGarminConnected] = useState(false)
  const [authStorageKey, setAuthStorageKey] = useState<string | null>(null)
  const [storedAuthEmail, setStoredAuthEmail] = useState<string | null>(null)
  const [storedAuthUserId, setStoredAuthUserId] = useState<string | null>(null)
  const [localAuthEmail, setLocalAuthEmail] = useState<string | null>(null)
  const [localAuthUserId, setLocalAuthUserId] = useState<string | null>(null)
  const [authSnapshotChecked, setAuthSnapshotChecked] = useState(false)

  const accountName = localUser?.name?.trim()
  const accountShortName = accountName ? accountName.split(' ')[0] : null
  const accountHeadline = accountShortName
    ? `${accountShortName}, be among the first!`
    : "Be Among the First!"
  const registeredHeadline = accountShortName
    ? `Welcome back, ${accountShortName}`
    : "RunSmart account active"
  const registeredEmail = authUser?.email ?? storedAuthEmail ?? localAuthEmail
  const isRegistered = Boolean(
    authUser ||
      profileId ||
      storedAuthUserId ||
      storedAuthEmail ||
      localAuthUserId ||
      localAuthEmail
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)/)?.[1] ?? null
    const storageKey = projectRef ? `sb-${projectRef}-auth-token` : null

    setAuthStorageKey(storageKey)

    const loadLocalHint = () => {
      try {
        setLocalAuthEmail(localStorage.getItem('runsmart_auth_email'))
        setLocalAuthUserId(localStorage.getItem('runsmart_auth_user_id'))
      } catch {
        setLocalAuthEmail(null)
        setLocalAuthUserId(null)
      }
    }

    if (!storageKey) {
      setStoredAuthEmail(null)
      setStoredAuthUserId(null)
      loadLocalHint()
      setAuthSnapshotChecked(true)
      return
    }

    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) {
        setStoredAuthEmail(null)
        setStoredAuthUserId(null)
        loadLocalHint()
        setAuthSnapshotChecked(true)
        return
      }

      const parsed = JSON.parse(raw)
      setStoredAuthEmail(parsed?.user?.email ?? null)
      setStoredAuthUserId(parsed?.user?.id ?? null)
      loadLocalHint()
      setAuthSnapshotChecked(true)
    } catch {
      setStoredAuthEmail(null)
      setStoredAuthUserId(null)
      loadLocalHint()
      setAuthSnapshotChecked(true)
    }
  }, [authUser, authLoading])

  // Check Garmin connection status
  useEffect(() => {
    if (!userId) return
    let mounted = true
    void db.wearableDevices
      .where('[userId+type]' as any)
      .equals([userId, 'garmin'])
      .first()
      .then((device) => {
        if (mounted) setIsGarminConnected(!!device && device.connectionStatus !== 'disconnected')
      })
      .catch(() => { /* ignore */ })
    return () => { mounted = false }
  }, [userId])

  const tips = [
    "Focus on your breathing rhythm today. Try the 3:2 pattern - inhale for 3 steps, exhale for 2 steps.",
    "Remember to warm up with 5 minutes of walking before starting your run. This helps prevent injury.",
    "Stay hydrated! Drink water throughout the day, not just during your run.",
    "Listen to your body. If something feels wrong, it's okay to take a rest day. Recovery is part of training too.",
    "Consistency beats intensity. Show up regularly, even if it's just a short run.",
    "Track your progress! Celebrate small wins - every kilometer counts towards your goal.",
  ]

  const getDaysRemaining = (goal?: Goal | null) => {
    if (!goal?.timeBound?.deadline) return null
    const deadline = new Date(goal.timeBound.deadline)
    const diff = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return diff < 0 ? 0 : diff
  }

  const refreshTip = () => {
    const currentIndex = tips.indexOf(dailyTip)
    const nextIndex = (currentIndex + 1) % tips.length
    setDailyTip(tips.at(nextIndex) ?? tips[0] ?? dailyTip)
  }

  const handleGarminFitSync = async () => {
    if (!userId) return
    setIsGarminFitSyncing(true)
    setGarminSyncError(null)
    try {
      const res = await fetch('/api/garmin/sync-fit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = (await res.json()) as { processed?: number; message?: string; error?: string; code?: string }

      if (!res.ok) {
        if (data.code === 'not_connected') return // Garmin not linked - silently skip
        setGarminSyncError(data.error ?? 'Unknown error')
        toast({ title: 'Sync failed', description: data.error ?? 'Unknown error', variant: 'destructive' })
        return
      }

      toast({ title: data.processed ? 'Run synced!' : 'Up to date', description: data.message })
      setGarminSyncError(null)
      if (data.processed) await refreshContext()
    } catch {
      setGarminSyncError('Could not reach server. Please try again.')
      toast({ title: 'Sync failed', description: 'Could not reach server. Please try again.', variant: 'destructive' })
    } finally {
      setIsGarminFitSyncing(false)
    }
  }

  const getRecoveryLabel = (score: number) => {
    if (score >= 80) return 'Excellent'
    if (score >= 65) return 'Good'
    if (score >= 50) return 'Fair'
    return 'Low'
  }

  const getRecoveryRecommendation = (score: number) => {
    if (score >= 80) return 'Ready for quality training'
    if (score >= 65) return 'Moderate training is OK'
    if (score >= 50) return 'Take it easy today'
    return 'Prioritize recovery'
  }

  // Initialize local data (todaysWorkout and visibleWorkouts are screen-specific)
  useEffect(() => {
    const initializeLocalData = async () => {
      if (!userId) {
        setIsLoadingWorkout(false)
        return
      }

      try {
        const today = new Date()

        // Get workouts for the visible 7-day strip (today -3 ... today +3)
        const stripStart = new Date(today)
        stripStart.setDate(today.getDate() - 3)
        stripStart.setHours(0, 0, 0, 0)
        const stripEnd = new Date(today)
        stripEnd.setDate(today.getDate() + 3)
        stripEnd.setHours(23, 59, 59, 999)

        const [stripWorkouts, todayWorkout] = await Promise.all([
          dbUtils.getWorkoutsForDateRange(userId, stripStart, stripEnd, { planScope: "active" }),
          dbUtils.getTodaysWorkout(userId),
        ])

        setVisibleWorkouts(stripWorkouts)
        setTodaysWorkout(todayWorkout)
        setIsLoadingWorkout(false)
      } catch (error) {
        console.error("Error initializing local data:", error)
        setIsLoadingWorkout(false)
      }
    }

    initializeLocalData()
  }, [userId])

  const loadChallengeData = useCallback(async () => {
    if (!userId) {
      setActiveChallenge(null)
      return
    }

    try {
      const challenge = await getActiveChallenge(userId)
      setActiveChallenge(challenge)
    } catch (error) {
      console.error("Error loading challenge data:", error)
      setActiveChallenge(null)
    }
  }, [userId])

  // Load active challenge data
  useEffect(() => {
    void loadChallengeData()
  }, [loadChallengeData])

  // Keep challenge tracker fresh after run completion or challenge updates
  useEffect(() => {
    const handleChallengeRefresh = () => {
      void loadChallengeData()
    }

    window.addEventListener("run-saved", handleChallengeRefresh)
    window.addEventListener("challenge-updated", handleChallengeRefresh)
    return () => {
      window.removeEventListener("run-saved", handleChallengeRefresh)
      window.removeEventListener("challenge-updated", handleChallengeRefresh)
    }
  }, [loadChallengeData])

  useEffect(() => {
    let cancelled = false

    const loadRecoverySummary = async () => {
      if (!userId) {
        setRecoverySnapshot(null)
        setCoachConfidence(null)
        setRecoveryTrend(null)
        return
      }

      try {
        setIsLoadingRecovery(true)
        const today = new Date()
        let score = await RecoveryEngine.getRecoveryScore(userId, today)
        if (!score) {
          score = await RecoveryEngine.calculateRecoveryScore(userId, today)
        }

        const trends = await RecoveryEngine.getRecoveryTrends(userId, 7)
        const sortedTrends = trends.slice().sort((a, b) => {
          const aDate = (a.scoreDate ?? a.date ?? a.createdAt) as Date
          const bDate = (b.scoreDate ?? b.date ?? b.createdAt) as Date
          return bDate.getTime() - aDate.getTime()
        })
        const current = sortedTrends.at(0)
        const previous = sortedTrends.at(1)
        const delta = current && previous ? current.overallScore - previous.overallScore : 0
        const direction = delta > 2 ? 'up' : delta < -2 ? 'down' : 'flat'

        const confidence = await calculateCoachConfidence(userId, today)

        if (!cancelled) {
          setRecoverySnapshot(score)
          setRecoveryTrend({ delta, direction })
          setCoachConfidence(confidence)
        }

        void trackAnalyticsEvent('recovery_checked', {
          recovery_score: score?.overallScore ?? null,
          coach_confidence: confidence.confidence,
        })
      } catch (error) {
        console.error('Failed to load recovery summary:', error)
      } finally {
        if (!cancelled) {
          setIsLoadingRecovery(false)
        }
      }
    }

    void loadRecoverySummary()

    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    if (!ENABLE_WEEKLY_RECAP || !userId) return;
    if (shouldShowWeeklyRecapNotification()) {
      setShowWeeklyRecapNotification(true);
      markRecapNotificationShown();
      void trackAnalyticsEvent("weekly_recap_notification_shown", {
        notification_type: "monday_morning",
      });
    }
  }, [userId]);

  // Load structured workout with pace zones when todaysWorkout changes
  useEffect(() => {
    const loadStructuredWorkout = async () => {
      console.log("[TodayScreen] loadStructuredWorkout called:", { todaysWorkout, userId })

      if (!todaysWorkout || !userId) {
        console.log("[TodayScreen] No workout or userId, clearing structuredWorkout")
        setStructuredWorkout(null)
        return
      }

      try {
        // Get user's pace zones (from VDOT or defaults)
        let paceZones = await getUserPaceZones(userId)
        console.log("[TodayScreen] Got pace zones:", paceZones ? "yes" : "null")

        if (!paceZones) {
          // Use defaults if no pace zones available
          console.log("[TodayScreen] Using default pace zones")
          paceZones = getDefaultPaceZones('intermediate')
        }

        // Get user experience level for workout structure
        const user = await dbUtils.getCurrentUser()
        const experience = user?.experience || 'intermediate'

        console.log("[TodayScreen] Generating structured workout:", {
          type: todaysWorkout.type,
          distance: todaysWorkout.distance,
          experience
        })

        // Generate structured workout
        const structured = generateStructuredWorkout(
          todaysWorkout.type,
          paceZones,
          todaysWorkout.distance,
          experience
        )

        console.log("[TodayScreen] Generated structured workout:", structured?.name)
        setStructuredWorkout(structured)
      } catch (error) {
        console.error("[TodayScreen] Error loading structured workout:", error)
        setStructuredWorkout(null)
      }
    }

    loadStructuredWorkout()
  }, [todaysWorkout, userId])

  // Load goal progress using GoalProgressEngine for consistency with Profile/Overview
  useEffect(() => {
    const loadGoalProgress = async () => {
      if (!primaryGoal?.id) {
        setEngineGoalProgress(null)
        return
      }

      try {
        const engine = new GoalProgressEngine()
        const progress = await engine.calculateGoalProgress(primaryGoal.id)
        setEngineGoalProgress(progress)
      } catch (error) {
        console.error("Error loading goal progress:", error)
        setEngineGoalProgress(null)
      }
    }

    loadGoalProgress()
  }, [primaryGoal])

  // Helper to get consistent goal progress
  const getGoalProgressPercent = (): number => {
    if (engineGoalProgress) {
      return engineGoalProgress.progressPercentage
    }
    return goalProgress // Fallback to hook value
  }

  // Helper to get goal trajectory
  const getGoalTrajectory = (): string | null => {
    return engineGoalProgress?.trajectory ?? null
  }

  const refreshWorkouts = async () => {
    try {
      const resolvedUserId = userId ?? (await dbUtils.getCurrentUser())?.id ?? null
      if (!resolvedUserId) return

      // Refresh context data (weeklyRuns, weeklyWorkouts, goals, etc.)
      await refreshContext()

      const today = new Date()

      const stripStart = new Date(today)
      stripStart.setDate(today.getDate() - 3)
      stripStart.setHours(0, 0, 0, 0)

      const stripEnd = new Date(today)
      stripEnd.setDate(today.getDate() + 3)
      stripEnd.setHours(23, 59, 59, 999)

      const [stripWorkouts, todayWorkout] = await Promise.all([
        dbUtils.getWorkoutsForDateRange(resolvedUserId, stripStart, stripEnd, { planScope: "active" }),
        dbUtils.getTodaysWorkout(resolvedUserId),
      ])

      setVisibleWorkouts(stripWorkouts)
      setTodaysWorkout(todayWorkout)
    } catch (error) {
      console.error("Error refreshing workouts:", error)
    }
  }

  const startRecordFlow = () => {
    try {
      window.dispatchEvent(new CustomEvent("navigate-to-record"))
    } catch {
      window.location.hash = "#record"
    }
  }

  // Calendar days
  const workoutColorMap: { [key: string]: string } = {
    easy: "bg-green-500",
    tempo: "bg-orange-500",
    intervals: "bg-pink-500",
    long: "bg-blue-500",
    rest: "bg-gray-400",
    "time-trial": "bg-red-500",
    hill: "bg-purple-500",
  }

  const resolveWorkoutForDate = async (date: Date) => {
    const matchesDate = (workout: Workout) =>
      new Date(workout.scheduledDate).toDateString() === date.toDateString()

    const cached = visibleWorkouts.find(matchesDate) || weeklyWorkouts.find(matchesDate)
    if (cached) return cached

    if (!userId) return null

    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(date)
    end.setHours(23, 59, 59, 999)

    const workouts = await dbUtils.getWorkoutsForDateRange(userId, start, end, { planScope: "active" })
    return workouts.find(matchesDate) ?? null
  }

  const calendarDays = Array.from({ length: 7 }, (_, i) => {
    const start = new Date()
    start.setDate(start.getDate() - 3)
    start.setHours(0, 0, 0, 0)
    const date = new Date(start)
    date.setDate(start.getDate() + i)

    const workout = visibleWorkouts.find(
      (w) => new Date(w.scheduledDate).toDateString() === date.toDateString(),
    )

    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      date: date.getDate(),
      fullDate: date,
      isToday: date.toDateString() === new Date().toDateString(),
      hasWorkout: !!workout,
      workoutColor: workout ? workoutColorMap[workout.type] : undefined,
      workoutType: workout?.type,
    }
  })

  const handleDateClick = async (day: any) => {
    const clickedDate = day.fullDate as Date
    setSelectedCalendarDate(clickedDate)

    const workout = await resolveWorkoutForDate(clickedDate)

    if (workout) {
      const workoutDate = new Date(workout.scheduledDate)
      setSelectedDateWorkout({
        id: workout.id,
        type: workout.type,
        distance: `${workout.distance}km`,
        completed: workout.completed,
        color: workoutColorMap[workout.type] || "bg-gray-500",
        date: workoutDate,
        dateString: workoutDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        }),
        notes: workout.notes,
      })
      setShowDateWorkoutModal(true)
      return
    }

    toast({
      title: "No workout scheduled",
      description: "Pick another day or add a workout to this date.",
    })
  }

  const handleRestartOnboarding = () => {
    setShowResetConfirm(true)
  }

  const confirmReset = () => {
    try {
      dbUtils.clearPlanCreationLocks()
      resetDatabaseInstance()
      localStorage.clear()
      window.location.href = "/"
    } catch (error) {
      console.error("Reset failed:", error)
      toast({
        title: "Reset failed",
        description: "Please refresh the page and try again.",
        variant: "destructive",
      })
    }
  }

  const handleRemoveWorkout = async () => {
    if (workoutToDelete !== null) {
      try {
        await dbUtils.deleteWorkout(workoutToDelete)
        await refreshWorkouts()
        toast({
          title: "Workout removed",
          description: "The workout has been removed from your plan.",
        })
        setWorkoutToDelete(null)
      } catch (error) {
        console.error("Error removing workout:", error)
        toast({
          title: "Error",
          description: "Failed to remove workout.",
          variant: "destructive",
        })
      }
    }
  }

  // Calculate progress stats
  const calculateStreak = () => {
    if (!weeklyWorkouts.length) return 0
    const sortedWorkouts = [...weeklyWorkouts]
      .filter((w) => w.completed && w.type !== "rest")
      .sort(
        (a, b) =>
          new Date(b.scheduledDate).getTime() -
          new Date(a.scheduledDate).getTime()
      )

    if (sortedWorkouts.length === 0) return 0

    let streak = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let i = 0; i < sortedWorkouts.length; i++) {
      const workout = sortedWorkouts.at(i)
      if (!workout) continue

      const workoutDate = new Date(workout.scheduledDate)
      workoutDate.setHours(0, 0, 0, 0)
      const daysDiff = Math.floor(
        (today.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysDiff === i) {
        streak++
      } else {
        break
      }
    }

    return streak
  }

  // Use stats from context for consistency
  const totalRuns = weeklyStats.runsCompleted
  const plannedRuns = weeklyStats.plannedWorkouts
  const consistency = weeklyStats.consistencyRate
  const streak = calculateStreak()
  const recoveryScoreValue = recoverySnapshot?.overallScore ?? 50
  const recoveryConfidenceValue = coachConfidence?.confidence ?? 0
  const recoveryNextStep = coachConfidence?.nextSteps?.[0] ?? 'Complete your morning check-in'
  const workoutDistanceLabel = todaysWorkout
    ? (todaysWorkout.distance && todaysWorkout.distance > 0
        ? `${todaysWorkout.distance} km`
        : todaysWorkout.duration && todaysWorkout.duration > 0
          ? `${todaysWorkout.duration} min`
          : '--')
    : '--'
  const workoutCoachCue = todaysWorkout
    ? ({
        easy: 'Keep your breathing easy and conversational.',
        tempo: 'Hold a steady strong effort, not an all-out sprint.',
        intervals: 'Run smooth repeats and recover fully between efforts.',
        long: 'Start controlled and finish relaxed with good form.',
        hill: 'Short stride, quick cadence, drive the arms uphill.',
        rest: 'Use this session for active recovery and mobility.',
        'time-trial': 'Settle early, then build effort in the final third.',
      }[todaysWorkout.type] ?? 'Focus on relaxed form and steady breathing.')
    : ''

  const handleRouteSelected = (route: Route) => {
    setSelectedRoute(route)
    setShowRouteSelectorModal(false)
    toast({
      title: "Route selected",
      description: route.name ? `Using ${route.name} for today's run` : "Route saved for your next run.",
    })
  }

  const handleViewRecapFromNotification = () => {
    setRecapOpenSignal((prev) => prev + 1)
    setShowWeeklyRecapNotification(false)
  }

  const openPlanScreen = () => {
    try {
      window.dispatchEvent(new CustomEvent("navigate-to-plan"))
    } catch {
      window.location.hash = "#plan"
    }
  }

  const latestRun = [...(weeklyRuns ?? [])]
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .at(0)

  const progressPoints = calendarDays.map((day) => {
    const workoutForDay =
      visibleWorkouts.find((w) => new Date(w.scheduledDate).toDateString() === day.fullDate.toDateString()) ??
      weeklyWorkouts.find((w) => new Date(w.scheduledDate).toDateString() === day.fullDate.toDateString()) ??
      null

    return {
      day: day.day.slice(0, 1) + day.day.slice(1).toLowerCase(),
      completion: workoutForDay ? (workoutForDay.completed ? 100 : day.isToday ? 45 : 0) : 0,
    }
  })

  const isRunDay = Boolean(todaysWorkout && todaysWorkout.type !== "rest")
  const primaryActionLabel = isRunDay ? "Start Run" : "Recovery Action"
  const dailyStatusLabel = isRunDay ? "Workout day" : "Recovery day"
  const dailyStatusTone = isRunDay ? "positive" as const : "info" as const
  const dailyHeadline = isRunDay
    ? `${todaysWorkout?.type ? `${todaysWorkout.type.charAt(0).toUpperCase()}${todaysWorkout.type.slice(1)}` : "Workout"} focus`
    : "Recovery and reset"
  const dailyCoachInsight = isRunDay
    ? workoutCoachCue || "Keep effort controlled and focus on smooth form."
    : getRecoveryRecommendation(recoveryScoreValue)

  const keyMetrics: KeyMetric[] = [
    {
      id: "readiness",
      label: "Readiness",
      value: `${recoveryScoreValue}`,
      unit: "/100",
      animatedValue: recoveryScoreValue,
      helper: recoveryScoreValue >= 65 ? "Higher than usual recovery baseline" : getRecoveryRecommendation(recoveryScoreValue),
      tone: recoveryScoreValue >= 65 ? "positive" : recoveryScoreValue < 50 ? "caution" : "default",
      trend:
        recoveryTrend?.direction === "up"
          ? "up"
          : recoveryTrend?.direction === "down"
            ? "down"
            : "stable",
      trendLabel: recoveryTrend?.direction === "up" ? "Rising" : recoveryTrend?.direction === "down" ? "Lower" : "Steady",
      meterValue: recoveryScoreValue,
    },
    {
      id: "weekly",
      label: "Weekly Progress",
      value: `${totalRuns}/${plannedRuns || 0}`,
      animatedValue: totalRuns,
      formatAnimatedValue: (value) => `${Math.round(value)}/${plannedRuns || 0}`,
      helper: totalRuns >= plannedRuns && plannedRuns > 0 ? "Completed all planned sessions" : "Completed vs planned runs this week",
      tone: totalRuns >= plannedRuns && plannedRuns > 0 ? "positive" : "default",
      trend: totalRuns >= plannedRuns && plannedRuns > 0 ? "up" : "stable",
      trendLabel: totalRuns >= plannedRuns && plannedRuns > 0 ? "On plan" : "In progress",
      meterValue: plannedRuns > 0 ? Math.round((totalRuns / plannedRuns) * 100) : 0,
    },
    {
      id: "consistency",
      label: "Consistency",
      value: `${consistency}%`,
      animatedValue: consistency,
      formatAnimatedValue: (value) => `${Math.round(value)}%`,
      helper: consistency >= 70 ? "You're on track this week" : "One extra session gets you back on track",
      tone: consistency >= 70 ? "positive" : "caution",
      trend: consistency >= 70 ? "up" : "down",
      trendLabel: consistency >= 70 ? "On track" : "Needs lift",
      meterValue: consistency,
    },
    {
      id: "confidence",
      label: "Coach Confidence",
      value: `${recoveryConfidenceValue}%`,
      animatedValue: recoveryConfidenceValue,
      formatAnimatedValue: (value) => `${Math.round(value)}%`,
      helper: recoveryNextStep,
      tone: recoveryConfidenceValue >= 70 ? "positive" : "default",
      trend: recoveryConfidenceValue >= 70 ? "up" : "stable",
      trendLabel: recoveryConfidenceValue >= 70 ? "Trusted" : "Limited",
      meterValue: recoveryConfidenceValue,
    },
  ]

  const coachInsights: CoachInsight[] = [
    {
      id: "insight-1",
      title: "Today focus",
      message: dailyCoachInsight,
      severity: isRunDay ? "action" : "good",
    },
    {
      id: "insight-2",
      title: "Consistency trend",
      message:
        consistency >= 75
          ? "You are building excellent training rhythm. Keep your routine consistent."
          : "A short quality session this week will improve consistency and momentum.",
      severity: consistency >= 75 ? "good" : "caution",
    },
    {
      id: "insight-3",
      title: "Data coverage",
      message: recoveryNextStep,
      severity: recoveryConfidenceValue >= 60 ? "good" : "action",
    },
  ]

  type DataQualityState = {
    tone: "info" | "warning" | "error" | "success"
    title: string
    description: string
    actionLabel?: string
    actionDisabled?: boolean
    action?: () => void
  } | null

  const dataQualityState: DataQualityState = (() => {
    if (!userId) {
      return {
        tone: "info" as const,
        title: "Profile setup incomplete",
        description: "Finish onboarding to unlock personalized readiness and workout guidance.",
        actionLabel: "Open Plan",
        actionDisabled: false,
        action: openPlanScreen,
      }
    }
    if (garminSyncError) {
      return {
        tone: "error" as const,
        title: "Sync issue detected",
        description: garminSyncError,
        actionLabel: "Retry sync",
        actionDisabled: false,
        action: () => void handleGarminFitSync(),
      }
    }
    if (recoveryConfidenceValue < 50) {
      return {
        tone: "warning" as const,
        title: "Partial data today",
        description: "Add sleep or wellness inputs to improve recommendation quality.",
        actionLabel: "Add Activity",
        actionDisabled: false,
        action: () => setShowAddActivityModal(true),
      }
    }
    if (isGarminConnected) {
      return {
        tone: "success" as const,
        title: "Device connected",
        description: "Garmin is connected and ready for sync.",
        actionLabel: isGarminFitSyncing ? "Syncing..." : "Sync Garmin",
        actionDisabled: isGarminFitSyncing,
        action: () => void handleGarminFitSync(),
      }
    }
    return null
  })()

  return (
    <div className="pb-44 space-y-5">
      <header className="px-4 pt-2">
        <div className="flex items-center justify-between">
          <RunSmartBrandMark className="opacity-90" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRestartOnboarding}
            className="gap-1.5 text-xs text-muted-foreground"
            aria-label="Reset onboarding"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </header>

      {showWeeklyRecapNotification && (
        <div className="px-4">
          <WeeklyRecapNotificationBanner
            onViewRecap={handleViewRecapFromNotification}
            onDismiss={() => setShowWeeklyRecapNotification(false)}
          />
        </div>
      )}

      <main className="space-y-4 px-4">
        <DailyFocusCard
          isLoading={isLoadingWorkout}
          dateLabel={new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
          statusLabel={dailyStatusLabel}
          statusTone={dailyStatusTone}
          headline={dailyHeadline}
          coachInsight={dailyCoachInsight}
          primaryAction={{
            label: primaryActionLabel,
            onClick: isRunDay ? startRecordFlow : () => setShowAddActivityModal(true),
            disabled: isLoadingWorkout,
            icon: <Play className="h-4 w-4" />,
          }}
          secondaryActions={[
            {
              label: "View Plan",
              onClick: openPlanScreen,
              icon: <BarChart3 className="h-3.5 w-3.5" />,
            },
            {
              label: isGarminFitSyncing ? "Syncing" : "Sync",
              onClick: () => void handleGarminFitSync(),
              disabled: isGarminFitSyncing || !userId,
              icon: <RefreshCw className="h-3.5 w-3.5" />,
            },
          ]}
        />

        <DataQualityBanner
          tone={dataQualityState?.tone}
          title={dataQualityState?.title}
          description={dataQualityState?.description}
          actionLabel={dataQualityState?.actionLabel}
          actionDisabled={dataQualityState?.actionDisabled}
          onAction={dataQualityState?.action}
        />

        <KeyMetricsGrid metrics={keyMetrics} isLoading={isLoadingRecovery} />

        <ProgressSummaryChart
          data={progressPoints}
          progressPercent={plannedRuns > 0 ? (totalRuns / plannedRuns) * 100 : 0}
          summaryLabel={`${totalRuns} of ${plannedRuns || 0} planned runs completed`}
          isLoading={isLoadingWorkout}
        />

        <CoachInsightsPanel insights={coachInsights} isLoading={isLoadingRecovery} />

        {primaryGoal ? (
          <Card className="rounded-[1.25rem] border-border/70 bg-card/95 shadow-[0_20px_44px_-36px_rgba(16,24,40,0.55)]">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Active Goal</p>
                  <h2 className="mt-1 text-base font-semibold text-foreground">{primaryGoal.title}</h2>
                  <p className="text-sm text-muted-foreground">{primaryGoal.description}</p>
                </div>
                {getDaysRemaining(primaryGoal) !== null ? (
                  <Badge variant="outline">{getDaysRemaining(primaryGoal)} days left</Badge>
                ) : null}
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Goal progress</span>
                  <span>{Math.round(getGoalProgressPercent())}%</span>
                </div>
                <Progress value={Math.max(0, Math.min(100, getGoalProgressPercent()))} className="h-2" />
              </div>
            </CardContent>
          </Card>
        ) : null}

        {activeChallenge ? (
          <section aria-labelledby="today-challenge-heading" className="space-y-3">
            <h2 id="today-challenge-heading" className="text-sm font-semibold text-foreground">
              Challenge
            </h2>
            <ChallengeProgressRing
              data={activeChallenge.dailyData}
              challengeName={activeChallenge.template.name}
              showDetails={true}
            />
            <DailyChallengePrompt template={activeChallenge.template} timing="before" />
          </section>
        ) : null}

        <section aria-labelledby="today-plan-activities-heading" className="space-y-3.5">
          <h2 id="today-plan-activities-heading" className="text-sm font-semibold text-foreground">
            Plan and activities
          </h2>
          <TodayWorkoutCard
            isLoading={isLoadingWorkout}
            workout={todaysWorkout}
            structuredWorkout={structuredWorkout}
            selectedRoute={selectedRoute}
            workoutDistanceLabel={workoutDistanceLabel}
            workoutCoachCue={workoutCoachCue}
            goalProgressPercent={getGoalProgressPercent()}
            showBreakdown={showWorkoutBreakdown}
            onToggleBreakdown={() => setShowWorkoutBreakdown((prev) => !prev)}
            onStartRun={startRecordFlow}
            onSelectRoute={() => setShowRouteSelectorModal(true)}
          />

          <Card className="rounded-[1.15rem] border-border/70 bg-card/95 shadow-[0_18px_36px_-30px_rgba(16,24,40,0.5)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {latestRun ? (
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Distance</p>
                    <p className="font-semibold text-foreground">{latestRun.distance.toFixed(1)} km</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="font-semibold text-foreground">{Math.max(1, Math.round((latestRun.duration || 0) / 60))} min</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">RPE</p>
                    <p className="font-semibold text-foreground">{typeof latestRun.rpe === "number" ? `${latestRun.rpe}/10` : "--"}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No recent run data yet. Record your first run to see trends.</p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" className="h-11" onClick={() => setShowAddRunModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Run
            </Button>
            <Button variant="outline" className="h-11" onClick={() => setShowAddActivityModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Activity
            </Button>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/90 p-2 shadow-[0_16px_32px_-30px_rgba(16,24,40,0.45)]">
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
              {calendarDays.map((day, index) => {
                const isSelected = day.fullDate.toDateString() === selectedCalendarDate.toDateString()
                return (
                  <button
                    key={index}
                    onClick={() => void handleDateClick(day)}
                    className={`min-h-14 min-w-[62px] rounded-xl px-2 py-1 text-center text-xs transition ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "border border-border/70 bg-background text-foreground"
                    }`}
                  >
                    <p className="uppercase tracking-[0.08em]">{day.day.slice(0, 2)}</p>
                    <p className="mt-1 text-base font-semibold">{day.date}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <AdvancedAnalyticsAccordion
          sections={[
            {
              id: "readiness-panels",
              title: "Readiness, load, and consistency details",
              description: "Deep diagnostics for recovery, load, and progression.",
              content: userId ? (
                <div className="space-y-3 pt-2">
                  <WeeklyGoalCard userId={userId} runsCompleted={totalRuns} plannedRuns={plannedRuns} />
                  <PlanAdjustmentNotice userId={userId} />
                  <InsightsPanelsDashboard
                    userId={userId}
                    runsCompleted={totalRuns}
                    plannedRuns={plannedRuns}
                    consistencyRate={consistency}
                    goalProgress={getGoalProgressPercent()}
                    goalTrajectory={getGoalTrajectory() ?? null}
                  />
                </div>
              ) : (
                <p className="pt-2 text-sm text-muted-foreground">Complete onboarding to unlock analytics.</p>
              ),
            },
            {
              id: "widgets",
              title: "Additional coaching widgets",
              description: "Optional habits, community, and recommendation panels.",
              content: (
                <div className="space-y-3 pt-2">
                  {ENABLE_WEEKLY_RECAP && userId ? (
                    <WeeklyRecapWidget userId={userId} openRecapSignal={recapOpenSignal} />
                  ) : null}
                  <Card className="border-border/70">
                    <CardContent className="flex items-start justify-between gap-3 p-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Coach tip</p>
                        <p className="mt-1 text-sm text-foreground">{dailyTip}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={refreshTip} aria-label="Refresh coach tip">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                  {userId ? <HabitAnalyticsWidget userId={userId} showDetails={false} /> : null}
                  {userId ? <GoalRecommendations userId={userId} /> : null}
                  {userId ? <CommunityStatsWidget userId={userId} /> : null}
                </div>
              ),
            },
            {
              id: "sync-account",
              title: "Sync and account",
              description: "Device sync health and account access state.",
              content: (
                <div className="space-y-3 pt-2">
                  <Card className="border-border/70">
                    <CardContent className="space-y-3 p-4">
                      <SyncStatusIndicator />
                      {isGarminConnected ? (
                        <Button
                          variant="outline"
                          className="w-full gap-2"
                          onClick={() => void handleGarminFitSync()}
                          disabled={isGarminFitSyncing}
                        >
                          {isGarminFitSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                          {isGarminFitSyncing ? "Syncing..." : "Sync Garmin"}
                        </Button>
                      ) : (
                        <p className="text-xs text-muted-foreground">No connected Garmin device found for this account.</p>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="border-border/70">
                    <CardContent className="space-y-3 p-4">
                      {authLoading || !authSnapshotChecked ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Checking account status...
                        </div>
                      ) : isRegistered ? (
                        <>
                          <div>
                            <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Account active</p>
                            <p className="mt-1 text-sm font-medium text-foreground">
                              {registeredEmail ? `Signed in as ${registeredEmail}` : registeredHeadline}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            onClick={async () => {
                              try {
                                await signOut()
                                if (authStorageKey) {
                                  localStorage.removeItem(authStorageKey)
                                }
                                setStoredAuthEmail(null)
                                setStoredAuthUserId(null)
                                try {
                                  localStorage.removeItem("runsmart_auth_user_id")
                                  localStorage.removeItem("runsmart_auth_email")
                                  localStorage.removeItem("runsmart_auth_at")
                                } catch {
                                  // ignore
                                }
                                setLocalAuthEmail(null)
                                setLocalAuthUserId(null)
                                toast({
                                  title: "Signed out",
                                  description: "You've been signed out successfully",
                                })
                              } catch {
                                toast({
                                  title: "Error",
                                  description: "Failed to sign out. Please try again.",
                                  variant: "destructive",
                                })
                              }
                            }}
                          >
                            <LogOut className="mr-2 h-4 w-4" />
                            Sign Out
                          </Button>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-muted-foreground">
                            {accountHeadline} Create an account to sync activity across devices.
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              onClick={() => {
                                trackAnalyticsEvent("early_access_cta_clicked", {
                                  source: "today_screen_account",
                                  action: "signup",
                                  variant: "redesign_v1",
                                  user_type: accountShortName ? "returning" : "new",
                                  signup_count: betaSignups.count,
                                })
                                setAuthModalTab("signup")
                                setShowAuthModal(true)
                              }}
                            >
                              <UserPlus className="mr-2 h-4 w-4" />
                              Sign Up
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                trackAnalyticsEvent("early_access_cta_clicked", {
                                  source: "today_screen_account",
                                  action: "login",
                                  variant: "redesign_v1",
                                  user_type: accountShortName ? "returning" : "new",
                                })
                                setAuthModalTab("login")
                                setShowAuthModal(true)
                              }}
                            >
                              <LogIn className="mr-2 h-4 w-4" />
                              Log In
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ),
            },
          ]}
        />
      </main>

      <div className="fixed bottom-[5.4rem] left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 px-4">
        <Card className="border-border/70 bg-background/95 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur">
          <CardContent className="grid grid-cols-3 gap-2 p-2">
            <Button
              className="h-10 text-xs"
              onClick={isRunDay ? startRecordFlow : () => setShowAddActivityModal(true)}
              aria-label={isRunDay ? "Start run from sticky actions" : "Open recovery action"}
            >
              <Play className="mr-1 h-3.5 w-3.5" />
              {isRunDay ? "Start" : "Recover"}
            </Button>
            <Button variant="outline" className="h-10 text-xs" onClick={openPlanScreen} aria-label="Open training plan">
              Plan
            </Button>
            <Button
              variant="outline"
              className="h-10 text-xs"
              onClick={() => void handleGarminFitSync()}
              disabled={!userId || isGarminFitSyncing}
              aria-label="Sync device data"
            >
              {isGarminFitSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Sync"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        defaultTab={authModalTab}
      />

      {/* Modals - wrapped with error boundaries to prevent app crashes */}
      <ModalErrorBoundary modalName="Add Run" onClose={() => setShowAddRunModal(false)}>
        <AddRunModal
          open={showAddRunModal}
          onOpenChange={setShowAddRunModal}
          onRunAdded={refreshWorkouts}
        />
      </ModalErrorBoundary>

      <ModalErrorBoundary modalName="Add Activity" onClose={() => setShowAddActivityModal(false)}>
        <AddActivityModal
          open={showAddActivityModal}
          onOpenChange={setShowAddActivityModal}
          onActivityAdded={refreshWorkouts}
        />
      </ModalErrorBoundary>

      <ModalErrorBoundary modalName="Route Selector" onClose={() => setShowRouteSelectorModal(false)}>
        <RouteSelectorModal
          isOpen={showRouteSelectorModal}
          onClose={() => setShowRouteSelectorModal(false)}
          onRouteSelected={handleRouteSelected}
        />
      </ModalErrorBoundary>

      <ModalErrorBoundary modalName="Reschedule" onClose={() => setShowRescheduleModal(false)}>
        <RescheduleModal
          isOpen={showRescheduleModal}
          onClose={() => setShowRescheduleModal(false)}
        />
      </ModalErrorBoundary>

      <ModalErrorBoundary
        modalName="Date Workout"
        onClose={() => {
          setShowDateWorkoutModal(false)
          setSelectedDateWorkout(null)
        }}
      >
        <DateWorkoutModal
          isOpen={showDateWorkoutModal}
          onClose={() => {
            setShowDateWorkoutModal(false)
            setSelectedDateWorkout(null)
          }}
          workout={selectedDateWorkout}
        />
      </ModalErrorBoundary>
      {/*
      Adaptive coaching removed from Today screen.
      (Coaching insights, recovery recommendations, and coaching preferences modal)
      */}
      {/*
      {showCoachingPreferences && userId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-lg font-semibold">Coaching Preferences</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCoachingPreferences(false)}
                aria-label="Close coaching preferences"
              >
                ×
              </Button>
            </div>
            <div className="p-4">
              <CoachingPreferencesSettings
                userId={userId}
                onClose={() => setShowCoachingPreferences(false)}
              />
            </div>
          </div>
        </div>
      )}
      <CoachingFeedbackModal
        isOpen={showCoachingFeedback}
        onClose={() => setShowCoachingFeedback(false)}
        interactionType="workout_recommendation"
        userId={userId || 0}
      />
      */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Onboarding?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all your data and restart the onboarding process.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={workoutToDelete !== null}
        onOpenChange={() => setWorkoutToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Workout?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this workout from your plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveWorkout}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

