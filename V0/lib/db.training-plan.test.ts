import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db, dbUtils } from './db'
import FDBFactory from 'fake-indexeddb/lib/FDBFactory'

// Mock IndexedDB
global.indexedDB = new FDBFactory()

describe('Training Plan Creation', () => {
  beforeEach(async () => {
    // Clean up database before each test
    await db.delete()
    await db.open()
  })

  it('should create a plan for a new user and ensureUserHasActivePlan should succeed', async () => {
    // Create a test user with completed onboarding
    const testUserData = {
      name: 'Test User',
      goal: 'fitness' as const,
      experience: 'beginner' as const,
      preferredTimes: ['morning'],
      daysPerWeek: 3,
      consents: { analytics: true, notifications: true },
      onboardingComplete: true
    }
    
    const userId = await dbUtils.createUser(testUserData)
    expect(userId).toBeGreaterThan(0)
    
    // Verify user was created
    const user = await dbUtils.getUserById(userId)
    expect(user).toBeDefined()
    expect(user!.onboardingComplete).toBe(true)
    
    // Test ensureUserHasActivePlan creates a plan when none exists
    const plan = await dbUtils.ensureUserHasActivePlan(userId)
    
    // Verify plan was created successfully
    expect(plan).toBeDefined()
    expect(plan.id).toBeGreaterThan(0)
    expect(plan.userId).toBe(userId)
    expect(plan.isActive).toBe(true)
    expect(plan.title).toBe('Recovery Training Plan')
    expect(plan.totalWeeks).toBe(12)
    expect(plan.planType).toBe('basic')
    
    // Verify we can retrieve the plan via getActivePlan
    const retrievedPlan = await dbUtils.getActivePlan(userId)
    expect(retrievedPlan).toBeDefined()
    expect(retrievedPlan!.id).toBe(plan.id)
  })

  it('should return existing active plan if one already exists', async () => {
    // Create a test user
    const userId = await dbUtils.createUser({
      name: 'Test User',
      goal: 'fitness' as const,
      experience: 'intermediate' as const,
      preferredTimes: ['evening'],
      daysPerWeek: 4,
      consents: {},
      onboardingComplete: true
    })
    
    // Create an existing plan
    const existingPlanId = await dbUtils.createPlan({
      userId,
      title: 'Existing Plan',
      description: 'A pre-existing plan',
      startDate: new Date(),
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      totalWeeks: 8,
      isActive: true,
      planType: 'advanced'
    })
    
    // ensureUserHasActivePlan should return the existing plan, not create a new one
    const plan = await dbUtils.ensureUserHasActivePlan(userId)
    
    expect(plan.id).toBe(existingPlanId)
    expect(plan.title).toBe('Existing Plan')
    expect(plan.planType).toBe('advanced')
    
    // Verify no additional plans were created
    const allPlans = await db.plans.where('userId').equals(userId).toArray()
    expect(allPlans).toHaveLength(1)
  })

  it('should reactivate an inactive plan if no active plan exists', async () => {
    // Create a test user
    const userId = await dbUtils.createUser({
      name: 'Test User',
      goal: 'distance' as const,
      experience: 'advanced' as const,
      preferredTimes: ['morning'],
      daysPerWeek: 5,
      consents: {},
      onboardingComplete: true
    })
    
    // Create an inactive plan
    const inactivePlanId = await dbUtils.createPlan({
      userId,
      title: 'Inactive Plan',
      description: 'This plan was deactivated',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days future
      totalWeeks: 8,
      isActive: false, // Inactive
      planType: 'advanced'
    })
    
    // ensureUserHasActivePlan should reactivate the existing plan
    const plan = await dbUtils.ensureUserHasActivePlan(userId)
    
    expect(plan.id).toBe(inactivePlanId)
    expect(plan.title).toBe('Inactive Plan')
    expect(plan.isActive).toBe(true) // Should be reactivated
    
    // Verify the plan was actually updated in the database
    const updatedPlan = await db.plans.get(inactivePlanId)
    expect(updatedPlan?.isActive).toBe(true)
  })

  it('should throw error if user has not completed onboarding', async () => {
    // Create a test user without completed onboarding
    const userId = await dbUtils.createUser({
      name: 'Incomplete User',
      goal: 'fitness' as const,
      experience: 'beginner' as const,
      preferredTimes: ['morning'],
      daysPerWeek: 3,
      consents: {},
      onboardingComplete: false // Not completed
    })
    
    // ensureUserHasActivePlan should throw an error
    await expect(dbUtils.ensureUserHasActivePlan(userId)).rejects.toThrow('onboarding')
  })

  it('should throw error if user does not exist', async () => {
    const nonExistentUserId = 999
    
    // ensureUserHasActivePlan should throw an error
    await expect(dbUtils.ensureUserHasActivePlan(nonExistentUserId)).rejects.toThrow('not found')
  })

  it('should handle multiple calls gracefully without creating duplicate plans', async () => {
    // Create a test user
    const userId = await dbUtils.createUser({
      name: 'Test User',
      goal: 'habit' as const,
      experience: 'beginner' as const,
      preferredTimes: ['morning'],
      daysPerWeek: 3,
      consents: {},
      onboardingComplete: true
    })
    
    // Call ensureUserHasActivePlan multiple times
    const plan1 = await dbUtils.ensureUserHasActivePlan(userId)
    const plan2 = await dbUtils.ensureUserHasActivePlan(userId)
    const plan3 = await dbUtils.ensureUserHasActivePlan(userId)
    
    // All calls should return the same plan
    expect(plan1.id).toBe(plan2.id)
    expect(plan2.id).toBe(plan3.id)
    
    // Verify only one plan exists
    const allPlans = await db.plans.where('userId').equals(userId).toArray()
    expect(allPlans).toHaveLength(1)
  })
})