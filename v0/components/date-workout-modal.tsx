"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Clock,
  Route,
  Heart,
  MapPin,
  Trash2,
  Music,
  Play,
  StretchHorizontal,
  Link,
  ChevronDown,
  ChevronUp,
  Flame,
  Zap,
  Timer,
  Calendar,
  MessageSquare,
} from "lucide-react"
import { useState, useEffect } from "react"
import { getRunBreakdown } from "@/lib/run-breakdowns"
import { getUserExperience, getCurrentUser } from "@/lib/dbUtils"

interface DateWorkoutModalProps {
  isOpen: boolean
  onClose: () => void
  workout: {
    type: string
    distance: string
    completed: boolean
    color: string
    date: Date
    dateString: string
  } | null
}

export function DateWorkoutModal({ isOpen, onClose, workout }: DateWorkoutModalProps) {
  const [showWorkoutBreakdown, setShowWorkoutBreakdown] = useState(false)
  const [breakdown, setBreakdown] = useState<any>(null)

  // Fetch workout breakdown based on user experience
  useEffect(() => {
    if (isOpen && workout) {
      const fetchBreakdown = async () => {
        try {
          const user = await getCurrentUser()
          if (!user?.id) return

          const experience = await getUserExperience(user.id)
          const workoutBreakdown = getRunBreakdown(workout.type, experience)
          setBreakdown(workoutBreakdown)
        } catch (error) {
          console.error('Error fetching workout breakdown:', error)
        }
      }
      fetchBreakdown()
    }
  }, [isOpen, workout])

  if (!workout) return null

  const workoutTypeLabels = {
    easy: "Easy Run",
    tempo: "Tempo Run",
    intervals: "Intervals",
    long: "Long Run",
    hill: "Hill Run",
  }

  const handleActionClick = (action: string) => {
    switch (action) {
      case "start":
        if (typeof window !== "undefined") {
          const event = new CustomEvent("navigate-to-record")
          window.dispatchEvent(event)
        }
        onClose()
        break
      case "remove":
        if (confirm("Are you sure you want to remove this workout?")) {
          alert("Workout removed from your plan!")
          onClose()
        }
        break
      default:
        alert(`${action} functionality coming soon!`)
        break
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{workout.dateString}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Workout Header */}
          <Card className="hover:shadow-lg transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <Badge className={`${workout.color} text-white mb-2`}>
                    {workoutTypeLabels[workout.type as keyof typeof workoutTypeLabels]}
                  </Badge>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Route className="h-4 w-4" />
                      {workout.distance}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      25-30 min
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-4 w-4" />
                      Zone 2
                    </span>
                  </div>
                </div>
                {workout.completed && <Badge className="bg-green-100 text-green-800">Completed</Badge>}
              </div>
            </CardContent>
          </Card>

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
                Workout Breakdown
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowWorkoutBreakdown(!showWorkoutBreakdown)}
                className="text-gray-600 hover:text-black"
              >
                {showWorkoutBreakdown ? "COLLAPSE" : "EXPAND"}
                {showWorkoutBreakdown ? (
                  <ChevronUp className="h-4 w-4 ml-1" />
                ) : (
                  <ChevronDown className="h-4 w-4 ml-1" />
                )}
              </Button>
            </div>

            {showWorkoutBreakdown && breakdown && (
              <div className="space-y-3 animate-in slide-in-from-top duration-300">
                {/* Warm-up */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Flame className="h-5 w-5 text-orange-500 mt-1" />
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">Warm-up</h4>
                        <p className="text-sm text-gray-600">{breakdown.warmup}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Drills */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Zap className="h-5 w-5 text-yellow-500 mt-1" />
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">Drills</h4>
                        <p className="text-sm text-gray-600">{breakdown.drills}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Main Set */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Play className="h-5 w-5 text-green-500 mt-1" />
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">Main Set</h4>
                        <p className="text-sm text-gray-600">{breakdown.mainSet}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Total Time */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Timer className="h-5 w-5 text-blue-500 mt-1" />
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">Total Time</h4>
                        <p className="text-sm text-gray-600">{breakdown.totalTime}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Frequency */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-purple-500 mt-1" />
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">Frequency</h4>
                        <p className="text-sm text-gray-600">{breakdown.frequency}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Coach Notes */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <MessageSquare className="h-5 w-5 text-indigo-500 mt-1" />
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1">Coach Notes</h4>
                        <p className="text-sm text-gray-600">{breakdown.coachNotes}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {showWorkoutBreakdown && !breakdown && (
              <div className="text-center py-4 text-gray-500 text-sm">
                Workout breakdown not available for this run type
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
              {workout.completed ? "View Workout" : "Start Workout"}
            </Button>
            <Button variant="outline" size="sm" className="w-12 h-12 bg-transparent">
              <Music className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
