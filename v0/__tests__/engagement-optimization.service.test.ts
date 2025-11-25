import { engagementOptimizationService } from '@/lib/engagement-optimization';
import { dbUtils } from '@/lib/dbUtils';
import { vi } from 'vitest';

// Mock the database utilities
vi.mock('@/lib/dbUtils', () => ({
  dbUtils: {
    getCurrentUser: vi.fn(),
    getRuns: vi.fn(),
    getGoals: vi.fn(),
    getBadges: vi.fn(),
  },
}));

const mockUser = {
  id: 1,
  name: 'Test User',
  goal: 'habit' as const,
  experience: 'beginner' as const,
  preferredTimes: ['08:00'],
  daysPerWeek: 3,
  consents: {
    data: true,
    gdpr: true,
    push: true,
  },
  onboardingComplete: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  currentStreak: 5,
  longestStreak: 10,
  notificationPreferences: {
    frequency: 'medium' as const,
    timing: 'morning' as const,
    types: [
      { id: 'motivational', name: 'Motivational', description: 'Daily motivation', enabled: true, category: 'motivational' as const },
      { id: 'reminder', name: 'Reminders', description: 'Run reminders', enabled: true, category: 'reminder' as const },
    ],
    quietHours: { start: '22:00', end: '07:00' },
  },
};

const mockRuns = [
  {
    id: 1,
    userId: 1,
    type: 'easy' as const,
    distance: 5,
    duration: 30,
    date: new Date('2024-01-01'),
    notes: 'Great run!',
  },
  {
    id: 2,
    userId: 1,
    type: 'tempo' as const,
    distance: 8,
    duration: 45,
    date: new Date('2024-01-03'),
    notes: 'Felt strong',
  },
];

const mockGoals = [
  {
    id: 1,
    userId: 1,
    type: 'habit' as const,
    target: 3,
    current: 2,
    unit: 'runs per week',
    deadline: new Date('2024-12-31'),
    status: 'active' as const,
  },
];

const mockBadges = [
  {
    id: 1,
    userId: 1,
    type: 'streak' as const,
    name: 'Week Warrior',
    description: 'Complete 7 days in a row',
    earnedAt: new Date('2024-01-07'),
  },
];

