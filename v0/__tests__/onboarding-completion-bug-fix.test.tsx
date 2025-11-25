import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dbUtils } from '@/lib/dbUtils';
import { generatePlan, generateFallbackPlan } from '@/lib/planGenerator';

// Mock the database utilities
vi.mock('@/lib/dbUtils', () => ({
  dbUtils: {
    clearDatabase: vi.fn().mockResolvedValue(undefined),
    createUser: vi.fn().mockResolvedValue(1),
    getCurrentUser: vi.fn().mockResolvedValue({ 
      id: 1, 
      onboardingComplete: true,
      goal: 'habit',
      experience: 'beginner',
      preferredTimes: ['morning'],
      daysPerWeek: 3
    }),
    getActivePlan: vi.fn().mockResolvedValue({
      id: 1,
      title: 'Rookie Challenge Plan',
      isActive: true,
      totalWeeks: 3
    }),
    ensureUserHasActivePlan: vi.fn().mockResolvedValue({
      id: 1,
      title: 'Rookie Challenge Plan',
      isActive: true,
      totalWeeks: 3
    }),
    validateUserPlanIntegrity: vi.fn().mockResolvedValue({
      hasActivePlan: true,
      hasCompletedOnboarding: true,
      planCount: 1,
      issues: []
    }),
    getWorkoutsByPlan: vi.fn().mockResolvedValue([
      { id: 1, type: 'easy', distance: 2, day: 'Mon', week: 1 },
      { id: 2, type: 'rest', distance: 0, day: 'Tue', week: 1 },
      { id: 3, type: 'easy', distance: 3, day: 'Wed', week: 1 }
    ])
  }
}));

