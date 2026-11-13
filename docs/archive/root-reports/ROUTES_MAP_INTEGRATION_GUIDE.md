# Routes with Maps - Integration Guide

**Project:** Running Coach PWA
**Feature:** Interactive Maps for Route Selection
**Status:** Foundation Complete (Testing ✅) → Integration In Progress
**Last Updated:** 2025-11-27

---

## Table of Contents

1. [Overview](#overview)
2. [What's Already Done](#whats-already-done)
3. [Environment Setup](#environment-setup)
4. [Integration Tasks](#integration-tasks)
5. [Testing Guidelines](#testing-guidelines)
6. [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers integrating the map infrastructure (already built and tested) into the existing route selection UI components. The foundation is complete with 74 passing tests covering map rendering, route utilities, and core functionality.

**Tech Stack:**
- MapLibre GL JS (open-source map rendering)
- Next.js 14 (React framework)
- TypeScript
- Dexie (IndexedDB wrapper)
- Vitest + React Testing Library

---

## What's Already Done

### ✅ Completed Infrastructure

**Core Files Created:**
- `V0/lib/mapConfig.ts` - Map configuration (tiles, colors, bounds, limits)
- `V0/lib/routeUtils.ts` - GPS calculations and path processing (15+ utilities)
- `V0/lib/mapLibreMock.ts` - Test mocks for MapLibre
- `V0/lib/seedRoutes.ts` - 10 demo routes with realistic GPS paths
- `V0/components/maps/RouteMap.tsx` - Main map component
- `V0/components/maps/MapFallback.tsx` - Graceful degradation UI

**Database Changes:**
- Schema upgraded to v3
- Route interface extended with: `startLat`, `startLng`, `endLat`, `endLng`, `routeType`, `createdBy`
- Migration added for existing routes

**Testing:**
- `V0/lib/routeUtils.test.ts` - 46 tests passing ✅
- `V0/components/maps/RouteMap.test.tsx` - 28 tests passing ✅
- `V0/vitest.setup.ts` - MapLibre mocks configured
- Production build verified ✅

**Analytics Events Added:**
```typescript
trackMapLoaded()
trackMapLoadFailed()
trackFindMyRouteClicked()
trackFindMyRouteSuccess()
trackFindMyRouteFailed()
trackCustomRouteSaved()
trackCustomRouteSelected()
trackNearbyFilterChanged()
trackRouteWizardMapToggled()
trackRouteSelectedFromMap()
```

---

## Environment Setup

### 1. Install Dependencies (Already Done)

```bash
cd V0
npm install maplibre-gl  # Already installed
```

### 2. Configure Map Tiles

**Create `.env.local`** (if not exists):

```env
# MapTiler Configuration (free tier: 100k requests/month)
# Sign up at https://www.maptiler.com/cloud/
NEXT_PUBLIC_MAP_TILE_URL=https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key={token}
NEXT_PUBLIC_MAP_TILE_URL_DARK=https://api.maptiler.com/maps/streets-v2-dark/{z}/{x}/{y}.png?key={token}
NEXT_PUBLIC_MAP_TILE_TOKEN=your_maptiler_api_key_here

# Fallback: OpenStreetMap tiles (no key required, used automatically if MapTiler fails)
```

**Create `.env.example`:**

```env
# Map Tile Configuration
# Get your free API key from https://www.maptiler.com/cloud/
NEXT_PUBLIC_MAP_TILE_URL=https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key={token}
NEXT_PUBLIC_MAP_TILE_URL_DARK=https://api.maptiler.com/maps/streets-v2-dark/{z}/{x}/{y}.png?key={token}
NEXT_PUBLIC_MAP_TILE_TOKEN=

# The app will automatically fall back to OpenStreetMap tiles if MapTiler is unavailable
```

### 3. Seed Demo Routes (First Run)

Add to your app initialization or onboarding flow:

```typescript
import { seedDemoRoutes } from '@/lib/seedRoutes';

// Call once on first app load or during onboarding
await seedDemoRoutes();
```

---

## Integration Tasks

### Task 1: Add Map View Toggle to RouteSelectionWizard (DONE)

**File:** `V0/components/route-selection-wizard.tsx`

**Location:** In the `renderRecommendationsStep()` function (starts at line 510)

#### Step 1.1: Add Import

At the top of the file, add:

```typescript
import { RouteMap } from '@/components/maps/RouteMap';
import { Map, List } from 'lucide-react'; // Add these icons
import { trackRouteWizardMapToggled, trackRouteSelectedFromMap } from '@/lib/analytics';
```

#### Step 1.2: Add View Mode State

After the existing `useState` declarations (around line 196), add:

```typescript
const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
```

#### Step 1.3: Update Route Selection Handler

Modify `handleRouteSelect` to track selection method:

```typescript
const handleRouteSelect = (route: Route) => {
  setSelectedRoute(route);

  // Track analytics with selection method
  trackRouteSelected({
    route_id: route.id,
    route_name: route.name,
    distance_km: route.distance,
    difficulty: route.difficulty,
    elevation_m: route.elevationGain,
    estimated_time_minutes: route.estimatedTime,
    safety_score: route.safetyScore,
    match_score: route.matchScore,
    distance_from_user_km: route.distanceFromUser,
    user_location_available: !!userLocation,
    user_experience: userExperience,
    selection_method: viewMode, // 'map' or 'list'
  });

  if (viewMode === 'map') {
    trackRouteSelectedFromMap({
      route_id: route.id,
      route_name: route.name,
    });
  }

  onRouteSelected(route);
  onClose();
};
```

#### Step 1.4: Add View Toggle Button

Replace the header section (lines 512-517) with:

```typescript
<div className="space-y-4">
  {/* Header with View Toggle */}
  <div className="flex items-center justify-between">
    <div className="text-center flex-1">
      <h3 className="text-lg font-semibold mb-1">Recommended Routes</h3>
      <p className="text-sm text-gray-600">
        Based on your preferences and experience level
      </p>
    </div>

    {/* View Mode Toggle */}
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      <Button
        variant={viewMode === 'list' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => {
          setViewMode('list');
          trackRouteWizardMapToggled({ view: 'list' });
        }}
        className="gap-1"
      >
        <List className="h-4 w-4" />
        <span className="hidden sm:inline">List</span>
      </Button>
      <Button
        variant={viewMode === 'map' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => {
          setViewMode('map');
          trackRouteWizardMapToggled({ view: 'map' });
        }}
        className="gap-1"
      >
        <Map className="h-4 w-4" />
        <span className="hidden sm:inline">Map</span>
      </Button>
    </div>
  </div>
```

#### Step 1.5: Add Conditional Rendering

After the location status div (line 544), replace the route cards with:

```typescript
  {/* Location Status */}
  <div className="mb-2">
    {/* ... existing location status code ... */}
  </div>

  {/* Map or List View */}
  {viewMode === 'map' ? (
    // Map View
    <div className="space-y-4">
      <RouteMap
        routes={recommendedRoutes}
        userLocation={userLocation ? {
          lat: userLocation.latitude,
          lng: userLocation.longitude
        } : undefined}
        onRouteClick={handleRouteSelect}
        selectedRouteId={_selectedRoute?.id}
        height="500px"
        className="rounded-lg border"
      />

      {/* Route count below map */}
      <p className="text-sm text-center text-gray-600">
        Showing {recommendedRoutes.length} routes
        {userLocation && ' sorted by distance from you'}
      </p>
    </div>
  ) : (
    // List View (existing route cards)
    <>
      {recommendedRoutes.map((route) => (
        <Card
          key={route.id}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleRouteSelect(route)}
        >
          {/* ... existing card content ... */}
        </Card>
      ))}
    </>
  )}
</div>
```

**Expected Result:**
- Users can toggle between list and map views
- Map shows all recommended routes with markers
- Clicking a marker selects the route
- Analytics tracks view preference and selection method

---

### Task 2: Add Map & Radius Filter to RouteSelectorModal (DONE)

**File:** `V0/components/route-selector-modal.tsx`

#### Step 2.1: Add Imports

```typescript
import { RouteMap } from '@/components/maps/RouteMap';
import { Radius } from 'lucide-react'; // Add this icon
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trackNearbyFilterChanged } from '@/lib/analytics';
import { calculateDistance } from '@/lib/routeUtils';
```

#### Step 2.2: Add Radius Filter State

After existing `useState` declarations:

```typescript
const [radiusKm, setRadiusKm] = useState<number>(5); // Default 5km
```

#### Step 2.3: Update Route Filtering Logic

Modify the `nearbyRoutes` calculation to use the selected radius:

```typescript
const nearbyRoutes = useMemo(() => {
  if (!userLocation) return routes;

  return routes
    .map(route => {
      if (!route.startLat || !route.startLng) return null;

      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        route.startLat,
        route.startLng
      );

      return { ...route, distanceFromUser: distance };
    })
    .filter(route => route && route.distanceFromUser! <= radiusKm) // Use radiusKm
    .sort((a, b) => a!.distanceFromUser! - b!.distanceFromUser!) as Route[];
}, [routes, userLocation, radiusKm]); // Add radiusKm dependency
```

#### Step 2.4: Add Radius Filter UI

Before the route list, add:

```typescript
<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
  <DialogHeader>
    <DialogTitle>Select a Route</DialogTitle>
  </DialogHeader>

  {/* Radius Filter */}
  <div className="flex items-center gap-3 mb-4">
    <Radius className="h-5 w-5 text-gray-500" />
    <label className="text-sm font-medium">Nearby Routes:</label>
    <Select
      value={radiusKm.toString()}
      onValueChange={(value) => {
        const newRadius = parseInt(value);
        setRadiusKm(newRadius);
        trackNearbyFilterChanged({ radius_km: newRadius });
      }}
    >
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="1">Within 1 km</SelectItem>
        <SelectItem value="2">Within 2 km</SelectItem>
        <SelectItem value="5">Within 5 km</SelectItem>
        <SelectItem value="10">Within 10 km</SelectItem>
        <SelectItem value="25">Within 25 km</SelectItem>
      </SelectContent>
    </Select>
    <span className="text-sm text-gray-600">
      {nearbyRoutes.length} {nearbyRoutes.length === 1 ? 'route' : 'routes'}
    </span>
  </div>

  {/* Map View */}
  <RouteMap
    routes={nearbyRoutes}
    userLocation={userLocation ? {
      lat: userLocation.latitude,
      lng: userLocation.longitude
    } : undefined}
    onRouteClick={(route) => {
      onRouteSelected(route);
      onClose();
    }}
    height="350px"
    className="rounded-lg border mb-4"
  />

  {/* Existing route list below map */}
  <div className="space-y-3">
    {nearbyRoutes.map((route) => (
      {/* ... existing route cards ... */}
    ))}
  </div>
</DialogContent>
```

**Expected Result:**
- Map shows routes within selected radius
- Radius filter dynamically updates map and list
- Route count updates as radius changes
- Map and list stay in sync

---

### Task 3: Create FindMyRouteModal Component (DONE)

**File:** `V0/components/find-my-route-modal.tsx` (NEW)

#### Step 3.1: Create Component File

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Navigation, Loader2, AlertCircle, MapPin, Clock, TrendingUp } from 'lucide-react';
import { RouteMap } from '@/components/maps/RouteMap';
import type { Route } from '@/lib/db';
import type { LatLng } from '@/lib/mapConfig';
import { calculateDistance } from '@/lib/routeUtils';
import {
  trackFindMyRouteClicked,
  trackFindMyRouteSuccess,
  trackFindMyRouteFailed,
  trackRouteSelected,
} from '@/lib/analytics';

interface FindMyRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRouteSelected: (route: Route) => void;
  userExperience: 'beginner' | 'intermediate' | 'advanced';
  allRoutes: Route[]; // Pass all available routes
}

interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export function FindMyRouteModal({
  isOpen,
  onClose,
  onRouteSelected,
  userExperience,
  allRoutes,
}: FindMyRouteModalProps) {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    'idle' | 'loading' | 'success' | 'denied' | 'unavailable'
  >('idle');
  const [topRoutes, setTopRoutes] = useState<Route[]>([]);

  // Request GPS on modal open
  useEffect(() => {
    if (isOpen && locationStatus === 'idle') {
      trackFindMyRouteClicked();
      requestLocation();
    }
  }, [isOpen]);

  const requestLocation = () => {
    setLocationStatus('loading');

    // Check HTTPS requirement
    const isSecure =
      typeof window !== 'undefined' &&
      (window.location.protocol === 'https:' || window.location.hostname === 'localhost');

    if (!isSecure) {
      setLocationStatus('unavailable');
      trackFindMyRouteFailed({ reason: 'not_https' });
      return;
    }

    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      trackFindMyRouteFailed({ reason: 'geolocation_unavailable' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setUserLocation(location);
        setLocationStatus('success');
        trackFindMyRouteSuccess({ accuracy: position.coords.accuracy });

        // Find and rank nearby routes
        findTopRoutes(location);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationStatus('denied');
          trackFindMyRouteFailed({ reason: 'permission_denied' });
        } else {
          setLocationStatus('unavailable');
          trackFindMyRouteFailed({ reason: error.message });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const findTopRoutes = (location: UserLocation) => {
    // Find routes within 5km
    const nearbyRoutes = allRoutes
      .filter(route => route.startLat && route.startLng)
      .map(route => {
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          route.startLat!,
          route.startLng!
        );

        // Calculate match score with proximity bonus
        let matchScore = 50; // Base score

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

        // Proximity bonus (20 points - more for closer routes)
        const proximityBonus = Math.max(0, 20 - (distance * 2));
        matchScore += proximityBonus;

        return {
          ...route,
          distanceFromUser: distance,
          matchScore,
        };
      })
      .filter(route => route.distanceFromUser <= 5) // 5km radius
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3); // Top 3

    setTopRoutes(nearbyRoutes);
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

        {/* Loading State */}
        {locationStatus === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
            <p className="text-lg font-medium">Getting your location...</p>
            <p className="text-sm text-gray-600 mt-2">
              This helps us find routes near you
            </p>
          </div>
        )}

        {/* Permission Denied */}
        {locationStatus === 'denied' && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-amber-100 p-4 mb-4">
              <AlertCircle className="h-12 w-12 text-amber-600" />
            </div>
            <p className="text-lg font-medium mb-2">Location Access Denied</p>
            <p className="text-sm text-gray-600 text-center max-w-md mb-4">
              We need your location to find routes near you. Please enable location
              access in your browser settings and try again.
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

        {/* Location Unavailable */}
        {locationStatus === 'unavailable' && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-gray-100 p-4 mb-4">
              <AlertCircle className="h-12 w-12 text-gray-600" />
            </div>
            <p className="text-lg font-medium mb-2">Location Unavailable</p>
            <p className="text-sm text-gray-600 text-center max-w-md mb-4">
              Unable to get your location. Please check your browser settings or try
              using HTTPS.
            </p>
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        )}

        {/* Success - Show Routes */}
        {locationStatus === 'success' && userLocation && (
          <div className="space-y-4">
            {/* Map with top 3 routes */}
            <RouteMap
              routes={topRoutes}
              userLocation={{
                lat: userLocation.latitude,
                lng: userLocation.longitude,
              }}
              onRouteClick={handleRouteSelect}
              height="400px"
              className="rounded-lg border"
            />

            {/* Route Cards */}
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
                          <p className="text-sm text-gray-600 mb-2">
                            {route.description}
                          </p>

                          {/* Stats */}
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

                        {/* Match Score */}
                        <div className="ml-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {Math.round(route.matchScore!)}
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
```

#### Step 3.2: Add to RecordScreen or Relevant Parent Component

```typescript
import { FindMyRouteModal } from '@/components/find-my-route-modal';

// In component:
const [findMyRouteOpen, setFindMyRouteOpen] = useState(false);

// Add button to trigger:
<Button onClick={() => setFindMyRouteOpen(true)}>
  <Navigation className="h-4 w-4 mr-2" />
  Find My Route
</Button>

// Add modal:
<FindMyRouteModal
  isOpen={findMyRouteOpen}
  onClose={() => setFindMyRouteOpen(false)}
  onRouteSelected={handleRouteSelected}
  userExperience={userExperience}
  allRoutes={allRoutes}
/>
```

**Expected Result:**
- Button opens modal and requests GPS permission
- Shows loading state while getting location
- Displays top 3 routes on map with numbered markers
- Shows match scores based on proximity + preferences
- Handles GPS denied/unavailable gracefully

---

### Task 4: Create CustomRouteCreator Component (DONE)

**File:** `V0/components/custom-route-creator.tsx` (NEW)

This is the most complex component. Due to length, here's the structure:

#### Component Structure

```typescript
'use client';

import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RouteMap } from '@/components/maps/RouteMap';
import type { LatLng } from '@/lib/mapConfig';
import { calculateWaypointDistance, stringifyGpsPath } from '@/lib/routeUtils';
import { db, type Route } from '@/lib/db';
import { trackCustomRouteSaved } from '@/lib/analytics';
import { useToast } from '@/components/ui/use-toast';
import { MapPin, Trash2, Save } from 'lucide-react';

interface CustomRouteCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onRouteSaved: (route: Route) => void;
}

export function CustomRouteCreator({
  isOpen,
  onClose,
  onRouteSaved,
}: CustomRouteCreatorProps) {
  // State
  const [waypoints, setWaypoints] = useState<LatLng[]>([]);
  const [routeName, setRouteName] = useState('');
  const [notes, setNotes] = useState('');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [surfaceType, setSurfaceType] = useState<string[]>(['paved']);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Calculate distance
  const distance = waypoints.length >= 2
    ? calculateWaypointDistance(waypoints)
    : 0;

  // Handle map click to add waypoint
  const handleMapClick = useCallback((lngLat: { lng: number; lat: number }) => {
    if (waypoints.length >= 20) {
      toast({
        title: 'Maximum Waypoints Reached',
        description: 'You can add up to 20 waypoints per route.',
        variant: 'destructive',
      });
      return;
    }

    setWaypoints(prev => [...prev, { lat: lngLat.lat, lng: lngLat.lng }]);
  }, [waypoints.length, toast]);

  // Clear waypoints
  const clearWaypoints = () => {
    setWaypoints([]);
  };

  // Save route
  const handleSave = async () => {
    if (!routeName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a name for your route.',
        variant: 'destructive',
      });
      return;
    }

    if (waypoints.length < 2) {
      toast({
        title: 'Add Waypoints',
        description: 'Please add at least a start and end point.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      const newRoute: Omit<Route, 'id'> = {
        name: routeName,
        distance: distance,
        difficulty,
        safetyScore: 50, // Default
        popularity: 0,
        elevationGain: 0, // Could calculate if elevation data available
        surfaceType,
        wellLit: false, // User could specify
        lowTraffic: false,
        scenicScore: 50,
        estimatedTime: Math.round(distance * 6), // 6 min/km pace
        description: notes || `Custom ${distance.toFixed(1)}km route`,
        tags: ['custom'],
        gpsPath: stringifyGpsPath(waypoints),
        location: 'Custom Route',
        startLat: waypoints[0].lat,
        startLng: waypoints[0].lng,
        endLat: waypoints[waypoints.length - 1].lat,
        endLng: waypoints[waypoints.length - 1].lng,
        routeType: 'custom',
        createdBy: 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const routeId = await db.routes.add(newRoute);

      const savedRoute = { ...newRoute, id: routeId };

      trackCustomRouteSaved({
        route_id: routeId,
        waypoint_count: waypoints.length,
        distance_km: distance,
        difficulty,
      });

      toast({
        title: 'Route Saved!',
        description: `"${routeName}" has been added to your routes.`,
      });

      onRouteSaved(savedRoute);
      onClose();

      // Reset form
      setWaypoints([]);
      setRouteName('');
      setNotes('');
      setDifficulty('beginner');
      setSurfaceType(['paved']);
    } catch (error) {
      console.error('Error saving custom route:', error);
      toast({
        title: 'Save Failed',
        description: 'Unable to save route. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Custom Route</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
          {/* Map - 60% on desktop */}
          <div className="flex-1 lg:w-3/5">
            <div className="h-full min-h-[400px] rounded-lg border">
              {/* TODO: Add clickable map here */}
              {/* This requires extending RouteMap to handle click events */}
              <div className="h-full bg-gray-100 flex items-center justify-center">
                <p className="text-gray-500">
                  Map integration: Add click handler to RouteMap component
                </p>
              </div>
            </div>
          </div>

          {/* Form - 40% on desktop */}
          <div className="lg:w-2/5 space-y-4 overflow-y-auto">
            {/* Route Name */}
            <div>
              <label className="text-sm font-medium">Route Name *</label>
              <Input
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="My Morning Run"
                className="mt-1"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this route..."
                className="mt-1"
                rows={3}
              />
            </div>

            {/* Difficulty */}
            <div>
              <label className="text-sm font-medium">Difficulty</label>
              <Select value={difficulty} onValueChange={(value: any) => setDifficulty(value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Waypoints Info */}
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Waypoints</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearWaypoints}
                  disabled={waypoints.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Count:</span>
                  <span className="font-medium">{waypoints.length} / 20</span>
                </div>
                <div className="flex justify-between">
                  <span>Distance:</span>
                  <span className="font-medium">
                    {distance > 0 ? `${distance.toFixed(2)} km` : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Est. Time:</span>
                  <span className="font-medium">
                    {distance > 0 ? `${Math.round(distance * 6)} min` : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-gray-50 p-3 rounded-lg text-sm">
              <p className="font-medium mb-1">How to create:</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-600">
                <li>Click on the map to add waypoints</li>
                <li>Add at least a start and end point</li>
                <li>Fill in the route details</li>
                <li>Click Save to create your route</li>
              </ol>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaving || waypoints.length < 2 || !routeName.trim()}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Route'}
              </Button>
              <Button onClick={onClose} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**NOTE:** This component requires extending the RouteMap to handle click events. Add this prop to RouteMap:

```typescript
// In RouteMap.tsx props:
onMapClick?: (lngLat: { lng: number; lat: number }) => void;

// In the map initialization:
if (onMapClick) {
  map.on('click', (e: any) => {
    onMapClick({ lng: e.lngLat.lng, lat: e.lngLat.lat });
  });
}
```

---

## Testing Guidelines

### Unit Tests

Each new component should have corresponding tests:

**Test File Structure:**
```
V0/components/find-my-route-modal.test.tsx
V0/components/custom-route-creator.test.tsx
```

**Test Coverage:**
- Component rendering
- User interactions (buttons, inputs)
- GPS permission flows
- Route selection
- Analytics tracking
- Error states
- Edge cases

**Example Test Pattern:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FindMyRouteModal } from './find-my-route-modal';

vi.mock('@/lib/analytics');

describe('FindMyRouteModal', () => {
  const mockRoutes = [/* ... */];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should request GPS on open', () => {
    const mockGetCurrentPosition = vi.fn();
    global.navigator.geolocation = {
      getCurrentPosition: mockGetCurrentPosition,
    } as any;

    render(
      <FindMyRouteModal
        isOpen={true}
        onClose={vi.fn()}
        onRouteSelected={vi.fn()}
        userExperience="beginner"
        allRoutes={mockRoutes}
      />
    );

    expect(mockGetCurrentPosition).toHaveBeenCalled();
  });

  // Add more tests...
});
```

### Integration Tests

Test the complete user flows:

1. **Find My Route Flow:**
   - Open modal → Grant GPS → See routes → Select route

2. **Custom Route Creation:**
   - Open creator → Click map → Add waypoints → Fill form → Save

3. **Route Selection with Map:**
   - Toggle to map view → Click marker → Route selected

### Manual Testing Checklist

Before marking as complete, manually test:

- [ ] Map tiles load (both light and dark themes)
- [ ] GPS permission prompts work
- [ ] Map markers are clickable
- [ ] Route selection updates correctly
- [ ] Custom routes save to database
- [ ] Map view toggles work smoothly
- [ ] Radius filter updates map dynamically
- [ ] Analytics events fire correctly
- [ ] Error states display properly
- [ ] Mobile responsive design works
- [ ] Offline fallback behavior
- [ ] Performance (no lag when rendering 10+ routes)

---

## Troubleshooting

### Map Not Loading

**Symptom:** Blank map or "Map unavailable" message

**Solutions:**
1. Check if MapTiler token is set in `.env.local`
2. Verify network tab shows tile requests (not 401/403 errors)
3. Check browser console for CORS errors
4. Ensure running on HTTPS or localhost
5. Test with OSM fallback by removing MapTiler token

### GPS Not Working

**Symptom:** "Location unavailable" or permission denied

**Solutions:**
1. Verify running on HTTPS (required for production)
2. Check browser location permissions
3. Test on different browsers
4. Use `localhost` for development (exempt from HTTPS requirement)

### Performance Issues

**Symptom:** Lag when rendering many routes

**Solutions:**
1. Implement route clustering for 20+ routes
2. Use `simplifyPath()` utility to reduce waypoint count
3. Limit visible routes based on zoom level
4. Add virtualization for route list

### TypeScript Errors

**Symptom:** Type mismatches with Route interface

**Solution:**
Ensure you're importing from the correct location:
```typescript
import type { Route } from '@/lib/db'; // Database Route type
import type { LatLng } from '@/lib/mapConfig'; // Map coordinates type
```

### Tests Failing

**Symptom:** MapLibre-related test failures

**Solution:**
Ensure `mapLibreMock.ts` is imported in test setup:
```typescript
// In component test file:
import '@/lib/mapLibreMock';
```

---

## Performance Optimization

### Code Splitting

The map components are already set up for dynamic imports:

```typescript
// In parent component:
const RouteMap = dynamic(() => import('@/components/maps/RouteMap').then(mod => ({ default: mod.RouteMap })), {
  ssr: false,
  loading: () => <div>Loading map...</div>
});
```

### Lazy Loading

Only load map when user needs it:

```typescript
const [showMap, setShowMap] = useState(false);

// Render map only when showMap is true
{showMap && <RouteMap {...props} />}
```

---

## Deployment Checklist

Before deploying to production:

- [ ] Environment variables configured (`.env.production`)
- [ ] MapTiler API key has sufficient quota
- [ ] HTTPS enabled (required for GPS)
- [ ] All tests passing
- [ ] Analytics events verified in PostHog
- [ ] Demo routes seeded in production database
- [ ] Error tracking configured (Sentry, etc.)
- [ ] Performance monitoring enabled
- [ ] Mobile testing completed
- [ ] Accessibility audit completed

---

## Additional Resources

**MapLibre Documentation:**
- https://maplibre.org/maplibre-gl-js-docs/api/

**Map Tile Providers:**
- MapTiler: https://www.maptiler.com/
- OpenStreetMap: https://www.openstreetmap.org/

**GPS/Geolocation:**
- MDN Geolocation API: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API

**Testing:**
- Vitest: https://vitest.dev/
- React Testing Library: https://testing-library.com/react

---

## Questions?

If you encounter issues not covered in this guide:

1. Check browser console for errors
2. Review the completed tests for examples
3. Refer to the existing `RouteMap` component implementation
4. Test with the demo routes first before creating custom ones

---

**Last Updated:** 2025-11-27
**Status:** Foundation Complete → Integration Guide Ready
**Next Steps:** Follow integration tasks 1-4 above
