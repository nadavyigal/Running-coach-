import { beforeEach, describe, expect, it } from 'vitest'
import FDBFactory from 'fake-indexeddb/lib/FDBFactory'
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
})
