'use client';

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Map, Play, Pause, Square, Volume2, Satellite, MapPin, AlertTriangle, Info, Loader2, Sparkles, CheckCircle } from "lucide-react"
import { RouteSelectorModal } from "@/components/route-selector-modal"
import { RouteSelectionWizard } from "@/components/route-selection-wizard"
import { ManualRunModal } from "@/components/manual-run-modal"
import { AddActivityModal } from "@/components/add-activity-modal"
import { RunMap } from "@/components/maps/RunMap"
import { WorkoutCompletionModal } from "@/components/workout-completion-modal"
import { ChallengeCompletionModal } from "@/components/challenge-completion-modal"
import { type Run, type Workout, type User, type Route, type ChallengeProgress, type ChallengeTemplate } from "@/lib/db"
import { dbUtils } from "@/lib/dbUtils"
import { trackAnalyticsEvent } from "@/lib/analytics"
import { getActiveChallenge, updateChallengeOnWorkoutComplete } from "@/lib/challengeEngine"
import { ENABLE_AUTO_PAUSE, ENABLE_VIBRATION_COACH, ENABLE_AUDIO_COACH } from "@/lib/featureFlags"
import { recordRunWithSideEffects } from "@/lib/run-recording"
import {
  getCoachingCueState,
  initializeCoachingCues,
  cueSingle,
  setVibrationEnabled as persistVibrationEnabled,
  setAudioEnabled as persistAudioEnabled,
  cleanupCoachingCues,
  type CoachingCueState,
} from "@/lib/coaching-cues"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import RecoveryRecommendations from "@/components/recovery-recommendations"
import { GPSAccuracyIndicator } from "@/components/gps-accuracy-indicator"
import { GPSMonitoringService, type GPSAccuracyData } from "@/lib/gps-monitoring"
import { calculateDistance, calculateWaypointDistance } from "@/lib/routeUtils"
import { useGpsTracking, type GPSPoint } from "@/hooks/use-gps-tracking"
import { RunSmartBrandMark } from "@/components/run-smart-brand-mark"
import { useWakeLock } from "@/hooks/use-wake-lock"
import { RecordingCheckpointService, type RecordingCheckpoint } from "@/lib/recording-checkpoint"

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

type IntervalPhaseType = 'warmup' | 'interval' | 'recovery' | 'cooldown'

interface IntervalPhase {
  type: IntervalPhaseType
  duration?: number // seconds
  distance?: number // km
}

const AUTO_PAUSE_SPEED_MPS = 0.2
const AUTO_RESUME_SPEED_MPS = 1.0
const AUTO_PAUSE_MIN_DURATION_MS = 10000
const IS_TEST_ENV = process.env.NODE_ENV === 'test' || process.env.VITEST

const INTERVAL_UNIT_PATTERN =
  '(km|k|kilometer|kilometre|m|meter|metre|mi|mile|miles|min|mins|minute|minutes|sec|secs|second|seconds|s|hr|hrs|hour|hours)'

const isTimeUnit = (unit: string) =>
  /^(s|sec|secs|second|seconds|min|mins|minute|minutes|hr|hrs|hour|hours)$/i.test(unit)

const isDistanceUnit = (unit: string) =>
  /^(km|k|kilometer|kilometre|m|meter|metre|mi|mile|miles)$/i.test(unit)

const parseDurationSeconds = (value: number, unit: string) => {
  if (!isTimeUnit(unit)) {
    return null
  }

  const normalized = unit.toLowerCase()
  if (normalized.startsWith('s')) {
    return Math.round(value)
  }
  if (normalized.startsWith('h')) {
    return Math.round(value * 3600)
  }
  return Math.round(value * 60)
}

const parseDistanceKm = (value: number, unit: string) => {
  if (!isDistanceUnit(unit)) {
    return null
  }

  const normalized = unit.toLowerCase()
  if (normalized === 'm' || normalized.startsWith('met')) {
    return value / 1000
  }
  if (normalized === 'mi' || normalized.startsWith('mile')) {
    return value * 1.60934
  }
  return value
}

const parseIntervalMeasurement = (value: number, unit: string) => {
  const durationSeconds = parseDurationSeconds(value, unit)
  if (durationSeconds !== null) {
    return { durationSeconds }
  }

  const distanceKm = parseDistanceKm(value, unit)
  if (distanceKm !== null) {
    return { distanceKm }
  }

  return null
}

const parseIntervalPhases = (notes?: string): IntervalPhase[] => {
  if (!notes) {
    return []
  }

  const normalizedNotes = notes.replace(/\s+/g, ' ').trim()
  if (!normalizedNotes) {
    return []
  }

  const segments = normalizedNotes
    .split(/[,;]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)

  const extractPhase = (segment: string, type: IntervalPhaseType): IntervalPhase | null => {
    const match = segment.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${INTERVAL_UNIT_PATTERN}`, 'i'))
    if (!match) {
      return null
    }

    const value = Number.parseFloat(match[1])
    const unit = match[2]
    const measurement = parseIntervalMeasurement(value, unit)
    if (!measurement) {
      return null
    }

    return {
      type,
      ...(measurement.durationSeconds !== undefined
        ? { duration: measurement.durationSeconds }
        : {}),
      ...(measurement.distanceKm !== undefined ? { distance: measurement.distanceKm } : {}),
    }
  }

  let warmupPhase: IntervalPhase | null = null
  let cooldownPhase: IntervalPhase | null = null

  segments.forEach((segment) => {
    const lower = segment.toLowerCase()
    if (!warmupPhase && (lower.includes('warmup') || lower.includes('warm up'))) {
      warmupPhase = extractPhase(segment, 'warmup')
    }
    if (!cooldownPhase && (lower.includes('cooldown') || lower.includes('cool down'))) {
      cooldownPhase = extractPhase(segment, 'cooldown')
    }
  })

  const repeatMatch = normalizedNotes.match(
    new RegExp(`(\\d+)\\s*x\\s*(\\d+(?:\\.\\d+)?)\\s*${INTERVAL_UNIT_PATTERN}`, 'i')
  )

  let repeatCount = 0
  let intervalPhase: IntervalPhase | null = null

  if (repeatMatch) {
    repeatCount = Number.parseInt(repeatMatch[1], 10)
    const value = Number.parseFloat(repeatMatch[2])
    const unit = repeatMatch[3]
    const measurement = parseIntervalMeasurement(value, unit)
    if (measurement?.durationSeconds !== undefined) {
      intervalPhase = { type: 'interval', duration: measurement.durationSeconds }
    }
    if (measurement?.distanceKm !== undefined) {
      intervalPhase = { type: 'interval', distance: measurement.distanceKm }
    }
  }

  if (!intervalPhase) {
    const hasIntervalKeyword = /\b(interval|tempo|fartlek|repeat|repeats)\b/i.test(normalizedNotes)
    if (hasIntervalKeyword) {
      const singleMatch = normalizedNotes.match(
        new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${INTERVAL_UNIT_PATTERN}`, 'i')
      )
      if (singleMatch) {
        repeatCount = 1
        const measurement = parseIntervalMeasurement(
          Number.parseFloat(singleMatch[1]),
          singleMatch[2]
        )
        if (measurement?.durationSeconds !== undefined) {
          intervalPhase = { type: 'interval', duration: measurement.durationSeconds }
        }
        if (measurement?.distanceKm !== undefined) {
          intervalPhase = { type: 'interval', distance: measurement.distanceKm }
        }
      }
    }
  }

  if (!intervalPhase) {
    return []
  }

  if (repeatCount < 1) {
    repeatCount = 1
  }

  const recoveryMatch = normalizedNotes.match(
    /(\d+(?:\.\d+)?)\s*(min|mins|minute|minutes|sec|secs|second|seconds|s)\s*(recovery|rest)\b/i
  )
  let recoveryPhase: IntervalPhase | null = null
  if (recoveryMatch) {
    const recoverySeconds = parseDurationSeconds(
      Number.parseFloat(recoveryMatch[1]),
      recoveryMatch[2]
    )
    if (recoverySeconds !== null) {
      recoveryPhase = { type: 'recovery', duration: recoverySeconds }
    }
  }

  const phases: IntervalPhase[] = []
  if (warmupPhase) {
    phases.push(warmupPhase)
  }

  for (let i = 0; i < repeatCount; i += 1) {
    phases.push({ ...intervalPhase })
    if (recoveryPhase && i < repeatCount - 1) {
      phases.push({ ...recoveryPhase })
    }
  }

  if (cooldownPhase) {
    phases.push(cooldownPhase)
  }

  return phases
}

