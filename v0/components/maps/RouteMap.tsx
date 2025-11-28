'use client';

/**
 * RouteMap Component
 * Interactive map for displaying routes using MapLibre GL JS
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Route } from '@/lib/db';
import type { LatLng } from '@/lib/mapConfig';
import { MAP_CONFIG, getTileUrl, hasMapTilerToken } from '@/lib/mapConfig';
import { parseGpsPath, getRouteBounds } from '@/lib/routeUtils';
import { MapFallback } from './MapFallback';
import { trackMapLoaded, trackMapLoadFailed, trackRouteSelectedFromMap } from '@/lib/analytics';

// Dynamic import types for MapLibre
type MapLibreMap = any;
type MapLibreMarker = any;

export interface RouteMapProps {
  /** Map center coordinates */
  center?: LatLng;
  /** Initial zoom level */
  zoom?: number;
  /** Routes to display on map */
  routes?: Route[];
  /** User's current location */
  userLocation?: LatLng | null;
  /** Callback when route marker is clicked */
  onRouteClick?: (route: Route) => void;
  /** Selected route ID */
  selectedRouteId?: number;
  /** Whether map is interactive (pan/zoom) */
  interactive?: boolean;
  /** Optional map click handler (for custom route creation) */
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  /** Map container height */
  height?: string;
  /** Dark mode */
  darkMode?: boolean;
  /** Class name for container */
  className?: string;
}

/**
 * RouteMap - Client-side only map component
 * Uses dynamic import to avoid SSR issues with MapLibre
 */
