'use client';

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
} from "lucide-react"
import { AddRunModal } from "@/components/add-run-modal"
import { AddActivityModal } from "@/components/add-activity-modal"
import { RouteSelectorModal } from "@/components/route-selector-modal"
import { RescheduleModal } from "@/components/reschedule-modal"
import { DateWorkoutModal } from "@/components/date-workout-modal"
import { dbUtils, type Workout } from "@/lib/db"
import { useToast } from "@/hooks/use-toast"
import { StreakIndicator } from "@/components/streak-indicator"
import { CommunityStatsWidget } from "@/components/community-stats-widget"

export function TodayScreen() {
  const [dailyTip, setDailyTip] = useState(
    "Focus on your breathing rhythm today. Try the 3:2 pattern - inhale for 3 steps, exhale for 2 steps. This will help you maintain a steady pace!",
  )

  const [showWorkoutBreakdown, setShowWorkoutBreakdown] = useState(false)
  const [todaysWorkout, setTodaysWorkout] = useState<Workout | null>(null)
  const [isLoadingWorkout, setIsLoadingWorkout] = useState(true)
  const [weeklyWorkouts, setWeeklyWorkouts] = useState<Workout[]>([])
  const [userId, setUserId] = useState<number | null>(null)
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

  // Load today's workout and weekly workouts
  useEffect(() => {
    const loadWorkouts = async () => {
      try {
        const user = await dbUtils.getCurrentUser()
        if (user) {
          setUserId(user.id || null)
          const today = new Date()
          const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay())) // Sunday
          const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6)) // Saturday

          const allWorkouts = await dbUtils.getWorkoutsForDateRange(user.id!, startOfWeek, endOfWeek)
          setWeeklyWorkouts(allWorkouts)

          const todays = allWorkouts.find(
            (w) =>
              w.scheduledDate.getDate() === new Date().getDate() &&
              w.scheduledDate.getMonth() === new Date().getMonth() &&
              w.scheduledDate.getFullYear() === new Date().getFullYear(),
          )
          setTodaysWorkout(todays || null)
        }
      } catch (error) {
        console.error('Failed to load workouts:', error)
        toast({
          title: "Error",
          description: "Failed to load workouts.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingWorkout(false)
      }
    }

    loadWorkouts()
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
          <h1 className="text-2xl font-bold">Today</h1>
          <div className="text-sm text-gray-700 flex items-center gap-2">
            <span className="font-medium">Week 2/9</span>
            <ChevronDown className="h-3 w-3" />
          </div>
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
        {calendarDays.map((day, index) => (
          <div
            key={index}
            className={`flex-shrink-0 text-center p-3 rounded-lg min-w-[60px] transition-all duration-300 hover:scale-105 cursor-pointer ${
              day.isToday ? "bg-black text-white shadow-lg" : "bg-white border hover:shadow-md"
            }`}
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => handleDateClick(day)}
          >
            <div className="text-xs font-medium">{day.day.toUpperCase()}</div>
            <div className="text-lg font-bold">{day.date}</div>
            {day.hasWorkout && (
              <div className="flex justify-center mt-1">
                <div className={`w-2 h-2 rounded-full ${day.workoutColor || "bg-green-500"}`} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Weekly Progress */}
      <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4" />
          <span className="font-medium">WEEKLY PROGRESS</span>
        </div>
        {isLoadingWorkout ? (
          <Loader2 className="h-4 w-4 animate-spin" role="status" aria-label="Loading" />
        ) : (
          <div className="text-lg font-bold">
            {weeklyWorkouts.filter((w) => w.completed).length}/{weeklyWorkouts.length}
          </div>
        )}
      </div>

      {/* Today's Workout */}
      <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-in fade-in-50 duration-500">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-blue-100 text-blue-800 text-xs">SCHEDULE</Badge>
                <span className="text-sm text-gray-700">9 JUL 2025</span>
              </div>
              {isLoadingWorkout ? (
                <Loader2 className="h-6 w-6 animate-spin text-gray-700" role="status" aria-label="Loading" />
              ) : todaysWorkout ? (
                <>
                  <CardTitle className="text-xl mb-1">{todaysWorkout.type.charAt(0).toUpperCase() + todaysWorkout.type.slice(1)} Run</CardTitle>
                  <div className="flex items-center gap-4 text-sm text-gray-700">
                    <span className="flex items-center gap-1">
                      <Zap className="h-4 w-4" />
                      {todaysWorkout.distance ? `${todaysWorkout.distance}km` : todaysWorkout.duration ? `${todaysWorkout.duration}min` : 'N/A'}
                    </span>
                    <Badge className="bg-blue-100 text-blue-800 text-xs">Best for: Balanced</Badge>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <Clock className="h-4 w-4 text-gray-700" />
                    <span className="text-lg font-semibold">
                      {todaysWorkout.duration ? `${todaysWorkout.duration}m` : `${todaysWorkout.distance}km`}
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

      {/* Action Buttons */}
      <div className="space-y-3 animate-in slide-in-from-bottom duration-500">
        <Button
          className="w-full bg-green-500 hover:bg-green-600 h-12 hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl"
          onClick={() => setShowAddRunModal(true)}
        >
          <CalendarPlus className="h-5 w-5 mr-2" />
          Add Run to Plan
        </Button>
        <Button
          variant="outline"
          className="w-full h-12 bg-transparent hover:scale-[1.02] transition-all duration-200 hover:bg-green-50"
          onClick={() => setShowAddActivityModal(true)}
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Activity
        </Button>
      </div>

      {/* Coach Tip */}
      <Card className="bg-blue-50 border-blue-200 hover:shadow-md transition-all duration-300">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
              <img
                src="/placeholder.svg?height=40&width=40"
                alt="Coach"
                className="w-full h-full object-cover bg-green-500"
              />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-blue-900 mb-1">Let's keep your progress going</h4>
              <p className="text-sm text-blue-800">Missed workouts? Skip or add them to this week.</p>
            </div>
            <Button variant="ghost" size="sm" className="text-blue-600"
              onClick={() => handleActionClick("chat")}>
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Progress Stats */}
      <Card className="hover:shadow-lg transition-all duration-300 animate-in fade-in-50 duration-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Your Progress</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleActionClick("analytics")}
              className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm">Analytics</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingWorkout ? (
            <div className="flex justify-center items-center h-24" role="status" aria-label="Loading">
              <Loader2 className="h-8 w-8 animate-spin text-gray-700" aria-hidden="true" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="hover:scale-105 transition-transform cursor-pointer">
                <div className="text-2xl font-bold text-green-500 animate-pulse">{weeklyWorkouts.filter(w => w.completed).length}</div>
                <div className="text-xs text-gray-700">Completed This Week</div>
              </div>
              <div className="hover:scale-105 transition-transform cursor-pointer">
                <div className="text-2xl font-bold text-blue-500 animate-pulse">{weeklyWorkouts.length}</div>
                <div className="text-xs text-gray-700">Scheduled This Week</div>
              </div>
              <div className="hover:scale-105 transition-transform cursor-pointer">
                <div className="text-2xl font-bold text-purple-500 animate-pulse">
                  {weeklyWorkouts.length > 0
                    ? `${Math.round((weeklyWorkouts.filter(w => w.completed).length / weeklyWorkouts.length) * 100)}%`
                    : '0%'}
                </div>
                <div className="text-xs text-gray-700">Week Complete</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
    </div>
  )
}
