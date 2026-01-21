import { describe, it, expect, beforeEach, vi } from 'vitest'
import { HabitAnalyticsService, type WeeklyRecap } from './habitAnalytics'
import { db, type User, type Run, type Workout } from './db'
import { subDays, startOfWeek, endOfWeek, addDays } from 'date-fns'

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
    // Start of week is Monday (habitAnalytics normalizes to Monday)
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })

    // Add runs within the week with proper timing
    const mondayDate = addDays(weekStart, 0) // Monday
    mondayDate.setHours(12, 0, 0, 0)

    const wednesdayDate = addDays(weekStart, 2) // Wednesday
    wednesdayDate.setHours(12, 0, 0, 0)

    await db.runs.add({
      userId,
      type: 'easy',
      distance: 5.0,
      duration: 1650, // 5:30 min/km pace
      pace: 330,
      calories: 300,
      completedAt: mondayDate,
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
      completedAt: wednesdayDate,
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
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    const previousWeekStart = subDays(currentWeekStart, 7)

    // Add run for previous week
    const prevMonday = addDays(previousWeekStart, 0)
    prevMonday.setHours(12, 0, 0, 0)

    await db.runs.add({
      userId,
      type: 'easy',
      distance: 3.0,
      duration: 990,
      pace: 330,
      calories: 180,
      completedAt: prevMonday,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Add runs for current week (higher volume)
    const currentMonday = addDays(currentWeekStart, 0)
    currentMonday.setHours(12, 0, 0, 0)

    const currentWednesday = addDays(currentWeekStart, 2)
    currentWednesday.setHours(12, 0, 0, 0)

    await db.runs.add({
      userId,
      type: 'easy',
      distance: 5.0,
      duration: 1650,
      pace: 330,
      calories: 300,
      completedAt: currentMonday,
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
      completedAt: currentWednesday,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const recap = await service.generateWeeklyRecap(userId, currentWeekStart)

    // Week over week: (10 - 3) / 3 * 100 = 233%
    expect(recap.weekOverWeekChange.distance).toBeGreaterThan(0)
    expect(recap.weekOverWeekChange.runs).toBeGreaterThan(0)
  })

  it('handles zero runs gracefully', async () => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })

    const recap = await service.generateWeeklyRecap(userId, weekStart)

    expect(recap.totalDistance).toBe(0)
    expect(recap.totalRuns).toBe(0)
    expect(recap.totalDuration).toBe(0)
    expect(recap.topAchievement).toContain('No runs')
  })

  it('calculates consistency score correctly', async () => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })

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

    // Create 4 planned workouts for the week (non-rest days only count)
    const daysOffset = [0, 1, 3, 4] // Mon, Tue, Thu, Fri
    for (let i = 0; i < 4; i++) {
      const workoutDate = addDays(weekStart, daysOffset[i])
      workoutDate.setHours(10, 0, 0, 0)

      await db.workouts.add({
        planId,
        type: 'easy',
        distance: 5,
        duration: 30,
        pace: 330,
        scheduledDate: workoutDate,
        completed: false, // Mark as not completed initially
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    // Add 3 completed runs to match 3 of the workouts
    for (let i = 0; i < 3; i++) {
      const runDate = addDays(weekStart, daysOffset[i])
      runDate.setHours(12, 0, 0, 0)

      await db.runs.add({
        userId,
        type: 'easy',
        distance: 5.0,
        duration: 1650,
        pace: 330,
        calories: 300,
        completedAt: runDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    const recap = await service.generateWeeklyRecap(userId, weekStart)

    // Consistency: 3 runs completed out of 4 planned = 75%
    expect(recap.consistencyScore).toBe(75)
  })

  it('caches weekly recap for performance', async () => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    const monday = addDays(weekStart, 0)
    monday.setHours(12, 0, 0, 0)

    await db.runs.add({
      userId,
      type: 'easy',
      distance: 5.0,
      duration: 1650,
      pace: 330,
      calories: 300,
      completedAt: monday,
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
    // Week starts on Monday (index 0 in the normalized week)
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })

    // Add runs: Monday (index 0), Wednesday (index 2 - 2 runs), Thursday (index 3)
    const monday = addDays(weekStart, 0)
    monday.setHours(12, 0, 0, 0)

    const wednesday = addDays(weekStart, 2)
    wednesday.setHours(12, 0, 0, 0)

    const wednesday2 = addDays(weekStart, 2)
    wednesday2.setHours(14, 0, 0, 0) // 2nd run on Wednesday

    const thursday = addDays(weekStart, 3)
    thursday.setHours(12, 0, 0, 0)

    await db.runs.add({
      userId,
      type: 'easy',
      distance: 5.0,
      duration: 1650,
      pace: 330,
      calories: 300,
      completedAt: monday,
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
      completedAt: wednesday,
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
      completedAt: wednesday2,
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
      completedAt: thursday,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const recap = await service.generateWeeklyRecap(userId, weekStart)

    // dailyRunTotals array is [Mon, Tue, Wed, Thu, Fri, Sat, Sun] when week starts on Monday
    expect(recap.dailyRunTotals).toHaveLength(7)
    expect(recap.dailyRunTotals[0]).toBe(1) // Monday
    expect(recap.dailyRunTotals[1]).toBe(0) // Tuesday
    expect(recap.dailyRunTotals[2]).toBe(2) // Wednesday
    expect(recap.dailyRunTotals[3]).toBe(1) // Thursday
    expect(recap.dailyRunTotals[4]).toBe(0) // Friday
    expect(recap.dailyRunTotals[5]).toBe(0) // Saturday
    expect(recap.dailyRunTotals[6]).toBe(0) // Sunday
  })
})
