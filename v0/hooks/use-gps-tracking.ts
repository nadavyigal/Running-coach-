import { useCallback, useEffect, useRef, useState } from 'react'
import { isIOSNativeApp } from '@/lib/capacitor-platform'
import {
  clearGeoWatch,
  watchGeoPosition,
  type GeoError,
  type GeoPoint,
} from '@/lib/native/background-geolocation'

export type GPSPoint = {
  latitude: number
  longitude: number
  timestamp: number
  accuracy?: number
  speed?: number
}

export type GPSTrackingOptions = {
  enableHighAccuracy: boolean
  timeout: number
  maximumAge: number
  /** Metres between updates on native iOS. Ignored on web. */
  distanceFilter?: number
  /** Native-only: title in the iOS "App is using your location" notification. */
  backgroundTitle?: string
  /** Native-only: body in the iOS background notification. */
  backgroundMessage?: string
}

export type GPSTrackingState = {
  watchId: string | null
  isTracking: boolean
  callbackCount: number
  lastPoint: GPSPoint | null
  lastUpdateAt: number | null
  lastError: GeolocationPositionError | null
}

type UseGpsTrackingArgs = {
  onPoint?: (point: GPSPoint, raw: GeolocationPosition) => void
  onError?: (error: GeolocationPositionError) => void
  debug?: boolean
}

// If no GPS update arrives within this window, restart the watch (web recovery only —
// on iOS the native plugin keeps delivering through backgrounding so a watchdog is unnecessary)
const GPS_STALE_THRESHOLD_MS = 15_000
// How often we check for stale GPS
const GPS_WATCHDOG_INTERVAL_MS = 10_000

function toGeolocationPosition(point: GeoPoint): GeolocationPosition {
  // Synthesize a DOM-compatible GeolocationPosition from our unified GeoPoint so
  // existing consumers (e.g. GPSMonitoringService.calculateAccuracyMetrics) keep working.
  return {
    coords: {
      latitude: point.latitude,
      longitude: point.longitude,
      accuracy: point.accuracy ?? 999,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: typeof point.speed === 'number' ? point.speed : null,
    } as GeolocationCoordinates,
    timestamp: point.timestamp,
  } as GeolocationPosition
}

