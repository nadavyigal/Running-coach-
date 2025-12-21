import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCurrentUser } from './dbUtils';

vi.mock('./dbUtils', () => ({
  getCurrentUser: vi.fn(),
}));

// Ensure we test the real analytics implementation (it's mocked globally in vitest.setup.ts)
vi.unmock('@/lib/analytics');

describe('Analytics Module', () => {
  const mockCapture = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).posthog = { capture: mockCapture };

    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 1,
      name: 'Test User',
      experience: 'intermediate',
      goal: 'habit',
      daysPerWeek: 3,
      preferredTimes: [],
      consents: { data: true, gdpr: true, push: true },
      onboardingComplete: true,
      currentStreak: 5,
      cohortId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  describe('trackAnalyticsEvent', () => {
    it('should fire PostHog events when window is available', async () => {
      const { trackAnalyticsEvent } = await import('@/lib/analytics');
      
      await trackAnalyticsEvent('test_event', { test_property: 'test_value' });

      expect(mockCapture).toHaveBeenCalledWith('test_event', expect.objectContaining({
        user_id: 1,
        user_experience: 'intermediate',
        user_goal: 'habit',
        days_per_week: 3,
        onboarding_complete: true,
        current_streak: 5,
        cohort_id: 1,
        test_property: 'test_value',
        timestamp: expect.any(String)
      }));
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(getCurrentUser).mockRejectedValue(new Error('Database error'));
      
      const { trackAnalyticsEvent } = await import('@/lib/analytics');
      
      await trackAnalyticsEvent('test_event', { test_property: 'test_value' });

      expect(mockCapture).toHaveBeenCalledWith('test_event', expect.objectContaining({
        user_id: undefined,
        user_experience: undefined,
        user_goal: undefined,
        days_per_week: undefined,
        onboarding_complete: undefined,
        current_streak: 0,
        cohort_id: undefined,
        test_property: 'test_value',
        timestamp: expect.any(String)
      }));
    });
  });

  describe('specific tracking functions', () => {
    it('should call trackReminderEvent', async () => {
      const { trackReminderEvent } = await import('@/lib/analytics');
      
      await trackReminderEvent('reminder_clicked', { reminder_type: 'habit' });

      expect(mockCapture).toHaveBeenCalledWith('reminder_clicked', expect.objectContaining({
        reminder_type: 'habit'
      }));
    });

    it('should call trackPlanAdjustmentEvent', async () => {
      const { trackPlanAdjustmentEvent } = await import('@/lib/analytics');
      
      await trackPlanAdjustmentEvent('plan_adjusted', { adjustment_type: 'intensity' });

      expect(mockCapture).toHaveBeenCalledWith('plan_adjusted', expect.objectContaining({
        adjustment_type: 'intensity'
      }));
    });

    it('should call trackFeedbackEvent', async () => {
      const { trackFeedbackEvent } = await import('@/lib/analytics');
      
      await trackFeedbackEvent('feedback_submitted', { rating: 5 });

      expect(mockCapture).toHaveBeenCalledWith('feedback_submitted', expect.objectContaining({
        rating: 5
      }));
    });

    it('should call trackEngagementEvent', async () => {
      const { trackEngagementEvent } = await import('@/lib/analytics');
      
      await trackEngagementEvent('feature_used', { feature: 'habit_analytics' });

      expect(mockCapture).toHaveBeenCalledWith('feature_used', expect.objectContaining({
        feature: 'habit_analytics'
      }));
    });
  });

  describe('window environment checks', () => {
    it('should not call posthog when window is undefined', async () => {
      // Remove window
      const originalWindow = globalThis.window;
      (globalThis as any).window = undefined;
      
      const { trackAnalyticsEvent } = await import('@/lib/analytics');
      
      await trackAnalyticsEvent('test_event');

      expect(mockCapture).not.toHaveBeenCalled();
      (globalThis as any).window = originalWindow;
    });

    it('should not call posthog when posthog is undefined', async () => {
      const originalPosthog = (window as any).posthog;
      (window as any).posthog = {};
      
      const { trackAnalyticsEvent } = await import('@/lib/analytics');
      
      // Should not throw an error
      await expect(trackAnalyticsEvent('test_event')).resolves.not.toThrow();
      
      (window as any).posthog = originalPosthog;
    });
  });
});
