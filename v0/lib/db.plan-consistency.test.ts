import FDBFactory from 'fake-indexeddb/lib/FDBFactory'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, type Plan, type Workout } from './db'
import { dbUtils } from './dbUtils'

global.indexedDB = new FDBFactory()

const now = new Date()

async function createTestUser(): Promise<number> {
  return dbUtils.createUser({
    name: 'Consistency Test User',
    goal: 'fitness',
    experience: 'beginner',
    preferredTimes: ['morning'],
    daysPerWeek: 3,
    consents: {},
    onboardingComplete: true,
  })
}

async function addPlan(userId: number, overrides: Partial<Plan> = {}): Promise<number> {
  const base: Plan = {
    userId,
    title: 'Plan',
    description: 'Test plan',
    startDate: now,
    endDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
    totalWeeks: 2,
    isActive: false,
    planType: 'basic',
    createdAt: now,
    updatedAt: now,
  }

  return (await db.plans.add({
    ...base,
    ...overrides,
  })) as number
}

async function addWorkout(planId: number, scheduledDate: Date, overrides: Partial<Workout> = {}): Promise<number> {
  const base: Workout = {
    planId,
    week: 1,
    day: 'Mon',
    type: 'easy',
    distance: 5,
    duration: 30,
    intensity: 'easy',
    completed: false,
    scheduledDate,
    createdAt: now,
    updatedAt: now,
  }

  return (await db.workouts.add({
    ...base,
    ...overrides,
  })) as number
}

function getWeekdayKey(date: Date): Workout['day'] {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()] as Workout['day']
}

