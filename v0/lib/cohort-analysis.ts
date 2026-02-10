/**
 * Cohort Analysis System
 *
 * Groups users into cohorts based on signup date or other attributes
 * Tracks cohort behavior over time
 */

import { logger } from './logger'

/**
 * Cohort definition
 */
export interface Cohort {
  id: string
  name: string
  description?: string

  // Cohort type
  type: 'date_based' | 'attribute_based' | 'custom'

  // Date-based cohorts
  startDate?: Date
  endDate?: Date

  // Attribute-based cohorts
  attributes?: {
    experienceLevel?: 'beginner' | 'intermediate' | 'advanced'
    goal?: 'habit' | 'distance' | 'speed' | 'race'
    platform?: 'web' | 'mobile' | 'ios' | 'android'
    country?: string
    locale?: string
  }

  // Metadata
  createdAt: Date
  userCount: number
}

/**
 * Cohort metrics over time
 */
export interface CohortMetrics {
  cohortId: string
  cohortName: string

  // Time period
  periodStart: Date
  periodEnd: Date
  daysInCohort: number

  // Engagement metrics
  activeUsers: number
  activityRate: number // % of users with activity

  // Retention metrics
  retainedUsers: number
  churnRate: number // % that stopped using

  // Plan metrics
  usersWithPlan: number
  planAdherence: number // % of planned workouts completed

  // Run metrics
  totalRuns: number
  avgRunsPerUser: number
  avgRunDistance: number
  avgRunDuration: number

  // Goal metrics
  usersAchievingGoal: number
  goalCompletionRate: number

  // Streak metrics
  avgStreak: number
  maxStreak: number

  // Engagement
  avgSessionDuration: number // minutes
  sessionsPerUser: number

  // Content interaction
  chatInteractionRate: number
  avgMessagesPerUser: number
}

/**
 * Cohort retention over time
 */
export interface CohortRetention {
  cohortId: string
  cohortName: string
  cohortSize: number

  // Retention by day/week/month
  day_1: number // % retained
  day_7: number
  day_14: number
  day_30: number
  day_60: number
  day_90: number

  // Churn rate
  churnDay_1: number
  churnDay_7: number
  churnDay_30: number
}

/**
 * In-memory cohort store (upgrade to database in production)
 */
const cohortsStore = new Map<string, Cohort>()
const cohortMembersStore = new Map<string, number[]>() // cohortId -> userIds
const cohortMetricsStore = new Map<string, CohortMetrics[]>() // cohortId -> [metrics]
const cohortRetentionStore = new Map<string, CohortRetention>()

/**
 * Create a cohort
 */
export const createCohort = async (cohort: Cohort): Promise<Cohort> => {
  logger.info('Creating cohort:', { id: cohort.id, name: cohort.name })

  cohort.createdAt = new Date()
  cohort.userCount = 0

  cohortsStore.set(cohort.id, cohort)
  cohortMembersStore.set(cohort.id, [])
  cohortMetricsStore.set(cohort.id, [])

  return cohort
}

/**
 * Get cohort by ID
 */
export const getCohort = (cohortId: string): Cohort | undefined => {
  return cohortsStore.get(cohortId)
}

/**
 * List all cohorts
 */
export const listCohorts = (): Cohort[] => {
  return Array.from(cohortsStore.values())
}

/**
 * Add user to cohort
 */
export const addUserToCohort = async (
  cohortId: string,
  userId: number
): Promise<boolean> => {
  const cohort = getCohort(cohortId)
  if (!cohort) {
    return false
  }

  const members = cohortMembersStore.get(cohortId) || []

  // Check if already member
  if (members.includes(userId)) {
    return false
  }

  members.push(userId)
  cohortMembersStore.set(cohortId, members)

  // Update user count
  cohort.userCount = members.length

  logger.debug('User added to cohort:', { cohortId, userId })

  return true
}

