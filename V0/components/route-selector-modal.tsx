"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, TrendingUp, Star, Clock, RouteIcon, Navigation, Loader2, AlertCircle } from "lucide-react"
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
  // GPS-related fields
  startLat?: number
  startLng?: number
  distanceFromUser?: number
}

interface UserLocation {
  latitude: number
  longitude: number
  accuracy: number
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
    startLat: 32.0853,
    startLng: 34.7818,
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
    startLat: 32.0900,
    startLng: 34.7750,
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
    startLat: 32.0750,
    startLng: 34.7900,
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
    startLat: 32.0800,
    startLng: 34.7850,
  },
]

// Calculate distance between two GPS coordinates (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

export function RouteSelectorModal({ isOpen, onClose }: RouteSelectorModalProps) {
  const [_selectedRoute, setSelectedRoute] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'granted' | 'denied' | 'unavailable'>('idle')
  const [sortedRoutes, setSortedRoutes] = useState<RouteData[]>(sampleRoutes)

  // Request GPS location when modal opens
  useEffect(() => {
    if (isOpen && locationStatus === 'idle') {
      requestLocation()
    }
  }, [isOpen, locationStatus])

  // Sort routes by distance when location is available
  useEffect(() => {
    if (userLocation) {
      const routesWithDistance = sampleRoutes.map(route => ({
        ...route,
        distanceFromUser: route.startLat && route.startLng 
          ? calculateDistance(userLocation.latitude, userLocation.longitude, route.startLat, route.startLng)
          : 999
      }))
      
      // Sort by distance from user
      routesWithDistance.sort((a, b) => (a.distanceFromUser || 999) - (b.distanceFromUser || 999))
      setSortedRoutes(routesWithDistance)
    } else {
      setSortedRoutes(sampleRoutes)
    }
  }, [userLocation])

  const requestLocation = () => {
    // Check if running on HTTPS (required for GPS in production)
    const isSecure = typeof window !== 'undefined' && 
      (window.location.protocol === 'https:' || window.location.hostname === 'localhost');
    
    if (!isSecure) {
      console.warn('[RouteSelectorModal] Not running on HTTPS - GPS unavailable')
      setLocationStatus('unavailable')
      return
    }

    if (!navigator.geolocation) {
      setLocationStatus('unavailable')
      console.log('[RouteSelectorModal] Geolocation not supported')
      return
    }

    setLocationStatus('loading')
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        })
        setLocationStatus('granted')
        console.log('[RouteSelectorModal] Location obtained:', position.coords.latitude, position.coords.longitude)
      },
      (error) => {
        console.warn('[RouteSelectorModal] Location error:', error.message)
        if (error.code === error.PERMISSION_DENIED) {
          setLocationStatus('denied')
        } else {
          setLocationStatus('unavailable')
        }
      },
      {
        enableHighAccuracy: false, // Use coarse location for faster response
        timeout: 10000,
        maximumAge: 300000 // 5 minutes cache
      }
    )
  }

  const handleRouteSelect = async (routeId: string) => {
    setSelectedRoute(routeId)
    
    // Track route selection
    const selectedRouteData = sortedRoutes.find(route => route.id === routeId)
    await trackRouteSelected({
      route_id: routeId,
      route_name: selectedRouteData?.name,
      distance_km: selectedRouteData?.distance,
      difficulty: selectedRouteData?.difficulty,
      elevation_m: selectedRouteData?.elevation,
      estimated_time_minutes: selectedRouteData?.estimatedTime,
      distance_from_user_km: selectedRouteData?.distanceFromUser,
      user_location_available: !!userLocation
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

        {/* Location Status Bar */}
        <div className="mb-4">
          {locationStatus === 'loading' && (
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-2 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Getting your location for better route suggestions...</span>
            </div>
          )}
          {locationStatus === 'granted' && userLocation && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded-lg">
              <Navigation className="h-4 w-4" />
              <span>Routes sorted by distance from your location</span>
            </div>
          )}
          {locationStatus === 'denied' && (
            <div className="flex items-center justify-between text-sm text-amber-600 bg-amber-50 p-2 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>Location access denied</span>
              </div>
              <Button variant="ghost" size="sm" onClick={requestLocation} className="text-xs">
                Try Again
              </Button>
            </div>
          )}
          {locationStatus === 'unavailable' && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span>Location unavailable - showing all routes</span>
            </div>
          )}
          {locationStatus === 'idle' && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={requestLocation}
              className="w-full text-sm"
            >
              <Navigation className="h-4 w-4 mr-2" />
              Use My Location for Better Suggestions
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {sortedRoutes.map((route) => (
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

                  {/* Distance from user (if location available) */}
                  {route.distanceFromUser !== undefined && route.distanceFromUser < 999 && (
                    <div className="flex items-center gap-1 text-sm text-blue-600">
                      <Navigation className="h-4 w-4" />
                      <span>{route.distanceFromUser < 1 
                        ? `${Math.round(route.distanceFromUser * 1000)}m away` 
                        : `${route.distanceFromUser.toFixed(1)} km away`}</span>
                    </div>
                  )}

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
