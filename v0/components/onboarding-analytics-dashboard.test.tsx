import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { OnboardingAnalyticsDashboard } from './onboarding-analytics-dashboard'

// Mock the analytics processor and A/B test framework
vi.mock('../lib/analyticsProcessor', () => ({
  analyticsProcessor: {
    getDashboardMetrics: vi.fn().mockResolvedValue({
      completionRate: {
        overall: 0.75,
        bySegment: {
          beginner: 0.8,
          intermediate: 0.7,
          advanced: 0.75
        },
        trends: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          rate: 0.7 + Math.random() * 0.2
        })),
        benchmarks: { good: 0.8, average: 0.6, poor: 0.4 }
      },
      dropOffAnalysis: {
        dropOffPoints: [
          { step: 'motivation', rate: 0.15, count: 45 },
          { step: 'assessment', rate: 0.25, count: 75 },
          { step: 'creation', rate: 0.35, count: 105 }
        ],
        dropOffReasons: {
          'form_too_long': 35,
          'unclear_instructions': 28,
          'technical_issues': 20
        },
        patterns: [
          { pattern: 'Users drop off after 3+ form fields', frequency: 42 }
        ],
        insights: [
          'Reduce form fields in assessment phase',
          'Improve mobile UX for goal setting'
        ]
      },
      errorRates: {
        overall: 0.12,
        byType: {
          'network_failure': { count: 45, rate: 0.05 },
          'validation_error': { count: 38, rate: 0.04 }
        },
        recoveryRates: {
          'network_failure': 0.85,
          'validation_error': 0.92
        },
        impactOnCompletion: 0.25,
        trends: Array.from({ length: 7 }, (_, i) => ({
          date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          errorRate: 0.08 + Math.random() * 0.08,
          recoveryRate: 0.75 + Math.random() * 0.2
        }))
      },
      userJourney: {
        averageTimePerStep: {
          motivation: 120000,
          assessment: 180000,
          creation: 240000,
          refinement: 150000
        },
        conversionFunnels: [
          { step: 'start', users: 1000, conversionRate: 1.0 },
          { step: 'motivation', users: 850, conversionRate: 0.85 },
          { step: 'assessment', users: 638, conversionRate: 0.75 },
          { step: 'complete', users: 332, conversionRate: 0.52 }
        ],
        optimizationOpportunities: [
          { step: 'assessment', issue: 'High drop-off rate', impact: 'high' as const }
        ],
        flowVisualization: {
          nodes: [
            { id: 'start', label: 'Start', users: 1000 },
            { id: 'complete', label: 'Complete', users: 332 }
          ],
          edges: [
            { from: 'start', to: 'complete', users: 332, dropOffRate: 0.668 }
          ]
        }
      },
      realTime: {
        activeUsers: 15,
        currentCompletionRate: 0.72,
        recentErrors: [
          { timestamp: new Date().toISOString(), type: 'network_failure', message: 'Connection timeout' }
        ],
        sessionsInProgress: [
          { id: 'session_1', currentStep: 'assessment', timeSpent: 180000 }
        ]
      },
      lastUpdated: new Date().toISOString()
    })
  }
}))

vi.mock('../lib/abTestFramework', () => ({
  abTestFramework: {
    getActiveTests: vi.fn().mockReturnValue([
      {
        id: 'onboarding_flow_style',
        name: 'Onboarding Flow Style',
        description: 'Test AI chat vs guided form',
        startDate: new Date(),
        active: true,
        variants: [
          { id: 'ai_chat', name: 'AI Chat', description: 'AI guided flow', config: {}, weight: 0.5, active: true },
          { id: 'guided_form', name: 'Guided Form', description: 'Form based flow', config: {}, weight: 0.5, active: true }
        ],
        metrics: { primary: 'completion_rate', secondary: ['time_to_complete'] }
      }
    ]),
    getTestResults: vi.fn().mockResolvedValue([
      {
        testId: 'onboarding_flow_style',
        variant: 'ai_chat',
        sampleSize: 500,
        conversionRate: 0.78,
        averageValue: 0.78,
        standardError: 0.02,
        confidenceInterval: { lower: 0.74, upper: 0.82 },
        significanceLevel: 0.95,
        isSignificant: true
      },
      {
        testId: 'onboarding_flow_style',
        variant: 'guided_form',
        sampleSize: 500,
        conversionRate: 0.72,
        averageValue: 0.72,
        standardError: 0.02,
        confidenceInterval: { lower: 0.68, upper: 0.76 },
        significanceLevel: 0.95,
        isSignificant: true
      }
    ])
  }
}))

