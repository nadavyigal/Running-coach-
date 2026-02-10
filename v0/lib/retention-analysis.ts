/**
 * Retention Analysis System
 *
 * Tracks user retention, churn, and reactivation over time
 */

import { logger } from './logger'

/**
 * User retention status
 */
export type RetentionStatus =
  | 'active'
  | 'at_risk'
  | 'churned'
  | 'reactivated'
  | 'new'

/**
 * Retention metrics for a user
 */
export interface UserRetention {
  userId: number
  signupDate: Date
  lastActiveDate: Date
  status: RetentionStatus

  // Activity tracking
  daysSinceSignup: number
  daysSinceActive: number
  daysBetweenSessions: number // average

  // Engagement
  totalSessions: number
  totalRuns: number
  totalDistanceKm: number

  // Churn risk score (0-100)
  churnRiskScore: number

  // Metadata
  updatedAt: Date
}

/**
 * Retention cohort data
 */
export interface RetentionCohort {
  cohortName: string
  cohortSize: number

  // Day-based retention
  day_0: number // % on day 0
  day_1: number
  day_3: number
  day_7: number
  day_14: number
  day_30: number
  day_60: number
  day_90: number

  // Metrics
  avgDaysSinceSignup: number
  avgDaysSinceLastActive: number
  churnRate: number // % churned
}

/**
 * In-memory retention store (upgrade to database in production)
 */
const userRetentionStore = new Map<number, UserRetention>()
const retentionCohortStore = new Map<string, RetentionCohort>()

/**
 * Record user retention data
 */
export const recordUserRetention = async (
  retention: UserRetention
): Promise<void> => {
  retention.updatedAt = new Date()
  userRetentionStore.set(retention.userId, retention)

  logger.debug('User retention recorded:', {
    userId: retention.userId,
    status: retention.status,
    daysSinceActive: retention.daysSinceActive,
  })
}

/**
 * Get user retention data
 */
export const getUserRetention = (userId: number): UserRetention | undefined => {
  return userRetentionStore.get(userId)
}

/**
 * Calculate churn risk score (0-100)
 * Higher = more likely to churn
 */
export const calculateChurnRisk = (retention: UserRetention): number => {
  let riskScore = 0

  // Days since last active
  if (retention.daysSinceActive > 7) riskScore += 10
  if (retention.daysSinceActive > 14) riskScore += 15
  if (retention.daysSinceActive > 30) riskScore += 25

  // Declining activity
  if (retention.daysBetweenSessions > 3) riskScore += 10
  if (retention.daysBetweenSessions > 7) riskScore += 15

  // Low engagement
  if (retention.totalRuns < 5) riskScore += 10
  if (retention.totalRuns < 2) riskScore += 10

  // Time since signup
  if (retention.daysSinceSignup < 7) {
    // New users less likely to churn (recent)
    riskScore = Math.max(0, riskScore - 20)
  } else if (retention.daysSinceSignup < 30) {
    // Critical period for new users
    riskScore = Math.min(100, riskScore + 10)
  }

  return Math.min(100, Math.max(0, riskScore))
}

/**
 * Determine retention status
 */
export const determineRetentionStatus = (retention: UserRetention): RetentionStatus => {
  if (retention.daysSinceSignup < 7) {
    return 'new'
  }

  if (retention.daysSinceActive > 90) {
    return 'churned'
  }

  if (retention.daysSinceActive > 30) {
    return 'at_risk'
  }

  if (retention.daysSinceActive > 90 && retention.totalRuns > 0) {
    return 'reactivated'
  }

  return 'active'
}

/**
 * Get retention cohort data
 */
export const getRetentionCohort = (cohortName: string): RetentionCohort | undefined => {
  return retentionCohortStore.get(cohortName)
}

/**
 * Record retention cohort
 */
export const recordRetentionCohort = async (cohort: RetentionCohort): Promise<void> => {
  retentionCohortStore.set(cohort.cohortName, cohort)

  logger.debug('Retention cohort recorded:', {
    cohortName: cohort.cohortName,
    cohortSize: cohort.cohortSize,
    day_30_retention: `${cohort.day_30}%`,
  })
}

/**
 * Get all users at churn risk
 */
export const getUsersAtRisk = (riskThreshold: number = 60): UserRetention[] => {
  const users: UserRetention[] = []

  for (const retention of userRetentionStore.values()) {
    if (retention.churnRiskScore >= riskThreshold) {
      users.push(retention)
    }
  }

  return users.sort((a, b) => b.churnRiskScore - a.churnRiskScore)
}

/**
 * Get churned users
 */
export const getChurnedUsers = (daysSinceActive: number = 90): UserRetention[] => {
  const users: UserRetention[] = []

  for (const retention of userRetentionStore.values()) {
    if (retention.daysSinceActive > daysSinceActive) {
      users.push(retention)
    }
  }

  return users.sort((a, b) => b.daysSinceActive - a.daysSinceActive)
}

