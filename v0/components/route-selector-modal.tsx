"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RouteMap } from "@/components/maps/RouteMap"
import { CustomRouteCreator } from "@/components/custom-route-creator"
import { MapPin, TrendingUp, Star, Clock, RouteIcon, Navigation, Loader2, AlertCircle, Radius, Plus, Check } from "lucide-react"
import { trackNearbyFilterChanged, trackRouteSelected } from "@/lib/analytics"
import { calculateDistance } from "@/lib/routeUtils"
import { db, type Route } from "@/lib/db"
import { seedDemoRoutes } from "@/lib/seedRoutes"
import { clearTelAvivDemoRoutes, shouldClearTelAvivRoutes } from "@/lib/clearDemoRoutes"
import { useToast } from "@/hooks/use-toast"
import { getDifficultyColor, getDifficultyLabel, UNKNOWN_DISTANCE_KM, isDevelopment } from "@/lib/routeHelpers"

interface RouteSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onRouteSelected: (route: Route) => void
}

interface UserLocation {
  latitude: number
  longitude: number
  accuracy: number
}

interface RouteWithDistance extends Route {
  distanceFromUser?: number
}

export function RouteSelectorModal({ isOpen, onClose, onRouteSelected }: RouteSelectorModalProps) {
  const { toast } = useToast()

  // Routes from database
  const [routes, setRoutes] = useState<Route[]>([])
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Selected & previewed route state
  const [previewedRouteId, setPreviewedRouteId] = useState<number | null>(null)

  // Location state
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'granted' | 'denied' | 'unavailable'>('idle')
  const [radiusKm, setRadiusKm] = useState<number>(10)

  // Custom route creator state
  const [customRouteCreatorOpen, setCustomRouteCreatorOpen] = useState(false)

  // Load routes from database
  const loadRoutes = useCallback(async () => {
    try {
      setIsLoadingRoutes(true)
      setLoadError(null)

      // Check if we should clear Tel Aviv demo routes based on user location
      if (userLocation) {
        const shouldClear = await shouldClearTelAvivRoutes(
          userLocation.latitude,
          userLocation.longitude
        )

        if (shouldClear) {
          const result = await clearTelAvivDemoRoutes()
          if (result.deletedCount > 0 && isDevelopment()) {
            console.log(`Cleared ${result.deletedCount} Tel Aviv demo routes - user is not in Tel Aviv area`)
          }
        }
      }

      const count = await db.routes.count()
      if (count === 0) {
        // Don't seed demo routes - users should create custom routes
        // or routes should be fetched based on their location
        if (isDevelopment()) {
          console.log('No routes found. Users should create custom routes.')
        }
      }

      const allRoutes = await db.routes.toArray()
      setRoutes(allRoutes)
    } catch (error) {
      if (isDevelopment()) {
        console.error('[RouteSelectorModal] Error loading routes:', error)
      }
      setLoadError('Failed to load routes. Please refresh the page.')
      toast({
        title: 'Error Loading Routes',
        description: 'Failed to load routes from database.',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingRoutes(false)
    }
  }, [toast, userLocation])

  // Load routes when modal opens
  useEffect(() => {
    if (isOpen) {
      loadRoutes()
    }
  }, [isOpen, loadRoutes])

  // Request GPS location when modal opens
  useEffect(() => {
    if (isOpen && locationStatus === 'idle') {
      const cleanup = requestLocation()
      return cleanup
    }
  }, [isOpen, locationStatus, requestLocation])

  // Calculate routes with distance from user
  const routesWithDistance = useMemo((): RouteWithDistance[] => {
    if (!userLocation) {
      return routes.map(route => ({ ...route, distanceFromUser: undefined }))
    }

    return routes.map(route => {
      const distanceFromUser = route.startLat && route.startLng
        ? calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            route.startLat,
            route.startLng
          )
        : UNKNOWN_DISTANCE_KM

      return { ...route, distanceFromUser }
    }).sort((a, b) =>
      (a.distanceFromUser ?? UNKNOWN_DISTANCE_KM) - (b.distanceFromUser ?? UNKNOWN_DISTANCE_KM)
    )
  }, [routes, userLocation])

  // Filter routes by radius
  const nearbyRoutes = useMemo((): RouteWithDistance[] => {
    if (!userLocation) return routesWithDistance

    return routesWithDistance.filter(
      route => route.distanceFromUser === undefined || route.distanceFromUser <= radiusKm
    )
  }, [routesWithDistance, userLocation, radiusKm])

  // Get the previewed route object
  const previewedRoute = useMemo(() => {
    if (!previewedRouteId) return null
    return nearbyRoutes.find(r => r.id === previewedRouteId) || null
  }, [previewedRouteId, nearbyRoutes])

  const requestLocation = useCallback(() => {
    const isSecure = typeof window !== 'undefined' &&
      (window.location.protocol === 'https:' || window.location.hostname === 'localhost')

    if (!isSecure) {
      if (isDevelopment()) {
        console.warn('[RouteSelectorModal] Not running on HTTPS - GPS unavailable')
      }
      setLocationStatus('unavailable')
      return
    }

    if (!navigator.geolocation) {
      setLocationStatus('unavailable')
      return
    }

    setLocationStatus('loading')

    let isMounted = true

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (isMounted) {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          })
          setLocationStatus('granted')
        }
      },
      (error) => {
        if (isMounted) {
          if (error.code === error.PERMISSION_DENIED) {
            setLocationStatus('denied')
          } else {
            setLocationStatus('unavailable')
          }
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000
      }
    )

    return () => {
      isMounted = false
    }
  }, [])

  const handleRoutePreview = (route: Route) => {
    // If already previewed, select it
    if (previewedRouteId === route.id) {
      handleRouteSelect(route)
    } else {
      // Preview the route
      setPreviewedRouteId(route.id)
    }
  }

  const handleRouteSelect = async (route: RouteWithDistance) => {
    if (!route.id) {
      toast({
        title: 'Error',
        description: 'Cannot select route without ID',
        variant: 'destructive',
      })
      return
    }

    try {
      await trackRouteSelected({
        route_id: route.id.toString(),
        route_name: route.name,
        distance_km: route.distance,
        difficulty: route.difficulty,
        elevation_m: route.elevationGain,
        estimated_time_minutes: route.estimatedTime,
        distance_from_user_km: route.distanceFromUser,
        user_location_available: !!userLocation
      })
    } catch (error) {
      if (isDevelopment()) {
        console.warn('Analytics tracking failed:', error)
      }
    }

    toast({
      title: 'Route Added',
      description: `"${route.name}" has been added to your workout!`,
    })

    // Pass route to parent component before closing
    onRouteSelected(route)

    setPreviewedRouteId(null)
    onClose()
  }

  const handleMapRouteClick = (route: Route) => {
    if (route?.id) {
      handleRoutePreview(route)
    }
  }

  const handleCustomRouteSaved = (route: Route) => {
    // Refresh routes list and preview the new route
    loadRoutes()
    if (route.id !== undefined) {
      setPreviewedRouteId(route.id)
    }
  }


  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

          {/* Radius Filter */}
          <div className="flex items-center gap-3 mb-4">
            <Radius className="h-5 w-5 text-gray-500" />
            <label className="text-sm font-medium">Nearby Routes:</label>
            <Select
              value={radiusKm.toString()}
              onValueChange={(value) => {
                const newRadius = parseInt(value)
                setRadiusKm(newRadius)
                trackNearbyFilterChanged({ radius_km: newRadius })
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Within 1 km</SelectItem>
                <SelectItem value="2">Within 2 km</SelectItem>
                <SelectItem value="5">Within 5 km</SelectItem>
                <SelectItem value="10">Within 10 km</SelectItem>
                <SelectItem value="25">Within 25 km</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-600">
              {nearbyRoutes.length} {nearbyRoutes.length === 1 ? 'route' : 'routes'}
            </span>
          </div>

          {/* Error State */}
          {loadError ? (
            <div className="text-center py-8 text-red-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-2" />
              <p>{loadError}</p>
              <Button onClick={loadRoutes} className="mt-4" variant="outline">
                Try Again
              </Button>
            </div>
          ) : isLoadingRoutes ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600">Loading routes...</span>
            </div>
          ) : (
            <>
              {/* Map View */}
              <RouteMap
                routes={nearbyRoutes}
                userLocation={userLocation ? {
                  lat: userLocation.latitude,
                  lng: userLocation.longitude
                } : undefined}
                onRouteClick={handleMapRouteClick}
                selectedRouteId={previewedRouteId ?? undefined}
                height="350px"
                className="rounded-lg border mb-4"
              />

              {/* Previewed Route Card */}
              {previewedRoute && (
                <Card className="mb-4 border-2 border-blue-500 bg-blue-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Check className="h-5 w-5 text-blue-600" />
                          <h3 className="font-semibold text-lg">{previewedRoute.name}</h3>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{previewedRoute.description}</p>
                      </div>
                      <Badge className={getDifficultyColor(previewedRoute.difficulty)}>
                        {getDifficultyLabel(previewedRoute.difficulty)}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm mb-3">
                      <div className="flex items-center gap-1">
                        <RouteIcon className="h-4 w-4 text-gray-500" />
                        <span>{previewedRoute.distance} km</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span>~{previewedRoute.estimatedTime} min</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4 text-gray-500" />
                        <span>{previewedRoute.elevationGain}m gain</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        onClick={() => handleRouteSelect(previewedRoute)}
                        className="flex-1"
                      >
                        Use This Route
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setPreviewedRouteId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-4">
                {nearbyRoutes.map((route) => (
                  <Card
                    key={route.id}
                    className={`cursor-pointer hover:shadow-md transition-all ${
                      previewedRouteId === route.id 
                        ? 'ring-2 ring-blue-500 bg-blue-50/30' 
                        : ''
                    }`}
                    onClick={() => handleRoutePreview(route)}
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
                            <span className="text-sm font-medium">{route.popularity}%</span>
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
                            <span>{route.elevationGain}m gain</span>
                          </div>
                        </div>

                        {/* Distance from user (if location available) */}
                        {route.distanceFromUser !== undefined && route.distanceFromUser < UNKNOWN_DISTANCE_KM && (
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
                            {route.tags?.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <Badge className={getDifficultyColor(route.difficulty)}>
                            {getDifficultyLabel(route.difficulty)}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* No routes message */}
                {nearbyRoutes.length === 0 && !isLoadingRoutes && (
                  <div className="text-center py-8 text-gray-500">
                    <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No routes found within {radiusKm} km</p>
                    <p className="text-sm">Try increasing the search radius</p>
                  </div>
                )}

                {/* Create Custom Route */}
                <Card 
                  className="border-dashed border-2 border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all"
                  onClick={() => setCustomRouteCreatorOpen(true)}
                >
                  <CardContent className="p-4 text-center">
                    <Plus className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <h3 className="font-medium text-gray-700">Create Custom Route</h3>
                    <p className="text-sm text-gray-500">Plan your own route by clicking points on the map</p>
                    <Button variant="outline" size="sm" className="mt-2">
                      Create Route
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Custom Route Creator Modal */}
      <CustomRouteCreator
        isOpen={customRouteCreatorOpen}
        onClose={() => setCustomRouteCreatorOpen(false)}
        onRouteSaved={handleCustomRouteSaved}
      />
    </>
  )
}
