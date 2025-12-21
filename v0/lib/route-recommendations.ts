// Removed unused import: User

export interface Route {
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

export interface UserPreferences {
  maxDistance: number;
  preferredDifficulty: 'beginner' | 'intermediate' | 'advanced' | 'any';
  safetyImportance: number; // 0-100
  scenicImportance: number; // 0-100
  trafficPreference: 'low' | 'medium' | 'high';
  lightingPreference: 'day' | 'night' | 'any';
}

export interface RouteRecommendation {
  routeId: string;
  name: string;
  distance: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  safetyScore: number;
  popularity: number;
  elevationGain: number;
  surfaceType: string[];
  matchScore: number; // How well it matches user preferences
  reasoning: string; // Why this route was recommended
}

// Sample route database - in a real app, this would come from a database
const routeDatabase: Route[] = [
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
  {
    id: "7",
    name: "Mountain View Trail",
    distance: 8.2,
    difficulty: "advanced",
    safetyScore: 65,
    popularity: 45,
    elevationGain: 320,
    surfaceType: ["dirt", "rock"],
    wellLit: false,
    lowTraffic: true,
    scenicScore: 98,
    estimatedTime: 55,
    description: "Challenging mountain trail with spectacular views",
    tags: ["Mountain", "Advanced", "Scenic", "Challenging"],
  },
  {
    id: "8",
    name: "Neighborhood Loop",
    distance: 1.8,
    difficulty: "beginner",
    safetyScore: 92,
    popularity: 75,
    elevationGain: 15,
    surfaceType: ["paved"],
    wellLit: true,
    lowTraffic: true,
    scenicScore: 45,
    estimatedTime: 12,
    description: "Quiet neighborhood streets perfect for beginners",
    tags: ["Beginner", "Safe", "Local", "Easy"],
  },
];

export class RouteRecommendationService {
  private cache = new Map<string, RouteRecommendation[]>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Get route recommendations based on user preferences and experience
   */
  async getRecommendations(
    preferences: UserPreferences,
    userExperience: string,
    limit: number = 6
  ): Promise<RouteRecommendation[]> {
    const cacheKey = this.generateCacheKey(preferences, userExperience);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cacheKey)) {
      return cached.slice(0, limit);
    }

    // Calculate recommendations
    const recommendations = this.calculateRecommendations(preferences, userExperience);
    
