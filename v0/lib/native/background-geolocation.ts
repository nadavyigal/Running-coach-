/**
 * Platform-aware GPS bridge.
 *
 * On iOS native (Capacitor) we use @capacitor-community/background-geolocation,
 * which wraps CLLocationManager with allowsBackgroundLocationUpdates = true and
 * keeps delivering updates when the WKWebView JS is suspended (screen locked,
 * app backgrounded). The iOS UIBackgroundModes=location declared in Info.plist
 * is what makes this possible.
 *
 * On web (PWA) we fall back to the standard navigator.geolocation API, which
 * is suspended by the browser when hidden but is the best available option.
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
   * True when the failure is a permission denial. Callers should surface a
   * settings prompt (iOS: BackgroundGeolocation.openSettings()).
   */
  notAuthorized?: boolean
}

export type WatchOptions = {
  enableHighAccuracy: boolean
  timeout?: number
  maximumAge?: number
  /** Metres between updates on native. Ignored on web. */
  distanceFilter?: number
  /** iOS foreground service notification title. Ignored on web. */
  backgroundTitle?: string
  /** iOS foreground service notification body. Ignored on web. */
  backgroundMessage?: string
}

export type WatchCallbacks = {
  onPoint: (point: GeoPoint) => void
  onError: (error: GeoError) => void
}

type NativeLocation = {
  latitude: number
  longitude: number
  accuracy: number
  altitude: number | null
  altitudeAccuracy: number | null
  bearing: number | null
  simulated: boolean
  speed: number | null
  time: number
}

type NativePluginError = {
  code?: string
  message?: string
}

type BackgroundGeolocationPlugin = {
  addWatcher(
    options: {
      backgroundTitle?: string
      backgroundMessage?: string
      requestPermissions?: boolean
      stale?: boolean
      distanceFilter?: number
    },
    callback: (location: NativeLocation | null, error?: NativePluginError) => void
  ): Promise<string>
  removeWatcher(options: { id: string }): Promise<void>
  openSettings(): Promise<void>
}

let pluginPromise: Promise<BackgroundGeolocationPlugin> | null = null
function getPlugin(): Promise<BackgroundGeolocationPlugin> {
  if (!pluginPromise) {
    pluginPromise = import('@capacitor/core').then(({ registerPlugin }) =>
      registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')
    )
  }
  return pluginPromise
}

const webWatchMap = new Map<string, number>()
let webWatchCounter = 0

export async function watchGeoPosition(
  options: WatchOptions,
  callbacks: WatchCallbacks
): Promise<string> {
  if (isIOSNativeApp()) {
    const plugin = await getPlugin()
    const id = await plugin.addWatcher(
      {
        requestPermissions: true,
        stale: false,
        ...(typeof options.distanceFilter === 'number'
          ? { distanceFilter: options.distanceFilter }
          : {}),
        ...(options.backgroundTitle ? { backgroundTitle: options.backgroundTitle } : {}),
        ...(options.backgroundMessage ? { backgroundMessage: options.backgroundMessage } : {}),
      },
      (location, error) => {
        if (error) {
          callbacks.onError({
            code: error.code ?? 'UNKNOWN',
            message: error.message ?? 'Unknown geolocation error',
            notAuthorized: error.code === 'NOT_AUTHORIZED',
          })
          return
        }
        if (!location) return
        callbacks.onPoint({
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: Number.isFinite(location.time) ? location.time : Date.now(),
          ...(typeof location.accuracy === 'number' ? { accuracy: location.accuracy } : {}),
          ...(typeof location.speed === 'number' && location.speed !== null
            ? { speed: location.speed }
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
    const plugin = await getPlugin()
    try {
      await plugin.removeWatcher({ id })
    } catch (e) {
      console.warn('[GPS native] removeWatcher failed:', e)
    }
    return
  }

  const nativeId = webWatchMap.get(id)
  if (nativeId !== undefined && typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.clearWatch(nativeId)
    webWatchMap.delete(id)
  }
}

/**
 * Open the native iOS Settings app so the user can grant "Always" location
 * permission. No-op on web.
 */
export async function openLocationSettings(): Promise<void> {
  if (!isIOSNativeApp()) return
  const plugin = await getPlugin()
  try {
    await plugin.openSettings()
  } catch (e) {
    console.warn('[GPS native] openSettings failed:', e)
  }
}
