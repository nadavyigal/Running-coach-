import { useCallback, useRef, useState } from 'react'

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
}

export type GPSTrackingState = {
  watchId: number | null
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

export function useGpsTracking({ onPoint, onError, debug = false }: UseGpsTrackingArgs) {
  const watchIdRef = useRef<number | null>(null)
  const [state, setState] = useState<GPSTrackingState>({
    watchId: null,
    isTracking: false,
    callbackCount: 0,
    lastPoint: null,
    lastUpdateAt: null,
    lastError: null,
  })

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }
    watchIdRef.current = null
    setState((prev) => ({ ...prev, watchId: null, isTracking: false }))
  }, [])

  const startTracking = useCallback(
    (options: GPSTrackingOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve(false)
          return
        }

        stopTracking()
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
            console.warn('[GPS] watchPosition start timed out')
          }
          stopTracking()
          settle(false)
        }, startTimeoutMs)

        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            clearTimeout(timeoutId)
            settle(true)

            const timestamp = Number.isFinite(position.timestamp) ? position.timestamp : Date.now()
            const point: GPSPoint = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              timestamp,
              ...(typeof position.coords.accuracy === 'number'
                ? { accuracy: position.coords.accuracy }
                : {}),
              ...(typeof position.coords.speed === 'number' ? { speed: position.coords.speed } : {}),
            }

            setState((prev) => ({
              ...prev,
              watchId: watchIdRef.current,
              isTracking: true,
              callbackCount: prev.callbackCount + 1,
              lastPoint: point,
              lastUpdateAt: Date.now(),
              lastError: null,
            }))

            onPoint?.(point, position)
          },
          (error) => {
            clearTimeout(timeoutId)
            setState((prev) => ({
              ...prev,
              lastError: error,
              isTracking: false,
              watchId: watchIdRef.current,
            }))
            onError?.(error)

            if (error.code === 1) {
              stopTracking()
            }

            settle(false)
          },
          {
            enableHighAccuracy: options.enableHighAccuracy,
            timeout: options.timeout,
            maximumAge: options.maximumAge,
          }
        )

        watchIdRef.current = watchId
        setState((prev) => ({ ...prev, watchId, isTracking: true }))
      })
    },
    [debug, onError, onPoint, stopTracking]
  )

  return {
    ...state,
    watchIdRef,
    startTracking,
    stopTracking,
  }
}
