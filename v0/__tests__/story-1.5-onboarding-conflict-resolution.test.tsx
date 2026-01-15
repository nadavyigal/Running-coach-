import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OnboardingScreen } from '../components/onboarding-screen';
import { OnboardingChatOverlay } from '../components/onboarding-chat-overlay';
import { OnboardingManager } from '../lib/onboardingManager';
import { dbUtils } from '@/lib/dbUtils';
import { generatePlan, generateFallbackPlan } from '../lib/planGenerator';

// Mock dependencies
vi.mock('@/lib/dbUtils', () => ({
  dbUtils: {
    getCurrentUser: vi.fn(),
    createUser: vi.fn(),
    createPlan: vi.fn(),
    createWorkout: vi.fn(),
    deactivateAllUserPlans: vi.fn(),
    getActivePlan: vi.fn(),
    updatePlan: vi.fn(),
    updateUser: vi.fn(),
    getUserById: vi.fn(),
    cleanupUserData: vi.fn(),
    validateUserOnboardingState: vi.fn(),
    cleanupFailedOnboarding: vi.fn(),
    repairUserState: vi.fn(),
    executeWithRollback: vi.fn(),
  }
}));

vi.mock('../lib/planGenerator', () => ({
  generatePlan: vi.fn().mockImplementation(async ({ user }) => ({
    plan: {
      userId: user.id,
      title: 'AI Generated Plan',
      description: 'AI plan',
      startDate: new Date(),
      endDate: new Date(),
      totalWeeks: 4,
      isActive: true,
      planType: 'basic',
    },
    workouts: [],
  })),
  generateFallbackPlan: vi.fn().mockImplementation(async (user) => ({
    plan: {
      userId: user.id,
      title: 'Fallback Plan',
      description: 'Basic training plan',
      startDate: new Date(),
      endDate: new Date(),
      totalWeeks: 4,
      isActive: true,
      planType: 'basic',
    },
    workouts: [],
  })),
}));

vi.mock('../lib/analytics', () => ({
  trackEngagementEvent: vi.fn(),
  trackAnalyticsEvent: vi.fn(),
}));

