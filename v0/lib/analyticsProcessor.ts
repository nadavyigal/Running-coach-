import { db } from './db'
import { OnboardingPhase } from './onboardingAnalytics'

// Analytics aggregation interfaces
export interface CompletionRateMetrics {
  overall: number
  bySegment: Record<string, number>
  trends: Array<{ date: string; rate: number }>
  benchmarks: { good: number; average: number; poor: number }
}

export interface DropOffAnalysis {
  dropOffPoints: Array<{ step: string; rate: number; count: number }>
  dropOffReasons: Record<string, number>
  patterns: Array<{ pattern: string; frequency: number }>
  insights: string[]
}

export interface ErrorRateMetrics {
  overall: number
  byType: Record<string, { count: number; rate: number }>
  recoveryRates: Record<string, number>
  impactOnCompletion: number
  trends: Array<{ date: string; errorRate: number; recoveryRate: number }>
}

export interface UserJourneyMetrics {
  averageTimePerStep: Record<string, number>
  conversionFunnels: Array<{ step: string; users: number; conversionRate: number }>
  optimizationOpportunities: Array<{ step: string; issue: string; impact: 'high' | 'medium' | 'low' }>
  flowVisualization: {
    nodes: Array<{ id: string; label: string; users: number }>
    edges: Array<{ from: string; to: string; users: number; dropOffRate: number }>
  }
}

export interface RealTimeMetrics {
  activeUsers: number
  currentCompletionRate: number
  recentErrors: Array<{ timestamp: string; type: string; message: string }>
  sessionsInProgress: Array<{ id: string; currentStep: string; timeSpent: number }>
}

export interface DashboardMetrics {
  completionRate: CompletionRateMetrics
  dropOffAnalysis: DropOffAnalysis
  errorRates: ErrorRateMetrics
  userJourney: UserJourneyMetrics
  realTime: RealTimeMetrics
  lastUpdated: string
}

// Analytics processor class
export class OnboardingAnalyticsProcessor {
  private cache: Map<string, { data: any; timestamp: number }> = new Map()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Get cached data or compute if expired
   */
  private async getCachedOrCompute<T>(
    key: string,
    computeFn: () => Promise<T>
  ): Promise<T> {
    const cached = this.cache.get(key)
    const now = Date.now()

    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      return cached.data as T
    }

