/**
 * Coaching and Adaptive Intelligence Models
 *
 * AI coaching profiles, feedback, interactions, and behavior patterns.
 */

export interface CoachingProfile {
  id?: number;
  userId: number;
  communicationStyle: {
    motivationLevel: 'low' | 'medium' | 'high';
    detailPreference: 'minimal' | 'medium' | 'detailed';
    personalityType: 'analytical' | 'encouraging' | 'direct' | 'supportive';
    preferredTone: 'professional' | 'friendly' | 'enthusiastic' | 'calm';
  };
  feedbackPatterns: {
    averageRating: number;
    commonConcerns: string[];
    responsiveness: 'immediate' | 'delayed' | 'sporadic';
    preferredFeedbackFrequency: 'after_every_workout' | 'weekly' | 'monthly';
  };
  behavioralPatterns: {
    workoutPreferences: {
      preferredDays: string[];
      preferredTimes: string[];
      workoutTypeAffinities: Record<string, number>;
      difficultyPreference: number;
    };
    contextualPatterns: {
      weatherSensitivity: number;
      scheduleFlexibility: number;
      stressResponse: 'reduce_intensity' | 'maintain' | 'increase_focus';
      energyPatterns: Record<string, number>;
    };
  };
  coachingEffectivenessScore: number;
  lastAdaptationDate: Date;
  adaptationHistory: {
    date: Date;
    adaptation: string;
    effectiveness: number;
    reason: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CoachingFeedback {
  id?: number;
  userId: number;
  interactionType: 'workout_recommendation' | 'chat_response' | 'plan_adjustment' | 'motivation' | 'guidance';
  feedbackType: 'rating' | 'text' | 'behavioral' | 'quick_reaction';
  rating?: number;
  aspects?: {
    helpfulness: number;
    relevance: number;
    clarity: number;
    motivation: number;
    accuracy: number;
  };
  feedbackText?: string;
  context: {
    weather?: string;
    timeOfDay?: string;
    userMood?: string;
    recentPerformance?: string;
    situationalFactors?: string[];
  };
  coachingResponseId?: string;
  improvementSuggestions?: string[];
  createdAt: Date;
}

export interface CoachingInteraction {
  id?: number;
  userId: number;
  interactionId: string;
  interactionType: 'chat' | 'recommendation' | 'plan_generation' | 'feedback_response';
  promptUsed: string;
  responseGenerated: string;
  userContext: {
    currentGoals: string[];
    recentActivity: string;
    mood?: string;
    environment?: string;
    timeConstraints?: string;
  };
  adaptationsApplied: string[];
  effectivenessScore?: number;
  userEngagement: {
    responseTime?: number;
    followUpQuestions: number;
    actionTaken: boolean;
  };
  createdAt: Date;
}

export interface UserBehaviorPattern {
  id?: number;
  userId: number;
  patternType: 'workout_preference' | 'schedule_pattern' | 'feedback_style' | 'motivation_response' | 'difficulty_adaptation';
  patternData: {
    pattern: string;
    frequency: number;
    conditions: string[];
    outcomes: Record<string, any>;
  };
  confidenceScore: number;
  lastObserved: Date;
  observationCount: number;
  correlatedPatterns?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id?: number;
  userId: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokenCount?: number;
  aiContext?: string;
  conversationId?: string;
}
