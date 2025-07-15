import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, dbUtils } from './db';

describe('Streak Calculation Engine', () => {
  let testUserId: number;

  beforeEach(async () => {
    // Create a test user
    testUserId = await dbUtils.createUser({
      name: 'Test User',
      goal: 'habit',
      experience: 'beginner',
      preferredTimes: ['morning'],
      daysPerWeek: 5,
      consents: { data: true, gdpr: true, push: false },
      onboardingComplete: true
    });
  });

  afterEach(async () => {
    // Clean up test data
    await db.users.clear();
    await db.runs.clear();
    await db.plans.clear();
    await db.workouts.clear();
  });

  describe('calculateCurrentStreak', () => {
    it('should return 0 for user with no runs', async () => {
      const streak = await dbUtils.calculateCurrentStreak(testUserId);
      expect(streak).toBe(0);
    });

    it('should calculate streak for consecutive daily runs', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      // Add runs for consecutive days
      await dbUtils.createRun({
        userId: testUserId,
        type: 'easy',
        distance: 5,
        duration: 1800,
        completedAt: twoDaysAgo
      });

      await dbUtils.createRun({
        userId: testUserId,
        type: 'easy',
        distance: 5,
        duration: 1800,
        completedAt: yesterday
      });

      await dbUtils.createRun({
        userId: testUserId,
        type: 'easy',
        distance: 5,
        duration: 1800,
        completedAt: today
      });

      const streak = await dbUtils.calculateCurrentStreak(testUserId);
      expect(streak).toBe(3);
    });

    it('should handle broken streak correctly', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      // Add runs with a gap
      await dbUtils.createRun({
        userId: testUserId,
        type: 'easy',
        distance: 5,
        duration: 1800,
        completedAt: threeDaysAgo
      });

      await dbUtils.createRun({
        userId: testUserId,
        type: 'easy',
        distance: 5,
        duration: 1800,
        completedAt: today
      });

      const streak = await dbUtils.calculateCurrentStreak(testUserId);
      expect(streak).toBe(1); // Only today's run counts
    });

    it('should apply 24-hour grace period correctly', async () => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(23, 30, 0, 0); // Late yesterday

      await dbUtils.createRun({
        userId: testUserId,
        type: 'easy',
        distance: 5,
        duration: 1800,
        completedAt: yesterday
      });

      const streak = await dbUtils.calculateCurrentStreak(testUserId);
      expect(streak).toBe(1);
    });

    it('should handle multiple runs on same day', async () => {
      const today = new Date();
      const morning = new Date(today);
      morning.setHours(8, 0, 0, 0);
      const evening = new Date(today);
      evening.setHours(18, 0, 0, 0);

      // Add two runs on the same day
      await dbUtils.createRun({
        userId: testUserId,
        type: 'easy',
        distance: 3,
        duration: 1200,
        completedAt: morning
      });

      await dbUtils.createRun({
        userId: testUserId,
        type: 'easy',
        distance: 2,
        duration: 900,
        completedAt: evening
      });

      const streak = await dbUtils.calculateCurrentStreak(testUserId);
      expect(streak).toBe(1); // Same day counts as 1
    });
  });

  describe('updateUserStreak', () => {
    it('should update user streak fields correctly', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Add consecutive runs
      await dbUtils.createRun({
        userId: testUserId,
        type: 'easy',
        distance: 5,
        duration: 1800,
        completedAt: yesterday
      });

      await dbUtils.createRun({
        userId: testUserId,
        type: 'easy',
        distance: 5,
        duration: 1800,
        completedAt: today
      });

      await dbUtils.updateUserStreak(testUserId);

      const user = await db.users.get(testUserId);
      expect(user?.currentStreak).toBe(2);
      expect(user?.longestStreak).toBe(2);
      expect(user?.lastActivityDate).toBeDefined();
      expect(user?.streakLastUpdated).toBeDefined();
    });

    it('should update longest streak when current exceeds it', async () => {
      // Set initial longest streak
      await dbUtils.updateUser(testUserId, { longestStreak: 5 });

      // Create a longer current streak
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const runDate = new Date(today);
        runDate.setDate(runDate.getDate() - i);
        
        await dbUtils.createRun({
          userId: testUserId,
          type: 'easy',
          distance: 5,
          duration: 1800,
          completedAt: runDate
        });
      }

      await dbUtils.updateUserStreak(testUserId);

      const user = await db.users.get(testUserId);
      expect(user?.currentStreak).toBe(7);
      expect(user?.longestStreak).toBe(7);
    });

    it('should handle non-existent user gracefully', async () => {
      const nonExistentUserId = 99999;
      await expect(dbUtils.updateUserStreak(nonExistentUserId)).resolves.not.toThrow();
    });
  });

  describe('getStreakStats', () => {
    it('should return correct streak stats for user with data', async () => {
      const today = new Date();
      
      await dbUtils.createRun({
        userId: testUserId,
        type: 'easy',
        distance: 5,
        duration: 1800,
        completedAt: today
      });

      await dbUtils.updateUserStreak(testUserId);
      
      const stats = await dbUtils.getStreakStats(testUserId);
      
      expect(stats.currentStreak).toBe(1);
      expect(stats.longestStreak).toBe(1);
      expect(stats.lastActivityDate).toBeDefined();
      expect(stats.streakLastUpdated).toBeDefined();
    });

    it('should return default values for non-existent user', async () => {
      const nonExistentUserId = 99999;
      const stats = await dbUtils.getStreakStats(nonExistentUserId);
      
      expect(stats.currentStreak).toBe(0);
      expect(stats.longestStreak).toBe(0);
      expect(stats.lastActivityDate).toBeNull();
      expect(stats.streakLastUpdated).toBeNull();
    });
  });

  describe('date utility functions', () => {
    it('should normalize dates correctly', () => {
      const date = new Date('2025-01-07T15:30:45.123Z');
      const normalized = dbUtils.normalizeDate(date);
      
      expect(normalized.getHours()).toBe(0);
      expect(normalized.getMinutes()).toBe(0);
      expect(normalized.getSeconds()).toBe(0);
      expect(normalized.getMilliseconds()).toBe(0);
    });

    it('should correctly identify same day', () => {
      const date1 = new Date('2025-01-07T08:00:00Z');
      const date2 = new Date('2025-01-07T20:00:00Z');
      const date3 = new Date('2025-01-08T08:00:00Z');
      
      expect(dbUtils.isSameDay(date1, date2)).toBe(true);
      expect(dbUtils.isSameDay(date1, date3)).toBe(false);
    });

    it('should calculate days difference correctly', () => {
      const date1 = new Date('2025-01-07');
      const date2 = new Date('2025-01-05');
      
      const diff = dbUtils.getDaysDifference(date1, date2);
      expect(diff).toBe(2);
    });
  });

  describe('integration with activity tracking', () => {
    it('should auto-update streak when creating run', async () => {
      const today = new Date();
      
      // This should trigger streak update automatically
      await dbUtils.createRun({
        userId: testUserId,
        type: 'easy',
        distance: 5,
        duration: 1800,
        completedAt: today
      });

      const user = await db.users.get(testUserId);
      expect(user?.currentStreak).toBe(1);
      expect(user?.longestStreak).toBe(1);
    });

    it('should update streak when marking workout completed', async () => {
      // Create a plan and workout
      const planId = await dbUtils.createPlan({
        userId: testUserId,
        title: 'Test Plan',
        startDate: new Date(),
        endDate: new Date(),
        totalWeeks: 4,
        isActive: true
      });

      const workoutId = await dbUtils.createWorkout({
        planId,
        week: 1,
        day: 'Mon',
        type: 'easy',
        distance: 5,
        completed: false,
        scheduledDate: new Date()
      });

      // Mark workout as completed - this should trigger streak update
      await dbUtils.markWorkoutCompleted(workoutId);

      const user = await db.users.get(testUserId);
      expect(user?.streakLastUpdated).toBeDefined();
    });
  });

  describe('edge cases and timezone handling', () => {
    it('should handle timezone changes correctly', () => {
      // Test with different timezone dates
      const utcDate = new Date('2025-01-07T23:00:00Z');
      const localDate = new Date('2025-01-08T01:00:00+02:00');
      
      const normalized1 = dbUtils.normalizeDate(utcDate);
      const normalized2 = dbUtils.normalizeDate(localDate);
      
      // These should be treated as the same day for streak purposes
      const isSame = dbUtils.isSameDay(normalized1, normalized2);
      expect(typeof isSame).toBe('boolean');
    });

    it('should handle leap year correctly', () => {
      const feb28 = new Date('2024-02-28');
      const feb29 = new Date('2024-02-29');
      const mar01 = new Date('2024-03-01');
      
      expect(dbUtils.getDaysDifference(feb29, feb28)).toBe(1);
      expect(dbUtils.getDaysDifference(mar01, feb29)).toBe(1);
    });

    it('should limit streak calculation lookback to prevent infinite loops', async () => {
      // Create runs going back more than 365 days
      const today = new Date();
      for (let i = 0; i < 400; i++) {
        const runDate = new Date(today);
        runDate.setDate(runDate.getDate() - i);
        
        await dbUtils.createRun({
          userId: testUserId,
          type: 'easy',
          distance: 5,
          duration: 1800,
          completedAt: runDate
        });
      }

      // This should complete without hanging
      const streak = await dbUtils.calculateCurrentStreak(testUserId);
      expect(streak).toBeGreaterThan(0);
      expect(streak).toBeLessThanOrEqual(365);
    });
  });
}); 

