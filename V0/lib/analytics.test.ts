import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  trackReminderEvent,
  trackPlanAdjustmentEvent,
  trackFeedbackEvent,
  trackEngagementEvent,
  trackPlanSessionCompleted,
  trackChatMessageSent,
  trackRouteSelected,
  trackReminderClicked,
  trackAnalyticsEvent
} from './analytics'
import { db } from './db'
import posthog from 'posthog-js'

// Mock PostHog
vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
  },
}))

// Mock the database
vi.mock('./db', () => ({
  db: {
    user: {
      toArray: vi.fn(),
    },
  },
}))

// Mock window object
Object.defineProperty(global, 'window', {
  value: {},
  writable: true,
})

describe('Analytics', () => {
  const mockUser = {
    id: 1,
    experience: 'beginner',
    goal: 'habit',
    daysPerWeek: 3,
    onboardingComplete: true,
    currentStreak: 5,
    cohortId: 123,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.user.toArray).mockResolvedValue([mockUser])
  })

  describe('getUserContext', () => {
    it('should include user context in all events', async () => {
      await trackAnalyticsEvent('test_event', { custom_property: 'value' })

      expect(posthog.capture).toHaveBeenCalledWith('test_event', {
        user_id: 1,
        user_experience: 'beginner',
        user_goal: 'habit',
        days_per_week: 3,
        onboarding_complete: true,
        current_streak: 5,
        cohort_id: 123,
        timestamp: expect.any(String),
        custom_property: 'value',
      })
    })

    it('should handle missing user gracefully', async () => {
      vi.mocked(db.user.toArray).mockResolvedValue([])

      await trackAnalyticsEvent('test_event')

      expect(posthog.capture).toHaveBeenCalledWith('test_event', {
        user_id: undefined,
        user_experience: undefined,
        user_goal: undefined,
        days_per_week: undefined,
        onboarding_complete: undefined,
        current_streak: 0,
        cohort_id: undefined,
        timestamp: expect.any(String),
      })
    })
  })

  describe('trackReminderEvent', () => {
    it('should track reminder events with proper properties', async () => {
      await trackReminderEvent('reminder_triggered')

      expect(posthog.capture).toHaveBeenCalledWith('reminder_triggered', {
        user_id: 1,
        user_experience: 'beginner',
        user_goal: 'habit',
        days_per_week: 3,
        onboarding_complete: true,
        current_streak: 5,
        cohort_id: 123,
        timestamp: expect.any(String),
      })
    })

    it('should track reminder snoozed with minutes', async () => {
      await trackReminderEvent('reminder_snoozed', { minutes: 15 })

      expect(posthog.capture).toHaveBeenCalledWith('reminder_snoozed', {
        user_id: 1,
        user_experience: 'beginner',
        user_goal: 'habit',
        days_per_week: 3,
        onboarding_complete: true,
        current_streak: 5,
        cohort_id: 123,
        timestamp: expect.any(String),
        minutes: 15,
      })
    })
  })

  describe('trackPlanAdjustmentEvent', () => {
    it('should track plan adjustments with reason', async () => {
      await trackPlanAdjustmentEvent('plan_adjusted', { reason: 'post-run' })

      expect(posthog.capture).toHaveBeenCalledWith('plan_adjusted', {
        user_id: 1,
        user_experience: 'beginner',
        user_goal: 'habit',
        days_per_week: 3,
        onboarding_complete: true,
        current_streak: 5,
        cohort_id: 123,
        timestamp: expect.any(String),
        reason: 'post-run',
      })
    })
  })

  describe('trackPlanSessionCompleted', () => {
    it('should track completed sessions with all metrics', async () => {
      await trackPlanSessionCompleted({
        session_type: 'easy_run',
        distance_km: 5.2,
        duration_seconds: 1800,
        pace_seconds_per_km: 346,
        calories_burned: 312,
        had_gps_tracking: true,
        workout_id: 456,
      })

      expect(posthog.capture).toHaveBeenCalledWith('plan_session_completed', {
        user_id: 1,
        user_experience: 'beginner',
        user_goal: 'habit',
        days_per_week: 3,
        onboarding_complete: true,
        current_streak: 5,
        cohort_id: 123,
        timestamp: expect.any(String),
        session_type: 'easy_run',
        distance_km: 5.2,
        duration_seconds: 1800,
        pace_seconds_per_km: 346,
        calories_burned: 312,
        had_gps_tracking: true,
        workout_id: 456,
      })
    })
  })

  describe('trackChatMessageSent', () => {
    it('should track chat messages with conversation context', async () => {
      await trackChatMessageSent({
        message_length: 42,
        conversation_length: 5,
        is_first_message: false,
      })

      expect(posthog.capture).toHaveBeenCalledWith('chat_message_sent', {
        user_id: 1,
        user_experience: 'beginner',
        user_goal: 'habit',
        days_per_week: 3,
        onboarding_complete: true,
        current_streak: 5,
        cohort_id: 123,
        timestamp: expect.any(String),
        message_length: 42,
        conversation_length: 5,
        is_first_message: false,
      })
    })
  })

  describe('trackRouteSelected', () => {
    it('should track route selection with route details', async () => {
      await trackRouteSelected({
        route_id: 'route_123',
        route_name: 'Hill Challenge',
        distance_km: 2.8,
        difficulty: 'Hard',
        elevation_m: 145,
        estimated_time_minutes: 22,
      })

      expect(posthog.capture).toHaveBeenCalledWith('route_selected', {
        user_id: 1,
        user_experience: 'beginner',
        user_goal: 'habit',
        days_per_week: 3,
        onboarding_complete: true,
        current_streak: 5,
        cohort_id: 123,
        timestamp: expect.any(String),
        route_id: 'route_123',
        route_name: 'Hill Challenge',
        distance_km: 2.8,
        difficulty: 'Hard',
        elevation_m: 145,
        estimated_time_minutes: 22,
      })
    })
  })

  describe('trackReminderClicked', () => {
    it('should track reminder clicks with source', async () => {
      await trackReminderClicked({ source: 'toast_action' })

      expect(posthog.capture).toHaveBeenCalledWith('reminder_clicked', {
        user_id: 1,
        user_experience: 'beginner',
        user_goal: 'habit',
        days_per_week: 3,
        onboarding_complete: true,
        current_streak: 5,
        cohort_id: 123,
        timestamp: expect.any(String),
        source: 'toast_action',
      })
    })
  })

  describe('trackFeedbackEvent', () => {
    it('should track feedback events', async () => {
      await trackFeedbackEvent('positive_feedback_shown', { 
        feedback_type: 'streak_milestone',
        milestone_days: 7 
      })

      expect(posthog.capture).toHaveBeenCalledWith('positive_feedback_shown', {
        user_id: 1,
        user_experience: 'beginner',
        user_goal: 'habit',
        days_per_week: 3,
        onboarding_complete: true,
        current_streak: 5,
        cohort_id: 123,
        timestamp: expect.any(String),
        feedback_type: 'streak_milestone',
        milestone_days: 7,
      })
    })
  })

  describe('trackEngagementEvent', () => {
    it('should track engagement events', async () => {
      await trackEngagementEvent('onboard_complete', { 
        rookieChallenge: true 
      })

      expect(posthog.capture).toHaveBeenCalledWith('onboard_complete', {
        user_id: 1,
        user_experience: 'beginner',
        user_goal: 'habit',
        days_per_week: 3,
        onboarding_complete: true,
        current_streak: 5,
        cohort_id: 123,
        timestamp: expect.any(String),
        rookieChallenge: true,
      })
    })
  })

  describe('window checks', () => {
    it('should not call posthog when window is undefined', async () => {
      const originalWindow = global.window
      // @ts-ignore
      delete global.window

      await trackAnalyticsEvent('test_event')

      expect(posthog.capture).not.toHaveBeenCalled()

      global.window = originalWindow
    })
  })

  describe('database errors', () => {
    it('should handle database errors gracefully', async () => {
      vi.mocked(db.user.toArray).mockRejectedValue(new Error('Database error'))

      await trackAnalyticsEvent('test_event')

      // Should still call posthog with undefined user context
      expect(posthog.capture).toHaveBeenCalledWith('test_event', {
        user_id: undefined,
        user_experience: undefined,
        user_goal: undefined,
        days_per_week: undefined,
        onboarding_complete: undefined,
        current_streak: 0,
        cohort_id: undefined,
        timestamp: expect.any(String),
      })
    })
  })
})