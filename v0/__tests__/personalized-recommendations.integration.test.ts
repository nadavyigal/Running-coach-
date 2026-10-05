import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPersonalizationContext } from '@/lib/personalizationContext';
import { SubscriptionGate, ProFeature } from '@/lib/subscriptionGates';
import { RecoveryEngine } from '@/lib/recoveryEngine';
import { dbUtils } from '@/lib/dbUtils';

vi.mock('@/lib/dbUtils', () => ({
  dbUtils: {
    getUser: vi.fn(),
    getUserGoals: vi.fn(),
    getRunsByUser: vi.fn(),
  },
}));

const baseRecoveryScore = {
  userId: 1,
  date: new Date(),
  overallScore: 55,
  sleepScore: 50,
  hrvScore: 50,
  restingHRScore: 50,
  subjectiveWellnessScore: 50,
  trainingLoadImpact: -5,
  stressLevel: 60,
  recommendations: [],
  confidence: 80,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Personalized Recommendations Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(RecoveryEngine, 'getRecoveryScore').mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds personalization context with user profile and recent activity', async () => {
    const mockUser = {
      id: 1,
      goal: 'habit' as const,
      experience: 'beginner' as const,
      coachingStyle: 'supportive' as const,
      motivations: ['health'],
      barriers: ['time'],
      preferredTimes: ['morning'],
      daysPerWeek: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockRuns = [
      {
        id: 1,
        userId: 1,
        distance: 3,
        duration: 1200,
        pace: 400,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        userId: 1,
        distance: 4,
        duration: 1500,
        pace: 380,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(dbUtils.getUser).mockResolvedValue(mockUser as any);
    vi.mocked(dbUtils.getUserGoals).mockResolvedValue([]);
    vi.mocked(dbUtils.getRunsByUser).mockResolvedValue(mockRuns as any);

    const context = await buildPersonalizationContext(1);

    expect(context.userProfile.goal).toBe('habit');
    expect(context.userProfile.coachingStyle).toBe('supportive');
    expect(context.recentActivity.runsLast30Days).toBe(2);
  });

  it('applies coaching style prefixes in recovery recommendations', async () => {
    const styles = [
      { style: 'supportive' as const, prefix: 'take care of yourself' },
      { style: 'challenging' as const, prefix: 'push smart' },
      { style: 'analytical' as const, prefix: 'data shows' },
      { style: 'encouraging' as const, prefix: 'great progress' },
    ];

    for (const { style, prefix } of styles) {
      const mockUser = {
        id: 10,
        goal: 'distance' as const,
        experience: 'intermediate' as const,
        coachingStyle: style,
        motivations: ['health'],
        barriers: [],
        preferredTimes: ['morning'],
        daysPerWeek: 4,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(dbUtils.getUser).mockResolvedValue(mockUser as any);
      vi.mocked(dbUtils.getUserGoals).mockResolvedValue([]);
      vi.mocked(dbUtils.getRunsByUser).mockResolvedValue([]);

      const context = await buildPersonalizationContext(10);
      const recommendations = await RecoveryEngine.generatePersonalizedRecommendations(
        10,
        baseRecoveryScore as any,
        context
      );

      const hasPrefix = recommendations.some((rec) =>
        rec.toLowerCase().includes(prefix)
      );
      expect(hasPrefix).toBe(true);
    }
  });

  it('grants access in testing mode and provides upgrade prompts', async () => {
    const hasAccess = await SubscriptionGate.hasAccess(1, ProFeature.RECOVERY_RECOMMENDATIONS);
    expect(hasAccess).toBe(true);

    const upgradePrompt = SubscriptionGate.getUpgradePrompt(ProFeature.RECOVERY_RECOMMENDATIONS);
    expect(upgradePrompt).toContain('Pro');
  });

  it('returns trial status from user dates', async () => {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    vi.mocked(dbUtils.getUser).mockResolvedValue({
      id: 4,
      subscriptionTier: 'free',
      subscriptionStatus: 'trial',
      trialEndDate: trialEnd,
      createdAt: now,
      updatedAt: now,
    } as any);

    const trialStatus = await SubscriptionGate.getTrialStatus(4);
    expect(trialStatus.isActive).toBe(true);
    expect(trialStatus.daysRemaining).toBeGreaterThan(0);
  });

  it('uses advanced strategy when data is rich', async () => {
    const now = new Date();
    const mockUser = {
      id: 20,
      goal: 'speed' as const,
      experience: 'advanced' as const,
      age: 28,
      coachingStyle: 'analytical' as const,
      motivations: ['competition', 'health'],
      barriers: ['injury-prevention'],
      preferredTimes: ['morning', 'evening'],
      daysPerWeek: 6,
      calculatedVDOT: 45,
      vo2Max: 52,
      lactateThreshold: 250,
      maxHeartRate: 190,
      historicalRuns: [{ distance: 10 }],
      weeklyDistanceHistory: [30, 35, 40],
      createdAt: now,
      updatedAt: now,
    };

    const mockGoals = [
      {
        id: 1,
        userId: 20,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ];

    const mockRuns = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      userId: 20,
      distance: 5 + Math.random() * 5,
      duration: 1800 + Math.random() * 600,
      pace: 350 + Math.random() * 30,
      completedAt: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
      createdAt: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
    }));

    vi.mocked(dbUtils.getUser).mockResolvedValue(mockUser as any);
    vi.mocked(dbUtils.getUserGoals).mockResolvedValue(mockGoals as any);
    vi.mocked(dbUtils.getRunsByUser).mockResolvedValue(mockRuns as any);

    const context = await buildPersonalizationContext(20);

    expect(context.personalizationStrength).toBeGreaterThan(70);
    expect(context.recommendationStrategy).toBe('advanced');
    expect(context.recentActivity.runsLast30Days).toBe(30);
  });

  it('uses basic strategy when data is minimal', async () => {
    const mockUser = {
      id: 21,
      goal: 'habit' as const,
      experience: 'beginner' as const,
      coachingStyle: 'supportive' as const,
      motivations: [],
      barriers: [],
      preferredTimes: [],
      daysPerWeek: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(dbUtils.getUser).mockResolvedValue(mockUser as any);
    vi.mocked(dbUtils.getUserGoals).mockResolvedValue([]);
    vi.mocked(dbUtils.getRunsByUser).mockResolvedValue([]);

    const context = await buildPersonalizationContext(21);

    expect(context.personalizationStrength).toBeLessThan(40);
    expect(context.recommendationStrategy).toBe('basic');
  });
});
