import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { HabitAnalyticsService } from './habitAnalytics';
import { db, type User, type Run, type Workout, type Goal } from './db';

// Mock date-fns to have predictable dates
vi.mock('date-fns', () => {
  const actual = vi.importActual('date-fns');
  return {
    ...actual,
    subDays: vi.fn((date: Date, days: number) => {
      const result = new Date(date);
      result.setDate(result.getDate() - days);
      return result;
    }),
    startOfWeek: vi.fn((date: Date) => {
      const result = new Date(date);
      result.setDate(result.getDate() - result.getDay());
      return result;
    }),
    endOfWeek: vi.fn((date: Date) => {
      const result = new Date(date);
      result.setDate(result.getDate() - result.getDay() + 6);
      return result;
    }),
    differenceInDays: vi.fn((date1: Date, date2: Date) => {
      const diffTime = Math.abs(date1.getTime() - date2.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    })
  };
});

vi.mock('@/lib/featureFlags', () => ({
  ENABLE_WEEKLY_RECAP: true
}));

describe('HabitAnalyticsService', () => {
  let service: HabitAnalyticsService;
  let testUser: User;
  let testDate: Date;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    // Reset database
    if (db) {
      await db.delete();
      await db.open();
    }

    service = new HabitAnalyticsService();
    testDate = new Date('2025-01-15T10:00:00Z');
    
    // Create test user
    testUser = {
      id: 1,
      name: 'Test User',
      goal: 'habit',
      experience: 'beginner',
      preferredTimes: ['morning'],
      daysPerWeek: 3,
      consents: { data: true, gdpr: true, push: true },
      onboardingComplete: true,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
      currentStreak: 5,
      longestStreak: 12,
      lastActivityDate: new Date('2025-01-14')
    };

    if (db) {
      await db.users.add(testUser);
    }
  });

  describe('calculateHabitAnalytics', () => {
    it('should calculate basic habit metrics for user with no data', async () => {
      const analytics = await service.calculateHabitAnalytics(1);

      expect(analytics).toBeDefined();
      expect(analytics.currentStreak).toBe(5);
      expect(analytics.longestStreak).toBe(12);
      expect(analytics.weeklyConsistency).toBe(100); // No workouts = 100% consistency
      expect(analytics.monthlyConsistency).toBe(100);
      expect(analytics.riskLevel).toBe('low'); // Good streak should be low risk
      expect(analytics.lastUpdated).toBeInstanceOf(Date);
    });

    it('should calculate analytics with run data', async () => {
      if (!db) return;

      // Add test runs
      const runs: Omit<Run, 'id'>[] = [
        {
          userId: 1,
          type: 'easy',
          distance: 5,
          duration: 1800, // 30 minutes
          completedAt: new Date('2025-01-10T08:00:00Z'),
          createdAt: new Date('2025-01-10')
        },
        {
          userId: 1,
          type: 'tempo',
          distance: 3,
          duration: 1200, // 20 minutes
          completedAt: new Date('2025-01-12T09:00:00Z'),
          createdAt: new Date('2025-01-12')
        },
        {
          userId: 1,
          type: 'long',
          distance: 8,
          duration: 3000, // 50 minutes
          completedAt: new Date('2025-01-14T07:30:00Z'),
          createdAt: new Date('2025-01-14')
        }
      ];

      for (const run of runs) {
        await db.runs.add(run);
      }

      const analytics = await service.calculateHabitAnalytics(1);

      expect(analytics.preferredDays.length).toBeGreaterThan(0);
      expect(analytics.optimalTimes.length).toBeGreaterThan(0);
      expect(analytics.consistentDuration).toBeGreaterThan(0);
      expect(analytics.motivationFactors.length).toBeGreaterThan(0);
    });

    it('should calculate analytics with workout plan data', async () => {
      if (!db) return;

      // Add test plan
      const plan = await db.plans.add({
        userId: 1,
        title: 'Test Plan',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-02-01'),
        totalWeeks: 4,
        isActive: true,
        planType: 'basic',
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01')
      });

      // Add test workouts
      const workouts: Omit<Workout, 'id'>[] = [
        {
          planId: plan as number,
          week: 1,
          day: 'Mon',
          type: 'easy',
          distance: 5,
          completed: true,
          scheduledDate: new Date('2025-01-06'),
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-06')
        },
        {
          planId: plan as number,
          week: 1,
          day: 'Wed',
          type: 'tempo',
          distance: 3,
          completed: false,
          scheduledDate: new Date('2025-01-08'),
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01')
        },
        {
          planId: plan as number,
          week: 1,
          day: 'Fri',
          type: 'long',
          distance: 8,
          completed: true,
          scheduledDate: new Date('2025-01-10'),
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-10')
        }
      ];

      for (const workout of workouts) {
        await db.workouts.add(workout);
      }

      const analytics = await service.calculateHabitAnalytics(1);

      expect(analytics.planAdherence).toBe(67); // 2 out of 3 completed = 67%
      expect(analytics.suggestions.length).toBeGreaterThan(0);
    });

    it('should calculate analytics with goal data', async () => {
      if (!db) return;

      // Add test goal
      const goal: Omit<Goal, 'id'>[] = [{
        userId: 1,
        title: 'Run 5K',
        description: 'Complete a 5K run',
        goalType: 'distance_achievement',
        category: 'endurance',
        priority: 1,
        status: 'active',
        specificTarget: {
          metric: 'distance',
          value: 5,
          unit: 'km',
          description: 'Run 5 kilometers'
        },
        measurableOutcome: {
          successCriteria: ['Complete 5K in under 30 minutes'],
          trackingMethod: 'GPS tracking',
          measurementFrequency: 'weekly'
        },
        achievabilityAssessment: {
          difficultyRating: 5,
          requiredResources: ['Running shoes', 'Safe route'],
          potentialObstacles: ['Weather', 'Time constraints'],
          mitigationStrategies: ['Indoor alternatives', 'Flexible scheduling']
        },
        relevanceJustification: {
          personalImportance: 8,
          alignmentWithValues: 'Health and fitness',
          motivationalFactors: ['Personal achievement', 'Health benefits']
        },
        timeBound: {
          startDate: new Date('2025-01-01'),
          deadline: new Date('2025-03-01'),
          milestoneSchedule: [25, 50, 75],
          estimatedDuration: 60
        },
        baselineValue: 0,
        targetValue: 5,
        currentValue: 2.5,
        lastUpdated: new Date('2025-01-15'),
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-15')
      }];

      for (const g of goal) {
        await db.goals.add(g);
      }

      const analytics = await service.calculateHabitAnalytics(1);

      expect(analytics.goalAlignment).toBeGreaterThan(0);
      expect(analytics.motivationFactors.some(f => f.factor.includes('Goal'))).toBe(true);
    });

    it('should handle user not found error', async () => {
      await expect(service.calculateHabitAnalytics(999)).rejects.toThrow('User not found');
    });

    it('should assess high risk correctly', async () => {
      if (!db) return;

      // Update user to have high risk indicators
      await db.users.update(1, {
        currentStreak: 0,
        lastActivityDate: new Date('2025-01-01') // 14 days ago
      });

      const analytics = await service.calculateHabitAnalytics(1);

      expect(analytics.riskLevel).toBe('high');
      expect(analytics.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('generateWeeklyRecap', () => {
    it('should generate a recap with 5 runs', async () => {
      if (!db) return;

      const weekStart = new Date(2025, 0, 6);
      const planId = await db.plans.add({
        userId: 1,
        title: 'Weekly Plan',
        startDate: new Date(2025, 0, 1),
        endDate: new Date(2025, 0, 31),
        totalWeeks: 4,
        isActive: true,
        planType: 'basic',
        createdAt: new Date(2025, 0, 1),
        updatedAt: new Date(2025, 0, 1)
      });

      const workouts: Omit<Workout, 'id'>[] = Array.from({ length: 5 }, (_, index) => ({
        planId: planId as number,
        week: 1,
        day: 'Mon',
        type: 'easy',
        distance: 5,
        completed: index < 4,
        scheduledDate: new Date(2025, 0, 6 + index),
        createdAt: new Date(2025, 0, 1),
        updatedAt: new Date(2025, 0, 6 + index)
      }));

      for (const workout of workouts) {
        await db.workouts.add(workout);
      }

      const runs: Omit<Run, 'id'>[] = [
        {
          userId: 1,
          type: 'easy',
          distance: 5,
          duration: 1500,
          pace: 300,
          completedAt: new Date(2025, 0, 6, 7),
          createdAt: new Date(2025, 0, 6)
        },
        {
          userId: 1,
          type: 'easy',
          distance: 4,
          duration: 1200,
          pace: 300,
          completedAt: new Date(2025, 0, 7, 7),
          createdAt: new Date(2025, 0, 7)
        },
        {
          userId: 1,
          type: 'tempo',
          distance: 6,
          duration: 1800,
          pace: 300,
          completedAt: new Date(2025, 0, 8, 7),
          createdAt: new Date(2025, 0, 8)
        },
        {
          userId: 1,
          type: 'easy',
          distance: 3,
          duration: 900,
          pace: 300,
          completedAt: new Date(2025, 0, 9, 7),
          createdAt: new Date(2025, 0, 9)
        },
        {
          userId: 1,
          type: 'long',
          distance: 7,
          duration: 2100,
          pace: 300,
          completedAt: new Date(2025, 0, 11, 7),
          createdAt: new Date(2025, 0, 11)
        }
      ];

      for (const run of runs) {
        await db.runs.add(run);
      }

      const recap = await service.generateWeeklyRecap(1, weekStart);

      expect(recap.totalRuns).toBe(5);
      expect(recap.totalDistance).toBe(25);
      expect(recap.totalDuration).toBe(7500);
      expect(recap.averagePace).toBe('5:00/km');
      expect(recap.consistencyScore).toBe(100);
      expect(recap.topAchievement.length).toBeGreaterThan(0);
      expect(recap.nextWeekGoal).toContain('27.5 km');
    });

    it('should handle a recap with zero runs', async () => {
      const weekStart = new Date(2025, 0, 13);

      const recap = await service.generateWeeklyRecap(1, weekStart);

      expect(recap.totalRuns).toBe(0);
      expect(recap.totalDistance).toBe(0);
      expect(recap.totalDuration).toBe(0);
      expect(recap.averagePace).toBe('0:00/km');
      expect(recap.topAchievement).toContain('No runs');
    });

    it('should calculate week-over-week changes', async () => {
      if (!db) return;

      const weekStart = new Date(2025, 0, 20);
      await db.runs.add({
        userId: 1,
        type: 'easy',
        distance: 5,
        duration: 1500,
        pace: 300,
        completedAt: new Date(2025, 0, 14, 7),
        createdAt: new Date(2025, 0, 14)
      });

      await db.runs.bulkAdd([
        {
          userId: 1,
          type: 'easy',
          distance: 5,
          duration: 1500,
          pace: 300,
          completedAt: new Date(2025, 0, 20, 7),
          createdAt: new Date(2025, 0, 20)
        },
        {
          userId: 1,
          type: 'easy',
          distance: 5,
          duration: 1500,
          pace: 300,
          completedAt: new Date(2025, 0, 22, 7),
          createdAt: new Date(2025, 0, 22)
        }
      ]);

      const recap = await service.generateWeeklyRecap(1, weekStart);

      expect(recap.weekOverWeekChange.distance).toBe(100);
      expect(recap.weekOverWeekChange.runs).toBe(100);
      expect(recap.weekStartDate.getTime()).toBe(weekStart.getTime());
      expect(recap.weekEndDate.getTime()).toBe(new Date(2025, 0, 26, 23, 59, 59, 999).getTime());
    });
  });

  describe('getHabitRisk', () => {
    it('should return low risk for consistent user', async () => {
      const risk = await service.getHabitRisk(1);

      expect(risk.level).toBe('low');
      expect(risk.priority).toBe(3);
      expect(Array.isArray(risk.factors)).toBe(true);
      expect(Array.isArray(risk.recommendations)).toBe(true);
    });

    it('should return high risk for user with no streak', async () => {
      if (!db) return;

      await db.users.update(1, {
        currentStreak: 0,
        lastActivityDate: new Date('2025-01-01')
      });

      const risk = await service.getHabitRisk(1);

      expect(risk.level).toBe('high');
      expect(risk.priority).toBe(1);
      expect(risk.factors.length).toBeGreaterThan(0);
      expect(risk.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle database unavailable', async () => {
      // Mock db as null
      const originalDb = (global as any).db;
      (global as any).db = null;

      await expect(service.calculateHabitAnalytics(1)).rejects.toThrow('Database not available');

      // Restore db
      (global as any).db = originalDb;
    });

    it('should handle empty data gracefully', async () => {
      const analytics = await service.calculateHabitAnalytics(1);

      expect(analytics).toBeDefined();
      expect(analytics.preferredDays).toEqual([]);
      expect(analytics.optimalTimes).toEqual([]);
      expect(analytics.motivationFactors).toEqual([]);
    });
  });
});
