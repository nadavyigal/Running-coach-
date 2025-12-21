import { type Goal, type Plan, type PlanSetupPreferences } from './db'
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

const MS_PER_DAY = 1000 * 60 * 60 * 24
const MAX_PLAN_WEEKS = 16

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function computeWeeksBetween(startDate: Date, endDate: Date) {
  const diffDays = Math.max(0, Math.ceil((endDate.getTime() - startDate.getTime()) / MS_PER_DAY))
  return Math.max(1, Math.ceil((diffDays + 1) / 7))
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function mapTargetDistanceToKm(targetDistance?: GeneratePlanOptions['targetDistance']): number | undefined {
  if (!targetDistance) return undefined
  switch (targetDistance) {
    case '5k':
      return 5
    case '10k':
      return 10
    case 'half-marathon':
      return 21.1
    case 'marathon':
      return 42.2
    default:
      return undefined
  }
}

export interface RegenerateTrainingPlanOptions {
  startDate?: Date
  raceDate?: Date
  totalWeeks?: number
  targetDistance?: GeneratePlanOptions['targetDistance']
  planPreferences?: PlanSetupPreferences
}

export async function regenerateTrainingPlan(
  userId: number,
  goal: Goal,
  options: RegenerateTrainingPlanOptions = {}
): Promise<Plan | null> {
  try {
    const user = await dbUtils.getUserById(userId)
    if (!user) {
      console.warn('[plan-regeneration] No user found for plan regeneration')
      return null
    }

    const goalStartDateRaw = goal?.timeBound?.startDate
    const goalDeadlineRaw = goal?.timeBound?.deadline
    const goalStartDate =
      goalStartDateRaw && !Number.isNaN(new Date(goalStartDateRaw as any).getTime())
        ? new Date(goalStartDateRaw as any)
        : undefined
    const goalDeadline =
      goalDeadlineRaw && !Number.isNaN(new Date(goalDeadlineRaw as any).getTime())
        ? new Date(goalDeadlineRaw as any)
        : undefined

    const startDate = options.startDate || goalStartDate || new Date()
    const planPreferences: PlanSetupPreferences | undefined =
      options.planPreferences || user.planPreferences
    const raceDate = options.raceDate || goalDeadline || planPreferences?.raceDate

    const computedWeeks =
      typeof options.totalWeeks === 'number'
        ? options.totalWeeks
        : raceDate
          ? computeWeeksBetween(startDate, raceDate)
          : planPreferences?.basePlanLengthWeeks

    const totalWeeks = typeof computedWeeks === 'number' ? clampNumber(computedWeeks, 1, MAX_PLAN_WEEKS) : undefined
    let planData
    const targetDistance = options.targetDistance || mapGoalToTargetDistance(goal)

    try {
      planData = await generatePlan({
        user,
        startDate,
        ...(typeof targetDistance === 'string' ? { targetDistance } : {}),
        ...(typeof totalWeeks === 'number' ? { totalWeeks } : {}),
        ...(planPreferences ? { planPreferences } : {}),
      })
    } catch (error) {
      console.warn('[plan-regeneration] AI plan generation failed, falling back', error)
      planData = await generateFallbackPlan(user, startDate, undefined, {
        ...(typeof totalWeeks === 'number' ? { totalWeeks } : {}),
        ...(planPreferences ? { planPreferences } : {}),
      })
    }

    // Deactivate any existing active plans to avoid multiple actives
    await dbUtils.deactivateAllUserPlans(userId).catch(() => {})

    const effectiveEndDate = raceDate ? new Date(raceDate) : planData.plan.endDate

    // Ensure the plan contains a race-day workout (time-trial) when raceDate is set.
    const workouts = [...planData.workouts]
    if (raceDate) {
      const raceDayShort =
        (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const).at(raceDate.getDay()) ?? 'Sat'
      const raceDistanceKm = mapTargetDistanceToKm(targetDistance)
      if (typeof raceDistanceKm === 'number') {
        const existingRaceWorkoutIndex = workouts.findIndex((w) =>
          w.scheduledDate ? isSameDay(new Date(w.scheduledDate), raceDate) : false
        )

        if (existingRaceWorkoutIndex >= 0) {
          const existing = workouts.at(existingRaceWorkoutIndex)
          if (existing) {
            workouts[existingRaceWorkoutIndex] = {
              ...existing,
              week: totalWeeks || existing.week,
              day: raceDayShort,
              type: 'time-trial',
              distance: raceDistanceKm,
              scheduledDate: raceDate,
              notes: existing.notes || `Race day: run your ${raceDistanceKm}km effort!`,
            }
          }
        } else {
          workouts.push({
            planId: 0,
            week: totalWeeks || computeWeeksBetween(startDate, raceDate),
            day: raceDayShort,
            type: 'time-trial',
            distance: raceDistanceKm,
            completed: false,
            scheduledDate: raceDate,
            notes: `Race day: run your ${raceDistanceKm}km effort!`,
          })
        }
      }
    }

    // Trim any workouts scheduled after the race date (race is the last run).
    const finalWorkouts = raceDate
      ? workouts.filter((w) => (w.scheduledDate ? new Date(w.scheduledDate).getTime() <= raceDate.getTime() : true))
      : workouts

	    const planId = await dbUtils.createPlan({
	      ...planData.plan,
	      startDate,
	      endDate: effectiveEndDate,
	      totalWeeks: totalWeeks || planData.plan.totalWeeks,
	      isActive: true,
	      ...(typeof goal.id === 'number' ? { goalId: goal.id } : {}),
	    })

    for (const workout of finalWorkouts) {
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
