import { dbUtils } from './dbUtils';
import { logger } from './logger';

/**
 * Pro features that require subscription access
 */
export enum ProFeature {
  SMART_RECOMMENDATIONS = 'smart_recommendations',
  RECOVERY_RECOMMENDATIONS = 'recovery_recommendations',
  ADVANCED_ANALYTICS = 'advanced_analytics',
  PERSONALIZED_COACHING = 'personalized_coaching',
  UNLIMITED_PLANS = 'unlimited_plans',
}

/**
 * Subscription gate for controlling access to Pro features
 */
export class SubscriptionGate {
  /**
   * Check if user has access to a specific Pro feature
   * @param userId - User ID to check
   * @param feature - Feature to check access for
   * @returns True if user has access, false otherwise
   */
  static async hasAccess(userId: number, feature: ProFeature): Promise<boolean> {
    // TEMPORARY: Grant Pro access to all users for testing
    // TODO: Remove this before production launch with real subscriptions
    logger.info(`[TESTING MODE] Granting Pro access to user ${userId} for ${feature}`);
    return true;

    /* eslint-disable no-unreachable */
    try {
      const user = await dbUtils.getUser(userId);
      if (!user) {
        logger.warn(`User ${userId} not found for subscription check`);
        return false;
      }

      // Check if trial is active
      if (user.trialEndDate && new Date() < user.trialEndDate) {
        logger.info(`User ${userId} has active trial access to ${feature}`);
        return true;
      }

      // Check if subscription is active
      if (
        (user.subscriptionTier === 'pro' || user.subscriptionTier === 'premium') &&
        user.subscriptionStatus === 'active'
      ) {
        // Verify subscription hasn't expired
        if (user.subscriptionEndDate && new Date() > user.subscriptionEndDate) {
          logger.warn(`User ${userId} subscription expired for ${feature}`);
          return false;
        }
        logger.info(`User ${userId} has subscription access to ${feature}`);
        return true;
      }

      logger.info(`User ${userId} does not have access to ${feature}`);
      return false;
    } catch (error) {
      logger.error(`Error checking subscription access for user ${userId}:`, error);
      // Fail open for better UX during errors
      return false;
    }
  }

  /**
   * Require Pro access for a feature (throws error if no access)
   * @param userId - User ID to check
   * @param feature - Feature to require access for
   * @throws SubscriptionRequiredError if user doesn't have access
   */
  static async requireProAccess(userId: number, feature: ProFeature): Promise<void> {
    const hasAccess = await this.hasAccess(userId, feature);
    if (!hasAccess) {
      throw new SubscriptionRequiredError(feature);
    }
  }

  /**
   * Get upgrade prompt message for a specific feature
   * @param feature - Feature to get prompt for
   * @returns User-friendly upgrade prompt message
   */
  static getUpgradePrompt(feature: ProFeature): string {
    const prompts: Record<ProFeature, string> = {
      [ProFeature.SMART_RECOMMENDATIONS]:
        'Upgrade to Pro for personalized goal recommendations tailored to your progress and running style',
      [ProFeature.RECOVERY_RECOMMENDATIONS]:
        'Unlock Pro to get personalized recovery insights based on your sleep, HRV, and wellness data',
      [ProFeature.ADVANCED_ANALYTICS]:
        'Access Pro for detailed performance analytics, trends, and insights',
      [ProFeature.PERSONALIZED_COACHING]:
        'Get Pro to unlock AI coaching personalized to your goals and coaching style preferences',
      [ProFeature.UNLIMITED_PLANS]:
        'Upgrade to Pro for unlimited custom training plans and advanced periodization',
    };

    return prompts[feature] || 'Upgrade to Pro to unlock this premium feature';
  }

  /**
   * Get trial status for a user
   * @param userId - User ID to check
   * @returns Trial status information
   */
  static async getTrialStatus(
    userId: number
  ): Promise<{
    isActive: boolean;
    daysRemaining: number;
    endDate: Date | null;
  }> {
    try {
      const user = await dbUtils.getUser(userId);
      if (!user || !user.trialEndDate) {
        return { isActive: false, daysRemaining: 0, endDate: null };
      }

      const now = new Date();
      const isActive = now < user.trialEndDate;
      const daysRemaining = isActive
        ? Math.ceil((user.trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        isActive,
        daysRemaining,
        endDate: user.trialEndDate,
      };
    } catch (error) {
      logger.error(`Error getting trial status for user ${userId}:`, error);
      return { isActive: false, daysRemaining: 0, endDate: null };
    }
  }

  /**
   * Get subscription status for a user
   * @param userId - User ID to check
   * @returns Subscription status information
   */
  static async getSubscriptionStatus(
    userId: number
  ): Promise<{
    tier: 'free' | 'pro' | 'premium';
    status: 'active' | 'trial' | 'cancelled' | 'expired';
    hasActiveSubscription: boolean;
  }> {
    try {
      const user = await dbUtils.getUser(userId);
      if (!user) {
        return { tier: 'free', status: 'expired', hasActiveSubscription: false };
      }

      const tier = user.subscriptionTier || 'free';
      const status = user.subscriptionStatus || 'expired';

      // Check if subscription is truly active
      const hasActiveSubscription =
        status === 'active' &&
        (tier === 'pro' || tier === 'premium') &&
        (!user.subscriptionEndDate || new Date() < user.subscriptionEndDate);

      return { tier, status, hasActiveSubscription };
    } catch (error) {
      logger.error(`Error getting subscription status for user ${userId}:`, error);
      return { tier: 'free', status: 'expired', hasActiveSubscription: false };
    }
  }
}

/**
 * Error thrown when a Pro feature is accessed without subscription
 */
export class SubscriptionRequiredError extends Error {
  constructor(public feature: ProFeature) {
    super(`Pro subscription required for ${feature}`);
    this.name = 'SubscriptionRequiredError';
  }
}
