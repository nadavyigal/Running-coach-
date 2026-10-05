/**
 * Platform-aware GPS bridge.
 *
 * On iOS native (Capacitor) we use @capacitor/geolocation, which wraps
 * CLLocationManager and delivers foreground location updates. UIBackgroundModes=location
 * in Info.plist allows continued delivery when the screen is on and the app is active.
 *
 * On web (PWA) we fall back to the standard navigator.geolocation API.
 */

import { isIOSNativeApp } from '@/lib/capacitor-platform'

export type GeoPoint = {
  latitude: number
  longitude: number
  accuracy?: number
  speed?: number
  timestamp: number
}

export type GeoError = {
  code: string | number
  message: string
  /**
   * True when the failure is a permission denial.
   */
  notAuthorized?: boolean
}

export type WatchOptions = {
  enableHighAccuracy: boolean
  timeout?: number
  maximumAge?: number
  /** Metres between updates on native. Ignored on web. */
  distanceFilter?: number
  /** Unused – kept for API compatibility. */
  backgroundTitle?: string
  /** Unused – kept for API compatibility. */
  backgroundMessage?: string
}

export type WatchCallbacks = {
  onPoint: (point: GeoPoint) => void
  onError: (error: GeoError) => void
}

const webWatchMap = new Map<string, number>()
let webWatchCounter = 0

export async function watchGeoPosition(
  options: WatchOptions,
  callbacks: WatchCallbacks
): Promise<string> {
  if (isIOSNativeApp()) {
    const { Geolocation } = await import('@capacitor/geolocation')

    // Ensure permissions before starting the watch
    let permStatus = await Geolocation.checkPermissions()
    if (permStatus.location !== 'granted') {
      const requested = await Geolocation.requestPermissions()
      if (requested.location !== 'granted') {
        callbacks.onError({
          code: 1,
          message: 'Location permission denied',
          notAuthorized: true,
        })
        return ''
      }
      permStatus = await Geolocation.checkPermissions()
    }

    const id = await Geolocation.watchPosition(
      {
        enableHighAccuracy: options.enableHighAccuracy,
        ...(typeof options.timeout === 'number' ? { timeout: options.timeout } : {}),
        ...(typeof options.maximumAge === 'number' ? { maximumAge: options.maximumAge } : {}),
      },
      (position, err) => {
        if (err) {
          callbacks.onError({
            code: (err as GeolocationPositionError).code ?? 2,
            message: (err as GeolocationPositionError).message ?? 'Unknown geolocation error',
            notAuthorized: (err as GeolocationPositionError).code === 1,
          })
          return
        }
        if (!position) return
        callbacks.onPoint({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Number.isFinite(position.timestamp) ? position.timestamp : Date.now(),
          ...(typeof position.coords.accuracy === 'number'
            ? { accuracy: position.coords.accuracy }
            : {}),
          ...(typeof position.coords.speed === 'number' && position.coords.speed !== null
            ? { speed: position.coords.speed }
            : {}),
        })
      }
    )

    return id
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    callbacks.onError({ code: 2, message: 'Geolocation not supported' })
    return ''
  }

  const id = `web-${++webWatchCounter}`
  const nativeId = navigator.geolocation.watchPosition(
    (position) => {
      callbacks.onPoint({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp: Number.isFinite(position.timestamp) ? position.timestamp : Date.now(),
        ...(typeof position.coords.accuracy === 'number'
          ? { accuracy: position.coords.accuracy }
          : {}),
        ...(typeof position.coords.speed === 'number' && position.coords.speed !== null
          ? { speed: position.coords.speed }
          : {}),
      })
    },
    (error) => {
      callbacks.onError({
        code: error.code,
        message: error.message,
        notAuthorized: error.code === 1,
      })
    },
    {
      enableHighAccuracy: options.enableHighAccuracy,
      ...(typeof options.timeout === 'number' ? { timeout: options.timeout } : {}),
      ...(typeof options.maximumAge === 'number' ? { maximumAge: options.maximumAge } : {}),
    }
  )
  webWatchMap.set(id, nativeId)
  return id
}

export async function clearGeoWatch(id: string): Promise<void> {
  if (!id) return

  if (isIOSNativeApp()) {
    const { Geolocation } = await import('@capacitor/geolocation')
    try {
      await Geolocation.clearWatch({ id })
    } catch (e) {
      console.warn('[GPS native] clearWatch failed:', e)
    }
    return
  }

  const nativeId = webWatchMap.get(id)
  if (nativeId !== undefined && typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.clearWatch(nativeId)
    webWatchMap.delete(id)
  }
}

/** No-op – retained for API compatibility. */
export async function openLocationSettings(): Promise<void> {}