function toGeolocationError(err: GeoError): GeolocationPositionError {
  // Map unified GeoError → DOM-compatible GeolocationPositionError so consumers that
  // branch on `error.code === 1` (permission denied) keep working on native too.
  const code = err.notAuthorized ? 1 : typeof err.code === 'number' ? err.code : 2
  return {
    code,
    message: err.message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError
}

export function useGpsTracking({ onPoint, onError, debug = false }: UseGpsTrackingArgs) {
  const watchIdRef = useRef<string | null>(null)
  const optionsRef = useRef<GPSTrackingOptions | null>(null)
  const lastUpdateAtRef = useRef<number | null>(null)
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isTrackingRef = useRef(false)
  const [state, setState] = useState<GPSTrackingState>({
    watchId: null,
    isTracking: false,
    callbackCount: 0,
    lastPoint: null,
    lastUpdateAt: null,
    lastError: null,
  })

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current !== null) {
      clearInterval(watchdogRef.current)
      watchdogRef.current = null
    }
  }, [])

  const stopTracking = useCallback(() => {
    const id = watchIdRef.current
    if (id) {
      void clearGeoWatch(id)
    }
    watchIdRef.current = null
    isTrackingRef.current = false
    clearWatchdog()
    setState((prev) => ({ ...prev, watchId: null, isTracking: false }))
  }, [clearWatchdog])

  // Internal: create a watchPosition and return the watch ID (async — native plugin registers asynchronously)
  const createWatch = useCallback(
    async (options: GPSTrackingOptions, onFirstPosition?: (success: boolean) => void) => {
      let firstFired = false

      const watchId = await watchGeoPosition(
        {
          enableHighAccuracy: options.enableHighAccuracy,
          timeout: options.timeout,
          maximumAge: options.maximumAge,
          ...(typeof options.distanceFilter === 'number'
            ? { distanceFilter: options.distanceFilter }
            : {}),
          ...(options.backgroundTitle ? { backgroundTitle: options.backgroundTitle } : {}),
          ...(options.backgroundMessage ? { backgroundMessage: options.backgroundMessage } : {}),
        },
        {
          onPoint: (geoPoint) => {
            if (!firstFired) {
              firstFired = true
              onFirstPosition?.(true)
            }

            const now = Date.now()
            lastUpdateAtRef.current = now

            const timestamp = Number.isFinite(geoPoint.timestamp) ? geoPoint.timestamp : now
            const point: GPSPoint = {
              latitude: geoPoint.latitude,
              longitude: geoPoint.longitude,
              timestamp,
              ...(typeof geoPoint.accuracy === 'number' ? { accuracy: geoPoint.accuracy } : {}),
              ...(typeof geoPoint.speed === 'number' ? { speed: geoPoint.speed } : {}),
            }

            setState((prev) => ({
              ...prev,
              watchId: watchIdRef.current,
              isTracking: true,
              callbackCount: prev.callbackCount + 1,
              lastPoint: point,
              lastUpdateAt: now,
              lastError: null,
            }))

            onPoint?.(point, toGeolocationPosition(geoPoint))
          },
          onError: (geoError) => {
            if (!firstFired) {
              firstFired = true
              onFirstPosition?.(false)
            }

            const mapped = toGeolocationError(geoError)

            setState((prev) => ({
              ...prev,
              lastError: mapped,
              isTracking: mapped.code !== 1,
              watchId: watchIdRef.current,
            }))
            onError?.(mapped)

            if (mapped.code === 1) {
              stopTracking()
            }
          },
        }
      )

      watchIdRef.current = watchId
      return watchId
    },
    [onPoint, onError, stopTracking]
  )

  // Restart the GPS watch (used by watchdog and visibility recovery — web only).
  const restartWatch = useCallback(async () => {
    if (!isTrackingRef.current || !optionsRef.current) return

    if (debug) {
      console.log('[GPS] Restarting watch (background recovery)')
    }

    const oldId = watchIdRef.current
    if (oldId) {
      await clearGeoWatch(oldId)
    }

    const watchId = await createWatch(optionsRef.current)
    setState((prev) => ({ ...prev, watchId, isTracking: true }))
  }, [debug, createWatch])

  const startTracking = useCallback(
    (options: GPSTrackingOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        stopTracking()
        optionsRef.current = options
        isTrackingRef.current = true
        lastUpdateAtRef.current = null

        setState({
          watchId: null,
          isTracking: true,
          callbackCount: 0,
          lastPoint: null,
          lastUpdateAt: null,
          lastError: null,
        })

        let settled = false
        const settle = (value: boolean) => {
          if (settled) return
          settled = true
          resolve(value)
        }

        const startTimeoutMs = Math.max(8000, Math.min(25000, options.timeout || 20000))
        const timeoutId = window.setTimeout(() => {
          if (debug) {
            console.warn('[GPS] watch start timed out')
          }
          stopTracking()
          settle(false)
        }, startTimeoutMs)

        createWatch(options, (success) => {
          clearTimeout(timeoutId)
          settle(success)
        })
          .then((watchId) => {
            setState((prev) => ({ ...prev, watchId, isTracking: true }))
          })
          .catch((err) => {
            console.error('[GPS] Failed to create watch:', err)
            clearTimeout(timeoutId)
            stopTracking()
            settle(false)
          })

        // Watchdog: web-only safety net. On iOS native, the background-geolocation
        // plugin keeps delivering updates when the WebView is suspended, so watch
        // restarts are unnecessary and would break continuity.
        clearWatchdog()
        if (!isIOSNativeApp()) {
          watchdogRef.current = setInterval(() => {
            if (!isTrackingRef.current) return

            const lastUpdate = lastUpdateAtRef.current
            if (lastUpdate !== null && Date.now() - lastUpdate > GPS_STALE_THRESHOLD_MS) {
              if (debug) {
                console.warn(
                  `[GPS] No update for ${Math.round((Date.now() - lastUpdate) / 1000)}s, restarting watch`
                )
              }
              void restartWatch()
            }
          }, GPS_WATCHDOG_INTERVAL_MS)
        }
      })
    },
    [debug, stopTracking, createWatch, clearWatchdog, restartWatch]
  )

  // Re-acquire GPS when the app returns to foreground. On iOS native this is a no-op
  // because the plugin is still alive; on web it recovers from the browser having
  // suspended watchPosition while the tab was hidden.
  useEffect(() => {
    if (isIOSNativeApp()) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isTrackingRef.current) {
        const lastUpdate = lastUpdateAtRef.current
        const gap = lastUpdate !== null ? Date.now() - lastUpdate : Infinity

        if (debug) {
          console.log(`[GPS] App became visible, last update ${Math.round(gap / 1000)}s ago`)
        }

        if (gap > GPS_STALE_THRESHOLD_MS) {
          void restartWatch()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [debug, restartWatch])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearWatchdog()
    }
  }, [clearWatchdog])

  return {
    ...state,
    watchIdRef,
    startTracking,
    stopTracking,
  }
}
