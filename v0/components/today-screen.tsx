"use client";

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Award,
  CheckCircle2,
  Crown,
  LogIn,
  LogOut,
  UserPlus,
} from "lucide-react"
import { AddRunModal } from "@/components/add-run-modal"
import { AddActivityModal } from "@/components/add-activity-modal"
import { RouteSelectorModal } from "@/components/route-selector-modal"
import { RescheduleModal } from "@/components/reschedule-modal"
import { DateWorkoutModal } from "@/components/date-workout-modal"
import ModalErrorBoundary from "@/components/modal-error-boundary"
import { type Workout, type Route, type Goal, resetDatabaseInstance } from "@/lib/db"
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
  const { user: authUser, loading: authLoading, signOut } = useAuth()

  // Use centralized goal progress calculation
  const goalProgress = useGoalProgress(primaryGoal)
  const [dailyTip, setDailyTip] = useState(
    "Focus on your breathing rhythm today. Try the 3:2 pattern - inhale for 3 steps, exhale for 2 steps. This will help you maintain a steady pace!",
  )

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
  const [workoutToDelete, setWorkoutToDelete] = useState<number | null>(null)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date())
  const { toast } = useToast()
  const [showWeeklyRecapNotification, setShowWeeklyRecapNotification] = useState(false)
  const [recapOpenSignal, setRecapOpenSignal] = useState(0)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authModalTab, setAuthModalTab] = useState<'signup' | 'login'>('signup')

  const accountName = localUser?.name?.trim()
  const accountShortName = accountName ? accountName.split(' ')[0] : null
  const accountHeadline = accountShortName
    ? `${accountShortName}, create your RunSmart account`
    : "Create your RunSmart account"

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
      {showWeeklyRecapNotification && (
        <div className="px-4 animate-in fade-in-0 slide-in-from-top-4 duration-300">
          <WeeklyRecapNotificationBanner
            onViewRecap={handleViewRecapFromNotification}
            onDismiss={() => setShowWeeklyRecapNotification(false)}
          />
        </div>
      )}
      {primaryGoal && (
        <div className="px-4">
          <Card className="border">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-emerald-600">Active Goal</p>
                  <h3 className="text-lg font-bold text-gray-900">{primaryGoal.title}</h3>
                  <p className="text-sm text-gray-700">{primaryGoal.description}</p>
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
                <div className="flex justify-between text-xs text-gray-700 mb-1">
                  <span>Progress</span>
                  <div className="flex items-center gap-2">
                    <span>{Math.round(getGoalProgressPercent())}%</span>
                    {getGoalTrajectory() && (
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize ${
                          getGoalTrajectory() === 'ahead' ? 'text-emerald-600 border-emerald-300' :
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
      <div className="bg-white p-6 rounded-b-3xl shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
            <h1 className="text-3xl font-bold text-gray-900">
              {plan?.title || "Your Training"}
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full">
              <Sun className="h-5 w-5" />
              <span className="text-sm font-semibold">22°C</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRestartOnboarding}
              className="gap-1.5 text-xs text-gray-500 hover:text-gray-700"
            >
              <RefreshCw className="h-3 w-3" />
              Reset
            </Button>
          </div>
        </div>

        {/* Streak & Challenge Progress */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border">
            <CardContent className="p-4 text-center">
              <Flame className="h-6 w-6 text-orange-500 mx-auto mb-2" />
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {streak}
              </div>
              <div className="text-xs font-medium text-gray-600">Day Streak</div>
            </CardContent>
          </Card>
          <Card className="border">
            <CardContent className="p-4 text-center">
              <BarChart3 className="h-6 w-6 text-blue-500 mx-auto mb-2" />
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {totalRuns}/{plannedRuns}
              </div>
              <div className="text-xs font-medium text-gray-600">This Week</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Account Callout */}
      <div className="px-4">
        {authLoading ? (
          <Card className="border">
            <CardContent className="p-4 flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking account status...
            </CardContent>
          </Card>
        ) : authUser ? (
          <Card className="border border-emerald-200 bg-emerald-50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span className="font-semibold text-emerald-900">You're registered</span>
                  </div>
                  <p className="text-xs text-emerald-700">
                    {authUser.email ?? "Account connected"}
                  </p>
                  <p className="text-xs text-emerald-700 mt-1">
                    Your runs are backed up in the cloud.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                  onClick={async () => {
                    try {
                      await signOut()
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
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-white/70 p-3">
                <SyncStatusIndicator />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 bg-gradient-to-br from-emerald-700 via-teal-600 to-rose-600 text-white shadow-lg">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-white/70">Account</p>
                  <h3 className="text-2xl font-semibold">{accountHeadline}</h3>
                  <p className="text-sm text-white/85">
                    Back up your runs, keep your plan safe, and sync across devices.
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
                  <Crown className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className="bg-white text-emerald-800 hover:bg-white/90"
                  onClick={() => {
                    setAuthModalTab('signup')
                    setShowAuthModal(true)
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Sign Up
                </Button>
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                  onClick={() => {
                    setAuthModalTab('login')
                    setShowAuthModal(true)
                  }}
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Log In
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Calendar Strip with Staggered Animations */}
      <div className="px-4 animate-in fade-in-0 slide-in-from-left duration-500 delay-200">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {calendarDays.map((day, index) => {
            const isSelected = day.fullDate.toDateString() === selectedCalendarDate.toDateString()
            return (
              <button
                key={index}
                className={`flex-shrink-0 text-center p-3 rounded-xl min-w-[70px] transition-all duration-300 hover:scale-105 active:scale-95 ${isSelected
                  ? "bg-blue-500 text-white shadow-lg scale-105"
                  : "bg-white border border-gray-200 hover:shadow-md"
                  }`}
                style={{ animationDelay: `${200 + index * 50}ms` }}
                onClick={() => handleDateClick(day)}
              >
                <div className="text-xs font-semibold mb-1">{day.day}</div>
                <div className="text-2xl font-bold mb-1">{day.date}</div>
                {day.hasWorkout && (
                  <div className="flex justify-center">
                    <div
                      className={`w-2 h-2 rounded-full ${isSelected
                        ? "bg-white"
                        : day.workoutColor || "bg-green-500"
                        }`}
                    />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Today's Workout */}
      <div className="px-4">
        {isLoadingWorkout ? (
          <Card className="h-64 flex items-center justify-center border">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </Card>
        ) : todaysWorkout ? (
          <Card className="border shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary" className="uppercase tracking-wider">
                  Today
                </Badge>
                <span className="text-sm text-gray-500">
                  {todaysWorkout.scheduledDate
                    ? new Date(todaysWorkout.scheduledDate).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric" }
                    )
                    : ""}
                </span>
              </div>
              <CardTitle className="text-2xl font-bold mb-2 text-gray-900">
                {todaysWorkout.type.charAt(0).toUpperCase() +
                  todaysWorkout.type.slice(1)}{" "}
                Run
              </CardTitle>
              <div className="flex items-center gap-4 text-gray-700">
                <div className="flex items-center gap-2">
                  <StretchHorizontal className="h-5 w-5" />
                  <span className="font-semibold">
                    {todaysWorkout.distance
                      ? `${todaysWorkout.distance} km`
                      : `${todaysWorkout.duration} min`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  <span className="font-semibold">
                    {todaysWorkout.duration
                      ? `${Math.max(20, todaysWorkout.duration - 5)}-${todaysWorkout.duration + 5
                      }m`
                      : `${Math.round(todaysWorkout.distance! * 5)}-${Math.round(
                        todaysWorkout.distance! * 7
                      )}m`}
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Quick Actions */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Button
                  variant="default"
                  size="lg"
                  onClick={startRecordFlow}
                >
                  <Play className="h-5 w-5 mr-2" />
                  Start Run
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setShowRouteSelectorModal(true)}
                >
                  <MapPin className="h-5 w-5 mr-2" />
                  Select Route
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => setShowWorkoutBreakdown(!showWorkoutBreakdown)}
                >
                  {showWorkoutBreakdown ? (
                    <ChevronUp className="h-5 w-5 mr-2" />
                  ) : (
                    <ChevronDown className="h-5 w-5 mr-2" />
                  )}
                  Details
                </Button>
              </div>

              {/* Workout Breakdown - Garmin Style */}
              {showWorkoutBreakdown && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3 animate-in fade-in-0 slide-in-from-top-4 duration-300">
                  <h4 className="font-semibold text-sm uppercase tracking-wide text-gray-700">
                    Workout Phases
                  </h4>
                  {structuredWorkout ? (
                    <WorkoutPhasesDisplay workout={structuredWorkout} />
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                        <span className="text-sm text-gray-600">Warm-up: 5-10 min easy pace</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-gray-800" />
                        <span className="text-sm font-semibold text-gray-900">
                          Main: {todaysWorkout.distance}km at target pace
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                        <span className="text-sm text-gray-600">Cool-down: 5 min walk</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedRoute && (
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span className="font-semibold">{selectedRoute.name}</span>
                  </div>
                  {selectedRoute.distance && (
                    <span className="text-white/80">{selectedRoute.distance} km</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2">Rest Day</h3>
              <p className="text-gray-600 text-sm">
                Recovery is just as important as training. Enjoy your rest!
              </p>
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button onClick={startRecordFlow} className="gap-2">
                  <Play className="h-4 w-4" />
                  Record a Run
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setShowRouteSelectorModal(true)}
                >
                  <MapPin className="h-4 w-4" />
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
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full blur-3xl" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  Coach&apos;s Tip
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={refreshTip}
                    className="ml-auto h-8 w-8"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">{dailyTip}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Stats - Bento Grid */}
      <div className="px-4 grid grid-cols-3 gap-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-600">
        <Card className="col-span-1 hover:-translate-y-1">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{totalRuns}</div>
            <div className="text-xs text-gray-600 mt-1">Runs</div>
          </CardContent>
        </Card>
        <Card className="col-span-1 hover:-translate-y-1">
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-5 w-5 text-accent mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{consistency}%</div>
            <div className="text-xs text-gray-600 mt-1">Rate</div>
          </CardContent>
        </Card>
        <Card className="col-span-1 hover:-translate-y-1">
          <CardContent className="p-4 text-center">
            <Award className="h-5 w-5 text-warning mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              {weeklyWorkouts.filter((w) => w.completed).length}
            </div>
            <div className="text-xs text-gray-600 mt-1">Done</div>
          </CardContent>
        </Card>
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
