/**
 * Location service for getting user's current location.
 *
 * On iOS/Android native (Capacitor) we use @capacitor/geolocation, which
 * bridges to the native CLLocationManager and triggers the system permission
 * prompt backed by the Info.plist usage descriptions.
 *
 * On web we fall back to the standard navigator.geolocation API.
 */

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface LocationError {
  code: number;
  message: string;
}

export interface LocationOptions {
  enableHighAccuracy?: boolean;
  timeoutMs?: number;
  maximumAgeMs?: number;
}

export type LocationStatus = 'granted' | 'denied' | 'unavailable';

export interface LocationResult {
  status: LocationStatus;
  coords?: LocationCoordinates;
  error?: LocationError;
}

/**
 * Get the user's current location.
 * Returns a status and optional coordinates/error (never rejects).
 */
export async function getLocation(options: LocationOptions = {}): Promise<LocationResult> {
  if (Capacitor.isNativePlatform()) {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: options.enableHighAccuracy ?? true,
        timeout: options.timeoutMs ?? 10000,
        maximumAge: options.maximumAgeMs ?? 0,
      });
      return {
        status: 'granted',
        coords: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const isDenied = message.toLowerCase().includes('denied') ||
        message.toLowerCase().includes('not authorized') ||
        message.toLowerCase().includes('permission');
      return {
        status: isDenied ? 'denied' : 'unavailable',
        error: { code: isDenied ? 1 : 2, message },
      };
    }
  }

  // Web fallback
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({
        status: 'unavailable',
        error: { code: 0, message: 'Geolocation is not supported by this browser' },
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          status: 'granted',
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
        });
      },
      (error) => {
        resolve({
          status: error.code === 1 ? 'denied' : 'unavailable',
          error: { code: error.code, message: error.message },
        });
      },
      {
        enableHighAccuracy: options.enableHighAccuracy ?? true,
        timeout: options.timeoutMs ?? 10000,
        maximumAge: options.maximumAgeMs ?? 0,
      }
    );
  });
}

/**
 * Convenience wrapper that returns coordinates or throws when unavailable.
 */
export async function getLocationCoordinates(options: LocationOptions = {}): Promise<LocationCoordinates> {
  const result = await getLocation(options);
  if (result.coords) return result.coords;
  throw result.error ?? { code: 0, message: 'Location unavailable' };
}

/**
 * Watch the user's location for continuous updates.
 * Returns a watch ID — pass it to clearWatch() to stop.
 *
 * On native the ID is a string (Capacitor); on web it is a number.
 */
export async function watchLocation(
  onSuccess: (coords: LocationCoordinates) => void,
  onError: (error: LocationError) => void,
  options: LocationOptions = {}
): Promise<string | number> {
  if (Capacitor.isNativePlatform()) {
    const watchId = await Geolocation.watchPosition(
      {
        enableHighAccuracy: options.enableHighAccuracy ?? true,
        timeout: options.timeoutMs ?? 10000,
        maximumAge: options.maximumAgeMs ?? 0,
      },
      (position, err) => {
        if (err) {
          const message = err instanceof Error ? err.message : String(err);
          const isDenied = message.toLowerCase().includes('denied') ||
            message.toLowerCase().includes('not authorized') ||
            message.toLowerCase().includes('permission');
          onError({ code: isDenied ? 1 : 2, message });
          return;
        }
        if (!position) return;
        onSuccess({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      }
    );
    return watchId;
  }

  // Web fallback
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError({ code: 0, message: 'Geolocation is not supported by this browser' });
    return -1;
  }

  return navigator.geolocation.watchPosition(
    (position) => {
      onSuccess({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    },
    (error) => {
      onError({ code: error.code, message: error.message });
    },
    {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeoutMs ?? 10000,
      maximumAge: options.maximumAgeMs ?? 0,
    }
  );
}

/**
 * Stop watching the user's location.
 * Accepts either a Capacitor string ID (native) or a browser number ID (web).
 */
export async function clearWatch(watchId: string | number): Promise<void> {
  if (Capacitor.isNativePlatform() && typeof watchId === 'string') {
    await Geolocation.clearWatch({ id: watchId });
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.geolocation && typeof watchId === 'number' && watchId >= 0) {
    navigator.geolocation.clearWatch(watchId);
  }
}
