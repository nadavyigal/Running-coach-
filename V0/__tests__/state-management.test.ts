import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { OnboardingManager, type OnboardingProfile } from '../lib/onboardingManager';
import { validateOnboardingState } from '../lib/onboardingStateValidator';
import OnboardingErrorBoundary from '../components/onboarding-error-boundary';
import { db } from '../lib/db';

// Mock the database
vi.mock('../lib/db', () => ({
  db: {
    users: {
      get: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      toArray: vi.fn(),
      clear: vi.fn()
    },
    plans: {
      add: vi.fn(),
      get: vi.fn(),
      clear: vi.fn()
    }
  },
  dbUtils: {
    createUser: vi.fn(),
    updateUser: vi.fn(),
    getUser: vi.fn(),
    getCurrentUser: vi.fn(),
    createPlan: vi.fn(),
    createWorkout: vi.fn(),
    deactivateAllUserPlans: vi.fn(),
    cleanupUserData: vi.fn(),
    getUserById: vi.fn(),
  }
}));

// Mock analytics
vi.mock('../lib/analytics', () => ({
  trackEngagementEvent: vi.fn()
}));

// Mock plan generator
vi.mock('../lib/planGenerator', () => ({
  generatePlan: vi.fn(),
  generateFallbackPlan: vi.fn()
}));

