/**
 * Feature Flags System
 *
 * Provides infrastructure for gradual rollouts and user-based feature access
 */

import { getCurrentUser } from './dbUtils'
import { logger } from './logger'

/**
 * Feature flag types
 */
export interface FeatureFlag {
  id: string
  name: string
  description?: string
  enabled: boolean

  // Rollout type
  rolloutType: 'all' | 'percentage' | 'users' | 'cohorts'

  // Rollout configuration
  rolloutPercentage?: number // 0-100
  targetedUsers?: number[] // User IDs
  targetedCohorts?: string[] // Cohort IDs

  // Targeting rules
  targetingRules?: {
    minDaysActive?: number
    maxDaysActive?: number
    experienceLevel?: 'beginner' | 'intermediate' | 'advanced'
    goal?: 'habit' | 'distance' | 'speed' | 'race'
    minStreak?: number
  }

  // Metadata
  createdAt: Date
  updatedAt: Date
  launchedAt?: Date
  deprecatedAt?: Date

  // A/B test integration
  experimentId?: string // If linked to experiment

  // Config
  config?: Record<string, any> // Feature-specific configuration
}

/**
 * In-memory feature flags store (upgrade to database in production)
 */
const flagsStore = new Map<string, FeatureFlag>()

/**
 * Create or update a feature flag
 */
export const upsertFeatureFlag = async (flag: FeatureFlag): Promise<FeatureFlag> => {
  logger.info('Creating/updating feature flag:', { id: flag.id, name: flag.name })

  if (!flag.createdAt) {
    flag.createdAt = new Date()
  }
  flag.updatedAt = new Date()

  flagsStore.set(flag.id, flag)
  return flag
}

/**
 * Get feature flag by ID
 */
export const getFeatureFlag = (flagId: string): FeatureFlag | undefined => {
  return flagsStore.get(flagId)
}

/**
 * List all feature flags
 */
export const listFeatureFlags = (): FeatureFlag[] => {
  return Array.from(flagsStore.values())
}

/**
 * Check if a feature is enabled for a user
 */
export const isFeatureEnabledForUser = async (
  flagId: string,
  userId?: number
): Promise<boolean> => {
  const flag = getFeatureFlag(flagId)
  if (!flag || !flag.enabled) {
    return false
  }

  // Check rollout type
  switch (flag.rolloutType) {
    case 'all':
      return true

    case 'percentage':
      if (flag.rolloutPercentage === undefined) {
        return false
      }
      // Use deterministic hash based on userId and flagId to ensure consistency
      const hash = hashUserFlag(userId || 0, flagId)
      return (hash % 100) < flag.rolloutPercentage

    case 'users':
      if (!userId || !flag.targetedUsers) {
        return false
      }
      return flag.targetedUsers.includes(userId)

    case 'cohorts':
      if (!userId || !flag.targetedCohorts) {
        return false
      }
      // TODO: Check if user belongs to targeted cohorts
      return false

    default:
      return false
  }
}

/**
 * Check if feature is enabled with targeting rules
 */
export const isFeatureEnabled = async (
  flagId: string,
  userId?: number
): Promise<boolean> => {
  const flag = getFeatureFlag(flagId)
  if (!flag || !flag.enabled) {
    return false
  }

  // Check basic rollout
  const isRolledOut = await isFeatureEnabledForUser(flagId, userId)
  if (!isRolledOut) {
    return false
  }

  // Check targeting rules
  if (flag.targetingRules && userId) {
    const user = await getCurrentUser()
    if (!user) {
      return false
    }

    const rules = flag.targetingRules

    if (rules.experienceLevel && user.experience !== rules.experienceLevel) {
      return false
    }

    if (rules.goal && user.goal !== rules.goal) {
      return false
    }

    if (rules.minStreak && (user.currentStreak || 0) < rules.minStreak) {
      return false
    }

    // TODO: Check days active
  }

  return true
}

/**
 * Get feature config for user
 */
export const getFeatureConfig = async (
  flagId: string,
  userId?: number
): Promise<Record<string, any> | null> => {
  const enabled = await isFeatureEnabled(flagId, userId)
  if (!enabled) {
    return null
  }

  const flag = getFeatureFlag(flagId)
  return flag?.config || {}
}

/**
 * Enable feature for percentage of users
 */
