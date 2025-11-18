"use client";

import { useEffect, useState } from "react";
import { dbUtils, type Plan, type Workout, type User } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { AddRunModal } from "@/components/add-run-modal";
import { AddActivityModal } from "@/components/add-activity-modal";
import { RouteSelectorModal } from "@/components/route-selector-modal";
import { RescheduleModal } from "@/components/reschedule-modal";
import { DateWorkoutModal } from "@/components/date-workout-modal";
import { useToast } from "@/hooks/use-toast";
import { StreakIndicator } from "@/components/streak-indicator";
import { CommunityStatsWidget } from "@/components/community-stats-widget";
import { CoachingInsightsWidget } from "@/components/coaching-insights-widget";
import { CoachingPreferencesSettings } from "@/components/coaching-preferences-settings";
import { CoachingFeedbackModal } from "@/components/coaching-feedback-modal";
import { GoalRecommendations } from "@/components/goal-recommendations";
import RecoveryRecommendations from "@/components/recovery-recommendations";
import { HabitAnalyticsWidget } from "@/components/habit-analytics-widget";

// Minimal version kept for reference; main export is the richer TodayScreen below.
function TodayScreenMinimal() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [todaysWorkout, setTodaysWorkout] = useState<Workout | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const resolved = await dbUtils.getCurrentUser();
        if (!resolved || !resolved.id) {
          setError("No user available");
          return;
        }
        setUser(resolved);

        let active = await dbUtils.getActivePlan(resolved.id);
        if (!active) {
          active = await dbUtils.ensureUserHasActivePlan(resolved.id);
        }
        setPlan(active);

        const tw = await dbUtils.getTodaysWorkout(resolved.id);
        setTodaysWorkout(tw);
      } catch (e: any) {
        setError(e?.message || "Failed to load");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-green-500" />
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600">{error}</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Training Plan</h1>
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="text-sm text-gray-600">
            {user ? (
              <span>
                Welcome back{user.experience ? ` (${user.experience})` : ""}!
              </span>
            ) : (
              <span>Welcome!</span>
            )}
          </div>
          {plan ? (
            <div className="text-gray-800">
              <div className="font-medium">Active Plan: {plan.title}</div>
              <div className="text-sm text-gray-600">Weeks: {plan.totalWeeks}</div>
            </div>
          ) : (
            <div className="text-sm text-gray-600">Preparing your plan...</div>
          )}
          <div className="pt-2">
            <div className="font-semibold">Today's Workout</div>
            {todaysWorkout ? (
              <div className="text-sm text-gray-700">
                {todaysWorkout.day}: {todaysWorkout.type} — {todaysWorkout.distance} km
              </div>
            ) : (
              <div className="text-sm text-gray-600">
                Rest day or no workout scheduled.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Main TodayScreen component
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
  const { toast } = useToast()

  const tips = [
    "Focus on your breathing rhythm today. Try the 3:2 pattern - inhale for 3 steps, exhale for 2 steps. This will help you maintain a steady pace!",
    "Remember to warm up with 5 minutes of walking before starting your run. This helps prevent injury and prepares your muscles.",
    "Stay hydrated! Drink water throughout the day, not just during your run. Your body will thank you.",
    "Listen to your body. If something feels wrong, it's okay to take a rest day. Recovery is part of training too.",
  ]

  const refreshTip = () => {
    const currentIndex = tips.indexOf(dailyTip)
    const nextIndex = (currentIndex + 1) % tips.length
    setDailyTip(tips[nextIndex])
  }

  const refreshWorkouts = async () => {
    setIsLoadingWorkout(true)
    try {
      const user = await dbUtils.getCurrentUser()
      if (user) {
        setUserId(user.id || null)
        
        // Load plan
        let activePlan = await dbUtils.getActivePlan(user.id!)
        if (!activePlan) {
          activePlan = await dbUtils.ensureUserHasActivePlan(user.id!)
        }
        setPlan(activePlan)
        
        const today = new Date()
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - today.getDay()) // Sunday
        const endOfWeek = new Date(today)
        endOfWeek.setDate(today.getDate() - today.getDay() + 6) // Saturday

        const allWorkouts = await dbUtils.getWorkoutsForDateRange(user.id!, startOfWeek, endOfWeek)
        setWeeklyWorkouts(allWorkouts)

        const todays = allWorkouts.find(
          (w) =>
            w.scheduledDate.getDate() === new Date().getDate() &&
            w.scheduledDate.getMonth() === new Date().getMonth() &&
            w.scheduledDate.getFullYear() === new Date().getFullYear(),
        )
        setTodaysWorkout(todays || null)
      } else {
        setUserId(null)
        setWeeklyWorkouts([])
        setTodaysWorkout(null)
        setPlan(null)
      }
    } catch (error) {
      console.error('Failed to refresh workouts:', error)
      toast({
        title: "Error",
        description: "Failed to refresh workouts.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingWorkout(false)
    }
  }

  // Load today's workout and weekly workouts
  useEffect(() => {
    refreshWorkouts()
  }, [toast])

  const today = new Date()
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const calendarDays = []

  const [showAddRunModal, setShowAddRunModal] = useState(false)
  const [showAddActivityModal, setShowAddActivityModal] = useState(false)
  const [showRoutesModal, setShowRoutesModal] = useState(false)
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showDateWorkout, setShowDateWorkout] = useState(false)

  // Add state for date workout modal
  const [selectedDateWorkout, setSelectedDateWorkout] = useState<any>(null)
  const [showDateWorkoutModal, setShowDateWorkoutModal] = useState(false)
  const [showCoachingPreferences, setShowCoachingPreferences] = useState(false)
  const [showCoachingFeedback, setShowCoachingFeedback] = useState(false)
  const [lastCoachingInteraction, setLastCoachingInteraction] = useState<string | null>(null)

  // Workout color mapping
  const workoutColorMap: { [key: string]: string } = {
    easy: "bg-green-500",
    tempo: "bg-orange-500",
    intervals: "bg-pink-500",
    long: "bg-blue-500",
    rest: "bg-gray-400",
    "time-trial": "bg-red-500",
    hill: "bg-purple-500",
  }

  // Update calendar days generation
  for (let i = -3; i <= 3; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    const workoutForDate = weeklyWorkouts.find(
      (w: Workout) =>
        w.scheduledDate.getDate() === date.getDate() &&
        w.scheduledDate.getMonth() === date.getMonth() &&
        w.scheduledDate.getFullYear() === date.getFullYear(),
    )

    calendarDays.push({
      day: weekDays[date.getDay()],
      date: date.getDate(),
      isToday: i === 0,
      isSelected: false, // Will be set based on selected date
      hasWorkout: !!workoutForDate,
      workoutType: workoutForDate?.type,
      workoutColor: workoutForDate ? workoutColorMap[workoutForDate.type] : undefined,
      fullDate: new Date(date),
    })
  }

  // Update handleDateClick function:
  const handleDateClick = (day: any) => {
    if (day.hasWorkout && !day.isToday) {
      const workout = weeklyWorkouts.find(
        (w) =>
          w.scheduledDate.getDate() === day.fullDate.getDate() &&
          w.scheduledDate.getMonth() === day.fullDate.getMonth() &&
          w.scheduledDate.getFullYear() === day.fullDate.getFullYear(),
      )
      if (workout) {
        setSelectedDateWorkout({
          type: workout.type,
          distance: workout.distance ? `${workout.distance}km` : undefined,
          duration: workout.duration ? `${workout.duration}min` : undefined,
          completed: workout.completed,
          color: workoutColorMap[workout.type],
          date: workout.scheduledDate,
          dateString: workout.scheduledDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
          notes: workout.notes,
        })
        setShowDateWorkoutModal(true)
      }
    }
  }

  const handleActionClick = (action: string) => {
    switch (action) {
      case "route":
        setShowRoutesModal(true)
        break
      case "remove":
        if (confirm("Are you sure you want to remove today's workout?")) {
          alert("Workout removed from your plan!")
        }
        break
      case "reschedule":
        setShowRescheduleModal(true)
        break
      case "watch":
        alert("Connecting to watch... This feature will sync with Apple Watch, Garmin, and other devices!")
        break
      case "music":
        alert("Opening music selection... Connect with Spotify, Apple Music, or choose from your playlists!")
        break
      case "start":
        // Navigate to record screen
        if (typeof window !== "undefined") {
          const event = new CustomEvent("navigate-to-record")
          window.dispatchEvent(event)
        }
        break
      case "chat":
        // Navigate to chat screen
        if (typeof window !== "undefined") {
          const event = new CustomEvent("navigate-to-chat")
          window.dispatchEvent(event)
        }
        break
      case "analytics":
        // Navigate to analytics screen
        if (typeof window !== "undefined") {
          const event = new CustomEvent("navigate-to-analytics")
          window.dispatchEvent(event)
        }
        break
      case "coaching-preferences":
        setShowCoachingPreferences(true)
        break
      case "coaching-feedback":
        setShowCoachingFeedback(true)
        break
      default:
        break
    }
  }

  const workoutBreakdown = [
    {
      phase: "Warm-up",
      color: "bg-gray-500",
      steps: [
        {
          step: 1,
          description: "500m at a conversational pace",
          detail: "No faster than 6:00/km",
          type: "RUN",
        },
      ],
    },
    {
      phase: "Main Workout",
      color: "bg-orange-500",
      repeat: "x3",
      steps: [
        {
          step: 2,
          description: "1km at 5:20/km",
          type: "RUN",
        },
        {
          step: 3,
          description: "1km at 5:10/km",
          type: "RUN",
        },
        {
          step: 4,
          description: "1km at 5:00/km",
          type: "RUN",
        },
      ],
    },
    {
      phase: "Cool Down",
      color: "bg-gray-500",
      steps: [
        {
          step: 5,
          description: "500m at a conversational pace",
          detail:
            "or slower! Since you've worked at a particularly high intensity today with a semi short cool down, walk for 5-10 minutes to",
          type: "RUN",
        },
      ],
    },
  ]

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center animate-in fade-in-50 duration-300">
        <div>
          <h1 className="text-2xl font-bold">{plan?.title || "Beginner Plan"}</h1>
        </div>
        <div className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full hover:scale-105 transition-transform">
          <Sun className="h-4 w-4" />
          <span className="text-sm font-medium">22°C</span>
        </div>
      </div>

      {/* Streak Indicator */}
      <StreakIndicator />

      {/* Calendar Strip */}
      <div className="flex gap-2 overflow-x-auto pb-2 animate-in slide-in-from-left duration-500">
        {calendarDays.map((day, index) => {
          const isSelected = day.isToday // For now, today is selected
          return (
            <div
              key={index}
              className={`flex-shrink-0 text-center p-3 rounded-lg min-w-[60px] transition-all duration-300 hover:scale-105 cursor-pointer ${
                isSelected ? "bg-black text-white shadow-lg" : "bg-white border hover:shadow-md"
              }`}
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => handleDateClick(day)}
            >
              <div className="text-xs font-medium">{day.day}</div>
              <div className="text-lg font-bold">{day.date}</div>
              {day.hasWorkout && (
                <div className="flex justify-center mt-1">
                  <div className={`w-2 h-2 rounded-full ${day.workoutColor || "bg-green-500"}`} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* RUN Progress Indicator */}
      <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
        <Play className="h-4 w-4 text-gray-700" />
        <span className="font-medium text-gray-700">RUN</span>
        {isLoadingWorkout ? (
          <Loader2 className="h-4 w-4 animate-spin ml-auto" role="status" aria-label="Loading" />
        ) : (
          <span className="ml-auto text-lg font-bold">
            {weeklyWorkouts.filter((w) => w.completed && w.type !== 'rest').length}/{weeklyWorkouts.filter((w) => w.type !== 'rest').length}
          </span>
        )}
      </div>

      {/* Today's Workout */}
      <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-in fade-in-50 duration-500">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-blue-100 text-blue-800 text-xs">SCHEDULE</Badge>
                <span className="text-sm text-gray-700">
                  {todaysWorkout?.scheduledDate 
                    ? `${todaysWorkout.scheduledDate.getDate()} ${todaysWorkout.scheduledDate.toLocaleDateString("en-US", { month: "short" }).toUpperCase()} ${todaysWorkout.scheduledDate.getFullYear()}`
                    : `${new Date().getDate()} ${new Date().toLocaleDateString("en-US", { month: "short" }).toUpperCase()} ${new Date().getFullYear()}`}
                </span>
              </div>
              {isLoadingWorkout ? (
                <Loader2 className="h-6 w-6 animate-spin text-gray-700" role="status" aria-label="Loading" />
              ) : todaysWorkout ? (
                <>
                  <CardTitle className="text-xl mb-1">
                    {todaysWorkout.type.charAt(0).toUpperCase() + todaysWorkout.type.slice(1)} Recovery Run
                  </CardTitle>
                  <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                    <span className="lowercase">{todaysWorkout.type}</span>
                    <span>•</span>
                    <span>{todaysWorkout.distance ? `${todaysWorkout.distance}km` : todaysWorkout.duration ? `${todaysWorkout.duration}min` : 'N/A'}</span>
                    <Badge className="bg-blue-100 text-blue-800 text-xs ml-2">Best for: Consistency</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-gray-700" />
                    <span className="text-lg font-semibold">
                      {todaysWorkout.duration 
                        ? `${Math.max(20, todaysWorkout.duration - 5)}-${todaysWorkout.duration + 5}m`
                        : todaysWorkout.distance 
                        ? `${Math.round(todaysWorkout.distance * 5)}-${Math.round(todaysWorkout.distance * 7)}m`
                        : '20-25m'}
                    </span>
                  </div>
                </>
              ) : (
                <CardTitle className="text-xl mb-1">Rest Day</CardTitle>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Action Buttons */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: StretchHorizontal, label: "WARM-UP\nSTRETCHES", action: "stretches" },
              { icon: MapPin, label: "ADD\nROUTE", action: "route" },
              { icon: Link, label: "LINK\nACTIVITY", action: "link" },
              { icon: Trash2, label: "REMOVE\nWORKOUT", action: "remove", color: "text-red-500" },
            ].map((actionItem, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className={`flex flex-col items-center gap-1 h-16 px-2 bg-transparent hover:scale-105 transition-all duration-200 ${
                  actionItem.color || "hover:bg-gray-50"
                }`}
                onClick={() => handleActionClick(actionItem.action)}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <actionItem.icon className="h-5 w-5" />
                <span className="text-xs text-center leading-tight whitespace-pre-line">{actionItem.label}</span>
              </Button>
            ))}
          </div>

          {/* Environment Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <Button variant="default" size="sm" className="flex-1 bg-black text-white hover:bg-gray-800">
              OUTDOOR
            </Button>
            <Button variant="ghost" size="sm" className="flex-1">
              TREADMILL
            </Button>
          </div>

          {/* Workout Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <div className="w-4 h-4 border border-gray-400 rounded" />
                Description
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowWorkoutBreakdown(!showWorkoutBreakdown)}
                className="text-gray-700 hover:text-black"
              >
                {showWorkoutBreakdown ? "COLLAPSE" : "EXPAND"}
                {showWorkoutBreakdown ? (
                  <ChevronUp className="h-4 w-4 ml-1" />
                ) : (
                  <ChevronDown className="h-4 w-4 ml-1" />
                )}
              </Button>
            </div>

            {showWorkoutBreakdown && (
              <div className="space-y-3 animate-in slide-in-from-top duration-300">
                {workoutBreakdown.map((phase, phaseIndex) => (
                  <div key={phaseIndex}>
                    {/* Phase Header */}
                    <div
                      className={`${phase.color} text-white px-3 py-2 rounded-t-lg flex items-center justify-between`}
                    >
                      <span className="font-medium">{phase.phase}</span>
                      {phase.repeat && (
                        <Badge className="bg-white/20 text-white border-white/30">Repeat {phase.repeat}</Badge>
                      )}
                    </div>

                    {/* Phase Steps */}
                    <div className="bg-gray-50 rounded-b-lg">
                      {phase.steps.map((step, stepIndex) => (
                        <div
                          key={stepIndex}
                          className="flex items-center gap-4 p-4 border-b border-gray-200 last:border-b-0"
                        >
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-700">
                            {step.step}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{step.description}</p>
                            {('detail' in step) && step.detail && <p className="text-sm text-gray-700 mt-1">{step.detail}</p>}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            <Play className="h-3 w-3 mr-1" />
                            {step.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Start Workout Button */}
          <div className="flex gap-3">
            <Button
              className="flex-1 bg-black hover:bg-gray-800 text-white h-12 text-lg font-medium"
              onClick={() => handleActionClick("start")}
            >
              <Play className="h-5 w-5 mr-2" />
              Start Workout
            </Button>
            <Button variant="outline" size="sm" className="w-12 h-12 bg-transparent">
              <Music className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Run and Activity Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100 h-12"
          onClick={() => setShowAddRunModal(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Run to Plan
        </Button>
        <Button
          variant="outline"
          className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100 h-12"
          onClick={() => setShowAddActivityModal(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Activity
        </Button>
      </div>

      {/* Building Your Running Habit Info Card */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg">🏃</span>
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-green-900 mb-1">Building Your Running Habit</h3>
              <p className="text-sm text-green-800">
                Listen to your body. Rest days are just as important as running days for beginners. Consistency is key! Every run, no matter how short, builds your habit.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Your Progress Section */}
      {(() => {
        // Calculate streak
        const calculateStreak = () => {
          if (!weeklyWorkouts.length) return 0
          const sortedWorkouts = [...weeklyWorkouts]
            .filter(w => w.completed && w.type !== 'rest')
            .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
          
          if (sortedWorkouts.length === 0) return 0
          
          let streak = 0
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          
          for (let i = 0; i < sortedWorkouts.length; i++) {
            const workoutDate = new Date(sortedWorkouts[i].scheduledDate)
            workoutDate.setHours(0, 0, 0, 0)
            const daysDiff = Math.floor((today.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24))
            
            if (daysDiff === i) {
              streak++
            } else {
              break
            }
          }
          
          return streak
        }
        
        // Calculate total runs
        const totalRuns = weeklyWorkouts.filter(w => w.completed && w.type !== 'rest').length
        
        // Calculate consistency
        const plannedRuns = weeklyWorkouts.filter(w => w.type !== 'rest').length
        const consistency = plannedRuns > 0 
          ? Math.round((totalRuns / plannedRuns) * 100) 
          : 0
        
        const streak = calculateStreak()
        
        return (
          <Card className="hover:shadow-lg transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-lg">Your Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingWorkout ? (
                <div className="flex justify-center items-center h-24" role="status" aria-label="Loading">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-700" aria-hidden="true" />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-800">{streak}</div>
                    <div className="text-xs text-gray-600 mt-1">Day Streak</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-800">{totalRuns}</div>
                    <div className="text-xs text-gray-600 mt-1">Total Runs</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-800">{consistency}%</div>
                    <div className="text-xs text-gray-600 mt-1">Consistency</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })()}

      {/* Habit Analytics Widget */}
      {userId && (
        <HabitAnalyticsWidget
          userId={userId}
          showDetails={false}
          className="hover:shadow-lg transition-all duration-300"
        />
      )}

      {/* Adaptive Coaching Widget */}
      {userId && (
        <CoachingInsightsWidget
          userId={userId}
          showDetails={true}
          onSettingsClick={() => setShowCoachingPreferences(true)}
          className="hover:shadow-lg transition-all duration-300"
        />
      )}

      {/* Recovery Recommendations */}
      {userId && (
        <RecoveryRecommendations
          userId={userId}
          date={new Date()}
          showBreakdown={true}
          onRefresh={() => {
            console.log('Refreshing recovery recommendations and workouts...');
            refreshWorkouts();
          }}
        />
      )}

      {/* Goal Recommendations */}
      {userId && (
        <GoalRecommendations
          userId={userId}
          className="hover:shadow-lg transition-all duration-300"
        />
      )}

      {/* Community Stats Widget */}
      {userId && <CommunityStatsWidget userId={userId} />}

      {/* Modals */}
      {showAddRunModal && <AddRunModal isOpen={showAddRunModal} onClose={() => setShowAddRunModal(false)} />}
      {showAddActivityModal && (
        <AddActivityModal isOpen={showAddActivityModal} onClose={() => setShowAddActivityModal(false)} />
      )}
      {showRoutesModal && <RouteSelectorModal isOpen={showRoutesModal} onClose={() => setShowRoutesModal(false)} />}
      {showRescheduleModal && (
        <RescheduleModal isOpen={showRescheduleModal} onClose={() => setShowRescheduleModal(false)} />
      )}
      {showDateWorkoutModal && (
        <DateWorkoutModal
          isOpen={showDateWorkoutModal}
          onClose={() => {
            setShowDateWorkoutModal(false)
            setSelectedDateWorkout(null)
          }}
          workout={selectedDateWorkout}
        />
      )}
      
      {/* Coaching Modals */}
      {showCoachingPreferences && userId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Coaching Preferences</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCoachingPreferences(false)}
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
      
      {showCoachingFeedback && userId && (
        <CoachingFeedbackModal
          isOpen={showCoachingFeedback}
          onClose={() => setShowCoachingFeedback(false)}
          interactionType="workout_recommendation"
          userId={userId}
          {...(lastCoachingInteraction
            ? { interactionId: lastCoachingInteraction }
            : {})}
          initialContext={{
            timeOfDay: new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening',
            weather: '22°C sunny',
            recentPerformance: todaysWorkout?.completed ? 'completed_workout' : 'scheduled_workout'
          }}
        />
      )}
    </div>
  )
}
