import { trackAnalyticsEvent } from './analytics'
import { db } from './db'

// A/B Test Configuration Types
export interface ABTestVariant {
  id: string
  name: string
  description: string
  config: Record<string, any>
  weight: number // 0-1, sum of all weights should equal 1
  active: boolean
}

export interface ABTest {
  id: string
  name: string
  description: string
  startDate: Date
  endDate?: Date
  active: boolean
  variants: ABTestVariant[]
  targetAudience?: {
    experience?: string[]
    age?: { min?: number; max?: number }
    cohorts?: string[]
  }
  metrics: {
    primary: string // e.g., 'completion_rate'
    secondary: string[] // e.g., ['time_to_complete', 'error_rate']
  }
}

export interface ABTestAssignment {
  userId: string
  testId: string
  variantId: string
  assignedAt: Date
  context?: Record<string, any>
}

export interface ABTestResults {
  testId: string
  variant: string
  sampleSize: number
  conversionRate: number
  averageValue: number
  standardError: number
  confidenceInterval: { lower: number; upper: number }
  significanceLevel: number
  isSignificant: boolean
}

export interface StatisticalSignificance {
  pValue: number
  zScore: number
  effectSize: number
  confidenceLevel: number
  isSignificant: boolean
  recommendation: 'continue' | 'stop_winner' | 'stop_no_difference' | 'need_more_data'
}

// A/B Test Framework Class
export class ABTestFramework {
  private assignments: Map<string, ABTestAssignment> = new Map()
  private tests: Map<string, ABTest> = new Map()

  constructor() {
    this.initializeDefaultTests()
  }

  /**
   * Initialize default onboarding A/B tests
   */
  private initializeDefaultTests(): void {
    // Test 1: Onboarding Flow Style
    this.createTest({
      id: 'onboarding_flow_style',
      name: 'Onboarding Flow Style',
      description: 'Test AI chat vs guided form onboarding',
      startDate: new Date(),
      active: true,
      variants: [
        {
          id: 'ai_chat',
          name: 'AI Chat Flow',
          description: 'Full AI-guided conversational onboarding',
          config: { 
            useAIChat: true, 
            enableFallback: true,
            chatPersonality: 'friendly'
          },
          weight: 0.5,
          active: true
        },
        {
          id: 'guided_form',
          name: 'Guided Form',
          description: 'Traditional form-based onboarding',
          config: { 
            useAIChat: false, 
            formStyle: 'progressive',
            validationStrict: true
          },
          weight: 0.5,
          active: true
        }
      ],
      metrics: {
        primary: 'completion_rate',
        secondary: ['time_to_complete', 'error_rate', 'user_satisfaction']
      }
    })

    // Test 2: Progress Indicator Style
    this.createTest({
      id: 'progress_indicator',
      name: 'Progress Indicator Style',
      description: 'Test different progress indicator styles',
      startDate: new Date(),
      active: true,
      variants: [
        {
          id: 'linear_bar',
          name: 'Linear Progress Bar',
          description: 'Traditional horizontal progress bar',
          config: { 
            progressStyle: 'linear',
            showPercentage: true,
            showStepNames: true
          },
          weight: 0.33,
          active: true
        },
        {
          id: 'circular_steps',
          name: 'Circular Step Indicators',
          description: 'Circular step-by-step indicators',
          config: { 
            progressStyle: 'circular',
            showPercentage: false,
            showStepNames: true
          },
          weight: 0.33,
          active: true
        },
        {
          id: 'no_indicator',
          name: 'No Progress Indicator',
          description: 'No visual progress indication',
          config: { 
            progressStyle: 'none',
            showPercentage: false,
            showStepNames: false
          },
          weight: 0.34,
          active: true
        }
      ],
      metrics: {
        primary: 'completion_rate',
        secondary: ['drop_off_rate', 'time_per_step']
      }
    })

    // Test 3: Error Handling Approach
    this.createTest({
      id: 'error_handling',
      name: 'Error Handling Approach',
      description: 'Test different error handling and recovery methods',
      startDate: new Date(),
      active: true,
      variants: [
        {
          id: 'toast_notifications',
          name: 'Toast Notifications',
          description: 'Show errors as toast messages',
          config: { 
            errorStyle: 'toast',
            autoRetry: true,
            retryDelay: 2000
          },
          weight: 0.4,
          active: true
        },
        {
          id: 'inline_errors',
          name: 'Inline Error Messages',
          description: 'Show errors inline with form fields',
          config: { 
            errorStyle: 'inline',
            autoRetry: false,
            highlightErrors: true
          },
          weight: 0.3,
          active: true
        },
        {
          id: 'modal_errors',
          name: 'Modal Error Dialogs',
          description: 'Show errors in modal dialogs',
          config: { 
            errorStyle: 'modal',
            autoRetry: false,
            showErrorDetails: true
          },
          weight: 0.3,
          active: true
        }
      ],
      metrics: {
        primary: 'error_recovery_rate',
        secondary: ['completion_rate', 'user_frustration_score']
      }
    })
  }