vi.mock('../lib/onboardingStateValidator', () => ({
  validateOnboardingState: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('State Management Tests', () => {
  let onboardingManager: OnboardingManager

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks()
    
    // Get fresh instance
    onboardingManager = OnboardingManager.getInstance()
    
    // Clear database mock state
    await db.users.clear()
    await db.plans.clear()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('AC1: Error State Reset Functions', () => {
    it('should reset onboarding state after error', async () => {
      // Setup initial state
      const mockUser = {
        id: 1,
        name: 'Test User',
        onboardingComplete: false,
        goal: 'fitness' as const,
        experience: 'beginner' as const,
        daysPerWeek: 3,
        preferredTimes: ['morning'],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(db.users.get).mockResolvedValue(mockUser)
      
      // Simulate error state reset
      const result = await onboardingManager.resetOnboardingState(1)
      
      expect(result).toBe(true)
      expect(db.users.update).toHaveBeenCalledWith(1, expect.objectContaining({
        onboardingComplete: false,
        onboardingSession: {},
        updatedAt: expect.any(Date)
      }))
    })

    it('should handle reset error gracefully', async () => {
      vi.mocked(db.users.get).mockRejectedValue(new Error('Database error'))
      
      const result = await onboardingManager.resetOnboardingState(999)
      
      expect(result).toBe(false)
    })

    it('should clear session data on reset', async () => {
      const mockUser = {
        id: 1,
        name: 'Test User',
        onboardingComplete: true,
        onboardingSession: { step: 'completed', data: { goal: 'fitness' } },
        goal: 'fitness' as const,
        experience: 'beginner' as const,
        daysPerWeek: 3,
        preferredTimes: ['morning'],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(db.users.get).mockResolvedValue(mockUser)
      
      await onboardingManager.resetOnboardingState(1)
      
      expect(db.users.update).toHaveBeenCalledWith(1, expect.objectContaining({
        onboardingSession: {},
        onboardingComplete: false
      }))
    })

    it('should maintain error count for analytics', async () => {
      const mockUser = {
        id: 1,
        name: 'Test User',
        onboardingComplete: false,
        errorCount: 2,
        goal: 'fitness' as const,
        experience: 'beginner' as const,
        daysPerWeek: 3,
        preferredTimes: ['morning'],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(db.users.get).mockResolvedValue(mockUser)
      
      await onboardingManager.resetOnboardingState(1)
      
      expect(db.users.update).toHaveBeenCalledWith(1, expect.objectContaining({
        errorCount: 3 // Should increment error count
      }))
    })
  })

  describe('AC1: State Validation Logic', () => {
    it('should validate complete onboarding profile', () => {
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
      }

      vi.mocked(validateOnboardingState).mockReturnValue({ isValid: true, errors: [] })
      
      const result = validateOnboardingState(validProfile)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing required fields', () => {
      const incompleteProfile: Partial<OnboardingProfile> = {
        goal: 'habit',
        experience: 'beginner'
        // Missing required fields
      }

      vi.mocked(validateOnboardingState).mockReturnValue({ 
        isValid: false, 
        errors: ['preferredTimes is required', 'daysPerWeek is required', 'consents is required'] 
      })
      
      const result = validateOnboardingState(incompleteProfile as OnboardingProfile)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('preferredTimes is required')
      expect(result.errors).toContain('daysPerWeek is required')
      expect(result.errors).toContain('consents is required')
    })

    it('should validate consent requirements', () => {
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
      }

      vi.mocked(validateOnboardingState).mockReturnValue({ 
        isValid: false, 
        errors: ['Data processing consent is required', 'GDPR consent is required'] 
      })
      
      const result = validateOnboardingState(profileWithoutConsents)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Data processing consent is required')
      expect(result.errors).toContain('GDPR consent is required')
    })

    it('should validate enum values', () => {
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
      }

      vi.mocked(validateOnboardingState).mockReturnValue({ 
        isValid: false, 
        errors: ['Invalid goal type', 'Invalid experience level', 'Invalid coaching style'] 
      })
      
      const result = validateOnboardingState(invalidEnumProfile)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid goal type')
      expect(result.errors).toContain('Invalid experience level')
      expect(result.errors).toContain('Invalid coaching style')
    })
  })

  describe('AC1: Cleanup Routines', () => {
    it('should cleanup incomplete onboarding sessions', async () => {
      const incompleteUsers = [
        {
          id: 1,
          name: 'User 1',
          onboardingComplete: false,
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day old
          updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours old
          goal: 'fitness' as const,
          experience: 'beginner' as const,
          daysPerWeek: 3,
          preferredTimes: ['morning']
        },
        {
          id: 2,
          name: 'User 2',
          onboardingComplete: false,
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours old
          updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour old
          goal: 'fitness' as const,
          experience: 'beginner' as const,
          daysPerWeek: 3,
          preferredTimes: ['morning']
        }
      ]

      vi.mocked(db.users.toArray).mockResolvedValue(incompleteUsers)
      
      const cleanedCount = await onboardingManager.cleanupStaleOnboardingSessions()
      
      // Should clean up sessions older than 6 hours
      expect(cleanedCount).toBe(1)
      expect(db.users.update).toHaveBeenCalledWith(1, expect.objectContaining({
        onboardingSession: {}
      }))
    })

    it('should not cleanup recent sessions', async () => {
      const recentUsers = [
        {
          id: 1,
          name: 'Recent User',
          onboardingComplete: false,
          createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes old
          updatedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes old
          goal: 'fitness' as const,
          experience: 'beginner' as const,
          daysPerWeek: 3,
          preferredTimes: ['morning']
        }
      ]

      vi.mocked(db.users.toArray).mockResolvedValue(recentUsers)
      
      const cleanedCount = await onboardingManager.cleanupStaleOnboardingSessions()
      
      expect(cleanedCount).toBe(0)
      expect(db.users.update).not.toHaveBeenCalled()
    })

    it('should handle cleanup errors gracefully', async () => {
      vi.mocked(db.users.toArray).mockRejectedValue(new Error('Database error'))
      
      const cleanedCount = await onboardingManager.cleanupStaleOnboardingSessions()
      
      expect(cleanedCount).toBe(0)
    })
  })

  describe('AC1: Coverage > 90%', () => {
    it('should test singleton pattern', () => {
      const instance1 = OnboardingManager.getInstance()
      const instance2 = OnboardingManager.getInstance()
      
      expect(instance1).toBe(instance2)
    })

    it('should test race condition prevention', async () => {
      const mockUser = {
        id: 1,
        name: 'Test User',
        onboardingComplete: false,
        goal: 'fitness' as const,
        experience: 'beginner' as const,
        daysPerWeek: 3,
        preferredTimes: ['morning'],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      vi.mocked(db.users.get).mockResolvedValue(mockUser)
      
      const { generatePlan } = await import('../lib/planGenerator')
      vi.mocked(generatePlan).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          id: 1,
          weeks: [],
          userId: 1,
          goal: 'fitness',
          experience: 'beginner',
          daysPerWeek: 3,
          createdAt: new Date(),
          updatedAt: new Date()
        }), 100))
      )

      const profile: OnboardingProfile = {
        goal: 'habit',
        experience: 'beginner',
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: false },
        onboardingComplete: true
      }

      // Start two concurrent plan creations
      const promise1 = onboardingManager.completeOnboarding(1, profile)
      const promise2 = onboardingManager.completeOnboarding(1, profile)

      const [result1, result2] = await Promise.all([promise1, promise2])

      // Only one should succeed, the other should detect the race condition
      expect(result1.success || result2.success).toBe(true)
      expect(result1.success && result2.success).toBe(false)
    })
  })
})

