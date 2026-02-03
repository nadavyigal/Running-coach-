import { db, type ChallengeProgress, type ChallengeTemplate, type Plan } from './db';
import { getChallengeTemplateBySlug, getNextChallengeRecommendation } from './challengeTemplates';

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

  // Get day theme (handle array bounds)
  const dayTheme =
    currentDay <= template.dailyThemes.length
      ? template.dailyThemes[currentDay - 1] ?? `Day ${currentDay}: Keep going!`
      : `Day ${currentDay}: Bonus day!`;

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

    // Get daily data
    const dailyData = await getDailyChallengeData(progress, template);

    // Auto-complete if past end date
    if (isChallengeComplete(dailyData.currentDay, dailyData.totalDays)) {
      await completeChallengeAutomatically(progress, template);
      return null;
    }

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
  challengeTemplateId: number,
  planId: number,
  startDate: Date = new Date()
): Promise<ChallengeProgress> {
  try {
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

    // Create new challenge progress
    const progressId = await db.challengeProgress.add({
      userId,
      challengeTemplateId,
      planId,
      startDate,
      currentDay: 1,
      status: 'active',
      streakDays: 0,
      totalDaysCompleted: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const progress = await db.challengeProgress.get(progressId);
    if (!progress) throw new Error('Failed to create challenge progress');

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
    await db.challengeProgress.update(progressId, {
      status: 'abandoned',
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error('[challengeEngine] Error abandoning challenge:', error);
  }
}
