import { db, type ChallengeProgress, type ChallengeTemplate, type Workout } from './db';
import { getNextChallengeRecommendation } from './challengeTemplates';

/**
 * Challenge Engine - Core logic for Challenge-Led Growth Engine
 * Handles challenge progression, day calculation, and completion tracking
 */

export interface DailyChallengeData {
  currentDay: number;
  totalDays: number;
  dayTheme: string;
  progress: number; // 0-100
  isLastDay: boolean;
  daysRemaining: number;
  streakDays: number;
}

function emitChallengeUpdated(userId: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('challenge-updated', { detail: { userId } }));
  } catch (error) {
    console.warn('[challengeEngine] Failed to emit challenge-updated event:', error);
  }
}

const WORKOUT_THEME_LABELS: Record<Workout['type'], string> = {
  easy: 'Easy Run',
  tempo: 'Tempo Session',
  intervals: 'Intervals',
  long: 'Long Run',
  'time-trial': 'Time Trial',
  hill: 'Hill Repeats',
  rest: 'Active Recovery',
  'race-pace': 'Race Pace Session',
  recovery: 'Recovery Run',
  fartlek: 'Fartlek',
};

function normalizeToDay(dateValue: Date | string | number | null | undefined): Date | null {
  if (!dateValue) return null;
  const date = dateValue instanceof Date ? new Date(dateValue) : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function choosePrimaryWorkoutForDay(workouts: Workout[]): Workout | null {
  if (workouts.length === 0) return null;

  const sorted = [...workouts].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    return (a.id ?? 0) - (b.id ?? 0);
  });

  return sorted[0] ?? null;
}

function getTemplateDayTheme(currentDay: number, template: ChallengeTemplate): string {
  return currentDay <= template.dailyThemes.length
    ? template.dailyThemes[currentDay - 1] ?? `Day ${currentDay}: Keep going!`
    : `Day ${currentDay}: Bonus day!`;
}

async function getPlannedWorkoutDayTheme(progress: ChallengeProgress, challengeDay: number): Promise<string | null> {
  if (!progress.planId) return null;

  const startDate = normalizeToDay(progress.startDate);
  if (!startDate) return null;

  const challengeDate = new Date(startDate);
  challengeDate.setDate(challengeDate.getDate() + Math.max(0, challengeDay - 1));
  const challengeDateKey = getDateKey(challengeDate);

  const planWorkouts = await db.workouts.where('planId').equals(progress.planId).toArray();
  const sameDayWorkouts = planWorkouts.filter((workout) => {
    const normalized = normalizeToDay(workout.scheduledDate);
    return normalized ? getDateKey(normalized) === challengeDateKey : false;
  });

  const primaryWorkout = choosePrimaryWorkoutForDay(sameDayWorkouts);
  if (!primaryWorkout) return null;

  const workoutLabel = WORKOUT_THEME_LABELS[primaryWorkout.type] ?? primaryWorkout.type;
  return `Day ${challengeDay}: ${workoutLabel}`;
}

/**
 * Calculate current day in challenge based on start date
 */
export function calculateChallengeDay(startDate: Date, now: Date = new Date()): number {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const current = new Date(now);
  current.setHours(0, 0, 0, 0);

  const daysDiff = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, daysDiff + 1); // Day 1 is the start date
}

/**
 * Check if challenge is complete
 */
export function isChallengeComplete(currentDay: number, totalDays: number): boolean {
  return currentDay > totalDays;
}

/**
 * Get challenge progress percentage
 */
export function getChallengeProgress(currentDay: number, totalDays: number): number {
  if (currentDay >= totalDays) return 100;
  return Math.min(100, Math.max(0, (currentDay / totalDays) * 100));
}

/**
 * Get daily challenge data for display
 */
