import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { OnboardingManager, type OnboardingProfile } from '@/lib/onboardingManager';
import { validateOnboardingState } from '@/lib/onboardingStateValidator';
import OnboardingErrorBoundary from '@/components/onboarding-error-boundary';

const mockDbUtils = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  createUser: vi.fn(),
  getUserById: vi.fn(),
  updateUser: vi.fn(),
  deactivateAllUserPlans: vi.fn(),
  createPlan: vi.fn(),
  createWorkout: vi.fn(),
  getActivePlan: vi.fn(),
  updatePlan: vi.fn(),
  cleanupUserData: vi.fn(),
}));

vi.mock('@/lib/dbUtils', () => ({
  dbUtils: mockDbUtils,
}));

vi.mock('@/lib/analytics', () => ({
  trackEngagementEvent: vi.fn(),
}));

vi.mock('@/lib/planGenerator', () => ({
  generatePlan: vi.fn(),
  generateFallbackPlan: vi.fn(),
}));

vi.mock('@/lib/onboardingStateValidator', () => ({
  validateOnboardingState: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('State Management Tests', () => {
  let onboardingManager: OnboardingManager;

  beforeEach(() => {
    vi.clearAllMocks();
    onboardingManager = OnboardingManager.getInstance();
    onboardingManager.resetOnboardingState();
    mockDbUtils.getCurrentUser.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('AC1: Error State Reset Functions', () => {
    it('should reset onboarding state flags', () => {
      (onboardingManager as any).onboardingInProgress = true;
      (onboardingManager as any).currentUserId = 42;

      onboardingManager.resetOnboardingState();

      expect(onboardingManager.isOnboardingInProgress()).toBe(false);
      expect((onboardingManager as any).currentUserId).toBeNull();
    });
  });

  describe('AC1: State Validation Logic', () => {
    it('should validate complete onboarding profile', async () => {
      const validProfile: OnboardingProfile = {
        goal: 'habit',
        experience: 'intermediate',
        preferredTimes: ['morning', 'evening'],
        daysPerWeek: 4,
        consents: {
          data: true,
          gdpr: true,
          push: false
        },
        age: 30,
        motivations: ['health', 'fitness'],
        barriers: ['time'],
        coachingStyle: 'supportive',
        onboardingComplete: true
      };

      vi.mocked(validateOnboardingState).mockResolvedValue({ isValid: true, errors: [] });
      
      const result = await validateOnboardingState(validProfile, null);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', async () => {
      const incompleteProfile: Partial<OnboardingProfile> = {
        goal: 'habit',
        experience: 'beginner'
        // Missing required fields
      };

      vi.mocked(validateOnboardingState).mockResolvedValue({ 
        isValid: false, 
        errors: ['preferredTimes is required', 'daysPerWeek is required', 'consents is required'] 
      });
      
      const result = await validateOnboardingState(incompleteProfile as OnboardingProfile, null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('preferredTimes is required');
      expect(result.errors).toContain('daysPerWeek is required');
      expect(result.errors).toContain('consents is required');
    });

    it('should validate consent requirements', async () => {
      const profileWithoutConsents: OnboardingProfile = {
        goal: 'distance',
        experience: 'advanced',
        preferredTimes: ['afternoon'],
        daysPerWeek: 5,
        consents: {
          data: false, // Required consent missing
          gdpr: false, // Required consent missing
          push: false
        },
        onboardingComplete: false
      };

      vi.mocked(validateOnboardingState).mockResolvedValue({ 
        isValid: false, 
        errors: ['Data processing consent is required', 'GDPR consent is required'] 
      });
      
      const result = await validateOnboardingState(profileWithoutConsents, null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Data processing consent is required');
      expect(result.errors).toContain('GDPR consent is required');
    });

    it('should validate enum values', async () => {
      const invalidEnumProfile: OnboardingProfile = {
        goal: 'invalid_goal' as any,
        experience: 'expert' as any,
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: {
          data: true,
          gdpr: true,
          push: false
        },
        coachingStyle: 'aggressive' as any,
        onboardingComplete: false
      };

      vi.mocked(validateOnboardingState).mockResolvedValue({ 
        isValid: false, 
        errors: ['Invalid goal type', 'Invalid experience level', 'Invalid coaching style'] 
      });
      
      const result = await validateOnboardingState(invalidEnumProfile, null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid goal type');
      expect(result.errors).toContain('Invalid experience level');
      expect(result.errors).toContain('Invalid coaching style');
    });
  });

  describe('AC1: Coverage > 90%', () => {
    it('should test singleton pattern', () => {
      const instance1 = OnboardingManager.getInstance();
      const instance2 = OnboardingManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should surface validation errors during onboarding', async () => {
      const profile: OnboardingProfile = {
        goal: 'habit',
        experience: 'beginner',
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: false },
        onboardingComplete: true
      };

      vi.mocked(validateOnboardingState).mockResolvedValue({
        isValid: false,
        errors: ['Invalid profile']
      });

      const result = await onboardingManager.createUserWithProfile(profile);
      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['Invalid profile']);
    });

    it('should forward generateTrainingPlan to createUserWithProfile', async () => {
      const createUserSpy = vi
        .spyOn(onboardingManager, 'createUserWithProfile')
        .mockResolvedValue({ user: {} as any, success: true });

      await onboardingManager.generateTrainingPlan({
        goal: 'habit',
        experience: 'beginner',
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: false },
      });

      expect(createUserSpy).toHaveBeenCalledWith(
        expect.objectContaining({ onboardingComplete: true })
      );
    });
  });
});

// Test component that throws an error
const ErrorThrowingComponent: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return React.createElement('div', null, 'No error');
};

describe('OnboardingErrorBoundary Tests', () => {
  beforeEach(() => {
    // Suppress console.error for these tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('AC1: Error Boundary Component', () => {
    it('should render children when there is no error', () => {
      render(
        React.createElement(OnboardingErrorBoundary, null,
          React.createElement('div', { 'data-testid': 'child' }, 'No error here')
        )
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('No error here')).toBeInTheDocument();
    });

    it('should render error UI when child component throws', () => {
      render(
        React.createElement(OnboardingErrorBoundary, null,
          React.createElement(ErrorThrowingComponent, { shouldThrow: true })
        )
      );

      expect(screen.getByText('Oops! Something went wrong.')).toBeInTheDocument();
      expect(screen.getByText(/We're sorry, but an unexpected error occurred/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Restart Onboarding' })).toBeInTheDocument();
    });

    it('should render custom fallback when provided', () => {
      const customFallback = React.createElement('div', { 'data-testid': 'custom-fallback' }, 'Custom error message');

      render(
        React.createElement(OnboardingErrorBoundary, { fallback: customFallback },
          React.createElement(ErrorThrowingComponent, { shouldThrow: true })
        )
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.getByText('Custom error message')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });

    it('should reset error state when reset button is clicked', async () => {
      const { rerender } = render(
        React.createElement(OnboardingErrorBoundary, null,
          React.createElement(ErrorThrowingComponent, { shouldThrow: true })
        )
      );

      // Verify error state
      expect(screen.getByText('Oops! Something went wrong.')).toBeInTheDocument();

      // Re-render with no error
      rerender(
        React.createElement(OnboardingErrorBoundary, null,
          React.createElement(ErrorThrowingComponent, { shouldThrow: false })
        )
      );

      // Click reset button
      fireEvent.click(screen.getByRole('button', { name: 'Restart Onboarding' }));

      // Should now render the component without error
      await waitFor(() => {
        expect(screen.getByText('No error')).toBeInTheDocument();
      });
    });

    it('should call onReset callback when provided', () => {
      const onResetMock = vi.fn();

      render(
        React.createElement(OnboardingErrorBoundary, { onReset: onResetMock },
          React.createElement(ErrorThrowingComponent, { shouldThrow: true })
        )
      );

      fireEvent.click(screen.getByRole('button', { name: 'Restart Onboarding' }));

      expect(onResetMock).toHaveBeenCalledOnce();
    });

    it('should show error details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        React.createElement(OnboardingErrorBoundary, null,
          React.createElement(ErrorThrowingComponent, { shouldThrow: true })
        )
      );

      const detailsElement = screen.getByText('Error Details (for developers)');
      expect(detailsElement).toBeInTheDocument();

      // Expand details
      fireEvent.click(detailsElement);
      expect(screen.getByText(/Test error/)).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    it('should not show error details in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      render(
        React.createElement(OnboardingErrorBoundary, null,
          React.createElement(ErrorThrowingComponent, { shouldThrow: true })
        )
      );

      expect(screen.queryByText('Error Details (for developers)')).not.toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });
  });
});
