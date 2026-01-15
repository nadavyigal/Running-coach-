import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubscriptionGate, ProFeature, SubscriptionRequiredError } from '../subscriptionGates';
import { db } from '../db';

// Mock the database
vi.mock('../db', () => ({
  db: {
    users: {
      get: vi.fn(),
    },
  },
  resetDatabaseInstance: vi.fn(),
}));

describe('SubscriptionGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hasAccess', () => {
    it('should grant access to Pro users with active subscription', async () => {
      const mockUser = {
        id: 1,
        subscriptionTier: 'pro' as const,
        subscriptionStatus: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.users.get as any).mockResolvedValue(mockUser);

      const hasAccess = await SubscriptionGate.hasAccess(1, ProFeature.SMART_RECOMMENDATIONS);
      expect(hasAccess).toBe(true);
    });

    it('should grant access to users in active trial period', async () => {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      const mockUser = {
        id: 1,
        subscriptionTier: 'free' as const,
        subscriptionStatus: 'trial' as const,
        trialStartDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        trialEndDate: trialEnd,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.users.get as any).mockResolvedValue(mockUser);

      const hasAccess = await SubscriptionGate.hasAccess(1, ProFeature.RECOVERY_RECOMMENDATIONS);
      expect(hasAccess).toBe(true);
    });

    it('should deny access to free users', async () => {
      const mockUser = {
        id: 1,
        subscriptionTier: 'free' as const,
        subscriptionStatus: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.users.get as any).mockResolvedValue(mockUser);

      const hasAccess = await SubscriptionGate.hasAccess(1, ProFeature.ADVANCED_ANALYTICS);
      expect(hasAccess).toBe(false);
    });

    it('should deny access to users with expired trial', async () => {
      const now = new Date();
      const trialEnd = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago

      const mockUser = {
        id: 1,
        subscriptionTier: 'free' as const,
        subscriptionStatus: 'trial' as const,
        trialStartDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        trialEndDate: trialEnd,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.users.get as any).mockResolvedValue(mockUser);

      const hasAccess = await SubscriptionGate.hasAccess(1, ProFeature.PERSONALIZED_COACHING);
      expect(hasAccess).toBe(false);
    });

    it('should deny access to users with cancelled subscription', async () => {
      const mockUser = {
        id: 1,
        subscriptionTier: 'pro' as const,
        subscriptionStatus: 'cancelled' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.users.get as any).mockResolvedValue(mockUser);

      const hasAccess = await SubscriptionGate.hasAccess(1, ProFeature.UNLIMITED_PLANS);
      expect(hasAccess).toBe(false);
    });

    it('should deny access to users with expired subscription', async () => {
      const mockUser = {
        id: 1,
        subscriptionTier: 'pro' as const,
        subscriptionStatus: 'expired' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.users.get as any).mockResolvedValue(mockUser);

      const hasAccess = await SubscriptionGate.hasAccess(1, ProFeature.SMART_RECOMMENDATIONS);
      expect(hasAccess).toBe(false);
    });

    it('should deny access when user is not found', async () => {
      (db.users.get as any).mockResolvedValue(null);

      const hasAccess = await SubscriptionGate.hasAccess(999, ProFeature.RECOVERY_RECOMMENDATIONS);
      expect(hasAccess).toBe(false);
    });

    it('should grant access to premium users', async () => {
      const mockUser = {
        id: 1,
        subscriptionTier: 'premium' as const,
        subscriptionStatus: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.users.get as any).mockResolvedValue(mockUser);

      const hasAccess = await SubscriptionGate.hasAccess(1, ProFeature.ADVANCED_ANALYTICS);
      expect(hasAccess).toBe(true);
    });
  });

  describe('requireProAccess', () => {
    it('should not throw error for Pro users', async () => {
      const mockUser = {
        id: 1,
        subscriptionTier: 'pro' as const,
        subscriptionStatus: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.users.get as any).mockResolvedValue(mockUser);

      await expect(
        SubscriptionGate.requireProAccess(1, ProFeature.SMART_RECOMMENDATIONS)
      ).resolves.not.toThrow();
    });

    it('should throw SubscriptionRequiredError for free users', async () => {
      const mockUser = {
        id: 1,
        subscriptionTier: 'free' as const,
        subscriptionStatus: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.users.get as any).mockResolvedValue(mockUser);

      await expect(
        SubscriptionGate.requireProAccess(1, ProFeature.RECOVERY_RECOMMENDATIONS)
      ).rejects.toThrow(SubscriptionRequiredError);
    });

    it('should include feature in error message', async () => {
      const mockUser = {
        id: 1,
        subscriptionTier: 'free' as const,
        subscriptionStatus: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.users.get as any).mockResolvedValue(mockUser);

      try {
        await SubscriptionGate.requireProAccess(1, ProFeature.ADVANCED_ANALYTICS);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(SubscriptionRequiredError);
        expect((error as SubscriptionRequiredError).feature).toBe(ProFeature.ADVANCED_ANALYTICS);
      }
    });
  });

  describe('getTrialStatus', () => {
    it('should return active trial status for users in trial period', async () => {
      const now = new Date();
      const trialStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const mockUser = {
        id: 1,
        subscriptionTier: 'free' as const,
        subscriptionStatus: 'trial' as const,
        trialStartDate: trialStart,
        trialEndDate: trialEnd,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.users.get as any).mockResolvedValue(mockUser);

      const status = await SubscriptionGate.getTrialStatus(1);

      expect(status).toEqual({
        isActive: true,
        startDate: trialStart,
        endDate: trialEnd,
        daysRemaining: 7,
      });
    });

    it('should return expired trial status for users past trial period', async () => {
      const now = new Date();
      const trialStart = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
      const trialEnd = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

      const mockUser = {
        id: 1,
        subscriptionTier: 'free' as const,
        subscriptionStatus: 'trial' as const,
        trialStartDate: trialStart,
        trialEndDate: trialEnd,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.users.get as any).mockResolvedValue(mockUser);

      const status = await SubscriptionGate.getTrialStatus(1);

      expect(status?.isActive).toBe(false);
      expect(status?.daysRemaining).toBeLessThan(0);
    });

    it('should return null for users without trial', async () => {
      const mockUser = {
        id: 1,
        subscriptionTier: 'free' as const,
        subscriptionStatus: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.users.get as any).mockResolvedValue(mockUser);

      const status = await SubscriptionGate.getTrialStatus(1);
      expect(status).toBeNull();
    });
  });

  describe('getSubscriptionStatus', () => {
    it('should return subscription details for Pro users', async () => {
      const now = new Date();
      const subStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const subEnd = new Date(now.getTime() + 335 * 24 * 60 * 60 * 1000);

      const mockUser = {
        id: 1,
        subscriptionTier: 'pro' as const,
        subscriptionStatus: 'active' as const,
        subscriptionStartDate: subStart,
        subscriptionEndDate: subEnd,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.users.get as any).mockResolvedValue(mockUser);

      const status = await SubscriptionGate.getSubscriptionStatus(1);

      expect(status).toEqual({
        tier: 'pro',
        status: 'active',
        startDate: subStart,
        endDate: subEnd,
      });
    });

    it('should return free tier for users without subscription', async () => {
      const mockUser = {
        id: 1,
        subscriptionTier: 'free' as const,
        subscriptionStatus: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (db.users.get as any).mockResolvedValue(mockUser);

      const status = await SubscriptionGate.getSubscriptionStatus(1);

      expect(status?.tier).toBe('free');
      expect(status?.status).toBe('active');
    });
  });

  describe('getUpgradePrompt', () => {
    it('should return appropriate prompt for smart recommendations', () => {
      const prompt = SubscriptionGate.getUpgradePrompt(ProFeature.SMART_RECOMMENDATIONS);

      expect(prompt).toContain('Smart Recommendations');
      expect(prompt).toContain('Pro');
    });

    it('should return appropriate prompt for recovery recommendations', () => {
      const prompt = SubscriptionGate.getUpgradePrompt(ProFeature.RECOVERY_RECOMMENDATIONS);

      expect(prompt).toContain('Recovery Recommendations');
      expect(prompt).toContain('Pro');
    });

    it('should return generic prompt for unknown features', () => {
      const prompt = SubscriptionGate.getUpgradePrompt('unknown_feature' as ProFeature);

      expect(prompt).toContain('Pro');
      expect(prompt).toContain('Upgrade');
    });
  });
});