/**
 * Remove user from cohort
 */
export const removeUserFromCohort = async (
  cohortId: string,
  userId: number
): Promise<boolean> => {
  const members = cohortMembersStore.get(cohortId) || []
  const idx = members.indexOf(userId)

  if (idx === -1) {
    return false
  }

  members.splice(idx, 1)
  cohortMembersStore.set(cohortId, members)

  // Update user count
  const cohort = getCohort(cohortId)
  if (cohort) {
    cohort.userCount = members.length
  }

  return true
}

/**
 * Get cohort members
 */
export const getCohortMembers = (cohortId: string): number[] => {
  return cohortMembersStore.get(cohortId) || []
}

/**
 * Record cohort metrics for a time period
 */
export const recordCohortMetrics = async (metrics: CohortMetrics): Promise<void> => {
  const metricsArray = cohortMetricsStore.get(metrics.cohortId) || []
  metricsArray.push(metrics)
  cohortMetricsStore.set(metrics.cohortId, metricsArray)

  logger.debug('Cohort metrics recorded:', {
    cohortId: metrics.cohortId,
    period: `${metrics.periodStart} - ${metrics.periodEnd}`,
  })
}

/**
 * Get cohort metrics for a time range
 */
export const getCohortMetrics = (
  cohortId: string,
  startDate?: Date,
  endDate?: Date
): CohortMetrics[] => {
  const metricsArray = cohortMetricsStore.get(cohortId) || []

  if (!startDate && !endDate) {
    return metricsArray
  }

  return metricsArray.filter(m => {
    if (startDate && m.periodEnd < startDate) return false
    if (endDate && m.periodStart > endDate) return false
    return true
  })
}

/**
 * Record cohort retention data
 */
export const recordCohortRetention = async (retention: CohortRetention): Promise<void> => {
  cohortRetentionStore.set(retention.cohortId, retention)

  logger.debug('Cohort retention recorded:', {
    cohortId: retention.cohortId,
    day_1: `${retention.day_1}%`,
    day_7: `${retention.day_7}%`,
    day_30: `${retention.day_30}%`,
  })
}

/**
 * Get cohort retention data
 */
export const getCohortRetention = (cohortId: string): CohortRetention | undefined => {
  return cohortRetentionStore.get(cohortId)
}

/**
 * Calculate cohort retention (simplified)
 * In production, this would query actual user activity data
 */
export const calculateCohortRetention = async (
  cohortId: string
): Promise<CohortRetention | null> => {
  const cohort = getCohort(cohortId)
  if (!cohort) {
    return null
  }

  const members = getCohortMembers(cohortId)
  if (members.length === 0) {
    return null
  }

  // Simulate retention data (in production, query real activity)
  const retention: CohortRetention = {
    cohortId,
    cohortName: cohort.name,
    cohortSize: members.length,
    day_1: 100,
    day_7: Math.floor(Math.random() * 40) + 40, // 40-80%
    day_14: Math.floor(Math.random() * 35) + 25, // 25-60%
    day_30: Math.floor(Math.random() * 30) + 20, // 20-50%
    day_60: Math.floor(Math.random() * 20) + 10, // 10-30%
    day_90: Math.floor(Math.random() * 15) + 5, // 5-20%
    churnDay_1: 0,
    churnDay_7: 100 - (Math.floor(Math.random() * 40) + 40),
    churnDay_30: 100 - (Math.floor(Math.random() * 30) + 20),
  }

  await recordCohortRetention(retention)
  return retention
}

/**
 * Compare two cohorts
 */
export interface CohortComparison {
  cohort_a: {
    id: string
    name: string
    userCount: number
  }
  cohort_b: {
    id: string
    name: string
    userCount: number
  }

  // Metrics comparison
  retention_day_1_diff: number // percentage point difference
  retention_day_7_diff: number
  retention_day_30_diff: number

