'use client';

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Map, Play, Pause, Square, Volume2, Satellite, MapPin, AlertTriangle, Info, Loader2, Sparkles } from "lucide-react"
import { RouteSelectorModal } from "@/components/route-selector-modal"
import { RouteSelectionWizard } from "@/components/route-selection-wizard"
import { ManualRunModal } from "@/components/manual-run-modal"
import { RunMap } from "@/components/maps/RunMap"
import { type Run, type Workout, type User } from "@/lib/db"
import { dbUtils } from "@/lib/dbUtils"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import RecoveryRecommendations from "@/components/recovery-recommendations"
import { GPSAccuracyIndicator } from "@/components/gps-accuracy-indicator"
import { GPSMonitoringService, type GPSAccuracyData } from "@/lib/gps-monitoring"
import { calculateDistance } from "@/lib/routeUtils"

interface GPSCoordinate {
  latitude: number
  longitude: number
  timestamp: number
  accuracy?: number
}

interface RunMetrics {
  distance: number // in km
  duration: number // in seconds
  pace: number // average seconds per km
  currentPace: number // rolling seconds per km
  currentSpeed: number // rolling m/s
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
	  const [currentGPSAccuracy, setCurrentGPSAccuracy] = useState<GPSAccuracyData | null>(null)
	  const [gpsAccuracyHistory, setGpsAccuracyHistory] = useState<GPSAccuracyData[]>([])
	  const [showGPSDetails, setShowGPSDetails] = useState(false)
  
