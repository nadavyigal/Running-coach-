"use client";

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sun,
  Clock,
  CalendarPlus,
  Plus,
  MapPin,
  Trash2,
  Music,
  Play,
  ChevronDown,
  ChevronUp,
  Zap,
  StretchHorizontal,
  Link,
  Loader2,
  Flame,
  BarChart3,
  RefreshCw,
  TrendingUp,
  Award,
  Target,
} from "lucide-react"
import { AddRunModal } from "@/components/add-run-modal"
import { AddActivityModal } from "@/components/add-activity-modal"
import { RouteSelectorModal } from "@/components/route-selector-modal"
import { RescheduleModal } from "@/components/reschedule-modal"
import { DateWorkoutModal } from "@/components/date-workout-modal"
import { type Workout, type Plan, type Route } from "@/lib/db"
import { dbUtils } from "@/lib/dbUtils"
import { useToast } from "@/hooks/use-toast"
import { StreakIndicator } from "@/components/streak-indicator"
import { CommunityStatsWidget } from "@/components/community-stats-widget"
import { CoachingInsightsWidget } from "@/components/coaching-insights-widget"
import { CoachingPreferencesSettings } from "@/components/coaching-preferences-settings"
import { CoachingFeedbackModal } from "@/components/coaching-feedback-modal"
import { GoalRecommendations } from "@/components/goal-recommendations"
import RecoveryRecommendations from "@/components/recovery-recommendations"
import { HabitAnalyticsWidget } from "@/components/habit-analytics-widget"
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

// Get workout color gradient based on type
const getWorkoutGradient = (type: string): string => {
  const gradients: Record<string, string> = {
    easy: "from-green-500 to-green-600",
    tempo: "from-orange-500 to-orange-600",
    intervals: "from-pink-500 to-pink-600",
    long: "from-blue-500 to-blue-600",
    "time-trial": "from-red-500 to-red-600",
    hill: "from-purple-500 to-purple-600",
    rest: "from-gray-400 to-gray-500",
  }
  return gradients[type.toLowerCase()] || "from-primary to-primary-dark"
}