describe('Training plan consistency', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('returns only active-plan workouts when planScope is active', async () => {
    const userId = await createTestUser()
    const activePlanId = await addPlan(userId, { isActive: true, title: 'Active Plan' })
    const inactivePlanId = await addPlan(userId, { isActive: false, title: 'Inactive Plan' })
    const today = new Date()
    today.setUTCHours(12, 0, 0, 0)

    await addWorkout(activePlanId, today, { type: 'intervals' })
    await addWorkout(inactivePlanId, today, { type: 'tempo' })

    const start = new Date(today)
    start.setHours(0, 0, 0, 0)
    const end = new Date(today)
    end.setHours(23, 59, 59, 999)

    const activeScoped = await dbUtils.getWorkoutsForDateRange(userId, start, end, { planScope: 'active' })
    const allScoped = await dbUtils.getWorkoutsForDateRange(userId, start, end)

    expect(activeScoped).toHaveLength(1)
    expect(activeScoped[0]?.planId).toBe(activePlanId)
    expect(allScoped).toHaveLength(2)
  })

  it('self-heals duplicate active plans and keeps the most recently updated one', async () => {
    const userId = await createTestUser()
    const oldPlanId = await addPlan(userId, {
      isActive: true,
      title: 'Old Active Plan',
      updatedAt: new Date('2026-01-10T00:00:00.000Z'),
    })
    const newPlanId = await addPlan(userId, {
      isActive: true,
      title: 'New Active Plan',
      updatedAt: new Date('2026-01-11T00:00:00.000Z'),
    })

    const resolvedPlan = await dbUtils.getActivePlan(userId)
    const activePlans = await db.plans.where('userId').equals(userId).and((plan) => plan.isActive).toArray()
    const oldPlan = await db.plans.get(oldPlanId)

    expect(resolvedPlan?.id).toBe(newPlanId)
    expect(activePlans).toHaveLength(1)
    expect(activePlans[0]?.id).toBe(newPlanId)
    expect(oldPlan?.isActive).toBe(false)
  })

  it('returns today workout from the resolved active plan when duplicates exist', async () => {
    const userId = await createTestUser()
    const oldPlanId = await addPlan(userId, {
      isActive: true,
      updatedAt: new Date('2026-01-10T00:00:00.000Z'),
    })
    const newPlanId = await addPlan(userId, {
      isActive: true,
      updatedAt: new Date('2026-01-11T00:00:00.000Z'),
    })

    const today = new Date()
    today.setUTCHours(12, 0, 0, 0)
    await addWorkout(oldPlanId, today, { type: 'rest' })
    const expectedWorkoutId = await addWorkout(newPlanId, today, { type: 'intervals' })

    const todaysWorkout = await dbUtils.getTodaysWorkout(userId)

    expect(todaysWorkout?.id).toBe(expectedWorkoutId)
    expect(todaysWorkout?.planId).toBe(newPlanId)
    expect(todaysWorkout?.type).toBe('intervals')
  })

  it('returns a single canonical workout per day for active-plan date ranges', async () => {
    const userId = await createTestUser()
    const activePlanId = await addPlan(userId, { isActive: true, title: 'Active Plan' })

    const today = new Date()
    today.setUTCHours(12, 0, 0, 0)

    await addWorkout(activePlanId, today, { type: 'rest', completed: true })
    const expectedWorkoutId = await addWorkout(activePlanId, today, { type: 'intervals', completed: false })

    const start = new Date(today)
    start.setHours(0, 0, 0, 0)
    const end = new Date(today)
    end.setHours(23, 59, 59, 999)

    const workouts = await dbUtils.getWorkoutsForDateRange(userId, start, end, { planScope: 'active' })

    expect(workouts).toHaveLength(1)
    expect(workouts[0]?.id).toBe(expectedWorkoutId)
    expect(workouts[0]?.type).toBe('intervals')
  })

  it('creates a weekday-aligned starter plan that respects training days and long run day', async () => {
    const { userId, planId } = await dbUtils.completeOnboardingAtomic({
      goal: 'distance',
      experience: 'beginner',
      preferredTimes: ['morning'],
      daysPerWeek: 3,
      consents: { data: true, gdpr: true, push: false },
      planPreferences: {
        trainingDays: ['Tue', 'Thu', 'Sat'],
        longRunDay: 'Sat',
      } as any,
    })

    const activePlan = await dbUtils.getActivePlan(userId)
    const workouts = await db.workouts.where('planId').equals(planId).toArray()
    const upcomingWorkout = await dbUtils.getNextWorkoutForPlan(planId, new Date(Date.now() - 60 * 1000))

    expect(activePlan?.id).toBe(planId)
    expect(workouts.length).toBeGreaterThan(0)
    expect(upcomingWorkout).not.toBeNull()

    for (const workout of workouts) {
      expect(['Tue', 'Thu', 'Sat']).toContain(workout.day)
      expect(getWeekdayKey(new Date(workout.scheduledDate))).toBe(workout.day)
      if (workout.day === 'Sat') {
        expect(workout.type).toBe('long')
      } else {
        expect(workout.type).toBe('easy')
      }
      expect(workout.completed).toBe(false)
    }
  })

  it('repairs an existing active plan that has no workouts', async () => {
    const userId = await dbUtils.createUser({
      goal: 'fitness',
      experience: 'beginner',
      preferredTimes: ['morning'],
      daysPerWeek: 3,
      consents: { data: true, gdpr: true, push: false },
      onboardingComplete: false,
    })
    const existingPlanId = await addPlan(userId, {
      isActive: true,
      title: 'Draft Plan',
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-03-14T00:00:00.000Z'),
    })

    const result = await dbUtils.completeOnboardingAtomic({
      goal: 'habit',
      experience: 'beginner',
      preferredTimes: ['morning'],
      daysPerWeek: 3,
      consents: { data: true, gdpr: true, push: false },
      planPreferences: {
        trainingDays: ['Mon', 'Wed', 'Sat'],
        longRunDay: 'Sat',
      } as any,
    })

    const repairedPlan = await db.plans.get(existingPlanId)
    const workouts = await db.workouts.where('planId').equals(existingPlanId).toArray()

    expect(result.planId).toBe(existingPlanId)
    expect(repairedPlan?.isActive).toBe(true)
    expect(workouts.length).toBeGreaterThan(0)
    expect(await dbUtils.getNextWorkoutForPlan(existingPlanId, new Date(Date.now() - 60 * 1000))).not.toBeNull()
  })
})
