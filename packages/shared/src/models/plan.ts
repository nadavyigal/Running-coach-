/**
 * Training Plan and Workout Models
 *
 * Structures for training plans, workouts, periodization, and race goals.
 */

export interface RaceGoal {
  id?: number;
  userId: number;
  raceName: string;
  raceDate: Date;
  distance: number;
  targetTime?: number;
  priority: 'A' | 'B' | 'C';
  location?: string;
  raceType: 'road' | 'trail' | 'track' | 'virtual';
  elevationGain?: number;
  courseDifficulty?: 'easy' | 'moderate' | 'hard';
  registrationStatus?: 'registered' | 'planned' | 'completed';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkoutTemplate {
  id?: number;
  name: string;
  workoutType: 'easy' | 'tempo' | 'intervals' | 'long' | 'race-pace' | 'recovery' | 'time-trial' | 'hill' | 'fartlek';
  trainingPhase: 'base' | 'build' | 'peak' | 'taper';
  intensityZone: 'easy' | 'moderate' | 'threshold' | 'vo2max' | 'anaerobic';
  structure: any;
  description: string;
  coachingNotes?: string;
  createdAt: Date;
}

export interface PeriodizationPhase {
  phase: 'base' | 'build' | 'peak' | 'taper';
  duration: number;
  weeklyVolumePercentage: number;
  intensityDistribution: {
    easy: number;
    moderate: number;
    hard: number;
  };
  keyWorkouts: string[];
  focus: string;
}

export interface AdaptationFactor {
  factor: 'performance' | 'feedback' | 'consistency' | 'goals';
  weight: number;
  currentValue: number;
  targetValue: number;
}

export interface PlanFeedback {
  id?: number;
  planId: number;
  userId: number;
  feedbackType?: 'difficulty' | 'enjoyment' | 'completion' | 'suggestion';
  rating: number;
  comment?: string;
  createdAt: Date;
}

export interface Plan {
  id?: number;
  userId: number;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  totalWeeks: number;
  isActive: boolean;
  planType: 'basic' | 'advanced' | 'periodized';
  raceGoalId?: number;
  periodization?: PeriodizationPhase[];
  targetDistance?: number;
  targetTime?: number;
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
  trainingDaysPerWeek?: number;
  peakWeeklyVolume?: number;

  // Progressive complexity
  complexityLevel?: 'basic' | 'standard' | 'advanced';
  complexityScore?: number;
  lastComplexityUpdate?: Date;
  adaptationFactors?: AdaptationFactor[];
  userFeedback?: PlanFeedback[];

  goalId?: number;

  // Challenge-specific fields
  isChallenge?: boolean;
  challengeTemplateId?: number;
  challengeConfig?: {
    dailyPromptsBefore: string[];
    dailyPromptsDuring: string[];
    dailyPromptsAfter: string[];
    microLessons: string[];
    progressionArc: string;
    coachTone: 'gentle' | 'tough_love' | 'analytical' | 'calm';
  };

  createdInTimezone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Workout {
  id?: number;
  planId: number;
  week: number;
  day: string;
  type: 'easy' | 'tempo' | 'intervals' | 'long' | 'time-trial' | 'hill' | 'rest' | 'race-pace' | 'recovery' | 'fartlek';
  distance: number;
  actualDistanceKm?: number;
  duration?: number;
  pace?: number;
  actualDurationMinutes?: number;
  actualPace?: number;
  intensity?: 'easy' | 'moderate' | 'threshold' | 'vo2max' | 'anaerobic';
  trainingPhase?: 'base' | 'build' | 'peak' | 'taper';
  workoutStructure?: any;
  notes?: string;
  completedAt?: Date;
  completed: boolean;
  scheduledDate: Date;
  createdAt: Date;
  updatedAt: Date;
}
