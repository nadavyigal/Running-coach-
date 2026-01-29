import { engagementOptimizationService } from '@/lib/engagement-optimization';
import { dbUtils } from '@/lib/dbUtils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/dbUtils', () => ({
  dbUtils: {
    getCurrentUser: vi.fn(),
    getUserRuns: vi.fn(),
    getUserGoals: vi.fn(),
    getUserBadges: vi.fn(),
  },
}));

const mockUser = {
  id: 1,
  name: 'Test User',
  currentStreak: 5,
  longestStreak: 10,
  onboardingComplete: true,
};

const mockRuns = [
  {
    id: 1,
    userId: 1,
    distance: 5,
    duration: 1800,
    pace: 360,
    completedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 2,
    userId: 1,
    distance: 8,
    duration: 2700,
    pace: 340,
    completedAt: new Date('2024-01-03'),
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
  },
];

const mockGoals = [
  {
    id: 1,
    userId: 1,
    title: 'Run 10K',
    status: 'active',
    currentValue: 6,
    targetValue: 10,
  },
];

const mockBadges = [
  {
    id: 1,
    name: 'Week Warrior',
    unlockedAt: new Date(),
  },
];

describe('EngagementOptimizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(mockUser as any);
    vi.mocked(dbUtils.getUserRuns).mockResolvedValue(mockRuns as any);
    vi.mocked(dbUtils.getUserGoals).mockResolvedValue(mockGoals as any);
    vi.mocked(dbUtils.getUserBadges).mockResolvedValue(mockBadges as any);
  });

  describe('calculateEngagementScore', () => {
    it('calculates engagement score based on user activity', async () => {
      const score = await engagementOptimizationService.calculateEngagementScore(1);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(dbUtils.getUserRuns).toHaveBeenCalledWith(1);
      expect(dbUtils.getUserGoals).toHaveBeenCalledWith(1);
    });

    it('returns 0 when user is missing', async () => {
      vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(null);

      const score = await engagementOptimizationService.calculateEngagementScore(1);

      expect(score).toBe(0);
    });

    it('returns default score on database errors', async () => {
      vi.mocked(dbUtils.getUserRuns).mockRejectedValue(new Error('Database error'));

      const score = await engagementOptimizationService.calculateEngagementScore(1);

      expect(score).toBe(50);
    });
  });

  describe('determineOptimalTiming', () => {
    it('determines optimal timing based on run history', async () => {
      const timing = await engagementOptimizationService.determineOptimalTiming(1);

      expect(timing.bestTime).toMatch(/^\d{2}:\d{2}$/);
      expect(timing.timezone).toBeTruthy();
      expect(timing.engagementScore).toBeGreaterThanOrEqual(0);
      expect(timing.engagementScore).toBeLessThanOrEqual(100);
    });

    it('returns defaults when no user data is available', async () => {
      vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(null);

      const timing = await engagementOptimizationService.determineOptimalTiming(1);

      expect(timing.bestTime).toBe('08:00');
      expect(timing.engagementScore).toBe(50);
    });
  });

  describe('generateMotivationalTriggers', () => {
    it('generates streak, achievement, and goal triggers', async () => {
      const triggers = await engagementOptimizationService.generateMotivationalTriggers(1);

      expect(triggers.length).toBeGreaterThan(0);
      expect(triggers.some((trigger) => trigger.type === 'streak_milestone')).toBe(true);
      expect(triggers.some((trigger) => trigger.type === 'achievement')).toBe(true);
      expect(triggers.some((trigger) => trigger.type === 'goal_progress')).toBe(true);
    });
  });

  describe('createPersonalizedNotification', () => {
    it('creates a notification with personalization details', async () => {
      const notification = await engagementOptimizationService.createPersonalizedNotification(
        1,
        'motivational',
        'Keep pushing!'
      );

      expect(notification).toHaveProperty('id');
      expect(notification).toHaveProperty('title');
      expect(notification.message).toContain('Keep pushing!');
      expect(notification).toHaveProperty('personalization');
      expect(notification).toHaveProperty('engagementScore');
      expect(notification).toHaveProperty('priority');
    });
  });

  describe('adaptNotificationFrequency', () => {
    it('reduces frequency for low engagement', async () => {
      vi.spyOn(engagementOptimizationService, 'calculateEngagementScore').mockResolvedValue(20);

      const frequency = await engagementOptimizationService.adaptNotificationFrequency(1, 'high');

      expect(frequency).toBe('low');
    });

    it('increases frequency for high engagement', async () => {
      vi.spyOn(engagementOptimizationService, 'calculateEngagementScore').mockResolvedValue(90);

      const frequency = await engagementOptimizationService.adaptNotificationFrequency(1, 'low');

      expect(frequency).toBe('high');
    });
  });
});
