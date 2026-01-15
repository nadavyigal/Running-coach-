import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../lib/db';
import { buildPersonalizationContext } from '../lib/personalizationContext';
import { SubscriptionGate, ProFeature } from '../lib/subscriptionGates';
import { RecoveryEngine } from '../lib/recoveryEngine';

// Mock database for integration tests
vi.mock('../lib/db', () => ({
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
    sleepData: {
      where: vi.fn(),
    },
    hrvMeasurements: {
      where: vi.fn(),
    },
  },
  resetDatabaseInstance: vi.fn(),
}));

describe('Personalized Recommendations Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Habit Goal User Recommendations', () => {
    it('should provide habit-focused recommendations for habit goal users', async () => {
      const now = new Date();
      const mockUser = {
        id: 1,
        name: 'Habit User',
        goal: 'habit' as const,
        experience: 'beginner' as const,
        coachingStyle: 'supportive' as const,
        motivations: ['health', 'stress-relief'],
        barriers: ['time', 'motivation'],
        preferredTimes: ['morning'],
        daysPerWeek: 3,
        subscriptionTier: 'pro' as const,
        subscriptionStatus: 'active' as const,
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
          completedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        },
      ];

      const mockRecoveryScore = {
        id: 1,
        userId: 1,
        date: now,
        score: 45, // Low recovery
        sleepScore: 50,
        hrvScore: 40,
        restingHRScore: 45,
        createdAt: now,
        updatedAt: now,
      };

      (db.users.get as any).mockResolvedValue(mockUser);
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
              toArray: vi.fn().mockResolvedValue([mockRecoveryScore]),
            }),
          }),
        }),
      });

      // Verify Pro access
      const hasAccess = await SubscriptionGate.hasAccess(1, ProFeature.RECOVERY_RECOMMENDATIONS);
      expect(hasAccess).toBe(true);

      // Build personalization context
      const context = await buildPersonalizationContext(1);
      expect(context.userProfile.goal).toBe('habit');

      // Generate personalized recommendations
      const recommendations = await RecoveryEngine.generatePersonalizedRecommendations(
        1,
        mockRecoveryScore,
        context
      );

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);

      // Check for habit-specific language
      const hasHabitFocus = recommendations.some(rec =>
        rec.toLowerCase().includes('streak') ||
        rec.toLowerCase().includes('routine') ||
        rec.toLowerCase().includes('habit')
      );
      expect(hasHabitFocus).toBe(true);

      // Check for supportive coaching style
      const hasSupportiveTone = recommendations.some(rec =>
        rec.toLowerCase().includes('take care') ||
        rec.toLowerCase().includes('listen to your body')
      );
      expect(hasSupportiveTone).toBe(true);
    });
  });

  describe('Analytical Coaching Style', () => {
    it('should use data-driven language for analytical users', async () => {
      const mockUser = {
        id: 2,
        name: 'Analytical User',
        goal: 'speed' as const,
        experience: 'advanced' as const,
        coachingStyle: 'analytical' as const,
        motivations: ['performance', 'data'],
        barriers: [],
        preferredTimes: ['morning'],
        daysPerWeek: 5,
        subscriptionTier: 'pro' as const,
        subscriptionStatus: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockRecoveryScore = {
        id: 1,
        userId: 2,
        date: new Date(),
        score: 85,
        sleepScore: 90,
        hrvScore: 80,
        restingHRScore: 85,
        createdAt: new Date(),
        updatedAt: new Date(),
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
              toArray: vi.fn().mockResolvedValue([mockRecoveryScore]),
            }),
          }),
        }),
      });

      const context = await buildPersonalizationContext(2);
      const recommendations = await RecoveryEngine.generatePersonalizedRecommendations(
        2,
        mockRecoveryScore,
        context
      );

      // Check for analytical/data-driven language
      const hasDataLanguage = recommendations.some(rec =>
        rec.toLowerCase().includes('data') ||
        rec.toLowerCase().includes('metrics') ||
        rec.toLowerCase().includes('score') ||
        rec.toLowerCase().includes('analysis')
      );
      expect(hasDataLanguage).toBe(true);
    });
  });

  describe('Free User Access Control', () => {
    it('should deny Pro features to free users', async () => {
      const mockUser = {
        id: 3,
        name: 'Free User',
        goal: 'distance' as const,
        experience: 'intermediate' as const,
        subscriptionTier: 'free' as const,
        subscriptionStatus: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.users.get as any).mockResolvedValue(mockUser);

      const hasAccess = await SubscriptionGate.hasAccess(3, ProFeature.RECOVERY_RECOMMENDATIONS);
      expect(hasAccess).toBe(false);

      const upgradePrompt = SubscriptionGate.getUpgradePrompt(ProFeature.RECOVERY_RECOMMENDATIONS);
      expect(upgradePrompt).toContain('Pro');
    });
  });

  describe('Trial User Access', () => {
    it('should grant full access to users in active trial period', async () => {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const mockUser = {
        id: 4,
        name: 'Trial User',
        goal: 'speed' as const,
        experience: 'beginner' as const,
        subscriptionTier: 'free' as const,
        subscriptionStatus: 'trial' as const,
        trialStartDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        trialEndDate: trialEnd,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.users.get as any).mockResolvedValue(mockUser);

      const hasAccess = await SubscriptionGate.hasAccess(4, ProFeature.SMART_RECOMMENDATIONS);
      expect(hasAccess).toBe(true);

      const trialStatus = await SubscriptionGate.getTrialStatus(4);
      expect(trialStatus?.isActive).toBe(true);
      expect(trialStatus?.daysRemaining).toBeGreaterThan(0);
    });

    it('should block access after trial expiration', async () => {
      const now = new Date();
      const trialEnd = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

      const mockUser = {
        id: 5,
        name: 'Expired Trial User',
        goal: 'habit' as const,
        experience: 'beginner' as const,
        subscriptionTier: 'free' as const,
        subscriptionStatus: 'trial' as const,
        trialStartDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
        trialEndDate: trialEnd,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.users.get as any).mockResolvedValue(mockUser);

      const hasAccess = await SubscriptionGate.hasAccess(5, ProFeature.PERSONALIZED_COACHING);
      expect(hasAccess).toBe(false);

      const trialStatus = await SubscriptionGate.getTrialStatus(5);
      expect(trialStatus?.isActive).toBe(false);
    });
  });

  describe('Different Coaching Styles', () => {
    const coachingStyles = [
      { style: 'supportive', expectedPhrase: 'take care' },
      { style: 'challenging', expectedPhrase: 'push' },
      { style: 'analytical', expectedPhrase: 'data' },
      { style: 'encouraging', expectedPhrase: 'great' },
    ] as const;

    coachingStyles.forEach(({ style, expectedPhrase }) => {
      it(`should use ${style} tone for ${style} coaching style`, async () => {
        const mockUser = {
          id: 10 + coachingStyles.indexOf({ style, expectedPhrase }),
          name: `${style} User`,
          goal: 'distance' as const,
          experience: 'intermediate' as const,
          coachingStyle: style,
          subscriptionTier: 'pro' as const,
          subscriptionStatus: 'active' as const,
          preferredTimes: ['morning'],
          daysPerWeek: 4,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const mockRecoveryScore = {
          id: 1,
          userId: mockUser.id,
          date: new Date(),
          score: 70,
          sleepScore: 75,
          hrvScore: 70,
          restingHRScore: 65,
          createdAt: new Date(),
          updatedAt: new Date(),
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
                toArray: vi.fn().mockResolvedValue([mockRecoveryScore]),
              }),
            }),
          }),
        });

        const context = await buildPersonalizationContext(mockUser.id);
        expect(context.userProfile.coachingStyle).toBe(style);

        const recommendations = await RecoveryEngine.generatePersonalizedRecommendations(
          mockUser.id,
          mockRecoveryScore,
          context
        );

        const hasExpectedTone = recommendations.some(rec =>
          rec.toLowerCase().includes(expectedPhrase)
        );
        expect(hasExpectedTone).toBe(true);
      });
    });
  });

  describe('Personalization Strength', () => {
    it('should use advanced strategy for users with rich data', async () => {
      const now = new Date();
      const mockUser = {
        id: 20,
        name: 'Rich Data User',
        goal: 'speed' as const,
        experience: 'advanced' as const,
        age: 28,
        coachingStyle: 'analytical' as const,
        motivations: ['competition', 'health', 'achievement'],
        barriers: ['injury-prevention'],
        preferredTimes: ['morning', 'evening'],
        daysPerWeek: 6,
        subscriptionTier: 'pro' as const,
        subscriptionStatus: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockGoals = [
        {
          id: 1,
          userId: 20,
          type: 'speed',
          title: 'Sub 20-minute 5K',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
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
              toArray: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const context = await buildPersonalizationContext(20);

      expect(context.personalizationStrength).toBeGreaterThan(70);
      expect(context.recommendationStrategy).toBe('advanced');
      expect(context.recentActivity.runsLast30Days).toBe(30);
    });

    it('should use basic strategy for new users with minimal data', async () => {
      const mockUser = {
        id: 21,
        name: 'New User',
        goal: 'habit' as const,
        experience: 'beginner' as const,
        subscriptionTier: 'free' as const,
        subscriptionStatus: 'trial' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
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

      const context = await buildPersonalizationContext(21);

      expect(context.personalizationStrength).toBeLessThan(40);
      expect(context.recommendationStrategy).toBe('basic');
    });
  });
});
