import { Goal, db } from './db';
import { dbUtils } from './dbUtils';
import { RecoveryEngine } from './recoveryEngine';
import { logger } from './logger';

/**
 * Comprehensive personalization context for a user
 * Combines onboarding data, goals, activity, and recovery status
 */
export interface PersonalizationContext {
  /** User profile from onboarding */
  userProfile: {
    goal: 'habit' | 'distance' | 'speed';
    experience: 'beginner' | 'intermediate' | 'advanced';
    age?: number;
    coachingStyle: 'supportive' | 'challenging' | 'analytical' | 'encouraging';
    motivations: string[];
    barriers: string[];
    preferredTimes: string[];
    daysPerWeek: number;
  };

  /** Active goals */
  activeGoals: Goal[];

  /** Recent activity summary */
  recentActivity: {
    runsLast7Days: number;
    runsLast30Days: number;
    avgPace: number; // seconds per km
    totalDistance: number; // km
    consistency: number; // 0-100
  };

  /** Recovery status (if available) */
  recoveryStatus?: {
    score: number; // 0-100
    needsRest: boolean;
    factors: string[];
  };

  /** Advanced physiological metrics (if available) */
  advancedMetrics?: {
    vdot?: number;
    vo2Max?: number;
    lactateThreshold?: number; // seconds per km
    lactateThresholdHR?: number; // bpm
    hrvBaseline?: number; // ms
    maxHeartRate?: number; // bpm
    restingHeartRate?: number; // bpm
    runningEconomy?: number; // ml O2/kg/km
  };

  /** Historical training data */
  historicalData?: {
    bestRecentPace?: number; // seconds per km
    weeklyVolumeTrend?: number[]; // last 12 weeks (km)
    significantRuns?: number; // count
    previousPeakVolume?: number; // km per week
  };

  /** Coaching profile preferences (if available) */
  coachingPreferences?: {
    communicationStyle: any;
    workoutPreferences: any;
  };

  /** Quality metrics */
  personalizationStrength: number; // 0-100, how much data we have
  recommendationStrategy: 'basic' | 'personalized' | 'advanced';
}

/**
 * Builder for creating comprehensive personalization contexts
 */
export class PersonalizationContextBuilder {
  /**
   * Build complete personalization context for a user
   * @param userId - User ID to build context for
   * @returns Personalization context
   */
  static async build(userId: number): Promise<PersonalizationContext> {
    try {
      logger.info(`Building personalization context for user ${userId}`);

      // Fetch all data in parallel for performance
      const [
        userProfile,
        activeGoals,
        activitySummary,
        recoveryContext,
        advancedMetrics,
        historicalData,
      ] = await Promise.all([
        this.getUserProfile(userId),
        this.getActiveGoals(userId),
        this.getActivitySummary(userId),
        this.getRecoveryContext(userId),
        this.getAdvancedMetrics(userId),
        this.getHistoricalData(userId),
      ]);

      // Build the context
      const context: PersonalizationContext = {
        userProfile,
        activeGoals,
        recentActivity: activitySummary,
        recoveryStatus: recoveryContext,
        advancedMetrics,
        historicalData,
        personalizationStrength: 0,
        recommendationStrategy: 'basic',
      };

      // Calculate context strength and strategy
      context.personalizationStrength = this.getContextStrength(context);
      context.recommendationStrategy = this.determineRecommendationStrategy(
        context.personalizationStrength
      );

      // Validate context
      if (!this.validateContext(context)) {
        logger.warn(`Personalization context for user ${userId} failed validation`);
      }

      logger.info(
        `Built personalization context for user ${userId}: strength=${context.personalizationStrength}, strategy=${context.recommendationStrategy}`
      );

      return context;
    } catch (error) {
      logger.error(`Error building personalization context for user ${userId}:`, error);
      // Return minimal fallback context
      return this.getFallbackContext(userId);
    }
  }

