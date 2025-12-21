'use client';

import { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RouteMap } from "@/components/maps/RouteMap";
import { MapErrorBoundary } from "@/components/maps/MapErrorBoundary";
import { CustomRouteCreator } from "@/components/custom-route-creator";
import { MapPin, TrendingUp, Star, Clock, RouteIcon, Shield, Users, Mountain, Zap, Eye, Navigation, Loader2, AlertCircle, Map, List, Plus, Check } from "lucide-react";
import { trackRouteSelected, trackRouteSelectedFromMap, trackRouteWizardMapToggled } from "@/lib/analytics";
import { db, type Route } from "@/lib/db";
import { seedDemoRoutes } from "@/lib/seedRoutes";
import { clearTelAvivDemoRoutes, shouldClearTelAvivRoutes } from "@/lib/clearDemoRoutes";
import { calculateDistance } from "@/lib/routeUtils";
import { useToast } from "@/hooks/use-toast";
import { getDifficultyColor, getDifficultyLabel, getSafetyColor, isDevelopment } from "@/lib/routeHelpers";
import { getLocation } from "@/lib/location-service";

interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface RouteSelectionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  userExperience: 'beginner' | 'intermediate' | 'advanced';
  onRouteSelected: (route: Route) => void;
}

interface UserPreferences {
  maxDistance: number;
  preferredDifficulty: 'beginner' | 'intermediate' | 'advanced' | 'any';
  safetyImportance: number; // 0-100
  scenicImportance: number; // 0-100
  trafficPreference: 'low' | 'medium' | 'high';
  lightingPreference: 'day' | 'night' | 'any';
}

// Extended Route type with match score and distance
interface RouteWithScore extends Route {
  matchScore?: number;
  distanceFromUser?: number;
}