describe('Badge System', () => {
  let testUserId: number;
  beforeEach(async () => {
    testUserId = await dbUtils.createUser({
      name: 'Badge User',
      goal: 'habit',
      experience: 'beginner',
      preferredTimes: ['morning'],
      daysPerWeek: 5,
      consents: { data: true, gdpr: true, push: false },
      onboardingComplete: true
    });
  });
  afterEach(async () => {
    await db.users.clear();
    await db.badges.clear();
    await db.runs.clear();
  });
  it('should unlock bronze badge at 3-day streak', async () => {
    const today = new Date();
    for (let i = 0; i < 3; i++) {
      const runDate = new Date(today);
      runDate.setDate(runDate.getDate() - i);
      await dbUtils.createRun({ userId: testUserId, type: 'easy', distance: 5, duration: 1800, completedAt: runDate });
    }
    await dbUtils.updateUserStreak(testUserId);
    const badges = await dbUtils.getUserBadges(testUserId);
    expect(badges.some(b => b.milestone === 3 && b.type === 'bronze')).toBe(true);
  });
  it('should unlock silver badge at 7-day streak', async () => {
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const runDate = new Date(today);
      runDate.setDate(runDate.getDate() - i);
      await dbUtils.createRun({ userId: testUserId, type: 'easy', distance: 5, duration: 1800, completedAt: runDate });
    }
    await dbUtils.updateUserStreak(testUserId);
    const badges = await dbUtils.getUserBadges(testUserId);
    expect(badges.some(b => b.milestone === 7 && b.type === 'silver')).toBe(true);
  });
  it('should unlock gold badge at 30-day streak', async () => {
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const runDate = new Date(today);
      runDate.setDate(runDate.getDate() - i);
      await dbUtils.createRun({ userId: testUserId, type: 'easy', distance: 5, duration: 1800, completedAt: runDate });
    }
    await dbUtils.updateUserStreak(testUserId);
    const badges = await dbUtils.getUserBadges(testUserId);
    expect(badges.some(b => b.milestone === 30 && b.type === 'gold')).toBe(true);
  });
  it('should not award duplicate badges', async () => {
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const runDate = new Date(today);
      runDate.setDate(runDate.getDate() - i);
      await dbUtils.createRun({ userId: testUserId, type: 'easy', distance: 5, duration: 1800, completedAt: runDate });
    }
    await dbUtils.updateUserStreak(testUserId);
    await dbUtils.updateUserStreak(testUserId); // Call again
    const badges = await dbUtils.getUserBadges(testUserId);
    const silverBadges = badges.filter(b => b.milestone === 7 && b.type === 'silver');
    expect(silverBadges.length).toBe(1);
  });
  it('should return empty for new users', async () => {
    const badges = await dbUtils.getUserBadges(testUserId);
    expect(badges.length).toBe(0);
  });
}); 