export function TodayScreen() {
  const [dailyTip, setDailyTip] = useState(
    "Focus on your breathing rhythm today. Try the 3:2 pattern - inhale for 3 steps, exhale for 2 steps. This will help you maintain a steady pace!",
  )

  const [showWorkoutBreakdown, setShowWorkoutBreakdown] = useState(false)
  const [todaysWorkout, setTodaysWorkout] = useState<Workout | null>(null)
  const [isLoadingWorkout, setIsLoadingWorkout] = useState(true)
  const [weeklyWorkouts, setWeeklyWorkouts] = useState<Workout[]>([])
  const [userId, setUserId] = useState<number | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showAddRunModal, setShowAddRunModal] = useState(false)
  const [showAddActivityModal, setShowAddActivityModal] = useState(false)
  const [showRouteSelectorModal, setShowRouteSelectorModal] = useState(false)
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [showDateWorkoutModal, setShowDateWorkoutModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [workoutToDelete, setWorkoutToDelete] = useState<number | null>(null)
  const [showCoachingPreferences, setShowCoachingPreferences] = useState(false)
  const [showCoachingFeedback, setShowCoachingFeedback] = useState(false)
  const { toast } = useToast()

  const tips = [
    "Focus on your breathing rhythm today. Try the 3:2 pattern - inhale for 3 steps, exhale for 2 steps.",
    "Remember to warm up with 5 minutes of walking before starting your run. This helps prevent injury.",
    "Stay hydrated! Drink water throughout the day, not just during your run.",
    "Listen to your body. If something feels wrong, it's okay to take a rest day. Recovery is part of training too.",
    "Consistency beats intensity. Show up regularly, even if it's just a short run.",
    "Track your progress! Celebrate small wins - every kilometer counts towards your goal.",
  ]

  const refreshTip = () => {
    const currentIndex = tips.indexOf(dailyTip)
    const nextIndex = (currentIndex + 1) % tips.length
    setDailyTip(tips[nextIndex])
  }

  // Initialize data
  useEffect(() => {
    const initializeData = async () => {
      try {
        const user = await dbUtils.getCurrentUser()
        if (user) {
          setUserId(user.id!)
          const userPlan = await dbUtils.getPlanByUserId(user.id!)
          setPlan(userPlan)
        }

        const workouts = await dbUtils.getWeeklyWorkouts()
        setWeeklyWorkouts(workouts)

        const today = await dbUtils.getTodaysWorkout()
        setTodaysWorkout(today)
        setIsLoadingWorkout(false)
      } catch (error) {
        console.error("Error initializing data:", error)
        setIsLoadingWorkout(false)
      }
    }

    initializeData()
  }, [])

  const refreshWorkouts = async () => {
    try {
      const workouts = await dbUtils.getWeeklyWorkouts()
      setWeeklyWorkouts(workouts)
      const today = await dbUtils.getTodaysWorkout()
      setTodaysWorkout(today)
    } catch (error) {
      console.error("Error refreshing workouts:", error)
    }
  }

  // Calendar days
  const calendarDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - 3 + i)
    const workout = weeklyWorkouts.find(
      (w) =>
        new Date(w.scheduledDate).toDateString() === date.toDateString()
    )
    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      date: date.getDate(),
      fullDate: date,
      isToday: date.toDateString() === new Date().toDateString(),
      hasWorkout: !!workout,
      workoutColor: workout ? getWorkoutGradient(workout.type) : undefined,
      workoutType: workout?.type,
    }
  })

  const handleDateClick = (day: any) => {
    setSelectedDate(day.fullDate)
    setShowDateWorkoutModal(true)
  }

  const handleRestartOnboarding = () => {
    setShowResetConfirm(true)
  }

  const confirmReset = () => {
    try {
      dbUtils.clearPlanCreationLocks()
      dbUtils.resetDatabaseInstance()
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
      const workoutDate = new Date(sortedWorkouts[i].scheduledDate)
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

  const totalRuns = weeklyWorkouts.filter(
    (w) => w.completed && w.type !== "rest"
  ).length
  const plannedRuns = weeklyWorkouts.filter((w) => w.type !== "rest").length
  const consistency =
    plannedRuns > 0 ? Math.round((totalRuns / plannedRuns) * 100) : 0
  const streak = calculateStreak()

  return (
    <div className="pb-24 space-y-4">
      {/* Header with Gradient Background */}
      <div className="bg-gradient-to-br from-purple-50 via-white to-cyan-50 p-6 rounded-b-3xl shadow-sm animate-in fade-in-0 duration-500">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {plan?.title || "Your Training"}
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm text-accent px-4 py-2 rounded-full shadow-sm">
              <Sun className="h-5 w-5" />
              <span className="text-sm font-semibold">22°C</span>
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleRestartOnboarding}
              className="gap-1.5 text-xs text-gray-500 hover:text-primary"
            >
              <RefreshCw className="h-3 w-3" />
              Reset
            </Button>
          </div>
        </div>

        {/* Streak & Challenge Progress - 2 Column Bento */}
        <div className="grid grid-cols-2 gap-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-100">
          <Card variant="stat" size="sm" className="hover:-translate-y-1">
            <CardContent className="p-4 text-center">
              <Flame className="h-6 w-6 text-orange-500 mx-auto mb-2" />
              <div className="text-3xl font-bold text-primary mb-1">
                {streak}
              </div>
              <div className="text-xs font-medium text-gray-600">Day Streak</div>
            </CardContent>
          </Card>
          <Card variant="stat" size="sm" className="hover:-translate-y-1">
            <CardContent className="p-4 text-center">
              <Target className="h-6 w-6 text-cyan-500 mx-auto mb-2" />
              <div className="text-3xl font-bold text-accent mb-1">
                {totalRuns}/{plannedRuns}
              </div>
              <div className="text-xs font-medium text-gray-600">This Week</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Calendar Strip with Staggered Animations */}
      <div className="px-4 animate-in fade-in-0 slide-in-from-left duration-500 delay-200">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {calendarDays.map((day, index) => {
            const isSelected = day.isToday
            return (
              <button
                key={index}
                className={`flex-shrink-0 text-center p-3 rounded-xl min-w-[70px] transition-all duration-300 hover:scale-105 active:scale-95 animate-in fade-in-0 slide-in-from-left duration-500 ${
                  isSelected
                    ? "bg-gradient-to-br from-primary to-primary-dark text-white shadow-lg shadow-primary/20 scale-105"
                    : "bg-white border border-gray-200 hover:shadow-md hover:border-primary/30"
                }`}
                style={{ animationDelay: `${200 + index * 50}ms` }}
                onClick={() => handleDateClick(day)}
              >
                <div className="text-xs font-semibold mb-1">{day.day}</div>
                <div className="text-2xl font-bold mb-1">{day.date}</div>
                {day.hasWorkout && (
                  <div className="flex justify-center">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isSelected
                          ? "bg-white"
                          : `bg-gradient-to-r ${day.workoutColor}`
                      }`}
                    />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Today's Workout - Hero Card with Workout-Themed Gradient */}
      <div className="px-4 animate-in fade-in-0 scale-in duration-500 delay-300">
        {isLoadingWorkout ? (
          <Card variant="elevated" className="h-64 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </Card>
        ) : todaysWorkout ? (
          <Card
            variant="workout"
            className={`bg-gradient-to-br ${getWorkoutGradient(
              todaysWorkout.type
            )} text-white shadow-xl overflow-hidden relative`}
          >
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-2xl" />

            <CardHeader className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <Badge
                  className="bg-white/20 backdrop-blur-sm text-white border-white/30 uppercase tracking-wider"
                  size="sm"
                >
                  Today
                </Badge>
                <span className="text-sm text-white/90">
                  {todaysWorkout.scheduledDate
                    ? new Date(todaysWorkout.scheduledDate).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric" }
                      )
                    : ""}
                </span>
              </div>
              <CardTitle className="text-2xl font-bold mb-2">
                {todaysWorkout.type.charAt(0).toUpperCase() +
                  todaysWorkout.type.slice(1)}{" "}
                Run
              </CardTitle>
              <div className="flex items-center gap-4 text-white/90">
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
                      ? `${Math.max(20, todaysWorkout.duration - 5)}-${
                          todaysWorkout.duration + 5
                        }m`
                      : `${Math.round(todaysWorkout.distance! * 5)}-${Math.round(
                          todaysWorkout.distance! * 7
                        )}m`}
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="relative z-10 space-y-4">
              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  size="lg"
                  className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border-white/30 font-semibold"
                  onClick={() =>
                    (window.location.hash = "#record")
                  }
                >
                  <Play className="h-5 w-5 mr-2" />
                  Start Run
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  className="bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white"
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

              {/* Workout Breakdown */}
              {showWorkoutBreakdown && (
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 space-y-3 animate-in fade-in-0 slide-in-from-top-4 duration-300">
                  <h4 className="font-semibold text-sm uppercase tracking-wide">
                    Workout Phases
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-white/60" />
                      <span className="text-sm">Warm-up: 5-10 min easy pace</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-white" />
                      <span className="text-sm font-semibold">
                        Main: {todaysWorkout.distance}km at target pace
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-white/60" />
                      <span className="text-sm">Cool-down: 5 min walk</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card variant="gradient" className="text-center py-12">
            <CardContent>
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2">Rest Day</h3>
              <p className="text-gray-600 text-sm">
                Recovery is just as important as training. Enjoy your rest!
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Run & Activity - Side by Side */}
      <div className="px-4 grid grid-cols-2 gap-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-400">
        <Button
          variant="accent"
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
        <Card variant="stat" className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full blur-3xl" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  Coach's Tip
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={refreshTip}
                    className="ml-auto"
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
        <Card variant="default" size="sm" className="col-span-1 hover:-translate-y-1">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{totalRuns}</div>
            <div className="text-xs text-gray-600 mt-1">Runs</div>
          </CardContent>
        </Card>
        <Card variant="default" size="sm" className="col-span-1 hover:-translate-y-1">
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-5 w-5 text-accent mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{consistency}%</div>
            <div className="text-xs text-gray-600 mt-1">Rate</div>
          </CardContent>
        </Card>
        <Card variant="default" size="sm" className="col-span-1 hover:-translate-y-1">
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
          <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-800">
            <CoachingInsightsWidget
              userId={userId}
              showDetails={true}
              onSettingsClick={() => setShowCoachingPreferences(true)}
              className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            />
          </div>
        )}

        {userId && (
          <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-900">
            <RecoveryRecommendations
              userId={userId}
              date={new Date()}
              showBreakdown={true}
              onRefresh={refreshWorkouts}
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

      {/* Modals */}
      <AddRunModal
        open={showAddRunModal}
        onOpenChange={setShowAddRunModal}
        onRunAdded={refreshWorkouts}
      />
      <AddActivityModal
        open={showAddActivityModal}
        onOpenChange={setShowAddActivityModal}
        onActivityAdded={refreshWorkouts}
      />
      <RouteSelectorModal
        open={showRouteSelectorModal}
        onOpenChange={setShowRouteSelectorModal}
        onRouteSelect={() => {}}
      />
      <RescheduleModal
        open={showRescheduleModal}
        onOpenChange={setShowRescheduleModal}
        workout={todaysWorkout}
        onReschedule={refreshWorkouts}
      />
      <DateWorkoutModal
        open={showDateWorkoutModal}
        onOpenChange={setShowDateWorkoutModal}
        date={selectedDate || new Date()}
        onWorkoutAdded={refreshWorkouts}
      />
      <CoachingPreferencesSettings
        open={showCoachingPreferences}
        onOpenChange={setShowCoachingPreferences}
        userId={userId || 0}
      />
      <CoachingFeedbackModal
        open={showCoachingFeedback}
        onOpenChange={setShowCoachingFeedback}
        userId={userId || 0}
      />
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