export async function getDailyChallengeData(
  progress: ChallengeProgress,
  template: ChallengeTemplate
): Promise<DailyChallengeData> {
  const currentDay = calculateChallengeDay(progress.startDate);
  const totalDays = template.durationDays;
  const progressPercent = getChallengeProgress(currentDay, totalDays);
  const isLastDay = currentDay === totalDays;
  const daysRemaining = Math.max(0, totalDays - currentDay);

  // Prefer the actual workout scheduled in the challenge plan for this day.
  // Fall back to template themes when a workout isn't available.
  const dayTheme =
    (await getPlannedWorkoutDayTheme(progress, currentDay)) ??
    getTemplateDayTheme(currentDay, template);

  return {
    currentDay: Math.min(currentDay, totalDays),
    totalDays,
    dayTheme,
    progress: Math.round(progressPercent),
    isLastDay,
    daysRemaining,
    streakDays: progress.streakDays,
  };
}

/**
 * Get user's active challenge (if any)
 */
export async function getActiveChallenge(userId: number): Promise<{
  progress: ChallengeProgress;
  template: ChallengeTemplate;
  dailyData: DailyChallengeData;
} | null> {
  try {
    // Get active challenge progress
    const progress = await db.challengeProgress
      .where('[userId+status]')
      .equals([userId, 'active'])
      .first();

    if (!progress) return null;

    // Get challenge template
    const template = await db.challengeTemplates.get(progress.challengeTemplateId);
    if (!template) return null;

    const currentDay = calculateChallengeDay(progress.startDate);
    if (isChallengeComplete(currentDay, template.durationDays)) {
      await completeChallengeAutomatically(progress, template);
      return null;
    }

    // Get daily data
    const dailyData = await getDailyChallengeData(progress, template);

    return {
      progress,
      template,
      dailyData,
    };
  } catch (error) {
    console.error('[challengeEngine] Error getting active challenge:', error);
    return null;
  }
}

/**
 * Start a new challenge for a user
 */
