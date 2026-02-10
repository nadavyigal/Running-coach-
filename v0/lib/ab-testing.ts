/**
 * A/B Testing Framework
 *
 * Provides infrastructure for running experiments with statistical significance testing
 */

import { getCurrentUser } from './dbUtils'
import { logger } from './logger'

/**
 * Experiment metadata and configuration
 */
export interface Experiment {
  id: string
  name: string
  description: string
  status: 'draft' | 'running' | 'paused' | 'completed' | 'archived'
  startDate: Date
  endDate?: Date

  // Variants to test
  variants: ExperimentVariant[]

  // Which users are eligible for this experiment
  targetingRules?: {
    minDaysActive?: number
    maxDaysActive?: number
    experienceLevel?: 'beginner' | 'intermediate' | 'advanced'
    goal?: 'habit' | 'distance' | 'speed' | 'race'
  }

  // Sample size and duration
  sampleSize?: number // If not set, expose to all eligible users
  duration?: number // Days to run experiment

  // Metrics to track
  primaryMetric: string
  secondaryMetrics?: string[]

  // Hypothesis
  hypothesis: string
  expectedLift?: number // Expected % improvement

  // Results (filled after experiment)
  results?: ExperimentResults
}

export interface ExperimentVariant {
  id: string
  name: string
  description?: string
  features: Record<string, any> // Feature flags or configuration for this variant
  trafficAllocation: number // 0-1, e.g., 0.5 = 50% of traffic
}

export interface ExperimentAssignment {
  userId: number
  experimentId: string
  variantId: string
  assignedAt: Date
  exposedAt?: Date
}

export interface ExperimentResults {
  variant_a: VariantResults
  variant_b: VariantResults

  // Statistical significance
  statisticalSignificance: number // p-value
  isSignificant: boolean // p-value < 0.05

  winner?: string // 'a' or 'b' if significant
  confidence?: number // 95%, 99%, etc.

  completedAt: Date
}

export interface VariantResults {
  variantId: string
  variantName: string

  // Sample info
  sampleSize: number
  exposureCount: number

  // Primary metric
  primaryMetricMean: number
  primaryMetricStdDev: number
  primaryMetricSamples: number

  // Secondary metrics
  secondaryMetrics?: Record<string, {
    mean: number
    stdDev: number
    samples: number
  }>

  // Conversion rates
  conversionRate: number
  conversionCount: number
}

/**
 * In-memory experiment store (upgrade to database in production)
 */
const experimentsStore = new Map<string, Experiment>()
const assignmentsStore = new Map<string, ExperimentAssignment[]>()
const eventsStore = new Map<string, any[]>()

/**
 * Create a new experiment
 */
export const createExperiment = async (experiment: Experiment): Promise<Experiment> => {
  logger.info('Creating experiment:', { id: experiment.id, name: experiment.name })

  experiment.status = 'draft'
  experimentsStore.set(experiment.id, experiment)
  assignmentsStore.set(experiment.id, [])
  eventsStore.set(experiment.id, [])

  return experiment
}

/**
 * Get experiment by ID
 */
export const getExperiment = (experimentId: string): Experiment | undefined => {
  return experimentsStore.get(experimentId)
}

/**
 * List all experiments
 */
export const listExperiments = (status?: Experiment['status']): Experiment[] => {
  const experiments = Array.from(experimentsStore.values())
  if (status) {
    return experiments.filter(e => e.status === status)
  }
  return experiments
}

/**
 * Start an experiment (transition from draft to running)
 */
export const startExperiment = async (experimentId: string): Promise<void> => {
  const experiment = experimentsStore.get(experimentId)
  if (!experiment) {
    throw new Error(`Experiment not found: ${experimentId}`)
  }

  if (experiment.status !== 'draft') {
    throw new Error(`Cannot start experiment with status: ${experiment.status}`)
  }

  experiment.status = 'running'
  experiment.startDate = new Date()

  logger.info('Experiment started:', { id: experimentId, name: experiment.name })
}

/**
 * End an experiment and calculate results
 */
export const endExperiment = async (experimentId: string): Promise<ExperimentResults> => {
  const experiment = experimentsStore.get(experimentId)
  if (!experiment) {
    throw new Error(`Experiment not found: ${experimentId}`)
  }

  if (experiment.status !== 'running') {
    throw new Error(`Cannot end experiment with status: ${experiment.status}`)
  }

  const assignments = assignmentsStore.get(experimentId) || []
  const events = eventsStore.get(experimentId) || []

  // Calculate results for each variant
  const variantResults: Record<string, VariantResults> = {}

  for (const variant of experiment.variants) {
    const variantAssignments = assignments.filter(a => a.variantId === variant.id)
    const variantEvents = events.filter(e =>
      variantAssignments.some(a => a.userId === e.userId)
    )

    const primaryMetricValues = variantEvents
      .filter(e => e.metricName === experiment.primaryMetric)
      .map(e => e.value)

    const mean = primaryMetricValues.length > 0
      ? primaryMetricValues.reduce((a, b) => a + b, 0) / primaryMetricValues.length
      : 0

    const stdDev = primaryMetricValues.length > 1
      ? Math.sqrt(
          primaryMetricValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
          (primaryMetricValues.length - 1)
        )
      : 0

    const conversions = variantEvents.filter(e => e.converted).length

    variantResults[variant.id] = {
      variantId: variant.id,
      variantName: variant.name,
      sampleSize: variantAssignments.length,
      exposureCount: variantEvents.filter(e => e.exposed).length,
      primaryMetricMean: mean,
      primaryMetricStdDev: stdDev,
      primaryMetricSamples: primaryMetricValues.length,
      conversionRate: variantAssignments.length > 0
        ? conversions / variantAssignments.length
        : 0,
      conversionCount: conversions,
    }
  }

  // Calculate statistical significance (simplified t-test)
  const variantIds = Object.keys(variantResults)
  const results_a = variantResults[variantIds[0]]
  const results_b = variantResults[variantIds[1]]

  const pValue = calculateTTest(results_a, results_b)
  const isSignificant = pValue < 0.05

  const results: ExperimentResults = {
    variant_a: results_a,
    variant_b: results_b,
    statisticalSignificance: pValue,
    isSignificant,
    winner: isSignificant
      ? (results_a.conversionRate > results_b.conversionRate ? variantIds[0] : variantIds[1])
      : undefined,
    confidence: pValue < 0.01 ? 99 : pValue < 0.05 ? 95 : 80,
    completedAt: new Date(),
  }

  experiment.status = 'completed'
  experiment.endDate = new Date()
  experiment.results = results

  logger.info('Experiment ended:', {
    id: experimentId,
    name: experiment.name,
    pValue,
    isSignificant,
    winner: results.winner,
  })

  return results
}