export function RouteMap({
  center = MAP_CONFIG.defaults.center,
  zoom = MAP_CONFIG.defaults.zoom,
  routes = [],
  userLocation,
  onRouteClick,
  selectedRouteId,
  interactive = true,
  onMapClick,
  height = '400px',
  darkMode = false,
  className = '',
}: RouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [mapLibre, setMapLibre] = useState<any>(null);

  // Dynamically import MapLibre GL JS (client-side only)
  useEffect(() => {
    let mounted = true;

    const loadMapLibre = async () => {
      try {
        const maplibregl = await import('maplibre-gl');
        if (mounted) {
          setMapLibre(maplibregl.default);
        }
      } catch (error) {
        console.error('Failed to load MapLibre GL JS:', error);
        if (mounted) {
          setHasError(true);
          setErrorMessage('Failed to load map library');
          setIsLoading(false);
        }
      }
    };

    loadMapLibre();

    return () => {
      mounted = false;
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapLibre || !mapContainerRef.current || mapRef.current) return;

    try {
      const useFallback = !hasMapTilerToken();
      const tileUrl = getTileUrl(darkMode ? 'dark' : 'light', useFallback);

      const map = new mapLibre.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            'raster-tiles': {
              type: 'raster',
              tiles: [tileUrl],
              tileSize: 256,
              attribution: useFallback
                ? '© OpenStreetMap contributors'
                : '© MapTiler © OpenStreetMap contributors',
            },
          },
          layers: [
            {
              id: 'simple-tiles',
              type: 'raster',
              source: 'raster-tiles',
              minzoom: 0,
              maxzoom: 22,
            },
          ],
        },
        center: [center.lng, center.lat],
        zoom: zoom,
        interactive: interactive,
        minZoom: MAP_CONFIG.defaults.minZoom,
        maxZoom: MAP_CONFIG.defaults.maxZoom,
      });

      map.on('load', () => {
        setIsLoading(false);
        trackMapLoaded({
          tile_provider: useFallback ? 'osm' : 'maptiler',
          dark_mode: darkMode,
        });
      });

      map.on('error', (e: any) => {
        console.error('Map error:', e);
        setHasError(true);
        setErrorMessage('Map failed to load. Please try again.');
        setIsLoading(false);
        trackMapLoadFailed({
          error: e.error?.message || 'Unknown error',
        });
      });

      if (interactive) {
        map.addControl(new mapLibre.NavigationControl(), 'top-right');
      }

      mapRef.current = map;
    } catch (error) {
      console.error('Failed to initialize map:', error);
      setHasError(true);
      setErrorMessage('Failed to initialize map');
      setIsLoading(false);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapLibre, center.lat, center.lng, zoom, interactive, darkMode]);

  // Clear markers helper
  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
  }, []);

  // Attach map click handler for waypoint placement / selection
  useEffect(() => {
    if (!mapRef.current || !onMapClick) return;

    const handler = (e: any) => {
      onMapClick({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    };

    mapRef.current.on('click', handler);

    return () => {
      mapRef.current?.off('click', handler);
    };
  }, [onMapClick]);

  // Add route markers and paths
  useEffect(() => {
    if (!mapRef.current || !mapLibre || !routes.length) return;

    clearMarkers();

    routes.forEach(route => {
      // Parse GPS path
      const pathPoints = parseGpsPath(route.gpsPath);

      // Add route line if path exists
      if (pathPoints.length >= 2) {
        const sourceId = `route-${route.id}`;
        const layerId = `route-line-${route.id}`;

        // Remove existing source/layer if present
        if (mapRef.current?.getLayer(layerId)) {
          mapRef.current.removeLayer(layerId);
        }
        if (mapRef.current?.getSource(sourceId)) {
          mapRef.current.removeSource(sourceId);
        }

        // Add route source
        mapRef.current.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: pathPoints.map(p => [p.lng, p.lat]),
            },
          },
        });

        // Add route line layer
        const isSelected = route.id === selectedRouteId;
        const routeColor =
          route.routeType === 'custom'
            ? MAP_CONFIG.routes.colors.custom
            : isSelected
            ? MAP_CONFIG.routes.colors.selected
            : MAP_CONFIG.routes.colors.default;

        mapRef.current.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': routeColor,
            'line-width': isSelected
              ? MAP_CONFIG.routes.selectedLineWidth
              : MAP_CONFIG.routes.lineWidth,
            'line-opacity': MAP_CONFIG.routes.opacity,
          },
        });
      }

      // Add start marker
      if (route.startLat && route.startLng) {
        const el = document.createElement('div');
        el.className = 'route-marker';
        el.style.width = `${MAP_CONFIG.markers.routeStart.size}px`;
        el.style.height = `${MAP_CONFIG.markers.routeStart.size}px`;
        el.style.borderRadius = '50%';
        el.style.backgroundColor = MAP_CONFIG.markers.routeStart.color;
        el.style.border = '2px solid white';
        el.style.cursor = onRouteClick ? 'pointer' : 'default';
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

        const marker = new mapLibre.Marker({ element: el })
          .setLngLat([route.startLng, route.startLat])
          .addTo(mapRef.current);

        if (onRouteClick) {
          el.addEventListener('click', () => {
            onRouteClick(route);
            trackRouteSelectedFromMap({
              route_id: route.id,
              route_name: route.name,
            });
          });
        }

        markersRef.current.push(marker);
      }
    });

    // Fit bounds to show all routes
    if (routes.length > 0 && routes.some(r => r.startLat && r.startLng)) {
      const allPoints: LatLng[] = [];

      routes.forEach(route => {
        if (route.startLat && route.startLng) {
          allPoints.push({ lat: route.startLat, lng: route.startLng });
        }
        const pathPoints = parseGpsPath(route.gpsPath);
        allPoints.push(...pathPoints);
      });

      if (userLocation) {
        allPoints.push(userLocation);
      }

      const bounds = getRouteBounds(allPoints);
      if (bounds) {
        mapRef.current.fitBounds(
          [
            [bounds.sw.lng, bounds.sw.lat],
            [bounds.ne.lng, bounds.ne.lat],
          ],
          {
            padding: MAP_CONFIG.animation.fitBoundsPadding,
            duration: MAP_CONFIG.animation.flyToDuration,
          }
        );
      }
    }
  }, [routes, selectedRouteId, mapLibre, onRouteClick, clearMarkers, userLocation]);

  // Add user location marker
  useEffect(() => {
    if (!mapRef.current || !mapLibre || !userLocation) return;

    const el = document.createElement('div');
    el.className = 'user-location-marker';
    el.style.width = `${MAP_CONFIG.markers.user.size}px`;
    el.style.height = `${MAP_CONFIG.markers.user.size}px`;
    el.style.borderRadius = '50%';
    el.style.backgroundColor = MAP_CONFIG.markers.user.color;
    el.style.border = '3px solid white';
    el.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.5)';

    const marker = new mapLibre.Marker({ element: el })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(mapRef.current);

    markersRef.current.push(marker);

    return () => {
      marker.remove();
    };
  }, [userLocation, mapLibre]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setHasError(false);
    setErrorMessage('');
    setIsLoading(true);
    // Force re-render by clearing and re-initializing
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
  }, []);

  // Show fallback if error occurred
  if (hasError) {
    return (
      <MapFallback
        error={errorMessage}
        onRetry={handleRetry}
        routes={routes}
        userLocation={userLocation}
        onRouteClick={onRouteClick}
      />
    );
  }

  return (
    <div className={`relative ${className}`} style={{ height }}>
      {/* Map container */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 rounded-lg overflow-hidden"
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-sm rounded-lg">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Loading map...
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Import MapLibre CSS */}
      <style jsx global>{`
        @import 'maplibre-gl/dist/maplibre-gl.css';
      `}</style>
    </div>
  );
}
