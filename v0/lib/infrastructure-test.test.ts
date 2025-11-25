import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  trackAnalyticsEvent, 
  trackOnboardingChatMessage, 
  trackConversationPhase,
  trackAIGuidanceUsage,
  trackOnboardingCompletion,
  trackError
} from '@/lib/analytics'
import { 
  analyzeError, 
  ValidationError, 
  NetworkError,
  formatErrorResponse 
} from '@/lib/errorHandling'
import { db } from '@/lib/db'
import { dbUtils } from '@/lib/dbUtils'
import { 
  createTestUser, 
  createTestWorkout, 
  createTestPlan,
  resetAllMocks,
  measurePerformance,
  expectPerformance
} from '@/lib/test-utils'

describe('Test Infrastructure Hardening', () => {
  beforeEach(() => {
    resetAllMocks()
  })

  describe('Analytics Mocking', () => {
    it('should mock all analytics functions properly', async () => {
      await trackAnalyticsEvent('test_event', { prop: 'value' })
      await trackOnboardingChatMessage({ message: 'test' })
      await trackConversationPhase({ phase: 'motivation' })
      await trackAIGuidanceUsage({ usage: 'plan_generation' })
      await trackOnboardingCompletion({ completed: true })
      await trackError({ error: 'test_error' })

      expect(trackAnalyticsEvent).toHaveBeenCalledWith('test_event', { prop: 'value' })
      expect(trackOnboardingChatMessage).toHaveBeenCalledWith({ message: 'test' })
      expect(trackConversationPhase).toHaveBeenCalledWith({ phase: 'motivation' })
      expect(trackAIGuidanceUsage).toHaveBeenCalledWith({ usage: 'plan_generation' })
      expect(trackOnboardingCompletion).toHaveBeenCalledWith({ completed: true })
      expect(trackError).toHaveBeenCalledWith({ error: 'test_error' })
    })

    it('should execute analytics calls quickly', async () => {
      await expectPerformance(async () => {
        await trackAnalyticsEvent('performance_test')
      }, 50) // Should complete in less than 50ms
    })
  })

  describe('Error Handling Mocking', () => {
    it('should mock error analysis functions properly', () => {
      const testError = new Error('Test error')
      const result = analyzeError(testError)

      expect(result).toEqual({
        error: expect.any(Error),
        errorType: 'network',
        userMessage: 'Network error occurred',
        canRetry: true,
        suggestedAction: 'Check your network connection and try again',
        fallbackOptions: ['Try again later', 'Check network settings']
      })
    })

    it('should create proper error instances', () => {
      const validationError = new ValidationError('Test validation error')
      const networkError = new NetworkError('Test network error')

      expect(validationError).toMatchObject({
        message: 'Test validation error',
        statusCode: 400,
        code: 'VALIDATION_ERROR'
      })

      expect(networkError).toMatchObject({
        message: 'Test network error',
        statusCode: 503,
        code: 'NETWORK_ERROR'
      })
    })

    it('should mock error response formatting', () => {
      const error = new ValidationError('Invalid input')
      const response = formatErrorResponse(error)

      expect(response).toBeInstanceOf(Response)
      expect(formatErrorResponse).toHaveBeenCalledWith(error)
    })
  })

  describe('Database Mocking', () => {
    it('should mock database operations properly', async () => {
      const user = await dbUtils.getCurrentUser()
      const users = await db.users.toArray()

      expect(user).toEqual({
        id: 1,
        name: 'Test User',
        goal: 'habit',
        experience: 'beginner',
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: false },
        onboardingComplete: true,
        currentStreak: 5,
        cohortId: 1,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })

      expect(users).toHaveLength(1)
      expect(users[0]).toEqual(user)
    })

    it('should mock database operations with proper performance', async () => {
      await expectPerformance(async () => {
        await dbUtils.getCurrentUser()
        await db.users.toArray()
        await db.plans.toArray()
        await db.workouts.toArray()
      }, 100) // Should complete in less than 100ms
    })

    it('should support database queries with chaining', async () => {
      const user = await db.users.where('id').equals(1).first()
      const userPlans = await db.plans.where('userId').equals(1).toArray()

      expect(user).toBeDefined()
      expect(userPlans).toEqual([])
    })
  })

  describe('Test Data Factories', () => {
    it('should create consistent test data', () => {
      const user1 = createTestUser()
      const user2 = createTestUser({ name: 'Custom User' })
      const workout = createTestWorkout()
      const plan = createTestPlan()

      expect(user1).toMatchObject({
        id: 1,
        name: 'Test User',
        goal: 'habit',
        experience: 'beginner'
      })

      expect(user2).toMatchObject({
        id: 1,
        name: 'Custom User', // Override should work
        goal: 'habit',
        experience: 'beginner'
      })

      expect(workout).toMatchObject({
        id: 1,
        planId: 1,
        userId: 1,
        type: 'run'
      })

      expect(plan).toMatchObject({
        id: 1,
        userId: 1,
        name: 'Test Training Plan'
      })
    })

    it('should generate test data quickly', () => {
      const duration = measurePerformance(() => {
        for (let i = 0; i < 100; i++) {
          createTestUser({ id: i })
          createTestWorkout({ id: i })
          createTestPlan({ id: i })
        }
      })

      expect(duration).toBeLessThan(50) // Should create 300 objects in less than 50ms
    })
  })

  describe('Performance Optimization', () => {
    it('should complete mock operations quickly', async () => {
      const operations = [
        () => trackAnalyticsEvent('perf_test'),
        () => dbUtils.getCurrentUser(),
        () => db.users.toArray(),
        () => analyzeError(new Error('perf test')),
        () => createTestUser()
      ]

      for (const operation of operations) {
        await expectPerformance(operation, 10) // Each operation should be under 10ms
      }
    })

    it('should handle concurrent operations efficiently', async () => {
      const concurrentOps = Array.from({ length: 10 }, (_, i) => 
        Promise.all([
          trackAnalyticsEvent(`concurrent_${i}`),
          dbUtils.getCurrentUser(),
          db.users.where('id').equals(i).first()
        ])
      )

      await expectPerformance(async () => {
        await Promise.all(concurrentOps)
      }, 100) // 30 concurrent operations should complete in under 100ms
    })
  })

  describe('Test Isolation', () => {
    it('should properly reset mocks between tests', () => {
      // Call some functions
      trackAnalyticsEvent('isolation_test_1')
      dbUtils.getCurrentUser()

      resetAllMocks()

      // Verify mocks are cleared
      expect(trackAnalyticsEvent).not.toHaveBeenCalled()
      expect(dbUtils.getCurrentUser).not.toHaveBeenCalled()
    })

    it('should maintain independent test state', async () => {
      // This test should not be affected by previous test calls
      const user = await dbUtils.getCurrentUser()
      expect(user).toBeDefined()
      expect(dbUtils.getCurrentUser).toHaveBeenCalledTimes(1)
    })
  })

  describe('Memory Management', () => {
    it('should not leak memory with repeated mock calls', async () => {
      const initialHeapUsed = process.memoryUsage().heapUsed

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        await trackAnalyticsEvent(`memory_test_${i}`)
        await dbUtils.getCurrentUser()
        createTestUser({ id: i })
      }

      const finalHeapUsed = process.memoryUsage().heapUsed
      const heapGrowth = finalHeapUsed - initialHeapUsed

      // Heap growth should be reasonable (less than 10MB for 1000 operations)
      expect(heapGrowth).toBeLessThan(10 * 1024 * 1024)
    })
  })
})