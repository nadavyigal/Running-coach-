'use client';

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Map, Play, Pause, Square, Volume2, Satellite, MapPin, AlertTriangle, Info, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { RouteSelectorModal } from "@/components/route-selector-modal"
import { RouteSelectionWizard } from "@/components/route-selection-wizard"
import { ManualRunModal } from "@/components/manual-run-modal"
import { AddActivityModal } from "@/components/add-activity-modal"
import { type Run, type Workout, type User } from "@/lib/db"
import { dbUtils } from "@/lib/dbUtils"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import RecoveryRecommendations from "@/components/recovery-recommendations"
import { GPSAccuracyIndicator } from "@/components/gps-accuracy-indicator"
import { workoutTypeToRunType } from "@/lib/run-recording"
import { GPSMonitoringService, type GPSAccuracyData } from "@/lib/gps-monitoring"
import { routeRecommendationService, type Route } from "@/lib/route-recommendations"

interface GPSCoordinate {
  latitude: number
  longitude: number
  timestamp: number
  accuracy?: number
}

interface RunMetrics {
  distance: number // in km
  duration: number // in seconds
  pace: number // in seconds per km
  calories: number // estimated
}

export function RecordScreen() {
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [gpsPermission, setGpsPermission] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt')
  const [gpsAccuracy, setGpsAccuracy] = useState<number>(0)
  const [isInitializingGps, setIsInitializingGps] = useState(false)
  const [showRoutesModal, setShowRoutesModal] = useState(false)
  const [showRouteWizard, setShowRouteWizard] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [showAddActivityModal, setShowAddActivityModal] = useState(false)
  const [currentWorkout, setCurrentWorkout] = useState<Workout | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null)
  
  // GPS monitoring state
  const [gpsMonitoringService] = useState(() => new GPSMonitoringService())
  const [currentGPSAccuracy, setCurrentGPSAccuracy] = useState<GPSAccuracyData | null>(null)
  const [gpsAccuracyHistory, setGpsAccuracyHistory] = useState<GPSAccuracyData[]>([])
  const [showGPSDetails, setShowGPSDetails] = useState(false)
  
  // GPS and tracking state
  const [gpsPath, setGpsPath] = useState<GPSCoordinate[]>([])
  const [currentPosition, setCurrentPosition] = useState<GPSCoordinate | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const isRunningRef = useRef(false)
  const isPausedRef = useRef(false)

  useEffect(() => {
    isRunningRef.current = isRunning
    isPausedRef.current = isPaused
  }, [isRunning, isPaused])
  
  // Metrics state
  const [metrics, setMetrics] = useState<RunMetrics>({
    distance: 0,
    duration: 0,
    pace: 0,
    calories: 0
  })

  const { toast } = useToast()
  const router = useRouter()

  // Initialize GPS - proactively request permission on mount
  const initializeGps = async () => {
    if (isInitializingGps) return
    
    setIsInitializingGps(true)
    console.log('[GPS] Starting GPS initialization...')
    
    try {
      const granted = await requestGpsPermission()
      if (granted) {
        console.log('[GPS] GPS initialized successfully')
        toast({
          title: "GPS Ready",
          description: "Location access granted. You can now start your run.",
        })
      } else {
        console.warn('[GPS] GPS initialization failed')
      }
    } catch (error) {
      console.error('[GPS] Error during GPS initialization:', error)
    } finally {
      setIsInitializingGps(false)
    }
  }

  // Load today's workout and user data on mount
  useEffect(() => {
    loadTodaysWorkout()
    loadCurrentUser()
    
    // Check GPS support and then initialize GPS
    const setupGps = async () => {
      await checkGpsSupport()
      // After checking support, proactively request GPS permission
      if (navigator.geolocation) {
        initializeGps()
      }
    }
    setupGps()
    
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  // Timer effect for duration tracking
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRunning && !isPaused && startTimeRef.current) {
      interval = setInterval(() => {
        const now = Date.now()
        const duration = Math.floor((now - startTimeRef.current) / 1000)
        setMetrics(prev => ({
          ...prev,
          duration,
          pace: prev.distance > 0 ? duration / prev.distance : 0,
          calories: estimateCalories(duration, prev.distance)
        }))
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isRunning, isPaused])

  const loadCurrentUser = async () => {
    try {
      const user = await dbUtils.getCurrentUser()
      if (user) {
        setCurrentUser(user)
      }
    } catch (error) {
      console.error('Error loading user:', error)
    }
  }

  const checkGpsSupport = async () => {
    // Check if running on HTTPS (required for GPS in production)
    const isSecure = typeof window !== 'undefined' && 
      (window.location.protocol === 'https:' || window.location.hostname === 'localhost');
    
    if (!isSecure) {
      console.warn('[GPS] Not running on HTTPS - GPS may not work');
      setGpsPermission('unsupported')
      return
    }

    if (!navigator.geolocation) {
      console.warn('[GPS] Geolocation API not available');
      setGpsPermission('unsupported')
      return
    }

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
      console.log('[GPS] Permission state:', permission.state);
      setGpsPermission(permission.state)
      
      permission.onchange = () => {
        console.log('[GPS] Permission changed to:', permission.state);
        setGpsPermission(permission.state)
      }
    } catch (error) {
      console.error('[GPS] Error checking GPS permission:', error)
      setGpsPermission('prompt')
    }
  }

  const loadTodaysWorkout = async () => {
    try {
      const user = await dbUtils.getCurrentUser()
      if (user) {
        const workout = await dbUtils.getTodaysWorkout(user.id!)
        setCurrentWorkout(workout)
      }
    } catch (error) {
      console.error('Error loading today\'s workout:', error)
    }
  }

  const requestGpsPermission = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setGpsPermission('unsupported')
        resolve(false)
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsPermission('granted')
          setGpsAccuracy(position.coords.accuracy)
          resolve(true)
        },
        (error) => {
          console.error('GPS permission denied:', error)
          setGpsPermission('denied')
          resolve(false)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      )
    })
  }

  const startGpsTracking = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(false)
        return
      }

      stopGpsTracking()

      let settled = false
      const settle = (value: boolean) => {
        if (settled) return
        settled = true
        resolve(value)
      }

      const timeoutId = window.setTimeout(() => {
        console.warn('[GPS] GPS tracking start timed out')
        stopGpsTracking()
        settle(false)
      }, 12_000)

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          clearTimeout(timeoutId)
          settle(true)

          const newPosition: GPSCoordinate = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: position.timestamp,
            accuracy: position.coords.accuracy
          }

          setCurrentPosition(newPosition)
          setGpsAccuracy(position.coords.accuracy)

          if (isRunningRef.current && !isPausedRef.current) {
            setGpsPath((previousPath) => {
              const nextPath = [...previousPath, newPosition]

              if (nextPath.length > 1) {
                const newDistance = calculateTotalDistance(nextPath)
                setMetrics((previousMetrics) => ({
                  ...previousMetrics,
                  distance: newDistance,
                  pace: previousMetrics.duration > 0 ? previousMetrics.duration / newDistance : 0,
                  calories: estimateCalories(previousMetrics.duration, newDistance),
                }))
              }

              return nextPath
            })
          }
        },
        (error) => {
          clearTimeout(timeoutId)
          console.error('GPS tracking error:', error)
          if (!settled) {
            stopGpsTracking()
            settle(false)
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 1000
        }
      )

      // Resolve happens on first position update (or error/timeout).
    })
  }

  const stopGpsTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }

  const calculateTotalDistance = (path: GPSCoordinate[]): number => {
    if (path.length < 2) return 0
    
    return path.reduce((total, point, index) => {
      if (index === 0) return 0
      return total + calculateDistanceBetweenPoints(path[index - 1], point)
    }, 0)
  }

  const calculateDistanceBetweenPoints = (point1: GPSCoordinate, point2: GPSCoordinate): number => {
    const R = 6371 // Earth's radius in km
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  const estimateCalories = (durationSeconds: number, distanceKm: number): number => {
    // Simple calorie estimation: ~60 calories per km for average runner
    return Math.round(distanceKm * 60)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatPace = (paceSecondsPerKm: number) => {
    if (paceSecondsPerKm === 0) return '--:--'
    const mins = Math.floor(paceSecondsPerKm / 60)
    const secs = Math.floor(paceSecondsPerKm % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const startRun = async () => {
    const gpsGranted = await requestGpsPermission()
    if (!gpsGranted) {
      toast({
        title: "GPS Required",
        description: "Please enable location access to track your run.",
        variant: "destructive"
      })
      return
    }

    startTimeRef.current = Date.now()
    setGpsPath([])
    setMetrics({
      distance: 0,
      duration: 0,
      pace: 0,
      calories: 0
    })

    setIsRunning(true)
    setIsPaused(false)
    isRunningRef.current = true
    isPausedRef.current = false
    const trackingStarted = await startGpsTracking()
    if (!trackingStarted) {
      setIsRunning(false)
      isRunningRef.current = false
      toast({
        title: "GPS Error",
        description: "Unable to start GPS tracking. Please try again.",
        variant: "destructive"
      })
      return
    }

    toast({
      title: "Run Started",
      description: "GPS tracking active. Your run is being recorded.",
    })
  }

  const pauseRun = () => {
    setIsPaused(true)
    isPausedRef.current = true
    toast({
      title: "Run Paused",
      description: "Your run has been paused. Resume when ready.",
    })
  }

  const resumeRun = async () => {
    setIsPaused(false)
    isPausedRef.current = false
    const trackingStarted = await startGpsTracking()
    if (!trackingStarted) {
      toast({
        title: "GPS Error",
        description: "Unable to resume GPS tracking.",
        variant: "destructive"
      })
      return
    }

    toast({
      title: "Run Resumed",
      description: "GPS tracking resumed. Your run continues.",
    })
  }

  const stopRun = async () => {
    stopGpsTracking()
    setIsRunning(false)
    setIsPaused(false)
    isRunningRef.current = false
    isPausedRef.current = false

    const totalDistance = calculateTotalDistance(gpsPath)
    const finalDuration = metrics.duration

    if (totalDistance > 0 && finalDuration > 0) {
      await saveRun(totalDistance, finalDuration)
    } else {
      toast({
        title: "Run Stopped",
        description: "Run stopped. No data to save.",
      })
    }
  }

  const saveRun = async (distance: number, duration: number) => {
    try {
      const user = await dbUtils.getCurrentUser()
      if (!user) {
        toast({
          title: "Error",
          description: "User not found. Please try again.",
          variant: "destructive"
        })
        return
      }

      const runData = {
        userId: user.id!,
        type: currentWorkout?.type || 'easy',
        distance,
        duration,
        pace: duration / distance,
        calories: estimateCalories(duration, distance),
        notes: selectedRoute ? `Route: ${selectedRoute.name}` : undefined,
        route: selectedRoute?.name,
        gpsPath: JSON.stringify(gpsPath),
        gpsAccuracyData: JSON.stringify(gpsAccuracyHistory),
        startAccuracy: gpsPath[0]?.accuracy,
        endAccuracy: gpsPath[gpsPath.length - 1]?.accuracy,
        averageAccuracy: gpsAccuracyHistory.length > 0 
          ? gpsAccuracyHistory.reduce((sum, acc) => sum + acc.accuracy, 0) / gpsAccuracyHistory.length
          : undefined,
        completedAt: new Date(),
        workoutId: currentWorkout?.id
      }

      const runId = await dbUtils.createRun(runData)

      // Mark workout as completed if it exists
      if (currentWorkout) {
        await dbUtils.markWorkoutCompleted(currentWorkout.id!)
      }

      toast({
        title: "Run Saved",
        description: `${distance.toFixed(2)}km in ${formatTime(duration)}`,
      })

      // Navigate back to today screen
      router.push('/')
    } catch (error) {
      console.error('Error saving run:', error)
      toast({
        title: "Error",
        description: "Failed to save run. Please try again.",
        variant: "destructive"
      })
    }
  }

  const getGpsStatusColor = () => {
    switch (gpsPermission) {
      case 'granted': return gpsAccuracy < 10 ? 'text-green-500' : 'text-yellow-500'
      case 'denied': return 'text-red-500'
      case 'unsupported': return 'text-gray-500'
      default: return 'text-gray-400'
    }
  }

  const getGpsStatusText = () => {
    if (gpsPermission === 'granted') return 'GPS Active'
    if (gpsPermission === 'denied') return 'GPS Denied - Allow in browser settings'
    if (gpsPermission === 'unsupported') {
      const isSecure = typeof window !== 'undefined' && 
        (window.location.protocol === 'https:' || window.location.hostname === 'localhost');
      if (!isSecure) {
        return 'GPS requires HTTPS'
      }
      return 'GPS Unsupported'
    }
    return 'GPS Pending - Tap to enable'
  }

  const handleRouteSelected = (route: Route) => {
    setSelectedRoute(route)
    toast({
      title: "Route Selected",
      description: `${route.name} - ${route.distance}km (${route.safetyScore}% safe)`,
    })
  }

  const handleRouteWizardClose = () => {
    setShowRouteWizard(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push('/')} aria-label="Back to Today Screen">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold">Record Run</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowRoutesModal(true)} aria-label="Open Route Selector">
            <MapPin className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowRouteWizard(true)} aria-label="Open Route Wizard">
            <Map className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Selected Route Display */}
      {selectedRoute && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-green-900">{selectedRoute.name}</h3>
                <p className="text-sm text-green-700">
                  {selectedRoute.distance}km • {selectedRoute.safetyScore}% safe • {selectedRoute.difficulty}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedRoute(null)}
                className="text-green-700 border-green-300"
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* GPS Status */}
      <Card className={gpsPermission === 'denied' ? 'border-red-200 bg-red-50' : gpsPermission === 'granted' ? 'border-green-200 bg-green-50' : ''}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isInitializingGps ? (
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
              ) : (
                <Satellite className={`h-5 w-5 ${getGpsStatusColor()}`} />
              )}
              <div>
                <p className="font-medium">{isInitializingGps ? 'Initializing GPS...' : getGpsStatusText()}</p>
                <p className="text-sm text-gray-600">
                  {isInitializingGps 
                    ? 'Please allow location access when prompted'
                    : gpsAccuracy > 0 
                      ? `Accuracy: ${gpsAccuracy.toFixed(1)}m` 
                      : 'Accuracy: Waiting for signal'
                  }
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {/* Enable GPS button for prompt state */}
              {gpsPermission === 'prompt' && !isInitializingGps && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={initializeGps}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Enable GPS
                </Button>
              )}
              {/* Retry button for denied state */}
              {gpsPermission === 'denied' && !isInitializingGps && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={initializeGps}
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Retry
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGPSDetails(!showGPSDetails)}
              >
                {showGPSDetails ? 'Hide' : 'Details'}
              </Button>
            </div>
          </div>

          {/* GPS Permission Denied Warning */}
          {gpsPermission === 'denied' && (
            <div className="mt-3 p-3 bg-red-100 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-800">Location Access Denied</p>
                  <p className="text-sm text-red-700 mt-1">
                    To record your run with GPS tracking, please:
                  </p>
                  <ol className="text-sm text-red-700 mt-2 list-decimal list-inside space-y-1">
                    <li>Open your browser settings</li>
                    <li>Find location/privacy settings</li>
                    <li>Allow location access for this site</li>
                    <li>Tap "Retry" above</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* GPS Unsupported Warning */}
          {gpsPermission === 'unsupported' && (
            <div className="mt-3 p-3 bg-gray-100 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-800">GPS Unavailable</p>
                  <p className="text-sm text-gray-700 mt-1">
                    GPS is not available on this device or browser. You can still use the "Add Manual Run" option below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* GPS Details */}
          {showGPSDetails && (
            <div className="mt-4 pt-4 border-t">
              {currentGPSAccuracy ? (
                <GPSAccuracyIndicator 
                  accuracy={currentGPSAccuracy}
                  onAccuracyChange={(data: GPSAccuracyData) => {
                    setCurrentGPSAccuracy(data)
                    setGpsAccuracyHistory(prev => [...prev.slice(-10), data])
                  }}
                  showTroubleshooting={true}
                />
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <Satellite className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">GPS accuracy data will appear here once tracking starts</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Controls */}
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-6">
            {/* Metrics Display */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {metrics.distance.toFixed(2)}
                </p>
                <p className="text-sm text-gray-600">Distance (km)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {formatTime(metrics.duration)}
                </p>
                <p className="text-sm text-gray-600">Duration</p>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex justify-center gap-4">
              {!isRunning ? (
                <Button
                  onClick={startRun}
                  size="lg"
                  className="bg-green-600 hover:bg-green-700"
                  disabled={gpsPermission === 'denied' || gpsPermission === 'unsupported' || isInitializingGps}
                >
                  {isInitializingGps ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-5 w-5 mr-2" />
                  )}
                  {isInitializingGps ? 'Initializing GPS...' : 'Start Run'}
                </Button>
              ) : (
                <>
                  {isPaused ? (
                    <Button
                      onClick={resumeRun}
                      size="lg"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Play className="h-5 w-5 mr-2" />
                      Resume
                    </Button>
                  ) : (
                    <Button
                      onClick={pauseRun}
                      size="lg"
                      variant="outline"
                    >
                      <Pause className="h-5 w-5 mr-2" />
                      Pause
                    </Button>
                  )}
                  <Button
                    onClick={stopRun}
                    size="lg"
                    variant="destructive"
                  >
                    <Square className="h-5 w-5 mr-2" />
                    Stop
                  </Button>
                </>
              )}
            </div>

            {/* Manual Entry Option */}
            {!isRunning && (
              <div className="pt-4 border-t space-y-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowManualModal(true)}
                  className="text-gray-600 w-full"
                >
                  <Volume2 className="h-4 w-4 mr-2" />
                  Add Manual Run
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAddActivityModal(true)}
                  className="w-full"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Upload photo & use AI
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Route Visualization */}
      {gpsPath.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium mb-3">Route</h3>
            <div className="h-64 bg-gray-100 rounded-lg overflow-hidden">
              <RouteVisualization gpsPath={gpsPath} currentPosition={currentPosition} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Running Tips */}
      {isRunning && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="text-center">
              <h3 className="font-medium text-blue-900 mb-2">
                {isPaused ? 'Take your time! ⏸️' : 'Keep it up! 🏃‍♂️'}
              </h3>
              <p className="text-sm text-blue-800">
                {isPaused 
                  ? 'Resume when you\'re ready to continue.'
                  : 'Maintain a steady rhythm and focus on your breathing.'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recovery Status */}
      <RecoveryRecommendations
        userId={1}
        date={new Date()}
        showBreakdown={false}
        onRefresh={() => {
          console.log('Refreshing recovery data for record screen...');
        }}
      />

      {/* Modals */}
      {showRoutesModal && (
        <RouteSelectorModal
          isOpen={showRoutesModal}
          onClose={() => setShowRoutesModal(false)}
          onRouteSelected={handleRouteSelected}
        />
      )}
      {showRouteWizard && (
        <RouteSelectionWizard
          isOpen={showRouteWizard}
          onClose={handleRouteWizardClose}
          userExperience={currentUser?.experience || 'beginner'}
          onRouteSelected={handleRouteSelected}
        />
      )}
      {showManualModal && (
        <ManualRunModal 
          isOpen={showManualModal} 
          onClose={() => setShowManualModal(false)}
          workoutId={currentWorkout?.id}
          onSaved={() => {
            // Navigate back to today screen after saving manual run
            router.push('/')
          }}
        />
      )}
      <AddActivityModal
        open={showAddActivityModal}
        onOpenChange={setShowAddActivityModal}
        initialStep="upload"
        workoutId={currentWorkout?.type === "rest" ? undefined : currentWorkout?.id}
        runTypeHint={currentWorkout ? workoutTypeToRunType(currentWorkout.type) : undefined}
        onActivityAdded={() => router.push("/")}
      />
    </div>
  )
}

// Simple route visualization component
function RouteVisualization({ gpsPath, currentPosition }: { 
  gpsPath: GPSCoordinate[]
  currentPosition: GPSCoordinate | null 
}) {
  if (gpsPath.length === 0) return null

  // Calculate bounds for the route
  const latitudes = gpsPath.map(p => p.latitude)
  const longitudes = gpsPath.map(p => p.longitude)
  const minLat = Math.min(...latitudes)
  const maxLat = Math.max(...latitudes)
  const minLng = Math.min(...longitudes)
  const maxLng = Math.max(...longitudes)

  // Create path string for SVG
  const pathString = gpsPath.map((point, index) => {
    const x = ((point.longitude - minLng) / (maxLng - minLng || 1)) * 220 + 20
    const y = ((maxLat - point.latitude) / (maxLat - minLat || 1)) * 220 + 20
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')

  return (
    <svg className="w-full h-full" viewBox="0 0 260 260">
      {/* Route path */}
      <path
        d={pathString}
        stroke="rgb(34, 197, 94)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Start point */}
      {gpsPath.length > 0 && (
        <circle
          cx={((gpsPath[0].longitude - minLng) / (maxLng - minLng || 1)) * 220 + 20}
          cy={((maxLat - gpsPath[0].latitude) / (maxLat - minLat || 1)) * 220 + 20}
          r="4"
          fill="rgb(34, 197, 94)"
        />
      )}
      
      {/* Current position */}
      {currentPosition && (
        <circle
          cx={((currentPosition.longitude - minLng) / (maxLng - minLng || 1)) * 220 + 20}
          cy={((maxLat - currentPosition.latitude) / (maxLat - minLat || 1)) * 220 + 20}
          r="6"
          fill="rgb(59, 130, 246)"
          stroke="white"
          strokeWidth="2"
        />
      )}
    </svg>
  )
}
