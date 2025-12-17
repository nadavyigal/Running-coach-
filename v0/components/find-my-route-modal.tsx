'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Navigation, Loader2, AlertCircle, MapPin, Clock, TrendingUp } from 'lucide-react';
import { RouteMap } from '@/components/maps/RouteMap';
import type { Route } from '@/lib/db';
import { calculateDistance } from '@/lib/routeUtils';
import {
  trackFindMyRouteClicked,
  trackFindMyRouteSuccess,
  trackFindMyRouteFailed,
  trackRouteSelected,
} from '@/lib/analytics';
import { getLocation } from '@/lib/location-service';

interface FindMyRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRouteSelected: (route: Route) => void;
  userExperience: 'beginner' | 'intermediate' | 'advanced';
  allRoutes: Route[];
}

interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

type LocationStatus = 'idle' | 'loading' | 'success' | 'denied' | 'unavailable';

export function FindMyRouteModal({
  isOpen,
  onClose,
  onRouteSelected,
  userExperience,
  allRoutes,
}: FindMyRouteModalProps) {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [topRoutes, setTopRoutes] = useState<Route[]>([]);

  // Request GPS on modal open
  useEffect(() => {
    if (isOpen && locationStatus === 'idle') {
      trackFindMyRouteClicked();
      requestLocation();
    }
  }, [isOpen, locationStatus]);

  const requestLocation = async () => {
    setLocationStatus('loading');

    const result = await getLocation({ timeoutMs: 10000, enableHighAccuracy: true });

    if (result.coords) {
      const location = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
        accuracy: result.coords.accuracy,
      };
      setUserLocation(location);
      findTopRoutes(location);
    }

    if (result.status === 'granted') {
      setLocationStatus('success');
      trackFindMyRouteSuccess({ accuracy: result.coords?.accuracy || 0 });
    } else if (result.status === 'denied') {
      setLocationStatus('denied');
      trackFindMyRouteFailed({ reason: 'permission_denied' });
    } else {
      // We still attempt to show routes using cached/default coords if available
      setLocationStatus(result.coords ? 'success' : 'unavailable');
      if (!result.coords) {
        trackFindMyRouteFailed({ reason: result.error || 'location_unavailable' });
      }
    }
  };

  const findTopRoutes = (location: UserLocation) => {
    const nearby = allRoutes
      .filter((route) => route.startLat && route.startLng)
      .map((route) => {
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          route.startLat!,
          route.startLng!
        );

        let matchScore = 50; // base

        // Experience match (30 points)
        if (route.difficulty === userExperience) {
          matchScore += 30;
        } else if (
          (userExperience === 'intermediate' && route.difficulty !== 'advanced') ||
          (userExperience === 'advanced' && route.difficulty !== 'beginner')
        ) {
          matchScore += 15;
        }

        // Safety bonus (10 points)
        matchScore += (route.safetyScore / 100) * 10;

        // Popularity bonus (10 points)
        matchScore += (route.popularity / 100) * 10;

        // Proximity bonus (20 points, scaled down by distance)
        const proximityBonus = Math.max(0, 20 - distance * 2);
        matchScore += proximityBonus;

        return {
          ...route,
          distanceFromUser: distance,
          matchScore,
        };
      })
      .filter((route) => route.distanceFromUser !== undefined && route.distanceFromUser <= 5)
      .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
      .slice(0, 3);

    setTopRoutes(nearby);
  };

  const handleRouteSelect = (route: Route) => {
    trackRouteSelected({
      route_id: route.id,
      route_name: route.name,
      distance_km: route.distance,
      difficulty: route.difficulty,
      match_score: route.matchScore,
      distance_from_user_km: route.distanceFromUser,
      selection_method: 'find_my_route',
      user_experience: userExperience,
    });

    onRouteSelected(route);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Find My Route
          </DialogTitle>
        </DialogHeader>

        {locationStatus === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
            <p className="text-lg font-medium">Getting your location...</p>
            <p className="text-sm text-gray-600 mt-2">This helps us find routes near you</p>
          </div>
        )}

        {locationStatus === 'denied' && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-amber-100 p-4 mb-4">
              <AlertCircle className="h-12 w-12 text-amber-600" />
            </div>
            <p className="text-lg font-medium mb-2">Location Access Denied</p>
            <p className="text-sm text-gray-600 text-center max-w-md mb-4">
              We need your location to find routes near you. Please enable location access in your
              browser settings and try again.
            </p>
            <div className="flex gap-2">
              <Button onClick={requestLocation} variant="default">
                Try Again
              </Button>
              <Button onClick={onClose} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {locationStatus === 'unavailable' && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-gray-100 p-4 mb-4">
              <AlertCircle className="h-12 w-12 text-gray-600" />
            </div>
            <p className="text-lg font-medium mb-2">Location Unavailable</p>
            <p className="text-sm text-gray-600 text-center max-w-md mb-4">
              Unable to get your location. Please check your browser settings or try using HTTPS.
            </p>
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        )}

        {locationStatus === 'success' && userLocation && (
          <div className="space-y-4">
            <RouteMap
              routes={topRoutes as any}
              userLocation={{ lat: userLocation.latitude, lng: userLocation.longitude }}
              onRouteClick={(route) => route && handleRouteSelect(route as Route)}
              height="400px"
              className="rounded-lg border"
            />

            {topRoutes.length > 0 ? (
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Top Routes Near You</h3>
                {topRoutes.map((route, index) => (
                  <Card
                    key={route.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleRouteSelect(route)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary">#{index + 1}</Badge>
                            <h4 className="font-semibold">{route.name}</h4>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{route.description}</p>

                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4 text-blue-500" />
                              <span>{route.distanceFromUser?.toFixed(1)} km away</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Navigation className="h-4 w-4 text-gray-500" />
                              <span>{route.distance} km</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-gray-500" />
                              <span>{route.estimatedTime} min</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-4 w-4 text-gray-500" />
                              <span className="capitalize">{route.difficulty}</span>
                            </div>
                          </div>
                        </div>

                        <div className="ml-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {Math.round(route.matchScore || 0)}
                            </div>
                            <div className="text-xs text-gray-600">Match</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600">No routes found within 5km of your location.</p>
                <Button onClick={onClose} variant="outline" className="mt-4">
                  Browse All Routes
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