  // GPS and tracking state
  const [gpsPath, setGpsPath] = useState<GPSCoordinate[]>([])
  const [currentPosition, setCurrentPosition] = useState<GPSCoordinate | null>(null)
  const gpsPathRef = useRef<GPSCoordinate[]>([])
  const watchIdRef = useRef<number | null>(null)
  const totalDistanceKmRef = useRef(0)
  const lastRecordedPointRef = useRef<GPSCoordinate | null>(null)
  const gpsMonitoringRef = useRef<GPSMonitoringService | null>(null)
  const startTimeRef = useRef<number>(0)
  const elapsedRunMsRef = useRef<number>(0)
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
    currentPace: 0,
    currentSpeed: 0,
    calories: 0
  })

  const { toast } = useToast()
  const router = useRouter()

  const resolveCurrentUser = async (): Promise<User | null> => {
    if (currentUser?.id) return currentUser

    try {
      const user = await dbUtils.getCurrentUser()
      if (user) {
        setCurrentUser(user)
      }
      return user
    } catch (error) {
      console.error("Error resolving current user:", error)
      return null
    }
  }

  const resolveRunType = (workoutType?: Workout["type"]): Run["type"] => {
    switch (workoutType) {
      case "easy":
      case "tempo":
      case "intervals":
      case "long":
      case "time-trial":
      case "hill":
        return workoutType
      default:
        return "other"
    }
  }

  // Load today's workout and user data on mount
  useEffect(() => {
    loadTodaysWorkout()
    loadCurrentUser()
    
    // Check GPS support but do not request permission until the run starts (Start/Resume).
    const setupGps = async () => {
      await checkGpsSupport()
    }
    setupGps()
    
    return () => {
      stopGpsTracking()
    }
  }, [])

  // Timer effect for duration tracking
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRunning && !isPaused && startTimeRef.current) {
      interval = setInterval(() => {
        const now = Date.now()
        const duration = Math.floor((elapsedRunMsRef.current + (now - startTimeRef.current)) / 1000)
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

  const resetRunTrackingState = () => {
    gpsPathRef.current = []
    setGpsPath([])
    totalDistanceKmRef.current = 0
    lastRecordedPointRef.current = null
    gpsMonitoringRef.current = null
    setCurrentGPSAccuracy(null)
    setGpsAccuracyHistory([])
    setMetrics({
      distance: 0,
      duration: 0,
      pace: 0,
      currentPace: 0,
      currentSpeed: 0,
      calories: 0
    })
  }

  const recordPointForActiveRun = (nextPoint: GPSCoordinate) => {
    const lastPoint = lastRecordedPointRef.current

    // Accuracy filtering: ignore noisy fixes before they can affect distance accumulation.
    // Typical outdoor running is < ~20m; beyond ~40m tends to add lots of jitter/overcount.
    const MAX_ACCEPTABLE_ACCURACY_METERS = 40
    const nextAccuracy = typeof nextPoint.accuracy === 'number' ? nextPoint.accuracy : Number.POSITIVE_INFINITY
    if (nextAccuracy > MAX_ACCEPTABLE_ACCURACY_METERS) return

    // First accepted fix becomes our baseline (no distance added yet).
    if (!lastPoint) {
      lastRecordedPointRef.current = nextPoint
      setGpsPath((previousPath) => {
        const nextPath = [...previousPath, nextPoint]
        gpsPathRef.current = nextPath
        return nextPath
      })
      return
    }

    const timeDeltaMs = nextPoint.timestamp - lastPoint.timestamp
    if (!Number.isFinite(timeDeltaMs) || timeDeltaMs <= 0) return
    if (timeDeltaMs < 400) return

    const segmentDistanceKm = calculateDistance(
      lastPoint.latitude,
      lastPoint.longitude,
      nextPoint.latitude,
      nextPoint.longitude
    )
    const segmentDistanceMeters = segmentDistanceKm * 1000
    const timeDeltaSeconds = timeDeltaMs / 1000
    const segmentSpeedMps = segmentDistanceMeters / timeDeltaSeconds

    // Basic GPS filtering:
    // - Jump rejection: ignore implausible speed spikes ("teleports").
    // - Jitter rejection: ignore very small deltas likely caused by GPS noise.
    const MAX_REASONABLE_SPEED_MPS = 9 // ~32 km/h (beyond elite running, filters car/GPS jumps)
    const MIN_DISTANCE_METERS = Math.max(2, nextAccuracy * 0.1)

    if (segmentSpeedMps > MAX_REASONABLE_SPEED_MPS) return
    if (segmentDistanceMeters < MIN_DISTANCE_METERS) return

    lastRecordedPointRef.current = nextPoint
    // Incremental accumulation: only add this accepted segment (do not recompute over full path).
    totalDistanceKmRef.current += segmentDistanceKm

    // Current speed/pace: derived from the last accepted GPS segment (timestamp-to-timestamp).
    // (Avoid deriving instantaneous pace from total duration/total distance on every GPS update.)
    const currentSpeedMps = segmentSpeedMps
    const currentPaceSecondsPerKm = currentSpeedMps > 0 ? 1000 / currentSpeedMps : 0

    setGpsPath((previousPath) => {
      const nextPath = [...previousPath, nextPoint]
      gpsPathRef.current = nextPath
      return nextPath
    })

    setMetrics((previousMetrics) => ({
      ...previousMetrics,
      distance: totalDistanceKmRef.current,
      currentPace: currentPaceSecondsPerKm,
      currentSpeed: currentSpeedMps,
    }))
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

          const timestamp = Number.isFinite(position.timestamp) ? position.timestamp : Date.now()
          const newPosition: GPSCoordinate = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp,
            accuracy: position.coords.accuracy
          }

          setCurrentPosition(newPosition)
          setGpsAccuracy(position.coords.accuracy)
          setGpsPermission('granted')

          const gpsService = gpsMonitoringRef.current ?? new GPSMonitoringService()
          gpsMonitoringRef.current = gpsService
          const accuracyData = gpsService.calculateAccuracyMetrics(position)
          setCurrentGPSAccuracy(accuracyData)
          setGpsAccuracyHistory((prev) => [...prev.slice(-99), accuracyData])

          if (isRunningRef.current && !isPausedRef.current) {
            recordPointForActiveRun(newPosition)
          }
        },
        (error) => {
          console.error('[GPS] GPS tracking error:', error)
          if (error.code === 1) {
            clearTimeout(timeoutId)
            setGpsPermission('denied')
            stopGpsTracking()
            if (!settled) {
              settle(false)
            }
            return
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 20_000,
          maximumAge: 0
        }
      )

      // Resolve happens on first position update (or error/timeout).
    })
  }

  const stopGpsTracking = () => {
    // Explicit null check (watchId can be `0`, so truthy checks break cleanup).
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }

	  const estimateCalories = (_durationSeconds: number, distanceKm: number): number => {
	    // Simple calorie estimation: ~60 calories per km for average runner
	    return Math.round(distanceKm * 60)
	  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatPace = (secondsPerKm: number) => {
    if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '--:--'
    const mins = Math.floor(secondsPerKm / 60)
    const secs = Math.round(secondsPerKm % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

 	  const startRun = async () => {
    const user = await resolveCurrentUser()
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not found. Please complete onboarding first.",
        variant: "destructive",
      })
      router.push("/")
      return
    }

    startTimeRef.current = Date.now()
    elapsedRunMsRef.current = 0
    resetRunTrackingState()

    setIsRunning(true)
    setIsPaused(false)
    isRunningRef.current = true
    isPausedRef.current = false
    setIsInitializingGps(true)
    let trackingStarted = false
    try {
      trackingStarted = await startGpsTracking()
    } finally {
      setIsInitializingGps(false)
    }
    if (!trackingStarted) {
      setIsRunning(false)
      isRunningRef.current = false
      startTimeRef.current = 0
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
    if (startTimeRef.current) {
      elapsedRunMsRef.current += Date.now() - startTimeRef.current
      startTimeRef.current = 0
      const duration = Math.floor(elapsedRunMsRef.current / 1000)
      setMetrics((previousMetrics) => ({
        ...previousMetrics,
        duration,
        pace: previousMetrics.distance > 0 ? duration / previousMetrics.distance : 0,
        currentPace: 0,
        currentSpeed: 0,
        calories: estimateCalories(duration, previousMetrics.distance),
      }))
    }

    stopGpsTracking()
    setIsInitializingGps(false)
    // Break distance accumulation between paused segments (avoid counting movement while paused).
    lastRecordedPointRef.current = null
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
    startTimeRef.current = Date.now()
    lastRecordedPointRef.current = null
    setIsInitializingGps(true)
    let trackingStarted = false
    try {
      trackingStarted = await startGpsTracking()
    } finally {
      setIsInitializingGps(false)
    }
    if (!trackingStarted) {
      setIsPaused(true)
      isPausedRef.current = true
      startTimeRef.current = 0
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
    setIsInitializingGps(false)
    setIsRunning(false)
    setIsPaused(false)
    isRunningRef.current = false
    isPausedRef.current = false
    lastRecordedPointRef.current = null

    if (startTimeRef.current) {
      elapsedRunMsRef.current += Date.now() - startTimeRef.current
      startTimeRef.current = 0
    }

    const totalDistance = totalDistanceKmRef.current
    const finalDuration = Math.floor(elapsedRunMsRef.current / 1000)

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
	      const user = await resolveCurrentUser()
	      if (!user?.id) {
        toast({
          title: "Error",
          description: "User not found. Please complete onboarding first.",
          variant: "destructive"
        })
        return
      }

	      const startAccuracy = gpsPathRef.current.at(0)?.accuracy
	      const endAccuracy = gpsPathRef.current.at(-1)?.accuracy
	      const averageAccuracy =
	        gpsAccuracyHistory.length > 0
	          ? gpsAccuracyHistory.reduce((sum, acc) => sum + acc.accuracyRadius, 0) / gpsAccuracyHistory.length
	          : undefined

	      const runData: Omit<Run, 'id' | 'createdAt'> = {
	        userId: user.id,
	        type: resolveRunType(currentWorkout?.type),
	        distance,
	        duration,
	        pace: duration / distance,
	        calories: estimateCalories(duration, distance),
	        gpsPath: JSON.stringify(gpsPathRef.current),
	        gpsAccuracyData: JSON.stringify(gpsAccuracyHistory),
	        completedAt: new Date(),
	        ...(selectedRoute
	          ? { notes: `Route: ${selectedRoute.name}`, route: selectedRoute.name }
	          : {}),
	        ...(typeof startAccuracy === 'number' ? { startAccuracy } : {}),
	        ...(typeof endAccuracy === 'number' ? { endAccuracy } : {}),
	        ...(typeof averageAccuracy === 'number' ? { averageAccuracy } : {}),
	        ...(typeof currentWorkout?.id === 'number' ? { workoutId: currentWorkout.id } : {}),
	      }

	      await dbUtils.createRun(runData)

	      // Mark workout as completed if it exists
	      if (currentWorkout?.id) {
	        await dbUtils.markWorkoutCompleted(currentWorkout.id)
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
      case 'granted': {
        if (gpsAccuracy <= 0) return 'text-gray-400'
        return gpsAccuracy < 10 ? 'text-green-500' : 'text-yellow-500'
      }
      case 'denied': return 'text-red-500'
      case 'unsupported': return 'text-gray-500'
      default: return 'text-gray-400'
    }
  }

  const getGpsStatusText = () => {
    if (gpsPermission === 'granted') return watchIdRef.current !== null ? 'GPS Tracking' : 'GPS Ready'
    if (gpsPermission === 'denied') return 'GPS Denied - Allow in browser settings'
    if (gpsPermission === 'unsupported') {
      const isSecure = typeof window !== 'undefined' && 
        (window.location.protocol === 'https:' || window.location.hostname === 'localhost');
      if (!isSecure) {
        return 'GPS requires HTTPS'
      }
      return 'GPS Unsupported'
    }
    return 'GPS Pending - Starts when you start a run'
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
                      : watchIdRef.current !== null
                        ? 'Accuracy: Waiting for signal'
                        : 'Accuracy: Start a run to begin tracking'
                  }
                </p>
              </div>
            </div>
             <div className="flex gap-2">
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
                      <li>Return here and tap &quot;Start Run&quot; again</li>
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
                    GPS is not available on this device or browser. You can still use the &quot;Add Manual Run&quot; option below.
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
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {formatPace(metrics.pace)}
                </p>
                <p className="text-sm text-gray-600">Pace (min/km)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">
                  {Number.isFinite(metrics.currentSpeed) ? (metrics.currentSpeed * 3.6).toFixed(1) : '0.0'}
                </p>
                <p className="text-sm text-gray-600">Speed (km/h)</p>
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

      {/* Live Map */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-medium mb-3">Map</h3>
          <div className="relative h-64 rounded-lg overflow-hidden">
            <RunMap
              height="100%"
              userLocation={
                isRunning && currentPosition
                  ? { lat: currentPosition.latitude, lng: currentPosition.longitude }
                  : null
              }
              path={gpsPath.map((p) => ({ lat: p.latitude, lng: p.longitude }))}
              followUser={isRunning && !isPaused}
            />
            {!isRunning && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
                <div className="bg-white/90 dark:bg-slate-800/90 rounded-lg px-3 py-2 shadow">
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    Start a run to enable live GPS tracking
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
	        {...(currentUser?.id ? { userId: currentUser.id } : {})}
	        showBreakdown={false}
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
	          {...(currentWorkout?.id ? { workoutId: currentWorkout.id } : {})}
	          onSaved={() => {
	            // Navigate back to today screen after saving manual run
	            router.push('/')
	          }}
        />
      )}
    </div>
  )
}
