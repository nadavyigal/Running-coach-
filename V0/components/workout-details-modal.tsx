"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Heart, Zap, Target, TrendingUp, MapPin, Music, Share2, Edit, Trash2 } from "lucide-react"

interface WorkoutDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  workout: {
    id: string
    name: string
    type: string
    date: string
    distance: number
    duration: number
    pace?: string
    heartRate?: number
    calories?: number
    notes?: string
    route?: string
  }
}

export function WorkoutDetailsModal({ isOpen, onClose, workout }: WorkoutDetailsModalProps) {
  const [activeTab, setActiveTab] = useState("overview")

  const workoutTypeColors = {
    easy: "bg-green-100 text-green-800",
    tempo: "bg-orange-100 text-orange-800",
    intervals: "bg-pink-100 text-pink-800",
    long: "bg-blue-100 text-blue-800",
    hill: "bg-purple-100 text-purple-800",
  }

  const handleEdit = () => {
    console.log("Edit workout:", workout.id)
    alert("Edit functionality coming soon!")
  }

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this workout?")) {
      console.log("Delete workout:", workout.id)
      alert("Workout deleted!")
      onClose()
    }
  }

  const handleShare = () => {
    console.log("Share workout:", workout.id)
    alert("Share functionality coming soon!")
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{workout.name}</DialogTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleEdit}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Workout Header */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Badge
                  className={
                    workoutTypeColors[workout.type as keyof typeof workoutTypeColors] || "bg-gray-100 text-gray-800"
                  }
                >
                  {workout.type.charAt(0).toUpperCase() + workout.type.slice(1)} Run
                </Badge>
                <span className="text-sm text-gray-600">{workout.date}</span>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">{workout.distance}</div>
                  <div className="text-xs text-gray-600">km</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.floor(workout.duration / 60)}:{(workout.duration % 60).toString().padStart(2, "0")}
                  </div>
                  <div className="text-xs text-gray-600">time</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">{workout.pace || "5:30"}</div>
                  <div className="text-xs text-gray-600">pace</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="splits">Splits</TabsTrigger>
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Key Metrics */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium mb-3">Key Metrics</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-red-500" />
                        <span className="text-sm">Avg Heart Rate</span>
                      </div>
                      <span className="font-medium">{workout.heartRate || 145} bpm</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-orange-500" />
                        <span className="text-sm">Calories</span>
                      </div>
                      <span className="font-medium">{workout.calories || Math.round(workout.distance * 65)} cal</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Effort</span>
                      </div>
                      <span className="font-medium">Moderate</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Route */}
              {workout.route && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-4 w-4 text-blue-500" />
                      <h3 className="font-medium">Route</h3>
                    </div>
                    <p className="text-sm text-gray-600">{workout.route}</p>
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              {workout.notes && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-medium mb-2">Notes</h3>
                    <p className="text-sm text-gray-600">{workout.notes}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="splits" className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium mb-3">Kilometer Splits</h3>
                  <div className="space-y-2">
                    {Array.from({ length: Math.ceil(workout.distance) }, (_, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
                      >
                        <span className="text-sm">Km {i + 1}</span>
                        <span className="font-medium">{(Math.random() * 0.5 + 5).toFixed(2)} min/km</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analysis" className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <h3 className="font-medium">Performance Analysis</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-green-800">
                        <strong>Great pacing!</strong> You maintained a consistent effort throughout the run.
                      </p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-blue-800">
                        <strong>Heart rate zones:</strong> 65% Zone 2, 30% Zone 3, 5% Zone 4
                      </p>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <p className="text-yellow-800">
                        <strong>Recovery:</strong> Allow 24-48 hours before your next hard workout.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 bg-transparent">
              <Music className="h-4 w-4 mr-2" />
              Add Music
            </Button>
            <Button className="flex-1 bg-green-500 hover:bg-green-600">
              <Calendar className="h-4 w-4 mr-2" />
              Repeat Workout
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