    // Cache results
    this.cache.set(cacheKey, recommendations);
    setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);
    
    return recommendations.slice(0, limit);
  }

  /**
   * Get route by ID
   */
  async getRouteById(routeId: string): Promise<Route | null> {
    return routeDatabase.find(route => route.id === routeId) || null;
  }

  /**
   * Get all routes (for admin/management purposes)
   */
  async getAllRoutes(): Promise<Route[]> {
    return [...routeDatabase];
  }

  /**
   * Search routes by criteria
   */
  async searchRoutes(criteria: {
    maxDistance?: number;
    difficulty?: string;
    minSafetyScore?: number;
    surfaceTypes?: string[];
  }): Promise<Route[]> {
    return routeDatabase.filter(route => {
      if (criteria.maxDistance && route.distance > criteria.maxDistance) return false;
      if (criteria.difficulty && route.difficulty !== criteria.difficulty) return false;
      if (criteria.minSafetyScore && route.safetyScore < criteria.minSafetyScore) return false;
      if (criteria.surfaceTypes && !criteria.surfaceTypes.some(type => route.surfaceType.includes(type))) return false;
      return true;
    });
  }

  /**
   * Calculate route recommendations based on preferences and experience
   */
  private calculateRecommendations(
    preferences: UserPreferences,
    userExperience: string
  ): RouteRecommendation[] {
    return routeDatabase
      .filter(route => this.passesFilters(route, preferences, userExperience))
      .map(route => ({
        routeId: route.id,
        name: route.name,
        distance: route.distance,
        difficulty: route.difficulty,
        safetyScore: route.safetyScore,
        popularity: route.popularity,
        elevationGain: route.elevationGain,
        surfaceType: route.surfaceType,
        matchScore: this.calculateMatchScore(route, preferences, userExperience),
        reasoning: this.generateReasoning(route, preferences, userExperience)
      }))
      .sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Apply filters to routes based on user preferences
   */
  private passesFilters(
    route: Route,
    preferences: UserPreferences,
    userExperience: string
  ): boolean {
    // Distance filter
    if (route.distance > preferences.maxDistance) return false;
    
    // Difficulty filter with experience-based flexibility
    if (preferences.preferredDifficulty !== 'any' && route.difficulty !== preferences.preferredDifficulty) {
      // Allow some flexibility based on experience
      if (userExperience === 'beginner' && route.difficulty !== 'beginner') return false;
      if (userExperience === 'advanced' && route.difficulty === 'beginner') return false;
    }
    
    // Traffic preference filter
    if (preferences.trafficPreference === 'low' && !route.lowTraffic) return false;
    if (preferences.trafficPreference === 'high' && route.lowTraffic) return false;
    
    // Lighting preference filter
    if (preferences.lightingPreference === 'night' && !route.wellLit) return false;
    if (preferences.lightingPreference === 'day' && route.wellLit === false) return false;
    
    return true;
  }

  /**
   * Calculate how well a route matches user preferences
   */
  private calculateMatchScore(
    route: Route,
    preferences: UserPreferences,
    userExperience: string
  ): number {
    let score = 0;
    
    // Safety score (weighted by user preference)
    score += (route.safetyScore / 100) * (preferences.safetyImportance / 100) * 40;
    
    // Scenic score (weighted by user preference)
    score += (route.scenicScore / 100) * (preferences.scenicImportance / 100) * 20;
    
    // Popularity score
    score += (route.popularity / 100) * 15;
    
    // Experience match
    if (route.difficulty === userExperience) score += 15;
    else if (userExperience === 'beginner' && route.difficulty === 'intermediate') score += 5;
    else if (userExperience === 'advanced' && route.difficulty === 'intermediate') score += 5;
    
    // Traffic preference match
    if (preferences.trafficPreference === 'low' && route.lowTraffic) score += 10;
    else if (preferences.trafficPreference === 'high' && !route.lowTraffic) score += 10;
    
    // Distance optimization (closer to max distance gets bonus)
    const distanceRatio = route.distance / preferences.maxDistance;
    if (distanceRatio >= 0.7 && distanceRatio <= 1.0) score += 5;
    
    return Math.round(score);
  }

  /**
   * Generate reasoning for why a route was recommended
   */
  private generateReasoning(
    route: Route,
    preferences: UserPreferences,
    userExperience: string
  ): string {
    const reasons: string[] = [];
    
    if (route.safetyScore >= 90) reasons.push("Excellent safety rating");
    else if (route.safetyScore >= 80) reasons.push("Good safety rating");
    
    if (route.scenicScore >= 90) reasons.push("Spectacular views");
    else if (route.scenicScore >= 80) reasons.push("Beautiful scenery");
    
    if (route.popularity >= 85) reasons.push("Very popular route");
    else if (route.popularity >= 70) reasons.push("Popular among runners");
    
    if (route.difficulty === userExperience) reasons.push("Perfect for your experience level");
    
    if (preferences.trafficPreference === 'low' && route.lowTraffic) reasons.push("Peaceful, low-traffic route");
    if (preferences.trafficPreference === 'high' && !route.lowTraffic) reasons.push("Urban, high-energy route");
    
    if (route.wellLit && preferences.lightingPreference === 'night') reasons.push("Well-lit for night running");
    
    if (route.distance <= preferences.maxDistance * 0.8) reasons.push("Comfortable distance for your preference");
    
    return reasons.length > 0 ? reasons.join(", ") : "Good overall match for your preferences";
  }

  /**
   * Generate cache key for recommendations
   */
  private generateCacheKey(preferences: UserPreferences, userExperience: string): string {
    return `${userExperience}-${preferences.maxDistance}-${preferences.preferredDifficulty}-${preferences.safetyImportance}-${preferences.scenicImportance}-${preferences.trafficPreference}-${preferences.lightingPreference}`;
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(_cacheKey: string): boolean {
    // In a real implementation, you'd check timestamps
    // For now, we'll rely on the timeout mechanism
    return true;
  }

  /**
   * Get route statistics for analytics
   */
  async getRouteStatistics(): Promise<{
    totalRoutes: number;
    averageSafetyScore: number;
    averagePopularity: number;
    difficultyDistribution: Record<string, number>;
    surfaceTypeDistribution: Record<string, number>;
  }> {
    const totalRoutes = routeDatabase.length;
    const averageSafetyScore = routeDatabase.reduce((sum, route) => sum + route.safetyScore, 0) / totalRoutes;
    const averagePopularity = routeDatabase.reduce((sum, route) => sum + route.popularity, 0) / totalRoutes;
    
    const difficultyDistribution = routeDatabase.reduce((acc, route) => {
      acc[route.difficulty] = (acc[route.difficulty] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const surfaceTypeDistribution = routeDatabase.reduce((acc, route) => {
      route.surfaceType.forEach(type => {
        acc[type] = (acc[type] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalRoutes,
      averageSafetyScore: Math.round(averageSafetyScore),
      averagePopularity: Math.round(averagePopularity),
      difficultyDistribution,
      surfaceTypeDistribution
    };
  }
}

// Export singleton instance
export const routeRecommendationService = new RouteRecommendationService();
