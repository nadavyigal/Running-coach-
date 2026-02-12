"use client";

import { useState, useEffect, useMemo } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Sun,
  Clock,
  Plus,
  MapPin,
  Play,
  ChevronDown,
  ChevronUp,
  Zap,
  StretchHorizontal,
  Loader2,
  Flame,
  BarChart3,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Award,
  LogIn,
  LogOut,
  UserPlus,
  Users,
} from "lucide-react"
import ModalErrorBoundary from "@/components/modal-error-boundary"
import { type Workout, type Route, type Goal, type RecoveryScore, resetDatabaseInstance } from "@/lib/db"
import { dbUtils, getUserPaceZones } from "@/lib/dbUtils"
import { useData, useGoalProgress } from "@/contexts/DataContext"
import { generateStructuredWorkout, type StructuredWorkout } from "@/lib/workout-steps"
import { getDefaultPaceZones } from "@/lib/pace-zones"
import type { GoalProgress } from "@/lib/goalProgressEngine"
import { useToast } from "@/hooks/use-toast"
import { markRecapNotificationShown, shouldShowWeeklyRecapNotification } from "@/lib/weekly-recap-scheduler"
import { trackAnalyticsEvent } from "@/lib/analytics"
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
import { useBetaSignupCount } from "@/lib/hooks/useBetaSignupCount"
import { RunSmartBrandMark } from "@/components/run-smart-brand-mark"
import { ChallengeProgressRing } from "@/components/challenge-progress-ring"
import { DailyChallengePrompt } from "@/components/daily-challenge-prompt"
import { getActiveChallenge, getDailyChallengeData } from "@/lib/challengeEngine"
import type { ChallengeProgress, ChallengeTemplate } from "@/lib/db"
import type { DailyChallengeData } from "@/lib/challengeEngine"
import type { CoachConfidenceResult } from "@/lib/coach-confidence"

const DAILY_TIPS = [
  "Focus on your breathing rhythm today. Try the 3:2 pattern - inhale for 3 steps, exhale for 2 steps.",
  "Remember to warm up with 5 minutes of walking before starting your run. This helps prevent injury.",
  "Stay hydrated! Drink water throughout the day, not just during your run.",
  "Listen to your body. If something feels wrong, it's okay to take a rest day. Recovery is part of training too.",
  "Consistency beats intensity. Show up regularly, even if it's just a short run.",
  "Track your progress! Celebrate small wins - every kilometer counts towards your goal.",
]

const WORKOUT_COLOR_MAP: Record<string, string> = {
  easy: "bg-primary",
  tempo: "bg-orange-500",
  intervals: "bg-pink-500",
  long: "bg-blue-500",
  rest: "bg-border",
  "time-trial": "bg-red-500",
  hill: "bg-purple-500",
}

const AddRunModal = dynamic(
  () => import("@/components/add-run-modal").then((module) => ({ default: module.AddRunModal })),
  { ssr: false, loading: () => null },
)
const AddActivityModal = dynamic(
  () => import("@/components/add-activity-modal").then((module) => ({ default: module.AddActivityModal })),
  { ssr: false, loading: () => null },
)
const RouteSelectorModal = dynamic(
  () => import("@/components/route-selector-modal").then((module) => ({ default: module.RouteSelectorModal })),
  { ssr: false, loading: () => null },
)
const RescheduleModal = dynamic(
  () => import("@/components/reschedule-modal").then((module) => ({ default: module.RescheduleModal })),
  { ssr: false, loading: () => null },
)
const DateWorkoutModal = dynamic(
  () => import("@/components/date-workout-modal").then((module) => ({ default: module.DateWorkoutModal })),
  { ssr: false, loading: () => null },
)
const WorkoutPhasesDisplay = dynamic(
  () => import("@/components/workout-phases-display").then((module) => ({ default: module.WorkoutPhasesDisplay })),
  { ssr: false, loading: () => null },
)
const CommunityStatsWidget = dynamic(
  () => import("@/components/community-stats-widget").then((module) => ({ default: module.CommunityStatsWidget })),
  { ssr: false, loading: () => null },
)
const GoalRecommendations = dynamic(
  () => import("@/components/goal-recommendations").then((module) => ({ default: module.GoalRecommendations })),
  { ssr: false, loading: () => null },
)
const HabitAnalyticsWidget = dynamic(
  () => import("@/components/habit-analytics-widget").then((module) => ({ default: module.HabitAnalyticsWidget })),
  { ssr: false, loading: () => null },
)
const WeeklyRecapNotificationBanner = dynamic(
  () => import("@/components/weekly-recap-notification-banner").then((module) => ({ default: module.WeeklyRecapNotificationBanner })),
  { ssr: false, loading: () => null },
)
const WeeklyRecapWidget = dynamic(
  () => import("@/components/weekly-recap-widget").then((module) => ({ default: module.WeeklyRecapWidget })),
  { ssr: false, loading: () => null },
)
const AuthModal = dynamic(
  () => import("@/components/auth/auth-modal").then((module) => ({ default: module.AuthModal })),
  { ssr: false, loading: () => null },
)
const SyncStatusIndicator = dynamic(
  () => import("@/components/sync-status-indicator").then((module) => ({ default: module.SyncStatusIndicator })),
  { ssr: false, loading: () => null },
)