/**
 * Get reactivation candidates
 */
export const getReactivationCandidates = (): UserRetention[] => {
  const users: UserRetention[] = []

  for (const retention of userRetentionStore.values()) {
    // Users inactive 30-90 days who previously engaged
    if (
      retention.daysSinceActive > 30 &&
      retention.daysSinceActive < 90 &&
      retention.totalRuns > 10
    ) {
      users.push(retention)
    }
  }

  return users.sort((a, b) => a.daysSinceActive - b.daysSinceActive)
}

/**
 * Retention metrics summary
 */
export interface RetentionSummary {
  totalUsers: number
  activeUsers: number
  atRiskUsers: number
  churnedUsers: number
  reactivatedUsers: number

  // Rates
  activeRate: number // %
  churnRate: number // %
  riskRate: number // %

  // Metrics
  avgDaysBetweenSessions: number
  avgTotalRuns: number
  avgDaysSinceActive: number

  // Cohort data
  day_7_retention: number
  day_30_retention: number
  day_90_retention: number
}

/**
 * Calculate retention summary
 */
export const calculateRetentionSummary = (): RetentionSummary => {
  const allRetentions = Array.from(userRetentionStore.values())

  if (allRetentions.length === 0) {
    return {
      totalUsers: 0,
      activeUsers: 0,
      atRiskUsers: 0,
      churnedUsers: 0,
      reactivatedUsers: 0,
      activeRate: 0,
      churnRate: 0,
      riskRate: 0,
      avgDaysBetweenSessions: 0,
      avgTotalRuns: 0,
      avgDaysSinceActive: 0,
      day_7_retention: 0,
      day_30_retention: 0,
      day_90_retention: 0,
    }
  }

  const activeUsers = allRetentions.filter(r => r.status === 'active').length
  const atRiskUsers = allRetentions.filter(r => r.status === 'at_risk').length
  const churnedUsers = allRetentions.filter(r => r.status === 'churned').length
  const reactivatedUsers = allRetentions.filter(r => r.status === 'reactivated').length

  const avgDaysBetweenSessions = allRetentions.length > 0
    ? allRetentions.reduce((sum, r) => sum + r.daysBetweenSessions, 0) / allRetentions.length
    : 0

  const avgTotalRuns = allRetentions.length > 0
    ? allRetentions.reduce((sum, r) => sum + r.totalRuns, 0) / allRetentions.length
    : 0

  const avgDaysSinceActive = allRetentions.length > 0
    ? allRetentions.reduce((sum, r) => sum + r.daysSinceActive, 0) / allRetentions.length
    : 0

  // Calculate retention by days since signup
  const usersBy7Days = allRetentions.filter(r => r.daysSinceSignup >= 7)
  const usersBy30Days = allRetentions.filter(r => r.daysSinceSignup >= 30)
  const usersBy90Days = allRetentions.filter(r => r.daysSinceSignup >= 90)

  const day_7_retention = usersBy7Days.length > 0
    ? (usersBy7Days.filter(r => r.status !== 'churned').length / usersBy7Days.length) * 100
    : 0

  const day_30_retention = usersBy30Days.length > 0
    ? (usersBy30Days.filter(r => r.status !== 'churned').length / usersBy30Days.length) * 100
    : 0

  const day_90_retention = usersBy90Days.length > 0
    ? (usersBy90Days.filter(r => r.status !== 'churned').length / usersBy90Days.length) * 100
    : 0

  return {
    totalUsers: allRetentions.length,
    activeUsers,
    atRiskUsers,
    churnedUsers,
    reactivatedUsers,
    activeRate: (activeUsers / allRetentions.length) * 100,
    churnRate: (churnedUsers / allRetentions.length) * 100,
    riskRate: (atRiskUsers / allRetentions.length) * 100,
    avgDaysBetweenSessions,
    avgTotalRuns,
    avgDaysSinceActive,
    day_7_retention,
    day_30_retention,
    day_90_retention,
  }
}

/**
 * Reactivation event
 */
export const trackReactivation = async (userId: number): Promise<void> => {
  const retention = userRetentionStore.get(userId)
  if (!retention) {
    return
  }

  retention.status = 'reactivated'
  retention.lastActiveDate = new Date()
  retention.daysSinceActive = 0
  retention.updatedAt = new Date()

  logger.info('User reactivated:', { userId })
}

/**
 * Churn event
 */
export const trackChurn = async (userId: number): Promise<void> => {
  const retention = userRetentionStore.get(userId)
  if (!retention) {
    return
  }

  retention.status = 'churned'
  retention.churnRiskScore = 100
  retention.updatedAt = new Date()

  logger.info('User churned:', { userId })
}
