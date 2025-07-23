import { describe, it, expect, beforeEach, vi } from 'vitest'
import { OnboardingAnalyticsProcessor } from './analyticsProcessor'
import { db } from './db'

// Mock the analytics module
vi.mock('./analytics', () => ({
  trackAnalyticsEvent: vi.fn()
}))

describe('OnboardingAnalyticsProcessor', () => {
  let processor: OnboardingAnalyticsProcessor

  beforeEach(async () => {
    processor = new OnboardingAnalyticsProcessor()
    processor.clearCache()

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
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02')
      },
      {
        id: 2,
        name: 'Jane Smith',
        experience: 'intermediate',
        age: 30,
        goal: 'weight_loss',
        daysPerWeek: 4,
        preferredTimes: ['evening'],
        onboardingComplete: false,
        currentStreak: 0,
        createdAt: new Date('2024-01-03'),
        updatedAt: new Date('2024-01-03')
      },
      {
        id: 3,
        name: 'Bob Wilson',
        experience: 'advanced',
        age: 35,
        goal: 'performance',
        daysPerWeek: 5,
        preferredTimes: ['morning', 'evening'],
        onboardingComplete: true,
        currentStreak: 12,
        createdAt: new Date('2024-01-05'),
        updatedAt: new Date('2024-01-06')
      }
    ])
  })

  describe('calculateCompletionRates', () => {
    it('should calculate overall completion rate correctly', async () => {
      const metrics = await processor.calculateCompletionRates()
      
      expect(metrics.overall).toBeCloseTo(2/3, 2) // 2 completed out of 3 total
      expect(metrics.bySegment.beginner).toBeCloseTo(1, 2) // 1/1 completed
      expect(metrics.bySegment.intermediate).toBeCloseTo(0, 2) // 0/1 completed
      expect(metrics.bySegment.advanced).toBeCloseTo(1, 2) // 1/1 completed
    })

    it('should return zero completion rate for empty database', async () => {
      await db.users.clear()
      
      const metrics = await processor.calculateCompletionRates()
      
      expect(metrics.overall).toBe(0)
      expect(metrics.bySegment.beginner).toBe(0)
      expect(metrics.bySegment.intermediate).toBe(0)
      expect(metrics.bySegment.advanced).toBe(0)
    })

    it('should include trends data', async () => {
      const metrics = await processor.calculateCompletionRates()
      
      expect(metrics.trends).toHaveLength(30)
      expect(metrics.trends[0]).toHaveProperty('date')
      expect(metrics.trends[0]).toHaveProperty('rate')
      expect(typeof metrics.trends[0].rate).toBe('number')
    })

    it('should include benchmark data', async () => {
      const metrics = await processor.calculateCompletionRates()
      
      expect(metrics.benchmarks).toHaveProperty('good')
      expect(metrics.benchmarks).toHaveProperty('average')
      expect(metrics.benchmarks).toHaveProperty('poor')
      expect(metrics.benchmarks.good).toBeGreaterThan(metrics.benchmarks.average)
      expect(metrics.benchmarks.average).toBeGreaterThan(metrics.benchmarks.poor)
    })

    it('should cache results', async () => {
      const metrics1 = await processor.calculateCompletionRates()
      const metrics2 = await processor.calculateCompletionRates()
      
      expect(metrics1).toEqual(metrics2)
    })
  })

  describe('analyzeDropOffPoints', () => {
    it('should return drop-off analysis with all required fields', async () => {
      const analysis = await processor.analyzeDropOffPoints()
      
      expect(analysis).toHaveProperty('dropOffPoints')
      expect(analysis).toHaveProperty('dropOffReasons')
      expect(analysis).toHaveProperty('patterns')
      expect(analysis).toHaveProperty('insights')
      
      expect(Array.isArray(analysis.dropOffPoints)).toBe(true)
      expect(Array.isArray(analysis.patterns)).toBe(true)
      expect(Array.isArray(analysis.insights)).toBe(true)
    })

    it('should include step-wise drop-off data', async () => {
      const analysis = await processor.analyzeDropOffPoints()
      
      analysis.dropOffPoints.forEach(point => {
        expect(point).toHaveProperty('step')
        expect(point).toHaveProperty('rate')
        expect(point).toHaveProperty('count')
        expect(typeof point.rate).toBe('number')
        expect(typeof point.count).toBe('number')
        expect(point.rate).toBeGreaterThanOrEqual(0)
        expect(point.rate).toBeLessThanOrEqual(1)
      })
    })

    it('should provide actionable insights', async () => {
      const analysis = await processor.analyzeDropOffPoints()
      
      expect(analysis.insights.length).toBeGreaterThan(0)
      analysis.insights.forEach(insight => {
        expect(typeof insight).toBe('string')
        expect(insight.length).toBeGreaterThan(0)
      })
    })
  })

  describe('calculateErrorRates', () => {
    it('should return error metrics with all required fields', async () => {
      const metrics = await processor.calculateErrorRates()
      
      expect(metrics).toHaveProperty('overall')
      expect(metrics).toHaveProperty('byType')
      expect(metrics).toHaveProperty('recoveryRates')
      expect(metrics).toHaveProperty('impactOnCompletion')
      expect(metrics).toHaveProperty('trends')
      
      expect(typeof metrics.overall).toBe('number')
      expect(typeof metrics.impactOnCompletion).toBe('number')
      expect(Array.isArray(metrics.trends)).toBe(true)
    })

    it('should include error breakdown by type', async () => {
      const metrics = await processor.calculateErrorRates()
      
      Object.entries(metrics.byType).forEach(([errorType, data]) => {
        expect(data).toHaveProperty('count')
        expect(data).toHaveProperty('rate')
        expect(typeof data.count).toBe('number')
        expect(typeof data.rate).toBe('number')
        expect(data.rate).toBeGreaterThanOrEqual(0)
      })
    })

    it('should include recovery rates for each error type', async () => {
      const metrics = await processor.calculateErrorRates()
      
      Object.values(metrics.recoveryRates).forEach(rate => {
        expect(typeof rate).toBe('number')
        expect(rate).toBeGreaterThanOrEqual(0)
        expect(rate).toBeLessThanOrEqual(1)
      })
    })

    it('should include error trends', async () => {
      const metrics = await processor.calculateErrorRates()
      
      expect(metrics.trends.length).toBeGreaterThan(0)
      metrics.trends.forEach(trend => {
        expect(trend).toHaveProperty('date')
        expect(trend).toHaveProperty('errorRate')
        expect(trend).toHaveProperty('recoveryRate')
        expect(typeof trend.errorRate).toBe('number')
        expect(typeof trend.recoveryRate).toBe('number')
      })
    })
  })

  describe('analyzeUserJourney', () => {
    it('should return user journey metrics', async () => {
      const metrics = await processor.analyzeUserJourney()
      
      expect(metrics).toHaveProperty('averageTimePerStep')
      expect(metrics).toHaveProperty('conversionFunnels')
      expect(metrics).toHaveProperty('optimizationOpportunities')
      expect(metrics).toHaveProperty('flowVisualization')
    })

    it('should include time data for each step', async () => {
      const metrics = await processor.analyzeUserJourney()
      
      Object.entries(metrics.averageTimePerStep).forEach(([step, time]) => {
        expect(typeof step).toBe('string')
        expect(typeof time).toBe('number')
        expect(time).toBeGreaterThan(0)
      })
    })

    it('should include conversion funnel data', async () => {
      const metrics = await processor.analyzeUserJourney()
      
      expect(Array.isArray(metrics.conversionFunnels)).toBe(true)
      metrics.conversionFunnels.forEach(step => {
        expect(step).toHaveProperty('step')
        expect(step).toHaveProperty('users')
        expect(step).toHaveProperty('conversionRate')
        expect(typeof step.users).toBe('number')
        expect(typeof step.conversionRate).toBe('number')
        expect(step.conversionRate).toBeGreaterThanOrEqual(0)
        expect(step.conversionRate).toBeLessThanOrEqual(1)
      })
    })

    it('should include optimization opportunities', async () => {
      const metrics = await processor.analyzeUserJourney()
      
      expect(Array.isArray(metrics.optimizationOpportunities)).toBe(true)
      metrics.optimizationOpportunities.forEach(opportunity => {
        expect(opportunity).toHaveProperty('step')
        expect(opportunity).toHaveProperty('issue')
        expect(opportunity).toHaveProperty('impact')
        expect(['high', 'medium', 'low']).toContain(opportunity.impact)
      })
    })

    it('should include flow visualization data', async () => {
      const metrics = await processor.analyzeUserJourney()
      
      expect(metrics.flowVisualization).toHaveProperty('nodes')
      expect(metrics.flowVisualization).toHaveProperty('edges')
      expect(Array.isArray(metrics.flowVisualization.nodes)).toBe(true)
      expect(Array.isArray(metrics.flowVisualization.edges)).toBe(true)
      
      metrics.flowVisualization.nodes.forEach(node => {
        expect(node).toHaveProperty('id')
        expect(node).toHaveProperty('label')
        expect(node).toHaveProperty('users')
        expect(typeof node.users).toBe('number')
      })
      
      metrics.flowVisualization.edges.forEach(edge => {
        expect(edge).toHaveProperty('from')
        expect(edge).toHaveProperty('to')
        expect(edge).toHaveProperty('users')
        expect(edge).toHaveProperty('dropOffRate')
        expect(typeof edge.users).toBe('number')
        expect(typeof edge.dropOffRate).toBe('number')
      })
    })
  })

  describe('getRealTimeMetrics', () => {
    it('should return real-time metrics without caching', async () => {
      const metrics1 = await processor.getRealTimeMetrics()
      const metrics2 = await processor.getRealTimeMetrics()
      
      expect(metrics1).toHaveProperty('activeUsers')
      expect(metrics1).toHaveProperty('currentCompletionRate')
      expect(metrics1).toHaveProperty('recentErrors')
      expect(metrics1).toHaveProperty('sessionsInProgress')
      
      // Real-time data should potentially be different each call
      expect(typeof metrics1.activeUsers).toBe('number')
      expect(typeof metrics1.currentCompletionRate).toBe('number')
      expect(Array.isArray(metrics1.recentErrors)).toBe(true)
      expect(Array.isArray(metrics1.sessionsInProgress)).toBe(true)
    })

    it('should generate realistic active user count', async () => {
      const metrics = await processor.getRealTimeMetrics()
      
      expect(metrics.activeUsers).toBeGreaterThanOrEqual(5)
      expect(metrics.activeUsers).toBeLessThanOrEqual(30)
    })

    it('should include sessions with current step and time spent', async () => {
      const metrics = await processor.getRealTimeMetrics()
      
      metrics.sessionsInProgress.forEach(session => {
        expect(session).toHaveProperty('id')
        expect(session).toHaveProperty('currentStep')
        expect(session).toHaveProperty('timeSpent')
        expect(typeof session.timeSpent).toBe('number')
        expect(session.timeSpent).toBeGreaterThan(0)
        expect(['motivation', 'assessment', 'creation', 'refinement']).toContain(session.currentStep)
      })
    })
  })

  describe('getDashboardMetrics', () => {
    it('should return complete dashboard metrics', async () => {
      const metrics = await processor.getDashboardMetrics()
      
      expect(metrics).toHaveProperty('completionRate')
      expect(metrics).toHaveProperty('dropOffAnalysis')
      expect(metrics).toHaveProperty('errorRates')
      expect(metrics).toHaveProperty('userJourney')
      expect(metrics).toHaveProperty('realTime')
      expect(metrics).toHaveProperty('lastUpdated')
      
      expect(typeof metrics.lastUpdated).toBe('string')
      expect(new Date(metrics.lastUpdated)).toBeInstanceOf(Date)
    })

    it('should aggregate all metric types', async () => {
      const metrics = await processor.getDashboardMetrics()
      
      // Verify each section has expected structure
      expect(metrics.completionRate.overall).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(metrics.dropOffAnalysis.dropOffPoints)).toBe(true)
      expect(typeof metrics.errorRates.overall).toBe('number')
      expect(typeof metrics.userJourney.averageTimePerStep).toBe('object')
      expect(typeof metrics.realTime.activeUsers).toBe('number')
    })
  })

  describe('cache management', () => {
    it('should cache results to improve performance', async () => {
      const start1 = Date.now()
      await processor.calculateCompletionRates()
      const time1 = Date.now() - start1
      
      const start2 = Date.now()
      await processor.calculateCompletionRates()
      const time2 = Date.now() - start2
      
      // Second call should be faster due to caching
      expect(time2).toBeLessThan(time1)
    })

    it('should clear cache when requested', async () => {
      await processor.calculateCompletionRates()
      
      const statsBefore = processor.getCacheStats()
      expect(statsBefore.entries).toBeGreaterThan(0)
      
      processor.clearCache()
      
      const statsAfter = processor.getCacheStats()
      expect(statsAfter.entries).toBe(0)
      expect(statsAfter.totalSize).toBe(0)
    })

    it('should provide cache statistics', async () => {
      await processor.calculateCompletionRates()
      await processor.analyzeDropOffPoints()
      
      const stats = processor.getCacheStats()
      
      expect(stats).toHaveProperty('entries')
      expect(stats).toHaveProperty('totalSize')
      expect(typeof stats.entries).toBe('number')
      expect(typeof stats.totalSize).toBe('number')
      expect(stats.entries).toBeGreaterThan(0)
      expect(stats.totalSize).toBeGreaterThan(0)
    })
  })

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      const originalToArray = db.users.toArray
      db.users.toArray = vi.fn().mockRejectedValue(new Error('Database error'))
      
      await expect(processor.calculateCompletionRates()).rejects.toThrow('Database error')
      
      // Restore original method
      db.users.toArray = originalToArray
    })

    it('should handle empty database gracefully', async () => {
      await db.users.clear()
      
      const metrics = await processor.calculateCompletionRates()
      
      expect(metrics.overall).toBe(0)
      expect(Object.values(metrics.bySegment).every(rate => rate === 0)).toBe(true)
    })
  })
})