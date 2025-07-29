import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { PlanComplexityIndicator } from '@/components/plan-complexity-indicator'
import type { Plan } from '@/lib/db'
import { describe, it, expect } from 'vitest'

const mockPlan: Plan = {
  id: 1,
  userId: 1,
  title: 'Test Plan',
  startDate: new Date(),
  endDate: new Date(),
  totalWeeks: 4,
  isActive: true,
  planType: 'basic',
  createdAt: new Date(),
  updatedAt: new Date(),
  complexityLevel: 'standard',
  complexityScore: 50,
  adaptationFactors: [
    { factor: 'performance', weight: 1, currentValue: 5, targetValue: 10 }
  ]
}

describe('PlanComplexityIndicator', () => {
  it('renders complexity level badge and progress', () => {
    render(<PlanComplexityIndicator plan={mockPlan} />)
    expect(screen.getByTestId('plan-complexity-indicator')).toBeInTheDocument()
    expect(screen.getByText('standard')).toBeInTheDocument()
    const progress = screen.getByTestId('complexity-progress')
    expect(progress).toBeInTheDocument()
  })
})
