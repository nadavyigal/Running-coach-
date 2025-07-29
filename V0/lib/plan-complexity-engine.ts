import { getCurrentUser, getUserRuns, getPlanWorkouts } from './dbUtils';
import { type Plan, type User, type Run, type Workout } from './db';

// Plan Complexity Engine Schema
export interface PlanComplexityEngine {
  userExperience: 'beginner' | 'intermediate' | 'advanced';
  planLevel: 'basic' | 'standard' | 'advanced';
  adaptationFactors: AdaptationFactor[];
  complexityScore: number; // 0-100
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
  feedbackType: 'difficulty' | 'enjoyment' | 'completion' | 'suggestion';
  rating: number; // 1-5 scale
  comment?: string;
  createdAt: Date;
}

export class PlanComplexityEngineService {
  /**
   * Calculate plan complexity score based on user experience and performance
   */
  async calculatePlanComplexity(userId: number, plan: Plan): Promise<PlanComplexityEngine> {
    try {
      const user = await getCurrentUser();
      if (!user) {
        throw new Error('User not found');
      }

      // Get user's recent performance data
      const recentRuns = await getUserRuns(userId);
      const recentWorkouts = await getPlanWorkouts(plan.id!);
      
      // Calculate adaptation factors
      const adaptationFactors = await this.calculateAdaptationFactors(user, recentRuns, recentWorkouts);
      
      // Calculate complexity score
      const complexityScore = this.calculateComplexityScore(user.experience, adaptationFactors);
      
      // Determine plan level based on complexity
      const planLevel = this.determinePlanLevel(complexityScore);
      
      return {
        userExperience: user.experience,
        planLevel,
        adaptationFactors,
        complexityScore
      };
    } catch (error) {
      console.error('Error calculating plan complexity:', error);
      // Return default complexity for error cases
      return {
        userExperience: 'beginner',
        planLevel: 'basic',
        adaptationFactors: [],
        complexityScore: 30
      };
    }
  }

  /**
   * Calculate adaptation factors based on user performance and feedback
   */
  private async calculateAdaptationFactors(
    user: User, 
    recentRuns: Run[], 
    recentWorkouts: Workout[]
  ): Promise<AdaptationFactor[]> {
    const factors: AdaptationFactor[] = [];

    // Performance factor
    const performanceFactor = this.calculatePerformanceFactor(recentRuns);
    factors.push(performanceFactor);

    // Consistency factor
    const consistencyFactor = this.calculateConsistencyFactor(recentWorkouts);
    factors.push(consistencyFactor);

    // Goals factor
    const goalsFactor = this.calculateGoalsFactor(user);
    factors.push(goalsFactor);

    // Feedback factor (placeholder - would integrate with feedback system)
    const feedbackFactor: AdaptationFactor = {
      factor: 'feedback',
      weight: 0.2,
      currentValue: 3, // Default neutral rating
      targetValue: 4
    };
    factors.push(feedbackFactor);

    return factors;
  }

  /**
   * Calculate performance factor based on recent runs
   */
  private calculatePerformanceFactor(recentRuns: Run[]): AdaptationFactor {
    if (recentRuns.length === 0) {
      return {
        factor: 'performance',
        weight: 0.3,
        currentValue: 0,
        targetValue: 5
      };
    }

    // Calculate average pace improvement over last 5 runs
    const lastFiveRuns = recentRuns.slice(-5);
    let paceImprovement = 0;

    if (lastFiveRuns.length >= 2) {
      const firstRun = lastFiveRuns[0];
      const lastRun = lastFiveRuns[lastFiveRuns.length - 1];
      
      if (firstRun.pace && lastRun.pace) {
        paceImprovement = (firstRun.pace - lastRun.pace) / firstRun.pace * 100;
      }
    }

    // Normalize to 0-10 scale
    const performanceValue = Math.max(0, Math.min(10, (paceImprovement + 10) / 2));

    return {
      factor: 'performance',
      weight: 0.3,
      currentValue: performanceValue,
      targetValue: 7
    };
  }

  /**
   * Calculate consistency factor based on workout completion
   */
  private calculateConsistencyFactor(recentWorkouts: Workout[]): AdaptationFactor {
    if (recentWorkouts.length === 0) {
      return {
        factor: 'consistency',
        weight: 0.25,
        currentValue: 0,
        targetValue: 8
      };
    }

    // Calculate completion rate for last 4 weeks
    const lastFourWeeks = recentWorkouts.filter(w => {
      const workoutDate = new Date(w.scheduledDate);
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      return workoutDate >= fourWeeksAgo;
    });

    const completedWorkouts = lastFourWeeks.filter(w => w.completed);
    const completionRate = lastFourWeeks.length > 0 ? 
      (completedWorkouts.length / lastFourWeeks.length) * 10 : 0;

    return {
      factor: 'consistency',
      weight: 0.25,
      currentValue: completionRate,
      targetValue: 8
    };
  }