  /**
   * Create a new A/B test
   */
  createTest(test: ABTest): void {
    // Validate variant weights sum to 1
    const totalWeight = test.variants.reduce((sum, variant) => sum + variant.weight, 0)
    if (Math.abs(totalWeight - 1) > 0.001) {
      throw new Error(`Variant weights must sum to 1, got ${totalWeight}`)
    }

    this.tests.set(test.id, test)
    
    trackAnalyticsEvent('ab_test_created', {
      test_id: test.id,
      test_name: test.name,
      variant_count: test.variants.length,
      primary_metric: test.metrics.primary
    })
  }

  /**
   * Assign user to A/B test variant
   */
  async assignUserToTest(userId: string, testId: string, context?: Record<string, any>): Promise<string> {
    const test = this.tests.get(testId)
    if (!test || !test.active) {
      throw new Error(`Test ${testId} not found or inactive`)
    }

    // Check if user is already assigned
    const existingAssignment = Array.from(this.assignments.values())
      .find(a => a.userId === userId && a.testId === testId)
    
    if (existingAssignment) {
      return existingAssignment.variantId
    }

    // Check if user matches target audience
    if (test.targetAudience && !await this.matchesTargetAudience(userId, test.targetAudience)) {
      // Return control variant or throw error
      const controlVariant = test.variants.find(v => v.id.includes('control')) || test.variants[0]
      return controlVariant.id
    }

    // Assign variant based on weights
    const variantId = this.selectVariantByWeight(test.variants, userId)
    
    const assignment: ABTestAssignment = {
      userId,
      testId,
      variantId,
      assignedAt: new Date(),
      context
    }

    this.assignments.set(`${userId}_${testId}`, assignment)

    // Track assignment
    trackAnalyticsEvent('ab_test_assignment', {
      user_id: userId,
      test_id: testId,
      variant_id: variantId,
      context
    })

    return variantId
  }

  /**
   * Select variant based on weights using user ID as seed
   */
  private selectVariantByWeight(variants: ABTestVariant[], userId: string): string {
    const activeVariants = variants.filter(v => v.active)
    if (activeVariants.length === 0) {
      throw new Error('No active variants available')
    }

    // Use a better hash function for more uniform distribution
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    // Apply additional mixing to improve distribution
    hash = hash ^ (hash >>> 16)
    hash = Math.imul(hash, 0x85ebca6b)
    hash = hash ^ (hash >>> 13)
    hash = Math.imul(hash, 0xc2b2ae35)
    hash = hash ^ (hash >>> 16)
    
    // Convert to [0, 1) range
    const random = (Math.abs(hash) % 1000000) / 1000000

    // Select variant based on cumulative weights
    let cumulativeWeight = 0
    for (const variant of activeVariants) {
      cumulativeWeight += variant.weight
      if (random <= cumulativeWeight) {
        return variant.id
      }
    }

    // Fallback to last variant
    return activeVariants[activeVariants.length - 1].id
  }

  /**
   * Check if user matches target audience criteria
   */
  private async matchesTargetAudience(userId: string, criteria: ABTest['targetAudience']): Promise<boolean> {
    if (!criteria) return true

    try {
      const user = await db.users.get(parseInt(userId))
      if (!user) return false

      // Check experience level
      if (criteria.experience && !criteria.experience.includes(user.experience)) {
        return false
      }

      // Check age range
      if (criteria.age && user.age) {
        if (criteria.age.min && user.age < criteria.age.min) return false
        if (criteria.age.max && user.age > criteria.age.max) return false
      }

      // Check cohorts
      if (criteria.cohorts && user.cohortId && !criteria.cohorts.includes(user.cohortId)) {
        return false
      }

      return true
    } catch (error) {
      console.error('Error checking target audience:', error)
      return false
    }
  }

  /**
   * Get user's variant for a test
   */
  getUserVariant(userId: string, testId: string): string | null {
    const assignment = this.assignments.get(`${userId}_${testId}`)
    return assignment?.variantId || null
  }

  /**
   * Get variant configuration for user
   */
  async getVariantConfig(userId: string, testId: string): Promise<Record<string, any> | null> {
    const variantId = this.getUserVariant(userId, testId)
    if (!variantId) return null

    const test = this.tests.get(testId)
    if (!test) return null

    const variant = test.variants.find(v => v.id === variantId)
    return variant?.config || null
  }

  /**
   * Track A/B test event
   */
  async trackTestEvent(userId: string, testId: string, eventName: string, value?: number, properties?: Record<string, any>): Promise<void> {
    const variantId = this.getUserVariant(userId, testId)
    if (!variantId) return

    await trackAnalyticsEvent('ab_test_event', {
      user_id: userId,
      test_id: testId,
      variant_id: variantId,
      event_name: eventName,
      event_value: value,
      ...properties
    })
  }

