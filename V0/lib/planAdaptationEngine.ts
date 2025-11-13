import { type User, type Plan, type Run, type Goal } from './db';
import { dbUtils } from './dbUtils';

export interface UserContext {
  goal: 'habit' | 'distance' | 'speed';
  experience: 'beginner' | 'intermediate' | 'advanced';
  daysPerWeek: number;
  preferredTimes: string[];
  age?: number;
  motivations: string[];
  barriers: string[];
  coachingStyle: 'supportive' | 'challenging' | 'analytical' | 'encouraging';
}

export interface AdaptationAssessment {
  shouldAdapt: boolean;
  reason: string;
  adaptationType: 'progressive' | 'regressive' | 'maintenance';
  confidence: number; // 0-100
  recommendedChanges: string[];
}

export interface AdaptationTrigger {
  type: 'completion' | 'goal_update' | 'feedback' | 'manual';
  data?: any;
  timestamp: Date;
}

export class PlanAdaptationEngine {
  /**
   * Assesses whether a user's plan should be adapted based on recent activity
   * 
   * @param userId - User ID to assess
   * @returns Promise<AdaptationAssessment> Assessment of whether adaptation is needed
   */
  async shouldAdaptPlan(userId: number): Promise<AdaptationAssessment> {
    try {
      // Get user context
      const user = await dbUtils.getCurrentUser();
      if (!user) {
        return {
          shouldAdapt: false,
          reason: 'User not found',
          adaptationType: 'maintenance',
          confidence: 0,
          recommendedChanges: []
        };
      }

      // Get recent runs (last 2 weeks)
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const recentRuns = await dbUtils.getRunsInTimeRange(userId, twoWeeksAgo, new Date());

      // Get current goals
      const currentGoals = await dbUtils.getGoalsByUser(userId, 'active');

      // Get current plan
      const currentPlan = await dbUtils.getActivePlan(userId);

      // Analyze completion patterns
      const completionAnalysis = this.analyzeCompletionPatterns(recentRuns, currentPlan);
      
      // Analyze goal progress
      const goalAnalysis = this.analyzeGoalProgress(currentGoals, recentRuns);
      
      // Analyze performance trends
      const performanceAnalysis = this.analyzePerformanceTrends(recentRuns);

      // Determine adaptation type and confidence
      const assessment = this.determineAdaptationType(
        completionAnalysis,
        goalAnalysis,
        performanceAnalysis,
        user
      );

      return assessment;

    } catch (error) {
      console.error('Error assessing plan adaptation:', error);
      return {
        shouldAdapt: false,
        reason: 'Error assessing adaptation',
        adaptationType: 'maintenance',
        confidence: 0,
        recommendedChanges: []
      };
    }
  }

