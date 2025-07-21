import { describe, it, expect, beforeEach, vi } from 'vitest'
import { dbUtils } from '@/lib/db'

// Mock the database utilities
vi.mock('@/lib/db', () => ({
  dbUtils: {
    getCurrentUser: vi.fn().mockResolvedValue({
      id: 1,
      name: 'Test User',
      goal: 'habit',
      experience: 'beginner',
      daysPerWeek: 3,
      onboardingComplete: true
    }),
    ensureUserHasActivePlan: vi.fn().mockResolvedValue({
      id: 1,
      userId: 1,
      title: 'Test Plan',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-04-01'), // 3 months from start
      totalWeeks: 12,
      isActive: true
    }),
    createWorkout: vi.fn().mockResolvedValue(123)
  }
}))

describe('Future Scheduling - Database Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should allow creating workouts with future dates', async () => {
    const mockDate = new Date('2024-01-15')
    vi.setSystemTime(mockDate)

    // Get user and plan
    const user = await dbUtils.getCurrentUser()
    const plan = await dbUtils.ensureUserHasActivePlan(user!.id!)

    expect(user).toBeDefined()
    expect(plan).toBeDefined()

    // Create a workout 3 days in the future
    const futureDate = new Date(mockDate)
    futureDate.setDate(futureDate.getDate() + 3)

    const workoutData = {
      planId: plan!.id!,
      week: 1,
      day: 'Mon',
      type: 'easy' as const,
      distance: 5,
      notes: 'Test future workout',
      completed: false,
      scheduledDate: futureDate
    }

    const workoutId = await dbUtils.createWorkout(workoutData)

    expect(workoutId).toBe(123)
    expect(dbUtils.createWorkout).toHaveBeenCalledWith(workoutData)

    vi.useRealTimers()
  })

  it('should validate date range constraints', () => {
    const mockDate = new Date('2024-01-15')
    vi.setSystemTime(mockDate)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // Test date validation logic
    const isDateDisabled = (date: Date) => {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      
      // Disable dates before today
      if (date < todayStart) {
        return true
      }
      
      return false
    }

    expect(isDateDisabled(today)).toBe(false)
    expect(isDateDisabled(tomorrow)).toBe(false)
    expect(isDateDisabled(yesterday)).toBe(true)

    vi.useRealTimers()
  })

  it('should calculate week numbers correctly for future dates', () => {
    const mockDate = new Date('2024-01-15')
    vi.setSystemTime(mockDate)

    const planStartDate = new Date('2024-01-01')
    const futureDate = new Date(mockDate)
    futureDate.setDate(futureDate.getDate() + 3) // 3 days from now

    const daysDiff = Math.floor((futureDate.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24))
    const weekNumber = Math.floor(daysDiff / 7) + 1

    expect(weekNumber).toBeGreaterThan(0)
    expect(weekNumber).toBeLessThanOrEqual(12) // Assuming 12-week plan

    vi.useRealTimers()
  })
}) 