describe('OnboardingAnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render loading state initially', () => {
    render(<OnboardingAnalyticsDashboard />)
    
    expect(screen.getByText('Loading analytics dashboard...')).toBeInTheDocument()
  })

  it('should render dashboard with metrics after loading', async () => {
    render(<OnboardingAnalyticsDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Onboarding Analytics')).toBeInTheDocument()
    })
    
    // Check key metrics cards
    expect(screen.getByText('Completion Rate')).toBeInTheDocument()
    expect(screen.getByText('75.0%')).toBeInTheDocument() // Overall completion rate
    expect(screen.getByText('Active Users')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument() // Active users count
    expect(screen.getByText('Error Rate')).toBeInTheDocument()
    expect(screen.getByText('12.0%')).toBeInTheDocument() // Error rate
  })

  it('should render all dashboard tabs', async () => {
    render(<OnboardingAnalyticsDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Onboarding Analytics')).toBeInTheDocument()
    })
    
    // Check all tabs are present
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Completion Rates' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Drop-off Analysis' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Error Monitoring' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'A/B Tests' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Real-time' })).toBeInTheDocument()
  })

  it('should show completion rate trends', async () => {
    render(<OnboardingAnalyticsDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Completion Rate Trend')).toBeInTheDocument()
    })
    
    expect(screen.getByText('Last 30 days')).toBeInTheDocument()
  })

  it('should display user journey funnel', async () => {
    render(<OnboardingAnalyticsDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('User Journey Funnel')).toBeInTheDocument()
    })
    
    // Check funnel steps
    expect(screen.getByText('start')).toBeInTheDocument()
    expect(screen.getByText('motivation')).toBeInTheDocument()
    expect(screen.getByText('assessment')).toBeInTheDocument()
  })

  it('should show segment-based completion rates', async () => {
    render(<OnboardingAnalyticsDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Beginner Users')).toBeInTheDocument()
    })
    
    expect(screen.getByText('Intermediate Users')).toBeInTheDocument()
    expect(screen.getByText('Advanced Users')).toBeInTheDocument()
    expect(screen.getByText('80.0%')).toBeInTheDocument() // Beginner completion rate
  })

  it('should switch between tabs', async () => {
    render(<OnboardingAnalyticsDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Onboarding Analytics')).toBeInTheDocument()
    })
    
    // Click on Completion Rates tab
    const completionTab = screen.getByRole('tab', { name: 'Completion Rates' })
    fireEvent.click(completionTab)
    
    await waitFor(() => {
      expect(screen.getByText('Completion Rate Analysis')).toBeInTheDocument()
    })
    
    // Click on Drop-off Analysis tab
    const dropoffTab = screen.getByRole('tab', { name: 'Drop-off Analysis' })
    fireEvent.click(dropoffTab)
    
    await waitFor(() => {
      expect(screen.getByText('Drop-off Points')).toBeInTheDocument()
    })
  })

  it('should display drop-off analysis data', async () => {
    render(<OnboardingAnalyticsDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Onboarding Analytics')).toBeInTheDocument()
    })
    
    // Switch to drop-off tab
    const dropoffTab = screen.getByRole('tab', { name: 'Drop-off Analysis' })
    fireEvent.click(dropoffTab)
    
    await waitFor(() => {
      expect(screen.getByText('Motivation')).toBeInTheDocument()
    })
    
    expect(screen.getByText('45 users dropped')).toBeInTheDocument()
    expect(screen.getByText('Drop-off Reasons')).toBeInTheDocument()
    expect(screen.getByText('Form too long')).toBeInTheDocument()
  })

  it('should show optimization insights', async () => {
    render(<OnboardingAnalyticsDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Onboarding Analytics')).toBeInTheDocument()
    })
    
    // Switch to drop-off tab
    const dropoffTab = screen.getByRole('tab', { name: 'Drop-off Analysis' })
    fireEvent.click(dropoffTab)
    
    await waitFor(() => {
      expect(screen.getByText('Optimization Insights')).toBeInTheDocument()
    })
    
    expect(screen.getByText('Reduce form fields in assessment phase')).toBeInTheDocument()
    expect(screen.getByText('Improve mobile UX for goal setting')).toBeInTheDocument()
  })

  it('should display error monitoring data', async () => {
    render(<OnboardingAnalyticsDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Onboarding Analytics')).toBeInTheDocument()
    })
    
    // Switch to errors tab
    const errorsTab = screen.getByRole('tab', { name: 'Error Monitoring' })
    fireEvent.click(errorsTab)
    
    await waitFor(() => {
      expect(screen.getByText('Error Breakdown')).toBeInTheDocument()
    })
    
    expect(screen.getByText('Network failure')).toBeInTheDocument()
    expect(screen.getByText('Validation error')).toBeInTheDocument()
    expect(screen.getByText('85.0% recovery')).toBeInTheDocument()
  })

  it('should show A/B test results', async () => {
    render(<OnboardingAnalyticsDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Onboarding Analytics')).toBeInTheDocument()
    })
    
    // Switch to A/B tests tab
    const abTestsTab = screen.getByRole('tab', { name: 'A/B Tests' })
    fireEvent.click(abTestsTab)
    
    await waitFor(() => {
      expect(screen.getByText('Onboarding Flow Style')).toBeInTheDocument()
    })
    
    expect(screen.getByText('Test AI chat vs guided form')).toBeInTheDocument()
    expect(screen.getByText('Ai Chat')).toBeInTheDocument()
    expect(screen.getByText('Guided Form')).toBeInTheDocument()
    expect(screen.getByText('78.0%')).toBeInTheDocument() // AI chat conversion rate
    expect(screen.getByText('Winner')).toBeInTheDocument() // AI chat is winner
  })

  it('should display real-time metrics', async () => {
    render(<OnboardingAnalyticsDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Onboarding Analytics')).toBeInTheDocument()
    })
    
    // Switch to real-time tab
    const realTimeTab = screen.getByRole('tab', { name: 'Real-time' })
    fireEvent.click(realTimeTab)
    
    await waitFor(() => {
      expect(screen.getByText('Live Sessions')).toBeInTheDocument()
    })
    
    expect(screen.getByText('Recent Errors')).toBeInTheDocument()
    expect(screen.getByText('Network failure')).toBeInTheDocument()
    expect(screen.getByText('Connection timeout')).toBeInTheDocument()
  })

  it('should handle refresh functionality', async () => {
    const { analyticsProcessor } = await import('../lib/analyticsProcessor')
    
    render(<OnboardingAnalyticsDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Onboarding Analytics')).toBeInTheDocument()
    })
    
    // Click refresh button
    const refreshButton = screen.getByRole('button', { name: /refresh/i })
    fireEvent.click(refreshButton)
    
    // Should call getDashboardMetrics again
    expect(analyticsProcessor.getDashboardMetrics).toHaveBeenCalledTimes(2) // Initial load + refresh
  })

  it('should show last updated timestamp', async () => {
    render(<OnboardingAnalyticsDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
    })
    
    // Should show time format
    expect(screen.getByText(/\d{1,2}:\d{2}:\d{2}/)).toBeInTheDocument()
  })

  it('should handle loading state during refresh', async () => {
    render(<OnboardingAnalyticsDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Onboarding Analytics')).toBeInTheDocument()
    })
    
    // Click refresh button
    const refreshButton = screen.getByRole('button', { name: /refresh/i })
    fireEvent.click(refreshButton)
    
    // Button should show loading state
    expect(refreshButton).toBeDisabled()
  })

  it('should show appropriate metric trends', async () => {
    render(<OnboardingAnalyticsDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Onboarding Analytics')).toBeInTheDocument()
    })
    
    // Should show completion rate with trend
    const completionRateCard = screen.getByText('Completion Rate').closest('.rounded-lg')
    expect(completionRateCard).toContainHTML('75.0%')
  })

  it('should display segment performance badges', async () => {
    render(<OnboardingAnalyticsDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Onboarding Analytics')).toBeInTheDocument()
    })
    
    // Switch to completion rates tab
    const completionTab = screen.getByRole('tab', { name: 'Completion Rates' })
    fireEvent.click(completionTab)
    
    await waitFor(() => {
      expect(screen.getByText('By Experience Level')).toBeInTheDocument()
    })
    
    // Should show performance badges (good/average/poor)
    expect(screen.getByText('good')).toBeInTheDocument() // Beginner segment
  })

  it('should show error severity indicators', async () => {
    render(<OnboardingAnalyticsDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText('Onboarding Analytics')).toBeInTheDocument()
    })
    
    // Switch to errors tab
    const errorsTab = screen.getByRole('tab', { name: 'Error Monitoring' })
    fireEvent.click(errorsTab)
    
    await waitFor(() => {
      expect(screen.getByText('Error Breakdown')).toBeInTheDocument()
    })
    
    // Should show severity badges
    expect(screen.getByText('medium')).toBeInTheDocument() // Network failure severity
  })
})