  /**
   * Adapts an existing plan based on assessment results
   * 
   * @param planId - ID of the plan to adapt
   * @param adaptationReason - Reason for adaptation
   * @returns Promise<Plan> The adapted plan
   */
  async adaptExistingPlan(planId: number, adaptationReason: string): Promise<Plan> {
    try {
      // Get current plan
      const currentPlan = await dbUtils.getPlan(planId);
      if (!currentPlan) {
        throw new Error('Plan not found');
      }

      // Get user context
      const user = await dbUtils.getCurrentUser();
      if (!user) {
        throw new Error('User not found');
      }

      // Generate personalized prompt for adaptation
      const personalizedPrompt = await this.generatePersonalizedPrompt(user);

      // Call the enhanced plan generation API
      const response = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          userContext: {
            goal: user.goal,
            experience: user.experience,
            daysPerWeek: user.daysPerWeek,
            preferredTimes: user.preferredTimes,
            age: user.age,
            motivations: user.motivations || [],
            barriers: user.barriers || [],
            coachingStyle: user.coachingStyle || 'supportive'
          },
          adaptationTrigger: 'completion',
          recentRuns: await this.getRecentRunsForAdaptation(user.id!),
          currentGoals: await this.getCurrentGoalsForAdaptation(user.id!)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate adapted plan');
      }

      const { plan } = await response.json();

      // Create new adapted plan
      const adaptedPlanData = {
        ...currentPlan,
        title: `${currentPlan.title} (Adapted)`,
        description: `${currentPlan.description} - Adapted based on: ${adaptationReason}`,
        isActive: true
      };

      // Deactivate old plan
      await dbUtils.updatePlan(planId, { isActive: false });

      // Create new plan
      const newPlanId = await dbUtils.createPlan(adaptedPlanData);

      // Create workouts for the new plan
      for (const workout of plan.workouts) {
        await dbUtils.createWorkout({
          planId: newPlanId,
          week: workout.week,
          day: workout.day,
          type: workout.type,
          distance: workout.distance,
          duration: workout.duration,
          notes: workout.notes,
          completed: false,
          scheduledDate: new Date(), // Will be calculated based on plan start date
          createdAt: new Date()
        });
      }

      return await dbUtils.getPlan(newPlanId) as Plan;

    } catch (error) {
      console.error('Error adapting plan:', error);
      throw error;
    }
  }

  /**
   * Generates a personalized prompt based on user context
   * 
   * @param userContext - User context from onboarding data
   * @returns Promise<string> Personalized prompt for plan generation
   */
  async generatePersonalizedPrompt(userContext: UserContext): Promise<string> {
    const { goal, experience, motivations, barriers, coachingStyle } = userContext;

    const prompt = `Create a personalized running plan for a ${experience} runner with the following characteristics:

**Goals & Motivations:**
- Primary Goal: ${goal}
- Motivations: ${motivations.join(', ')}
- Barriers: ${barriers.join(', ')}

**Coaching Style:**
- Preferred Style: ${coachingStyle}
- Tone: ${this.getCoachingTone(coachingStyle)}
- Detail Level: ${this.getDetailLevel(coachingStyle)}

**Requirements:**
- Address specific barriers: ${barriers.join(', ')}
- Align with motivations: ${motivations.join(', ')}
- Use ${coachingStyle} coaching approach
- Progressive difficulty based on experience level
- Include motivational notes that address barriers
- Consider user's specific challenges and preferences

Generate a plan that will help this runner overcome their barriers and achieve their goals.`;

    return prompt;
  }

  /**
   * Analyzes completion patterns to determine adaptation needs
   * 
   * @param recentRuns - Recent run data
   * @param currentPlan - Current active plan
   * @returns Object with completion analysis
   */
  private analyzeCompletionPatterns(recentRuns: Run[], currentPlan: Plan | undefined) {
    if (!currentPlan) {
      return { completionRate: 0, missedWorkouts: 0, trend: 'unknown' };
    }

    // Calculate completion rate
    const totalWorkouts = recentRuns.length;
    const completedWorkouts = recentRuns.filter(run => run.workoutId).length;
    const completionRate = totalWorkouts > 0 ? completedWorkouts / totalWorkouts : 0;

    // Determine trend
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentRuns.length >= 4) {
      const firstHalf = recentRuns.slice(0, Math.floor(recentRuns.length / 2));
      const secondHalf = recentRuns.slice(Math.floor(recentRuns.length / 2));
      const firstHalfCompletion = firstHalf.filter(run => run.workoutId).length / firstHalf.length;
      const secondHalfCompletion = secondHalf.filter(run => run.workoutId).length / secondHalf.length;
      
      if (secondHalfCompletion > firstHalfCompletion + 0.1) trend = 'improving';
      else if (secondHalfCompletion < firstHalfCompletion - 0.1) trend = 'declining';
    }

    return {
      completionRate,
      missedWorkouts: totalWorkouts - completedWorkouts,
      trend
    };
  }

  /**
   * Analyzes goal progress to determine adaptation needs
   * 
   * @param currentGoals - Current active goals
   * @param recentRuns - Recent run data
   * @returns Object with goal analysis
   */
  private analyzeGoalProgress(currentGoals: Goal[], recentRuns: Run[]) {
    if (currentGoals.length === 0) {
      return { averageProgress: 0, goalsBehind: 0, goalsAhead: 0 };
    }

    const goalProgress = currentGoals.map(goal => {
      const progress = goal.currentValue / goal.targetValue;
      return { goal, progress, isBehind: progress < 0.5 };
    });

    const averageProgress = goalProgress.reduce((sum, gp) => sum + gp.progress, 0) / goalProgress.length;
    const goalsBehind = goalProgress.filter(gp => gp.isBehind).length;
    const goalsAhead = goalProgress.filter(gp => gp.progress > 0.8).length;

    return {
      averageProgress,
      goalsBehind,
      goalsAhead
    };
  }

  /**
   * Analyzes performance trends to determine adaptation needs
   * 
   * @param recentRuns - Recent run data
   * @returns Object with performance analysis
   */
  private analyzePerformanceTrends(recentRuns: Run[]) {
    if (recentRuns.length < 3) {
      return { trend: 'insufficient_data', averagePace: 0, consistency: 0 };
    }

    // Calculate average pace trend
    const paces = recentRuns.map(run => run.pace || 0).filter(pace => pace > 0);
    if (paces.length < 2) {
      return { trend: 'insufficient_data', averagePace: 0, consistency: 0 };
    }

    const firstHalf = paces.slice(0, Math.floor(paces.length / 2));
    const secondHalf = paces.slice(Math.floor(paces.length / 2));
    const firstHalfAvg = firstHalf.reduce((sum, pace) => sum + pace, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, pace) => sum + pace, 0) / secondHalf.length;

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (secondHalfAvg < firstHalfAvg - 30) trend = 'improving'; // Faster pace
    else if (secondHalfAvg > firstHalfAvg + 30) trend = 'declining'; // Slower pace

    // Calculate consistency (lower variance = more consistent)
    const averagePace = paces.reduce((sum, pace) => sum + pace, 0) / paces.length;
    const variance = paces.reduce((sum, pace) => sum + Math.pow(pace - averagePace, 2), 0) / paces.length;
    const consistency = Math.max(0, 100 - Math.sqrt(variance) / 10); // Normalize to 0-100

    return {
      trend,
      averagePace,
      consistency
    };
  }

  /**
   * Determines the type of adaptation needed based on analysis
   * 
   * @param completionAnalysis - Completion pattern analysis
   * @param goalAnalysis - Goal progress analysis
   * @param performanceAnalysis - Performance trend analysis
   * @param user - User data
   * @returns AdaptationAssessment
   */
  private determineAdaptationType(
    completionAnalysis: any,
    goalAnalysis: any,
    performanceAnalysis: any,
    user: User
  ): AdaptationAssessment {
    let shouldAdapt = false;
    let reason = '';
    let adaptationType: 'progressive' | 'regressive' | 'maintenance' = 'maintenance';
    let confidence = 0;
    const recommendedChanges: string[] = [];

    // Check for completion issues
    if (completionAnalysis.completionRate < 0.6) {
      shouldAdapt = true;
      reason = 'Low completion rate indicates plan may be too challenging';
      adaptationType = 'regressive';
      confidence = 80;
      recommendedChanges.push('Reduce workout intensity or frequency');
    }

    // Check for goal progress issues
    if (goalAnalysis.goalsBehind > goalAnalysis.goalsAhead) {
      shouldAdapt = true;
      reason = 'Goals are behind schedule';
      adaptationType = 'regressive';
      confidence = Math.max(confidence, 70);
      recommendedChanges.push('Adjust goal timelines or reduce difficulty');
    }

    // Check for performance improvements
    if (performanceAnalysis.trend === 'improving' && completionAnalysis.trend === 'improving') {
      shouldAdapt = true;
      reason = 'Consistent improvement suggests readiness for progression';
      adaptationType = 'progressive';
      confidence = Math.max(confidence, 75);
      recommendedChanges.push('Increase workout intensity or volume');
    }

    // Check for performance decline
    if (performanceAnalysis.trend === 'declining' && completionAnalysis.trend === 'declining') {
      shouldAdapt = true;
      reason = 'Performance decline suggests overtraining or injury risk';
      adaptationType = 'regressive';
      confidence = Math.max(confidence, 85);
      recommendedChanges.push('Reduce intensity and add recovery days');
    }

    // Consider user experience level
    if (user.experience === 'beginner' && completionAnalysis.completionRate < 0.8) {
      shouldAdapt = true;
      reason = 'Beginner struggling with current plan';
      adaptationType = 'regressive';
      confidence = Math.max(confidence, 90);
      recommendedChanges.push('Simplify workouts and add more rest days');
    }

    return {
      shouldAdapt,
      reason,
      adaptationType,
      confidence,
      recommendedChanges
    };
  }

  /**
   * Gets coaching tone based on coaching style
   * 
   * @param coachingStyle - User's preferred coaching style
   * @returns Appropriate tone for the coaching style
   */
  private getCoachingTone(coachingStyle: string): string {
    switch (coachingStyle) {
      case 'supportive':
        return 'Encouraging and gentle';
      case 'challenging':
        return 'Motivational and pushing';
      case 'analytical':
        return 'Factual and detailed';
      case 'encouraging':
        return 'Positive and uplifting';
      default:
        return 'Balanced and supportive';
    }
  }

  /**
   * Gets detail level based on coaching style
   * 
   * @param coachingStyle - User's preferred coaching style
   * @returns Appropriate detail level
   */
  private getDetailLevel(coachingStyle: string): string {
    switch (coachingStyle) {
      case 'analytical':
        return 'High detail with technical explanations';
      case 'supportive':
        return 'Moderate detail with focus on encouragement';
      case 'challenging':
        return 'Moderate detail with motivational elements';
      case 'encouraging':
        return 'Minimal detail with positive reinforcement';
      default:
        return 'Balanced detail level';
    }
  }

  /**
   * Gets recent runs for plan adaptation
   * 
   * @param userId - User ID
   * @returns Promise<Run[]> Recent runs formatted for adaptation
   */
  private async getRecentRunsForAdaptation(userId: number): Promise<Run[]> {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    return await dbUtils.getRunsInTimeRange(userId, twoWeeksAgo, new Date());
  }

  /**
   * Gets current goals for plan adaptation
   * 
   * @param userId - User ID
   * @returns Promise<Goal[]> Current active goals
   */
  private async getCurrentGoalsForAdaptation(userId: number): Promise<Goal[]> {
    return await dbUtils.getGoalsByUser(userId, 'active');
  }
}

// Export singleton instance
export const planAdaptationEngine = new PlanAdaptationEngine(); 