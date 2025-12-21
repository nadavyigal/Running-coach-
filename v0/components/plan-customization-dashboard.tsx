"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import type { PeriodizationPhase, Plan, RaceGoal, Workout } from "@/lib/db"
import {
  Target,
  Activity,
  Edit,
  BarChart3,
  Zap,
  Mountain,
  Route,
  Timer,
  CheckCircle,
  Trophy,
  Heart,
  Plus,
  Trash2
} from "lucide-react"

interface PlanCustomizationDashboardProps {
  userId: number
  plan: Plan
  raceGoal: RaceGoal
  onUpdatePlan?: (planData: Plan) => void
}

const phaseColors = {
  base: "from-green-400 to-green-600",
  build: "from-orange-400 to-orange-600", 
  peak: "from-red-400 to-red-600",
  taper: "from-blue-400 to-blue-600"
}

const intensityColors = {
  easy: "bg-green-100 text-green-800",
  moderate: "bg-yellow-100 text-yellow-800",
  threshold: "bg-orange-100 text-orange-800",
  vo2max: "bg-red-100 text-red-800",
  anaerobic: "bg-purple-100 text-purple-800"
}

const workoutTypeIcons = {
  easy: Heart,
  tempo: Zap,
  intervals: Timer,
  long: Route,
  "race-pace": Target,
  recovery: Activity,
  hill: Mountain,
  "time-trial": Trophy,
  rest: CheckCircle
}

