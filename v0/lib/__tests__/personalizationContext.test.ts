import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildPersonalizationContext } from '../personalizationContext';
import { dbUtils } from '../dbUtils';
import { RecoveryEngine } from '../recoveryEngine';

// Mock dbUtils
vi.mock('../dbUtils', () => ({
  dbUtils: {
    getUser: vi.fn(),
    getUserGoals: vi.fn(),
    getRunsByUser: vi.fn(),
  },
}));

// Mock RecoveryEngine
vi.mock('../recoveryEngine', () => ({
  RecoveryEngine: {
    getRecoveryScore: vi.fn(),
  },
}));

// Mock logger to suppress output
vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('buildPersonalizationContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should build full context with all data available', async () => {
    const now = new Date();
    // Use dates clearly within the 7-day window to avoid boundary timing issues
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

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
      calculatedVDOT: 55,
      vo2Max: 55,
      lactateThreshold: 270,
      maxHeartRate: 185,
      restingHeartRate: 50,
      historicalRuns: [
        { distance: 10, time: 3600, date: fiveDaysAgo },
      ],
      weeklyDistanceHistory: [20, 25, 30],
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
        isPrimary: true,
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
        completedAt: fiveDaysAgo,
        createdAt: fiveDaysAgo,
        updatedAt: fiveDaysAgo,
      },
      {
        id: 2,
        userId: 1,
        distance: 8,
        duration: 3000,
        pace: 375,
        completedAt: threeDaysAgo,
        createdAt: threeDaysAgo,
        updatedAt: threeDaysAgo,
      },
    ];

    const mockRecoveryScore = {
      overallScore: 75,
      recommendations: ['Good recovery', 'Ready for training'],
    };

    (dbUtils.getUser as any).mockResolvedValue(mockUser);
    (dbUtils.getUserGoals as any).mockResolvedValue(mockGoals);
    (dbUtils.getRunsByUser as any).mockResolvedValue(mockRuns);
    (RecoveryEngine.getRecoveryScore as any).mockResolvedValue(mockRecoveryScore);

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
    (dbUtils.getUser as any).mockResolvedValue(null);
    (dbUtils.getUserGoals as any).mockResolvedValue([]);
    (dbUtils.getRunsByUser as any).mockResolvedValue([]);
    (RecoveryEngine.getRecoveryScore as any).mockResolvedValue(null);

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
      motivations: ['health'], // Add one motivation to increase strength score
      createdAt: new Date(),
      updatedAt: new Date(),
      // Missing: age, barriers
    };

    (dbUtils.getUser as any).mockResolvedValue(mockUser);
    (dbUtils.getUserGoals as any).mockResolvedValue([]);
    (dbUtils.getRunsByUser as any).mockResolvedValue([]);
    (RecoveryEngine.getRecoveryScore as any).mockResolvedValue(null);

    const context = await buildPersonalizationContext(1);

    // With goal, experience, and days per week: 10 + 10 + 5 = 25
    expect(context.personalizationStrength).toBeGreaterThanOrEqual(20);
    expect(context.personalizationStrength).toBeLessThan(40);
    expect(context.recommendationStrategy).toBe('basic');
  });

  it('should determine recommendation strategy based on data quality', async () => {
    // Test basic strategy (low data)
    (dbUtils.getUser as any).mockResolvedValue({
      id: 1,
      goal: 'habit',
      experience: 'beginner',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (dbUtils.getUserGoals as any).mockResolvedValue([]);
    (dbUtils.getRunsByUser as any).mockResolvedValue([]);
    (RecoveryEngine.getRecoveryScore as any).mockResolvedValue(null);

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

    (dbUtils.getUser as any).mockResolvedValue({
      id: 1,
      goal: 'habit',
      experience: 'beginner',
      daysPerWeek: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (dbUtils.getUserGoals as any).mockResolvedValue([]);
    (dbUtils.getRunsByUser as any).mockResolvedValue(mockRuns);
    (RecoveryEngine.getRecoveryScore as any).mockResolvedValue(null);

    const context = await buildPersonalizationContext(1);

    expect(context.recentActivity.consistency).toBeGreaterThan(80); // High consistency
  });

  it('should detect recovery issues', async () => {
    const mockRecoveryScore = {
      overallScore: 35, // Low recovery score
      recommendations: ['Poor sleep quality', 'Low HRV', 'Consider rest day'],
    };

    (dbUtils.getUser as any).mockResolvedValue({
      id: 1,
      goal: 'distance',
      experience: 'intermediate',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (dbUtils.getUserGoals as any).mockResolvedValue([]);
    (dbUtils.getRunsByUser as any).mockResolvedValue([]);
    (RecoveryEngine.getRecoveryScore as any).mockResolvedValue(mockRecoveryScore);

    const context = await buildPersonalizationContext(1);

    expect(context.recoveryStatus).toBeDefined();
    expect(context.recoveryStatus?.needsRest).toBe(true);
    expect(context.recoveryStatus?.factors).toContain('Poor sleep quality');
    expect(context.recoveryStatus?.factors).toContain('Low HRV');
  });

  it('should handle errors gracefully and return basic context', async () => {
    (dbUtils.getUser as any).mockRejectedValue(new Error('Database error'));

    const context = await buildPersonalizationContext(1);

    expect(context).toBeDefined();
    expect(context.personalizationStrength).toBe(20); // Fallback context has 20
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

    (dbUtils.getUser as any).mockResolvedValue({
      id: 1,
      goal: 'speed',
      experience: 'advanced',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (dbUtils.getUserGoals as any).mockResolvedValue([]);
    (dbUtils.getRunsByUser as any).mockResolvedValue(mockRuns);
    (RecoveryEngine.getRecoveryScore as any).mockResolvedValue(null);

    const context = await buildPersonalizationContext(1);

    expect(context.recentActivity.avgPace).toBeCloseTo(330, 0); // Average of 300 and 360
  });
});