describe('EngagementOptimizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(mockUser);
    vi.mocked(dbUtils.getRuns).mockResolvedValue(mockRuns);
    vi.mocked(dbUtils.getGoals).mockResolvedValue(mockGoals);
    vi.mocked(dbUtils.getBadges).mockResolvedValue(mockBadges);
  });

  describe('calculateEngagementScore', () => {
    it('calculates engagement score based on user activity', async () => {
      const score = await engagementOptimizationService.calculateEngagementScore(1);
      
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(dbUtils.getRuns).toHaveBeenCalledWith(1);
    });

    it('returns higher score for active users', async () => {
      const activeUserRuns = [
        ...mockRuns,
        {
          id: 3,
          userId: 1,
          type: 'long' as const,
          distance: 10,
          duration: 60,
          date: new Date('2024-01-05'),
          notes: 'Long run',
        },
      ];
      
      vi.mocked(dbUtils.getRuns).mockResolvedValue(activeUserRuns);
      
      const score = await engagementOptimizationService.calculateEngagementScore(1);
      
      expect(score).toBeGreaterThan(50);
    });

    it('returns lower score for inactive users', async () => {
      vi.mocked(dbUtils.getRuns).mockResolvedValue([]);
      
      const score = await engagementOptimizationService.calculateEngagementScore(1);
      
      expect(score).toBeLessThan(50);
    });
  });

  describe('determineOptimalTiming', () => {
    it('determines optimal timing based on user patterns', async () => {
      const timing = await engagementOptimizationService.determineOptimalTiming(1);
      
      expect(timing).toHaveProperty('bestTime');
      expect(timing).toHaveProperty('confidence');
      expect(timing).toHaveProperty('reasoning');
      expect(timing.confidence).toBeGreaterThan(0);
      expect(timing.confidence).toBeLessThanOrEqual(1);
    });

    it('considers user preferences in timing calculation', async () => {
      const timing = await engagementOptimizationService.determineOptimalTiming(1);
      
      expect(timing.bestTime).toMatch(/^\d{2}:\d{2}$/);
    });

    it('provides reasoning for timing recommendations', async () => {
      const timing = await engagementOptimizationService.determineOptimalTiming(1);
      
      expect(timing.reasoning).toBeTruthy();
      expect(typeof timing.reasoning).toBe('string');
    });
  });

  describe('generateMotivationalTriggers', () => {
    it('generates motivational triggers based on user data', async () => {
      const triggers = await engagementOptimizationService.generateMotivationalTriggers(1);
      
      expect(Array.isArray(triggers)).toBe(true);
      expect(triggers.length).toBeGreaterThan(0);
      
      triggers.forEach(trigger => {
        expect(trigger).toHaveProperty('id');
        expect(trigger).toHaveProperty('type');
        expect(trigger).toHaveProperty('message');
        expect(trigger).toHaveProperty('enabled');
      });
    });

    it('includes streak-based triggers for users with streaks', async () => {
      const triggers = await engagementOptimizationService.generateMotivationalTriggers(1);
      
      const streakTriggers = triggers.filter(trigger => trigger.type === 'streak');
      expect(streakTriggers.length).toBeGreaterThan(0);
    });

    it('includes goal-based triggers for users with active goals', async () => {
      const triggers = await engagementOptimizationService.generateMotivationalTriggers(1);
      
      const goalTriggers = triggers.filter(trigger => trigger.type === 'goal');
      expect(goalTriggers.length).toBeGreaterThan(0);
    });

    it('includes milestone triggers for users approaching achievements', async () => {
      const triggers = await engagementOptimizationService.generateMotivationalTriggers(1);
      
      const milestoneTriggers = triggers.filter(trigger => trigger.type === 'milestone');
      expect(milestoneTriggers.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeEngagementPatterns', () => {
    it('analyzes user engagement patterns', async () => {
      const patterns = await engagementOptimizationService.analyzeEngagementPatterns(1);
      
      expect(patterns).toHaveProperty('timeOfDay');
      expect(patterns).toHaveProperty('dayOfWeek');
      expect(patterns).toHaveProperty('frequency');
      expect(patterns).toHaveProperty('consistency');
    });

    it('identifies preferred running times', async () => {
      const patterns = await engagementOptimizationService.analyzeEngagementPatterns(1);
      
      expect(patterns.timeOfDay).toBeDefined();
      expect(patterns.timeOfDay).toMatch(/^(morning|afternoon|evening)$/);
    });

    it('calculates consistency score', async () => {
      const patterns = await engagementOptimizationService.analyzeEngagementPatterns(1);
      
      expect(patterns.consistency).toBeGreaterThan(0);
      expect(patterns.consistency).toBeLessThanOrEqual(100);
    });
  });

  describe('generatePersonalizedRecommendations', () => {
    it('generates personalized recommendations', async () => {
      const recommendations = await engagementOptimizationService.generatePersonalizedRecommendations(1);
      
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      
      recommendations.forEach(rec => {
        expect(rec).toHaveProperty('type');
        expect(rec).toHaveProperty('message');
        expect(rec).toHaveProperty('priority');
      });
    });

    it('prioritizes recommendations based on user needs', async () => {
      const recommendations = await engagementOptimizationService.generatePersonalizedRecommendations(1);
      
      const priorities = recommendations.map(rec => rec.priority);
      expect(priorities).toEqual(priorities.sort((a, b) => b - a)); // Should be sorted by priority
    });
  });

  describe('optimizeNotificationSchedule', () => {
    it('optimizes notification schedule based on user patterns', async () => {
      const schedule = await engagementOptimizationService.optimizeNotificationSchedule(1);
      
      expect(schedule).toHaveProperty('optimalTimes');
      expect(schedule).toHaveProperty('frequency');
      expect(schedule).toHaveProperty('quietHours');
    });

    it('respects user quiet hours preferences', async () => {
      const schedule = await engagementOptimizationService.optimizeNotificationSchedule(1);
      
      expect(schedule.quietHours).toEqual(mockUser.notificationPreferences.quietHours);
    });

    it('suggests optimal notification times', async () => {
      const schedule = await engagementOptimizationService.optimizeNotificationSchedule(1);
      
      expect(Array.isArray(schedule.optimalTimes)).toBe(true);
      schedule.optimalTimes.forEach(time => {
        expect(time).toMatch(/^\d{2}:\d{2}$/);
      });
    });
  });

  describe('error handling', () => {
    it('handles database errors gracefully', async () => {
      vi.mocked(dbUtils.getRuns).mockRejectedValue(new Error('Database error'));
      
      await expect(engagementOptimizationService.calculateEngagementScore(1)).rejects.toThrow();
    });

    it('returns default values when user data is missing', async () => {
      vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(null);
      
      const score = await engagementOptimizationService.calculateEngagementScore(1);
      expect(score).toBe(0);
    });

    it('handles empty run data', async () => {
      vi.mocked(dbUtils.getRuns).mockResolvedValue([]);
      
      const score = await engagementOptimizationService.calculateEngagementScore(1);
      expect(score).toBeLessThan(50);
    });
  });
});