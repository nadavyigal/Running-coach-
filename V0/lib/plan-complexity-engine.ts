import type { AdaptationFactor } from './db'

export interface PlanComplexityEngine {
  userExperience: 'beginner' | 'intermediate' | 'advanced';
  planLevel: 'basic' | 'standard' | 'advanced';
  adaptationFactors: AdaptationFactor[];
  complexityScore: number;
}

export class PlanComplexityEngineService {
  static initializeFromPlan(plan: { fitnessLevel?: 'beginner' | 'intermediate' | 'advanced'; complexityLevel?: 'basic' | 'standard' | 'advanced'; adaptationFactors?: AdaptationFactor[]; complexityScore?: number; }): PlanComplexityEngine {
    return {
      userExperience: plan.fitnessLevel || 'beginner',
      planLevel: plan.complexityLevel || 'basic',
      adaptationFactors: plan.adaptationFactors || [],
      complexityScore: plan.complexityScore || 0
    }
  }

  static calculateScore(engine: PlanComplexityEngine): number {
    const totalWeight = engine.adaptationFactors.reduce((s, f) => s + f.weight, 0)
    if (totalWeight === 0) return 0
    const score = engine.adaptationFactors.reduce((sum, f) => {
      const ratio = f.targetValue === 0 ? 0 : Math.min(f.currentValue / f.targetValue, 1)
      return sum + ratio * f.weight
    }, 0)
    return Math.round((score / totalWeight) * 100)
  }

  static updateComplexity(engine: PlanComplexityEngine): PlanComplexityEngine {
    const score = this.calculateScore(engine)
    let level: 'basic' | 'standard' | 'advanced' = 'basic'
    if (score >= 66) level = 'advanced'
    else if (score >= 33) level = 'standard'
    return { ...engine, complexityScore: score, planLevel: level }
  }

  static incorporateFeedback(engine: PlanComplexityEngine, rating: number): PlanComplexityEngine {
    const feedbackFactor: AdaptationFactor = {
      factor: 'feedback',
      weight: 1,
      currentValue: rating,
      targetValue: 5
    }
    const factors = engine.adaptationFactors.filter(f => f.factor !== 'feedback')
    factors.push(feedbackFactor)
    const updated = { ...engine, adaptationFactors: factors }
    return this.updateComplexity(updated)
  }
}
