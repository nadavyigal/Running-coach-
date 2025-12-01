'use client';

/**
 * MapFallback Component
 * Displays when map fails to load, showing list view alternative
 */

import { MapPin, RefreshCw, Navigation } from 'lucide-react';
import type { Route } from '@/lib/db';
import type { LatLng } from '@/lib/mapConfig';
import { Button } from '@/components/ui/button';
import { calculateDistance } from '@/lib/routeUtils';

export interface MapFallbackProps {
  /** Error message to display */
  error?: string;
  /** Retry callback */
  onRetry?: () => void;
  /** Routes to show in list view */
  routes?: Route[];
  /** User location for distance calculations */
  userLocation?: LatLng | null;
  /** Route click handler */
  onRouteClick?: (route: Route) => void;
}

/**
 * MapFallback - Graceful degradation when map unavailable
 */
export function MapFallback({
  error = 'Map unavailable',
  onRetry,
  routes = [],
  userLocation,
  onRouteClick,
}: MapFallbackProps) {
  return (
    <div className="w-full h-full min-h-[300px] bg-slate-50 dark:bg-slate-900 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center p-6">
      {/* Error state */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-800 mb-4">
          <MapPin className="w-8 h-8 text-slate-500 dark:text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          Map View Unavailable
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          {error}
        </p>

        {/* Retry button */}
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Map
          </Button>
        )}
      </div>

      {/* List view alternative */}
      {routes.length > 0 && (
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                Available Routes ({routes.length})
              </h4>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {routes.map((route, index) => {
                const distanceFromUser =
                  userLocation && route.startLat && route.startLng
                    ? calculateDistance(
                        userLocation.lat,
                        userLocation.lng,
                        route.startLat,
                        route.startLng
                      )
                    : null;

                return (
                  <div
                    key={route.id || index}
                    onClick={() => onRouteClick?.(route)}
                    className={`px-4 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0 ${
                      onRouteClick
                        ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-sm text-slate-900 dark:text-white truncate">
                          {route.name}
                        </h5>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            {route.distance.toFixed(1)} km
                          </span>
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            •
                          </span>
                          <span className="text-xs text-slate-600 dark:text-slate-400 capitalize">
                            {route.difficulty}
                          </span>
                          {distanceFromUser !== null && (
                            <>
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                •
                              </span>
                              <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                <Navigation className="w-3 h-3" />
                                {distanceFromUser.toFixed(1)} km away
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {route.routeType === 'custom' && (
                        <span className="flex-shrink-0 px-2 py-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded">
                          Custom
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="mt-6 text-center">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Map requires an active internet connection and supported browser.
        </p>
      </div>
    </div>
  );
}
