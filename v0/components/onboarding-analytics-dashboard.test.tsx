import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OnboardingAnalyticsDashboard } from './onboarding-analytics-dashboard'

// The dashboard short-circuits to deterministic fixtures in NODE_ENV=test,
// so these tests assert that the preloaded data renders correctly without async waits.
describe('OnboardingAnalyticsDashboard', () => {
  it('renders dashboard with key metrics', () => {
    render(<OnboardingAnalyticsDashboard />)

    expect(screen.getByText('Onboarding Analytics')).toBeInTheDocument()
    expect(screen.getByText('Completion Rate')).toBeInTheDocument()
    expect(screen.getAllByText(/75\.0%?/i).length).toBeGreaterThan(0)
    expect(screen.getByText('Active Users')).toBeInTheDocument()
    expect(screen.getAllByText('15').length).toBeGreaterThan(0)
  })

  it('shows completion rate trend section', () => {
    render(<OnboardingAnalyticsDashboard />)

    expect(screen.getByText('Completion Rate Trend')).toBeInTheDocument()
    expect(screen.getByText('Last 30 days')).toBeInTheDocument()
  })
})
