/**
 * Route and Location Models
 *
 * Running routes, recommendations, and user preferences.
 */

export interface Route {
  id?: number;
  name: string;
  distance: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  safetyScore: number;
  popularity: number;
  elevationGain: number;
  surfaceType: string[];
  wellLit: boolean;
  lowTraffic: boolean;
  scenicScore: number;
  estimatedTime: number;
  description: string;
  tags: string[];
  gpsPath?: string;
  location?: string;
  startLat?: number;
  startLng?: number;
  endLat?: number;
  endLng?: number;
  routeType?: 'predefined' | 'custom';
  createdBy?: 'system' | 'user';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RouteRecommendation {
  id?: number;
  userId: number;
  routeId: number;
  matchScore: number;
  reasoning: string;
  userPreferences: string;
  userExperience: string;
  selected: boolean;
  createdAt: Date;
}

export interface UserRoutePreferences {
  id?: number;
  userId: number;
  maxDistance: number;
  preferredDifficulty: 'beginner' | 'intermediate' | 'advanced';
  safetyImportance: number;
  scenicImportance: number;
  trafficPreference: 'low' | 'medium' | 'high';
  lightingPreference: 'day' | 'night' | 'any';
  createdAt: Date;
  updatedAt: Date;
}