  /**
   * Calculate statistical significance between variants
   */
  calculateSignificance(control: ABTestResults, treatment: ABTestResults): StatisticalSignificance {
    const pooledSE = Math.sqrt(
      (control.standardError ** 2) + (treatment.standardError ** 2)
    )
    
    const effectSize = treatment.conversionRate - control.conversionRate
    const zScore = effectSize / pooledSE
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)))
    
    const confidenceLevel = 0.95
    const isSignificant = pValue < (1 - confidenceLevel)
    
    let recommendation: StatisticalSignificance['recommendation']
    if (!isSignificant && (control.sampleSize + treatment.sampleSize) < 1000) {
      recommendation = 'need_more_data'
    } else if (isSignificant && effectSize > 0.05) {
      recommendation = 'stop_winner'
    } else if (isSignificant && Math.abs(effectSize) < 0.02) {
      recommendation = 'stop_no_difference'
    } else {
      recommendation = 'continue'
    }

    return {
      pValue,
      zScore,
      effectSize,
      confidenceLevel,
      isSignificant,
      recommendation
    }
  }

  /**
   * Normal cumulative distribution function
   */
  private normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)))
  }

  /**
   * Error function approximation
   */
  private erf(x: number): number {
    const a1 = 0.254829592
    const a2 = -0.284496736
    const a3 = 1.421413741
    const a4 = -1.453152027
    const a5 = 1.061405429
    const p = 0.3275911

    const sign = x >= 0 ? 1 : -1
    x = Math.abs(x)

    const t = 1.0 / (1.0 + p * x)
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

    return sign * y
  }

  /**
   * Get test results for all variants
   */
  async getTestResults(testId: string): Promise<ABTestResults[]> {
    const test = this.tests.get(testId)
    if (!test) {
      throw new Error(`Test ${testId} not found`)
    }

    // In a real implementation, this would query actual conversion data
    // For now, we'll simulate results
    const results: ABTestResults[] = test.variants.map(variant => {
      const sampleSize = Math.floor(Math.random() * 500) + 100
      const conversionRate = 0.4 + (Math.random() * 0.4) // 40-80%
      const standardError = Math.sqrt((conversionRate * (1 - conversionRate)) / sampleSize)
      
      return {
        testId,
        variant: variant.id,
        sampleSize,
        conversionRate,
        averageValue: conversionRate,
        standardError,
        confidenceInterval: {
          lower: conversionRate - (1.96 * standardError),
          upper: conversionRate + (1.96 * standardError)
        },
        significanceLevel: 0.95,
        isSignificant: Math.random() > 0.5
      }
    })

    return results
  }

  /**
   * Stop A/B test
   */
  stopTest(testId: string, reason?: string): void {
    const test = this.tests.get(testId)
    if (test) {
      test.active = false
      test.endDate = new Date()
      
      trackAnalyticsEvent('ab_test_stopped', {
        test_id: testId,
        reason: reason || 'manual_stop',
        duration_days: test.endDate.getTime() - test.startDate.getTime() / (1000 * 60 * 60 * 24)
      })
    }
  }

  /**
   * Get all active tests
   */
  getActiveTests(): ABTest[] {
    return Array.from(this.tests.values()).filter(test => test.active)
  }

  /**
   * Get test by ID
   */
  getTest(testId: string): ABTest | null {
    return this.tests.get(testId) || null
  }

  /**
   * Enable/disable variant
   */
  setVariantActive(testId: string, variantId: string, active: boolean): void {
    const test = this.tests.get(testId)
    if (test) {
      const variant = test.variants.find(v => v.id === variantId)
      if (variant) {
        variant.active = active
        
        trackAnalyticsEvent('ab_test_variant_toggled', {
          test_id: testId,
          variant_id: variantId,
          active
        })
      }
    }
  }
}

// Singleton instance
export const abTestFramework = new ABTestFramework()

// Helper hook for React components
export const useABTest = (testId: string, userId: string) => {
  const [variant, setVariant] = React.useState<string | null>(null)
  const [config, setConfig] = React.useState<Record<string, any> | null>(null)

  React.useEffect(() => {
    const assignVariant = async () => {
      try {
        const assignedVariant = await abTestFramework.assignUserToTest(userId, testId)
        const variantConfig = await abTestFramework.getVariantConfig(userId, testId)
        
        setVariant(assignedVariant)
        setConfig(variantConfig)
      } catch (error) {
        console.error('Error assigning A/B test variant:', error)
      }
    }

    if (userId && testId) {
      assignVariant()
    }
  }, [testId, userId])

  const trackEvent = (eventName: string, value?: number, properties?: Record<string, any>) => {
    if (userId && testId) {
      abTestFramework.trackTestEvent(userId, testId, eventName, value, properties)
    }
  }

  return { variant, config, trackEvent }
}

// Import React for the hook
import React from 'react'