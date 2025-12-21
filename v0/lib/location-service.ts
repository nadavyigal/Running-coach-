/**
 * Location service for getting user's current location
 */

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
 * Get the user's current location using the browser's geolocation API.
 * Returns a status and optional coordinates/error (never rejects).
 */
export async function getLocation(options: LocationOptions = {}): Promise<LocationResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        status: 'unavailable',
        error: {
          code: 0,
          message: 'Geolocation is not supported by this browser',
        },
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
          error: {
            code: error.code,
            message: error.message,
          },
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
 * Watch the user's location for continuous updates
 */
export function watchLocation(
  onSuccess: (coords: LocationCoordinates) => void,
  onError: (error: LocationError) => void,
  options: LocationOptions = {}
): number {
  if (!navigator.geolocation) {
    onError({
      code: 0,
      message: 'Geolocation is not supported by this browser',
    });
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
      onError({
        code: error.code,
        message: error.message,
      });
    },
    {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeoutMs ?? 10000,
      maximumAge: options.maximumAgeMs ?? 0,
    }
  );
}

/**
 * Stop watching the user's location
 */
export function clearWatch(watchId: number): void {
  if (navigator.geolocation && watchId >= 0) {
    navigator.geolocation.clearWatch(watchId);
  }
}

