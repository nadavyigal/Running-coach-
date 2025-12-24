'use client';

/**
 * RunMap Component
 * Live MapLibre map for displaying current GPS position + path during an active run
 */

import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '@/lib/mapConfig';
import { MAP_CONFIG, getTileUrl, hasMapTilerToken } from '@/lib/mapConfig';
import { MapFallback } from './MapFallback';

// Dynamic import types for MapLibre
type MapLibreMap = any;
type MapLibreMarker = any;
type MapLibreGeoJSONSource = any;

export interface RunMapProps {
  /** User's current location */
  userLocation: LatLng | null;
  /** Path of recorded GPS points */
  path?: LatLng[];
  /** Whether the camera should follow the user */
  followUser?: boolean;
  /** Whether to render start/end markers for the path */
  showStartEndMarkers?: boolean;
  /** Whether the map is interactive (pan/zoom) */
  interactive?: boolean;
  /** Map container height */
  height?: string;
  /** Class name for container */
  className?: string;
}

const RUN_PATH_SOURCE_ID = 'run-path';
const RUN_PATH_LAYER_ID = 'run-path-line';

function distanceMeters(a: LatLng, b: LatLng): number {
  // Haversine; good enough for small, frequent GPS deltas.
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function RunMap({
  userLocation,
  path = [],
  followUser = true,
  showStartEndMarkers = false,
  interactive = true,
  height = '400px',
  className = '',
}: RunMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const userMarkerRef = useRef<MapLibreMarker | null>(null);
  const startMarkerRef = useRef<MapLibreMarker | null>(null);
  const endMarkerRef = useRef<MapLibreMarker | null>(null);

  const hasCenteredOnceRef = useRef(false);
  const lastCameraUpdateAtRef = useRef(0);
  const isUserInteractingRef = useRef(false);
  const lastUserInteractionAtRef = useRef(0);

  const [mapLibre, setMapLibre] = useState<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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

    const handleInteractionStart = () => {
      isUserInteractingRef.current = true;
    };
    const handleInteractionEnd = () => {
      isUserInteractingRef.current = false;
      lastUserInteractionAtRef.current = Date.now();
    };

    try {
      const useFallback = !hasMapTilerToken();
      const tileUrl = getTileUrl('light', useFallback);

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
                ? '?c OpenStreetMap contributors'
                : '?c MapTiler ?c OpenStreetMap contributors',
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
        center: [MAP_CONFIG.defaults.center.lng, MAP_CONFIG.defaults.center.lat],
        zoom: 15,
        interactive,
        minZoom: MAP_CONFIG.defaults.minZoom,
        maxZoom: MAP_CONFIG.defaults.maxZoom,
      });

      map.on('load', () => {
        setIsLoading(false);
        setMapReady(true);

        // Create the run path source/layer once; subsequent updates just call setData().
        if (!map.getSource(RUN_PATH_SOURCE_ID)) {
          map.addSource(RUN_PATH_SOURCE_ID, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [],
              },
            },
          });
        }

        if (!map.getLayer(RUN_PATH_LAYER_ID)) {
          map.addLayer({
            id: RUN_PATH_LAYER_ID,
            type: 'line',
            source: RUN_PATH_SOURCE_ID,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': MAP_CONFIG.routes.colors.custom,
              'line-width': 4,
              'line-opacity': 0.9,
            },
          });
        }
      });

      map.on('error', (e: any) => {
        console.error('Map error:', e);
        setHasError(true);
        setErrorMessage('Map failed to load. Please try again.');
        setIsLoading(false);
      });

      if (interactive) {
        map.addControl(new mapLibre.NavigationControl(), 'top-right');
        // Avoid fighting the user while they pan/zoom; we pause auto-follow briefly.
        map.on('dragstart', handleInteractionStart);
        map.on('dragend', handleInteractionEnd);
        map.on('zoomstart', handleInteractionStart);
        map.on('zoomend', handleInteractionEnd);
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
        if (interactive) {
          mapRef.current.off('dragstart', handleInteractionStart);
          mapRef.current.off('dragend', handleInteractionEnd);
          mapRef.current.off('zoomstart', handleInteractionStart);
          mapRef.current.off('zoomend', handleInteractionEnd);
        }

        userMarkerRef.current?.remove();
        userMarkerRef.current = null;
        startMarkerRef.current?.remove();
        startMarkerRef.current = null;
        endMarkerRef.current?.remove();
        endMarkerRef.current = null;

        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapReady(false);
      hasCenteredOnceRef.current = false;
    };
  }, [mapLibre, interactive]);

  // Update path line when GPS path changes
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const source = mapRef.current.getSource(RUN_PATH_SOURCE_ID) as
      | MapLibreGeoJSONSource
      | undefined;
    if (!source || typeof source.setData !== 'function') return;

    source.setData({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: path.map((p) => [p.lng, p.lat]),
      },
    });

    if (!showStartEndMarkers) {
      startMarkerRef.current?.remove();
      startMarkerRef.current = null;
      endMarkerRef.current?.remove();
      endMarkerRef.current = null;
      return;
    }

    const map = mapRef.current;
    const first = path.at(0) ?? null;
    const last = path.at(-1) ?? null;

    if (!first || !last) {
      startMarkerRef.current?.remove();
      startMarkerRef.current = null;
      endMarkerRef.current?.remove();
      endMarkerRef.current = null;
      return;
    }

    if (!startMarkerRef.current) {
      const startEl = document.createElement('div');
      startEl.style.width = `${MAP_CONFIG.markers.routeStart.size}px`;
      startEl.style.height = `${MAP_CONFIG.markers.routeStart.size}px`;
      startEl.style.borderRadius = '50%';
      startEl.style.backgroundColor = MAP_CONFIG.markers.routeStart.color;
      startEl.style.border = '3px solid white';
      startEl.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.35)';

      startMarkerRef.current = new (mapLibre as any).Marker({ element: startEl })
        .setLngLat([first.lng, first.lat])
        .addTo(map);
    } else {
      startMarkerRef.current.setLngLat([first.lng, first.lat]);
    }

    if (!endMarkerRef.current) {
      const endEl = document.createElement('div');
      endEl.style.width = `${MAP_CONFIG.markers.routeEnd.size}px`;
      endEl.style.height = `${MAP_CONFIG.markers.routeEnd.size}px`;
      endEl.style.borderRadius = '50%';
      endEl.style.backgroundColor = MAP_CONFIG.markers.routeEnd.color;
      endEl.style.border = '3px solid white';
      endEl.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.35)';

      endMarkerRef.current = new (mapLibre as any).Marker({ element: endEl })
        .setLngLat([last.lng, last.lat])
        .addTo(map);
    } else {
      endMarkerRef.current.setLngLat([last.lng, last.lat]);
    }

    if (!userLocation && !hasCenteredOnceRef.current && path.length > 0) {
      const lats = path.map((p) => p.lat);
      const lngs = path.map((p) => p.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      hasCenteredOnceRef.current = true;
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 40, duration: 0 }
      );
    }
  }, [path, mapReady, mapLibre, showStartEndMarkers, userLocation]);

  // Update user marker + optionally follow camera
  useEffect(() => {
    if (!mapRef.current || !mapLibre || !mapReady) return;

    if (!userLocation) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }

    if (!userMarkerRef.current) {
      const sizePx = MAP_CONFIG.markers.user.size
      const el = document.createElement('div');
      el.className = 'run-user-location-marker';
      el.style.width = `${sizePx}px`;
      el.style.height = `${sizePx}px`;
      el.style.borderRadius = '50%';
      el.style.backgroundColor = 'rgba(59, 130, 246, 0.20)';
      el.style.border = '2px solid rgba(59, 130, 246, 0.55)';
      el.style.boxShadow = '0 0 12px rgba(59, 130, 246, 0.35)';
      el.style.display = 'flex'
      el.style.alignItems = 'center'
      el.style.justifyContent = 'center'

      const inner = document.createElement('div')
      inner.style.width = `${Math.max(10, Math.round(sizePx * 0.35))}px`
      inner.style.height = `${Math.max(10, Math.round(sizePx * 0.35))}px`
      inner.style.borderRadius = '50%'
      inner.style.backgroundColor = MAP_CONFIG.markers.user.color
      inner.style.border = '2px solid white'
      inner.style.boxShadow = '0 0 6px rgba(0, 0, 0, 0.12)'
      el.appendChild(inner)

      userMarkerRef.current = new mapLibre.Marker({ element: el })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(mapRef.current);
    } else {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    }

    const now = Date.now();
    const map = mapRef.current;

    // Always center once on first fix so the marker is visible (even if followUser is off).
    if (!hasCenteredOnceRef.current) {
      hasCenteredOnceRef.current = true;
      lastCameraUpdateAtRef.current = now;
      map.jumpTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: Math.max(map.getZoom?.() ?? 15, 16),
      });
      if (!followUser) return;
    }

    if (!followUser) return;
    if (interactive) {
      const INTERACTION_GRACE_MS = 4000;
      if (
        isUserInteractingRef.current ||
        now - lastUserInteractionAtRef.current < INTERACTION_GRACE_MS
      ) {
        return;
      }
    }

    const center = map.getCenter();
    const distanceFromCenter = distanceMeters(
      { lat: center.lat, lng: center.lng },
      userLocation
    );

    const MIN_CAMERA_INTERVAL_MS = 900;
    const MIN_RECENTER_METERS = 10;
    if (now - lastCameraUpdateAtRef.current < MIN_CAMERA_INTERVAL_MS) return;
    if (distanceFromCenter < MIN_RECENTER_METERS) return;

    lastCameraUpdateAtRef.current = now;
    map.flyTo({
      center: [userLocation.lng, userLocation.lat],
      duration: 800,
      essential: true,
    });
  }, [userLocation, mapLibre, mapReady, followUser, interactive]);

  if (hasError) {
    return <MapFallback error={errorMessage} />;
  }

  return (
    <div className={`relative ${className}`} style={{ height }}>
      <div ref={mapContainerRef} className="absolute inset-0 rounded-lg overflow-hidden" />

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

      {mapReady && !userLocation && followUser && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-sm rounded-lg">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Waiting for GPS signal...
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