export const enableFeaturePercentage = async (
  flagId: string,
  percentage: number
): Promise<FeatureFlag | null> => {
  const flag = getFeatureFlag(flagId)
  if (!flag) {
    return null
  }

  flag.rolloutType = 'percentage'
  flag.rolloutPercentage = Math.min(100, Math.max(0, percentage))
  flag.updatedAt = new Date()

  flagsStore.set(flagId, flag)

  logger.info('Feature rollout percentage updated:', {
    id: flagId,
    percentage: flag.rolloutPercentage,
  })

  return flag
}

/**
 * Enable feature for specific users
 */
export const enableFeatureForUsers = async (
  flagId: string,
  userIds: number[]
): Promise<FeatureFlag | null> => {
  const flag = getFeatureFlag(flagId)
  if (!flag) {
    return null
  }

  flag.rolloutType = 'users'
  flag.targetedUsers = userIds
  flag.updatedAt = new Date()

  flagsStore.set(flagId, flag)

  logger.info('Feature enabled for specific users:', {
    id: flagId,
    count: userIds.length,
  })

  return flag
}

/**
 * Launch a feature to all users
 */
export const launchFeature = async (flagId: string): Promise<FeatureFlag | null> => {
  const flag = getFeatureFlag(flagId)
  if (!flag) {
    return null
  }

  flag.enabled = true
  flag.rolloutType = 'all'
  flag.launchedAt = new Date()
  flag.updatedAt = new Date()

  flagsStore.set(flagId, flag)

  logger.info('Feature launched to all users:', { id: flagId })

  return flag
}

/**
 * Disable a feature
 */
export const disableFeature = async (flagId: string): Promise<FeatureFlag | null> => {
  const flag = getFeatureFlag(flagId)
  if (!flag) {
    return null
  }

  flag.enabled = false
  flag.updatedAt = new Date()

  flagsStore.set(flagId, flag)

  logger.info('Feature disabled:', { id: flagId })

  return flag
}

/**
 * Link feature flag to A/B test
 */
export const linkToExperiment = async (
  flagId: string,
  experimentId: string
): Promise<FeatureFlag | null> => {
  const flag = getFeatureFlag(flagId)
  if (!flag) {
    return null
  }

  flag.experimentId = experimentId
  flag.updatedAt = new Date()

  flagsStore.set(flagId, flag)

  logger.info('Feature flag linked to experiment:', {
    id: flagId,
    experimentId,
  })

  return flag
}

/**
 * Hash function for deterministic user rollout
 * Ensures same user always gets same variant
 */
function hashUserFlag(userId: number, flagId: string): number {
  const str = `${userId}:${flagId}`
  let hash = 0

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }

  return Math.abs(hash)
}

/**
 * Predefined feature flags for RunSmart
 */
export const FEATURE_FLAGS = {
  // AI Coach features
  ENHANCED_AI_COACH: 'enhanced_ai_coach',
  AI_MESSAGE_DRAFTING: 'ai_message_drafting',
  AI_PERSONALIZED_PLANS: 'ai_personalized_plans',

  // Recovery features
  HRV_TRACKING: 'hrv_tracking',
  ADVANCED_RECOVERY_SCORE: 'advanced_recovery_score',
  SLEEP_TRACKING_INTEGRATION: 'sleep_tracking_integration',

  // Social features
  CHALLENGE_SHARING: 'challenge_sharing',
  FRIEND_LEADERBOARD: 'friend_leaderboard',
  COMMUNITY_FEED: 'community_feed',

  // Premium features
  ADVANCED_ANALYTICS: 'advanced_analytics',
  CUSTOM_TRAINING_PLANS: 'custom_training_plans',
  RACE_PREDICTION: 'race_prediction',

  // UI improvements
  REDESIGNED_DASHBOARD: 'redesigned_dashboard',
  DARK_MODE: 'dark_mode',
  LOCALE_SELECTION: 'locale_selection',

  // Onboarding
  SIMPLIFIED_ONBOARDING: 'simplified_onboarding',
  GUIDED_PLAN_CREATION: 'guided_plan_creation',

  // Experimental
  NEW_WORKOUT_CAPTURE: 'new_workout_capture',
  VOICE_COMMANDS: 'voice_commands',
  OFFLINE_SYNC: 'offline_sync',
}
