'use client';

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Map, Play, Pause, Square, Volume2, Satellite, MapPin, AlertTriangle, Info, Loader2, Sparkles } from "lucide-react"
import { RouteSelectorModal } from "@/components/route-selector-modal"
import { RouteSelectionWizard } from "@/components/route-selection-wizard"
import { ManualRunModal } from "@/components/manual-run-modal"
import { RunMap } from "@/components/maps/RunMap"
import { type Run, type Workout, type User, type Route } from "@/lib/db"
import { dbUtils } from "@/lib/dbUtils"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import RecoveryRecommendations from "@/components/recovery-recommendations"
import { GPSAccuracyIndicator } from "@/components/gps-accuracy-indicator"
import { GPSMonitoringService, type GPSAccuracyData } from "@/lib/gps-monitoring"
import { calculateDistance, calculateWaypointDistance } from "@/lib/routeUtils"
import { useGpsTracking, type GPSPoint } from "@/hooks/use-gps-tracking"

type GPSCoordinate = GPSPoint

type GPSRejectReason = 'accuracy' | 'duplicate' | 'stale' | 'speed' | 'jitter'

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

  const gpsDebugEnabled =
    process.env.NODE_ENV !== 'production' &&
    (process.env.NEXT_PUBLIC_GPS_DEBUG_OVERLAY === 'true' ||
      (typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).has('gpsDebug')))
   
  // GPS and tracking state
  const [gpsPath, setGpsPath] = useState<GPSCoordinate[]>([])
  const [currentPosition, setCurrentPosition] = useState<GPSCoordinate | null>(null)
  const gpsPathRef = useRef<GPSCoordinate[]>([])
  const totalDistanceKmRef = useRef(0)
  const lastRecordedPointRef = useRef<GPSCoordinate | null>(null)
  const gpsMonitoringRef = useRef<GPSMonitoringService | null>(null)
  const acceptedPointCountRef = useRef(0)
  const rejectedPointCountRef = useRef(0)
  const rejectionReasonsRef = useRef<Record<GPSRejectReason, number>>({})
  const GPS_MAX_ACCEPTABLE_ACCURACY_METERS = 80
  const GPS_DEFAULT_ACCURACY_METERS = 50
  const GPS_MIN_TIME_DELTA_MS = 700
  const MAX_REASONABLE_SPEED_MPS = 9
  const MIN_DISTANCE_FOR_PACE_KM = 0.05
  const startTimeRef = useRef<number>(0)
  const elapsedRunMsRef = useRef<number>(0)
  const isRunningRef = useRef(false)
  const isPausedRef = useRef(false)

  const [lastGpsSpeedMps, setLastGpsSpeedMps] = useState<number | null>(null)
  const [gpsAcceptedCount, setGpsAcceptedCount] = useState(0)
  const [gpsRejectedCount, setGpsRejectedCount] = useState(0)
  const [gpsRejectReasons, setGpsRejectReasons] = useState<Record<string, number>>({})
  const [lastRejectReason, setLastRejectReason] = useState<GPSRejectReason | null>(null)
  const [lastSegmentStats, setLastSegmentStats] = useState<{
    distanceMeters: number
    timeDeltaMs: number
    speedMps: number
  } | null>(null)
  const [debugPathOverride, setDebugPathOverride] = useState<GPSCoordinate[] | null>(null)
  const [goldenRunSummary, setGoldenRunSummary] = useState<{
    name: string
    expectedDistanceKm: number
    expectedPace?: string
    computedDistanceKm: number
    computedPaceSecondsPerKm: number
    computedPaceFormatted: string
    deltaMeters: number
  } | null>(null)
  const [goldenRunError, setGoldenRunError] = useState<string | null>(null)

  useEffect(() => {
    isRunningRef.current = isRunning
    isPausedRef.current = isPaused
  }, [isRunning, isPaused])

  const logGps = (payload: Record<string, unknown>) => {
    if (!gpsDebugEnabled) return
    console.log('[GPS]', payload)
  }

  const logRunStats = (payload: Record<string, unknown>) => {
    if (!gpsDebugEnabled) return
    console.log('[RUNSTATS]', payload)
  }

  const round = (value: number, precision: number) => {
    const factor = Math.pow(10, precision)
    return Math.round(value * factor) / factor
  }
  
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
      stopTracking()
    }
  }, [])

  // Timer effect for duration tracking
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRunning && !isPaused && startTimeRef.current) {
      interval = setInterval(() => {
        const now = Date.now()
        const duration = Math.floor((elapsedRunMsRef.current + (now - startTimeRef.current)) / 1000)
        setMetrics(prev => {
          const distanceForPace = prev.distance >= MIN_DISTANCE_FOR_PACE_KM ? prev.distance : 0
          return {
            ...prev,
            duration,
            pace: distanceForPace > 0 ? duration / distanceForPace : 0,
            calories: estimateCalories(duration, prev.distance)
          }
        })
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

  const resetGpsDebugStats = () => {
    acceptedPointCountRef.current = 0
    rejectedPointCountRef.current = 0
    rejectionReasonsRef.current = {}
    setGpsAcceptedCount(0)
    setGpsRejectedCount(0)
    setGpsRejectReasons({})
    setLastRejectReason(null)
    setLastSegmentStats(null)
  }

  const resetRunTrackingState = () => {
    gpsPathRef.current = []
    setGpsPath([])
    setCurrentPosition(null)
    setGpsAccuracy(0)
    setLastGpsSpeedMps(null)
    totalDistanceKmRef.current = 0
    lastRecordedPointRef.current = null
    gpsMonitoringRef.current = null
    setCurrentGPSAccuracy(null)
    setGpsAccuracyHistory([])
    resetGpsDebugStats()
    setMetrics({
      distance: 0,
      duration: 0,
      pace: 0,
      currentPace: 0,
      currentSpeed: 0,
      calories: 0
    })
  }

  const normalizeGpsTimestamp = (timestamp: number, lastTimestamp: number | null) => {
    let resolved = Number.isFinite(timestamp) ? timestamp : Date.now()
    if (typeof lastTimestamp === 'number' && resolved <= lastTimestamp) {
      const now = Date.now()
      resolved = now > lastTimestamp ? now : lastTimestamp + GPS_MIN_TIME_DELTA_MS
    }
    return resolved
  }

  const trackRejection = (reason: GPSRejectReason, details: Record<string, unknown>) => {
    rejectedPointCountRef.current += 1
    const nextReasons = {
      ...rejectionReasonsRef.current,
      [reason]: (rejectionReasonsRef.current[reason] ?? 0) + 1,
    }
    rejectionReasonsRef.current = nextReasons
    setGpsRejectedCount(rejectedPointCountRef.current)
    setGpsRejectReasons(nextReasons)
    setLastRejectReason(reason)
    logGps({ event: 'reject', reason, ...details })
  }

  const trackAcceptance = (details: Record<string, unknown>) => {
    acceptedPointCountRef.current += 1
    setGpsAcceptedCount(acceptedPointCountRef.current)
    logGps({ event: 'accept', ...details })
  }

  const recordPointForActiveRun = (nextPoint: GPSCoordinate) => {
    const lastPoint = lastRecordedPointRef.current
    const accuracyValue =
      typeof nextPoint.accuracy === 'number' && Number.isFinite(nextPoint.accuracy)
        ? nextPoint.accuracy
        : GPS_DEFAULT_ACCURACY_METERS
    if (accuracyValue > GPS_MAX_ACCEPTABLE_ACCURACY_METERS) {
      trackRejection('accuracy', {
        accuracy: accuracyValue,
        threshold: GPS_MAX_ACCEPTABLE_ACCURACY_METERS,
      })
      return
    }

    const normalizedTimestamp = normalizeGpsTimestamp(nextPoint.timestamp, lastPoint?.timestamp ?? null)
    const normalizedPoint: GPSCoordinate = {
      ...nextPoint,
      timestamp: normalizedTimestamp,
      accuracy: accuracyValue,
    }

    // First accepted fix becomes our baseline (no distance added yet).
    if (!lastPoint) {
      lastRecordedPointRef.current = normalizedPoint
      setGpsPath((previousPath) => {
        const nextPath = [...previousPath, normalizedPoint]
        gpsPathRef.current = nextPath
        return nextPath
      })
      trackAcceptance({
        accuracy: accuracyValue,
        latitude: normalizedPoint.latitude,
        longitude: normalizedPoint.longitude,
        timestamp: normalizedPoint.timestamp,
        reason: 'first_fix',
      })
      return
    }

    const timeDeltaMs = normalizedPoint.timestamp - lastPoint.timestamp
    if (!Number.isFinite(timeDeltaMs) || timeDeltaMs <= 0) {
      trackRejection('stale', {
        timeDeltaMs,
        lastTimestamp: lastPoint.timestamp,
        nextTimestamp: normalizedPoint.timestamp,
      })
      return
    }

    if (timeDeltaMs < GPS_MIN_TIME_DELTA_MS) {
      trackRejection('duplicate', { timeDeltaMs, minDeltaMs: GPS_MIN_TIME_DELTA_MS })
      return
    }

    const segmentDistanceKm = calculateDistance(
      lastPoint.latitude,
      lastPoint.longitude,
      normalizedPoint.latitude,
      normalizedPoint.longitude
    )
    const segmentDistanceMeters = segmentDistanceKm * 1000
    const timeDeltaSeconds = timeDeltaMs / 1000
    const segmentSpeedMps = segmentDistanceMeters / timeDeltaSeconds

    // Basic GPS filtering:
    // - Jump rejection: ignore implausible speed spikes ("teleports").
    // - Jitter rejection: ignore very small deltas likely caused by GPS noise.
    const minDistanceMeters = Math.max(0.8, Math.min(2, accuracyValue * 0.025))

    if (segmentSpeedMps > MAX_REASONABLE_SPEED_MPS) {
      trackRejection('speed', { segmentSpeedMps, maxSpeedMps: MAX_REASONABLE_SPEED_MPS })
      return
    }

    if (segmentDistanceMeters < minDistanceMeters) {
      trackRejection('jitter', { segmentDistanceMeters, minDistanceMeters })
      return
    }

    lastRecordedPointRef.current = normalizedPoint
    // Incremental accumulation: only add this accepted segment (do not recompute over full path).
    totalDistanceKmRef.current += segmentDistanceKm

    // Current speed/pace: derived from the last accepted GPS segment (timestamp-to-timestamp).
    // (Avoid deriving instantaneous pace from total duration/total distance on every GPS update.)
    const currentSpeedMps = segmentSpeedMps
    const currentPaceSecondsPerKm = currentSpeedMps > 0 ? 1000 / currentSpeedMps : 0

    setGpsPath((previousPath) => {
      const nextPath = [...previousPath, normalizedPoint]
      gpsPathRef.current = nextPath
      return nextPath
    })

    setLastSegmentStats({
      distanceMeters: segmentDistanceMeters,
      timeDeltaMs,
      speedMps: segmentSpeedMps,
    })

    setMetrics((previousMetrics) => ({
      ...previousMetrics,
      distance: totalDistanceKmRef.current,
      currentPace: currentPaceSecondsPerKm,
      currentSpeed: currentSpeedMps,
    }))

    trackAcceptance({
      segmentDistanceMeters: round(segmentDistanceMeters, 1),
      segmentSpeedMps: round(segmentSpeedMps, 2),
      timeDeltaMs,
      totalDistanceKm: round(totalDistanceKmRef.current, 3),
    })

    logRunStats({
      distanceKm: totalDistanceKmRef.current,
      durationSeconds: metrics.duration,
      currentPaceSecondsPerKm: currentPaceSecondsPerKm,
    })
  }

  const handleGpsPoint = (point: GPSCoordinate, position: GeolocationPosition) => {
    setCurrentPosition(point)
    setGpsAccuracy(point.accuracy ?? 0)
    setLastGpsSpeedMps(typeof point.speed === 'number' ? point.speed : null)
    setGpsPermission('granted')

    const gpsService = gpsMonitoringRef.current ?? new GPSMonitoringService()
    gpsMonitoringRef.current = gpsService
    const accuracyData = gpsService.calculateAccuracyMetrics(position)
    setCurrentGPSAccuracy(accuracyData)
    setGpsAccuracyHistory((prev) => [...prev.slice(-99), accuracyData])

    logGps({
      event: 'watch',
      latitude: point.latitude,
      longitude: point.longitude,
      timestamp: point.timestamp,
      accuracy: typeof point.accuracy === 'number' ? point.accuracy : null,
      speed: typeof point.speed === 'number' ? point.speed : null,
    })

    if (isRunningRef.current && !isPausedRef.current) {
      recordPointForActiveRun(point)
    }
  }

  const handleGpsError = (error: GeolocationPositionError) => {
    logGps({ event: 'error', code: error.code, message: error.message })
    if (error.code === 1) {
      setGpsPermission('denied')
    }
  }

  const {
    watchId: gpsWatchId,
    isTracking: isGpsTracking,
    callbackCount: gpsWatchCallbackCount,
    lastUpdateAt: lastGpsUpdateAt,
    startTracking,
    stopTracking,
  } = useGpsTracking({
    onPoint: handleGpsPoint,
    onError: handleGpsError,
    debug: gpsDebugEnabled,
  })

  const gpsTrackingOptions = {
    enableHighAccuracy: true,
    timeout: 20_000,
    maximumAge: 0,
  }

  const loadGoldenRun = async () => {
    if (!gpsDebugEnabled) return
    setGoldenRunError(null)
    try {
      const response = await fetch('/dev/golden-run.json', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`Failed to load golden run (${response.status})`)
      }
      const data = await response.json()
      const rawPoints = Array.isArray(data.points) ? data.points : []
      const parsedPoints = rawPoints
        .map((point: any, index: number) => {
          const lat = Number(point?.lat)
          const lng = Number(point?.lng)
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
          return {
            latitude: lat,
            longitude: lng,
            timestamp: typeof point.timestamp === 'number' ? point.timestamp : Date.now() + index * 1000,
            ...(typeof point.accuracy === 'number' ? { accuracy: point.accuracy } : {}),
          } as GPSCoordinate
        })
        .filter(Boolean) as GPSCoordinate[]

      if (parsedPoints.length < 2) {
        throw new Error('Golden run data is missing points')
      }

      const computedDistanceKm = calculateWaypointDistance(
        parsedPoints.map((point) => ({ lat: point.latitude, lng: point.longitude }))
      )
      const durationSeconds = typeof data.durationSeconds === 'number' ? data.durationSeconds : 0
      const computedPaceSecondsPerKm =
        computedDistanceKm > 0 && durationSeconds > 0 ? durationSeconds / computedDistanceKm : 0
      const computedPaceFormatted = formatPace(computedPaceSecondsPerKm)
      const expectedDistanceKm =
        typeof data.distanceKm === 'number' && Number.isFinite(data.distanceKm)
          ? data.distanceKm
          : computedDistanceKm
      const expectedPace = typeof data.expectedPace === 'string' ? data.expectedPace : undefined

      setGoldenRunSummary({
        name: typeof data.name === 'string' ? data.name : 'golden-run',
        expectedDistanceKm,
        expectedPace,
        computedDistanceKm,
        computedPaceSecondsPerKm,
        computedPaceFormatted,
        deltaMeters: (computedDistanceKm - expectedDistanceKm) * 1000,
      })

      if (isRunning) {
        setDebugPathOverride(null)
        setGoldenRunError('Stop the run before previewing the golden route.')
        return
      }

      setDebugPathOverride(parsedPoints)
    } catch (error) {
      setGoldenRunError(error instanceof Error ? error.message : 'Failed to load golden run')
    }
  }

  const clearGoldenRunPreview = () => {
    setDebugPathOverride(null)
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
      trackingStarted = await startTracking(gpsTrackingOptions)
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

    logRunStats({ event: 'start', startedAt: Date.now() })
  }

  const pauseRun = () => {
    if (startTimeRef.current) {
      elapsedRunMsRef.current += Date.now() - startTimeRef.current
      startTimeRef.current = 0
      const duration = Math.floor(elapsedRunMsRef.current / 1000)
      setMetrics((previousMetrics) => {
        const distanceForPace =
          previousMetrics.distance >= MIN_DISTANCE_FOR_PACE_KM ? previousMetrics.distance : 0
        return {
          ...previousMetrics,
          duration,
          pace: distanceForPace > 0 ? duration / distanceForPace : 0,
          currentPace: 0,
          currentSpeed: 0,
          calories: estimateCalories(duration, previousMetrics.distance),
        }
      })
    }

    stopTracking()
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
      trackingStarted = await startTracking(gpsTrackingOptions)
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

    logRunStats({ event: 'resume', resumedAt: Date.now() })
  }

  const stopRun = async () => {
    stopTracking()
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

    logRunStats({
      event: 'stop',
      distanceKm: totalDistance,
      durationSeconds: finalDuration,
      acceptedPoints: acceptedPointCountRef.current,
      rejectedPoints: rejectedPointCountRef.current,
    })

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
 	        gpsPath: JSON.stringify(
 	          gpsPathRef.current.map((point) => ({
 	            lat: point.latitude,
 	            lng: point.longitude,
 	            timestamp: point.timestamp,
 	            accuracy: point.accuracy,
 	          }))
 	        ),
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

	      const runId = await dbUtils.createRun(runData)

	      // Mark workout as completed if it exists
	      if (currentWorkout?.id) {
	        await dbUtils.markWorkoutCompleted(currentWorkout.id)
	      }

      toast({
        title: "Run Saved",
        description: `${distance.toFixed(2)}km in ${formatTime(duration)}`,
      })

      try {
        window.dispatchEvent(new CustomEvent("run-saved", { detail: { userId: user.id, runId } }))
        window.dispatchEvent(new CustomEvent("navigate-to-run-report", { detail: { runId } }))
      } catch {
        router.push('/')
      }
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
    if (gpsPermission === 'granted') return isGpsTracking ? 'GPS Tracking' : 'GPS Ready'
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

  const mapPath = !isRunning && debugPathOverride ? debugPathOverride : gpsPath
  const avgPaceSecondsPerKm =
    metrics.distance >= MIN_DISTANCE_FOR_PACE_KM ? metrics.duration / metrics.distance : 0
  const timeSinceLastGpsUpdateSec = lastGpsUpdateAt
    ? Math.round((Date.now() - lastGpsUpdateAt) / 1000)
    : null
  const rejectionSummary =
    Object.entries(gpsRejectReasons)
      .map(([reason, count]) => `${reason}:${count}`)
      .join(', ') || '--'
  const avgPaceFormatted = avgPaceSecondsPerKm > 0 ? formatPace(avgPaceSecondsPerKm) : '--:--'

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
                      : isGpsTracking
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

          {isRunning && gpsAccuracy > GPS_MAX_ACCEPTABLE_ACCURACY_METERS && (
            <div className="mt-3 p-3 bg-yellow-100 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-yellow-700 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-yellow-900">Low GPS accuracy</p>
                  <p className="text-sm text-yellow-800 mt-1">
                    Current accuracy (±{Math.round(gpsAccuracy)}m) is worse than the recording threshold (±{GPS_MAX_ACCEPTABLE_ACCURACY_METERS}m),
                    so points may be ignored and distance can undercount. Enable precise location and move to open sky.
                  </p>
                </div>
              </div>
            </div>
          )}

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

          {isRunning && gpsPermission === 'granted' && (
            <p className="mt-3 text-xs text-gray-600">
              Note: Mobile browsers do not reliably support background GPS tracking. Keep the screen on for best
              accuracy.
            </p>
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
              path={mapPath.map((p) => ({ lat: p.latitude, lng: p.longitude }))}
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
            {gpsDebugEnabled && (
              <div className="absolute bottom-2 left-2 right-2 rounded-md bg-black/70 text-white p-2 text-xs font-mono space-y-1">
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <span>perm={gpsPermission}</span>
                  <span>watchId={gpsWatchId ?? 'null'}</span>
                  <span>cb={gpsWatchCallbackCount}</span>
                  <span>acc={gpsAccuracy ? `${Math.round(gpsAccuracy)}m` : '--'}</span>
                  <span>path={gpsPathRef.current.length}</span>
                  <span>dist={Math.round((totalDistanceKmRef.current ?? 0) * 1000)}m</span>
                  <span>
                    spd=
                    {Number.isFinite(metrics.currentSpeed)
                      ? `${(metrics.currentSpeed * 3.6).toFixed(1)}kmh`
                      : '--'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <span>
                    last=
                    {currentPosition
                      ? `${currentPosition.latitude.toFixed(5)},${currentPosition.longitude.toFixed(5)}`
                      : '--'}
                  </span>
                  <span>
                    ts=
                    {currentPosition?.timestamp
                      ? new Date(currentPosition.timestamp).toLocaleTimeString()
                      : '--'}
                  </span>
                  <span>
                    since=
                    {lastGpsUpdateAt ? `${Math.round((Date.now() - lastGpsUpdateAt) / 1000)}s` : '--'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {gpsDebugEnabled && (
        <Card className="border-dashed border-gray-300">
          <CardContent className="p-4 space-y-3 text-xs font-mono">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">GPS Debug Panel</h3>
              {debugPathOverride && !isRunning && (
                <span className="text-[10px] text-green-700">Golden route preview</span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>permission: {gpsPermission}</div>
              <div>
                watch: {isGpsTracking ? 'started' : 'stopped'} (id: {gpsWatchId ?? 'null'})
              </div>
              <div>callbackCount: {gpsWatchCallbackCount}</div>
              <div>lastUpdate: {timeSinceLastGpsUpdateSec ?? '--'}s</div>
              <div>
                lastPoint:{' '}
                {currentPosition
                  ? `${currentPosition.latitude.toFixed(5)}, ${currentPosition.longitude.toFixed(5)}`
                  : '--'}
              </div>
              <div>
                lastTimestamp:{' '}
                {currentPosition?.timestamp
                  ? new Date(currentPosition.timestamp).toLocaleTimeString()
                  : '--'}
              </div>
              <div>accuracy: {gpsAccuracy ? `${Math.round(gpsAccuracy)}m` : '--'}</div>
              <div>speed: {lastGpsSpeedMps !== null ? `${lastGpsSpeedMps.toFixed(2)} m/s` : '--'}</div>
              <div>
                accepted/rejected: {gpsAcceptedCount}/{gpsRejectedCount}
              </div>
              <div>lastReject: {lastRejectReason ?? '--'}</div>
              <div>rejectReasons: {rejectionSummary}</div>
              <div>totalDistance: {Math.round(totalDistanceKmRef.current * 1000)}m</div>
              <div>
                paceInputs: dist={metrics.distance.toFixed(3)}km dur={metrics.duration}s avg={avgPaceFormatted}/km
              </div>
              <div>
                currentPace: {metrics.currentPace > 0 ? formatPace(metrics.currentPace) : '--:--'}/km
              </div>
              <div>
                lastSegment:{' '}
                {lastSegmentStats
                  ? `${Math.round(lastSegmentStats.distanceMeters)}m in ${Math.round(
                      lastSegmentStats.timeDeltaMs / 1000
                    )}s @ ${lastSegmentStats.speedMps.toFixed(2)} m/s`
                  : '--'}
              </div>
            </div>

            <div className="pt-3 border-t space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={loadGoldenRun}>
                  Load Golden Run
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearGoldenRunPreview}
                  disabled={!debugPathOverride}
                >
                  Clear Preview
                </Button>
              </div>
              {goldenRunSummary && (
                <div className="space-y-1">
                  <div>golden: {goldenRunSummary.name}</div>
                  <div>
                    distance: {goldenRunSummary.computedDistanceKm.toFixed(3)}km (expected{' '}
                    {goldenRunSummary.expectedDistanceKm.toFixed(3)}km, delta{' '}
                    {Math.round(goldenRunSummary.deltaMeters)}m)
                  </div>
                  <div>
                    pace: {goldenRunSummary.computedPaceFormatted}/km
                    {goldenRunSummary.expectedPace ? ` (expected ${goldenRunSummary.expectedPace})` : ''}
                  </div>
                </div>
              )}
              {goldenRunError && <div className="text-red-600">{goldenRunError}</div>}
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
