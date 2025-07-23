'use client';

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, CalendarDays, TrendingUp, Plus, ChevronLeft, ChevronRight, MoreHorizontal, Loader2 } from "lucide-react"
import { AddRunModal } from "@/components/add-run-modal"
import { MonthlyCalendarView } from "@/components/monthly-calendar-view"
import { dbUtils, type Plan, type Workout } from "@/lib/db"
import { useToast } from "@/hooks/use-toast"
import RecoveryRecommendations from "@/components/recovery-recommendations"

export function PlanScreen() {
  const [currentView, setCurrentView] = useState<"monthly" | "biweekly" | "progress">("biweekly")
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showAddRunModal, setShowAddRunModal] = useState(false)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  const workoutTypes = {
    easy: { color: "bg-green-500", label: "Easy Run" },
    tempo: { color: "bg-orange-500", label: "Tempo" },
    intervals: { color: "bg-pink-500", label: "Intervals" },
    long: { color: "bg-blue-500", label: "Long Run" },
    "time-trial": { color: "bg-red-500", label: "Time Trial" },
    hill: { color: "bg-purple-500", label: "Hill Run" },
    rest: { color: "bg-gray-400", label: "Rest Day" },
  }

  // Load plan data on component mount
  useEffect(() => {
    const loadPlanData = async () => {
      try {
        const user = await dbUtils.getCurrentUser()
        if (!user) {
          setIsLoading(false)
          return
        }

        let activePlan = await dbUtils.getActivePlan(user.id!)
        
        // Fallback: if no active plan found, ensure user has one
        if (!activePlan) {
          console.log('No active plan found, attempting to create/recover one...')
          try {
            activePlan = await dbUtils.ensureUserHasActivePlan(user.id!)
            console.log('Successfully created/recovered plan:', activePlan.title)
          } catch (planError) {
            const errorInfo = dbUtils.handlePlanError(planError, 'creation/recovery')
            toast({
              variant: "destructive",
              title: errorInfo.title,
              description: errorInfo.description,
            })
            throw planError
          }
        }
        
        if (activePlan) {
          setPlan(activePlan)
          const planWorkouts = await dbUtils.getWorkoutsByPlan(activePlan.id!)
          setWorkouts(planWorkouts)
        }
      } catch (error) {
        const errorInfo = dbUtils.handlePlanError(error, 'loading')
        toast({
          title: errorInfo.title,
          description: errorInfo.description,
          variant: "destructive"
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadPlanData()
  }, [toast])

  // Organize workouts by week
  const organizeWorkoutsByWeek = () => {
    if (!workouts.length) return []

    const weekMap = new Map<number, Workout[]>()
    
    workouts.forEach(workout => {
      if (!weekMap.has(workout.week)) {
        weekMap.set(workout.week, [])
      }
      weekMap.get(workout.week)!.push(workout)
    })

    const weeks = Array.from(weekMap.entries()).map(([weekNumber, weekWorkouts]) => {
      const sortedWorkouts = weekWorkouts.sort((a, b) => {
        const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day)
      })

      const completed = sortedWorkouts.filter(w => w.completed).length
      const total = sortedWorkouts.length
      const totalDistance = sortedWorkouts.reduce((sum, w) => sum + w.distance, 0)

      // Calculate date range for the week
      const firstWorkout = sortedWorkouts[0]
      const weekStart = new Date(firstWorkout.scheduledDate)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Monday
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6) // Sunday

      return {
        title: `Week ${weekNumber}`,
        dates: `${weekStart.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`,
        completed,
        total,
        distance: `${totalDistance.toFixed(1)}km`,
        workouts: sortedWorkouts.map(w => ({
          day: w.day,
          type: w.type,
          distance: `${w.distance}km`,
          completed: w.completed,
          id: w.id
        }))
      }
    })

    return weeks.sort((a, b) => {
      const weekA = parseInt(a.title.split(' ')[1])
      const weekB = parseInt(b.title.split(' ')[1])
      return weekA - weekB
    })
  }

  const weeks = organizeWorkoutsByWeek()

  const renderBiweeklyView = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12" role="status" aria-label="Loading">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" aria-hidden="true" />
          <span className="ml-2 text-gray-600">Loading your training plan...</span>
        </div>
      )
    }

    if (!plan || weeks.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">No training plan found</div>
          <Button onClick={() => window.location.reload()} className="bg-green-500 hover:bg-green-600">
            Refresh
          </Button>
        </div>
      )
    }

    return (
      <div className="space-y-6 animate-in fade-in-50 duration-300">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="hover:scale-105 transition-transform">
            <ChevronLeft className="h-4 w-4" role="img" aria-label="Previous" />
          </Button>
          <h2 className="font-semibold">{plan.title}</h2>
          <Button variant="ghost" size="sm" className="hover:scale-105 transition-transform">
            <ChevronRight className="h-4 w-4" role="img" aria-label="Next" />
          </Button>
        </div>

      {weeks.map((week, weekIndex) => (
        <Card key={weekIndex} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardHeader className="pb-3">
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-600">{week.dates}</p>
                  <h3 className="font-bold text-lg">{week.title}</h3>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: week.total }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        i < week.completed ? "bg-green-500 scale-110" : "bg-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-4 text-xs text-gray-600">
                <span>Total Workouts: {week.total}</span>
                <span>Distance: {week.distance}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {week.workouts.map((workout, workoutIndex) => (
              <div
                key={workoutIndex}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 hover:scale-[1.02] ${
                  workout.completed ? "bg-green-50 border-green-200" : "bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full transition-all duration-300 ${
                      workoutTypes[workout.type as keyof typeof workoutTypes]?.color || "bg-gray-400"
                    }`}
                  />
                  <div className="text-sm font-medium">{workout.day}</div>
                  <div className="text-sm">
                    <span className="font-medium">
                      {workoutTypes[workout.type as keyof typeof workoutTypes]?.label || workout.type}
                    </span>
                    <span className="text-gray-600 ml-2">{workout.distance}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="hover:scale-110 transition-transform">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-600 hover:bg-green-50 hover:text-green-600 transition-all duration-200"
              onClick={() => setShowAddRunModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Workout
            </Button>
          </CardContent>
        </Card>
      ))}

      {/* Coach Tip */}
      <Card className="bg-blue-50 border-blue-200 hover:shadow-md transition-all duration-300">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
              <span className="text-white text-sm">🤖</span>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-blue-900">Let's keep your progress going</h4>
              <p className="text-sm text-blue-800 mt-1">Missed workouts? Skip or add them to this week.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    )
  }

  const renderProgressView = () => (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Your Improvement Journey</h2>
        <select className="text-sm border rounded px-2 py-1 hover:border-green-500 transition-colors">
          <option>Last Month</option>
          <option>Last 3 Months</option>
          <option>Last 6 Months</option>
        </select>
      </div>

      {/* Metrics Improvement */}
      <div className="space-y-4">
        {[
          { metric: "Average Pace", before: "6:15", after: "5:12", improvement: "-18%", icon: "⏱️" },
          { metric: "Distance", before: "2.1km", after: "3.2km", improvement: "+52%", icon: "📏" },
          { metric: "Recovery", before: "High", after: "Low", improvement: "Better", icon: "❤️" },
        ].map((item, index) => (
          <Card key={index} className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg animate-bounce" style={{ animationDelay: `${index * 0.2}s` }}>
                    {item.icon}
                  </span>
                  <h3 className="font-medium">{item.metric}</h3>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800 animate-pulse">
                  {item.improvement}
                </Badge>
              </div>
              <div className="flex items-center justify-between mt-3 text-sm">
                <div className="text-center">
                  <p className="text-gray-600">30 days ago</p>
                  <p className="font-bold text-gray-400">{item.before}</p>
                </div>
                <div className="text-green-500 animate-pulse">→</div>
                <div className="text-center">
                  <p className="text-gray-600">Now</p>
                  <p className="font-bold text-green-600">{item.after}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Achievements */}
      <Card className="hover:shadow-lg transition-all duration-300">
        <CardHeader>
          <CardTitle>Recent Achievements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { title: "First 5K", desc: "Completed your first 5K run!", date: "3 days ago", unlocked: true },
            { title: "Week Warrior", desc: "Completed all runs this week", date: "1 week ago", unlocked: true },
            { title: "Speed Demon", desc: "Run sub-5:00 pace", progress: "2.1km to go", unlocked: false },
          ].map((achievement, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 hover:scale-[1.02] ${
                achievement.unlocked ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50"
              }`}
            >
              <div
                className={`text-2xl transition-all duration-300 ${achievement.unlocked ? "animate-bounce" : "grayscale"}`}
              >
                {index === 0 ? "🏅" : index === 1 ? "🔥" : "🏆"}
              </div>
              <div className="flex-1">
                <h4 className="font-medium">{achievement.title}</h4>
                <p className="text-sm text-gray-600">{achievement.desc}</p>
                <p className="text-xs text-gray-500">{achievement.date || achievement.progress}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Training Plan</h1>
          <div className="text-sm text-gray-600">
            <span className="font-medium">21-Day Rookie Challenge</span>
            <span className="mx-2">•</span>
            <span>Day 5 of 21</span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="hover:scale-105 transition-transform hover:bg-green-50 bg-transparent"
          onClick={() => setShowAddRunModal(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* View Toggle */}
      <div className="flex bg-gray-100 rounded-lg p-1">
        {[
          { id: "monthly", icon: Calendar, label: "Monthly" },
          { id: "biweekly", icon: CalendarDays, label: "Biweekly" },
          { id: "progress", icon: TrendingUp, label: "Progress" },
        ].map((view) => (
          <Button
            key={view.id}
            variant={currentView === view.id ? "default" : "ghost"}
            size="sm"
            className={`flex-1 transition-all duration-200 ${
              currentView === view.id ? "scale-105 shadow-sm" : "hover:scale-102"
            }`}
            onClick={() => setCurrentView(view.id as any)}
          >
            <view.icon className="h-4 w-4 mr-1" />
            {view.label}
          </Button>
        ))}
      </div>

      {/* Content */}
      {currentView === "monthly" && <MonthlyCalendarView />}
      {currentView === "biweekly" && renderBiweeklyView()}
      {currentView === "progress" && renderProgressView()}

      {/* Recovery Status */}
      <RecoveryRecommendations
        userId={1}
        date={new Date()}
        showBreakdown={false}
        onRefresh={() => {
          console.log('Refreshing recovery data for plan view...');
        }}
      />

      {showAddRunModal && <AddRunModal isOpen={showAddRunModal} onClose={() => setShowAddRunModal(false)} />}
    </div>
  )
}
