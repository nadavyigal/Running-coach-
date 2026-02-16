import { beforeEach, describe, expect, it } from 'vitest'
import FDBFactory from 'fake-indexeddb/lib/FDBFactory'
import { db, type ChallengeProgress, type ChallengeTemplate, type Plan, type Workout } from './db'
import { getActiveChallenge, getDailyChallengeData } from './challengeEngine'

global.indexedDB = new FDBFactory()

const now = new Date()

function buildTemplate(overrides: Partial<ChallengeTemplate> = {}): ChallengeTemplate {
  return {
    slug: 'test-challenge',
    name: 'Test Challenge',
    tagline: 'Consistency first',
    description: 'Test description',
    targetAudience: 'testers',
    promise: 'Build consistency',
    durationDays: 21,
    difficulty: 'beginner',
    category: 'habit',
    workoutPattern: '3 runs/week',
    coachTone: 'gentle',
    dailyThemes: Array.from({ length: 21 }, (_, index) => `Day ${index + 1}: Active Recovery`),
    isActive: true,
    isFeatured: false,
    sortOrder: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function buildPlan(userId: number, overrides: Partial<Plan> = {}): Plan {
  return {
    userId,
    title: 'Challenge Plan',
    description: 'Plan used for tests',
    startDate: now,
    endDate: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000),
    totalWeeks: 3,
    isActive: true,
    planType: 'basic',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function buildProgress(
  userId: number,
  challengeTemplateId: number,
  planId: number,
  overrides: Partial<ChallengeProgress> = {}
): ChallengeProgress {
  return {
    userId,
    challengeTemplateId,
    planId,
    startDate: now,
    currentDay: 1,
    status: 'active',
    streakDays: 0,
    totalDaysCompleted: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function buildWorkout(planId: number, overrides: Partial<Workout> = {}): Workout {
  const scheduledDate = new Date()
  scheduledDate.setHours(9, 0, 0, 0)

  return {
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
    ...overrides,
  }
}

describe('challengeEngine consistency', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('uses the active plan workout theme for challenge daily data', async () => {
    const userId = 1
    const template = buildTemplate()
    const templateId = (await db.challengeTemplates.add(template)) as number
    const planId = (await db.plans.add(buildPlan(userId))) as number

    await db.workouts.add(buildWorkout(planId, { type: 'intervals', completed: false }))

    const progress = buildProgress(userId, templateId, planId, { startDate: new Date() })
    const dailyData = await getDailyChallengeData(progress, { ...template, id: templateId })

    expect(dailyData.dayTheme).toContain('Intervals')
  })

  it('falls back to template day theme when no workout exists for the challenge day', async () => {
    const userId = 2
    const template = buildTemplate()
    const templateId = (await db.challengeTemplates.add(template)) as number
    const planId = (await db.plans.add(buildPlan(userId))) as number

    const progress = buildProgress(userId, templateId, planId, { startDate: new Date() })
    const dailyData = await getDailyChallengeData(progress, { ...template, id: templateId })

    expect(dailyData.dayTheme).toBe('Day 1: Active Recovery')
  })

  it('auto-completes expired active challenges when loading active challenge', async () => {
    const userId = 3
    const template = buildTemplate()
    const templateId = (await db.challengeTemplates.add(template)) as number
    const planId = (await db.plans.add(buildPlan(userId))) as number

    const expiredStartDate = new Date()
    expiredStartDate.setDate(expiredStartDate.getDate() - 30)
    const progressId = (await db.challengeProgress.add(
      buildProgress(userId, templateId, planId, { startDate: expiredStartDate, status: 'active' })
    )) as number

    const activeChallenge = await getActiveChallenge(userId)
    const updatedProgress = await db.challengeProgress.get(progressId)

    expect(activeChallenge).toBeNull()
    expect(updatedProgress?.status).toBe('completed')
  })
})