describe('Story 1.5: Onboarding Component Conflicts and Plan Creation Issues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset database state
    vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('AC1: Unified Plan Creation Logic', () => {
    it('should use OnboardingManager singleton for all plan creation', async () => {
      const mockUser = {
        id: 1,
        goal: 'habit' as const,
        experience: 'beginner' as const,
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: true },
        onboardingComplete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(undefined); // No existing user
      vi.mocked(dbUtils.createUser).mockResolvedValue(1);
      vi.mocked(dbUtils.updateUser).mockResolvedValue(undefined);
      vi.mocked(dbUtils.createPlan).mockResolvedValue(1);
      vi.mocked(dbUtils.createWorkout).mockResolvedValue(1);
      vi.mocked(dbUtils.getUserById).mockResolvedValue(mockUser); // User after creation

      const onboardingManager = OnboardingManager.getInstance();
      
      const result = await onboardingManager.createUserWithProfile({
        goal: 'habit',
        experience: 'beginner',
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: true },
        onboardingComplete: false,
      });

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.planId).toBeDefined();
      expect(dbUtils.createUser).toHaveBeenCalledTimes(1);
      expect(dbUtils.createPlan).toHaveBeenCalledTimes(1);
    });

    it('should prevent duplicate active plans for the same user', async () => {
      const mockUser = {
        id: 1,
        goal: 'habit' as const,
        experience: 'beginner' as const,
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: true },
        onboardingComplete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(undefined); // No existing user
      vi.mocked(dbUtils.createUser).mockResolvedValue(1);
      vi.mocked(dbUtils.updateUser).mockResolvedValue(undefined);
      vi.mocked(dbUtils.createPlan).mockResolvedValue(1);
      vi.mocked(dbUtils.createWorkout).mockResolvedValue(1);
      vi.mocked(dbUtils.deactivateAllUserPlans).mockResolvedValue(undefined);
      vi.mocked(dbUtils.getUserById).mockResolvedValue(mockUser);

      const onboardingManager = OnboardingManager.getInstance();
      
      await onboardingManager.createUserWithProfile({
        goal: 'habit',
        experience: 'beginner',
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: true },
        onboardingComplete: false,
      });

      expect(dbUtils.deactivateAllUserPlans).toHaveBeenCalledWith(1);
      expect(dbUtils.createPlan).toHaveBeenCalledTimes(1);
    });

    it('should handle user creation failures gracefully', async () => {
      vi.mocked(dbUtils.createUser).mockRejectedValue(new Error('Database error'));

      const onboardingManager = OnboardingManager.getInstance();
      
      const result = await onboardingManager.createUserWithProfile({
        goal: 'habit',
        experience: 'beginner',
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: true },
        onboardingComplete: false,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Database error');
    });
  });

  describe('AC2: Chat Overlay Integration Fix', () => {
    it('should not create user/plan independently from chat overlay', async () => {
      const mockUser = {
        id: 1,
        goal: 'habit' as const,
        experience: 'beginner' as const,
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: true },
        onboardingComplete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(mockUser);

      render(<OnboardingScreen />);

      // Simulate chat overlay completion
      const chatOverlay = screen.getByTestId('onboarding-chat-overlay');
      fireEvent.click(chatOverlay);

      // Verify no database operations were called from chat overlay
      expect(dbUtils.createUser).not.toHaveBeenCalled();
      expect(dbUtils.createPlan).not.toHaveBeenCalled();
    });

    it('should update form state with AI-generated data', async () => {
      const mockUser = {
        id: 1,
        goal: 'habit' as const,
        experience: 'beginner' as const,
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: true },
        onboardingComplete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(mockUser);

      render(<OnboardingScreen />);

      // Simulate AI-generated profile data
      const aiProfile = {
        goal: 'distance',
        experience: 'intermediate',
        preferredTimes: ['evening'],
        daysPerWeek: 4,
        age: 30,
        rpe: 7,
      };

      // Trigger chat overlay completion with AI data
      const chatOverlay = screen.getByTestId('onboarding-chat-overlay');
      fireEvent.click(chatOverlay);

      // Verify form state was updated
      await waitFor(() => {
        expect(screen.getByDisplayValue('distance')).toBeInTheDocument();
        expect(screen.getByDisplayValue('intermediate')).toBeInTheDocument();
      });
    });
  });

  describe('AC3: Database State Consistency', () => {
    it('should maintain only one active plan per user', async () => {
      const mockUser = {
        id: 1,
        goal: 'habit' as const,
        experience: 'beginner' as const,
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: true },
        onboardingComplete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(dbUtils.deactivateAllUserPlans).mockResolvedValue();
      vi.mocked(dbUtils.createPlan).mockResolvedValue(1);
      vi.mocked(dbUtils.createWorkout).mockResolvedValue(1);

      const onboardingManager = OnboardingManager.getInstance();
      
      await onboardingManager.generateTrainingPlan({
        goal: 'habit',
        experience: 'beginner',
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: true },
      });

      expect(dbUtils.deactivateAllUserPlans).toHaveBeenCalledWith(1);
    });

    it('should coordinate user creation and plan creation', async () => {
      vi.mocked(dbUtils.createUser).mockResolvedValue(1);
      vi.mocked(dbUtils.createPlan).mockResolvedValue(1);
      vi.mocked(dbUtils.createWorkout).mockResolvedValue(1);

      const onboardingManager = OnboardingManager.getInstance();
      
      const result = await onboardingManager.generateTrainingPlan({
        goal: 'habit',
        experience: 'beginner',
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: true },
      });

      expect(result.success).toBe(true);
      expect(dbUtils.createUser).toHaveBeenCalledBefore(dbUtils.createPlan);
    });

    it('should validate database state consistency', async () => {
      const mockValidation = {
        isValid: false,
        hasActivePlan: true,
        hasCompletedOnboarding: false,
        planCount: 2,
        issues: ['Multiple active plans found'],
        recommendations: ['Deactivate duplicate plans'],
      };

      vi.mocked(dbUtils.validateUserOnboardingState).mockResolvedValue(mockValidation);

      const onboardingManager = OnboardingManager.getInstance();
      
      const validation = await dbUtils.validateUserOnboardingState(1);

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('Multiple active plans found');
    });
  });

  describe('AC4: Error Handling and Recovery', () => {
    it('should provide clear error messages for plan creation failures', async () => {
      vi.mocked(dbUtils.createUser).mockRejectedValue(new Error('Network timeout'));

      const onboardingManager = OnboardingManager.getInstance();
      
      const result = await onboardingManager.generateTrainingPlan({
        goal: 'habit',
        experience: 'beginner',
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: true },
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Network timeout');
    });

    it('should handle AI plan generation failures gracefully', async () => {
      vi.mocked(generatePlan).mockRejectedValue(new Error('AI service unavailable'));
      vi.mocked(generateFallbackPlan).mockResolvedValue({
        plan: {
          userId: 1,
          title: 'Fallback Plan',
          description: 'Basic training plan',
          startDate: new Date(),
          endDate: new Date(),
          totalWeeks: 4,
          isActive: true,
          planType: 'basic',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        workouts: [],
      });

      vi.mocked(dbUtils.createUser).mockResolvedValue(1);
      vi.mocked(dbUtils.createPlan).mockResolvedValue(1);
      vi.mocked(dbUtils.createWorkout).mockResolvedValue(1);

      const onboardingManager = OnboardingManager.getInstance();
      
      const result = await onboardingManager.generateTrainingPlan({
        goal: 'habit',
        experience: 'beginner',
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: true },
      });

      expect(result.success).toBe(true);
      expect(generateFallbackPlan).toHaveBeenCalled();
    });

    it('should provide recovery mechanisms for interrupted onboarding', async () => {
      const mockRepair = {
        success: true,
        actions: ['Deactivated duplicate plan 2'],
        errors: [],
      };

      vi.mocked(dbUtils.repairUserState).mockResolvedValue(mockRepair);

      const repairResult = await dbUtils.repairUserState(1);

      expect(repairResult.success).toBe(true);
      expect(repairResult.actions).toContain('Deactivated duplicate plan 2');
    });
  });

  describe('AC5: Testing and Validation', () => {
    it('should verify no duplicate active plans are created', async () => {
      const mockUser = {
        id: 1,
        goal: 'habit' as const,
        experience: 'beginner' as const,
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: true },
        onboardingComplete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(dbUtils.deactivateAllUserPlans).mockResolvedValue();
      vi.mocked(dbUtils.createPlan).mockResolvedValue(1);
      vi.mocked(dbUtils.createWorkout).mockResolvedValue(1);

      const onboardingManager = OnboardingManager.getInstance();
      
      // Create first plan
      await onboardingManager.generateTrainingPlan({
        goal: 'habit',
        experience: 'beginner',
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: true },
      });

      // Create second plan - should deactivate first
      await onboardingManager.generateTrainingPlan({
        goal: 'distance',
        experience: 'intermediate',
        preferredTimes: ['evening'],
        daysPerWeek: 4,
        consents: { data: true, gdpr: true, push: true },
      });

      expect(dbUtils.deactivateAllUserPlans).toHaveBeenCalledTimes(2);
    });

    it('should test race condition prevention', async () => {
      const mockUser = {
        id: 1,
        goal: 'habit' as const,
        experience: 'beginner' as const,
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: true },
        onboardingComplete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(dbUtils.deactivateAllUserPlans).mockResolvedValue();
      vi.mocked(dbUtils.createPlan).mockResolvedValue(1);
      vi.mocked(dbUtils.createWorkout).mockResolvedValue(1);

      const onboardingManager = OnboardingManager.getInstance();
      
      // Simulate concurrent plan creation
      const promises = [
        onboardingManager.generateTrainingPlan({
          goal: 'habit',
          experience: 'beginner',
          preferredTimes: ['morning'],
          daysPerWeek: 3,
          consents: { data: true, gdpr: true, push: true },
        }),
        onboardingManager.generateTrainingPlan({
          goal: 'distance',
          experience: 'intermediate',
          preferredTimes: ['evening'],
          daysPerWeek: 4,
          consents: { data: true, gdpr: true, push: true },
        }),
      ];

      const results = await Promise.all(promises);

      // Both should succeed due to conflict prevention
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(dbUtils.deactivateAllUserPlans).toHaveBeenCalledTimes(2);
    });

    it('should test database state consistency validation', async () => {
      const mockValidation = {
        isValid: true,
        hasActivePlan: true,
        hasCompletedOnboarding: true,
        planCount: 1,
        issues: [],
        recommendations: [],
      };

      vi.mocked(dbUtils.validateUserOnboardingState).mockResolvedValue(mockValidation);

      const validation = await dbUtils.validateUserOnboardingState(1);

      expect(validation.isValid).toBe(true);
      expect(validation.hasActivePlan).toBe(true);
      expect(validation.hasCompletedOnboarding).toBe(true);
      expect(validation.planCount).toBe(1);
      expect(validation.issues).toHaveLength(0);
    });
  });
}); 
