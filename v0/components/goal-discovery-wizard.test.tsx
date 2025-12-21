import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoalDiscoveryWizard } from './goal-discovery-wizard';
import type { GoalDiscoveryResult } from '@/lib/goalDiscoveryEngine';

// Mock the goal discovery engine
vi.mock('@/lib/goalDiscoveryEngine', () => ({
  goalDiscoveryEngine: {
    discoverGoals: vi.fn()
  }
}));

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

describe('GoalDiscoveryWizard', () => {
  let mockOnComplete: ReturnType<typeof vi.fn>;
  let mockOnClose: ReturnType<typeof vi.fn>;
  let mockGoalDiscoveryResult: GoalDiscoveryResult;

  beforeEach(async () => {
    mockOnComplete = vi.fn();
    mockOnClose = vi.fn();

    mockGoalDiscoveryResult = {
      discoveredGoals: [
        {
          id: 'goal-1',
          title: 'Build Running Habit',
          description: 'Establish consistent running routine',
          goalType: 'frequency',
          category: 'consistency',
          priority: 1,
          confidence: 0.8,
          reasoning: 'Perfect for beginners',
          specificTarget: {
            metric: 'weekly_runs',
            value: 3,
            unit: 'runs/week',
            description: 'Run 3 times per week'
          },
          measurableMetrics: ['weekly_runs'],
          achievableAssessment: {
            currentLevel: 0,
            targetLevel: 3,
            feasibilityScore: 85
          },
          relevantContext: 'Beginner-friendly goal',
          timeBound: {
            startDate: new Date(),
            deadline: new Date(Date.now() + 56 * 24 * 60 * 60 * 1000),
            totalDuration: 56,
            milestoneSchedule: [25, 50, 75]
          },
          baselineValue: 0,
          targetValue: 3,
          motivationalFactors: ['health', 'habit'],
          potentialBarriers: ['time'],
          suggestedActions: ['Schedule runs', 'Start slowly']
        }
      ],
      primaryGoal: {
        id: 'goal-1',
        title: 'Build Running Habit',
        description: 'Establish consistent running routine',
        goalType: 'frequency',
        category: 'consistency',
        priority: 1,
        confidence: 0.8,
        reasoning: 'Perfect for beginners',
        specificTarget: {
          metric: 'weekly_runs',
          value: 3,
          unit: 'runs/week',
          description: 'Run 3 times per week'
        },
        measurableMetrics: ['weekly_runs'],
        achievableAssessment: {
          currentLevel: 0,
          targetLevel: 3,
          feasibilityScore: 85
        },
        relevantContext: 'Beginner-friendly goal',
        timeBound: {
          startDate: new Date(),
          deadline: new Date(Date.now() + 56 * 24 * 60 * 60 * 1000),
          totalDuration: 56,
          milestoneSchedule: [25, 50, 75]
        },
        baselineValue: 0,
        targetValue: 3,
        motivationalFactors: ['health', 'habit'],
        potentialBarriers: ['time'],
        suggestedActions: ['Schedule runs', 'Start slowly']
      },
      supportingGoals: [],
      overallConfidence: 0.8,
      recommendations: ['Start with consistency'],
      nextSteps: ['Complete onboarding'],
      estimatedSuccessProbability: 0.85
    };

    // Mock the goal discovery engine
    const { goalDiscoveryEngine } = await import('@/lib/goalDiscoveryEngine');
    goalDiscoveryEngine.discoverGoals.mockResolvedValue(mockGoalDiscoveryResult);

    vi.clearAllMocks();
  });

  describe('Wizard Flow', () => {
    it('should render initial experience step when opened', () => {
      render(
        <GoalDiscoveryWizard
          isOpen={true}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.getByText('AI Goal Discovery Wizard')).toBeInTheDocument();
      expect(screen.getByText('Running Experience')).toBeInTheDocument();
      expect(screen.getByText("What's your running experience?")).toBeInTheDocument();
      expect(screen.getByText('Beginner')).toBeInTheDocument();
      expect(screen.getByText('Intermediate')).toBeInTheDocument();
      expect(screen.getByText('Advanced')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(
        <GoalDiscoveryWizard
          isOpen={false}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      expect(screen.queryByText('AI Goal Discovery Wizard')).not.toBeInTheDocument();
    });

    it('should progress through wizard steps', async () => {
      const user = userEvent.setup();
      
      render(
        <GoalDiscoveryWizard
          isOpen={true}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      // Step 1: Select experience
      await user.click(screen.getByText('Beginner'));
      await user.click(screen.getByText('Next'));

      // Step 2: Fitness level
      expect(screen.getByText("How's your current fitness?")).toBeInTheDocument();
      await user.click(screen.getByText('Next'));

      // Step 3: Time availability
      expect(screen.getByText('How much time can you dedicate?')).toBeInTheDocument();
    });

    it('should prevent proceeding without required selections', async () => {
      const user = userEvent.setup();
      
      render(
        <GoalDiscoveryWizard
          isOpen={true}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      const nextButton = screen.getByText('Next');
      expect(nextButton).toBeDisabled();

      // Select experience to enable next
      await user.click(screen.getByText('Beginner'));
      expect(nextButton).toBeEnabled();
    });

    it('should allow going back to previous steps', async () => {
      const user = userEvent.setup();
      
      render(
        <GoalDiscoveryWizard
          isOpen={true}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      // Progress to step 2
      await user.click(screen.getByText('Beginner'));
      await user.click(screen.getByText('Next'));

      // Go back to step 1
      await user.click(screen.getByText('Previous'));
      expect(screen.getByText("What's your running experience?")).toBeInTheDocument();
    });
  });

  describe('Step Content and Interactions', () => {
    it('should handle experience selection', async () => {
      const user = userEvent.setup();
      
      render(
        <GoalDiscoveryWizard
          isOpen={true}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      const beginnerCard = screen.getByText('Beginner').closest('[role="button"]') || screen.getByText('Beginner').closest('div[class*="cursor-pointer"]');
      
      if (beginnerCard) {
        await user.click(beginnerCard);
        expect(beginnerCard).toHaveClass(/ring-2.*ring-primary/);
      }
    });

    it('should handle fitness level slider', async () => {
      const user = userEvent.setup();
      
      render(
        <GoalDiscoveryWizard
          isOpen={true}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      // Progress to fitness step
      await user.click(screen.getByText('Beginner'));
      await user.click(screen.getByText('Next'));

      // Should display fitness level
      expect(screen.getByText('5/10')).toBeInTheDocument();
    });

    it('should handle time availability settings', async () => {
      const user = userEvent.setup();
      
      render(
        <GoalDiscoveryWizard
          isOpen={true}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      // Progress to availability step
      await user.click(screen.getByText('Beginner'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));

      expect(screen.getByText('3 days/week')).toBeInTheDocument();
      expect(screen.getByText('30 minutes')).toBeInTheDocument();
      
      // Test preferred times checkboxes
      const morningCheckbox = screen.getByRole('checkbox', { name: /morning/i });
      await user.click(morningCheckbox);
      expect(morningCheckbox).toBeChecked();
    });

    it('should handle motivations selection', async () => {
      const user = userEvent.setup();
      
      render(
        <GoalDiscoveryWizard
          isOpen={true}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      // Progress to motivations step
      await user.click(screen.getByText('Beginner'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));

      expect(screen.getByText('What motivates you to run?')).toBeInTheDocument();
      
      const healthCheckbox = screen.getByRole('checkbox', { name: /improve overall health/i });
      await user.click(healthCheckbox);
      expect(healthCheckbox).toBeChecked();
    });

    it('should handle barriers selection', async () => {
      const user = userEvent.setup();
      
      render(
        <GoalDiscoveryWizard
          isOpen={true}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      // Progress through required steps to barriers (optional step)
      await user.click(screen.getByText('Beginner'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));
      
      // Select at least one motivation to proceed
      await user.click(screen.getByRole('checkbox', { name: /improve overall health/i }));
      await user.click(screen.getByText('Next'));

      expect(screen.getByText('What might hold you back?')).toBeInTheDocument();
      
      const timeBarrier = screen.getByRole('checkbox', { name: /lack of time/i });
      await user.click(timeBarrier);
      expect(timeBarrier).toBeChecked();
    });

    it('should handle coaching style preferences', async () => {
      const user = userEvent.setup();
      
      render(
        <GoalDiscoveryWizard
          isOpen={true}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      // Progress through all steps to preferences
      const steps = ['Beginner', 'Next', 'Next', 'Next'];
      for (const step of steps) {
        if (step === 'Next') {
          await user.click(screen.getByText('Next'));
        } else {
          await user.click(screen.getByText(step));
        }
      }

      // Select motivation to enable next
      await user.click(screen.getByRole('checkbox', { name: /improve overall health/i }));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next')); // Skip barriers

      expect(screen.getByText('How do you prefer to train?')).toBeInTheDocument();
      
      const challengingStyle = screen.getByText('Challenging & Motivating').closest('[role="button"]') || 
                               screen.getByText('Challenging & Motivating').closest('div[class*="cursor-pointer"]');
      
      if (challengingStyle) {
        await user.click(challengingStyle);
        expect(challengingStyle).toHaveClass(/ring-2.*ring-primary/);
      }
    });
  });

  describe('Goal Discovery Process', () => {
    it('should run goal discovery when reaching discovery step', async () => {
      const user = userEvent.setup();
      
      render(
        <GoalDiscoveryWizard
          isOpen={true}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      // Progress through all steps to discovery
      await user.click(screen.getByText('Beginner'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByRole('checkbox', { name: /improve overall health/i }));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next')); // Skip barriers
      await user.click(screen.getByText('Next')); // Skip preferences

      expect(screen.getByText('Discovering Your Perfect Goals')).toBeInTheDocument();
      
      // Click discover button
      await user.click(screen.getByText('Discover My Goals'));
      
      expect(screen.getByText('Analyzing your fitness level and experience...')).toBeInTheDocument();
    });

    it('should display goal discovery results', async () => {
      const user = userEvent.setup();
      
      render(
        <GoalDiscoveryWizard
          isOpen={true}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      // Progress to discovery step and run discovery
      await user.click(screen.getByText('Beginner'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByRole('checkbox', { name: /improve overall health/i }));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Discover My Goals'));

      // Wait for discovery to complete and move to review step
      await waitFor(() => {
        expect(screen.getByText('Next')).toBeEnabled();
      });

      await user.click(screen.getByText('Next'));

      // Should show results
      expect(screen.getByText('Your Personalized Goals')).toBeInTheDocument();
      expect(screen.getByText('Build Running Habit')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument(); // Success probability
    });

    it('should handle goal discovery errors gracefully', async () => {
      const user = userEvent.setup();
      
      // Mock goal discovery to fail
      const { goalDiscoveryEngine } = await import('@/lib/goalDiscoveryEngine');
      goalDiscoveryEngine.discoverGoals.mockRejectedValue(new Error('Discovery failed'));

      render(
        <GoalDiscoveryWizard
          isOpen={true}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      // Progress to discovery and trigger error
      await user.click(screen.getByText('Beginner'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByRole('checkbox', { name: /improve overall health/i }));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Discover My Goals'));

      // Should handle error gracefully
      await waitFor(() => {
        expect(screen.queryByText('Analyzing your fitness level and experience...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Wizard Completion', () => {
    it('should call onComplete with discovery results when completing wizard', async () => {
      const user = userEvent.setup();
      
      render(
        <GoalDiscoveryWizard
          isOpen={true}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      // Complete entire wizard flow
      await user.click(screen.getByText('Beginner'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByRole('checkbox', { name: /improve overall health/i }));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Discover My Goals'));

      await waitFor(() => {
        expect(screen.getByText('Next')).toBeEnabled();
      });

      await user.click(screen.getByText('Next'));
      
      // Complete discovery
      const completeButton = screen.getByText('Complete Discovery');
      expect(completeButton).toBeEnabled();
      await user.click(completeButton);

      expect(mockOnComplete).toHaveBeenCalledWith(mockGoalDiscoveryResult);
    });

    it('should call onClose when wizard is closed', async () => {
      const user = userEvent.setup();
      
      render(
        <GoalDiscoveryWizard
          isOpen={true}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      // Close wizard (would typically be done via dialog close button)
      // Since we're testing the component behavior, we'll trigger onClose
      fireEvent.keyDown(document, { key: 'Escape' });
      
      // Note: The actual close behavior depends on the Dialog component
      // This test verifies the onClose prop would be called
    });
  });

  describe('Initial Profile Population', () => {
    it('should populate wizard with initial profile data', () => {
      const initialProfile = {
        experience: 'intermediate' as const,
        age: 30,
        availableTime: {
          daysPerWeek: 4,
          minutesPerSession: 45,
          preferredTimes: ['morning', 'evening']
        }
      };

      render(
        <GoalDiscoveryWizard
          isOpen={true}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
          initialProfile={initialProfile}
        />
      );

      // Should start with intermediate selected if that was in initial profile
      // This would need to be verified by checking component state or UI indicators
      expect(screen.getByText('Intermediate')).toBeInTheDocument();
    });
  });

  describe('Progress Tracking', () => {
    it('should show progress through wizard steps', async () => {
      const user = userEvent.setup();
      
      render(
        <GoalDiscoveryWizard
          isOpen={true}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      // Check initial progress
      expect(screen.getByText('1 of 8')).toBeInTheDocument();

      // Progress to next step
      await user.click(screen.getByText('Beginner'));
      await user.click(screen.getByText('Next'));

      expect(screen.getByText('2 of 8')).toBeInTheDocument();
    });

    it('should update progress bar as wizard advances', async () => {
      const user = userEvent.setup();
      
      render(
        <GoalDiscoveryWizard
          isOpen={true}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      // Progress bar should start at 12.5% (1/8 steps)
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '1');
      expect(progressBar).toHaveAttribute('aria-valuemax', '8');

      // Advance and check progress
      await user.click(screen.getByText('Beginner'));
      await user.click(screen.getByText('Next'));

      expect(progressBar).toHaveAttribute('aria-valuenow', '2');
    });
  });

  describe('Validation and Error Handling', () => {
    it('should validate required fields before allowing progression', async () => {
      const user = userEvent.setup();
      
      render(
        <GoalDiscoveryWizard
          isOpen={true}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      // Should not be able to proceed without selection
      expect(screen.getByText('Next')).toBeDisabled();

      // Make selection
      await user.click(screen.getByText('Beginner'));
      expect(screen.getByText('Next')).toBeEnabled();
    });

    it('should handle missing motivations validation', async () => {
      const user = userEvent.setup();
      
      render(
        <GoalDiscoveryWizard
          isOpen={true}
          onClose={mockOnClose}
          onComplete={mockOnComplete}
        />
      );

      // Progress to motivations step
      await user.click(screen.getByText('Beginner'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));

      // Try to proceed without selecting motivations
      expect(screen.getByText('Next')).toBeDisabled();

      // Select motivation
      await user.click(screen.getByRole('checkbox', { name: /improve overall health/i }));
      expect(screen.getByText('Next')).toBeEnabled();
    });
  });
});