export function TodayScreen() {
  // Get shared data from context
  const {
    user: localUser,
    userId,
    plan,
    primaryGoal,
    weeklyWorkouts,
    weeklyStats,
    refresh: refreshContext,
  } = useData()
  const { user: authUser, profileId, loading: authLoading, signOut } = useAuth()
  const betaSignups = useBetaSignupCount()

  // Use centralized goal progress calculation
  const goalProgress = useGoalProgress(primaryGoal)
  const [dailyTip, setDailyTip] = useState(() => DAILY_TIPS[0] ?? "Focus on your breathing rhythm today.")

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
  const [activeChallenge, setActiveChallenge] = useState<{ progress: ChallengeProgress; template: ChallengeTemplate } | null>(null)
  const [dailyChallengeData, setDailyChallengeData] = useState<DailyChallengeData | null>(null)
  const [workoutToDelete, setWorkoutToDelete] = useState<number | null>(null)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(() => new Date())
  const { toast } = useToast()
  const [showWeeklyRecapNotification, setShowWeeklyRecapNotification] = useState(false)
  const [recapOpenSignal, setRecapOpenSignal] = useState(0)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authModalTab, setAuthModalTab] = useState<'signup' | 'login'>('signup')
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

  const getDaysRemaining = (goal?: Goal | null) => {
    if (!goal?.timeBound?.deadline) return null
    const deadline = new Date(goal.timeBound.deadline)
    const diff = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return diff < 0 ? 0 : diff
  }

  const refreshTip = () => {
    const currentIndex = DAILY_TIPS.indexOf(dailyTip)
    const nextIndex = (currentIndex + 1) % DAILY_TIPS.length
    setDailyTip(DAILY_TIPS.at(nextIndex) ?? DAILY_TIPS[0] ?? dailyTip)
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
          dbUtils.getWorkoutsForDateRange(userId, stripStart, stripEnd),
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

  // Load active challenge data
  useEffect(() => {
    const loadChallengeData = async () => {
      if (!userId) {
        setActiveChallenge(null)
        setDailyChallengeData(null)
        return
      }

      try {
        const challenge = await getActiveChallenge(userId)

        if (challenge) {
          setActiveChallenge(challenge)

          // Get daily challenge data for today
          const dailyData = getDailyChallengeData(
            challenge.progress,
            challenge.template
          )
          setDailyChallengeData(dailyData)
        } else {
          setActiveChallenge(null)
          setDailyChallengeData(null)
        }
      } catch (error) {
        console.error("Error loading challenge data:", error)
        setActiveChallenge(null)
        setDailyChallengeData(null)
      }
    }

    loadChallengeData()
  }, [userId])

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
        const [{ RecoveryEngine }, { calculateCoachConfidence }] = await Promise.all([
          import('@/lib/recoveryEngine'),
          import('@/lib/coach-confidence'),
        ])

        let score = await RecoveryEngine.getRecoveryScore(userId, today)
        if (!score) {
          score = await RecoveryEngine.calculateRecoveryScore(userId, today)
        }

        const [trends, confidence] = await Promise.all([
          RecoveryEngine.getRecoveryTrends(userId, 7),
          calculateCoachConfidence(userId, today),
        ])
        const sortedTrends = trends.slice().sort((a, b) => {
          const aDate = (a.scoreDate ?? a.date ?? a.createdAt) as Date
          const bDate = (b.scoreDate ?? b.date ?? b.createdAt) as Date
          return bDate.getTime() - aDate.getTime()
        })
        const current = sortedTrends.at(0)
        const previous = sortedTrends.at(1)
        const delta = current && previous ? current.overallScore - previous.overallScore : 0
        const direction = delta > 2 ? 'up' : delta < -2 ? 'down' : 'flat'

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
        const [paceZonesResult, user] = await Promise.all([
          getUserPaceZones(userId),
          dbUtils.getCurrentUser(),
        ])
        let paceZones = paceZonesResult
        console.log("[TodayScreen] Got pace zones:", paceZones ? "yes" : "null")

        if (!paceZones) {
          // Use defaults if no pace zones available
          console.log("[TodayScreen] Using default pace zones")
          paceZones = getDefaultPaceZones('intermediate')
        }

        // Get user experience level for workout structure
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
        const { GoalProgressEngine } = await import("@/lib/goalProgressEngine")
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
        dbUtils.getWorkoutsForDateRange(resolvedUserId, stripStart, stripEnd),
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

    const workouts = await dbUtils.getWorkoutsForDateRange(userId, start, end)
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
      workoutColor: workout ? WORKOUT_COLOR_MAP[workout.type] : undefined,
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
        color: WORKOUT_COLOR_MAP[workout.type] || "bg-[oklch(var(--surface-2))]0",
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

  // Use stats from context for consistency
  const totalRuns = weeklyStats.runsCompleted
  const plannedRuns = weeklyStats.plannedWorkouts
  const consistency = weeklyStats.consistencyRate
  const streak = useMemo(() => {
    if (!weeklyWorkouts.length) return 0
    const sortedWorkouts = [...weeklyWorkouts]
      .filter((w) => w.completed && w.type !== "rest")
      .sort(
        (a, b) =>
          new Date(b.scheduledDate).getTime() -
          new Date(a.scheduledDate).getTime()
      )

    if (sortedWorkouts.length === 0) return 0

    let count = 0
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
        count++
      } else {
        break
      }
    }

    return count
  }, [weeklyWorkouts])
  const recoveryScoreValue = recoverySnapshot?.overallScore ?? 50
  const recoveryConfidenceValue = coachConfidence?.confidence ?? 0
  const recoveryNextStep = coachConfidence?.nextSteps?.[0] ?? 'Complete your morning check-in'

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

  return (
    <div className="pb-24 space-y-4">
      <div className="px-4 pt-2">
        <RunSmartBrandMark className="opacity-90" />
      </div>
      {showWeeklyRecapNotification && (
        <div className="px-4 animate-in fade-in-0 slide-in-from-top-4 duration-300">
          <WeeklyRecapNotificationBanner
            onViewRecap={handleViewRecapFromNotification}
            onDismiss={() => setShowWeeklyRecapNotification(false)}
          />
        </div>
      )}
      {activeChallenge && dailyChallengeData && (
        <div className="px-4 space-y-4">
          <ChallengeProgressRing
            data={dailyChallengeData}
            challengeName={activeChallenge.template.name}
            showDetails={true}
          />
          <DailyChallengePrompt
            template={activeChallenge.template}
            timing="before"
          />
        </div>
      )}
      {primaryGoal && (
        <div className="px-4">
          <Card className="border">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-primary">Active Goal</p>
                  <h3 className="text-lg font-bold text-foreground">{primaryGoal.title}</h3>
                  <p className="text-sm text-foreground/70">{primaryGoal.description}</p>
                </div>
                <div className="text-right">
                  {getDaysRemaining(primaryGoal) !== null && (
                    <Badge variant="secondary" className="text-xs">
                      {getDaysRemaining(primaryGoal)} days remaining
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-foreground/70 mb-1">
                  <span>Progress</span>
                  <div className="flex items-center gap-2">
                    <span>{Math.round(getGoalProgressPercent())}%</span>
                    {getGoalTrajectory() && (
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize ${
                          getGoalTrajectory() === 'ahead' ? 'text-primary border-primary/30' :
                          getGoalTrajectory() === 'on_track' ? 'text-blue-600 border-blue-300' :
                          getGoalTrajectory() === 'behind' ? 'text-amber-600 border-amber-300' :
                          'text-red-600 border-red-300'
                        }`}
                      >
                        {getGoalTrajectory()?.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                </div>
                <Progress value={getGoalProgressPercent()} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Header */}
      <div className="bg-white p-4 rounded-b-3xl shadow-sm">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-xs text-foreground/70 mb-1">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
            <h1 className="text-2xl font-bold text-foreground">
              {plan?.title || "Your Training"}
            </h1>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5 bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full">
              <Sun className="h-4 w-4" />
              <span className="text-xs font-semibold">22°C</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRestartOnboarding}
              className="gap-1 text-[10px] text-foreground/60 hover:text-foreground/70 h-auto py-1"
            >
              <RefreshCw className="h-2.5 w-2.5" />
              Reset
            </Button>
          </div>
        </div>

        {/* Streak & Weekly Progress */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-0 bg-gradient-energy text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
            <CardContent className="p-3 text-center">
              <Flame className="h-5 w-5 mx-auto mb-1.5 text-white/90" />
              <div className="text-3xl font-black mb-0.5 leading-none">
                {streak}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-white/90">DAY STREAK</div>
            </CardContent>
          </Card>
          <Card className="border-0 bg-gradient-focus text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
            <CardContent className="p-3 text-center">
              <BarChart3 className="h-5 w-5 mx-auto mb-1.5 text-white/90" />
              <div className="text-3xl font-black mb-0.5 leading-none">
                {totalRuns}/{plannedRuns}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-white/90">THIS WEEK</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {userId && (
        <div className="px-4">
          <Card className="relative overflow-hidden border-0">
            {/* Radial gradient background matching score color */}
            <div
              className={`absolute inset-0 ${
                recoveryScoreValue >= 80
                  ? 'bg-primary/10'
                  : recoveryScoreValue >= 65
                  ? 'bg-amber-100/60'
                  : 'bg-rose-100/60'
              }`}
            />
            <CardContent className="relative p-5">
              {/* Giant Circular Progress Ring */}
              <div className="flex flex-col items-center justify-center">
                <div className="relative">
                  {isLoadingRecovery ? (
                    <div className="w-36 h-36 flex items-center justify-center">
                      <Loader2 className="h-10 w-10 animate-spin text-foreground/50" />
                    </div>
                  ) : (
                    <>
                      <svg className="w-36 h-36 transform -rotate-90">
                        {/* Background circle */}
                        <circle
                          cx="72"
                          cy="72"
                          r="64"
                          className="stroke-gray-200"
                          strokeWidth="12"
                          fill="none"
                        />
                        {/* Progress circle */}
                        <circle
                          cx="72"
                          cy="72"
                          r="64"
                          className={`transition-all duration-1000 ${
                            recoveryScoreValue >= 80
                              ? 'stroke-primary'
                              : recoveryScoreValue >= 65
                              ? 'stroke-amber-500'
                              : 'stroke-rose-500'
                          }`}
                          strokeWidth="12"
                          fill="none"
                          strokeDasharray={`${(recoveryScoreValue / 100) * 402} 402`}
                          strokeLinecap="round"
                        />
                      </svg>

                      {/* Score in center */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-black text-foreground">
                          {recoveryScoreValue}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-foreground/60 mt-0.5">RECOVERY</span>
                        <div className="flex items-center gap-1 mt-1.5">
                          {recoveryTrend?.direction === 'up' ? (
                            <>
                              <TrendingUp className="h-3 w-3 text-primary" />
                              <span className="text-[10px] font-semibold text-primary">
                                +{Math.abs(Math.round(recoveryTrend.delta))} pts
                              </span>
                            </>
                          ) : recoveryTrend?.direction === 'down' ? (
                            <>
                              <TrendingDown className="h-3 w-3 text-red-600" />
                              <span className="text-[10px] font-semibold text-red-600">
                                {Math.round(recoveryTrend.delta)} pts
                              </span>
                            </>
                          ) : (
                            <span className="text-[10px] text-foreground/50">No change</span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Recovery Label & Recommendation */}
                <div className="mt-4 text-center space-y-1">
                  <Badge
                    className={`${
                      recoveryScoreValue >= 80
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : recoveryScoreValue >= 65
                        ? 'bg-amber-100 text-amber-700 border-amber-300'
                        : 'bg-rose-100 text-rose-700 border-rose-300'
                    } text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5`}
                  >
                    {getRecoveryLabel(recoveryScoreValue)}
                  </Badge>
                  <p className="text-xs text-foreground/70 font-medium">
                    {getRecoveryRecommendation(recoveryScoreValue)}
                  </p>
                </div>

                {/* Coach Confidence Bar */}
                <div className="mt-4 w-full max-w-xs">
                  <div className="rounded-2xl bg-[oklch(var(--surface-2))] border border-border p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] uppercase tracking-wide text-foreground/70">COACH CONFIDENCE</span>
                      <span className="text-xs font-bold text-foreground">
                        {recoveryConfidenceValue}%
                      </span>
                    </div>
                    <Progress
                      value={recoveryConfidenceValue}
                      className="h-1.5 bg-border/70"
                    />
                    <p className="mt-1.5 text-[10px] text-foreground/70">{recoveryNextStep}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Account Callout */}
      <div className="px-4">
        <Card className="relative overflow-hidden border border-primary/20 bg-[oklch(18%_0.02_255)] text-white shadow-[0_20px_60px_rgba(64,200,170,0.25)]">
          <div className="absolute -right-20 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -left-16 -bottom-20 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <CardContent className="relative space-y-4 p-6">
            {authLoading || !authSnapshotChecked ? (
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking account status...
              </div>
            ) : isRegistered ? (
              <>
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/40 bg-primary/15 p-1 shadow-[0_0_24px_rgba(64,200,170,0.45)]">
                      <img src="/images/runsmart-logo-1.png" alt="RunSmart" className="h-full w-full object-contain" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/60">Account Active</p>
                    <h3 className="text-2xl font-semibold">{registeredHeadline}</h3>
                    <p className="text-sm text-white/80">
                      {registeredEmail ? `Signed in as ${registeredEmail}` : "You're signed in on this device."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-white/70">Your runs are syncing across devices</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/20 bg-white/5 text-white/80 hover:bg-white/10"
                    onClick={async () => {
                    try {
                      await signOut()
                      if (authStorageKey) {
                        localStorage.removeItem(authStorageKey)
                      }
                      setStoredAuthEmail(null)
                      setStoredAuthUserId(null)
                      try {
                        localStorage.removeItem('runsmart_auth_user_id')
                        localStorage.removeItem('runsmart_auth_email')
                        localStorage.removeItem('runsmart_auth_at')
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
                </div>
                <div className="rounded-lg border border-white/15 bg-black/30 p-3">
                  <SyncStatusIndicator />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-primary/15 p-1 shadow-[0_0_24px_rgba(64,200,170,0.45)]">
                      <img src="/images/runsmart-logo-1.png" alt="RunSmart" className="h-full w-full object-contain" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/60">Early Access</p>
                    <h3 className="text-2xl font-semibold">{accountHeadline}</h3>
                    <div className="flex items-center gap-2 text-xs text-white/70">
                      <Users className="h-3 w-3" />
                      <span>200+ runners already registered</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <ul className="text-sm text-white/80 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-primary/80 flex-shrink-0">✓</span>
                      <span>AI coach tailored to your running level</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary/80 flex-shrink-0">✓</span>
                      <span>50% lifetime discount</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary/80 flex-shrink-0">✓</span>
                      <span>Exclusive Beta Pioneer badge</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary/80 flex-shrink-0">✓</span>
                      <span>Sync runs across all your devices</span>
                    </li>
                  </ul>
                  <div className="flex items-center gap-2 text-xs text-amber-300/90 bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-400/20">
                    <Zap className="h-3 w-3 fill-current" />
                    <span className="font-medium">
                      {betaSignups.loading
                        ? 'Loading...'
                        : betaSignups.isNearCapacity
                          ? `Almost full! Only ${betaSignups.spotsRemaining} spots left`
                          : `Limited: ${betaSignups.count}/500 early access spots taken`
                      }
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                    onClick={() => {
                      // Track early access CTA click
                      trackAnalyticsEvent('early_access_cta_clicked', {
                        source: 'today_screen_callout',
                        action: 'signup',
                        variant: 'optimized_v1',
                        user_type: accountShortName ? 'returning' : 'new',
                        signup_count: betaSignups.count,
                        spots_remaining: betaSignups.spotsRemaining,
                        percent_filled: betaSignups.percentFilled,
                      })
                      setAuthModalTab('signup')
                      setShowAuthModal(true)
                    }}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Claim Your Spot
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/20 bg-white/5 text-white/80 hover:bg-white/10"
                    onClick={() => {
                      // Track login CTA click
                      trackAnalyticsEvent('early_access_cta_clicked', {
                        source: 'today_screen_callout',
                        action: 'login',
                        variant: 'optimized_v1',
                        user_type: accountShortName ? 'returning' : 'new',
                      })
                      setAuthModalTab('login')
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

      {/* Calendar Strip - Timeline Nodes */}
      <div className="px-4 animate-in fade-in-0 slide-in-from-left duration-500 delay-200">
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
          {calendarDays.map((day, index) => {
            const isSelected = day.fullDate.toDateString() === selectedCalendarDate.toDateString()
            return (
              <button
                key={index}
                className="flex-shrink-0 flex flex-col items-center min-w-[60px] group"
                style={{ animationDelay: `${200 + index * 50}ms` }}
                onClick={() => handleDateClick(day)}
              >
                {/* Timeline node */}
                <div
                  className={`w-14 h-14 rounded-full border-4 flex items-center justify-center
                    transition-all duration-300 transform
                    ${
                      day.isToday
                        ? 'bg-gradient-energy border-orange-500 scale-125 shadow-xl glow-yellow'
                        : isSelected
                        ? 'bg-gradient-focus border-purple-500 scale-110 shadow-lg'
                        : 'bg-white border-border group-hover:border-foreground/30 group-hover:scale-105'
                    }`}
                >
                  <span
                    className={`font-black text-lg ${
                      day.isToday || isSelected ? 'text-white' : 'text-foreground'
                    }`}
                  >
                    {day.date}
                  </span>
                </div>

                {/* Workout indicator */}
                {day.hasWorkout && (
                  <div
                    className={`mt-2 w-2 h-2 rounded-full animate-pulse ${
                      day.workoutColor?.replace('bg-', 'bg-') || 'bg-cyan-400 glow-cyan'
                    }`}
                  />
                )}

                {/* Day name */}
                <span
                  className={`text-xs mt-1 font-medium uppercase tracking-wide ${
                    day.isToday ? 'text-orange-600' : 'text-foreground/70'
                  }`}
                >
                  {day.day.slice(0, 3)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Today's Workout - Split Screen Layout */}
      <div className="px-4">
        {isLoadingWorkout ? (
          <Card className="h-64 flex items-center justify-center border">
            <Loader2 className="h-8 w-8 animate-spin text-foreground/60" />
          </Card>
        ) : todaysWorkout ? (
          <Card className="overflow-hidden border-0 shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              {/* Left: Workout Details with Gradient */}
              <div className="relative p-8 bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 text-white overflow-hidden">
                {/* Background distance watermark */}
                <span className="absolute bottom-4 left-4 text-[8rem] font-black text-white/10 leading-none select-none pointer-events-none">
                  {todaysWorkout.distance || todaysWorkout.duration}
                </span>

                <div className="relative z-10 space-y-4">
                  <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                    {todaysWorkout.scheduledDate
                      ? new Date(todaysWorkout.scheduledDate).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )
                      : "TODAY"}
                  </Badge>

                  <h3 className="text-heading-lg text-white leading-tight">
                    {todaysWorkout.type.charAt(0).toUpperCase() +
                      todaysWorkout.type.slice(1)}{" "}
                    Run
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <StretchHorizontal className="h-6 w-6 text-white/80" />
                      <div>
                        <p className="text-xs uppercase tracking-wide text-white/70">Distance</p>
                        <p className="text-2xl font-black">
                          {todaysWorkout.distance
                            ? `${todaysWorkout.distance} km`
                            : `${todaysWorkout.duration} min`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Clock className="h-6 w-6 text-white/80" />
                      <div>
                        <p className="text-xs uppercase tracking-wide text-white/70">
                          Estimated Time
                        </p>
                        <p className="text-2xl font-black">
                          {todaysWorkout.duration
                            ? `${Math.max(20, todaysWorkout.duration - 5)}-${
                                todaysWorkout.duration + 5
                              }m`
                            : `${Math.round(todaysWorkout.distance! * 5)}-${Math.round(
                                todaysWorkout.distance! * 7
                              )}m`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* View Details Button */}
                  <Button
                    variant="ghost"
                    className="text-white border-white/30 hover:bg-white/10 mt-4"
                    onClick={() => setShowWorkoutBreakdown(!showWorkoutBreakdown)}
                  >
                    {showWorkoutBreakdown ? (
                      <ChevronUp className="h-4 w-4 mr-2" />
                    ) : (
                      <ChevronDown className="h-4 w-4 mr-2" />
                    )}
                    Workout Phases
                  </Button>
                </div>
              </div>

              {/* Right: Giant Start Button */}
              <div className="p-8 flex flex-col items-center justify-center bg-[oklch(var(--surface-2))] space-y-4">
                  <Button
                    onClick={startRecordFlow}
                    aria-label="Start Run"
                    className="h-40 w-40 rounded-full bg-gradient-energy
                    shadow-2xl hover:shadow-3xl transition-all duration-300
                    hover:scale-110 active:scale-95 animate-pulse-glow border-0"
                >
                  <Play className="h-16 w-16 text-white fill-white" />
                </Button>
                <p className="text-label-sm text-foreground/70">TAP TO START</p>

                {/* Secondary Actions */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRouteSelectorModal(true)}
                  className="mt-2"
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Select Route
                </Button>

                {selectedRoute && (
                  <div className="mt-4 bg-white rounded-xl border border-border p-3 text-sm w-full">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-purple-600" />
                      <span className="font-semibold text-foreground">
                        {selectedRoute.name}
                      </span>
                    </div>
                    {selectedRoute.distance && (
                      <span className="text-xs text-foreground/70 ml-6">
                        {selectedRoute.distance} km
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Workout Breakdown - Collapsible */}
            {showWorkoutBreakdown && (
              <div className="bg-white border-t border-border p-6 animate-in fade-in-0 slide-in-from-top-4 duration-300">
                <h4 className="text-label-lg text-foreground/70 mb-4">WORKOUT PHASES</h4>
                {structuredWorkout ? (
                  <WorkoutPhasesDisplay workout={structuredWorkout} />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-border" />
                      <span className="text-sm text-foreground/70">
                        Warm-up: 5-10 min easy pace
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-purple-600" />
                      <span className="text-sm font-semibold text-foreground">
                        Main: {todaysWorkout.distance}km at target pace
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-border" />
                      <span className="text-sm text-foreground/70">Cool-down: 5 min walk</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        ) : (
          <Card className="text-center py-12 border-0 shadow-xl">
            <CardContent>
              <div className="w-24 h-24 bg-gradient-recovery rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                <Award className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-heading-lg mb-3">Rest Day</h3>
              <p className="text-foreground/70 text-base max-w-sm mx-auto mb-6">
                Recovery is just as important as training. Enjoy your rest!
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  onClick={startRecordFlow}
                  className="bg-gradient-energy hover:scale-105 transition-transform"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Record a Run
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowRouteSelectorModal(true)}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Choose Route
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {ENABLE_WEEKLY_RECAP && userId && (
        <div className="px-4 mt-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-450">
          <WeeklyRecapWidget userId={userId} openRecapSignal={recapOpenSignal} />
        </div>
      )}

      {/* Add Run & Activity - Side by Side */}
      <div className="px-4 grid grid-cols-2 gap-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-400">
        <Button
          variant="default"
          className="h-12"
          onClick={() => setShowAddRunModal(true)}
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Run
        </Button>
        <Button
          variant="secondary"
          className="h-12"
          onClick={() => setShowAddActivityModal(true)}
        >
          <Plus className="h-5 w-5 mr-2" />
          Activity
        </Button>
      </div>

      {/* Coaching Tip with Gradient Background */}
      <div className="px-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-500">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full blur-3xl" />
          <CardContent className="p-4 relative z-10">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">Coach&apos;s Tip</h3>
                    <RunSmartBrandMark compact size="sm" className="opacity-60" />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={refreshTip}
                    className="h-6 w-6"
                  >
                    <RefreshCw className="h-2.5 w-2.5" />
                  </Button>
                </div>
                <p className="text-xs text-foreground/70 leading-relaxed">{dailyTip}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Stats - Bento Grid Layout */}
      <div className="px-4 grid grid-cols-3 gap-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-600">
        {/* Streak - Double Width with Gradient */}
        <div className="col-span-2 bg-gradient-success rounded-3xl p-4 text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
          <Flame className="h-6 w-6 mb-2 text-white/90" />
          <span className="text-4xl font-black block leading-none">{streak}</span>
          <span className="text-[10px] uppercase tracking-wide block mt-1.5 text-white/90">DAY STREAK</span>
        </div>

        {/* Weekly Runs */}
        <div className="bg-white rounded-3xl p-4 border-2 border-border hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <BarChart3 className="h-5 w-5 text-blue-500 mb-1.5" />
          <span className="text-4xl font-black text-foreground block leading-none">
            {totalRuns}
          </span>
          <span className="text-[10px] uppercase tracking-wide block mt-1.5 text-foreground/70">THIS WEEK</span>
        </div>

        {/* Consistency */}
        <div className="bg-white rounded-3xl p-4 border-2 border-border hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <TrendingUp className="h-5 w-5 text-purple-500 mb-1.5" />
          <span className="text-4xl font-black text-foreground block leading-none">
            {consistency}%
          </span>
          <span className="text-[10px] uppercase tracking-wide block mt-1.5 text-foreground/70">CONSISTENCY</span>
        </div>

        {/* Completed - Double Width */}
        <div className="col-span-2 bg-white rounded-3xl p-4 border-2 border-border hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <Award className="h-5 w-5 text-amber-500 mb-1.5" />
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-black text-foreground leading-none">
              {weeklyWorkouts.filter((w) => w.completed).length}
            </span>
            <span className="text-2xl font-black text-foreground/50 leading-none">
              / {plannedRuns}
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-wide block mt-1.5 text-foreground/70">
            WORKOUTS COMPLETED
          </span>
        </div>
      </div>

      {/* Widgets Section - Stacked with Animations */}
      <div className="px-4 space-y-4">
        {userId && (
          <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-700">
            <HabitAnalyticsWidget
              userId={userId}
              showDetails={false}
              className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            />
          </div>
        )}

        {userId && (
          <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-1000">
            <GoalRecommendations
              userId={userId}
              className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            />
          </div>
        )}

        {userId && (
          <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-1100">
            <CommunityStatsWidget
              userId={userId}
              className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            />
          </div>
        )}
      </div>

      {showAuthModal && (
        <AuthModal
          open={showAuthModal}
          onOpenChange={setShowAuthModal}
          defaultTab={authModalTab}
        />
      )}

      {/* Modals - wrapped with error boundaries to prevent app crashes */}
      {showAddRunModal && (
        <ModalErrorBoundary modalName="Add Run" onClose={() => setShowAddRunModal(false)}>
          <AddRunModal
            open={showAddRunModal}
            onOpenChange={setShowAddRunModal}
            onRunAdded={refreshWorkouts}
          />
        </ModalErrorBoundary>
      )}

      {showAddActivityModal && (
        <ModalErrorBoundary modalName="Add Activity" onClose={() => setShowAddActivityModal(false)}>
          <AddActivityModal
            open={showAddActivityModal}
            onOpenChange={setShowAddActivityModal}
            onActivityAdded={refreshWorkouts}
          />
        </ModalErrorBoundary>
      )}

      {showRouteSelectorModal && (
        <ModalErrorBoundary modalName="Route Selector" onClose={() => setShowRouteSelectorModal(false)}>
          <RouteSelectorModal
            isOpen={showRouteSelectorModal}
            onClose={() => setShowRouteSelectorModal(false)}
            onRouteSelected={handleRouteSelected}
          />
        </ModalErrorBoundary>
      )}

      {showRescheduleModal && (
        <ModalErrorBoundary modalName="Reschedule" onClose={() => setShowRescheduleModal(false)}>
          <RescheduleModal
            isOpen={showRescheduleModal}
            onClose={() => setShowRescheduleModal(false)}
          />
        </ModalErrorBoundary>
      )}

      {showDateWorkoutModal && (
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
      )}
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


