'use client';

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Calendar, CalendarDays, TrendingUp, Plus, ChevronLeft, ChevronRight, MoreHorizontal, Loader2 } from "lucide-react"
import { AddRunModal } from "@/components/add-run-modal"
import { DateWorkoutModal } from "@/components/date-workout-modal"
import { MonthlyCalendarView } from "@/components/monthly-calendar-view"
import { PlanComplexityIndicator } from "@/components/plan-complexity-indicator"
import { type Plan, type Workout, type Goal, type ChallengeProgress, type ChallengeTemplate } from "@/lib/db"
import { dbUtils } from "@/lib/dbUtils"
import { useToast } from "@/hooks/use-toast"
import { useData } from "@/contexts/DataContext"
import RecoveryRecommendations from "@/components/recovery-recommendations"
import { formatLocalizedDate } from "@/lib/timezone-utils"
import { RunSmartBrandMark } from "@/components/run-smart-brand-mark"
import { getActiveChallenge, getDailyChallengeData } from "@/lib/challengeEngine"
import { NextChallengeRecommendation } from "@/components/next-challenge-recommendation"
import { getNextChallengeRecommendation } from "@/lib/challengeTemplates"
import { startChallenge } from "@/lib/challengeEngine"

export function PlanScreen() {
  // Get shared data from context
  const {
    plan: contextPlan,
    primaryGoal,
    userId,
  } = useData()

  const [currentView, setCurrentView] = useState<"monthly" | "biweekly" | "progress">("monthly")
  const [showAddRunModal, setShowAddRunModal] = useState(false)
  const [showDateWorkoutModal, setShowDateWorkoutModal] = useState(false)
  const [selectedDateWorkout, setSelectedDateWorkout] = useState<any>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeChallenge, setActiveChallenge] = useState<{ progress: ChallengeProgress; template: ChallengeTemplate } | null>(null)
  const [recommendedChallenge, setRecommendedChallenge] = useState<ChallengeTemplate | null>(null)
  const { toast } = useToast()

  // Sync plan from context
  useEffect(() => {
    if (contextPlan) {
      setPlan(contextPlan)
    }
  }, [contextPlan])

  // Load active challenge
  useEffect(() => {
    const loadChallengeData = async () => {
      if (!userId) {
        setActiveChallenge(null)
        setRecommendedChallenge(null)
        return
      }

      try {
        const challenge = await getActiveChallenge(userId)

        if (challenge) {
          setActiveChallenge(challenge)
          setRecommendedChallenge(null)
        } else {
          // No active challenge, check if we should recommend one
          setActiveChallenge(null)
          // Get recommendation based on completed challenges
          const recommendation = getNextChallengeRecommendation()
          setRecommendedChallenge(recommendation)
        }
      } catch (error) {
        console.error("Error loading challenge data:", error)
        setActiveChallenge(null)
        setRecommendedChallenge(null)
      }
    }

    loadChallengeData()
  }, [userId])

  // Calculate challenge day progress
  const calculateChallengeProgress = () => {
    // If we have an active challenge, use its progress
    if (activeChallenge) {
      const dailyData = getDailyChallengeData(
        activeChallenge.progress,
        activeChallenge.template
      )
      return { currentDay: dailyData.currentDay, totalDays: dailyData.totalDays }
    }

    // Fallback to plan-based calculation
    if (!plan || !plan.startDate) {
      return { currentDay: 0, totalDays: 21 }
    }

    const startDate = new Date(plan.startDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    startDate.setHours(0, 0, 0, 0)

    const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const totalDays = plan.totalWeeks ? plan.totalWeeks * 7 : 21
    const currentDay = Math.max(1, Math.min(daysDiff + 1, totalDays))

    return { currentDay, totalDays }
  }

  const challengeProgress = calculateChallengeProgress()

  // Handle starting a new challenge
  const handleStartChallenge = async (template: ChallengeTemplate) => {
    if (!userId || !plan) {
      toast({
        title: "Cannot start challenge",
        description: "Please complete onboarding first",
        variant: "destructive",
      })
      return
    }

    try {
      await startChallenge(userId, template.slug, plan.id!)

      // Reload challenge data
      const challenge = await getActiveChallenge(userId)
      setActiveChallenge(challenge)
      setRecommendedChallenge(null)

      toast({
        title: "Challenge Started! 🎉",
        description: `${template.name} challenge has begun`,
      })
    } catch (error) {
      console.error("Error starting challenge:", error)
      toast({
        title: "Failed to start challenge",
        description: "Please try again",
        variant: "destructive",
      })
    }
  }

  // Legacy helper for backward compatibility
  const goalProgressPercent = (goal?: Goal | null) => {
    if (!goal) return 0
    // Use stored progressPercentage if available
    if (typeof goal.progressPercentage === 'number' && goal.progressPercentage >= 0) {
      return Math.min(100, Math.max(0, goal.progressPercentage))
    }
    const baseline = typeof goal.baselineValue === 'number' ? goal.baselineValue : 0
    const target = typeof goal.targetValue === 'number' ? goal.targetValue : 0
    const current = typeof goal.currentValue === 'number' ? goal.currentValue : baseline
    const denominator = target - baseline
    if (denominator === 0) return current === target ? 100 : 0
    if (goal.goalType === 'time_improvement') {
      return Math.min(100, Math.max(0, ((baseline - current) / (baseline - target)) * 100))
    }
    return Math.min(100, Math.max(0, ((current - baseline) / denominator) * 100))
  }

  const getDaysRemaining = (goal?: Goal | null) => {
    if (!goal?.timeBound?.deadline) return null
    const deadline = new Date(goal.timeBound.deadline)
    const deadlineTime = deadline.getTime()
    if (Number.isNaN(deadlineTime)) return null
    const diff = Math.ceil((deadlineTime - Date.now()) / (1000 * 60 * 60 * 24))
    return diff < 0 ? 0 : diff
  }

  const workoutTypes = {
    easy: { color: "bg-primary", label: "Easy Run" },
    tempo: { color: "bg-orange-500", label: "Tempo" },
    intervals: { color: "bg-pink-500", label: "Intervals" },
    long: { color: "bg-blue-500", label: "Long Run" },
    "time-trial": { color: "bg-red-500", label: "Time Trial" },
    hill: { color: "bg-purple-500", label: "Hill Run" },
    rest: { color: "bg-border", label: "Rest Day" },
  }

  // Load workouts when plan is available (plan and primaryGoal come from context)
  useEffect(() => {
    const loadWorkouts = async () => {
      if (!userId || !plan?.id) {
        setIsLoading(false)
        return
      }

      try {
        const planWorkouts = await dbUtils.getPlanWorkouts(plan.id)
        setWorkouts(planWorkouts)
        console.log('📅 PlanScreen: Loaded', planWorkouts.length, 'workouts for plan', plan.id)
      } catch (error) {
        const errorInfo = dbUtils.handleDatabaseError(error, 'loading')
        toast({
          title: errorInfo.title,
          description: errorInfo.description,
          variant: "destructive"
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadWorkouts()
  }, [userId, plan?.id, toast])

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
      const firstWorkout = sortedWorkouts[0]!
      const weekStart = new Date(firstWorkout.scheduledDate as Date)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Monday
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6) // Sunday

      return {
        title: `Week ${weekNumber}`,
        dates: `${formatLocalizedDate(weekStart, undefined, { day: 'numeric', month: 'short' })} - ${formatLocalizedDate(weekEnd, undefined, { day: 'numeric', month: 'short' })}`,
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
      const weekA = parseInt((a.title.split(' ')[1] || '0'))
      const weekB = parseInt((b.title.split(' ')[1] || '0'))
      return weekA - weekB
    })
  }

  const weeks = organizeWorkoutsByWeek()

  const openWorkoutDetails = (workoutId?: number) => {
    if (!workoutId) return

    const workoutEntity = workouts.find((workout) => workout.id === workoutId)
    if (!workoutEntity) return

    const workoutDate = new Date(workoutEntity.scheduledDate)

    setSelectedDateWorkout({
      id: workoutEntity.id,
      type: workoutEntity.type,
      distance: `${workoutEntity.distance}km`,
      completed: workoutEntity.completed,
      color: workoutTypes[workoutEntity.type as keyof typeof workoutTypes]?.color || "bg-border",
      date: workoutDate,
      dateString: workoutDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
      notes: workoutEntity.notes,
    })
    setShowDateWorkoutModal(true)
  }

  const renderBiweeklyView = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12" role="status" aria-label="Loading">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <span className="ml-2 text-foreground/70">Loading your training plan...</span>
        </div>
      )
    }

    if (!plan || weeks.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="text-foreground/60 mb-4">No training plan found</div>
          <Button onClick={() => window.location.reload()} className="bg-primary hover:bg-primary/90">
            Refresh
          </Button>
          <div className="text-xs text-foreground/50 mt-2">Check console logs for user/plan state details.</div>
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
                  <p className="text-sm text-foreground/70">{week.dates}</p>
                  <h3 className="font-bold text-lg">{week.title}</h3>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: week.total }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        i < week.completed ? "bg-primary scale-110" : "bg-border"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-4 text-xs text-foreground/70">
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
                  workout.completed ? "bg-primary/10 border-primary/20" : "bg-[oklch(var(--surface-2))] hover:bg-[oklch(var(--surface-3))]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full transition-all duration-300 ${
                      workoutTypes[workout.type as keyof typeof workoutTypes]?.color || "bg-border"
                    }`}
                  />
                  <div className="text-sm font-medium">{workout.day}</div>
                  <div className="text-sm">
                    <span className="font-medium">
                      {workoutTypes[workout.type as keyof typeof workoutTypes]?.label || workout.type}
                    </span>
                    <span className="text-foreground/70 ml-2">{workout.distance}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:scale-110 transition-transform"
                  onClick={() => openWorkoutDetails(workout.id)}
                  aria-label="View workout details"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              className="w-full justify-start text-foreground/70 hover:bg-primary/10 hover:text-primary transition-all duration-200"
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
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
              <span className="text-white text-sm">🤖</span>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-blue-900">Let&apos;s keep your progress going</h4>
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
        <select className="text-sm border rounded px-2 py-1 hover:border-primary transition-colors">
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
                <Badge variant="outline" className="bg-primary/10 text-primary animate-pulse">
                  {item.improvement}
                </Badge>
              </div>
              <div className="flex items-center justify-between mt-3 text-sm">
                <div className="text-center">
                  <p className="text-foreground/70">30 days ago</p>
                  <p className="font-bold text-foreground/50">{item.before}</p>
                </div>
                <div className="text-primary animate-pulse">→</div>
                <div className="text-center">
                  <p className="text-foreground/70">Now</p>
                  <p className="font-bold text-primary">{item.after}</p>
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
                achievement.unlocked ? "bg-yellow-50 border border-yellow-200" : "bg-[oklch(var(--surface-2))]"
              }`}
            >
              <div
                className={`text-2xl transition-all duration-300 ${achievement.unlocked ? "animate-bounce" : "grayscale"}`}
              >
                {index === 0 ? "🏅" : index === 1 ? "🔥" : "🏆"}
              </div>
              <div className="flex-1">
                <h4 className="font-medium">{achievement.title}</h4>
                <p className="text-sm text-foreground/70">{achievement.desc}</p>
                <p className="text-xs text-foreground/60">{achievement.date || achievement.progress}</p>
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
          <div className="flex items-center gap-3">
            <RunSmartBrandMark compact size="sm" className="opacity-90" />
            <h1 className="text-2xl font-bold">Training Plan</h1>
          </div>
          <div className="text-sm text-foreground/70">
            <span className="font-medium">{plan?.title || "21-Day Rookie Challenge"}</span>
            <span className="mx-2">•</span>
            <span>Day {challengeProgress.currentDay} of {challengeProgress.totalDays}</span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="hover:scale-105 transition-transform hover:bg-primary/10 bg-transparent"
          onClick={() => setShowAddRunModal(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {primaryGoal && (
        <Card className="border">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-primary">Goal aligned</p>
                <h3 className="text-lg font-bold text-foreground">{primaryGoal.title}</h3>
                <p className="text-sm text-foreground/70">
                  This plan is designed to help you achieve your goal by{' '}
                  {(() => {
                    if (!primaryGoal.timeBound?.deadline) return 'the target date'
                    const deadline = new Date(primaryGoal.timeBound.deadline)
                    return Number.isNaN(deadline.getTime()) ? 'the target date' : deadline.toLocaleDateString()
                  })()}
                  .
                </p>
              </div>
              {getDaysRemaining(primaryGoal) !== null && (
                <Badge variant="outline" className="text-xs">
                  {getDaysRemaining(primaryGoal)} days remaining
                </Badge>
              )}
            </div>
            <div>
              <div className="flex justify-between text-xs text-foreground/70 mb-1">
                <span>Progress</span>
                <span>{Math.round(goalProgressPercent(primaryGoal))}%</span>
              </div>
              <Progress value={goalProgressPercent(primaryGoal)} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Challenge Recommendation */}
      {!activeChallenge && recommendedChallenge && (
        <NextChallengeRecommendation
          template={recommendedChallenge}
          onStartChallenge={handleStartChallenge}
        />
      )}

      {/* View Toggle */}
      <div className="flex bg-[oklch(var(--surface-3))] rounded-lg p-1">
        {[
          { id: "monthly", icon: Calendar, label: "Monthly" },
          { id: "biweekly", icon: CalendarDays, label: "Biweekly" },
          { id: "progress", icon: TrendingUp, label: "Progress" },
        ].map((view) => (
          <Button
            key={view.id}
            variant={currentView === view.id ? "default" : "ghost"}
            size="sm"
            className="flex-1"
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

      {/* Plan Complexity Indicator */}
      {plan && (
        <PlanComplexityIndicator
          plan={plan}
          userId={plan.userId}
          className="h-fit"
        />
      )}

      {/* Recovery Status */}
      {typeof plan?.userId === 'number' && (
        <RecoveryRecommendations
          userId={plan.userId}
          showBreakdown={false}
        />
      )}

      {showAddRunModal && (
        <AddRunModal
          open={showAddRunModal}
          onOpenChange={setShowAddRunModal}
          onRunAdded={() => {
            // Reload plan data after adding a run
            const loadPlanData = async () => {
              try {
                const user = await dbUtils.getCurrentUser()
                if (user) {
                  const activePlan = await dbUtils.getActivePlan(user.id!)
                  if (activePlan) {
                    setPlan(activePlan)
                    const planWorkouts = await dbUtils.getPlanWorkouts(activePlan.id!)
                    setWorkouts(planWorkouts)
                  }
                }
              } catch (error) {
                console.error('Failed to reload plan data:', error)
              }
            }
            loadPlanData()
          }}
        />
      )}

      <DateWorkoutModal
        isOpen={showDateWorkoutModal}
        onClose={() => {
          setShowDateWorkoutModal(false)
          setSelectedDateWorkout(null)
        }}
        workout={selectedDateWorkout}
      />
    </div>
  )
}

