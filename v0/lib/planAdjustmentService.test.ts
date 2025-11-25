import { describe, it, expect, vi, beforeEach } from 'vitest'
import { planAdjustmentService } from './planAdjustmentService'
import { db } from './db'
import { dbUtils } from '@/lib/dbUtils'
import { generateFallbackPlan } from './planGenerator'
import { trackPlanAdjustmentEvent } from './analytics'

// Mock dependencies
vi.mock('./db', () => ({
  db: {
    users: {
      get: vi.fn()
    }
  }
}))

vi.mock('@/lib/dbUtils', () => ({
  dbUtils: {
    getActivePlan: vi.fn(),
    updatePlan: vi.fn()
  }
}))

vi.mock('./planGenerator', () => ({
  generateFallbackPlan: vi.fn()
}))

vi.mock('./analytics', () => ({
  trackPlanAdjustmentEvent: vi.fn()
}))

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn()
}))

describe('PlanAdjustmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('recompute', () => {
    it('should successfully recompute plan after run', async () => {
      // Setup mocks
      const mockUser = { id: 1, name: 'Test User' }
      const mockActivePlan = { id: 1, isActive: true }
      
      vi.mocked(db.users.get).mockResolvedValue(mockUser)
      vi.mocked(dbUtils.getActivePlan).mockResolvedValue(mockActivePlan)
      vi.mocked(dbUtils.updatePlan).mockResolvedValue()
      vi.mocked(generateFallbackPlan).mockResolvedValue({ plan: mockActivePlan, workouts: [] })
      vi.mocked(trackPlanAdjustmentEvent).mockResolvedValue()

      // Execute
      await planAdjustmentService.recompute(1, 'post-run')

      // Verify
      expect(db.users.get).toHaveBeenCalledWith(1)
      expect(dbUtils.getActivePlan).toHaveBeenCalledWith(1)
      expect(dbUtils.updatePlan).toHaveBeenCalledWith(1, { isActive: false })
      expect(generateFallbackPlan).toHaveBeenCalledWith(mockUser)
      expect(trackPlanAdjustmentEvent).toHaveBeenCalledWith('plan_adjusted', { reason: 'post-run' })
    })

    it('should handle missing user gracefully', async () => {
      vi.mocked(db.users.get).mockResolvedValue(null)

      await planAdjustmentService.recompute(999, 'post-run')

      expect(dbUtils.getActivePlan).not.toHaveBeenCalled()
      expect(generateFallbackPlan).not.toHaveBeenCalled()
    })

    it('should handle analytics failure gracefully', async () => {
      const mockUser = { id: 1, name: 'Test User' }
      
      vi.mocked(db.users.get).mockResolvedValue(mockUser)
      vi.mocked(dbUtils.getActivePlan).mockResolvedValue(null)
      vi.mocked(generateFallbackPlan).mockResolvedValue({ plan: {}, workouts: [] })
      vi.mocked(trackPlanAdjustmentEvent).mockRejectedValue(new Error('Analytics service unavailable'))

      // Should not throw despite analytics failure
      await expect(planAdjustmentService.recompute(1, 'post-run')).rejects.toThrow('Analytics service unavailable')
    })

    it('should handle plan generation failure', async () => {
      const mockUser = { id: 1, name: 'Test User' }
      
      vi.mocked(db.users.get).mockResolvedValue(mockUser)
      vi.mocked(dbUtils.getActivePlan).mockResolvedValue(null)
      vi.mocked(generateFallbackPlan).mockRejectedValue(new Error('Plan generation failed'))

      await expect(planAdjustmentService.recompute(1, 'post-run')).rejects.toThrow('Plan generation failed')
    })
  })

  describe('afterRun', () => {
    it('should call recompute with post-run reason', async () => {
      const recomputeSpy = vi.spyOn(planAdjustmentService, 'recompute').mockResolvedValue()

      await planAdjustmentService.afterRun(1)

      expect(recomputeSpy).toHaveBeenCalledWith(1, 'post-run')
    })
  })
})