    const data = await computeFn()
    this.cache.set(key, { data, timestamp: now })
    return data
  }

  /**
   * Calculate completion rate metrics
   */
  async calculateCompletionRates(): Promise<CompletionRateMetrics> {
    return this.getCachedOrCompute('completion-rates', async () => {
      // Get all users and their onboarding status
      const users = await db.users.toArray()
      const totalUsers = users.length
      const completedUsers = users.filter(u => u.onboardingComplete).length
      
      const overall = totalUsers > 0 ? completedUsers / totalUsers : 0

      // Calculate by segment (experience level)
      const bySegment: Record<string, number> = {}
      const segments = ['beginner', 'intermediate', 'advanced']
      
      segments.forEach(segment => {
        const segmentUsers = users.filter(u => u.experience === segment)
        const segmentCompleted = segmentUsers.filter(u => u.onboardingComplete)
        bySegment[segment] = segmentUsers.length > 0 ? segmentCompleted.length / segmentUsers.length : 0
      })

      // Calculate trends (last 30 days)
      const trends = await this.calculateCompletionTrends()

      // Benchmarks based on industry standards
      const benchmarks = {
        good: 0.8,
        average: 0.6,
        poor: 0.4
      }

      return { overall, bySegment, trends, benchmarks }
    })
  }

  /**
   * Calculate completion trends over time
   */
  private async calculateCompletionTrends(): Promise<Array<{ date: string; rate: number }>> {
    const trends: Array<{ date: string; rate: number }> = []
    const now = new Date()
    
    // Generate last 30 days of data
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      // In a real implementation, this would query actual completion events
      // For now, we'll simulate based on user creation dates. We avoid using
      // a non-indexed 'createdAt' field in Dexie queries to prevent
      // IDBKeyRange errors by filtering in JavaScript instead.
      const users = (await db.users.toArray()).filter(u => u.createdAt < date)
      const completed = users.filter(u => u.onboardingComplete && u.updatedAt <= date)
      const rate = users.length > 0 ? completed.length / users.length : 0
      
      trends.push({ date: dateStr, rate })
    }
    
    return trends
  }

  /**
   * Analyze drop-off points
   */
  async analyzeDropOffPoints(): Promise<DropOffAnalysis> {
    return this.getCachedOrCompute('drop-off-analysis', async () => {
      // In a real implementation, this would analyze actual user journey data
      // For now, we'll create representative data
      const dropOffPoints = [
        { step: 'motivation', rate: 0.15, count: 45 },
        { step: 'assessment', rate: 0.25, count: 75 },
        { step: 'creation', rate: 0.35, count: 105 },
        { step: 'refinement', rate: 0.20, count: 60 }
      ]

      const dropOffReasons = {
        'form_too_long': 35,
        'unclear_instructions': 28,
        'technical_issues': 20,
        'lost_interest': 17
      }

      const patterns = [
        { pattern: 'Users drop off after 3+ form fields', frequency: 42 },
        { pattern: 'Mobile users have higher drop-off on assessment', frequency: 38 },
        { pattern: 'Evening users more likely to complete', frequency: 31 }
      ]

      const insights = [
        'Reduce form fields in assessment phase',
        'Improve mobile UX for goal setting',
        'Add progress indicators to reduce uncertainty',
        'Implement save-and-resume functionality'
      ]

      return { dropOffPoints, dropOffReasons, patterns, insights }
    })
  }

  /**
   * Calculate error rate metrics
   */
  async calculateErrorRates(): Promise<ErrorRateMetrics> {
    return this.getCachedOrCompute('error-rates', async () => {
      // In a real implementation, this would analyze actual error events
      const overall = 0.12 // 12% error rate

      const byType = {
        'network_failure': { count: 45, rate: 0.05 },
        'validation_error': { count: 38, rate: 0.04 },
        'api_timeout': { count: 22, rate: 0.02 },
        'plan_generation_failure': { count: 8, rate: 0.01 }
      }

      const recoveryRates = {
        'network_failure': 0.85,
        'validation_error': 0.92,
        'api_timeout': 0.75,
        'plan_generation_failure': 0.65
      }

      const impactOnCompletion = 0.25 // 25% reduction in completion rate

      // Generate error trends
      const trends = []
      const now = new Date()
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        trends.push({
          date: date.toISOString().split('T')[0],
          errorRate: 0.08 + (Math.random() * 0.08), // Simulate variance
          recoveryRate: 0.75 + (Math.random() * 0.2)
        })
      }

      return { overall, byType, recoveryRates, impactOnCompletion, trends }
    })
  }

  /**
   * Analyze user journey metrics
   */
  async analyzeUserJourney(): Promise<UserJourneyMetrics> {
    return this.getCachedOrCompute('user-journey', async () => {
      const averageTimePerStep = {
        'motivation': 120000, // 2 minutes
        'assessment': 180000, // 3 minutes
        'creation': 240000,   // 4 minutes
        'refinement': 150000  // 2.5 minutes
      }

      const conversionFunnels = [
        { step: 'start', users: 1000, conversionRate: 1.0 },
        { step: 'motivation', users: 850, conversionRate: 0.85 },
        { step: 'assessment', users: 638, conversionRate: 0.75 },
        { step: 'creation', users: 415, conversionRate: 0.65 },
        { step: 'complete', users: 332, conversionRate: 0.80 }
      ]

      const optimizationOpportunities = [
        { step: 'assessment', issue: 'High drop-off rate', impact: 'high' as const },
        { step: 'creation', issue: 'Long completion time', impact: 'medium' as const },
        { step: 'motivation', issue: 'User confusion', impact: 'medium' as const }
      ]

      const flowVisualization = {
        nodes: [
          { id: 'start', label: 'Start Onboarding', users: 1000 },
          { id: 'motivation', label: 'Goal Discovery', users: 850 },
          { id: 'assessment', label: 'Assessment', users: 638 },
          { id: 'creation', label: 'Plan Creation', users: 415 },
          { id: 'complete', label: 'Completed', users: 332 }
        ],
        edges: [
          { from: 'start', to: 'motivation', users: 850, dropOffRate: 0.15 },
          { from: 'motivation', to: 'assessment', users: 638, dropOffRate: 0.25 },
          { from: 'assessment', to: 'creation', users: 415, dropOffRate: 0.35 },
          { from: 'creation', to: 'complete', users: 332, dropOffRate: 0.20 }
        ]
      }

      return { averageTimePerStep, conversionFunnels, optimizationOpportunities, flowVisualization }
    })
  }

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    // Real-time data should not be cached
    const activeUsers = Math.floor(Math.random() * 25) + 5 // Simulate 5-30 active users
    const currentCompletionRate = 0.65 + (Math.random() * 0.2) // 65-85%
    
    const recentErrors = [
      { timestamp: new Date(Date.now() - 300000).toISOString(), type: 'network_failure', message: 'Failed to connect to AI service' },
      { timestamp: new Date(Date.now() - 180000).toISOString(), type: 'validation_error', message: 'Invalid goal format' }
    ]

    const sessionsInProgress = Array.from({ length: activeUsers }, (_, i) => ({
      id: `session_${i + 1}`,
      currentStep: ['motivation', 'assessment', 'creation', 'refinement'][Math.floor(Math.random() * 4)],
      timeSpent: Math.floor(Math.random() * 600000) + 60000 // 1-10 minutes
    }))

    return { activeUsers, currentCompletionRate, recentErrors, sessionsInProgress }
  }

  /**
   * Get all dashboard metrics
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const [completionRate, dropOffAnalysis, errorRates, userJourney, realTime] = await Promise.all([
      this.calculateCompletionRates(),
      this.analyzeDropOffPoints(),
      this.calculateErrorRates(),
      this.analyzeUserJourney(),
      this.getRealTimeMetrics()
    ])

    return {
      completionRate,
      dropOffAnalysis,
      errorRates,
      userJourney,
      realTime,
      lastUpdated: new Date().toISOString()
    }
  }

  /**
   * Clear analytics cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { entries: number; totalSize: number } {
    const entries = this.cache.size
    const totalSize = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + JSON.stringify(entry.data).length, 0)
    
    return { entries, totalSize }
  }
}

// Singleton instance
export const analyticsProcessor = new OnboardingAnalyticsProcessor()