const formatIntervalLabel = (notes?: string, workoutType?: Workout['type']) => {
  if (notes) {
    const intensityMatch = notes.match(/@\s*([a-zA-Z-]+)/)
    if (intensityMatch) {
      const label = intensityMatch[1].replace(/-/g, ' ')
      return `${label.charAt(0).toUpperCase()}${label.slice(1)} Run`
    }

    if (/\btempo\b/i.test(notes)) {
      return 'Tempo Run'
    }

    if (/\binterval\b/i.test(notes)) {
      return 'Intervals'
    }
  }

  const labelMap: Record<Workout['type'], string> = {
    easy: 'Easy Run',
    tempo: 'Tempo Run',
    intervals: 'Intervals',
    long: 'Long Run',
    'time-trial': 'Time Trial',
    hill: 'Hill Repeats',
    'race-pace': 'Race Pace',
    recovery: 'Recovery Run',
    fartlek: 'Fartlek',
    rest: 'Rest Day',
  }

  return workoutType ? labelMap[workoutType] : 'Workout'
}

const formatPhaseType = (phaseType: IntervalPhaseType) => {
  switch (phaseType) {
    case 'warmup':
      return 'Warmup'
    case 'interval':
      return 'Interval'
    case 'recovery':
      return 'Recovery'
    case 'cooldown':
      return 'Cooldown'
    default:
      return 'Phase'
  }
}

type CompletionModalData = {
  completedWorkout: Workout
  nextWorkout?: Workout
}

