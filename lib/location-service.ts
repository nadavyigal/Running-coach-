/**
 * Shared geolocation helper with graceful fallbacks and caching.
 */
export type LocationStatus =
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'timeout';

export interface GeoLocationResult {
  status: LocationStatus;
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null;
  source: 'fresh' | 'cache' | 'default';
  error?: string;
}

interface GetLocationOptions {
  timeoutMs?: number;
  enableHighAccuracy?: boolean;
  cacheKey?: string;
  defaultCoords?: {
    latitude: number;
    longitude: number;
  };
}

const DEFAULT_TIMEOUT = 10000;
const DEFAULT_CACHE_KEY = 'last-known-location';
const DEFAULT_COORDS = { latitude: 32.0853, longitude: 34.7818 }; // Tel Aviv center

function isSecureContext() {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'https:' || window.location.hostname === 'localhost';
}

function getCachedLocation(cacheKey: string) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
      return parsed as { latitude: number; longitude: number; accuracy?: number };
    }
  } catch (error) {
    console.warn('[location-service] Failed to read cached location:', error);
  }
  return null;
}

function cacheLocation(cacheKey: string, coords: { latitude: number; longitude: number; accuracy?: number }) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(cacheKey, JSON.stringify(coords));
  } catch (error) {
    // Ignore cache errors; caching is best-effort only.
    console.warn('[location-service] Failed to cache location:', error);
  }
}

export async function getLocation(options: GetLocationOptions = {}): Promise<GeoLocationResult> {
  const {
    timeoutMs = DEFAULT_TIMEOUT,
    enableHighAccuracy = false,
    cacheKey = DEFAULT_CACHE_KEY,
    defaultCoords = DEFAULT_COORDS,
  } = options;

  if (typeof window === 'undefined') {
    return { status: 'unavailable', coords: null, source: 'default', error: 'Not in browser context' };
  }

  if (!isSecureContext()) {
    return {
      status: 'unavailable',
      coords: getCachedLocation(cacheKey) || { ...defaultCoords, accuracy: Infinity },
      source: getCachedLocation(cacheKey) ? 'cache' : 'default',
      error: 'Insecure context; geolocation requires HTTPS or localhost',
    };
  }

  if (!navigator.geolocation) {
    return {
      status: 'unavailable',
      coords: getCachedLocation(cacheKey) || { ...defaultCoords, accuracy: Infinity },
      source: getCachedLocation(cacheKey) ? 'cache' : 'default',
      error: 'Geolocation API not available',
    };
  }

  // Try Permissions API for quick denied check
  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    if (permission.state === 'denied') {
      return {
        status: 'denied',
        coords: getCachedLocation(cacheKey) || { ...defaultCoords, accuracy: Infinity },
        source: getCachedLocation(cacheKey) ? 'cache' : 'default',
        error: 'Permission denied',
      };
    }
  } catch {
    // Permissions API unsupported; continue.
  }

  // Manual timeout guard around getCurrentPosition
  const positionPromise = new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy,
      timeout: timeoutMs,
      maximumAge: 300000,
    });
  });

  const timeoutPromise = new Promise<GeolocationPosition>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error('timeout'));
    }, timeoutMs + 50); // tiny buffer
  });

  try {
    const position = await Promise.race([positionPromise, timeoutPromise]);
    const coords = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };
    cacheLocation(cacheKey, coords);
    return { status: 'granted', coords, source: 'fresh' };
  } catch (error) {
    const cached = getCachedLocation(cacheKey);
    const fallbackCoords = cached || { ...defaultCoords, accuracy: Infinity };
    const status: LocationStatus = (error as any)?.code === (error as any)?.PERMISSION_DENIED ? 'denied' : (error as Error).message === 'timeout' ? 'timeout' : 'unavailable';

    return {
      status,
      coords: fallbackCoords,
      source: cached ? 'cache' : 'default',
      error: error instanceof Error ? error.message : 'Location request failed',
    };
  }
}

export function hasFreshLocation(cacheKey: string = DEFAULT_CACHE_KEY): boolean {
  const cached = getCachedLocation(cacheKey);
  return Boolean(cached);
}
