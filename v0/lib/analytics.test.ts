import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import posthog from 'posthog-js';

// Unmock the analytics module to test the real implementation
vi.unmock('@/lib/analytics');

// Mock posthog
vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
  }
}));

// Mock db module
vi.mock('./db', () => {
  const mockUser = {
    id: 1,
    name: 'Test User',
    experience: 'intermediate',
    goal: 'habit',
    daysPerWeek: 3,
    onboardingComplete: true,
    currentStreak: 5,
    cohortId: 'test-cohort'
  };

  const mockDb = {
    users: {
      toArray: vi.fn().mockResolvedValue([mockUser])
    }
  };

  return {
    db: mockDb
  };
});

describe('Analytics Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window object
    Object.defineProperty(global, 'window', {
      value: {},
      writable: true
    });
  });

  describe('trackAnalyticsEvent', () => {
    it('should fire PostHog events when window is available', async () => {
      const { trackAnalyticsEvent } = await import('./analytics');
      
      await trackAnalyticsEvent('test_event', { test_property: 'test_value' });

      expect(posthog.capture).toHaveBeenCalledWith('test_event', expect.objectContaining({
        user_id: 1,
        user_experience: 'intermediate',
        user_goal: 'habit',
        days_per_week: 3,
        onboarding_complete: true,
        current_streak: 5,
        cohort_id: 'test-cohort',
        test_property: 'test_value',
        timestamp: expect.any(String)
      }));
    });

    it('should handle database errors gracefully', async () => {
      // Mock database failure
      const { db } = await import('./db');
      (db.users.toArray as Mock).mockRejectedValue(new Error('Database error'));
      
      const { trackAnalyticsEvent } = await import('./analytics');
      
      await trackAnalyticsEvent('test_event', { test_property: 'test_value' });

      expect(posthog.capture).toHaveBeenCalledWith('test_event', expect.objectContaining({
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
      const { trackReminderEvent } = await import('./analytics');
      
      await trackReminderEvent('reminder_clicked', { reminder_type: 'habit' });

      expect(posthog.capture).toHaveBeenCalledWith('reminder_clicked', expect.objectContaining({
        reminder_type: 'habit'
      }));
    });

    it('should call trackPlanAdjustmentEvent', async () => {
      const { trackPlanAdjustmentEvent } = await import('./analytics');
      
      await trackPlanAdjustmentEvent('plan_adjusted', { adjustment_type: 'intensity' });

      expect(posthog.capture).toHaveBeenCalledWith('plan_adjusted', expect.objectContaining({
        adjustment_type: 'intensity'
      }));
    });

    it('should call trackFeedbackEvent', async () => {
      const { trackFeedbackEvent } = await import('./analytics');
      
      await trackFeedbackEvent('feedback_submitted', { rating: 5 });

      expect(posthog.capture).toHaveBeenCalledWith('feedback_submitted', expect.objectContaining({
        rating: 5
      }));
    });

    it('should call trackEngagementEvent', async () => {
      const { trackEngagementEvent } = await import('./analytics');
      
      await trackEngagementEvent('feature_used', { feature: 'habit_analytics' });

      expect(posthog.capture).toHaveBeenCalledWith('feature_used', expect.objectContaining({
        feature: 'habit_analytics'
      }));
    });
  });

  describe('window environment checks', () => {
    it('should not call posthog when window is undefined', async () => {
      // Remove window
      delete (global as any).window;
      
      const { trackAnalyticsEvent } = await import('./analytics');
      
      await trackAnalyticsEvent('test_event');

      expect(posthog.capture).not.toHaveBeenCalled();
    });

    it('should not call posthog when posthog is undefined', async () => {
      // Mock posthog as undefined by removing capture method
      const originalCapture = posthog.capture;
      delete (posthog as any).capture;
      
      const { trackAnalyticsEvent } = await import('./analytics');
      
      // Should not throw an error
      await expect(trackAnalyticsEvent('test_event')).resolves.not.toThrow();
      
      // Restore original capture method
      posthog.capture = originalCapture;
    });
  });
});