export function RouteSelectionWizard({
  isOpen,
  onClose,
  userExperience,
  onRouteSelected
}: RouteSelectionWizardProps) {
  const { toast } = useToast();

  // Step navigation
  const [step, setStep] = useState<'preferences' | 'recommendations'>('preferences');

  // User preferences
  const [preferences, setPreferences] = useState<UserPreferences>({
    maxDistance: 10,
    preferredDifficulty: userExperience,
    safetyImportance: 80,
    scenicImportance: 60,
    trafficPreference: 'low',
    lightingPreference: 'any',
  });

  // Routes from database
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recommendedRoutes, setRecommendedRoutes] = useState<RouteWithScore[]>([]);

  // Previewed route state (for highlighting on map)
  const [previewedRouteId, setPreviewedRouteId] = useState<number | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // GPS location state
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'granted' | 'denied' | 'unavailable'>('idle');

  // Custom route creator state
  const [customRouteCreatorOpen, setCustomRouteCreatorOpen] = useState(false);

  // Request GPS location - defined as function declaration to avoid TDZ
  // Force recompile timestamp: 2025-12-14 13:32
  async function requestLocation() {
    setLocationStatus('loading');

    const result = await getLocation({ timeoutMs: 10000, enableHighAccuracy: false });

    if (result.coords) {
      setUserLocation({
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
        accuracy: result.coords.accuracy,
      });
    }

    if (result.status === 'granted') {
      setLocationStatus('granted');
    } else if (result.status === 'denied') {
      setLocationStatus('denied');
    } else {
      setLocationStatus('unavailable');
    }
  }

  // Load routes from database
  const loadRoutes = useCallback(async () => {
    try {
      setIsLoadingRoutes(true);
      setLoadError(null);

      // Check if we should clear Tel Aviv demo routes based on user location
      if (userLocation) {
        const shouldClear = await shouldClearTelAvivRoutes(
          userLocation.latitude,
          userLocation.longitude
        );

        if (shouldClear) {
          const result = await clearTelAvivDemoRoutes();
          if (result.deletedCount > 0 && isDevelopment()) {
            console.log(`Cleared ${result.deletedCount} Tel Aviv demo routes - user is not in Tel Aviv area`);
          }
        }
      }

      const count = await db.routes.count();
      if (count === 0) {
        await seedDemoRoutes(false, userLocation ? {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        } : undefined);
      }

      const routes = await db.routes.toArray();
      setAllRoutes(routes);
    } catch (error) {
      if (isDevelopment()) {
        console.error('[RouteSelectionWizard] Error loading routes:', error);
      }
      setLoadError('Failed to load routes. Please refresh the page.');
      toast({
        title: 'Error Loading Routes',
        description: 'Failed to load routes from database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingRoutes(false);
    }
  }, [toast, userLocation]);

  // Load routes when modal opens
  useEffect(() => {
    if (isOpen) {
      loadRoutes();
    }
  }, [isOpen, loadRoutes]);

  // Request GPS location when modal opens
  useEffect(() => {
    if (isOpen && locationStatus === 'idle') {
      requestLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, locationStatus]);

  // Calculate match score for a route
  const calculateMatchScore = useCallback((
    route: Route, 
    prefs: UserPreferences, 
    experience: string
  ): number => {
    let score = 0;
    
    // Safety score (weighted by user preference)
    score += (route.safetyScore / 100) * (prefs.safetyImportance / 100) * 40;
    
    // Scenic score (weighted by user preference)
    score += (route.scenicScore / 100) * (prefs.scenicImportance / 100) * 20;
    
    // Popularity score
    score += (route.popularity / 100) * 15;
    
    // Experience match
    if (route.difficulty === experience) score += 15;
    else if (experience === 'beginner' && route.difficulty === 'intermediate') score += 5;
    else if (experience === 'advanced' && route.difficulty === 'intermediate') score += 5;
    
    // Traffic preference match
    if (prefs.trafficPreference === 'low' && route.lowTraffic) score += 10;
    else if (prefs.trafficPreference === 'high' && !route.lowTraffic) score += 10;
    
    return Math.round(score);
  }, []);

  // Calculate route recommendations based on preferences and location
  useEffect(() => {
    if (step === 'recommendations' && allRoutes.length > 0) {
      const filtered = allRoutes.filter(route => {
        // Filter by distance
        if (route.distance > preferences.maxDistance) return false;
        
        // Filter by difficulty preference
        if (preferences.preferredDifficulty !== 'any' && route.difficulty !== preferences.preferredDifficulty) {
          // Allow some flexibility based on experience
          if (userExperience === 'beginner' && route.difficulty !== 'beginner') return false;
          if (userExperience === 'advanced' && route.difficulty === 'beginner') return false;
        }
        
        // Filter by traffic preference
        if (preferences.trafficPreference === 'low' && !route.lowTraffic) return false;
        
        // Filter by lighting preference
        if (preferences.lightingPreference === 'night' && !route.wellLit) return false;
        
        return true;
      });

      // Calculate match scores and distances
      const routesWithScores: RouteWithScore[] = filtered.map((route) => {
        const distanceFromUser =
          userLocation && typeof route.startLat === 'number' && typeof route.startLng === 'number'
            ? calculateDistance(userLocation.latitude, userLocation.longitude, route.startLat, route.startLng)
            : null;

        return {
          ...route,
          matchScore: calculateMatchScore(route, preferences, userExperience),
          ...(typeof distanceFromUser === 'number' ? { distanceFromUser } : {}),
        };
      });
      
      // Sort by match score first, then by distance from user
      routesWithScores.sort((a, b) => {
        const matchDiff = (b.matchScore || 0) - (a.matchScore || 0);
        if (Math.abs(matchDiff) > 5) return matchDiff;
        
        const distA = a.distanceFromUser ?? 999;
        const distB = b.distanceFromUser ?? 999;
        return distA - distB;
      });
      
      setRecommendedRoutes(routesWithScores.slice(0, 10)); // Top 10 recommendations
    }
  }, [step, allRoutes, preferences, userExperience, userLocation, calculateMatchScore]);

  // Get the previewed route object
  const previewedRoute = useMemo(() => {
    if (!previewedRouteId) return null;
    return recommendedRoutes.find(r => r.id === previewedRouteId) || null;
  }, [previewedRouteId, recommendedRoutes]);

  const handlePreferenceChange = (key: keyof UserPreferences, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const handleRoutePreview = (route: RouteWithScore) => {
    // If already previewed, select it
    if (previewedRouteId === route.id) {
      handleRouteSelect(route);
    } else {
      // Preview the route
      if (typeof route.id === 'number') {
        setPreviewedRouteId(route.id);
        return;
      }

      toast({
        title: 'Error',
        description: 'Cannot preview route without ID',
        variant: 'destructive',
      });
    }
  };

  const handleRouteSelect = async (route: RouteWithScore) => {
    if (!route.id) {
      toast({
        title: 'Error',
        description: 'Cannot select route without ID',
        variant: 'destructive',
      });
      return;
    }

    try {
      await trackRouteSelected({
        route_id: route.id.toString(),
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
        selection_method: viewMode,
      });

      if (viewMode === 'map') {
        await trackRouteSelectedFromMap({
          route_id: route.id.toString(),
          route_name: route.name,
        });
      }
    } catch (error) {
      if (isDevelopment()) {
        console.warn('Analytics tracking failed:', error);
      }
    }

    onRouteSelected(route);
    setPreviewedRouteId(null);
    onClose();
  };

  const handleMapRouteClick = (route: Route) => {
    if (route?.id) {
      const routeWithScore = recommendedRoutes.find(r => r.id === route.id);
      if (routeWithScore) {
        handleRoutePreview(routeWithScore);
      }
    }
  };

  const handleCustomRouteSaved = (route: Route) => {
    loadRoutes();
    setStep('recommendations');
    if (route.id !== undefined) {
      setPreviewedRouteId(route.id);
    }
  };


  const renderPreferencesStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Route Preferences</h3>
        <p className="text-sm text-gray-600">
          Help us find the perfect route for your run
        </p>
      </div>

      {/* Distance Preference */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Maximum Distance (km)</label>
        <div className="flex items-center gap-4">
          <Slider
            value={[preferences.maxDistance]}
            onValueChange={(value) => handlePreferenceChange('maxDistance', value[0])}
            max={15}
            min={1}
            step={0.5}
            className="flex-1"
          />
          <span className="text-sm font-medium w-12">{preferences.maxDistance} km</span>
        </div>
      </div>

      {/* Difficulty Preference */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Preferred Difficulty</label>
        <Select
          value={preferences.preferredDifficulty}
          onValueChange={(value) => handlePreferenceChange('preferredDifficulty', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any difficulty</SelectItem>
            <SelectItem value="beginner">Beginner - Easy and safe</SelectItem>
            <SelectItem value="intermediate">Intermediate - Moderate challenge</SelectItem>
            <SelectItem value="advanced">Advanced - Challenging routes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Safety Importance */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Safety Importance</label>
        <div className="flex items-center gap-4">
          <Slider
            value={[preferences.safetyImportance]}
            onValueChange={(value) => handlePreferenceChange('safetyImportance', value[0])}
            max={100}
            min={0}
            step={5}
            className="flex-1"
          />
          <span className="text-sm font-medium w-12">{preferences.safetyImportance}%</span>
        </div>
      </div>

      {/* Scenic Importance */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Scenic Views Importance</label>
        <div className="flex items-center gap-4">
          <Slider
            value={[preferences.scenicImportance]}
            onValueChange={(value) => handlePreferenceChange('scenicImportance', value[0])}
            max={100}
            min={0}
            step={5}
            className="flex-1"
          />
          <span className="text-sm font-medium w-12">{preferences.scenicImportance}%</span>
        </div>
      </div>

      {/* Traffic Preference */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Traffic Preference</label>
        <Select
          value={preferences.trafficPreference}
          onValueChange={(value) => handlePreferenceChange('trafficPreference', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low traffic - Peaceful routes</SelectItem>
            <SelectItem value="medium">Medium traffic - Balanced</SelectItem>
            <SelectItem value="high">High traffic - Urban routes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lighting Preference */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Lighting Preference</label>
        <Select
          value={preferences.lightingPreference}
          onValueChange={(value) => handlePreferenceChange('lightingPreference', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Day runs only</SelectItem>
            <SelectItem value="night">Night runs (well-lit routes)</SelectItem>
            <SelectItem value="any">Any time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button 
        onClick={() => setStep('recommendations')} 
        className="w-full"
        disabled={isLoadingRoutes}
      >
        {isLoadingRoutes ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading routes...
          </>
        ) : (
          'Find My Routes'
        )}
      </Button>
    </div>
  );

  const renderRecommendationsStep = () => (
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

      {/* Location Status */}
      <div className="mb-2">
        {locationStatus === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-2 rounded-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Getting your location...</span>
          </div>
        )}
        {locationStatus === 'granted' && userLocation && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded-lg">
            <Navigation className="h-4 w-4" />
            <span>Routes sorted by distance from you</span>
          </div>
        )}
        {locationStatus === 'denied' && (
          <div className="flex items-center justify-between text-sm text-amber-600 bg-amber-50 p-2 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>Location access denied</span>
            </div>
            <Button variant="ghost" size="sm" onClick={requestLocation} className="text-xs">
              Retry
            </Button>
          </div>
        )}
      </div>

      {/* Error State */}
      {loadError && (
        <div className="text-center py-8 text-red-500">
          <AlertCircle className="h-12 w-12 mx-auto mb-2" />
          <p>{loadError}</p>
          <Button onClick={loadRoutes} className="mt-4" variant="outline">
            Try Again
          </Button>
        </div>
      )}

      {/* Map or List View */}
      {!loadError && viewMode === 'map' ? (
        <div className="space-y-4">
          <MapErrorBoundary fallbackMessage="Route map temporarily unavailable">
            <RouteMap
              routes={recommendedRoutes}
              userLocation={userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : null}
              onRouteClick={handleMapRouteClick}
              {...(typeof previewedRouteId === 'number' ? { selectedRouteId: previewedRouteId } : {})}
              height="400px"
              className="rounded-lg border"
            />
          </MapErrorBoundary>

          {/* Previewed Route Card */}
          {previewedRoute && (
            <Card className="border-2 border-blue-500 bg-blue-50/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-blue-600" />
                      <h3 className="font-semibold text-lg">{previewedRoute.name}</h3>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{previewedRoute.description}</p>
                  </div>
                  <Badge className={getDifficultyColor(previewedRoute.difficulty)}>
                    {getDifficultyLabel(previewedRoute.difficulty)}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-4 text-sm mb-3">
                  <div className="flex items-center gap-1">
                    <RouteIcon className="h-4 w-4 text-gray-500" />
                    <span>{previewedRoute.distance} km</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span>~{previewedRoute.estimatedTime} min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="h-4 w-4 text-blue-500" />
                    <span>{previewedRoute.matchScore}% match</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleRouteSelect(previewedRoute)}
                    className="flex-1"
                  >
                    Use This Route
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setPreviewedRouteId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <p className="text-sm text-center text-gray-600">
            Showing {recommendedRoutes.length} routes
            {userLocation && ' sorted by distance from you'}
          </p>
        </div>
      ) : !loadError && (
        <div className="space-y-4">
          {recommendedRoutes.length === 0 && !isLoadingRoutes ? (
            <div className="text-center py-8 text-gray-500">
              <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No routes match your preferences</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            recommendedRoutes.map((route) => (
              <Card
                key={route.id}
                className={`cursor-pointer hover:shadow-md transition-all ${
                  previewedRouteId === route.id 
                    ? 'ring-2 ring-blue-500 bg-blue-50/30' 
                    : ''
                }`}
                onClick={() => handleRoutePreview(route)}
              >
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Route Header */}
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{route.name}</h3>
                        <p className="text-sm text-gray-600">{route.description}</p>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                        <span className="text-sm font-medium">{route.popularity}%</span>
                      </div>
                    </div>

                    {/* Route Stats */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <RouteIcon className="h-4 w-4 text-gray-500" />
                        <span>{route.distance} km</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span>~{route.estimatedTime} min</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Mountain className="h-4 w-4 text-gray-500" />
                        <span>{route.elevationGain}m gain</span>
                      </div>
                    </div>

                    {/* Safety and Match Score */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className={`h-4 w-4 ${getSafetyColor(route.safetyScore)}`} />
                        <span className="text-sm font-medium">{route.safetyScore}% safe</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">{route.matchScore}% match</span>
                      </div>
                    </div>

                    {/* Distance from user */}
                    {route.distanceFromUser !== undefined && (
                      <div className="flex items-center gap-1 text-sm text-blue-600">
                        <Navigation className="h-4 w-4" />
                        <span>
                          {route.distanceFromUser < 1 
                            ? `${Math.round(route.distanceFromUser * 1000)}m away` 
                            : `${route.distanceFromUser.toFixed(1)} km away`}
                        </span>
                      </div>
                    )}

                    {/* Tags and Difficulty */}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        {route.tags?.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <Badge className={getDifficultyColor(route.difficulty)}>
                        {getDifficultyLabel(route.difficulty)}
                      </Badge>
                    </div>

                    {/* Additional Features */}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {route.wellLit && (
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          <span>Well-lit</span>
                        </div>
                      )}
                      {route.lowTraffic && (
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>Low traffic</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        <span>{route.scenicScore}% scenic</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}

          {/* Create Custom Route */}
          <Card 
            className="border-dashed border-2 border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all"
            onClick={() => setCustomRouteCreatorOpen(true)}
          >
            <CardContent className="p-4 text-center">
              <Plus className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <h3 className="font-medium text-gray-700">Create Custom Route</h3>
              <p className="text-sm text-gray-500">Plan your own route by clicking points on the map</p>
            </CardContent>
          </Card>
        </div>
      )}

      {!loadError && (
        <Button 
        onClick={() => setStep('preferences')} 
        variant="outline" 
        className="w-full"
      >
        Adjust Preferences
      </Button>
      )}
    </div>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Route Selection Wizard
            </DialogTitle>
          </DialogHeader>

          {step === 'preferences' && renderPreferencesStep()}
          {step === 'recommendations' && renderRecommendationsStep()}
        </DialogContent>
      </Dialog>

      {/* Custom Route Creator Modal */}
      <CustomRouteCreator
        isOpen={customRouteCreatorOpen}
        onClose={() => setCustomRouteCreatorOpen(false)}
        onRouteSaved={handleCustomRouteSaved}
      />
    </>
  );
}
