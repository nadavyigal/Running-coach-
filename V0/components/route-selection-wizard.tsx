'use client';

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, TrendingUp, Star, Clock, RouteIcon, Shield, Users, Mountain, Zap, Eye } from "lucide-react";
import { trackRouteSelected } from "@/lib/analytics";

interface RouteSelectionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  userExperience: 'beginner' | 'intermediate' | 'advanced';
  onRouteSelected: (route: Route) => void;
}

interface Route {
  id: string;
  name: string;
  distance: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  safetyScore: number; // 0-100
  popularity: number; // 0-100
  elevationGain: number;
  surfaceType: string[];
  wellLit: boolean;
  lowTraffic: boolean;
  scenicScore: number; // 0-100
  estimatedTime: number; // minutes
  description: string;
  tags: string[];
  matchScore?: number; // How well it matches user preferences
}

interface UserPreferences {
  maxDistance: number;
  preferredDifficulty: 'beginner' | 'intermediate' | 'advanced';
  safetyImportance: number; // 0-100
  scenicImportance: number; // 0-100
  trafficPreference: 'low' | 'medium' | 'high';
  lightingPreference: 'day' | 'night' | 'any';
}

const sampleRoutes: Route[] = [
  {
    id: "1",
    name: "Park Loop",
    distance: 3.2,
    difficulty: "beginner",
    safetyScore: 95,
    popularity: 85,
    elevationGain: 5,
    surfaceType: ["paved", "gravel"],
    wellLit: true,
    lowTraffic: true,
    scenicScore: 80,
    estimatedTime: 20,
    description: "Flat, scenic loop through the city park with excellent safety",
    tags: ["Popular", "Safe", "Well-lit", "Low traffic"],
  },
  {
    id: "2",
    name: "Riverside Trail",
    distance: 4.1,
    difficulty: "beginner",
    safetyScore: 88,
    popularity: 92,
    elevationGain: 12,
    surfaceType: ["paved", "dirt"],
    wellLit: false,
    lowTraffic: true,
    scenicScore: 95,
    estimatedTime: 25,
    description: "Beautiful trail along the river with great views",
    tags: ["Scenic", "Nature", "Peaceful", "Popular"],
  },
  {
    id: "3",
    name: "Hill Challenge",
    distance: 2.8,
    difficulty: "advanced",
    safetyScore: 75,
    popularity: 65,
    elevationGain: 145,
    surfaceType: ["paved", "asphalt"],
    wellLit: true,
    lowTraffic: false,
    scenicScore: 70,
    estimatedTime: 22,
    description: "Challenging hill workout for strength building",
    tags: ["Hills", "Workout", "Challenging", "Training"],
  },
  {
    id: "4",
    name: "Downtown Circuit",
    distance: 5.0,
    difficulty: "intermediate",
    safetyScore: 82,
    popularity: 78,
    elevationGain: 25,
    surfaceType: ["paved", "concrete"],
    wellLit: true,
    lowTraffic: false,
    scenicScore: 60,
    estimatedTime: 30,
    description: "Urban route through the city center",
    tags: ["Urban", "Busy", "Varied", "City"],
  },
  {
    id: "5",
    name: "Forest Path",
    distance: 6.5,
    difficulty: "intermediate",
    safetyScore: 70,
    popularity: 55,
    elevationGain: 85,
    surfaceType: ["dirt", "gravel"],
    wellLit: false,
    lowTraffic: true,
    scenicScore: 90,
    estimatedTime: 40,
    description: "Peaceful forest trail with moderate elevation",
    tags: ["Nature", "Forest", "Peaceful", "Moderate"],
  },
  {
    id: "6",
    name: "Lake Loop",
    distance: 2.1,
    difficulty: "beginner",
    safetyScore: 90,
    popularity: 88,
    elevationGain: 8,
    surfaceType: ["paved"],
    wellLit: true,
    lowTraffic: true,
    scenicScore: 85,
    estimatedTime: 15,
    description: "Easy loop around the lake with beautiful views",
    tags: ["Easy", "Scenic", "Safe", "Popular"],
  },
];

export function RouteSelectionWizard({ 
  isOpen, 
  onClose, 
  userExperience, 
  onRouteSelected 
}: RouteSelectionWizardProps) {
  const [step, setStep] = useState<'preferences' | 'recommendations' | 'selection'>('preferences');
  const [preferences, setPreferences] = useState<UserPreferences>({
    maxDistance: 5,
    preferredDifficulty: userExperience,
    safetyImportance: 80,
    scenicImportance: 60,
    trafficPreference: 'low',
    lightingPreference: 'any',
  });
  const [recommendedRoutes, setRecommendedRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);

  // Calculate route recommendations based on preferences
  useEffect(() => {
    if (step === 'recommendations') {
      const recommendations = calculateRouteRecommendations(preferences, userExperience);
      setRecommendedRoutes(recommendations);
    }
  }, [preferences, userExperience, step]);

  const calculateRouteRecommendations = (
    prefs: UserPreferences, 
    experience: string
  ): Route[] => {
    return sampleRoutes
      .filter(route => {
        // Filter by distance
        if (route.distance > prefs.maxDistance) return false;
        
        // Filter by difficulty preference
        if (prefs.preferredDifficulty !== 'any' && route.difficulty !== prefs.preferredDifficulty) {
          // Allow some flexibility based on experience
          if (experience === 'beginner' && route.difficulty !== 'beginner') return false;
          if (experience === 'advanced' && route.difficulty === 'beginner') return false;
        }
        
        // Filter by traffic preference
        if (prefs.trafficPreference === 'low' && !route.lowTraffic) return false;
        
        // Filter by lighting preference
        if (prefs.lightingPreference === 'night' && !route.wellLit) return false;
        
        return true;
      })
      .map(route => ({
        ...route,
        matchScore: calculateMatchScore(route, prefs, experience)
      }))
      .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
      .slice(0, 6); // Top 6 recommendations
  };

  const calculateMatchScore = (
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
  };

  const handlePreferenceChange = (key: keyof UserPreferences, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const handleRouteSelect = async (route: Route) => {
    setSelectedRoute(route);
    
    // Track route selection
    await trackRouteSelected({
      route_id: route.id,
      route_name: route.name,
      distance_km: route.distance,
      difficulty: route.difficulty,
      elevation_m: route.elevationGain,
      estimated_time_minutes: route.estimatedTime,
      safety_score: route.safetyScore,
      match_score: route.matchScore,
      user_experience: userExperience
    });
    
    onRouteSelected(route);
    onClose();
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return "bg-green-100 text-green-800";
      case "intermediate":
        return "bg-yellow-100 text-yellow-800";
      case "advanced":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getSafetyColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 75) return "text-yellow-600";
    return "text-red-600";
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
            max={10}
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
            <SelectItem value="night">Night runs only</SelectItem>
            <SelectItem value="any">Any time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button 
        onClick={() => setStep('recommendations')} 
        className="w-full"
      >
        Find My Routes
      </Button>
    </div>
  );

  const renderRecommendationsStep = () => (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Recommended Routes</h3>
        <p className="text-sm text-gray-600">
          Based on your preferences and experience level
        </p>
      </div>

      {recommendedRoutes.map((route) => (
        <Card
          key={route.id}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleRouteSelect(route)}
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

              {/* Tags and Difficulty */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {route.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <Badge className={getDifficultyColor(route.difficulty)}>
                  {route.difficulty}
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
      ))}

      <Button 
        onClick={() => setStep('preferences')} 
        variant="outline" 
        className="w-full"
      >
        Adjust Preferences
      </Button>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
  );
}