/**
 * Assign a user to an experiment variant
 */
export const assignUserToVariant = async (
  experimentId: string,
  userId: number
): Promise<ExperimentVariant | null> => {
  const experiment = getExperiment(experimentId)
  if (!experiment || experiment.status !== 'running') {
    logger.debug('Experiment not found or not running:', experimentId)
    return null
  }

  // Check if user already assigned
  const assignments = assignmentsStore.get(experimentId) || []
  const existingAssignment = assignments.find(a => a.userId === userId)
  if (existingAssignment) {
    return experiment.variants.find(v => v.id === existingAssignment.variantId) || null
  }

  // Check targeting rules
  if (experiment.targetingRules) {
    const user = await getCurrentUser()
    if (user) {
      if (experiment.targetingRules.experienceLevel &&
          user.experience !== experiment.targetingRules.experienceLevel) {
        return null
      }
      if (experiment.targetingRules.goal && user.goal !== experiment.targetingRules.goal) {
        return null
      }
    }
  }

  // Check sample size
  if (experiment.sampleSize && assignments.length >= experiment.sampleSize) {
    return null
  }

  // Randomly assign to variant based on traffic allocation
  const variant = selectVariant(experiment.variants)

  const assignment: ExperimentAssignment = {
    userId,
    experimentId,
    variantId: variant.id,
    assignedAt: new Date(),
  }

  assignments.push(assignment)
  assignmentsStore.set(experimentId, assignments)

  logger.debug('User assigned to variant:', {
    userId,
    experimentId,
    variantId: variant.id,
    experimentName: experiment.name,
  })

  return variant
}

/**
 * Track a metric for an experiment
 */
export const trackExperimentMetric = async (
  experimentId: string,
  userId: number,
  metricName: string,
  value: number,
  converted?: boolean
): Promise<void> => {
  const events = eventsStore.get(experimentId) || []

  events.push({
    userId,
    experimentId,
    metricName,
    value,
    converted: converted || false,
    exposed: true,
    timestamp: new Date().toISOString(),
  })

  eventsStore.set(experimentId, events)
}

/**
 * Get user's variant assignment for an experiment
 */
export const getUserVariantAssignment = (
  experimentId: string,
  userId: number
): ExperimentAssignment | undefined => {
  const assignments = assignmentsStore.get(experimentId) || []
  return assignments.find(a => a.userId === userId)
}

/**
 * Get variant config for user (if they're in an experiment)
 */
export const getVariantConfig = (
  experimentId: string,
  userId: number,
  featureName: string
): unknown => {
  const assignment = getUserVariantAssignment(experimentId, userId)
  if (!assignment) {
    return undefined
  }

  const experiment = getExperiment(experimentId)
  if (!experiment) {
    return undefined
  }

  const variant = experiment.variants.find(v => v.id === assignment.variantId)
  if (!variant) {
    return undefined
  }

  return variant.features[featureName]
}

/**
 * Select a variant based on traffic allocation
 */
function selectVariant(variants: ExperimentVariant[]): ExperimentVariant {
  const rand = Math.random()
  let cumulative = 0

  for (const variant of variants) {
    cumulative += variant.trafficAllocation
    if (rand <= cumulative) {
      return variant
    }
  }

  // Fallback to last variant
  return variants[variants.length - 1]
}

/**
 * Calculate t-test p-value (simplified)
 */
function calculateTTest(results_a: VariantResults, results_b: VariantResults): number {
  if (results_a.primaryMetricSamples < 2 || results_b.primaryMetricSamples < 2) {
    return 1 // Insufficient samples
  }

  const pooledStdError = Math.sqrt(
    (Math.pow(results_a.primaryMetricStdDev, 2) / results_a.primaryMetricSamples) +
    (Math.pow(results_b.primaryMetricStdDev, 2) / results_b.primaryMetricSamples)
  )

  if (pooledStdError === 0) {
    return 1
  }

  const tStat = Math.abs(
    (results_a.primaryMetricMean - results_b.primaryMetricMean) / pooledStdError
  )

  // Approximate p-value (normal distribution)
  // Real implementation should use t-distribution
  const pValue = 2 * (1 - normalCDF(tStat))

  return Math.min(pValue, 1)
}

/**
 * Approximate normal cumulative distribution function
 */
function normalCDF(z: number): number {
  // Approximation using error function
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  const sign = z < 0 ? -1 : 1
  const absZ = Math.abs(z) / Math.sqrt(2)

  const t = 1.0 / (1.0 + p * absZ)
  const y = 1.0 - (
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absZ * absZ)
  )

  return 0.5 * (1.0 + sign * y)
}
