/**
 * MapLibre GL JS Configuration
 * Centralized map settings for route visualization
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapBounds {
  ne: LatLng;
  sw: LatLng;
}

/**
 * Map tile configuration with theme support
 */
export const MAP_CONFIG = {
  // Tile providers
  tiles: {
    maptiler: {
      light: process.env.NEXT_PUBLIC_MAP_TILE_URL ||
             'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key={token}',
      dark: process.env.NEXT_PUBLIC_MAP_TILE_URL_DARK ||
            'https://api.maptiler.com/maps/streets-v2-dark/{z}/{x}/{y}.png?key={token}',
      token: process.env.NEXT_PUBLIC_MAP_TILE_TOKEN || '',
    },
    osm: {
      // OpenStreetMap fallback (no dark mode support)
      light: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      dark: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', // Same as light
      attribution: '© OpenStreetMap contributors',
    },
  },

  // Default map settings
  defaults: {
    center: { lat: 32.0853, lng: 34.7818 } as LatLng, // Tel Aviv
    zoom: 13,
    minZoom: 8,
    maxZoom: 18,
    pitch: 0,
    bearing: 0,
  },

  // Map bounds for Tel Aviv area
  bounds: {
    ne: { lat: 32.15, lng: 34.85 },
    sw: { lat: 32.00, lng: 34.70 },
  } as MapBounds,

  // Route visualization
  routes: {
    colors: {
      default: '#3b82f6', // blue-500
      selected: '#8b5cf6', // violet-500
      custom: '#10b981', // emerald-500
      hover: '#6366f1', // indigo-500
    },
    lineWidth: 3,
    selectedLineWidth: 5,
    opacity: 0.8,
  },

  // Markers
  markers: {
    user: {
      color: '#ef4444', // red-500
      size: 32,
    },
    routeStart: {
      color: '#10b981', // emerald-500
      size: 28,
    },
    routeEnd: {
      color: '#ef4444', // red-500
      size: 28,
    },
    waypoint: {
      color: '#3b82f6', // blue-500
      size: 20,
    },
    cluster: {
      color: '#8b5cf6', // violet-500
      textColor: '#ffffff',
    },
  },

  // Feature limits
  limits: {
    maxCustomRoutes: 50,
    maxWaypoints: 20,
    clusterRadius: 50,
    clusterMaxZoom: 14,
  },

  // Animation settings
  animation: {
    flyToDuration: 1500,
    fitBoundsPadding: 50,
  },
} as const;

/**
 * Get tile URL for current theme
 */
export function getTileUrl(theme: 'light' | 'dark' = 'light', useFallback = false): string {
  const provider = useFallback ? MAP_CONFIG.tiles.osm : MAP_CONFIG.tiles.maptiler;
  const url = provider[theme];

  if (!useFallback && MAP_CONFIG.tiles.maptiler.token) {
    return url.replace('{token}', MAP_CONFIG.tiles.maptiler.token);
  }

  return url;
}

/**
 * Check if MapTiler token is configured
 */
export function hasMapTilerToken(): boolean {
  return Boolean(MAP_CONFIG.tiles.maptiler.token);
}

/**
 * Get attribution text for current provider
 */
export function getAttribution(useFallback = false): string {
  if (useFallback) {
    return MAP_CONFIG.tiles.osm.attribution;
  }
  return '© MapTiler © OpenStreetMap contributors';
}
