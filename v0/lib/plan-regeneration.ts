import { type Goal, type Plan } from './db'
import { dbUtils } from './dbUtils'
import { generatePlan, generateFallbackPlan, type GeneratePlanOptions } from './planGenerator'

function mapGoalToTargetDistance(goal: Goal): GeneratePlanOptions['targetDistance'] {
  const metric = goal?.specificTarget?.metric?.toLowerCase?.() || ''
  if (metric.includes('5k')) return '5k'
  if (metric.includes('10k')) return '10k'
  if (metric.includes('half')) return 'half-marathon'
  if (metric.includes('marathon')) return 'marathon'
  return undefined
}

export async function regenerateTrainingPlan(userId: number, goal: Goal): Promise<Plan | null> {
  try {
    const user = await dbUtils.getUserById(userId)
    if (!user) {
      console.warn('[plan-regeneration] No user found for plan regeneration')
      return null
    }

    const startDate = new Date()
    let planData

    try {
      planData = await generatePlan({
        user,
        startDate,
        targetDistance: mapGoalToTargetDistance(goal),
      })
    } catch (error) {
      console.warn('[plan-regeneration] AI plan generation failed, falling back', error)
      planData = await generateFallbackPlan(user, startDate)
    }

    // Deactivate any existing active plans to avoid multiple actives
    await dbUtils.deactivateAllUserPlans(userId).catch(() => {})

    const planId = await dbUtils.createPlan({
      ...planData.plan,
      goalId: goal.id,
      startDate,
      isActive: true,
    })

    for (const workout of planData.workouts) {
      await dbUtils.createWorkout({
        ...workout,
        planId,
        scheduledDate: workout.scheduledDate || startDate,
        completed: false,
      })
    }

    // Mark goal as primary and link it to the new plan
    if (goal.id) {
      await dbUtils.setPrimaryGoal(userId, goal.id)
      await dbUtils.updateGoal(goal.id, { planId, status: 'active' })
    }

    return await dbUtils.getActivePlan(userId)
  } catch (error) {
    console.error('[plan-regeneration] Failed to regenerate training plan:', error)
    return null
  }
}