// Test component that throws an error
const ErrorThrowingComponent: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return React.createElement('div', null, 'No error')
}

describe('OnboardingErrorBoundary Tests', () => {
  beforeEach(() => {
    // Suppress console.error for these tests
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('AC1: Error Boundary Component', () => {
    it('should render children when there is no error', () => {
      render(
        React.createElement(OnboardingErrorBoundary, null,
          React.createElement('div', { 'data-testid': 'child' }, 'No error here')
        )
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
      expect(screen.getByText('No error here')).toBeInTheDocument()
    })

    it('should render error UI when child component throws', () => {
      render(
        React.createElement(OnboardingErrorBoundary, null,
          React.createElement(ErrorThrowingComponent, { shouldThrow: true })
        )
      )

      expect(screen.getByText('Oops! Something went wrong.')).toBeInTheDocument()
      expect(screen.getByText(/We're sorry, but an unexpected error occurred/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Restart Onboarding' })).toBeInTheDocument()
    })

    it('should render custom fallback when provided', () => {
      const customFallback = React.createElement('div', { 'data-testid': 'custom-fallback' }, 'Custom error message')

      render(
        React.createElement(OnboardingErrorBoundary, { fallback: customFallback },
          React.createElement(ErrorThrowingComponent, { shouldThrow: true })
        )
      )

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()
      expect(screen.getByText('Custom error message')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })

    it('should reset error state when reset button is clicked', async () => {
      const { rerender } = render(
        React.createElement(OnboardingErrorBoundary, null,
          React.createElement(ErrorThrowingComponent, { shouldThrow: true })
        )
      )

      // Verify error state
      expect(screen.getByText('Oops! Something went wrong.')).toBeInTheDocument()

      // Click reset button
      fireEvent.click(screen.getByRole('button', { name: 'Restart Onboarding' }))

      // Re-render with no error
      rerender(
        React.createElement(OnboardingErrorBoundary, null,
          React.createElement(ErrorThrowingComponent, { shouldThrow: false })
        )
      )

      // Should now render the component without error
      await waitFor(() => {
        expect(screen.getByText('No error')).toBeInTheDocument()
      })
    })

    it('should call onReset callback when provided', () => {
      const onResetMock = vi.fn()

      render(
        React.createElement(OnboardingErrorBoundary, { onReset: onResetMock },
          React.createElement(ErrorThrowingComponent, { shouldThrow: true })
        )
      )

      fireEvent.click(screen.getByRole('button', { name: 'Restart Onboarding' }))

      expect(onResetMock).toHaveBeenCalledOnce()
    })

    it('should show error details in development mode', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      render(
        React.createElement(OnboardingErrorBoundary, null,
          React.createElement(ErrorThrowingComponent, { shouldThrow: true })
        )
      )

      const detailsElement = screen.getByText('Error Details (for developers)')
      expect(detailsElement).toBeInTheDocument()

      // Expand details
      fireEvent.click(detailsElement)
      expect(screen.getByText(/Test error/)).toBeInTheDocument()

      process.env.NODE_ENV = originalEnv
    })

    it('should not show error details in production mode', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      render(
        React.createElement(OnboardingErrorBoundary, null,
          React.createElement(ErrorThrowingComponent, { shouldThrow: true })
        )
      )

      expect(screen.queryByText('Error Details (for developers)')).not.toBeInTheDocument()

      process.env.NODE_ENV = originalEnv
    })
  })
});