export function RecordScreen() {
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [autoPauseActive, setAutoPauseActive] = useState(false)
  const [autoPauseStartTime, setAutoPauseStartTime] = useState<number | null>(null)
  const [autoPauseCount, setAutoPauseCount] = useState(0)
  const [gpsPermission, setGpsPermission] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt')
  const [gpsAccuracy, setGpsAccuracy] = useState<number>(0)
  const [isInitializingGps, setIsInitializingGps] = useState(false)
  const [showRoutesModal, setShowRoutesModal] = useState(false)
  const [showRouteWizard, setShowRouteWizard] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [showAddActivityModal, setShowAddActivityModal] = useState(false)
  const [completionModalData, setCompletionModalData] = useState<CompletionModalData | null>(null)
  const [challengeCompletionData, setChallengeCompletionData] = useState<{ progress: ChallengeProgress; template: ChallengeTemplate } | null>(null)
  const [activeChallenge, setActiveChallenge] = useState<{ progress: ChallengeProgress; template: ChallengeTemplate } | null>(null)
  const [currentWorkout, setCurrentWorkout] = useState<Workout | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null)

  // GPS monitoring state
  const [currentGPSAccuracy, setCurrentGPSAccuracy] = useState<GPSAccuracyData | null>(null)
  const [gpsAccuracyHistory, setGpsAccuracyHistory] = useState<GPSAccuracyData[]>([])

  // GPS warm-up countdown state
  const [isGpsWarmingUp, setIsGpsWarmingUp] = useState(false)
  const [gpsWarmupCountdown, setGpsWarmupCountdown] = useState(10)
  const [gpsWarmupQuality, setGpsWarmupQuality] = useState<{
    bestAccuracy: number | null;
    currentAccuracy: number | null;
    signalStrength: number;
    canStart: boolean;
  }>({ bestAccuracy: null, currentAccuracy: null, signalStrength: 0, canStart: false })
  const gpsWarmupTimerRef = useRef<NodeJS.Timeout | null>(null)
  const gpsWarmupPointsRef = useRef<GPSCoordinate[]>([])
  const GPS_WARMUP_DURATION_SECONDS = 10
  const GPS_MIN_SIGNAL_STRENGTH_TO_START = 60

  const gpsDebugEnabled =
    process.env.NODE_ENV !== 'production' &&
    (process.env.NEXT_PUBLIC_GPS_DEBUG_OVERLAY === 'true' ||
      (typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).has('gpsDebug')))
  const autoPauseEnabled = ENABLE_AUTO_PAUSE

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
  const GPS_MAX_ACCEPTABLE_ACCURACY_METERS = 120  // Increased from 80 to accept more points in poor conditions
  const GPS_DEFAULT_ACCURACY_METERS = 50
  const GPS_MIN_TIME_DELTA_MS = 400  // Reduced from 700ms to 400ms to accept more frequent GPS updates
  const MAX_REASONABLE_SPEED_MPS = 12  // Increased from 9 to 12 m/s (from ~32 km/h to ~43 km/h) for sprints
  const MIN_DISTANCE_FOR_PACE_KM = 0.05
  const startTimeRef = useRef<number>(0)
  const elapsedRunMsRef = useRef<number>(0)
  const isRunningRef = useRef(false)
  const isPausedRef = useRef(false)
  const autoPauseActiveRef = useRef(false)
  const autoPauseStartTimeRef = useRef<number | null>(null)
  const autoPauseCountRef = useRef(0)

  // Checkpoint service for recording persistence
  const checkpointServiceRef = useRef<RecordingCheckpointService | null>(null)
  const checkpointFlushTimerRef = useRef<NodeJS.Timeout | null>(null)
  const sessionIdRef = useRef<number | undefined>(undefined)

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

  const { requestWakeLock, releaseWakeLock } = useWakeLock({
    enableScreenLock: true,
    enableAudioLock: true
  })

  useEffect(() => {
    isRunningRef.current = isRunning
    isPausedRef.current = isPaused
  }, [isRunning, isPaused])

  useEffect(() => {
    if (!ENABLE_VIBRATION_COACH && !ENABLE_AUDIO_COACH) {
      return
    }

    // Initialize coaching cue state on mount to detect capabilities
    // Audio will need user gesture later, but vibration support can be detected now
    const initialState = getCoachingCueState()
    setCoachingCueState(initialState)

    // Log capabilities for debugging
    if (initialState.vibrationSupported || initialState.audioSupported) {
      console.log('[CoachingCues] Capabilities detected:', {
        vibration: initialState.vibrationSupported,
        audio: initialState.audioSupported,
        isIOS: initialState.isIOS,
      })
    }

    return () => {
      cleanupCoachingCues()
    }
  }, [])

  // Load active challenge
  useEffect(() => {
    const loadChallenge = async () => {
      const user = await dbUtils.getCurrentUser()
      if (!user?.id) return

      try {
        const challenge = await getActiveChallenge(user.id)
        setActiveChallenge(challenge)
      } catch (error) {
        console.error("Error loading challenge:", error)
      }
    }

    loadChallenge()
  }, [])

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

  // Keep refs in sync for GPS callbacks fired outside React render timing.
  const setAutoPauseActiveState = (next: boolean) => {
    autoPauseActiveRef.current = next
    setAutoPauseActive(next)
  }

  const setAutoPauseStartTimeState = (next: number | null) => {
    autoPauseStartTimeRef.current = next
    setAutoPauseStartTime(next)
  }

  const incrementAutoPauseCount = () => {
    setAutoPauseCount((prev) => {
      const next = prev + 1
      autoPauseCountRef.current = next
      return next
    })
  }

  const clearAutoPauseState = () => {
    setAutoPauseActiveState(false)
    setAutoPauseStartTimeState(null)
  }

  const resetAutoPauseState = () => {
    clearAutoPauseState()
    autoPauseCountRef.current = 0
    setAutoPauseCount(0)
  }

  const resetIntervalTimerState = (
    phases: IntervalPhase[] = intervalPhases,
    baseElapsedSeconds = 0,
    baseDistanceKm = 0
  ) => {
    phaseStartElapsedRef.current = baseElapsedSeconds
    phaseStartDistanceRef.current = baseDistanceKm
    intervalCompletedRef.current = false
    setCurrentPhaseIndex(0)
    setPhaseElapsedSeconds(0)
    setPhaseProgress(0)
    setPhaseRemainingDistance(null)
    setNextPhaseInSeconds(phases[0]?.duration ?? null)
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

  const [intervalPhases, setIntervalPhases] = useState<IntervalPhase[]>([])
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0)
  const [phaseElapsedSeconds, setPhaseElapsedSeconds] = useState(0)
  const [nextPhaseInSeconds, setNextPhaseInSeconds] = useState<number | null>(null)
  const [phaseProgress, setPhaseProgress] = useState(0)
  const [phaseRemainingDistance, setPhaseRemainingDistance] = useState<number | null>(null)
  const phaseStartElapsedRef = useRef(0)
  const phaseStartDistanceRef = useRef(0)
  const intervalCompletedRef = useRef(false)
  const [coachingCueState, setCoachingCueState] = useState<CoachingCueState>({
    vibrationSupported: false,
    vibrationEnabled: true,
    audioSupported: false,
    audioEnabled: true,
    audioReady: false,
    isIOS: false,
    activeCueType: 'none',
  })

  const { toast } = useToast()
  const router = useRouter()

  const resolveCurrentUser = async (): Promise<User | null> => {
    if (currentUser?.id) return currentUser

    try {
      const user = await dbUtils.getCurrentUser()
      if (user) {
        setCurrentUser(user)
        // Initialize checkpoint service when user is loaded
        if (!checkpointServiceRef.current) {
          checkpointServiceRef.current = new RecordingCheckpointService(user.id)
        }
      }
      return user
    } catch (error) {
      console.error("Error resolving current user:", error)
      return null
    }
  }

  // Helper to create checkpoint from current state
  const getCurrentCheckpoint = (): RecordingCheckpoint => {
    return {
      sessionId: sessionIdRef.current,
      userId: currentUser!.id,
      status: isPausedRef.current ? 'paused' : 'recording',
      startedAt: startTimeRef.current,
      lastCheckpointAt: Date.now(),
      distanceKm: totalDistanceKmRef.current,
      durationSeconds: Math.floor(elapsedRunMsRef.current / 1000),
      elapsedRunMs: elapsedRunMsRef.current,
      gpsPath: gpsPathRef.current,
      lastRecordedPoint: lastRecordedPointRef.current || undefined,
      workoutId: currentWorkout?.id,
      routeId: selectedRoute?.id,
      routeName: selectedRoute?.name,
      autoPauseCount: autoPauseCountRef.current,
      acceptedPointCount: acceptedPointCountRef.current,
      rejectedPointCount: rejectedPointCountRef.current,
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

  // Lifecycle event handlers for checkpoint persistence
  useEffect(() => {
    if (!currentUser || !checkpointServiceRef.current) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isRunningRef.current) {
        console.log('[RecordScreen] App going to background, flushing checkpoint')
        // Flush checkpoint to IndexedDB immediately when app goes to background
        checkpointServiceRef.current?.flushToDatabase().catch(err => {
          console.error('[RecordScreen] Failed to flush checkpoint on visibility change:', err)
        })
      } else if (document.visibilityState === 'visible' && isRunningRef.current) {
        console.log('[RecordScreen] App returned to foreground')
      }
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRunningRef.current && checkpointServiceRef.current) {
        // Synchronous localStorage write
        const checkpoint = getCurrentCheckpoint()
        checkpointServiceRef.current.saveToLocalStorage(checkpoint)

        // Show browser confirmation dialog
        e.preventDefault()
        e.returnValue = 'You have an active run recording. Your progress will be saved for recovery.'
      }
    }

    const handlePageHide = () => {
      if (isRunningRef.current && checkpointServiceRef.current) {
        // Last chance to save before page unload
        const checkpoint = getCurrentCheckpoint()
        checkpointServiceRef.current.saveToLocalStorage(checkpoint)
      }
    }

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handlePageHide)

    // Setup periodic checkpoint flush (every 30 seconds)
    if (isRunningRef.current) {
      checkpointFlushTimerRef.current = setInterval(() => {
        if (checkpointServiceRef.current && isRunningRef.current) {
          console.log('[RecordScreen] Periodic checkpoint flush')
          checkpointServiceRef.current.flushToDatabase().catch(err => {
            console.error('[RecordScreen] Periodic flush failed:', err)
          })
        }
      }, 30000) // 30 seconds
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)

      if (checkpointFlushTimerRef.current) {
        clearInterval(checkpointFlushTimerRef.current)
        checkpointFlushTimerRef.current = null
      }
    }
  }, [currentUser, isRunning])

  useEffect(() => {
    if (!ENABLE_VIBRATION_COACH) {
      setIntervalPhases([])
      resetIntervalTimerState([])
      return
    }

    const phases = parseIntervalPhases(currentWorkout?.notes)
    setIntervalPhases(phases)
    const baseElapsedSeconds = isRunning ? metrics.duration : 0
    const baseDistanceKm = isRunning ? metrics.distance : 0
    resetIntervalTimerState(phases, baseElapsedSeconds, baseDistanceKm)
  }, [currentWorkout?.notes])

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

  useEffect(() => {
    if (!intervalPhases.length) {
      return
    }

    const phase = intervalPhases[currentPhaseIndex]
    if (!phase) {
      return
    }

    const totalElapsedSeconds = metrics.duration
    const totalDistanceKm = metrics.distance
    let elapsedSeconds = 0
    let remainingSeconds: number | null = null
    let remainingDistance: number | null = null
    let progressValue = 0

    if (phase.duration) {
      elapsedSeconds = Math.max(0, totalElapsedSeconds - phaseStartElapsedRef.current)
      remainingSeconds = Math.max(phase.duration - elapsedSeconds, 0)
      progressValue = phase.duration > 0 ? elapsedSeconds / phase.duration : 0
    } else if (phase.distance) {
      const distanceElapsed = Math.max(0, totalDistanceKm - phaseStartDistanceRef.current)
      remainingDistance = Math.max(phase.distance - distanceElapsed, 0)
      progressValue = phase.distance > 0 ? distanceElapsed / phase.distance : 0

      const paceSecondsPerKm =
        metrics.currentPace > 0 ? metrics.currentPace : metrics.pace > 0 ? metrics.pace : null
      if (paceSecondsPerKm) {
        elapsedSeconds = Math.round(distanceElapsed * paceSecondsPerKm)
        remainingSeconds = Math.round(remainingDistance * paceSecondsPerKm)
      }
    }

    setPhaseElapsedSeconds(Math.max(0, Math.floor(elapsedSeconds)))
    setNextPhaseInSeconds(remainingSeconds)
    setPhaseRemainingDistance(remainingDistance)
    setPhaseProgress(Math.min(100, Math.max(0, Math.round(progressValue * 100))))
  }, [
    currentPhaseIndex,
    intervalPhases,
    metrics.currentPace,
    metrics.distance,
    metrics.duration,
    metrics.pace,
  ])

  useEffect(() => {
    if (!ENABLE_VIBRATION_COACH) {
      return
    }

    if (!intervalPhases.length || !isRunning || isPaused || intervalCompletedRef.current) {
      return
    }

    const phase = intervalPhases[currentPhaseIndex]
    if (!phase) {
      return
    }

    let isComplete = false
    if (phase.duration) {
      isComplete = metrics.duration - phaseStartElapsedRef.current >= phase.duration
    } else if (phase.distance) {
      isComplete = metrics.distance - phaseStartDistanceRef.current >= phase.distance
    }

    if (!isComplete) {
      return
    }

    if (coachingCueState.activeCueType !== 'none') {
      cueSingle()
      void trackAnalyticsEvent('coaching_cue_triggered', {
        cue_type: 'interval_end',
        phase_type: phase.type,
        cue_method: coachingCueState.activeCueType,
      })
    }

    const nextIndex = currentPhaseIndex + 1
    if (nextIndex < intervalPhases.length) {
      setCurrentPhaseIndex(nextIndex)
      phaseStartElapsedRef.current = metrics.duration
      phaseStartDistanceRef.current = metrics.distance
      setPhaseElapsedSeconds(0)
      setPhaseProgress(0)
      setPhaseRemainingDistance(null)
      setNextPhaseInSeconds(intervalPhases[nextIndex].duration ?? null)
      if (coachingCueState.activeCueType !== 'none') {
        void trackAnalyticsEvent('coaching_cue_triggered', {
          cue_type: 'interval_start',
          phase_type: intervalPhases[nextIndex].type,
          cue_method: coachingCueState.activeCueType,
        })
      }
    } else {
      intervalCompletedRef.current = true
    }
  }, [
    currentPhaseIndex,
    intervalPhases,
    isPaused,
    isRunning,
    metrics.distance,
    metrics.duration,
    coachingCueState.activeCueType,
  ])

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
    const isSecure = IS_TEST_ENV || (typeof window !== 'undefined' &&
      (window.location.protocol === 'https:' || window.location.hostname === 'localhost'));

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
    resetAutoPauseState()
    resetIntervalTimerState()
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

    // First accepted fix becomes our baseline (no distance added yet on initial start).
    // However, if we're resuming after a pause and lastPoint exists, we WILL add distance.
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
        totalDistanceKm: totalDistanceKmRef.current,
      })
      logRunStats({
        event: 'first_gps_point',
        lat: normalizedPoint.latitude,
        lng: normalizedPoint.longitude,
        accuracy: accuracyValue,
        totalDistanceKm: totalDistanceKmRef.current
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

    // Adaptive GPS filtering based on GPS quality:
    // - Jump rejection: ignore implausible speed spikes ("teleports").
    // - Jitter rejection: scale threshold based on GPS accuracy to reduce rejection in poor conditions
    // Better GPS (<=20m accuracy) uses stricter filtering (0.5m minimum)
    // Poor GPS (>80m accuracy) uses relaxed filtering (3.0m minimum)
    const minDistanceMeters = accuracyValue <= 20 ? 0.5 :   // Good GPS: strict jitter filter
      accuracyValue <= 40 ? 1.0 :   // Fair GPS: moderate jitter filter
        accuracyValue <= 80 ? 2.0 :   // Poor GPS: relaxed jitter filter
          3.0;                          // Very poor GPS: very relaxed jitter filter

    let isAutoPauseActive = autoPauseEnabled ? autoPauseActiveRef.current : false
    if (autoPauseEnabled) {
      if (isAutoPauseActive) {
        if (
          segmentSpeedMps > AUTO_RESUME_SPEED_MPS &&
          segmentSpeedMps <= MAX_REASONABLE_SPEED_MPS
        ) {
          clearAutoPauseState()
          isAutoPauseActive = false
          void trackAnalyticsEvent('auto_pause_resumed', {
            pause_count: autoPauseCountRef.current,
          })
        }
      } else {
        if (segmentSpeedMps < AUTO_PAUSE_SPEED_MPS) {
          const lowSpeedStart =
            autoPauseStartTimeRef.current ?? normalizedPoint.timestamp
          if (autoPauseStartTimeRef.current === null) {
            setAutoPauseStartTimeState(lowSpeedStart)
          }
          const lowSpeedDurationMs = normalizedPoint.timestamp - lowSpeedStart
          if (lowSpeedDurationMs >= AUTO_PAUSE_MIN_DURATION_MS) {
            setAutoPauseActiveState(true)
            setAutoPauseStartTimeState(normalizedPoint.timestamp)
            incrementAutoPauseCount()
            isAutoPauseActive = true
            void trackAnalyticsEvent('auto_pause_triggered', {
              duration_seconds: Math.round(lowSpeedDurationMs / 1000),
              gps_accuracy: accuracyValue,
            })
          }
        } else if (autoPauseStartTimeRef.current !== null) {
          setAutoPauseStartTimeState(null)
        }
      }
    }

    if (segmentSpeedMps > MAX_REASONABLE_SPEED_MPS) {
      trackRejection('speed', { segmentSpeedMps, maxSpeedMps: MAX_REASONABLE_SPEED_MPS })
      return
    }

    if (autoPauseEnabled && isAutoPauseActive) {
      const previousTotalDistance = totalDistanceKmRef.current
      lastRecordedPointRef.current = normalizedPoint

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
        currentPace: 0,
        currentSpeed: 0,
      }))

      trackAcceptance({
        segmentDistanceMeters: round(segmentDistanceMeters, 1),
        segmentSpeedMps: round(segmentSpeedMps, 2),
        timeDeltaMs,
        previousDistanceKm: round(previousTotalDistance, 3),
        newDistanceKm: round(totalDistanceKmRef.current, 3),
        segmentAdded: 0,
        autoPaused: true,
      })

      logRunStats({
        event: 'auto_pause_active',
        distanceKm: totalDistanceKmRef.current,
        segmentKm: segmentDistanceKm,
        durationSeconds: metrics.duration,
        currentPaceSecondsPerKm: 0,
        pathLength: gpsPathRef.current.length,
      })
      return
    }

    if (segmentDistanceMeters < minDistanceMeters) {
      trackRejection('jitter', { segmentDistanceMeters, minDistanceMeters })
      return
    }

    // Update last recorded point BEFORE accumulating distance
    const previousTotalDistance = totalDistanceKmRef.current
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

    // Ensure metrics.distance is ALWAYS synchronized with totalDistanceKmRef
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
      previousDistanceKm: round(previousTotalDistance, 3),
      newDistanceKm: round(totalDistanceKmRef.current, 3),
      segmentAdded: round(segmentDistanceKm, 4),
    })

    // Save checkpoint to localStorage (fast write)
    if (checkpointServiceRef.current && currentUser) {
      try {
        const checkpoint = getCurrentCheckpoint()
        checkpointServiceRef.current.saveToLocalStorage(checkpoint)
      } catch (err) {
        console.error('[RecordScreen] Failed to save checkpoint:', err)
      }
    }

    logRunStats({
      event: 'gps_point_accepted',
      distanceKm: totalDistanceKmRef.current,
      segmentKm: segmentDistanceKm,
      durationSeconds: metrics.duration,
      currentPaceSecondsPerKm: currentPaceSecondsPerKm,
      pathLength: gpsPathRef.current.length,
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

    // If we're in GPS warmup mode, collect points and update quality assessment
    if (isGpsWarmingUp) {
      gpsWarmupPointsRef.current.push(point)

      const currentAccuracy = point.accuracy ?? 999
      const assessment = gpsService.assessGPSQuality(currentAccuracy)

      setGpsWarmupQuality(prev => {
        const bestAccuracy = prev.bestAccuracy === null ? currentAccuracy :
          Math.min(prev.bestAccuracy, currentAccuracy)

        return {
          bestAccuracy,
          currentAccuracy,
          signalStrength: accuracyData.signalStrength,
          canStart: assessment.canStart
        }
      })

      // Don't record points during warmup
      return
    }

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

  const handleVibrationToggle = (enabled: boolean) => {
    persistVibrationEnabled(enabled)
    setCoachingCueState(getCoachingCueState())
  }

  const handleAudioToggle = async (enabled: boolean) => {
    persistAudioEnabled(enabled)
    if (enabled) {
      await initializeCoachingCues()
    }
    setCoachingCueState(getCoachingCueState())
  }

  const startGpsWarmup = async () => {
    setIsGpsWarmingUp(true)
    setGpsWarmupCountdown(GPS_WARMUP_DURATION_SECONDS)
    gpsWarmupPointsRef.current = []
    setGpsWarmupQuality({
      bestAccuracy: null,
      currentAccuracy: null,
      signalStrength: 0,
      canStart: false
    })

    // Start GPS tracking in background to collect warmup data
    setIsInitializingGps(true)
    const trackingStarted = await startTracking(gpsTrackingOptions)
    setIsInitializingGps(false)

    if (!trackingStarted) {
      setIsGpsWarmingUp(false)
      toast({
        title: "GPS Error",
        description: "Unable to start GPS tracking. Please check permissions.",
        variant: "destructive"
      })
      return false
    }

    // Start countdown timer
    let countdown = GPS_WARMUP_DURATION_SECONDS
    gpsWarmupTimerRef.current = setInterval(() => {
      countdown--
      setGpsWarmupCountdown(countdown)

      if (countdown <= 0) {
        if (gpsWarmupTimerRef.current) {
          clearInterval(gpsWarmupTimerRef.current)
          gpsWarmupTimerRef.current = null
        }
        finishGpsWarmup()
      }
    }, 1000)

    return true
  }

  const finishGpsWarmup = () => {
    setIsGpsWarmingUp(false)

    // Evaluate GPS quality after warmup
    const quality = gpsWarmupQuality

    if (!quality.canStart || quality.signalStrength < GPS_MIN_SIGNAL_STRENGTH_TO_START) {
      // GPS quality is poor - show toast with option to proceed or wait
      // The GPS accuracy indicator will automatically show detailed info
      toast({
        title: "GPS Signal Quality",
        description: `Signal: ${quality.signalStrength}%. You can start anyway or wait for better signal.`,
        action: (
          <ToastAction altText="Start Anyway" onClick={() => proceedWithRun()}>
            Start Anyway
          </ToastAction>
        )
      })

      // Keep GPS tracking active so user can monitor signal improvement
      // The GPSAccuracyIndicator component will display all details automatically
    } else {
      // GPS quality is good, proceed with run
      proceedWithRun()
    }
  }

  const cancelGpsWarmup = () => {
    if (gpsWarmupTimerRef.current) {
      clearInterval(gpsWarmupTimerRef.current)
      gpsWarmupTimerRef.current = null
    }
    setIsGpsWarmingUp(false)
    stopTracking()
    gpsWarmupPointsRef.current = []
    toast({
      title: "Warmup Cancelled",
      description: "GPS warmup cancelled. Tap Start Run when ready."
    })
  }

  const proceedWithRun = async () => {
    // Initialize coaching cues on user gesture (required for iOS Safari audio)
    // This ensures both vibration and audio are properly detected and enabled
    if (ENABLE_AUDIO_COACH || ENABLE_VIBRATION_COACH) {
      await initializeCoachingCues()
      setCoachingCueState(getCoachingCueState())
    }

    // Find best point from warmup to use as baseline
    if (gpsWarmupPointsRef.current.length > 0) {
      const bestPoint = gpsWarmupPointsRef.current.reduce((best, current) => {
        const currentAcc = current.accuracy ?? 999
        const bestAcc = best.accuracy ?? 999
        return currentAcc < bestAcc ? current : best
      })

      // Use best point as first recorded point
      lastRecordedPointRef.current = bestPoint
      setGpsPath([bestPoint])
      gpsPathRef.current = [bestPoint]

      logRunStats({
        event: 'warmup_baseline_established',
        accuracy: bestPoint.accuracy,
        warmupPointsCollected: gpsWarmupPointsRef.current.length
      })
    }

    // Clear warmup data
    gpsWarmupPointsRef.current = []

    // Actual run start
    startTimeRef.current = Date.now()
    elapsedRunMsRef.current = 0
    setIsRunning(true)
    setIsPaused(false)
    isRunningRef.current = true
    isPausedRef.current = false

    toast({
      title: "Run Started",
      description: "GPS tracking active. Your run is being recorded."
    })

    logRunStats({ event: 'start', startedAt: Date.now() })

    // Activate wake lock
    void requestWakeLock()
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

    // Initialize checkpoint service if not already done
    if (!checkpointServiceRef.current) {
      checkpointServiceRef.current = new RecordingCheckpointService(user.id)
    }

    // Check for existing active session
    if (checkpointServiceRef.current) {
      const existingSession = await checkpointServiceRef.current.getIncompleteSession(user.id)
      if (existingSession) {
        toast({
          title: "Previous Recording Found",
          description: "You have an incomplete recording. Please use the recovery option from the home screen.",
          variant: "default",
        })
        return
      }
    }

    if (IS_TEST_ENV) {
      resetRunTrackingState()
      proceedWithRun()
      setIsInitializingGps(true)
      const trackingStarted = await startTracking(gpsTrackingOptions)
      setIsInitializingGps(false)
      if (!trackingStarted) {
        setIsRunning(false)
        isRunningRef.current = false
        toast({
          title: "GPS Error",
          description: "Unable to start GPS tracking. Please check permissions.",
          variant: "destructive"
        })
      }
      return
    }

    // Check if GPS is already tracking with good signal quality
    // If yes, skip warmup and start immediately to avoid losing GPS lock
    const hasActiveGPS = isGpsTracking && currentGPSAccuracy !== null
    const hasGoodSignal = currentGPSAccuracy && currentGPSAccuracy.signalStrength >= GPS_MIN_SIGNAL_STRENGTH_TO_START

    if (hasActiveGPS && hasGoodSignal) {
      // GPS already has good lock - don't destroy it!
      // Just reset run metrics but keep GPS tracking active
      toast({
        title: "GPS Ready",
        description: `Starting run with ${currentGPSAccuracy.signalStrength}% signal strength...`,
      })

      // Initialize coaching cues before starting (user gesture required for iOS audio)
      if (ENABLE_AUDIO_COACH || ENABLE_VIBRATION_COACH) {
        await initializeCoachingCues()
        setCoachingCueState(getCoachingCueState())
      }

      // Reset only run-specific state (not GPS tracking!)
      gpsPathRef.current = []
      setGpsPath([])
      totalDistanceKmRef.current = 0
      lastRecordedPointRef.current = null
      setCurrentGPSAccuracy(null) // Will be updated by next GPS point
      setGpsAccuracyHistory([])
      resetGpsDebugStats()
      resetAutoPauseState()
      resetIntervalTimerState()
      setMetrics({
        distance: 0,
        duration: 0,
        pace: 0,
        currentPace: 0,
        currentSpeed: 0,
        calories: 0
      })

      // Start run immediately without warmup
      proceedWithRun()
      void requestWakeLock()
      return
    }

    // GPS not active or signal is poor - need to start/restart tracking with warmup
    // Reset ALL tracking state (will stop GPS if running)
    resetRunTrackingState()

    // Start GPS warm-up countdown (will start GPS tracking fresh)
    await startGpsWarmup()
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

    if (autoPauseEnabled) {
      clearAutoPauseState()
    }

    stopTracking()
    setIsInitializingGps(false)
    // NOTE: DO NOT reset lastRecordedPointRef here - we need to preserve it for distance continuity
    // The next GPS point after resume will calculate distance from the last recorded point
    setIsPaused(true)
    isPausedRef.current = true

    logRunStats({
      event: 'pause',
      pausedAt: Date.now(),
      distanceKm: totalDistanceKmRef.current,
      durationSeconds: Math.floor(elapsedRunMsRef.current / 1000),
      preservedLastPoint: lastRecordedPointRef.current ? 'yes' : 'no'
    })

    toast({
      title: "Run Paused",
      description: "Your run has been paused. Resume when ready.",
    })

    // Release wake lock to save battery
    void releaseWakeLock()
  }

  const resumeRun = async () => {
    setIsPaused(false)
    isPausedRef.current = false
    startTimeRef.current = Date.now()
    // CRITICAL FIX: DO NOT reset lastRecordedPointRef - preserve it for distance continuity
    // The GPS tracking will continue from where we paused
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

    logRunStats({
      event: 'resume',
      resumedAt: Date.now(),
      distanceKm: totalDistanceKmRef.current,
      hasLastPoint: lastRecordedPointRef.current ? 'yes' : 'no',
      lastPointAge: lastRecordedPointRef.current
        ? Date.now() - lastRecordedPointRef.current.timestamp
        : null
    })

    toast({
      title: "Run Resumed",
      description: "GPS tracking resumed. Your run continues.",
    })

    // Re-activate wake lock
    void requestWakeLock()
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

    void releaseWakeLock()
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

      const gpsPath =
        gpsPathRef.current.length > 0
          ? JSON.stringify(
            gpsPathRef.current.map((point) => ({
              lat: point.latitude,
              lng: point.longitude,
              timestamp: point.timestamp,
              accuracy: point.accuracy,
            }))
          )
          : undefined

      const gpsAccuracyData =
        gpsAccuracyHistory.length > 0 ? JSON.stringify(gpsAccuracyHistory) : undefined

      const { runId, matchedWorkout, adaptationTriggered } = await recordRunWithSideEffects({
        userId: user.id,
        distanceKm: distance,
        durationSeconds: duration,
        completedAt: new Date(),
        autoMatchWorkout: true,
        ...(currentWorkout?.type ? { type: resolveRunType(currentWorkout.type) } : {}),
        ...(typeof currentWorkout?.id === 'number' ? { workoutId: currentWorkout.id } : {}),
        ...(selectedRoute ? { notes: `Route: ${selectedRoute.name}`, route: selectedRoute.name } : {}),
        ...(gpsPath ? { gpsPath } : {}),
        ...(gpsAccuracyData ? { gpsAccuracyData } : {}),
        ...(typeof startAccuracy === 'number' ? { startAccuracy } : {}),
        ...(typeof endAccuracy === 'number' ? { endAccuracy } : {}),
        ...(typeof averageAccuracy === 'number' ? { averageAccuracy } : {}),
      })

      // Update challenge progress if there's an active challenge
      if (activeChallenge) {
        try {
          const result = await updateChallengeOnWorkoutComplete(
            user.id,
            activeChallenge.progress.id!
          )

          if (result.challengeCompleted) {
            // Challenge completed! Show challenge completion modal
            setChallengeCompletionData({
              progress: result.progress,
              template: activeChallenge.template,
            })
          }

          // Reload active challenge data
          const updatedChallenge = await getActiveChallenge(user.id)
          setActiveChallenge(updatedChallenge)
        } catch (error) {
          console.error("Failed to update challenge progress:", error)
        }
      }

      if (matchedWorkout) {
        const modalPayload: CompletionModalData = {
          completedWorkout: matchedWorkout,
        }
        if (matchedWorkout.planId) {
          let referenceDate =
            matchedWorkout.scheduledDate instanceof Date
              ? matchedWorkout.scheduledDate
              : matchedWorkout.scheduledDate
                ? new Date(matchedWorkout.scheduledDate)
                : new Date()
          if (Number.isNaN(referenceDate.getTime())) {
            referenceDate = new Date()
          }
          try {
            const nextWorkout = await dbUtils.getNextWorkoutForPlan(
              matchedWorkout.planId,
              referenceDate
            )
            if (nextWorkout) {
              modalPayload.nextWorkout = nextWorkout
            }
          } catch (error) {
            console.warn("Failed to load next workout for completion modal", error)
          }
        }
        setCompletionModalData(modalPayload)
      }

      toast({
        title: "Run Saved",
        description: `${distance.toFixed(2)}km in ${formatTime(duration)}`,
      })
      if (adaptationTriggered) {
        toast({
          title: "Plan updated based on your recent performance",
          action: (
            <ToastAction
              onClick={() => {
                router.push("/plan")
              }}
            >
              View Changes
            </ToastAction>
          ),
        })
      }

      // Clear checkpoint after successful save
      if (checkpointServiceRef.current) {
        try {
          await checkpointServiceRef.current.clearCheckpoint(sessionIdRef.current)
          sessionIdRef.current = undefined
          console.log('[RecordScreen] Checkpoint cleared after successful save')
        } catch (err) {
          console.error('[RecordScreen] Failed to clear checkpoint:', err)
        }
      }

      try {
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
  const autoPauseDurationSeconds =
    autoPauseActive && autoPauseStartTime
      ? Math.max(0, Math.floor((Date.now() - autoPauseStartTime) / 1000))
      : 0
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
  const intervalCoachEnabled = ENABLE_VIBRATION_COACH
  const intervalTimerVisible = intervalCoachEnabled && intervalPhases.length > 0
  const currentPhase = intervalPhases[currentPhaseIndex]
  const intervalTotal = intervalPhases.filter((phase) => phase.type === 'interval').length
  const intervalIndex = currentPhase
    ? intervalPhases
      .slice(0, currentPhaseIndex + 1)
      .filter((phase) => phase.type === 'interval').length
    : 0
  const intervalLabel = formatIntervalLabel(currentWorkout?.notes, currentWorkout?.type)
  const intervalHeaderText = currentPhase
    ? currentPhase.type === 'interval' && intervalTotal > 0
      ? `Interval ${intervalIndex} of ${intervalTotal} - ${intervalLabel}`
      : `${formatPhaseType(currentPhase.type)} - ${intervalLabel}`
    : 'Interval Timer'
  const phaseStatusText = currentPhase
    ? `Phase ${currentPhaseIndex + 1} of ${intervalPhases.length}`
    : ''
  const nextPhase = currentPhaseIndex + 1 < intervalPhases.length
    ? intervalPhases[currentPhaseIndex + 1]
    : null
  const nextPhaseLabel = nextPhase ? formatPhaseType(nextPhase.type) : 'Complete'
  const nextPhaseCountdown = currentPhase
    ? nextPhaseInSeconds !== null
      ? `Next: ${nextPhaseLabel} in ${formatTime(nextPhaseInSeconds)}`
      : phaseRemainingDistance !== null
        ? `Next: ${nextPhaseLabel} in ${phaseRemainingDistance.toFixed(2)} km`
        : `Next: ${nextPhaseLabel}`
    : ''

  return (
    <div className="min-h-screen bg-gray-50 p-4 space-y-4">
      {/* GPS Warmup Countdown Overlay */}
      {isGpsWarmingUp && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="p-8 text-center space-y-6">
              <div className="flex justify-center">
                <Satellite className="h-16 w-16 text-blue-500 animate-pulse" />
              </div>

              <div>
                <h2 className="text-2xl font-bold mb-2">Acquiring GPS Signal</h2>
                <p className="text-gray-600">
                  Warming up GPS for accurate tracking...
                </p>
              </div>

              {/* Countdown Timer */}
              <div className="text-8xl font-bold text-blue-600">
                {gpsWarmupCountdown}
              </div>

              {/* GPS Quality Indicators */}
              <div className="space-y-3 text-left">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Signal Strength:</span>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={gpsWarmupQuality.signalStrength}
                      className="w-32 h-2"
                    />
                    <span className={`text-sm font-bold ${gpsWarmupQuality.signalStrength >= 75 ? 'text-green-600' :
                      gpsWarmupQuality.signalStrength >= 50 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                      {gpsWarmupQuality.signalStrength}%
                    </span>
                  </div>
                </div>

                {gpsWarmupQuality.currentAccuracy !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Current Accuracy:</span>
                    <span className={`text-sm font-bold ${gpsWarmupQuality.currentAccuracy <= 20 ? 'text-green-600' :
                      gpsWarmupQuality.currentAccuracy <= 50 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                      ±{Math.round(gpsWarmupQuality.currentAccuracy)}m
                    </span>
                  </div>
                )}

                {gpsWarmupQuality.bestAccuracy !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Best Accuracy:</span>
                    <span className="text-sm font-bold text-green-600">
                      ±{Math.round(gpsWarmupQuality.bestAccuracy)}m
                    </span>
                  </div>
                )}

                {gpsWarmupQuality.canStart && (
                  <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 p-2 rounded">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-sm font-medium">Ready to start!</span>
                  </div>
                )}
              </div>

              {/* Cancel Button */}
              <Button
                variant="outline"
                onClick={cancelGpsWarmup}
                className="w-full"
              >
                Cancel
              </Button>

              <p className="text-xs text-gray-500">
                For best results, wait for signal strength above 75%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/')}
          aria-label="Back to Today Screen"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center justify-center gap-2">
          <RunSmartBrandMark compact size="sm" className="opacity-90" />
          <h1 className="text-xl font-semibold">Record Run</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRoutesModal(true)}
            aria-label="Open Route Selector"
          >
            <MapPin className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRouteWizard(true)}
            aria-label="Open Route Wizard"
          >
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

      {/* GPS Status - Using New GPS Monitoring System */}
      {!isRunning && !isGpsTracking && !isInitializingGps && !isGpsWarmingUp && gpsPermission !== 'denied' && gpsPermission !== 'unsupported' && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Satellite className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium text-blue-900">GPS Ready</p>
                  <p className="text-sm text-blue-700">
                    GPS will activate when you start your run
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  // Start GPS warmup without starting the run
                  setIsInitializingGps(true)
                  const trackingStarted = await startTracking(gpsTrackingOptions)
                  setIsInitializingGps(false)
                  if (!trackingStarted) {
                    toast({
                      title: "GPS Error",
                      description: "Unable to start GPS. Please check permissions.",
                      variant: "destructive"
                    })
                  } else {
                    toast({
                      title: "GPS Activated",
                      description: "GPS is now warming up. Wait for good signal before starting.",
                    })
                  }
                }}
                className="text-blue-700 border-blue-300 hover:bg-blue-100"
              >
                <Satellite className="h-4 w-4 mr-1" />
                Warm Up GPS
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* GPS Initializing State */}
      {isInitializingGps && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
              <div>
                <p className="font-medium text-blue-900">Initializing GPS...</p>
                <p className="text-sm text-blue-700">
                  Please allow location access when prompted
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* GPS Tracking Active - Show Full GPS Monitoring */}
      {(isGpsTracking || isRunning) && !isInitializingGps && gpsPermission !== 'denied' && gpsPermission !== 'unsupported' && (
        <>
          {currentGPSAccuracy ? (
            <GPSAccuracyIndicator
              accuracy={currentGPSAccuracy}
              showTroubleshooting={true}
            />
          ) : (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Satellite className="h-5 w-5 text-yellow-600 animate-pulse" />
                  <div>
                    <p className="font-medium text-yellow-900">Acquiring GPS Signal...</p>
                    <p className="text-sm text-yellow-700">
                      Waiting for first GPS fix. This may take up to 30 seconds.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mobile GPS Warning */}
          {isRunning && (
            <Card className="border-gray-200 bg-gray-50 mt-4">
              <CardContent className="p-3">
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Keep screen on for best GPS accuracy. Mobile browsers don't support background GPS tracking.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* GPS Permission Denied Warning */}
      {gpsPermission === 'denied' && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
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
          </CardContent>
        </Card>
      )}

      {/* GPS Unsupported Warning */}
      {gpsPermission === 'unsupported' && (
        <Card className="border-gray-200 bg-gray-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-800">GPS Unavailable</p>
                <p className="text-sm text-gray-700 mt-1">
                  GPS is not available on this device or browser. You can still use the &quot;Add Manual Run&quot; option below.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto-Pause Indicator */}
      {autoPauseEnabled && autoPauseActive && isRunning && !isPaused && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
              <div>
                <p className="font-medium text-orange-900">Auto-Paused</p>
                <p className="text-sm text-orange-800">
                  {autoPauseDurationSeconds > 0
                    ? `Paused for ${formatTime(autoPauseDurationSeconds)}. Resume running to continue.`
                    : 'Slow speed detected. Resume running to continue.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {intervalTimerVisible && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-blue-700">Interval Timer</p>
                <p className="text-base font-semibold text-blue-900">{intervalHeaderText}</p>
                {phaseStatusText && (
                  <p className="text-xs text-blue-700">{phaseStatusText}</p>
                )}
              </div>
              <span className="text-sm font-semibold text-blue-800">{phaseProgress}%</span>
            </div>
            <Progress value={phaseProgress} className="h-2" />
            {nextPhaseCountdown && (
              <div className="flex items-center justify-between text-sm text-blue-800">
                <span>Elapsed: {formatTime(phaseElapsedSeconds)}</span>
                <span>{nextPhaseCountdown}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {intervalCoachEnabled && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <p className="font-medium text-gray-900">Run Settings</p>
              <p className="text-sm text-gray-600">Customize cues for this run.</p>
            </div>

            {/* Vibration Toggle (hide on iOS where not supported) */}
            {ENABLE_VIBRATION_COACH && coachingCueState.vibrationSupported && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Vibration Cues</p>
                  <p className="text-xs text-gray-600">
                    Enable haptic cues for interval changes.
                  </p>
                </div>
                <Switch
                  checked={coachingCueState.vibrationEnabled}
                  onCheckedChange={handleVibrationToggle}
                  aria-label="Toggle vibration cues"
                />
              </div>
            )}

            {/* Audio Toggle (show especially on iOS, or when audio available) */}
            {ENABLE_AUDIO_COACH && coachingCueState.audioSupported && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Audio Cues</p>
                  <p className="text-xs text-gray-600">
                    {coachingCueState.isIOS && !coachingCueState.vibrationSupported
                      ? 'Audio cues for interval changes (haptics unavailable on iOS).'
                      : 'Play sounds for interval changes.'}
                  </p>
                </div>
                <Switch
                  checked={coachingCueState.audioEnabled}
                  onCheckedChange={handleAudioToggle}
                  aria-label="Toggle audio cues"
                />
              </div>
            )}

            {/* iOS fallback notice when no cue method is enabled */}
            {coachingCueState.isIOS &&
              !coachingCueState.vibrationSupported &&
              coachingCueState.audioSupported &&
              !coachingCueState.audioEnabled && (
                <p className="text-xs text-amber-600">
                  Enable audio cues for coaching feedback on your device.
                </p>
              )}
          </CardContent>
        </Card>
      )}

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
              {autoPauseEnabled && isRunning && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {autoPauseCount}
                  </p>
                  <p className="text-sm text-gray-600">Auto Pauses</p>
                </div>
              )}
            </div>

            {/* Control Buttons */}
            <div className="flex justify-center gap-4">
              {!isRunning ? (
                <>
                  <Button
                    onClick={startRun}
                    size="lg"
                    className="bg-green-600 hover:bg-green-700"
                    disabled={gpsPermission === 'denied' || gpsPermission === 'unsupported' || isInitializingGps || isGpsWarmingUp}
                  >
                    {isInitializingGps || isGpsWarmingUp ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : isGpsTracking && currentGPSAccuracy && currentGPSAccuracy.signalStrength >= GPS_MIN_SIGNAL_STRENGTH_TO_START ? (
                      <CheckCircle className="h-5 w-5 mr-2" />
                    ) : (
                      <Play className="h-5 w-5 mr-2" />
                    )}
                    {isInitializingGps ? 'Initializing GPS...' :
                      isGpsWarmingUp ? 'Warming Up GPS...' :
                        isGpsTracking && currentGPSAccuracy && currentGPSAccuracy.signalStrength >= GPS_MIN_SIGNAL_STRENGTH_TO_START ?
                          `Start Run (${currentGPSAccuracy.signalStrength}% GPS)` :
                          'Start Run'}
                  </Button>
                  {/* Show "Start Anyway" button if GPS is tracking but run hasn't started (post-warmup with poor signal) */}
                  {!isInitializingGps && !isGpsWarmingUp && isGpsTracking && gpsAccuracy > 0 && (
                    <Button
                      onClick={proceedWithRun}
                      size="lg"
                      variant="outline"
                      className="border-orange-500 text-orange-600 hover:bg-orange-50"
                    >
                      <AlertTriangle className="h-5 w-5 mr-2" />
                      Start Anyway
                    </Button>
                  )}
                </>
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
      {showAddActivityModal && (
        <AddActivityModal
          open={showAddActivityModal}
          onOpenChange={setShowAddActivityModal}
          onActivityAdded={() => {
            setShowAddActivityModal(false)
            // Navigate back to today screen after adding activity
            router.push('/')
          }}
          initialStep="upload"
          {...(currentWorkout?.id ? { workoutId: currentWorkout.id } : {})}
        />
      )}
      {completionModalData && (
        <WorkoutCompletionModal
          isOpen={Boolean(completionModalData)}
          onClose={() => setCompletionModalData(null)}
          onViewPlan={() => router.push('/plan')}
          completedWorkout={completionModalData.completedWorkout}
          nextWorkout={completionModalData.nextWorkout}
        />
      )}

      {challengeCompletionData && (
        <ChallengeCompletionModal
          isOpen={Boolean(challengeCompletionData)}
          onClose={() => setChallengeCompletionData(null)}
          completedTemplate={challengeCompletionData.template}
          progress={challengeCompletionData.progress}
          onStartNextChallenge={async (template) => {
            if (currentUser?.id) {
              try {
                const { startChallenge } = await import('@/lib/challengeEngine')
                const activePlan = await dbUtils.getActivePlan(currentUser.id)
                if (activePlan) {
                  await startChallenge(currentUser.id, template.slug, activePlan.id!)
                  const updatedChallenge = await getActiveChallenge(currentUser.id)
                  setActiveChallenge(updatedChallenge)
                  setChallengeCompletionData(null)
                  toast({
                    title: "New Challenge Started! 🎉",
                    description: `${template.name} challenge has begun`,
                  })
                }
              } catch (error) {
                console.error("Error starting next challenge:", error)
                toast({
                  title: "Failed to start challenge",
                  description: "Please try again from the Plan screen",
                  variant: "destructive",
                })
              }
            }
          }}
        />
      )}
    </div>
  )
}
