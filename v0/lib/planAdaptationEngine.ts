import { dbUtils } from '@/lib/dbUtils';
import { type User, type Plan, type Run, type Goal } from './db';
import { RecoveryEngine } from './recoveryEngine';

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

interface RecoveryReadinessAnalysis {
  available: boolean;
  score: number | null;
  stressLevel: number | null;
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  delta: number;
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
      const currentGoals = await dbUtils.getUserGoals(userId, 'active');

	      // Get current plan
	      const currentPlan = await dbUtils.getActivePlan(userId);
	 
	      // Analyze completion patterns
	      const completionAnalysis = this.analyzeCompletionPatterns(recentRuns, currentPlan ?? undefined);
      
      // Analyze goal progress
      const goalAnalysis = this.analyzeGoalProgress(currentGoals, recentRuns);
      
      // Analyze performance trends
      const performanceAnalysis = this.analyzePerformanceTrends(recentRuns);

      // Analyze current recovery/readiness (now includes Garmin wellness signals when available)
      const recoveryAnalysis = await this.analyzeRecoveryReadiness(userId);

      // Determine adaptation type and confidence
      const assessment = this.determineAdaptationType(
        completionAnalysis,
        goalAnalysis,
        performanceAnalysis,
        user,
        recoveryAnalysis
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
	      if (!user?.id) {
	        throw new Error('User not found');
	      }

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
	          recentRuns: await this.getRecentRunsForAdaptation(user.id),
	          currentGoals: await this.getCurrentGoalsForAdaptation(user.id)
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
	          completed: false,
	          scheduledDate: new Date(), // Will be calculated based on plan start date
	          ...(typeof workout.duration === 'number' ? { duration: workout.duration } : {}),
	          ...(workout.notes ? { notes: workout.notes } : {}),
	        });
	      }

	      const newPlan = await dbUtils.getPlan(newPlanId)
	      if (!newPlan) throw new Error('Failed to load adapted plan')
	      return newPlan

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
	  private analyzeGoalProgress(currentGoals: Goal[], _recentRuns: Run[]) {
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

  private async analyzeRecoveryReadiness(userId: number): Promise<RecoveryReadinessAnalysis> {
    try {
      const today = new Date();
      let currentScore = await RecoveryEngine.getRecoveryScore(userId, today);
      if (!currentScore) {
        currentScore = await RecoveryEngine.calculateRecoveryScore(userId, today);
      }

      const trends = await RecoveryEngine.getRecoveryTrends(userId, 7);
      if (!currentScore) {
        return {
          available: false,
          score: null,
          stressLevel: null,
          trend: 'insufficient_data',
          delta: 0,
        };
      }

      let trend: RecoveryReadinessAnalysis['trend'] = 'insufficient_data';
      let delta = 0;
      if (trends.length >= 2) {
        const oldest = trends[0];
        const latest = trends[trends.length - 1];
        if (oldest && latest) {
          delta = latest.overallScore - oldest.overallScore;
          if (delta >= 5) trend = 'improving';
          else if (delta <= -5) trend = 'declining';
          else trend = 'stable';
        }
      }

      return {
        available: true,
        score: currentScore.overallScore,
        stressLevel: currentScore.stressLevel,
        trend,
        delta,
      };
    } catch (error) {
      console.warn('[plan-adaptation] Unable to derive recovery readiness:', error);
      return {
        available: false,
        score: null,
        stressLevel: null,
        trend: 'insufficient_data',
        delta: 0,
      };
    }
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
    user: User,
    recoveryAnalysis: RecoveryReadinessAnalysis
  ): AdaptationAssessment {
    let shouldAdapt = false;
    let reason = '';
    let adaptationType: 'progressive' | 'regressive' | 'maintenance' = 'maintenance';
    let confidence = 0;
    const recommendedChanges: string[] = [];

    const pushChange = (change: string) => {
      if (!recommendedChanges.includes(change)) {
        recommendedChanges.push(change);
      }
    };

    const applyDecision = (
      nextType: 'progressive' | 'regressive',
      nextReason: string,
      nextConfidence: number,
      change: string
    ) => {
      shouldAdapt = true;
      pushChange(change);
      if (nextConfidence >= confidence) {
        confidence = nextConfidence;
        adaptationType = nextType;
        reason = nextReason;
      }
    };

    // Check for completion issues
    if (completionAnalysis.completionRate < 0.6) {
      applyDecision(
        'regressive',
        'Low completion rate indicates plan may be too challenging',
        80,
        'Reduce workout intensity or frequency'
      );
    }

    // Check for goal progress issues
    if (goalAnalysis.goalsBehind > goalAnalysis.goalsAhead) {
      applyDecision(
        'regressive',
        'Goals are behind schedule',
        70,
        'Adjust goal timelines or reduce difficulty'
      );
    }

    // Check for performance improvements
    if (performanceAnalysis.trend === 'improving' && completionAnalysis.trend === 'improving') {
      applyDecision(
        'progressive',
        'Consistent improvement suggests readiness for progression',
        75,
        'Increase workout intensity or volume'
      );
    }

    // Check for performance decline
    if (performanceAnalysis.trend === 'declining' && completionAnalysis.trend === 'declining') {
      applyDecision(
        'regressive',
        'Performance decline suggests overtraining or injury risk',
        85,
        'Reduce intensity and add recovery days'
      );
    }

    // Consider user experience level
    if (user.experience === 'beginner' && completionAnalysis.completionRate < 0.8) {
      applyDecision(
        'regressive',
        'Beginner struggling with current plan',
        90,
        'Simplify workouts and add more rest days'
      );
    }

    // Recovery/readiness-aware adaptation (includes Garmin wellness signals in recovery engine).
    if (recoveryAnalysis.available && recoveryAnalysis.score != null) {
      if (recoveryAnalysis.score < 45) {
        applyDecision(
          'regressive',
          `Low readiness score (${recoveryAnalysis.score}/100) indicates elevated recovery risk`,
          92,
          'Replace next hard workout with an easy run or full recovery day'
        );
      } else if (
        recoveryAnalysis.score < 60 &&
        recoveryAnalysis.trend === 'declining'
      ) {
        applyDecision(
          'regressive',
          `Readiness is trending down (${Math.round(recoveryAnalysis.delta)} pts over 7 days)`,
          88,
          'Hold volume steady and reduce intensity for 2-3 sessions'
        );
      } else if (
        recoveryAnalysis.score >= 82 &&
        recoveryAnalysis.trend === 'improving' &&
        completionAnalysis.completionRate >= 0.7 &&
        performanceAnalysis.trend !== 'declining'
      ) {
        applyDecision(
          'progressive',
          'High and improving readiness supports safe progression',
          78,
          'Progress one quality session with a small volume increase'
        );
      }
    }

    if (recoveryAnalysis.available && recoveryAnalysis.stressLevel != null && recoveryAnalysis.stressLevel > 70) {
      applyDecision(
        'regressive',
        `High stress load detected (${recoveryAnalysis.stressLevel}/100)`,
        89,
        'Add mobility, sleep, and low-intensity recovery work before next key session'
      );
    }

    if (!shouldAdapt) {
      reason = 'No significant adaptation trigger detected';
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
    return await dbUtils.getUserGoals(userId, 'active');
  }
}

// Export singleton instance
export const planAdaptationEngine = new PlanAdaptationEngine(); 
