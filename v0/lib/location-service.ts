/**
 * Location service for getting user's current location
 */

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface LocationError {
  code: number;
  message: string;
}

/**
 * Get the user's current location using the browser's geolocation API
 */
export async function getLocation(): Promise<LocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({
        code: 0,
        message: 'Geolocation is not supported by this browser',
      } as LocationError);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        reject({
          code: error.code,
          message: error.message,
        } as LocationError);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Watch the user's location for continuous updates
 */
export function watchLocation(
  onSuccess: (coords: LocationCoordinates) => void,
  onError: (error: LocationError) => void
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
      });
    },
    (error) => {
      onError({
        code: error.code,
        message: error.message,
      });
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
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
