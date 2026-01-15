import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { db } from './db'
import { dbUtils } from '@/lib/dbUtils'
import { planAdjustmentService } from './planAdjustmentService'
import { generateFallbackPlan } from './planGenerator'
import { toast } from '@/hooks/use-toast'
import { trackPlanAdjustmentEvent } from './analytics'

vi.mock('./analytics', () => ({
  trackPlanAdjustmentEvent: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn()
}))

const mockedToast = toast as unknown as ReturnType<typeof vi.fn>

describe('planAdjustmentService', () => {
  vi.setConfig({ testTimeout: 60000 });
  let userId: number

  beforeEach(async () => {
    mockedToast.mockClear()
    await db.users.clear()
    await db.plans.clear()
    await db.workouts.clear()

    userId = await dbUtils.createUser({
      goal: 'habit',
      experience: 'beginner',
      preferredTimes: ['morning'],
      daysPerWeek: 3,
      consents: { data: true, gdpr: true, push: false },
      onboardingComplete: true
    })

    const user = await db.users.get(userId)
    if (user) await generateFallbackPlan(user)
  })

  afterEach(async () => {
    planAdjustmentService.clear()
    await db.users.clear()
    await db.plans.clear()
    await db.workouts.clear()
  })

  it('recomputes plan after run', async () => {
    const plansBefore = await db.plans.count()
    await planAdjustmentService.afterRun(userId)
    const plansAfter = await db.plans.count()
    const activePlan = await dbUtils.getActivePlan(userId)

    expect(plansAfter).toBe(plansBefore + 1)
    expect(activePlan).toBeTruthy()
    expect(trackPlanAdjustmentEvent).toHaveBeenCalledWith('plan_adjusted', { reason: 'post-run' })
    expect(mockedToast).toHaveBeenCalled()
  })

  it('triggers nightly recompute', async () => {
    const plansBefore = await db.plans.count()
    await planAdjustmentService.recompute(userId, 'nightly')
    const plansAfter = await db.plans.count()

    expect(plansAfter).toBe(plansBefore + 1)
    expect(trackPlanAdjustmentEvent).toHaveBeenCalledWith('plan_adjusted', { reason: 'nightly' })
    expect(mockedToast).toHaveBeenCalled()
  })
})
