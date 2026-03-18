/**
 * Challenge System Models
 *
 * Challenge templates and user progress tracking.
 */

export interface ChallengeTemplate {
  id?: number;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  targetAudience: string;
  promise: string;
  durationDays: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: 'habit' | 'mindful' | 'performance' | 'recovery';
  thumbnailUrl?: string;
  previewVideoUrl?: string;
  workoutPattern: string;
  coachTone: 'gentle' | 'tough_love' | 'analytical' | 'calm';
  dailyThemes: string[];
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChallengeProgress {
  id?: number;
  userId: number;
  challengeTemplateId: number;
  planId: number;
  startDate: Date;
  currentDay: number;
  status: 'active' | 'completed' | 'abandoned';
  completedAt?: Date;
  streakDays: number;
  totalDaysCompleted: number;
  lastPromptShownAt?: Date;
  nextChallengeRecommended?: number;
  createdAt: Date;
  updatedAt: Date;
}
