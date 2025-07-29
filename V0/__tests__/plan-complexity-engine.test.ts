import { describe, it, expect, vi, beforeEach } from 'vitest';
import { planComplexityEngine } from '../lib/plan-complexity-engine';
import { getCurrentUser, getUserRuns, getPlanWorkouts } from '../lib/dbUtils';

// Mock the database utilities
vi.mock('../lib/dbUtils', () => ({
  getCurrentUser: vi.fn(),
  getUserRuns: vi.fn(),
  getPlanWorkouts: vi.fn(),
}));

describe('Plan Complexity Engine', () => {
  const mockUser = {
    id: 1,
    name: 'Test User',
    goal: 'habit' as const,
    experience: 'beginner' as const,
    preferredTimes: ['morning'],
    daysPerWeek: 3,
    consents: { data: true, gdpr: true, push: true },
    onboardingComplete: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPlan = {
    id: 1,
    userId: 1,
    title: 'Test Plan',
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    totalWeeks: 4,
    isActive: true,
    planType: 'basic' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRuns = [
    {
      id: 1,
      userId: 1,
      type: 'easy' as const,
      distance: 5,
      duration: 1800, // 30 minutes
      pace: 360, // 6:00/km
      completedAt: new Date(),
      createdAt: new Date(),
    },
    {
      id: 2,
      userId: 1,
      type: 'easy' as const,
      distance: 5,
      duration: 1740, // 29 minutes
      pace: 348, // 5:48/km
      completedAt: new Date(),
      createdAt: new Date(),
    },
  ];

  const mockWorkouts = [
    {
      id: 1,
      planId: 1,
      week: 1,
      day: 'Mon',
      type: 'easy' as const,
      distance: 5,
      completed: true,
      scheduledDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      planId: 1,
      week: 1,
      day: 'Wed',
      type: 'tempo' as const,
      distance: 8,
      completed: true,
      scheduledDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 3,
      planId: 1,
      week: 1,
      day: 'Fri',
      type: 'long' as const,
      distance: 12,
      completed: false,
      scheduledDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculatePlanComplexity', () => {
    it('should calculate complexity for a beginner user', async () => {
      // Mock the database calls
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (getUserRuns as any).mockResolvedValue(mockRuns);
      (getPlanWorkouts as any).mockResolvedValue(mockWorkouts);

      const complexity = await planComplexityEngine.calculatePlanComplexity(1, mockPlan);

      expect(complexity).toBeDefined();
      expect(complexity.userExperience).toBe('beginner');
      expect(complexity.complexityScore).toBeGreaterThanOrEqual(0);
      expect(complexity.complexityScore).toBeLessThanOrEqual(100);
      expect(complexity.planLevel).toBeDefined();
      expect(complexity.adaptationFactors).toHaveLength(4);
    });

    it('should handle empty runs and workouts', async () => {
      (getCurrentUser as any).mockResolvedValue(mockUser);
      (getUserRuns as any).mockResolvedValue([]);
      (getPlanWorkouts as any).mockResolvedValue([]);

      const complexity = await planComplexityEngine.calculatePlanComplexity(1, mockPlan);

      expect(complexity).toBeDefined();
      expect(complexity.complexityScore).toBeGreaterThanOrEqual(0);
      expect(complexity.complexityScore).toBeLessThanOrEqual(100);
    });

    it('should handle user not found', async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      const complexity = await planComplexityEngine.calculatePlanComplexity(1, mockPlan);

      expect(complexity).toBeDefined();
      expect(complexity.userExperience).toBe('beginner');
      expect(complexity.complexityScore).toBe(30);
    });
  });

  describe('getComplexityDescription', () => {
    it('should return appropriate descriptions for different complexity scores', () => {
      expect(planComplexityEngine.getComplexityDescription(20)).toContain('Very Easy');
      expect(planComplexityEngine.getComplexityDescription(40)).toContain('Easy');
      expect(planComplexityEngine.getComplexityDescription(60)).toContain('Moderate');
      expect(planComplexityEngine.getComplexityDescription(80)).toContain('Challenging');
      expect(planComplexityEngine.getComplexityDescription(90)).toContain('Advanced');
    });
  });

  describe('getComplexityColor', () => {
    it('should return appropriate colors for different complexity scores', () => {
      expect(planComplexityEngine.getComplexityColor(20)).toContain('green');
      expect(planComplexityEngine.getComplexityColor(40)).toContain('blue');
      expect(planComplexityEngine.getComplexityColor(60)).toContain('yellow');
      expect(planComplexityEngine.getComplexityColor(80)).toContain('orange');
      expect(planComplexityEngine.getComplexityColor(90)).toContain('red');
    });
  });

  describe('suggestPlanAdjustments', () => {
    it('should suggest adjustments for complex plans for beginners', async () => {
      const complexity = {
        userExperience: 'beginner' as const,
        planLevel: 'advanced' as const,
        complexityScore: 85,
        adaptationFactors: [
          { factor: 'consistency' as const, weight: 0.25, currentValue: 3, targetValue: 8 },
          { factor: 'performance' as const, weight: 0.3, currentValue: 2, targetValue: 7 },
        ],
      };

      const suggestions = await planComplexityEngine.suggestPlanAdjustments(1, mockPlan, complexity);

      expect(suggestions).toContain('Consider reducing workout intensity to build confidence');
      expect(suggestions).toContain('Focus on completing more workouts to build consistency');
    });

    it('should suggest adjustments for easy plans for advanced users', async () => {
      const complexity = {
        userExperience: 'advanced' as const,
        planLevel: 'basic' as const,
        complexityScore: 25,
        adaptationFactors: [],
      };

      const suggestions = await planComplexityEngine.suggestPlanAdjustments(1, mockPlan, complexity);

      expect(suggestions).toContain('You may benefit from more challenging workouts');
    });
  });
});