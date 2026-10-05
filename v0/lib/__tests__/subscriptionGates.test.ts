import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubscriptionGate, ProFeature, SubscriptionRequiredError } from '../subscriptionGates';
import { dbUtils } from '../dbUtils';

// Mock dbUtils
vi.mock('../dbUtils', () => ({
  dbUtils: {
    getUser: vi.fn(),
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

describe('SubscriptionGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hasAccess', () => {
    // Note: The current implementation has a TEMPORARY testing mode that always returns true
    // These tests verify the testing mode behavior
    it('should grant access in testing mode', async () => {
      const mockUser = {
        id: 1,
        subscriptionTier: 'free' as const,
        subscriptionStatus: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (dbUtils.getUser as any).mockResolvedValue(mockUser);

      // In testing mode, all users get access
      const hasAccess = await SubscriptionGate.hasAccess(1, ProFeature.SMART_RECOMMENDATIONS);
      expect(hasAccess).toBe(true);
    });

    it('should grant access to all features in testing mode', async () => {
      (dbUtils.getUser as any).mockResolvedValue(null);

      // Even without a user, testing mode grants access
      const hasAccess = await SubscriptionGate.hasAccess(999, ProFeature.RECOVERY_RECOMMENDATIONS);
      expect(hasAccess).toBe(true);
    });
  });

  describe('requireProAccess', () => {
    it('should not throw error in testing mode', async () => {
      const mockUser = {
        id: 1,
        subscriptionTier: 'free' as const,
        subscriptionStatus: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (dbUtils.getUser as any).mockResolvedValue(mockUser);

      // In testing mode, no error is thrown
      await expect(
        SubscriptionGate.requireProAccess(1, ProFeature.SMART_RECOMMENDATIONS)
      ).resolves.not.toThrow();
    });
  });

  describe('getTrialStatus', () => {
    it('should return active trial status for users in trial period', async () => {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const mockUser = {
        id: 1,
        subscriptionTier: 'free' as const,
        subscriptionStatus: 'trial' as const,
        trialStartDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        trialEndDate: trialEnd,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (dbUtils.getUser as any).mockResolvedValue(mockUser);

      const status = await SubscriptionGate.getTrialStatus(1);

      expect(status.isActive).toBe(true);
      expect(status.daysRemaining).toBeGreaterThan(0);
      expect(status.endDate).toEqual(trialEnd);
    });

    it('should return expired trial status for users past trial period', async () => {
      const now = new Date();
      const trialEnd = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

      const mockUser = {
        id: 1,
        subscriptionTier: 'free' as const,
        subscriptionStatus: 'trial' as const,
        trialStartDate: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
        trialEndDate: trialEnd,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (dbUtils.getUser as any).mockResolvedValue(mockUser);

      const status = await SubscriptionGate.getTrialStatus(1);

      expect(status.isActive).toBe(false);
      expect(status.daysRemaining).toBe(0);
    });

    it('should return inactive trial for users without trial dates', async () => {
      const mockUser = {
        id: 1,
        subscriptionTier: 'free' as const,
        subscriptionStatus: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (dbUtils.getUser as any).mockResolvedValue(mockUser);

      const status = await SubscriptionGate.getTrialStatus(1);
      expect(status.isActive).toBe(false);
      expect(status.daysRemaining).toBe(0);
      expect(status.endDate).toBeNull();
    });

    it('should return inactive trial for non-existent users', async () => {
      (dbUtils.getUser as any).mockResolvedValue(null);

      const status = await SubscriptionGate.getTrialStatus(999);
      expect(status.isActive).toBe(false);
      expect(status.daysRemaining).toBe(0);
      expect(status.endDate).toBeNull();
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

      (dbUtils.getUser as any).mockResolvedValue(mockUser);

      const status = await SubscriptionGate.getSubscriptionStatus(1);

      expect(status.tier).toBe('pro');
      expect(status.status).toBe('active');
      expect(status.hasActiveSubscription).toBe(true);
    });

    it('should return free tier for users without subscription', async () => {
      const mockUser = {
        id: 1,
        subscriptionTier: 'free' as const,
        subscriptionStatus: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (dbUtils.getUser as any).mockResolvedValue(mockUser);

      const status = await SubscriptionGate.getSubscriptionStatus(1);

      expect(status.tier).toBe('free');
      expect(status.status).toBe('active');
      expect(status.hasActiveSubscription).toBe(false);
    });

    it('should return expired status for non-existent users', async () => {
      (dbUtils.getUser as any).mockResolvedValue(null);

      const status = await SubscriptionGate.getSubscriptionStatus(999);

      expect(status.tier).toBe('free');
      expect(status.status).toBe('expired');
      expect(status.hasActiveSubscription).toBe(false);
    });

    it('should mark subscription inactive when expired', async () => {
      const now = new Date();
      const subEnd = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // Expired yesterday

      const mockUser = {
        id: 1,
        subscriptionTier: 'pro' as const,
        subscriptionStatus: 'active' as const,
        subscriptionEndDate: subEnd,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (dbUtils.getUser as any).mockResolvedValue(mockUser);

      const status = await SubscriptionGate.getSubscriptionStatus(1);

      expect(status.tier).toBe('pro');
      expect(status.status).toBe('active');
      expect(status.hasActiveSubscription).toBe(false); // Expired subscription is not active
    });
  });

  describe('getUpgradePrompt', () => {
    it('should return appropriate prompt for smart recommendations', () => {
      const prompt = SubscriptionGate.getUpgradePrompt(ProFeature.SMART_RECOMMENDATIONS);

      expect(prompt).toContain('personalized');
      expect(prompt).toContain('Pro');
    });

    it('should return appropriate prompt for recovery recommendations', () => {
      const prompt = SubscriptionGate.getUpgradePrompt(ProFeature.RECOVERY_RECOMMENDATIONS);

      expect(prompt).toContain('Pro');
      expect(prompt).toContain('recovery');
    });

    it('should return appropriate prompt for advanced analytics', () => {
      const prompt = SubscriptionGate.getUpgradePrompt(ProFeature.ADVANCED_ANALYTICS);

      expect(prompt).toContain('Pro');
      expect(prompt).toContain('analytics');
    });

    it('should return generic prompt for unknown features', () => {
      const prompt = SubscriptionGate.getUpgradePrompt('unknown_feature' as ProFeature);

      expect(prompt).toContain('Pro');
      expect(prompt).toContain('premium');
    });
  });
});
