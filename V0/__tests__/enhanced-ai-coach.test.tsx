import { render, screen, waitFor } from '@testing-library/react';
import { EnhancedAICoach } from '@/components/enhanced-ai-coach';
import { dbUtils } from '@/lib/db';
import { adaptiveCoachingEngine } from '@/lib/adaptiveCoachingEngine';
import { vi, expect, test, beforeEach, describe } from 'vitest';

// Mock the dependencies
vi.mock('@/lib/db', () => ({
  dbUtils: {
    getRunsByUser: vi.fn(),
  },
}));

vi.mock('@/lib/adaptiveCoachingEngine', () => ({
  adaptiveCoachingEngine: {
    generateAdaptiveRecommendations: vi.fn(),
    generatePersonalizedResponse: vi.fn(),
  },
}));

// Mock Radix UI components that might cause issues in tests
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockUser = {
  id: 1,
  name: 'Test User',
  goal: 'habit' as const,
  experience: 'beginner' as const,
  preferredTimes: ['morning'],
  daysPerWeek: 3,
  consents: {
    data: true,
    gdpr: true,
    push: false,
  },
  onboardingComplete: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  coachingStyle: 'encouraging' as const,
};

const mockRuns = [
  {
    id: 1,
    userId: 1,
    type: 'easy' as const,
    distance: 3.2,
    duration: 1800, // 30 minutes
    pace: 375, // 6:15 per km
    completedAt: new Date('2024-01-15'),
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 2,
    userId: 1,
    type: 'easy' as const,
    distance: 3.5,
    duration: 1680, // 28 minutes
    pace: 343, // 5:43 per km
    completedAt: new Date('2024-01-17'),
    createdAt: new Date('2024-01-17'),
  },
];

describe('EnhancedAICoach', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    (dbUtils.getRunsByUser as any).mockResolvedValue(mockRuns);
    (adaptiveCoachingEngine.generateAdaptiveRecommendations as any).mockResolvedValue([
      {
        type: 'workout_modification',
        title: 'Increase Weekly Distance',
        description: 'Consider adding an extra run this week to build endurance.',
        confidence: 0.85,
        reasoning: 'User is consistently completing runs and ready for progression.',
        priority: 'medium',
        actionable: true,
        contextualFactors: ['consistency', 'performance'],
      },
    ]);
  });

  test('renders loading state initially', () => {
    render(<EnhancedAICoach user={mockUser} />);
    
    expect(screen.getByText('Enhanced AI Coach')).toBeInTheDocument();
    // Should show loading skeleton
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  test('displays performance trends after loading', async () => {
    render(<EnhancedAICoach user={mockUser} />);
    
    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Performance Trends')).toBeInTheDocument();
    }, { timeout: 10000 });

    // Should show trends based on mock data
    expect(screen.getByText('Performance Trends')).toBeInTheDocument();
    expect(screen.getByText('AI Coach Insights')).toBeInTheDocument();
  }, 15000);

  test('displays adaptive recommendations', async () => {
    render(<EnhancedAICoach user={mockUser} />);
    
    await waitFor(() => {
      expect(screen.getByText('Smart Recommendations')).toBeInTheDocument();
    }, { timeout: 10000 });

    expect(screen.getByText('Increase Weekly Distance')).toBeInTheDocument();
    expect(screen.getByText('Consider adding an extra run this week to build endurance.')).toBeInTheDocument();
  }, 15000);

  test('displays coaching context information', async () => {
    render(<EnhancedAICoach user={mockUser} />);
    
    await waitFor(() => {
      expect(screen.getByText('Coaching Context')).toBeInTheDocument();
    }, { timeout: 10000 });

    expect(screen.getByText('Beginner')).toBeInTheDocument();
    expect(screen.getByText('Habit')).toBeInTheDocument();
    expect(screen.getByText('3 days/week')).toBeInTheDocument();
    expect(screen.getByText('Encouraging')).toBeInTheDocument();
  }, 15000);

  test('handles no run data gracefully', async () => {
    (dbUtils.getRunsByUser as any).mockResolvedValue([]);
    
    render(<EnhancedAICoach user={mockUser} />);
    
    await waitFor(() => {
      expect(screen.getByText('Complete more runs to see performance trends')).toBeInTheDocument();
    }, { timeout: 10000 });
  }, 15000);

  test('calls onResponse callback when generating insights', async () => {
    const mockOnResponse = vi.fn();
    (adaptiveCoachingEngine.generatePersonalizedResponse as any).mockResolvedValue({
      response: 'Focus on consistency first, then gradually increase distance.',
      confidence: 0.9,
      adaptations: ['beginner-friendly', 'habit-focused'],
      contextUsed: ['experience: beginner', 'goal: habit'],
      suggestedActions: ['Start with shorter runs', 'Track your consistency'],
    });

    render(<EnhancedAICoach user={mockUser} onResponse={mockOnResponse} />);
    
    await waitFor(() => {
      expect(screen.getByText('Get personalized advice')).toBeInTheDocument();
    }, { timeout: 10000 });

    // Click the advice button
    const adviceButton = screen.getByText('Get personalized advice');
    adviceButton.click();

    await waitFor(() => {
      expect(mockOnResponse).toHaveBeenCalledWith({
        response: 'Focus on consistency first, then gradually increase distance.',
        suggestedQuestions: [
          "How can I improve my consistency?",
          "What's the best way to increase my pace?",
          "Should I focus more on distance or speed?"
        ],
        followUpActions: ['Start with shorter runs', 'Track your consistency'],
        confidence: 0.9,
        contextUsed: ['experience: beginner', 'goal: habit'],
      });
    }, { timeout: 10000 });
  }, 20000);

  test('handles API errors gracefully', async () => {
    (dbUtils.getRunsByUser as any).mockRejectedValue(new Error('Database error'));
    
    render(<EnhancedAICoach user={mockUser} />);
    
    // Should not crash and should finish loading
    await waitFor(() => {
      expect(document.querySelector('.animate-pulse')).not.toBeInTheDocument();
    }, { timeout: 10000 });
  }, 15000);
});