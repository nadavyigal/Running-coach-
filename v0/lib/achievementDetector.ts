import { dbUtils } from '@/lib/dbUtils'

export type AchievementContext =
  | { type: 'first_run'; distanceKm: number }
  | { type: 'personal_best'; distanceKm: number; previousBestKm: number }
  | { type: 'milestone'; distanceKm: number; milestoneKm: 5 | 10 | 21.1 }

const MILESTONES: Array<5 | 10 | 21.1> = [5, 10, 21.1]

export async function detectAchievement(
  userId: number,
  currentRunId: number,
  currentDistanceKm: number
): Promise<AchievementContext | null> {
  const runs = await dbUtils.getRunsByUser(userId)
  const priorRuns = runs.filter((run) => run.id !== currentRunId)

  if (priorRuns.length === 0) {
    return { type: 'first_run', distanceKm: currentDistanceKm }
  }

  const maxPriorDistance = Math.max(...priorRuns.map((run) => run.distance))

  for (const milestone of MILESTONES) {
    if (currentDistanceKm >= milestone && maxPriorDistance < milestone) {
      return { type: 'milestone', distanceKm: currentDistanceKm, milestoneKm: milestone }
    }
  }

  if (currentDistanceKm > maxPriorDistance) {
    return {
      type: 'personal_best',
      distanceKm: currentDistanceKm,
      previousBestKm: maxPriorDistance,
    }
  }

  return null
}
