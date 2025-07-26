'use client';

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Map, Play, Pause, Square, Volume2, Satellite, MapPin, AlertTriangle } from "lucide-react"
import { RouteSelectorModal } from "@/components/route-selector-modal"
import { ManualRunModal } from "@/components/manual-run-modal"
import { dbUtils, type Run, type Workout } from "@/lib/db"
import { useToast } from "@/hooks/use-toast"
import { planAdjustmentService } from "@/lib/planAdjustmentService"
import { planAdaptationEngine } from "@/lib/planAdaptationEngine"
import { useRouter } from "next/navigation"
import { trackPlanSessionCompleted } from "@/lib/analytics"
import RecoveryRecommendations from "@/components/recovery-recommendations"

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
  const [showRoutesModal, setShowRoutesModal] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [currentWorkout, setCurrentWorkout] = useState<Workout | null>(null)
  
  // GPS and tracking state
  const [gpsPath, setGpsPath] = useState<GPSCoordinate[]>([])
  const [currentPosition, setCurrentPosition] = useState<GPSCoordinate | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  
  // Metrics state
  const [metrics, setMetrics] = useState<RunMetrics>({
    distance: 0,
    duration: 0,
    pace: 0,
    calories: 0
  })

  const { toast } = useToast()
  const router = useRouter()

  // Load today's workout on mount
  useEffect(() => {
    loadTodaysWorkout()
    checkGpsSupport()
    
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

  const checkGpsSupport = async () => {
    if (!navigator.geolocation) {
      setGpsPermission('unsupported')
      return
    }

    try {
      const result = await navigator.permissions.query({name: 'geolocation'})
      setGpsPermission(result.state as 'granted' | 'denied' | 'prompt')
      
      result.addEventListener('change', () => {
        setGpsPermission(result.state as 'granted' | 'denied' | 'prompt')
      })
    } catch (error) {
      console.warn('Permissions API not supported, will request on use')
    }
  }

  const loadTodaysWorkout = async () => {
    try {
      const user = await dbUtils.getCurrentUser()
      if (user?.id) {
        const workout = await dbUtils.getTodaysWorkout(user.id)
        setCurrentWorkout(workout || null)
      }
    } catch (error) {
      console.error('Failed to load today\'s workout:', error)
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
          setCurrentPosition({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: Date.now(),
            accuracy: position.coords.accuracy
          })
          setGpsAccuracy(position.coords.accuracy)
          resolve(true)
        },
        (error) => {
          console.error('GPS permission denied:', error)
          setGpsPermission('denied')
          toast({
            title: "GPS Access Denied",
            description: "You can still record your run manually or enable GPS in your browser settings.",
            variant: "destructive"
          })
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
      if (!navigator.geolocation || gpsPermission !== 'granted') {
        resolve(false)
        return
      }

      let isFirstPosition = true

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const newCoordinate: GPSCoordinate = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: Date.now(),
            accuracy: position.coords.accuracy
          }
          
          setCurrentPosition(newCoordinate)
          setGpsAccuracy(position.coords.accuracy || 0)
          
          // Add to GPS path
          setGpsPath(prev => {
            const newPath = [...prev, newCoordinate]
            
            // Calculate distance
            if (newPath.length > 1) {
              const totalDistance = calculateTotalDistance(newPath)
              setMetrics(prevMetrics => ({
                ...prevMetrics,
                distance: totalDistance
              }))
            }
            
            return newPath
          })

          // Resolve on first successful position
          if (isFirstPosition) {
            isFirstPosition = false
            resolve(true)
          }
        },
        (error) => {
          console.error('GPS tracking error:', error)
          toast({
            title: "GPS Tracking Error",
            description: "Unable to track location. You can continue with manual entry.",
            variant: "destructive"
          })
          
          // Resolve false on error during startup
          if (isFirstPosition) {
            isFirstPosition = false
            resolve(false)
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 1000
        }
      )
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
    
    let totalDistance = 0
    for (let i = 1; i < path.length; i++) {
      totalDistance += calculateDistanceBetweenPoints(path[i - 1], path[i])
    }
    return totalDistance
  }

  const calculateDistanceBetweenPoints = (point1: GPSCoordinate, point2: GPSCoordinate): number => {
    const R = 6371 // Earth's radius in km
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  const estimateCalories = (durationSeconds: number, distanceKm: number): number => {
    // Basic calorie estimation: ~60 calories per km for average runner
    const caloriesPerKm = 60
    const caloriesFromDistance = distanceKm * caloriesPerKm
    
    // Add time-based component (3 calories per minute baseline)
    const caloriesFromTime = (durationSeconds / 60) * 3
    
    return Math.round(caloriesFromDistance + caloriesFromTime)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const formatPace = (paceSecondsPerKm: number) => {
    if (paceSecondsPerKm === 0 || !isFinite(paceSecondsPerKm)) return "--:--"
    const mins = Math.floor(paceSecondsPerKm / 60)
    const secs = Math.floor(paceSecondsPerKm % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const startRun = async () => {
    startTimeRef.current = Date.now()
    setIsRunning(true)
    setIsPaused(false)
    setGpsPath([])
    
    let gpsStarted = false
    let gpsAttempted = false
    
    // Try to start GPS tracking
    if (gpsPermission === 'granted') {
      gpsAttempted = true
      gpsStarted = await startGpsTracking()
    } else if (gpsPermission === 'prompt') {
      const permitted = await requestGpsPermission()
      if (permitted) {
        gpsAttempted = true
        gpsStarted = await startGpsTracking()
      }
    }
    
    // Show success toast only if GPS wasn't attempted or if it started successfully
    // If GPS was attempted but failed, the error toast from startGpsTracking will be shown instead
    if (!gpsAttempted || gpsStarted) {
      toast({
        title: "Run Started! 🏃‍♂️",
        description: gpsStarted ? "GPS tracking active" : "Manual tracking mode",
      })
    }
  }

  const pauseRun = () => {
    setIsPaused(true)
    stopGpsTracking()
    
    toast({
      title: "Run Paused ⏸️",
      description: "Tap resume when ready to continue",
    })
  }

  const resumeRun = async () => {
    setIsPaused(false)
    if (gpsPermission === 'granted') {
      await startGpsTracking()
    }
    
    toast({
      title: "Run Resumed! 🏃‍♂️",
      description: "Keep going, you've got this!",
    })
  }

  const stopRun = async () => {
    setIsRunning(false)
    setIsPaused(false)
    stopGpsTracking()
    
    // Save run to database
    await saveRun()
  }

  const saveRun = async () => {
    try {
      const user = await dbUtils.getCurrentUser()
      if (!user?.id) {
        toast({
          title: "Error",
          description: "User not found. Please complete onboarding first.",
          variant: "destructive"
        })
        return
      }

      const runData: Omit<Run, 'id' | 'createdAt'> = {
        userId: user.id,
        workoutId: currentWorkout?.id,
        type: currentWorkout?.type === 'rest' ? 'other' : (currentWorkout?.type || 'other'),
        distance: metrics.distance,
        duration: metrics.duration,
        pace: metrics.pace,
        calories: metrics.calories,
        gpsPath: gpsPath.length > 0 ? JSON.stringify(gpsPath) : undefined,
        completedAt: new Date()
      }

      const runId = await dbUtils.createRun(runData)

      // Mark workout as completed if linked
      if (currentWorkout?.id) {
        await dbUtils.markWorkoutCompleted(currentWorkout.id)
      }

      // Trigger adaptive plan adjustments (but don't fail run save if this fails)
      try {
        await planAdjustmentService.afterRun(user.id)
        
        // Check if plan should be adapted based on completion
        const adaptationAssessment = await planAdaptationEngine.shouldAdaptPlan(user.id)
        
        if (adaptationAssessment.shouldAdapt && adaptationAssessment.confidence > 70) {
          console.log('Plan adaptation triggered:', adaptationAssessment.reason)
          
          // Get current active plan
          const currentPlan = await dbUtils.getActivePlan(user.id)
          if (currentPlan) {
            // Adapt the plan
            const adaptedPlan = await planAdaptationEngine.adaptExistingPlan(
              currentPlan.id!,
              adaptationAssessment.reason
            )
            
            console.log('Plan adapted successfully:', adaptedPlan.title)
            
            // Show user notification about plan adaptation
            toast({
              title: "Plan Updated! 📈",
              description: `Your training plan has been adjusted based on your recent progress: ${adaptationAssessment.reason}`,
            })
          }
        }
      } catch (adaptiveError) {
        console.error('Adaptive coaching failed:', adaptiveError)
        toast({
          title: "Adaptive coaching failed.",
          description: "Your run was saved, but plan adjustments couldn't be processed.",
          variant: "destructive"
        })
      }

      // Track plan session completion
      await trackPlanSessionCompleted({
        session_type: currentWorkout?.type || 'other',
        distance_km: metrics.distance,
        duration_seconds: metrics.duration,
        pace_seconds_per_km: metrics.pace,
        calories_burned: metrics.calories,
        had_gps_tracking: gpsPath.length > 0,
        workout_id: currentWorkout?.id
      })

      toast({
        title: "Run Saved! 🎉",
        description: `Great job! ${metrics.distance.toFixed(2)}km in ${formatTime(metrics.duration)}`,
      })

      // Reset state
      setMetrics({ distance: 0, duration: 0, pace: 0, calories: 0 })
      setGpsPath([])
      
      // Navigate back to today screen
      router.push('/')
      
    } catch (error) {
      console.error('Failed to save run:', error)
      toast({
        title: "Error Saving Run",
        description: "Your run data couldn't be saved. Please try again.",
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
    switch (gpsPermission) {
      case 'granted': return gpsAccuracy < 10 ? 'GPS High Accuracy' : `GPS ~${Math.round(gpsAccuracy)}m`
      case 'denied': return 'GPS Denied'
      case 'unsupported': return 'GPS Unavailable'
      default: return 'Requesting GPS...'
    }
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <Button variant="ghost" size="sm" onClick={() => router.push('/')} aria-label="Back to Today Screen">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">Record Run</h1>
        <Button variant="ghost" size="sm" onClick={() => setShowRoutesModal(true)} aria-label="Open Route Selector">
          <Map className="h-4 w-4" />
        </Button>
      </div>

      {/* GPS Permission Request */}
      {gpsPermission === 'prompt' && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-blue-500" />
              <div className="flex-1">
                <h3 className="font-medium text-blue-900">Enable GPS Tracking</h3>
                <p className="text-sm text-blue-700">Allow location access for accurate run tracking</p>
              </div>
              <Button onClick={requestGpsPermission} size="sm" className="bg-blue-500 hover:bg-blue-600">
                Enable
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* GPS Error/Fallback */}
      {(gpsPermission === 'denied' || gpsPermission === 'unsupported') && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div className="flex-1">
                <h3 className="font-medium text-yellow-900">GPS Unavailable</h3>
                <p className="text-sm text-yellow-700">You can still track your run manually</p>
              </div>
              <Button onClick={() => setShowManualModal(true)} size="sm" variant="outline">
                Manual Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Map Container */}
      <Card className="h-64 relative overflow-hidden">
        <CardContent className="p-0 h-full">
          <div className="h-full bg-gradient-to-br from-green-100 to-blue-100 flex items-center justify-center relative">
            {gpsPath.length > 0 ? (
              <RouteVisualization gpsPath={gpsPath} currentPosition={currentPosition} />
            ) : (
              <div className="text-center">
                <Map className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">
                  {gpsPermission === 'granted' ? 'Ready to track' : 'Manual mode'}
                </p>
              </div>
            )}

            {/* GPS Status Overlay */}
            <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2">
              <Satellite className={`h-4 w-4 ${getGpsStatusColor()}`} />
              <span className="text-sm font-medium">{getGpsStatusText()}</span>
            </div>

            {/* Workout Info Overlay */}
            {currentWorkout && (
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2">
                <div className="text-sm font-medium">{currentWorkout.type.charAt(0).toUpperCase() + currentWorkout.type.slice(1)}</div>
                <div className="text-xs text-gray-600">{currentWorkout.distance}km target</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-green-500">{metrics.distance.toFixed(2)}</div>
            <div className="text-xs text-gray-600">Distance (km)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-blue-500">{formatTime(metrics.duration)}</div>
            <div className="text-xs text-gray-600">Duration</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-purple-500">{formatPace(metrics.pace)}</div>
            <div className="text-xs text-gray-600">Pace (/km)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-orange-500">{metrics.calories}</div>
            <div className="text-xs text-gray-600">Calories</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4">
        {!isRunning ? (
          <Button onClick={startRun} className="bg-green-500 hover:bg-green-600 h-16 w-16 rounded-full" aria-label="Start Run">
            <Play className="h-6 w-6" />
          </Button>
        ) : (
          <>
            {!isPaused ? (
              <Button onClick={pauseRun} variant="outline" className="h-16 w-16 rounded-full" aria-label="Pause Run">
                <Pause className="h-6 w-6" />
              </Button>
            ) : (
              <Button onClick={resumeRun} className="bg-green-500 hover:bg-green-600 h-16 w-16 rounded-full" aria-label="Resume Run">
                <Play className="h-6 w-6" />
              </Button>
            )}
            <Button onClick={stopRun} variant="destructive" className="h-16 w-16 rounded-full" aria-label="Stop Run">
              <Square className="h-6 w-6" />
            </Button>
          </>
        )}
      </div>

      {/* Voice Cues */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm">
            <Volume2 className="h-4 w-4 text-green-500" />
            <span>Voice coaching enabled</span>
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
        userId={1}
        date={new Date()}
        showBreakdown={false}
        onRefresh={() => {
          console.log('Refreshing recovery data for record screen...');
        }}
      />

      {showRoutesModal && <RouteSelectorModal isOpen={showRoutesModal} onClose={() => setShowRoutesModal(false)} />}
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
