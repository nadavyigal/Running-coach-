import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildPersonalizationContext } from '../personalizationContext';
import { db } from '../db';

// Mock the database
vi.mock('../db', () => ({
  db: {
    users: {
      get: vi.fn(),
    },
    goals: {
      where: vi.fn(),
    },
    runs: {
      where: vi.fn(),
    },
    recoveryScores: {
      where: vi.fn(),
    },
  },
  resetDatabaseInstance: vi.fn(),
}));

describe('buildPersonalizationContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should build full context with all data available', async () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const mockUser = {
      id: 1,
      name: 'Test User',
      goal: 'speed' as const,
      experience: 'intermediate' as const,
      age: 30,
      coachingStyle: 'analytical' as const,
      motivations: ['health', 'competition'],
      barriers: ['time', 'weather'],
      preferredTimes: ['morning'],
      daysPerWeek: 4,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockGoals = [
      {
        id: 1,
        userId: 1,
        type: 'speed',
        title: 'Run 5K under 25 minutes',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockRuns = [
      {
        id: 1,
        userId: 1,
        distance: 5,
        duration: 1800,
        pace: 360,
        completedAt: sevenDaysAgo,
        createdAt: sevenDaysAgo,
        updatedAt: sevenDaysAgo,
      },
      {
        id: 2,
        userId: 1,
        distance: 8,
        duration: 3000,
        pace: 375,
        completedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
    ];

    const mockRecoveryScore = {
      id: 1,
      userId: 1,
      date: now,
      score: 75,
      sleepScore: 80,
      hrvScore: 70,
      restingHRScore: 75,
      createdAt: now,
      updatedAt: now,
    };

    (db.users.get as any).mockResolvedValue(mockUser);
    (db.goals.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockGoals),
      }),
    });
    (db.runs.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockRuns),
      }),
    });
    (db.recoveryScores.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        reverse: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([mockRecoveryScore]),
          }),
        }),
      }),
    });

    const context = await buildPersonalizationContext(1);

    expect(context).toBeDefined();
    expect(context.userProfile.goal).toBe('speed');
    expect(context.userProfile.experience).toBe('intermediate');
    expect(context.userProfile.coachingStyle).toBe('analytical');
    expect(context.activeGoals).toHaveLength(1);
    expect(context.recentActivity.runsLast7Days).toBe(2);
    expect(context.recoveryStatus).toBeDefined();
    expect(context.recoveryStatus?.score).toBe(75);
    expect(context.personalizationStrength).toBeGreaterThan(70); // High quality data
    expect(context.recommendationStrategy).toBe('advanced');
  });

  it('should handle missing user gracefully', async () => {
    (db.users.get as any).mockResolvedValue(null);

    const context = await buildPersonalizationContext(999);

    expect(context.userProfile.goal).toBe('habit'); // Default
    expect(context.personalizationStrength).toBeLessThan(40);
    expect(context.recommendationStrategy).toBe('basic');
  });

  it('should calculate personalization strength correctly with partial data', async () => {
    const mockUser = {
      id: 1,
      name: 'Test User',
      goal: 'distance' as const,
      experience: 'beginner' as const,
      coachingStyle: 'supportive' as const,
      daysPerWeek: 3,
      preferredTimes: ['evening'],
      createdAt: new Date(),
      updatedAt: new Date(),
      // Missing: age, motivations, barriers
    };

    (db.users.get as any).mockResolvedValue(mockUser);
    (db.goals.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    });
    (db.runs.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    });
    (db.recoveryScores.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        reverse: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });

    const context = await buildPersonalizationContext(1);

    expect(context.personalizationStrength).toBeGreaterThan(30);
    expect(context.personalizationStrength).toBeLessThan(70);
    expect(context.recommendationStrategy).toBe('personalized');
  });

  it('should determine recommendation strategy based on data quality', async () => {
    // Test basic strategy (low data)
    (db.users.get as any).mockResolvedValue({
      id: 1,
      goal: 'habit',
      experience: 'beginner',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (db.goals.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    });
    (db.runs.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    });
    (db.recoveryScores.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        reverse: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });

    const contextBasic = await buildPersonalizationContext(1);
    expect(contextBasic.recommendationStrategy).toBe('basic');
  });

  it('should calculate consistency correctly', async () => {
    const now = new Date();
    const mockRuns = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      userId: 1,
      distance: 5,
      duration: 1800,
      pace: 360,
      completedAt: new Date(now.getTime() - i * 2 * 24 * 60 * 60 * 1000), // Every 2 days
      createdAt: new Date(now.getTime() - i * 2 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - i * 2 * 24 * 60 * 60 * 1000),
    }));

    (db.users.get as any).mockResolvedValue({
      id: 1,
      goal: 'habit',
      experience: 'beginner',
      daysPerWeek: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (db.goals.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    });
    (db.runs.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockRuns),
      }),
    });
    (db.recoveryScores.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        reverse: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });

    const context = await buildPersonalizationContext(1);

    expect(context.recentActivity.consistency).toBeGreaterThan(80); // High consistency
  });

  it('should detect recovery issues', async () => {
    const now = new Date();
    const mockRecoveryScore = {
      id: 1,
      userId: 1,
      date: now,
      score: 35, // Low recovery score
      sleepScore: 40,
      hrvScore: 30,
      restingHRScore: 35,
      createdAt: now,
      updatedAt: now,
    };

    (db.users.get as any).mockResolvedValue({
      id: 1,
      goal: 'distance',
      experience: 'intermediate',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (db.goals.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    });
    (db.runs.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    });
    (db.recoveryScores.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        reverse: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([mockRecoveryScore]),
          }),
        }),
      }),
    });

    const context = await buildPersonalizationContext(1);

    expect(context.recoveryStatus).toBeDefined();
    expect(context.recoveryStatus?.needsRest).toBe(true);
    expect(context.recoveryStatus?.factors).toContain('Poor sleep quality');
    expect(context.recoveryStatus?.factors).toContain('Low HRV');
  });

  it('should handle errors gracefully and return basic context', async () => {
    (db.users.get as any).mockRejectedValue(new Error('Database error'));

    const context = await buildPersonalizationContext(1);

    expect(context).toBeDefined();
    expect(context.personalizationStrength).toBe(0);
    expect(context.recommendationStrategy).toBe('basic');
  });

  it('should calculate average pace correctly', async () => {
    const mockRuns = [
      {
        id: 1,
        userId: 1,
        distance: 5,
        duration: 1500, // 5 min/km pace
        pace: 300,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        userId: 1,
        distance: 10,
        duration: 3600, // 6 min/km pace
        pace: 360,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    (db.users.get as any).mockResolvedValue({
      id: 1,
      goal: 'speed',
      experience: 'advanced',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (db.goals.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    });
    (db.runs.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(mockRuns),
      }),
    });
    (db.recoveryScores.where as any).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        reverse: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });

    const context = await buildPersonalizationContext(1);

    expect(context.recentActivity.avgPace).toBeCloseTo(330, 0); // Average of 300 and 360
  });
});