export function PlanCustomizationDashboard({ userId, plan, raceGoal }: PlanCustomizationDashboardProps) {
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [editingWorkout, setEditingWorkout] = useState<Workout | { week: number; day: string } | null>(null)
  const [showWorkoutEditor, setShowWorkoutEditor] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadWorkouts()
  }, [plan.id])

  const loadWorkouts = async () => {
    try {
      setLoading(true)
      // In a real app, this would fetch from API
      const response = await fetch(`/api/training-plan/workouts?planId=${plan.id}`)
      const data = await response.json()
      setWorkouts(data.workouts || [])
    } catch (error) {
      console.error('Error loading workouts:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load workout data"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleWorkoutUpdate = async (workoutId: number, updates: any) => {
    try {
      const response = await fetch('/api/training-plan/customize', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          planId: plan.id,
          workoutId,
          modifications: updates
        })
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          // Safety violations detected
          toast({
            variant: "destructive",
            title: "Safety Warning",
            description: data.violations.join('. ') + (data.warnings.length > 0 ? ' ' + data.warnings.join('. ') : '')
          })
          return
        }
        throw new Error(data.error || 'Failed to update workout')
      }

      if (data.warnings && data.warnings.length > 0) {
        toast({
          title: "Workout Updated",
          description: `Changes saved. ${data.warnings.join('. ')}`,
          variant: "default"
        })
      } else {
        toast({
          variant: "success",
          title: "Workout Updated",
          description: "Changes saved successfully"
        })
      }

      await loadWorkouts()
    } catch (error) {
      console.error('Error updating workout:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update workout"
      })
    }
  }

  const handleWorkoutDelete = async (workoutId: number) => {
    if (!confirm('Are you sure you want to delete this workout?')) return

    try {
      const response = await fetch(`/api/training-plan/customize/${workoutId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error('Failed to delete workout')
      }

      toast({
        variant: "success",
        title: "Workout Deleted",
        description: "Workout removed successfully"
      })

      await loadWorkouts()
    } catch (error) {
      console.error('Error deleting workout:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete workout"
      })
    }
  }

  const handleAddWorkout = async (workoutData: any) => {
    try {
      const response = await fetch('/api/training-plan/customize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          planId: plan.id,
          workoutData
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add workout')
      }

      toast({
        variant: "success",
        title: "Workout Added",
        description: "New workout added successfully"
      })

      await loadWorkouts()
    } catch (error) {
      console.error('Error adding workout:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add workout"
      })
    }
  }

  const getWeekWorkouts = (week: number) => {
    return workouts.filter(w => w.week === week)
  }

  const getPhaseForWeek = (week: number): PeriodizationPhase | null => {
    if (!plan.periodization) return null
    
    let currentWeek = 1
    for (const phase of plan.periodization) {
      if (week <= currentWeek + phase.duration - 1) {
        return phase
      }
      currentWeek += phase.duration
    }
    return null
  }

  const calculateWeeklyStats = (weekWorkouts: Workout[]) => {
    const runningWorkouts = weekWorkouts.filter(w => w.type !== 'rest')
    const totalDistance = runningWorkouts.reduce((sum, w) => sum + w.distance, 0)
    const totalDuration = runningWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0)
    const keyWorkout = runningWorkouts.find(w => w.type !== 'easy' && w.type !== 'recovery')
    
    return {
      totalDistance: Math.round(totalDistance),
      totalDuration: Math.round(totalDuration),
      workoutCount: runningWorkouts.length,
      keyWorkout: keyWorkout?.type || 'easy'
    }
  }

  const renderPeriodizationVisualization = () => {
    if (!plan.periodization) return null

    let currentWeek = 1

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Training Periodization</h3>
        <div className="grid gap-4">
          {plan.periodization.map((phase, index) => {
            const phaseStartWeek = currentWeek
            currentWeek += phase.duration

            return (
              <Card key={index} className="overflow-hidden">
                <div className={`bg-gradient-to-r ${phaseColors[phase.phase]} p-4 text-white`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold capitalize">{phase.phase} Phase</h4>
                      <p className="text-sm opacity-90">{phase.focus}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm opacity-90">Weeks {phaseStartWeek}-{phaseStartWeek + phase.duration - 1}</div>
                      <div className="text-lg font-bold">{phase.duration} weeks</div>
                    </div>
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm font-medium text-gray-600">Volume</div>
                      <div className="text-lg font-bold">{phase.weeklyVolumePercentage}%</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-600">Easy</div>
                      <div className="text-lg font-bold">{phase.intensityDistribution.easy}%</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-600">Moderate</div>
                      <div className="text-lg font-bold">{phase.intensityDistribution.moderate}%</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-600">Hard</div>
                      <div className="text-lg font-bold">{phase.intensityDistribution.hard}%</div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-sm font-medium text-gray-600 mb-2">Key Workouts</div>
                    <div className="flex flex-wrap gap-1">
                      {phase.keyWorkouts.map((workout, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {workout.replace('-', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  const renderWeeklyView = () => {
    const weekWorkouts = getWeekWorkouts(selectedWeek)
    const weekStats = calculateWeeklyStats(weekWorkouts)
    const currentPhase = getPhaseForWeek(selectedWeek)

    return (
      <div className="space-y-4">
        {/* Week Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
              disabled={selectedWeek === 1}
            >
              ← Previous
            </Button>
            <div className="text-center">
              <h3 className="text-lg font-semibold">Week {selectedWeek}</h3>
              {currentPhase && (
                <Badge className={`bg-gradient-to-r ${phaseColors[currentPhase.phase]} text-white`}>
                  {currentPhase.phase} Phase
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedWeek(Math.min(plan.totalWeeks, selectedWeek + 1))}
              disabled={selectedWeek === plan.totalWeeks}
            >
              Next →
            </Button>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">Weekly Stats</div>
            <div className="text-lg font-bold">{weekStats.totalDistance}km</div>
          </div>
        </div>

        {/* Week Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Week Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{weekStats.totalDistance}</div>
                <div className="text-sm text-gray-600">Total Distance (km)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{weekStats.totalDuration}</div>
                <div className="text-sm text-gray-600">Total Duration (min)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{weekStats.workoutCount}</div>
                <div className="text-sm text-gray-600">Running Workouts</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600 capitalize">{weekStats.keyWorkout}</div>
                <div className="text-sm text-gray-600">Key Workout</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add Workout Button */}
        <div className="flex justify-end mb-4">
          <Button
            onClick={() => {
              setEditingWorkout({ week: selectedWeek, day: 'Mon' })
              setShowWorkoutEditor(true)
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Workout
          </Button>
        </div>

        {/* Workouts List */}
        <div className="grid gap-3">
          {weekWorkouts.map((workout) => {
            const WorkoutIcon = workoutTypeIcons[workout.type as keyof typeof workoutTypeIcons] || Activity
            
            return (
              <Card 
                key={workout.id} 
                className={`hover:shadow-md transition-shadow ${workout.completed ? 'bg-green-50 border-green-200' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <WorkoutIcon className="h-5 w-5 text-gray-600" />
                        <div>
                          <div className="font-semibold capitalize">{workout.day}</div>
                          <div className="text-sm text-gray-600">{workout.type.replace('-', ' ')}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-lg font-bold">{workout.distance}km</div>
                          <div className="text-xs text-gray-600">Distance</div>
                        </div>
                        {workout.duration && (
                          <div className="text-center">
                            <div className="text-lg font-bold">{workout.duration}min</div>
                            <div className="text-xs text-gray-600">Duration</div>
                          </div>
                        )}
                        {workout.intensity && (
                          <Badge className={intensityColors[workout.intensity as keyof typeof intensityColors]}>
                            {workout.intensity}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {workout.completed && (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingWorkout(workout)
                          setShowWorkoutEditor(true)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleWorkoutDelete(workout.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {workout.notes && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                      {workout.notes}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  const renderCalendarView = () => {
    // Create a calendar grid showing all weeks
    const weeks = Array.from({ length: plan.totalWeeks }, (_, i) => i + 1)
    
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Training Calendar</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {weeks.map((week) => {
            const weekWorkouts = getWeekWorkouts(week)
            const weekStats = calculateWeeklyStats(weekWorkouts)
            const currentPhase = getPhaseForWeek(week)
            
            return (
              <Card 
                key={week} 
                className={`cursor-pointer hover:shadow-md transition-shadow ${
                  selectedWeek === week ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setSelectedWeek(week)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Week {week}</CardTitle>
                    {currentPhase && (
                      <Badge className={`bg-gradient-to-r ${phaseColors[currentPhase.phase]} text-white text-xs`}>
                        {currentPhase.phase}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="text-xs text-gray-600">
                      {weekStats.totalDistance}km • {weekStats.workoutCount} workouts
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                        const dayWorkout = weekWorkouts.find(w => w.day === ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i])
                        return (
                          <div
                            key={i}
                            className={`w-6 h-6 rounded-full text-xs flex items-center justify-center ${
                              dayWorkout ? (
                                dayWorkout.type === 'rest' ? 'bg-gray-200' : 
                                dayWorkout.completed ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
                              ) : 'bg-gray-100'
                            }`}
                          >
                            {day}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{plan.title}</h2>
          <p className="text-gray-600">
            {plan.totalWeeks} week plan for {raceGoal.raceName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{plan.fitnessLevel}</Badge>
          <Badge variant="outline">{plan.trainingDaysPerWeek} days/week</Badge>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="weekly">Weekly View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {renderPeriodizationVisualization()}
        </TabsContent>

        <TabsContent value="weekly">
          {renderWeeklyView()}
        </TabsContent>

        <TabsContent value="calendar">
          {renderCalendarView()}
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Plan Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Training Parameters</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Training Days per Week</label>
                      <div className="text-lg">{plan.trainingDaysPerWeek}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Peak Weekly Volume</label>
                      <div className="text-lg">{plan.peakWeeklyVolume}km</div>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Race Goal</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Distance</label>
                      <div className="text-lg">{raceGoal.distance}km</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Target Time</label>
                      <div className="text-lg">{raceGoal.targetTime ? formatTargetTime(raceGoal.targetTime) : 'Not set'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Workout Editor Modal */}
      {showWorkoutEditor && (
        <WorkoutEditor
          workout={editingWorkout}
          onClose={() => {
            setShowWorkoutEditor(false)
            setEditingWorkout(null)
          }}
          onSave={handleWorkoutUpdate}
          onAdd={handleAddWorkout}
        />
      )}
    </div>
  )
}

function formatTargetTime(timeInSeconds: number): string {
  const hours = Math.floor(timeInSeconds / 3600)
  const minutes = Math.floor((timeInSeconds % 3600) / 60)
  const seconds = timeInSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
}

interface WorkoutEditorProps {
  workout: any
  onClose: () => void
  onSave: (workoutId: number, updates: any) => void
  onAdd: (workoutData: any) => void
}

function WorkoutEditor({ workout, onClose, onSave, onAdd }: WorkoutEditorProps) {
  const [formData, setFormData] = useState({
    type: workout?.type || 'easy',
    distance: workout?.distance || 5,
    duration: workout?.duration || 30,
    intensity: workout?.intensity || 'easy',
    notes: workout?.notes || '',
    day: workout?.day || 'Mon',
    week: workout?.week || 1
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEditing = !!workout?.id

  const workoutTypes = [
    { value: 'easy', label: 'Easy Run', icon: Heart },
    { value: 'tempo', label: 'Tempo Run', icon: Zap },
    { value: 'intervals', label: 'Intervals', icon: Timer },
    { value: 'long', label: 'Long Run', icon: Route },
    { value: 'race-pace', label: 'Race Pace', icon: Target },
    { value: 'recovery', label: 'Recovery', icon: Activity },
    { value: 'hill', label: 'Hill Training', icon: Mountain },
    { value: 'time-trial', label: 'Time Trial', icon: Trophy },
    { value: 'rest', label: 'Rest Day', icon: CheckCircle }
  ]

  const intensityLevels = [
    { value: 'easy', label: 'Easy', color: 'bg-green-100 text-green-800' },
    { value: 'moderate', label: 'Moderate', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'threshold', label: 'Threshold', color: 'bg-orange-100 text-orange-800' },
    { value: 'vo2max', label: 'VO2 Max', color: 'bg-red-100 text-red-800' },
    { value: 'anaerobic', label: 'Anaerobic', color: 'bg-purple-100 text-purple-800' }
  ]

  const daysOfWeek = [
    { value: 'Mon', label: 'Monday' },
    { value: 'Tue', label: 'Tuesday' },
    { value: 'Wed', label: 'Wednesday' },
    { value: 'Thu', label: 'Thursday' },
    { value: 'Fri', label: 'Friday' },
    { value: 'Sat', label: 'Saturday' },
    { value: 'Sun', label: 'Sunday' }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (isEditing) {
        await onSave(workout.id, formData)
      } else {
        await onAdd(formData)
      }
      onClose()
    } catch (error) {
      console.error('Error saving workout:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">
            {isEditing ? 'Edit Workout' : 'Add Workout'}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <Plus className="h-4 w-4 rotate-45" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Workout Type */}
          <div>
            <Label htmlFor="type">Workout Type</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {workoutTypes.map((type) => (
                <Button
                  key={type.value}
                  type="button"
                  variant={formData.type === type.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormData({ ...formData, type: type.value })}
                  className="flex items-center gap-2"
                >
                  <type.icon className="h-4 w-4" />
                  {type.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Distance and Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="distance">Distance (km)</Label>
              <Input
                id="distance"
                type="number"
                min="0"
                max="50"
                step="0.1"
                value={formData.distance}
                onChange={(e) => setFormData({ ...formData, distance: parseFloat(e.target.value) })}
                disabled={formData.type === 'rest'}
              />
            </div>
            <div>
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="0"
                max="480"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                disabled={formData.type === 'rest'}
              />
            </div>
          </div>

          {/* Intensity */}
          <div>
            <Label htmlFor="intensity">Intensity</Label>
            <div className="grid grid-cols-5 gap-2 mt-2">
              {intensityLevels.map((intensity) => (
                <Button
                  key={intensity.value}
                  type="button"
                  variant={formData.intensity === intensity.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormData({ ...formData, intensity: intensity.value })}
                  className="text-xs"
                  disabled={formData.type === 'rest'}
                >
                  {intensity.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Day and Week */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="day">Day</Label>
              <select
                id="day"
                value={formData.day}
                onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                className="w-full p-2 border rounded"
              >
                {daysOfWeek.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="week">Week</Label>
              <Input
                id="week"
                type="number"
                min="1"
                max="52"
                value={formData.week}
                onChange={(e) => setFormData({ ...formData, week: parseInt(e.target.value) })}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full p-2 border rounded"
              placeholder="Workout details, pace targets, focus areas..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? 'Saving...' : (isEditing ? 'Save Changes' : 'Add Workout')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
