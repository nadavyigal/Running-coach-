"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, TrendingUp, Star, Clock, RouteIcon } from "lucide-react"
import { trackRouteSelected } from "@/lib/analytics"

interface RouteSelectorModalProps {
  isOpen: boolean
  onClose: () => void
}

interface RouteData {
  id: string
  name: string
  distance: number
  difficulty: "Easy" | "Moderate" | "Hard"
  elevation: number
  rating: number
  estimatedTime: number
  description: string
  tags: string[]
}

const sampleRoutes: RouteData[] = [
  {
    id: "1",
    name: "Park Loop",
    distance: 3.2,
    difficulty: "Easy",
    elevation: 5,
    rating: 4.5,
    estimatedTime: 20,
    description: "Flat, scenic loop through the city park",
    tags: ["Popular", "Flat", "Safe"],
  },
  {
    id: "2",
    name: "Riverside Trail",
    distance: 4.1,
    difficulty: "Easy",
    elevation: 12,
    rating: 4.8,
    estimatedTime: 25,
    description: "Beautiful trail along the river with great views",
    tags: ["Scenic", "Nature", "Peaceful"],
  },
  {
    id: "3",
    name: "Hill Challenge",
    distance: 2.8,
    difficulty: "Hard",
    elevation: 145,
    rating: 4.2,
    estimatedTime: 22,
    description: "Challenging hill workout for strength building",
    tags: ["Hills", "Workout", "Challenging"],
  },
  {
    id: "4",
    name: "Downtown Circuit",
    distance: 5.0,
    difficulty: "Moderate",
    elevation: 25,
    rating: 4.0,
    estimatedTime: 30,
    description: "Urban route through the city center",
    tags: ["Urban", "Busy", "Varied"],
  },
]

export function RouteSelectorModal({ isOpen, onClose }: RouteSelectorModalProps) {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null)

  const handleRouteSelect = async (routeId: string) => {
    setSelectedRoute(routeId)
    
    // Track route selection
    const selectedRouteData = sampleRoutes.find(route => route.id === routeId)
    await trackRouteSelected({
      route_id: routeId,
      route_name: selectedRouteData?.name,
      distance_km: selectedRouteData?.distance,
      difficulty: selectedRouteData?.difficulty,
      elevation_m: selectedRouteData?.elevation,
      estimated_time_minutes: selectedRouteData?.estimatedTime
    })
    
    // Here you would integrate with the workout
    console.log("Selected route:", routeId)
    alert("Route added to your workout!")
    onClose()
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy":
        return "bg-green-100 text-green-800"
      case "Moderate":
        return "bg-yellow-100 text-yellow-800"
      case "Hard":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Nearby Routes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {sampleRoutes.map((route) => (
            <Card
              key={route.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleRouteSelect(route.id)}
            >
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Route Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">{route.name}</h3>
                      <p className="text-sm text-gray-600">{route.description}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="text-sm font-medium">{route.rating}</span>
                    </div>
                  </div>

                  {/* Route Stats */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <RouteIcon className="h-4 w-4 text-gray-500" />
                      <span>{route.distance} km</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span>~{route.estimatedTime} min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4 text-gray-500" />
                      <span>{route.elevation}m gain</span>
                    </div>
                  </div>

                  {/* Tags and Difficulty */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      {route.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <Badge className={getDifficultyColor(route.difficulty)}>{route.difficulty}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Create Custom Route */}
          <Card className="border-dashed border-2 border-gray-300">
            <CardContent className="p-4 text-center">
              <MapPin className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <h3 className="font-medium text-gray-700">Create Custom Route</h3>
              <p className="text-sm text-gray-500">Plan your own route</p>
              <Button variant="outline" size="sm" className="mt-2 bg-transparent">
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
