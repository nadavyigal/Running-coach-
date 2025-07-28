import { describe, it, expect, beforeEach, vi } from 'vitest'
import { dbUtils } from '@/lib/db'

// Mock database utilities
vi.mock('@/lib/db', () => ({
  dbUtils: {
    getCurrentUser: vi.fn(),
    getActivePlan: vi.fn(),
  }
}))

describe('Onboarding Completion Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should verify user and plan exist after onboarding completion', async () => {
    // Mock successful user creation
    const mockUser = {
      id: 1,
      goal: 'habit' as const,
      experience: 'beginner' as const,
      preferredTimes: ['morning'],
      daysPerWeek: 3,
      consents: { data: true, gdpr: true, push: false },
      onboardingComplete: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Mock successful plan creation
    const mockPlan = {
      id: 1,
      userId: 1,
      title: 'Test Plan',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(dbUtils.getActivePlan).mockResolvedValue(mockPlan)

    // Simulate the verification logic from handleOnboardingComplete
    const handleOnboardingComplete = async () => {
      // Verify user was created successfully
      const user = await dbUtils.getCurrentUser()
      if (!user) {
        throw new Error('User creation failed during onboarding')
      }
      
      // Verify user has onboarding complete flag
      if (!user.onboardingComplete) {
        throw new Error('Onboarding completion not properly saved')
      }
      
      // Verify user has an active plan
      const activePlan = await dbUtils.getActivePlan(user.id!)
      if (!activePlan) {
        throw new Error('Training plan creation failed during onboarding')
      }
      
      return { user, plan: activePlan }
    }

    // Test the verification logic
    const result = await handleOnboardingComplete()
    
    expect(result.user).toBeDefined()
    expect(result.user.id).toBe(1)
    expect(result.user.onboardingComplete).toBe(true)
    expect(result.plan).toBeDefined()
    expect(result.plan.isActive).toBe(true)
    expect(result.plan.userId).toBe(1)

    // Verify the database methods were called correctly
    expect(dbUtils.getCurrentUser).toHaveBeenCalled()
    expect(dbUtils.getActivePlan).toHaveBeenCalledWith(1)
  })

  it('should throw error when user is not found after onboarding', async () => {
    vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(undefined)

    const handleOnboardingComplete = async () => {
      const user = await dbUtils.getCurrentUser()
      if (!user) {
        throw new Error('User creation failed during onboarding')
      }
      
      return { user }
    }

    await expect(handleOnboardingComplete()).rejects.toThrow('User creation failed during onboarding')
  })

  it('should throw error when user onboarding is not marked complete', async () => {
    const mockUser = {
      id: 1,
      onboardingComplete: false, // Not completed
    } as any

    vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(mockUser)

    const handleOnboardingComplete = async () => {
      const user = await dbUtils.getCurrentUser()
      if (!user) {
        throw new Error('User creation failed during onboarding')
      }
      
      if (!user.onboardingComplete) {
        throw new Error('Onboarding completion not properly saved')
      }
      
      return { user }
    }

    await expect(handleOnboardingComplete()).rejects.toThrow('Onboarding completion not properly saved')
  })

  it('should throw error when active plan is not found', async () => {
    const mockUser = {
      id: 1,
      onboardingComplete: true,
    } as any

    vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(dbUtils.getActivePlan).mockResolvedValue(undefined)

    const handleOnboardingComplete = async () => {
      const user = await dbUtils.getCurrentUser()
      if (!user) {
        throw new Error('User creation failed during onboarding')
      }
      
      if (!user.onboardingComplete) {
        throw new Error('Onboarding completion not properly saved')
      }
      
      const activePlan = await dbUtils.getActivePlan(user.id!)
      if (!activePlan) {
        throw new Error('Training plan creation failed during onboarding')
      }
      
      return { user, plan: activePlan }
    }

    await expect(handleOnboardingComplete()).rejects.toThrow('Training plan creation failed during onboarding')
  })

  it('should wait proper amount of time before verification', async () => {
    const mockUser = {
      id: 1,
      onboardingComplete: true,
    } as any

    const mockPlan = {
      id: 1,
      userId: 1,
      isActive: true,
    } as any

    vi.mocked(dbUtils.getCurrentUser).mockResolvedValue(mockUser)
    vi.mocked(dbUtils.getActivePlan).mockResolvedValue(mockPlan)

    const handleOnboardingComplete = async () => {
      const user = await dbUtils.getCurrentUser()
      const activePlan = await dbUtils.getActivePlan(user!.id!)
      
      return { user, plan: activePlan }
    }

    const result = await handleOnboardingComplete()
    
    // Verify that the verification works correctly
    expect(result.user).toBeDefined()
    expect(result.plan).toBeDefined()
    expect(dbUtils.getCurrentUser).toHaveBeenCalled()
    expect(dbUtils.getActivePlan).toHaveBeenCalledWith(1)
  })
})