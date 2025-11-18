import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { db } from './db'
import { dbUtils } from '@/lib/dbUtils'
import { planAdjustmentService } from './planAdjustmentService'
import { generateFallbackPlan } from './planGenerator'
import posthog from 'posthog-js'
import { toast } from '@/hooks/use-toast'

vi.mock('posthog-js', () => {
  const mockPosthog = {
    capture: vi.fn(),
  };
  return {
    default: mockPosthog,
  };
});
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn()
}))

const capture = vi.fn()
const mockedToast = toast as unknown as ReturnType<typeof vi.fn>

describe('planAdjustmentService', () => {
  vi.setConfig({ testTimeout: 60000 });
  let userId: number

  beforeEach(async () => {
    vi.useFakeTimers()
    capture.mockClear()
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
    vi.useRealTimers()
    await vi.runAllTimersAsync()
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
    expect(posthog.capture).toHaveBeenCalledWith('plan_adjusted', { reason: 'post-run' })
    expect(mockedToast).toHaveBeenCalled()
  })

  it('triggers nightly recompute', async () => {
    const now = new Date('2025-01-01T01:00:00Z')
    vi.setSystemTime(now)
    planAdjustmentService.init(userId)
    const plansBefore = await db.plans.count()
    vi.advanceTimersByTime(60 * 60 * 1000 + 100)
    await vi.runOnlyPendingTimersAsync()
    const plansAfter = await db.plans.count()

    expect(plansAfter).toBe(plansBefore + 1)
    expect(posthog.capture).toHaveBeenCalledWith('plan_adjusted', { reason: 'nightly' })
    expect(mockedToast).toHaveBeenCalled()
  })
})
