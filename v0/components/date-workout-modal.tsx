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
} from "lucide-react"
import { useState } from "react"

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

  if (!workout) return null

  const workoutTypeLabels = {
    easy: "Easy Run",
    tempo: "Tempo Run",
    intervals: "Intervals",
    long: "Long Run",
    hill: "Hill Run",
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
      color: workout.color.replace("bg-", "bg-"),
      repeat: workout.type === "intervals" ? "x3" : undefined,
      steps: [
        {
          step: 2,
          description: `${workout.distance} at target pace`,
          type: "RUN",
        },
      ],
    },
    {
      phase: "Cool Down",
      color: "bg-gray-500",
      steps: [
        {
          step: 3,
          description: "500m at a conversational pace",
          detail: "Walk for 5-10 minutes after",
          type: "RUN",
        },
      ],
    },
  ]

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
                Description
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

            {showWorkoutBreakdown && (
              <div className="space-y-3 animate-in slide-in-from-top duration-300">
                {workoutBreakdown.map((phase, phaseIndex) => (
                  <div key={phaseIndex}>
                    <div
                      className={`${phase.color} text-white px-3 py-2 rounded-t-lg flex items-center justify-between`}
                    >
                      <span className="font-medium">{phase.phase}</span>
                      {phase.repeat && (
                        <Badge className="bg-white/20 text-white border-white/30">Repeat {phase.repeat}</Badge>
                      )}
                    </div>
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
                            {("detail" in step) && step.detail && <p className="text-sm text-gray-600 mt-1">{step.detail}</p>}
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