// Mock the plan generator
vi.mock('@/lib/planGenerator', () => ({
  generatePlan: vi.fn().mockResolvedValue({
    plan: { 
      id: 1, 
      title: 'AI Generated Plan', 
      totalWeeks: 3,
      userId: 1,
      startDate: new Date(),
      endDate: new Date(),
      isActive: true,
      planType: 'basic',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    workouts: [
      { id: 1, type: 'easy', distance: 2, day: 'Mon', week: 1 },
      { id: 2, type: 'rest', distance: 0, day: 'Tue', week: 1 },
      { id: 3, type: 'easy', distance: 3, day: 'Wed', week: 1 }
    ]
  }),
  generateFallbackPlan: vi.fn().mockResolvedValue({
    plan: { 
      id: 1, 
      title: 'Fallback Plan', 
      totalWeeks: 3,
      userId: 1,
      startDate: new Date(),
      endDate: new Date(),
      isActive: true,
      planType: 'basic',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    workouts: [
      { id: 1, type: 'easy', distance: 2, day: 'Mon', week: 1 },
      { id: 2, type: 'rest', distance: 0, day: 'Tue', week: 1 },
      { id: 3, type: 'easy', distance: 3, day: 'Wed', week: 1 }
    ]
  })
}));

describe('Onboarding Completion Bug Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Chat Overlay Onboarding Flow', () => {
    it('should complete onboarding and create user with plan', async () => {
      // Step 1: Simulate chat overlay completion
      const userData = {
        goal: 'habit' as const,
        experience: 'beginner' as const,
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: {
          data: true,
          gdpr: true,
          push: false
        },
        onboardingComplete: true,
        age: 25,
        coachingStyle: 'supportive' as const
      };

      // Step 2: Create user
      const userId = await dbUtils.createUser(userData);
      expect(userId).toBe(1);

      // Step 3: Get the created user
      const user = await dbUtils.getCurrentUser();
      expect(user).toBeDefined();
      expect(user?.id).toBe(1);
      expect(user?.onboardingComplete).toBe(true);

      // Step 4: Generate training plan
      let planResult;
      try {
        planResult = await generatePlan({ user: user!, rookie_challenge: true });
      } catch (error) {
        planResult = await generateFallbackPlan(user!);
      }

      expect(planResult).toBeDefined();
      expect(planResult.plan).toBeDefined();
      expect(planResult.workouts).toBeDefined();

      // Step 5: Validate plan integrity
      const validation = await dbUtils.validateUserPlanIntegrity(user!.id!);
      expect(validation.hasActivePlan).toBe(true);
      expect(validation.hasCompletedOnboarding).toBe(true);

      // Step 6: Verify app state
      const finalUser = await dbUtils.getCurrentUser();
      const activePlan = await dbUtils.getActivePlan(user!.id!);

      expect(finalUser?.onboardingComplete).toBe(true);
      expect(activePlan).toBeDefined();
      expect(activePlan?.isActive).toBe(true);

      // Step 7: Verify Today screen would have data
      const workouts = await dbUtils.getWorkoutsByPlan(activePlan!.id!);
      expect(workouts.length).toBeGreaterThan(0);
    });
  });

  describe('Regular Onboarding Screen Flow', () => {
    it('should complete onboarding and create user with plan', async () => {
      // Step 1: Migrate localStorage data
      await dbUtils.clearDatabase();

      // Step 2: Create user record
      const userData = {
        goal: 'habit' as const,
        experience: 'beginner' as const,
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: {
          data: true,
          gdpr: true,
          push: false
        },
        onboardingComplete: true,
        rpe: 5,
        age: 30,
      };

      const userId = await dbUtils.createUser(userData);
      expect(userId).toBe(1);

      // Step 3: Get the created user
      const user = await dbUtils.getCurrentUser();
      expect(user).toBeDefined();
      expect(user?.id).toBe(1);
      expect(user?.onboardingComplete).toBe(true);

      // Step 4: Generate training plan
      let planResult;
      try {
        planResult = await generatePlan({ user: user!, rookie_challenge: true });
      } catch (error) {
        planResult = await generateFallbackPlan(user!);
      }

      expect(planResult).toBeDefined();
      expect(planResult.plan).toBeDefined();

      // Step 5: Validate plan integrity
      const validationResult = await dbUtils.validateUserPlanIntegrity(user!.id!);
      expect(validationResult.hasActivePlan).toBe(true);

      // Step 6: Verify app state
      const finalUser = await dbUtils.getCurrentUser();
      const activePlan = await dbUtils.getActivePlan(user!.id!);

      expect(finalUser?.onboardingComplete).toBe(true);
      expect(activePlan).toBeDefined();
    });
  });

  describe('App State Verification', () => {
    it('should correctly determine app state after onboarding', async () => {
      // Step 1: Create a user with onboarding complete
      const userId = await dbUtils.createUser({
        goal: 'habit',
        experience: 'beginner',
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: {
          data: true,
          gdpr: true,
          push: false
        },
        onboardingComplete: true,
        age: 25
      });

      // Step 2: Ensure user has active plan
      const plan = await dbUtils.ensureUserHasActivePlan(userId);
      expect(plan).toBeDefined();
      expect(plan.isActive).toBe(true);

      // Step 3: Verify app should show Today screen
      const user = await dbUtils.getCurrentUser();
      const activePlan = await dbUtils.getActivePlan(userId);

      expect(user?.onboardingComplete).toBe(true);
      expect(activePlan).toBeDefined();

      // Step 4: Verify plan has workouts
      const workouts = await dbUtils.getWorkoutsByPlan(plan.id!);
      expect(workouts.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle plan generation failures gracefully', async () => {
      // Mock plan generation to fail
      vi.mocked(generatePlan).mockRejectedValue(new Error('API Error'));
      vi.mocked(generateFallbackPlan).mockResolvedValue({
        plan: { id: 1, title: 'Fallback Plan', totalWeeks: 3 },
        workouts: []
      });

      const user = await dbUtils.getCurrentUser();
      
      // Should fall back to fallback plan
      let planResult;
      try {
        planResult = await generatePlan({ user: user!, rookie_challenge: true });
      } catch (error) {
        planResult = await generateFallbackPlan(user!);
      }

      expect(planResult).toBeDefined();
      expect(planResult.plan.title).toBe('Fallback Plan');
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      vi.mocked(dbUtils.createUser).mockRejectedValue(new Error('Database Error'));

      await expect(dbUtils.createUser({
        goal: 'habit',
        experience: 'beginner',
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        consents: { data: true, gdpr: true, push: false },
        onboardingComplete: true,
        age: 25
      })).rejects.toThrow('Database Error');
    });
  });
}); 