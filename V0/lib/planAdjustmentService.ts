import { db, type User } from './db'
import { dbUtils } from './dbUtils'
import { generateFallbackPlan } from './planGenerator'
import { toast } from '@/hooks/use-toast'
import { trackPlanAdjustmentEvent } from './analytics'
import posthog from 'posthog-js'

class PlanAdjustmentService {
  private nightlyTimer: ReturnType<typeof setTimeout> | null = null
  private userId: number | null = null

  async recompute(userId: number, reason: 'nightly' | 'post-run') {
    try {
      const user = await db.users.get(userId)
      if (!user) return

      const activePlan = await dbUtils.getActivePlan(userId)
      if (activePlan) {
        await dbUtils.updatePlan(activePlan.id!, { isActive: false })
      }

      await generateFallbackPlan(user)

      // Try to show toast notification, but don't fail if toast context is unavailable
      try {
        toast({
          title: 'Plan Updated',
          description: 'Your training plan has been adjusted based on your recent activity.'
        })
      } catch (toastError) {
        console.warn('Toast notification unavailable:', toastError)
      }

      await trackPlanAdjustmentEvent('plan_adjusted', { reason })
    } catch (error) {
      console.error('Failed to recompute plan:', error)
      throw error
    }
  }

  private scheduleNextNightly() {
    if (!this.userId) return
    this.clear()
    const now = new Date()
    const next = new Date(now)
    next.setHours(2, 0, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    const delay = next.getTime() - now.getTime()
    this.nightlyTimer = setTimeout(async () => {
      if (this.userId) {
        await this.recompute(this.userId, 'nightly')
        this.scheduleNextNightly()
      }
    }, delay)
  }

  init(userId: number) {
    this.userId = userId
    this.scheduleNextNightly()
  }

  clear() {
    if (this.nightlyTimer) {
      clearTimeout(this.nightlyTimer)
      this.nightlyTimer = null
    }
  }

  async afterRun(userId: number) {
    await this.recompute(userId, 'post-run')
  }
}

export const planAdjustmentService = new PlanAdjustmentService()