  activeUsers_diff: number
  avgRunsPerUser_diff: number
  planAdherence_diff: number
  goalCompletionRate_diff: number
}

export const compareCohorts = async (
  cohortIdA: string,
  cohortIdB: string
): Promise<CohortComparison | null> => {
  const cohortA = getCohort(cohortIdA)
  const cohortB = getCohort(cohortIdB)

  if (!cohortA || !cohortB) {
    return null
  }

  const retentionA = getCohortRetention(cohortIdA)
  const retentionB = getCohortRetention(cohortIdB)

  if (!retentionA || !retentionB) {
    return null
  }

  const metricsA = getCohortMetrics(cohortIdA)
  const metricsB = getCohortMetrics(cohortIdB)

  const avgMetricsA = metricsA.length > 0
    ? {
        activeUsers: metricsA.reduce((s, m) => s + m.activeUsers, 0) / metricsA.length,
        avgRunsPerUser: metricsA.reduce((s, m) => s + m.avgRunsPerUser, 0) / metricsA.length,
        planAdherence: metricsA.reduce((s, m) => s + m.planAdherence, 0) / metricsA.length,
        goalCompletionRate: metricsA.reduce((s, m) => s + m.goalCompletionRate, 0) / metricsA.length,
      }
    : { activeUsers: 0, avgRunsPerUser: 0, planAdherence: 0, goalCompletionRate: 0 }

  const avgMetricsB = metricsB.length > 0
    ? {
        activeUsers: metricsB.reduce((s, m) => s + m.activeUsers, 0) / metricsB.length,
        avgRunsPerUser: metricsB.reduce((s, m) => s + m.avgRunsPerUser, 0) / metricsB.length,
        planAdherence: metricsB.reduce((s, m) => s + m.planAdherence, 0) / metricsB.length,
        goalCompletionRate: metricsB.reduce((s, m) => s + m.goalCompletionRate, 0) / metricsB.length,
      }
    : { activeUsers: 0, avgRunsPerUser: 0, planAdherence: 0, goalCompletionRate: 0 }

  return {
    cohort_a: {
      id: cohortA.id,
      name: cohortA.name,
      userCount: cohortA.userCount,
    },
    cohort_b: {
      id: cohortB.id,
      name: cohortB.name,
      userCount: cohortB.userCount,
    },
    retention_day_1_diff: retentionA.day_1 - retentionB.day_1,
    retention_day_7_diff: retentionA.day_7 - retentionB.day_7,
    retention_day_30_diff: retentionA.day_30 - retentionB.day_30,
    activeUsers_diff: avgMetricsA.activeUsers - avgMetricsB.activeUsers,
    avgRunsPerUser_diff: avgMetricsA.avgRunsPerUser - avgMetricsB.avgRunsPerUser,
    planAdherence_diff: avgMetricsA.planAdherence - avgMetricsB.planAdherence,
    goalCompletionRate_diff: avgMetricsA.goalCompletionRate - avgMetricsB.goalCompletionRate,
  }
}

/**
 * Predefined cohorts for RunSmart
 */
export const PREDEFINED_COHORTS = {
  // Date-based
  JAN_2024: 'cohort_jan_2024',
  FEB_2024: 'cohort_feb_2024',
  MAR_2024: 'cohort_mar_2024',

  // Experience-based
  BEGINNERS: 'cohort_beginners',
  INTERMEDIATE: 'cohort_intermediate',
  ADVANCED: 'cohort_advanced',

  // Goal-based
  HABIT_FORMERS: 'cohort_habit_formers',
  DISTANCE_RUNNERS: 'cohort_distance_runners',
  SPEED_SEEKERS: 'cohort_speed_seekers',
  RACE_PREPPERS: 'cohort_race_preppers',

  // Engagement
  POWER_USERS: 'cohort_power_users',
  CASUAL_USERS: 'cohort_casual_users',
  INACTIVE: 'cohort_inactive',
}