  /**
   * Calculate goals factor based on user goals and experience
   */
  private calculateGoalsFactor(user: User): AdaptationFactor {
    let goalComplexity = 5; // Default middle value

    // Adjust based on user experience
    switch (user.experience) {
      case 'beginner':
        goalComplexity = 3;
        break;
      case 'intermediate':
        goalComplexity = 6;
        break;
      case 'advanced':
        goalComplexity = 8;
        break;
    }

    // Adjust based on goal type
    switch (user.goal) {
      case 'habit':
        goalComplexity -= 1;
        break;
      case 'distance':
        goalComplexity += 1;
        break;
      case 'speed':
        goalComplexity += 2;
        break;
    }

    return {
      factor: 'goals',
      weight: 0.25,
      currentValue: goalComplexity,
      targetValue: 7
    };
  }

  /**
   * Calculate overall complexity score
   */
  private calculateComplexityScore(
    userExperience: string, 
    adaptationFactors: AdaptationFactor[]
  ): number {
    let baseScore = 30; // Base complexity score

    // Adjust base score by experience level
    switch (userExperience) {
      case 'beginner':
        baseScore = 25;
        break;
      case 'intermediate':
        baseScore = 50;
        break;
      case 'advanced':
        baseScore = 75;
        break;
    }

    // Calculate weighted score from adaptation factors
    let weightedScore = 0;
    let totalWeight = 0;

    adaptationFactors.forEach(factor => {
      const factorScore = (factor.currentValue / factor.targetValue) * 100;
      weightedScore += factorScore * factor.weight;
      totalWeight += factor.weight;
    });

    const adaptationScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    
    // Combine base score with adaptation score
    const finalScore = Math.round((baseScore * 0.6) + (adaptationScore * 0.4));
    
    return Math.max(0, Math.min(100, finalScore));
  }

  /**
   * Determine plan level based on complexity score
   */
  private determinePlanLevel(complexityScore: number): 'basic' | 'standard' | 'advanced' {
    if (complexityScore < 40) {
      return 'basic';
    } else if (complexityScore < 70) {
      return 'standard';
    } else {
      return 'advanced';
    }
  }

  /**
   * Get complexity level description
   */
  getComplexityDescription(complexityScore: number): string {
    if (complexityScore < 30) {
      return 'Very Easy - Perfect for building habits';
    } else if (complexityScore < 50) {
      return 'Easy - Good for beginners';
    } else if (complexityScore < 70) {
      return 'Moderate - Balanced challenge';
    } else if (complexityScore < 85) {
      return 'Challenging - For experienced runners';
    } else {
      return 'Advanced - High intensity training';
    }
  }

  /**
   * Get complexity color for UI
   */
  getComplexityColor(complexityScore: number): string {
    if (complexityScore < 30) {
      return 'text-green-600 bg-green-100';
    } else if (complexityScore < 50) {
      return 'text-blue-600 bg-blue-100';
    } else if (complexityScore < 70) {
      return 'text-yellow-600 bg-yellow-100';
    } else if (complexityScore < 85) {
      return 'text-orange-600 bg-orange-100';
    } else {
      return 'text-red-600 bg-red-100';
    }
  }

  /**
   * Suggest plan adjustments based on complexity
   */
  async suggestPlanAdjustments(
    userId: number, 
    plan: Plan, 
    complexity: PlanComplexityEngine
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Check if plan is too complex for user
    if (complexity.complexityScore > 80 && complexity.userExperience === 'beginner') {
      suggestions.push('Consider reducing workout intensity to build confidence');
    }

    // Check if plan is too easy for user
    if (complexity.complexityScore < 30 && complexity.userExperience === 'advanced') {
      suggestions.push('You may benefit from more challenging workouts');
    }

    // Check consistency issues
    const consistencyFactor = complexity.adaptationFactors.find(f => f.factor === 'consistency');
    if (consistencyFactor && consistencyFactor.currentValue < 5) {
      suggestions.push('Focus on completing more workouts to build consistency');
    }

    // Check performance trends
    const performanceFactor = complexity.adaptationFactors.find(f => f.factor === 'performance');
    if (performanceFactor && performanceFactor.currentValue < 4) {
      suggestions.push('Consider adding more recovery days to improve performance');
    }

    return suggestions;
  }
}

// Export singleton instance
export const planComplexityEngine = new PlanComplexityEngineService();