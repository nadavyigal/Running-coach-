import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ABTestFramework, type ABTest, type ABTestVariant } from './abTestFramework'
import { db } from './db'

// Mock the analytics module
vi.mock('./analytics', () => ({
  trackAnalyticsEvent: vi.fn()
}))

describe('ABTestFramework', () => {
  let framework: ABTestFramework

  beforeEach(async () => {
    framework = new ABTestFramework()
    
    // Clear database
    await db.users.clear()
    
    // Add sample users for testing
    await db.users.bulkAdd([
      {
        id: 1,
        name: 'John Doe',
        experience: 'beginner',
        age: 25,
        goal: 'fitness',
        daysPerWeek: 3,
        preferredTimes: ['morning'],
        onboardingComplete: true,
        currentStreak: 5,
        cohortId: 'cohort_a',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 2,
        name: 'Jane Smith',
        experience: 'intermediate',
        age: 35,
        goal: 'weight_loss',
        daysPerWeek: 4,
        preferredTimes: ['evening'],
        onboardingComplete: false,
        currentStreak: 0,
        cohortId: 'cohort_b',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ])
  })

  describe('test creation', () => {
    it('should create a new A/B test successfully', () => {
      const testConfig: ABTest = {
        id: 'test_button_color',
        name: 'Button Color Test',
        description: 'Test different button colors',
        startDate: new Date(),
        active: true,
        variants: [
          { id: 'blue', name: 'Blue Button', description: 'Blue colored button', config: { color: 'blue' }, weight: 0.5, active: true },
          { id: 'green', name: 'Green Button', description: 'Green colored button', config: { color: 'green' }, weight: 0.5, active: true }
        ],
        metrics: { primary: 'click_rate', secondary: ['conversion_rate'] }
      }

      expect(() => framework.createTest(testConfig)).not.toThrow()
      
      const retrievedTest = framework.getTest('test_button_color')
      expect(retrievedTest).toEqual(testConfig)
    })

    it('should throw error if variant weights do not sum to 1', () => {
      const testConfig: ABTest = {
        id: 'invalid_test',
        name: 'Invalid Test',
        description: 'Test with invalid weights',
        startDate: new Date(),
        active: true,
        variants: [
          { id: 'variant1', name: 'Variant 1', description: 'First variant', config: {}, weight: 0.3, active: true },
          { id: 'variant2', name: 'Variant 2', description: 'Second variant', config: {}, weight: 0.3, active: true }
        ],
        metrics: { primary: 'completion_rate', secondary: [] }
      }

      expect(() => framework.createTest(testConfig)).toThrow('Variant weights must sum to 1')
    })

    it('should initialize default tests on creation', () => {
      const activeTests = framework.getActiveTests()
      
      expect(activeTests.length).toBeGreaterThan(0)
      expect(activeTests.some(test => test.id === 'onboarding_flow_style')).toBe(true)
      expect(activeTests.some(test => test.id === 'progress_indicator')).toBe(true)
      expect(activeTests.some(test => test.id === 'error_handling')).toBe(true)
    })
  })

  describe('user assignment', () => {
    it('should assign user to test variant', async () => {
      const variantId = await framework.assignUserToTest('1', 'onboarding_flow_style')
      
      expect(['ai_chat', 'guided_form']).toContain(variantId)
      
      // Second assignment should return same variant
      const secondVariantId = await framework.assignUserToTest('1', 'onboarding_flow_style')
      expect(secondVariantId).toBe(variantId)
    })

    it('should assign different users to variants based on weights', async () => {
      const assignments = new Map<string, string>()
      
      // Assign many users to get statistical distribution
      for (let i = 0; i < 100; i++) {
        const userId = `user_${i}`
        const variantId = await framework.assignUserToTest(userId, 'onboarding_flow_style')
        assignments.set(userId, variantId)
      }

      const aiChatCount = Array.from(assignments.values()).filter(v => v === 'ai_chat').length
      const guidedFormCount = Array.from(assignments.values()).filter(v => v === 'guided_form').length
      
      // Should be roughly equal distribution (50/50 with some variance)
      expect(aiChatCount).toBeGreaterThan(30)
      expect(aiChatCount).toBeLessThan(70)
      expect(guidedFormCount).toBeGreaterThan(30)
      expect(guidedFormCount).toBeLessThan(70)
      expect(aiChatCount + guidedFormCount).toBe(100)
    })

    it('should assign same user to same variant consistently', async () => {
      const userId = 'consistent_user'
      const assignments = []
      
      // Multiple assignments should be consistent
      for (let i = 0; i < 10; i++) {
        const variantId = await framework.assignUserToTest(userId, 'onboarding_flow_style')
        assignments.push(variantId)
      }
      
      // All assignments should be identical
      expect(new Set(assignments).size).toBe(1)
    })

    it('should throw error for inactive test', async () => {
      const testConfig: ABTest = {
        id: 'inactive_test',
        name: 'Inactive Test',
        description: 'Test that is not active',
        startDate: new Date(),
        active: false,
        variants: [
          { id: 'variant1', name: 'Variant 1', description: 'First variant', config: {}, weight: 1.0, active: true }
        ],
        metrics: { primary: 'completion_rate', secondary: [] }
      }
      
      framework.createTest(testConfig)
      
      await expect(framework.assignUserToTest('1', 'inactive_test')).rejects.toThrow('Test inactive_test not found or inactive')
    })

    it('should handle target audience filtering', async () => {
      const testConfig: ABTest = {
        id: 'beginner_only_test',
        name: 'Beginner Only Test',
        description: 'Test only for beginners',
        startDate: new Date(),
        active: true,
        variants: [
          { id: 'control', name: 'Control', description: 'Control variant', config: {}, weight: 0.5, active: true },
          { id: 'treatment', name: 'Treatment', description: 'Treatment variant', config: {}, weight: 0.5, active: true }
        ],
        targetAudience: {
          experience: ['beginner']
        },
        metrics: { primary: 'completion_rate', secondary: [] }
      }
      
      framework.createTest(testConfig)
      
      // User 1 is beginner, should get assigned normally
      const beginnerVariant = await framework.assignUserToTest('1', 'beginner_only_test')
      expect(['control', 'treatment']).toContain(beginnerVariant)
      
      // User 2 is intermediate, should get control variant
      const intermediateVariant = await framework.assignUserToTest('2', 'beginner_only_test')
      expect(intermediateVariant).toBe('control')
    })
  })

  describe('variant management', () => {
    it('should get user variant for test', async () => {
      const variantId = await framework.assignUserToTest('1', 'onboarding_flow_style')
      const retrievedVariant = framework.getUserVariant('1', 'onboarding_flow_style')
      
      expect(retrievedVariant).toBe(variantId)
    })

    it('should return null for unassigned user', () => {
      const variant = framework.getUserVariant('unassigned_user', 'onboarding_flow_style')
      expect(variant).toBeNull()
    })

    it('should get variant configuration', async () => {
      await framework.assignUserToTest('1', 'onboarding_flow_style')
      const config = await framework.getVariantConfig('1', 'onboarding_flow_style')
      
      expect(config).not.toBeNull()
      expect(typeof config).toBe('object')
      expect(config).toHaveProperty('useAIChat')
    })

    it('should return null config for unassigned user', async () => {
      const config = await framework.getVariantConfig('unassigned_user', 'onboarding_flow_style')
      expect(config).toBeNull()
    })

    it('should enable/disable variants', () => {
      framework.setVariantActive('onboarding_flow_style', 'ai_chat', false)
      
      const test = framework.getTest('onboarding_flow_style')
      const aiChatVariant = test?.variants.find(v => v.id === 'ai_chat')
      
      expect(aiChatVariant?.active).toBe(false)
    })
  })

  describe('event tracking', () => {
    it('should track A/B test events', async () => {
      await framework.assignUserToTest('1', 'onboarding_flow_style')
      
      // Should not throw
      await expect(framework.trackTestEvent('1', 'onboarding_flow_style', 'button_click', 1, { location: 'header' }))
        .resolves.toBeUndefined()
    })

    it('should ignore events for unassigned users', async () => {
      // Should not throw even for unassigned user
      await expect(framework.trackTestEvent('unassigned_user', 'onboarding_flow_style', 'button_click'))
        .resolves.toBeUndefined()
    })
  })

  describe('statistical analysis', () => {
    it('should calculate statistical significance', () => {
      const control = {
        testId: 'test1',
        variant: 'control',
        sampleSize: 1000,
        conversionRate: 0.10,
        averageValue: 0.10,
        standardError: 0.01,
        confidenceInterval: { lower: 0.08, upper: 0.12 },
        significanceLevel: 0.95,
        isSignificant: false
      }
      
      const treatment = {
        testId: 'test1',
        variant: 'treatment',
        sampleSize: 1000,
        conversionRate: 0.15,
        averageValue: 0.15,
        standardError: 0.012,
        confidenceInterval: { lower: 0.126, upper: 0.174 },
        significanceLevel: 0.95,
        isSignificant: true
      }
      
      const significance = framework.calculateSignificance(control, treatment)
      
      expect(significance).toHaveProperty('pValue')
      expect(significance).toHaveProperty('zScore')
      expect(significance).toHaveProperty('effectSize')
      expect(significance).toHaveProperty('confidenceLevel')
      expect(significance).toHaveProperty('isSignificant')
      expect(significance).toHaveProperty('recommendation')
      
      expect(typeof significance.pValue).toBe('number')
      expect(typeof significance.zScore).toBe('number')
      expect(typeof significance.effectSize).toBe('number')
      expect(significance.effectSize).toBeCloseTo(0.05, 2)
      expect(['continue', 'stop_winner', 'stop_no_difference', 'need_more_data']).toContain(significance.recommendation)
    })

    it('should recommend more data for small samples', () => {
      const control = {
        testId: 'test1',
        variant: 'control',
        sampleSize: 50,
        conversionRate: 0.10,
        averageValue: 0.10,
        standardError: 0.04,
        confidenceInterval: { lower: 0.02, upper: 0.18 },
        significanceLevel: 0.95,
        isSignificant: false
      }
      
      const treatment = {
        testId: 'test1',
        variant: 'treatment',
        sampleSize: 50,
        conversionRate: 0.12,
        averageValue: 0.12,
        standardError: 0.045,
        confidenceInterval: { lower: 0.03, upper: 0.21 },
        significanceLevel: 0.95,
        isSignificant: false
      }
      
      const significance = framework.calculateSignificance(control, treatment)
      
      expect(significance.recommendation).toBe('need_more_data')
    })
  })

  describe('test results', () => {
    it('should get test results for all variants', async () => {
      const results = await framework.getTestResults('onboarding_flow_style')
      
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(2) // ai_chat and guided_form
      
      results.forEach(result => {
        expect(result).toHaveProperty('testId')
        expect(result).toHaveProperty('variant')
        expect(result).toHaveProperty('sampleSize')
        expect(result).toHaveProperty('conversionRate')
        expect(result).toHaveProperty('standardError')
        expect(result).toHaveProperty('confidenceInterval')
        expect(result).toHaveProperty('isSignificant')
        
        expect(result.testId).toBe('onboarding_flow_style')
        expect(['ai_chat', 'guided_form']).toContain(result.variant)
        expect(result.sampleSize).toBeGreaterThan(0)
        expect(result.conversionRate).toBeGreaterThanOrEqual(0)
        expect(result.conversionRate).toBeLessThanOrEqual(1)
      })
    })

    it('should throw error for non-existent test', async () => {
      await expect(framework.getTestResults('non_existent_test'))
        .rejects.toThrow('Test non_existent_test not found')
    })
  })

  describe('test management', () => {
    it('should stop active test', () => {
      framework.stopTest('onboarding_flow_style', 'manual_stop')
      
      const test = framework.getTest('onboarding_flow_style')
      expect(test?.active).toBe(false)
      expect(test?.endDate).toBeInstanceOf(Date)
    })

    it('should get all active tests', () => {
      const activeTests = framework.getActiveTests()
      
      expect(Array.isArray(activeTests)).toBe(true)
      activeTests.forEach(test => {
        expect(test.active).toBe(true)
      })
    })

    it('should filter out inactive tests from active list', () => {
      framework.stopTest('onboarding_flow_style')
      
      const activeTests = framework.getActiveTests()
      const stoppedTest = activeTests.find(test => test.id === 'onboarding_flow_style')
      
      expect(stoppedTest).toBeUndefined()
    })

    it('should handle stopping non-existent test gracefully', () => {
      expect(() => framework.stopTest('non_existent_test')).not.toThrow()
    })
  })

  describe('weight-based assignment', () => {
    it('should respect variant weights in assignment', async () => {
      const testConfig: ABTest = {
        id: 'weighted_test',
        name: 'Weighted Test',
        description: 'Test with unequal weights',
        startDate: new Date(),
        active: true,
        variants: [
          { id: 'control', name: 'Control', description: 'Control variant', config: {}, weight: 0.8, active: true },
          { id: 'treatment', name: 'Treatment', description: 'Treatment variant', config: {}, weight: 0.2, active: true }
        ],
        metrics: { primary: 'completion_rate', secondary: [] }
      }
      
      framework.createTest(testConfig)
      
      const assignments = new Map<string, string>()
      
      // Assign many users
      for (let i = 0; i < 1000; i++) {
        const userId = `user_${i}`
        const variantId = await framework.assignUserToTest(userId, 'weighted_test')
        assignments.set(userId, variantId)
      }
      
      const controlCount = Array.from(assignments.values()).filter(v => v === 'control').length
      const treatmentCount = Array.from(assignments.values()).filter(v => v === 'treatment').length
      
      // Should respect 80/20 split (with some variance)
      expect(controlCount).toBeGreaterThan(750) // ~80% with variance
      expect(controlCount).toBeLessThan(850)
      expect(treatmentCount).toBeGreaterThan(150) // ~20% with variance
      expect(treatmentCount).toBeLessThan(250)
    })

    it('should only assign to active variants', async () => {
      framework.setVariantActive('onboarding_flow_style', 'ai_chat', false)
      
      const assignments = []
      for (let i = 0; i < 10; i++) {
        const userId = `user_${i}`
        const variantId = await framework.assignUserToTest(userId, 'onboarding_flow_style')
        assignments.push(variantId)
      }
      
      // Should only assign to guided_form since ai_chat is inactive
      expect(assignments.every(assignment => assignment === 'guided_form')).toBe(true)
    })

    it('should throw error when no variants are active', async () => {
      framework.setVariantActive('onboarding_flow_style', 'ai_chat', false)
      framework.setVariantActive('onboarding_flow_style', 'guided_form', false)
      
      await expect(framework.assignUserToTest('1', 'onboarding_flow_style'))
        .rejects.toThrow('No active variants available')
    })
  })
})