export async function startChallenge(
  userId: number,
  challengeTemplateId: number | string,
  planId: number,
  startDate: Date = new Date()
): Promise<ChallengeProgress> {
  try {
    let resolvedTemplateId: number | null =
      typeof challengeTemplateId === 'number' ? challengeTemplateId : null;

    if (typeof challengeTemplateId === 'string') {
      const template = await db.challengeTemplates.where('slug').equals(challengeTemplateId).first();
      if (!template?.id) {
        throw new Error(`Challenge template not found for slug: ${challengeTemplateId}`);
      }
      resolvedTemplateId = template.id;
    }

    if (!resolvedTemplateId) {
      throw new Error('Challenge template id is required to start a challenge');
    }

    // Deactivate any existing active challenges
    const existingActive = await db.challengeProgress
      .where('[userId+status]')
      .equals([userId, 'active'])
      .toArray();

    for (const existing of existingActive) {
      await db.challengeProgress.update(existing.id!, {
        status: 'abandoned',
        updatedAt: new Date(),
      });
    }

    // Deactivate ALL existing active plans for this user
    await db.plans
      .where('userId')
      .equals(userId)
      .and(plan => plan.isActive)
      .modify({ isActive: false, updatedAt: new Date() });

    console.log(`[challengeEngine] Deactivated all active plans for user ${userId}`);

    // Create new challenge progress
    const progressId = await db.challengeProgress.add({
      userId,
      challengeTemplateId: resolvedTemplateId,
      planId,
      startDate,
      currentDay: 1,
      status: 'active',
      streakDays: 0,
      totalDaysCompleted: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      await db.plans.update(planId, {
        isActive: true,
        isChallenge: true,
        challengeTemplateId: resolvedTemplateId,
        updatedAt: new Date(),
      });
    } catch (planUpdateError) {
      console.warn('[challengeEngine] Failed to tag plan as challenge:', planUpdateError);
    }

    const progress = await db.challengeProgress.get(progressId);
    if (!progress) throw new Error('Failed to create challenge progress');

    emitChallengeUpdated(userId);

    return progress;
  } catch (error) {
    console.error('[challengeEngine] Error starting challenge:', error);
    throw error;
  }
}

/**
 * Update challenge progress when workout is completed
 */
export async function updateChallengeOnWorkoutComplete(
  progressId: number,
  workoutDate: Date = new Date()
): Promise<void> {
  try {
    const progress = await db.challengeProgress.get(progressId);
    if (!progress) return;

    const template = await db.challengeTemplates.get(progress.challengeTemplateId);
    if (!template) return;

    // Calculate current day
    const currentDay = calculateChallengeDay(progress.startDate, workoutDate);

    // Update streak (simplified - assumes consecutive days)
    const newStreakDays = progress.streakDays + 1;
    const newTotalDaysCompleted = progress.totalDaysCompleted + 1;

    await db.challengeProgress.update(progressId, {
      currentDay,
      streakDays: newStreakDays,
      totalDaysCompleted: newTotalDaysCompleted,
      lastPromptShownAt: workoutDate,
      updatedAt: new Date(),
    });

    // Check if challenge is complete
    if (currentDay >= template.durationDays) {
      await completeChallenge(progressId);
    }

    emitChallengeUpdated(progress.userId);
  } catch (error) {
    console.error('[challengeEngine] Error updating challenge progress:', error);
  }
}

/**
 * Complete a challenge
 */
export async function completeChallenge(progressId: number): Promise<void> {
  try {
    const progress = await db.challengeProgress.get(progressId);
    if (!progress) return;

    const template = await db.challengeTemplates.get(progress.challengeTemplateId);
    if (!template) return;

    // Get next challenge recommendation
    const nextChallenge = getNextChallengeRecommendation(template.slug);

    await db.challengeProgress.update(progressId, {
      status: 'completed',
      completedAt: new Date(),
      nextChallengeRecommended: nextChallenge?.id,
      updatedAt: new Date(),
    });

    console.log(`[challengeEngine] Challenge completed: ${template.name}`);
    emitChallengeUpdated(progress.userId);
  } catch (error) {
    console.error('[challengeEngine] Error completing challenge:', error);
  }
}

/**
 * Auto-complete challenge if it's past the end date
 */
async function completeChallengeAutomatically(
  progress: ChallengeProgress,
  template: ChallengeTemplate
): Promise<void> {
  if (progress.status === 'completed') return;

  console.log('[challengeEngine] Auto-completing expired challenge:', template.name);
  await completeChallenge(progress.id!);
}

/**
 * Get challenge history for a user
 */
export async function getChallengeHistory(
  userId: number
): Promise<Array<{ progress: ChallengeProgress; template: ChallengeTemplate }>> {
  try {
    const allProgress = await db.challengeProgress
      .where('userId')
      .equals(userId)
      .reverse()
      .sortBy('createdAt');

    const history = [];
    for (const progress of allProgress) {
      const template = await db.challengeTemplates.get(progress.challengeTemplateId);
      if (template) {
        history.push({ progress, template });
      }
    }

    return history;
  } catch (error) {
    console.error('[challengeEngine] Error getting challenge history:', error);
    return [];
  }
}

/**
 * Get challenge completion count for a user
 */
export async function getCompletedChallengeCount(userId: number): Promise<number> {
  try {
    return await db.challengeProgress
      .where('[userId+status]')
      .equals([userId, 'completed'])
      .count();
  } catch (error) {
    console.error('[challengeEngine] Error getting completed challenge count:', error);
    return 0;
  }
}

/**
 * Abandon current challenge
 */
export async function abandonChallenge(progressId: number): Promise<void> {
  try {
    const progress = await db.challengeProgress.get(progressId);
    await db.challengeProgress.update(progressId, {
      status: 'abandoned',
      updatedAt: new Date(),
    });
    if (progress?.userId) {
      emitChallengeUpdated(progress.userId);
    }
  } catch (error) {
    console.error('[challengeEngine] Error abandoning challenge:', error);
  }
}
