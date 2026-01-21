import { describe, it, expect, beforeEach, vi } from 'vitest'
import { HabitAnalyticsService, type WeeklyRecap } from './habitAnalytics'
import { db, type User, type Run, type Workout } from './db'
import { subDays, startOfWeek, endOfWeek } from 'date-fns'

// Mock the feature flags
vi.mock('./featureFlags', () => ({
  ENABLE_WEEKLY_RECAP: true,
  ENABLE_AUTO_PAUSE: true,
  ENABLE_GPS_QUALITY_SCORE: true,
  ENABLE_PACE_CHART: true,
  ENABLE_ENHANCED_SHARING: true,
  ENABLE_COMPLETION_LOOP: true,
  ENABLE_VIBRATION_COACH: true,
}))

describe('HabitAnalytics - Weekly Recap', () => {
  let service: HabitAnalyticsService
  let userId: number

  beforeEach(async () => {
    service = new HabitAnalyticsService()

    // Create test user
    userId = await db.users.add({
      name: 'Test User',
      email: 'test@example.com',
      goal: 'habit',
      experience: 'beginner',
      currentStreak: 5,
      longestStreak: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('generates weekly recap with totals correctly', async () => {
    const weekStart = startOfWeek(new Date())
    const weekEnd = endOfWeek(weekStart)

    // Add runs for current week
    await db.runs.add({
      userId,
      type: 'easy',
      distance: 5.0,
      duration: 1650, // 5:30 min/km pace
      pace: 330,
      calories: 300,
      completedAt: new Date(weekStart.getTime() + 1 * 24 * 60 * 60 * 1000), // Monday
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await db.runs.add({
      userId,
      type: 'easy',
      distance: 3.0,
      duration: 990, // 5:30 min/km pace
      pace: 330,
      calories: 180,
      completedAt: new Date(weekStart.getTime() + 3 * 24 * 60 * 60 * 1000), // Wednesday
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const recap = await service.generateWeeklyRecap(userId, weekStart)

    expect(recap.totalDistance).toBe(8.0)
    expect(recap.totalRuns).toBe(2)
    expect(recap.totalDuration).toBe(2640) // 1650 + 990
    expect(recap.averagePace).toMatch(/5:[0-9]{2}/)
  })

  it('calculates week-over-week comparison correctly', async () => {
    const currentWeekStart = startOfWeek(new Date())
    const previousWeekStart = subDays(currentWeekStart, 7)

    // Add runs for previous week (lower volume)
    await db.runs.add({
      userId,
      type: 'easy',
      distance: 3.0,
      duration: 990,
      pace: 330,
      calories: 180,
      completedAt: previousWeekStart,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Add runs for current week (higher volume)
    await db.runs.add({
      userId,
      type: 'easy',
      distance: 5.0,
      duration: 1650,
      pace: 330,
      calories: 300,
      completedAt: currentWeekStart,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await db.runs.add({
      userId,
      type: 'easy',
      distance: 5.0,
      duration: 1650,
      pace: 330,
      calories: 300,
      completedAt: new Date(currentWeekStart.getTime() + 2 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const recap = await service.generateWeeklyRecap(userId, currentWeekStart)

    // Week over week: (10 - 3) / 3 * 100 = 233%
    expect(recap.weekOverWeekChange.distance).toBeGreaterThan(0)
    expect(recap.weekOverWeekChange.runs).toBeGreaterThan(0)
  })

  it('handles zero runs gracefully', async () => {
    const weekStart = startOfWeek(new Date())

    const recap = await service.generateWeeklyRecap(userId, weekStart)

    expect(recap.totalDistance).toBe(0)
    expect(recap.totalRuns).toBe(0)
    expect(recap.totalDuration).toBe(0)
    expect(recap.topAchievement).toContain('No runs')
  })

  it('calculates consistency score correctly', async () => {
    const weekStart = startOfWeek(new Date())
    const planId = await db.plans.add({
      userId,
      goal: 'habit',
      targetDistance: 10,
      targetPace: 330,
      weeksToGoal: 8,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Create 4 planned workouts for the week
    for (let i = 0; i < 4; i++) {
      await db.workouts.add({
        planId,
        type: 'easy',
        distance: 5,
        duration: 30,
        pace: 330,
        scheduledDate: new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000),
        completed: i < 3, // Complete 3 out of 4
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    // Add 3 completed runs
    for (let i = 0; i < 3; i++) {
      await db.runs.add({
        userId,
        type: 'easy',
        distance: 5.0,
        duration: 1650,
        pace: 330,
        calories: 300,
        completedAt: new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    const recap = await service.generateWeeklyRecap(userId, weekStart)

    // Consistency: 3 completed out of 4 planned = 75%
    expect(recap.consistencyScore).toBe(75)
  })

  it('caches weekly recap for performance', async () => {
    const weekStart = startOfWeek(new Date())

    await db.runs.add({
      userId,
      type: 'easy',
      distance: 5.0,
      duration: 1650,
      pace: 330,
      calories: 300,
      completedAt: weekStart,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // First call - should compute
    const recap1 = await service.generateWeeklyRecap(userId, weekStart)

    // Second call - should use cache
    const recap2 = await service.generateWeeklyRecap(userId, weekStart)

    expect(recap1).toEqual(recap2)
    expect(recap1.totalDistance).toBe(5.0)
  })

  it('generates daily run totals array correctly', async () => {
    const weekStart = startOfWeek(new Date())

    // Add runs on specific days: Monday (1), Tuesday (0), Wednesday (2), Thursday (1), Friday-Sunday (0)
    await db.runs.add({
      userId,
      type: 'easy',
      distance: 5.0,
      duration: 1650,
      pace: 330,
      calories: 300,
      completedAt: new Date(weekStart.getTime() + 1 * 24 * 60 * 60 * 1000), // Monday
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await db.runs.add({
      userId,
      type: 'easy',
      distance: 3.0,
      duration: 990,
      pace: 330,
      calories: 180,
      completedAt: new Date(weekStart.getTime() + 3 * 24 * 60 * 60 * 1000), // Wednesday
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await db.runs.add({
      userId,
      type: 'easy',
      distance: 3.0,
      duration: 990,
      pace: 330,
      calories: 180,
      completedAt: new Date(weekStart.getTime() + 3 * 24 * 60 * 60 * 1000 + 1000 * 60 * 60), // Wednesday (2nd run)
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await db.runs.add({
      userId,
      type: 'easy',
      distance: 5.0,
      duration: 1650,
      pace: 330,
      calories: 300,
      completedAt: new Date(weekStart.getTime() + 4 * 24 * 60 * 60 * 1000), // Thursday
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const recap = await service.generateWeeklyRecap(userId, weekStart)

    expect(recap.dailyRunTotals).toHaveLength(7)
    expect(recap.dailyRunTotals[0]).toBe(0) // Sunday
    expect(recap.dailyRunTotals[1]).toBe(1) // Monday
    expect(recap.dailyRunTotals[2]).toBe(0) // Tuesday
    expect(recap.dailyRunTotals[3]).toBe(2) // Wednesday
    expect(recap.dailyRunTotals[4]).toBe(1) // Thursday
    expect(recap.dailyRunTotals[5]).toBe(0) // Friday
    expect(recap.dailyRunTotals[6]).toBe(0) // Saturday
  })
})
