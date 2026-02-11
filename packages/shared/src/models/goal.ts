/**
 * Goal Tracking Models
 *
 * Goal management, milestones, progress tracking, and recommendations.
 */

export interface Goal {
  id?: number;
  userId: number;
  title: string;
  description: string;
  goalType: 'time_improvement' | 'distance_achievement' | 'frequency' | 'race_completion' | 'consistency' | 'health';
  category: 'speed' | 'endurance' | 'consistency' | 'health' | 'strength';
  priority: 1 | 2 | 3;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  specificTarget: {
    metric: string;
    value: number;
    unit: string;
    description?: string;
  };
  measurableMetrics?: string[];
  achievableAssessment?: {
    currentLevel: number;
    targetLevel: number;
    feasibilityScore: number;
    recommendedAdjustments?: string[];
  };
  relevantContext?: string;
  measurableOutcome?: {
    successCriteria: string[];
    trackingMethod: string;
    measurementFrequency: 'daily' | 'weekly' | 'monthly';
  };
  achievabilityAssessment?: {
    difficultyRating: number;
    requiredResources: string[];
    potentialObstacles: string[];
    mitigationStrategies: string[];
  };
  relevanceJustification?: {
    personalImportance: number;
    alignmentWithValues: string;
    motivationalFactors: string[];
  };
  timeBound: {
    startDate: Date;
    deadline: Date;
    milestoneSchedule: number[];
    totalDuration: number;
    estimatedDuration?: number;
  };
  baselineValue: number;
  targetValue: number;
  currentValue: number;
  progressPercentage: number;
  isPrimary?: boolean;
  planId?: number;
  lastUpdated?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalMilestone {
  id?: number;
  goalId: number;
  milestoneOrder: number;
  title: string;
  description: string;
  targetValue: number;
  targetDate: Date;
  status: 'pending' | 'achieved' | 'missed' | 'adjusted';
  achievedDate?: Date;
  achievedValue?: number;
  celebrationShown: boolean;
  createdAt: Date;
}

export interface GoalProgressHistory {
  id?: number;
  goalId: number;
  measurementDate: Date;
  measuredValue: number;
  recordedAt?: Date;
  progressValue?: number;
  progressPercentage: number;
  autoRecorded: boolean;
  contributingActivityId?: number | null;
  contributingActivityType?: string;
  context?: Record<string, unknown>;
  notes?: string;
  createdAt: Date;
}

export interface GoalRecommendation {
  id?: number;
  userId: number;
  recommendationType: 'new_goal' | 'adjustment' | 'milestone' | 'motivation' | 'priority_change';
  title: string;
  description: string;
  reasoning: string;
  confidenceScore: number;
  priority?: 'low' | 'medium' | 'high';
  status: 'pending' | 'accepted' | 'dismissed' | 'expired';
  recommendationData: {
    goalId?: number;
    suggestedChanges?: Record<string, unknown>;
    newGoalTemplate?: Record<string, unknown>;
    actionRequired?: string;
    benefits?: string[];
    risks?: string[];
  };
  expiresAt?: Date;
  validUntil?: Date;
  createdAt: Date;
  updatedAt?: Date;
}
