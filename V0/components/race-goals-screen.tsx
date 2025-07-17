"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RaceGoalModal } from "./race-goal-modal"
import { dbUtils } from "@/lib/db"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import {
  Target,
  Plus,
  Edit,
  Trash2,
  Calendar,
  MapPin,
  Trophy,
  Clock,
  Mountain,
  Route,
  CalendarDays,
  Play,
  CheckCircle,
  AlertCircle,
  Star,
  MoreHorizontal
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"

interface RaceGoalsScreenProps {
  userId: number
}

const priorityConfig = {
  A: { label: "A Race", color: "bg-red-500 text-white", description: "Primary Goal" },
  B: { label: "B Race", color: "bg-orange-500 text-white", description: "Secondary Goal" },
  C: { label: "C Race", color: "bg-blue-500 text-white", description: "Tune-up Race" }
}

const raceTypeIcons = {
  road: Route,
  trail: Mountain,
  track: Target,
  virtual: CalendarDays
}

const statusIcons = {
  planned: Calendar,
  registered: CheckCircle,
  completed: Trophy
}

export function RaceGoalsScreen({ userId }: RaceGoalsScreenProps) {
  const [raceGoals, setRaceGoals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<any>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadRaceGoals()
  }, [userId])

  const loadRaceGoals = async () => {
    try {
      setLoading(true)
      const goals = await dbUtils.getRaceGoalsByUser(userId)
      setRaceGoals(goals.sort((a, b) => {
        // Sort by priority (A > B > C) then by date
        const priorityOrder = { A: 3, B: 2, C: 1 }
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
        if (priorityDiff !== 0) return priorityDiff
        return new Date(a.raceDate).getTime() - new Date(b.raceDate).getTime()
      }))
    } catch (error) {
      console.error('Error loading race goals:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load race goals"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteGoal = async (goalId: number) => {
    if (!confirm('Are you sure you want to delete this race goal?')) return

    try {
      await dbUtils.deleteRaceGoal(goalId)
      toast({
        variant: "success",
        title: "Race Goal Deleted",
        description: "The race goal has been removed successfully"
      })
      await loadRaceGoals()
    } catch (error) {
      console.error('Error deleting race goal:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete race goal"
      })
    }
  }

  const handleGeneratePlan = async (goal: any) => {
    try {
      // Navigate to plan generation with this goal
      const event = new CustomEvent('navigate-to-plan-generation', {
        detail: { raceGoal: goal }
      })
      window.dispatchEvent(event)
    } catch (error) {
      console.error('Error generating plan:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate training plan"
      })
    }
  }

  const formatTargetTime = (timeInSeconds: number) => {
    const hours = Math.floor(timeInSeconds / 3600)
    const minutes = Math.floor((timeInSeconds % 3600) / 60)
    const seconds = timeInSeconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }
  }

  const getDaysUntilRace = (raceDate: Date) => {
    const today = new Date()
    const race = new Date(raceDate)
    const diffTime = race.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getTrainingWeeks = (raceDate: Date) => {
    const daysUntil = getDaysUntilRace(raceDate)
    return Math.floor(daysUntil / 7)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Race Goals</h2>
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            Add Goal
          </Button>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Race Goals</h2>
          <p className="text-gray-600">Set and manage your race objectives</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Goal
        </Button>
      </div>

      {/* Goals List */}
      {raceGoals.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Target className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">No Race Goals Set</h3>
            <p className="text-gray-600 mb-4">
              Set your first race goal to generate a personalized training plan
            </p>
            <Button onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Set Your First Goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {raceGoals.map((goal) => {
            const RaceTypeIcon = raceTypeIcons[goal.raceType as keyof typeof raceTypeIcons]
            const StatusIcon = statusIcons[goal.registrationStatus as keyof typeof statusIcons]
            const daysUntil = getDaysUntilRace(goal.raceDate)
            const trainingWeeks = getTrainingWeeks(goal.raceDate)
            const priorityConfig = {
              A: { label: "A Race", color: "bg-red-500 text-white", description: "Primary Goal" },
              B: { label: "B Race", color: "bg-orange-500 text-white", description: "Secondary Goal" },
              C: { label: "C Race", color: "bg-blue-500 text-white", description: "Tune-up Race" }
            }[goal.priority]

            return (
              <Card key={goal.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-2">
                        <RaceTypeIcon className="h-5 w-5 text-gray-600" />
                        <Badge className={priorityConfig.color}>
                          {priorityConfig.label}
                        </Badge>
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{goal.raceName}</CardTitle>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(goal.raceDate), "PPP")}
                          </div>
                          {goal.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {goal.location}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingGoal(goal); setShowModal(true); }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Goal
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleGeneratePlan(goal)}>
                          <Play className="h-4 w-4 mr-2" />
                          Generate Plan
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteGoal(goal.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Goal
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-gray-600">Distance</div>
                      <div className="text-lg font-bold">{goal.distance}km</div>
                    </div>
                    {goal.targetTime && (
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-gray-600">Target Time</div>
                        <div className="text-lg font-bold">{formatTargetTime(goal.targetTime)}</div>
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-gray-600">Status</div>
                      <div className="flex items-center gap-2">
                        <StatusIcon className="h-4 w-4 text-green-600" />
                        <span className="text-sm capitalize">{goal.registrationStatus}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-gray-600">
                        {daysUntil > 0 ? 'Days Until' : 'Days Since'}
                      </div>
                      <div className="text-lg font-bold">
                        {Math.abs(daysUntil)}
                        {daysUntil > 0 && trainingWeeks > 0 && (
                          <span className="text-sm font-normal text-gray-600 ml-1">
                            ({trainingWeeks} weeks)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {goal.elevationGain && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                      <Mountain className="h-4 w-4" />
                      <span>{goal.elevationGain}m elevation gain</span>
                      <Badge variant="outline" className="ml-2">
                        {goal.courseDifficulty}
                      </Badge>
                    </div>
                  )}

                  {goal.notes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">{goal.notes}</p>
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditingGoal(goal); setShowModal(true); }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleGeneratePlan(goal)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Generate Training Plan
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Race Goal Modal */}
      <RaceGoalModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditingGoal(null)
        }}
        onSuccess={loadRaceGoals}
        userId={userId}
        editingGoal={editingGoal}
      />
    </div>
  )
}