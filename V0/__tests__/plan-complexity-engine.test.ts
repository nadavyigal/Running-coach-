import { describe, it, expect } from 'vitest'
import { PlanComplexityEngineService } from '@/lib/plan-complexity-engine'
import type { AdaptationFactor } from '@/lib/db'


describe('PlanComplexityEngineService', () => {
  it('calculates complexity score based on adaptation factors', () => {
    const factors: AdaptationFactor[] = [
      { factor: 'performance', weight: 2, currentValue: 8, targetValue: 10 },
      { factor: 'consistency', weight: 1, currentValue: 5, targetValue: 10 }
    ]
    const engine = {
      userExperience: 'beginner' as const,
      planLevel: 'basic' as const,
      adaptationFactors: factors,
      complexityScore: 0
    }
    const updated = PlanComplexityEngineService.updateComplexity(engine)
    // Expected weighted score: ((8/10)*2 + (5/10)*1)/3 = 0.7 -> 70
    expect(updated.complexityScore).toBe(70)
    expect(updated.planLevel).toBe('advanced')
  })
})
