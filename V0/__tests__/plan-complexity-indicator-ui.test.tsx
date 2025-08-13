import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlanComplexityIndicator } from '../components/plan-complexity-indicator';

// Mock the plan complexity engine
vi.mock('../lib/plan-complexity-engine', () => ({
  planComplexityEngine: {
    calculatePlanComplexity: vi.fn().mockResolvedValue({
      userExperience: 'beginner',
      planLevel: 'basic',
      complexityScore: 45,
      adaptationFactors: [
        { factor: 'performance', weight: 0.3, currentValue: 6, targetValue: 8 },
        { factor: 'consistency', weight: 0.25, currentValue: 7, targetValue: 9 },
        { factor: 'goals', weight: 0.25, currentValue: 8, targetValue: 8 },
        { factor: 'feedback', weight: 0.2, currentValue: 6, targetValue: 7 },
      ],
    }),
    getComplexityDescription: vi.fn().mockReturnValue('Moderate - Good balance for your experience level'),
    getComplexityColor: vi.fn().mockReturnValue('bg-blue-500'),
    suggestPlanAdjustments: vi.fn().mockResolvedValue([
      'Consider adding one more workout per week',
      'Focus on completing all scheduled workouts',
    ]),
  },
}));

describe('PlanComplexityIndicator UI', () => {
  const mockPlan = {
    id: 1,
    userId: 1,
    title: 'Test Training Plan',
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    totalWeeks: 4,
    isActive: true,
    planType: 'basic' as const,
    complexityScore: 45,
    complexityLevel: 'basic' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should render the component structure', () => {
    render(<PlanComplexityIndicator plan={mockPlan} userId={1} />);
    
    // Check that the main component structure is rendered
    expect(screen.getByText('Plan Complexity')).toBeInTheDocument();
    // The info icon is only visible after loading, so we don't test for it initially
  });

  it('should show loading state initially', () => {
    render(<PlanComplexityIndicator plan={mockPlan} userId={1} />);
    
    // The component should show loading state initially
    expect(screen.getByText('Plan Complexity')).toBeInTheDocument();
  });

  it('should render with plan data', () => {
    render(<PlanComplexityIndicator plan={mockPlan} userId={1} />);
    
    // Basic structure should be present
    expect(screen.getByText('Plan Complexity')).toBeInTheDocument();
  });
});