  /**
   * Get user profile for personalization
   * @param userId - User ID
   * @returns User profile data
   */
  private static async getUserProfile(userId: number): Promise<PersonalizationContext['userProfile']> {
    const user = await dbUtils.getUser(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    return {
      goal: user.goal,
      experience: user.experience,
      age: user.age,
      coachingStyle: user.coachingStyle || 'supportive',
      motivations: user.motivations || [],
      barriers: user.barriers || [],
      preferredTimes: user.preferredTimes || [],
      daysPerWeek: user.daysPerWeek || 3,
    };
  }

  /**
   * Get active goals for user
   * @param userId - User ID
   * @returns Active goals
   */
  private static async getActiveGoals(userId: number): Promise<Goal[]> {
    try {
      const goals = await dbUtils.getUserGoals(userId, 'active');
      return goals || [];
    } catch (error) {
      logger.warn(`Error fetching goals for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get activity summary for user
   * @param userId - User ID
   * @returns Activity summary
   */
  private static async getActivitySummary(
    userId: number
  ): Promise<PersonalizationContext['recentActivity']> {
    try {
      const allRuns = await dbUtils.getRunsByUser(userId);
      if (!allRuns || allRuns.length === 0) {
        return {
          runsLast7Days: 0,
          runsLast30Days: 0,
          avgPace: 0,
          totalDistance: 0,
          consistency: 0,
        };
      }

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const runsLast7Days = allRuns.filter(
        (run) => new Date(run.completedAt) >= sevenDaysAgo
      ).length;
      const runsLast30Days = allRuns.filter(
        (run) => new Date(run.completedAt) >= thirtyDaysAgo
      ).length;

      // Calculate average pace (seconds per km)
      const recentRuns = allRuns.filter((run) => new Date(run.completedAt) >= thirtyDaysAgo);
      const avgPace =
        recentRuns.length > 0
          ? recentRuns.reduce((sum, run) => sum + (run.pace || 0), 0) / recentRuns.length
          : 0;

      // Calculate total distance in last 30 days
      const totalDistance = recentRuns.reduce((sum, run) => sum + run.distance, 0);

      // Calculate consistency (0-100) based on runs per week target
      const user = await dbUtils.getUser(userId);
      const targetRunsPerWeek = user?.daysPerWeek || 3;
      const actualRunsPerWeek = runsLast30Days / 4;
      const consistency = Math.min(100, (actualRunsPerWeek / targetRunsPerWeek) * 100);

      return {
        runsLast7Days,
        runsLast30Days,
        avgPace,
        totalDistance,
        consistency: Math.round(consistency),
      };
    } catch (error) {
      logger.warn(`Error calculating activity summary for user ${userId}:`, error);
      return {
        runsLast7Days: 0,
        runsLast30Days: 0,
        avgPace: 0,
        totalDistance: 0,
        consistency: 0,
      };
    }
  }

  /**
   * Get recovery context for user
   * @param userId - User ID
   * @returns Recovery context (if available)
   */
  private static async getRecoveryContext(
    userId: number
  ): Promise<PersonalizationContext['recoveryStatus'] | undefined> {
    try {
      const recoveryScore = await RecoveryEngine.getRecoveryScore(userId, new Date());
      if (!recoveryScore) {
        return undefined;
      }

      return {
        score: recoveryScore.overallScore,
        needsRest: recoveryScore.overallScore < 60,
        factors: recoveryScore.recommendations || [],
      };
    } catch (error) {
      logger.warn(`Error fetching recovery context for user ${userId}:`, error);
      return undefined;
    }
  }

  /**
   * Get advanced physiological metrics if available
   */
  private static async getAdvancedMetrics(userId: number) {
    try {
      const user = await dbUtils.getUser(userId);
      if (!user) return undefined;

      const hasMetrics = Boolean(
        user.vo2Max ||
          user.lactateThreshold ||
          user.hrvBaseline ||
          user.maxHeartRate ||
          user.calculatedVDOT
      );

      if (!hasMetrics) return undefined;

      let restingHR = user.restingHeartRate;
      if (!restingHR && db?.heartRateZoneSettings?.where) {
        const hrSettings = await db.heartRateZoneSettings
          .where('userId')
          .equals(userId)
          .first();
        restingHR = hrSettings?.restingHeartRate;
      }

      return {
        vdot: user.calculatedVDOT,
        vo2Max: user.vo2Max,
        lactateThreshold: user.lactateThreshold,
        lactateThresholdHR: user.lactateThresholdHR,
        hrvBaseline: user.hrvBaseline,
        maxHeartRate: user.maxHeartRate,
        restingHeartRate: restingHR,
        runningEconomy: user.runningEconomy,
      };
    } catch (error) {
      logger.error('[PersonalizationContext] Failed to fetch advanced metrics:', error);
      return undefined;
    }
  }

  /**
   * Get historical training data summary
   */
  private static async getHistoricalData(userId: number) {
    try {
      const user = await dbUtils.getUser(userId);
      if (!user) return undefined;

      return {
        bestRecentPace: user.bestRecentPacePerKm,
        weeklyVolumeTrend: user.weeklyDistanceHistory,
        significantRuns: user.historicalRuns?.length || 0,
        previousPeakVolume: user.previousTrainingBlock?.peakWeeklyDistance,
      };
    } catch (error) {
      logger.error('[PersonalizationContext] Failed to fetch historical data:', error);
      return undefined;
    }
  }

  /**
   * Validate personalization context
   * @param context - Context to validate
   * @returns True if valid, false otherwise
   */
  static validateContext(context: PersonalizationContext): boolean {
    // Check required fields
    if (!context.userProfile || !context.userProfile.goal || !context.userProfile.experience) {
      return false;
    }

    // Check that we have at least some data
    if (
      context.personalizationStrength === 0 ||
      context.recommendationStrategy === 'basic'
    ) {
      logger.warn('Context has low personalization strength');
    }

    return true;
  }

  /**
   * Calculate context strength based on available data
   * @param context - Context to evaluate
   * @returns Strength score 0-100
   */
  static getContextStrength(context: PersonalizationContext): number {
    let score = 0;

    // Base profile (30 points)
    if (context.userProfile.goal) score += 10;
    if (context.userProfile.experience) score += 10;
    if (context.userProfile.age) score += 5;
    if (context.userProfile.daysPerWeek) score += 5;

    // Goals (20 points)
    if (context.activeGoals.length > 0) score += 10;
    if (context.activeGoals.length > 1) score += 10;

    // Recent activity (20 points)
    if (context.recentActivity.runsLast7Days > 0) score += 10;
    if (context.recentActivity.consistency > 50) score += 10;

    // Advanced metrics (20 points)
    if (context.advancedMetrics) {
      if (context.advancedMetrics.vdot) score += 5;
      if (context.advancedMetrics.vo2Max) score += 5;
      if (context.advancedMetrics.lactateThreshold) score += 5;
      if (context.advancedMetrics.maxHeartRate) score += 5;
    }

    // Historical data (10 points)
    if (context.historicalData) {
      if (context.historicalData.significantRuns && context.historicalData.significantRuns > 0) {
        score += 5;
      }
      if (context.historicalData.weeklyVolumeTrend) score += 5;
    }

    return Math.min(score, 100);
  }

  /**
   * Determine recommendation strategy based on context strength
   * @param strength - Context strength 0-100
   * @returns Recommendation strategy
   */
  private static determineRecommendationStrategy(
    strength: number
  ): PersonalizationContext['recommendationStrategy'] {
    if (strength >= 70) return 'advanced';
    if (strength >= 40) return 'personalized';
    return 'basic';
  }

  /**
   * Get fallback context when data is unavailable
   * @param userId - User ID
   * @returns Minimal fallback context
   */
  private static async getFallbackContext(userId: number): Promise<PersonalizationContext> {
    logger.warn(`Using fallback context for user ${userId}`);

    return {
      userProfile: {
        goal: 'habit',
        experience: 'beginner',
        coachingStyle: 'supportive',
        motivations: [],
        barriers: [],
        preferredTimes: [],
        daysPerWeek: 3,
      },
      activeGoals: [],
      recentActivity: {
        runsLast7Days: 0,
        runsLast30Days: 0,
        avgPace: 0,
        totalDistance: 0,
        consistency: 0,
      },
      personalizationStrength: 20,
      recommendationStrategy: 'basic',
    };
  }
}

/**
 * Convenience function to build personalization context
 * @param userId - User ID to build context for
 * @returns Personalization context
 */
export async function buildPersonalizationContext(userId: number): Promise<PersonalizationContext> {
  return PersonalizationContextBuilder.build(userId);
}
