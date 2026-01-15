'use client';

import { Goal, GoalMilestone, GoalProgressHistory } from './db';
import { dbUtils } from '@/lib/dbUtils';

export interface GoalProgress {
  goalId: number;
  currentValue: number;
  targetValue: number;
  baselineValue: number;
  progressPercentage: number;
  trajectory: 'on_track' | 'ahead' | 'behind' | 'at_risk';
  projectedCompletion: Date;
  nextMilestone?: GoalMilestone;
  daysUntilDeadline: number;
  improvementRate: number; // units per day
  recentTrend: 'improving' | 'stable' | 'declining';
}

export interface GoalAnalytics {
  goal: Goal;
  progress: GoalProgress;
  milestones: GoalMilestone[];
  progressHistory: GoalProgressHistory[];
  recommendations: string[];
  insights: {
    strengthAreas: string[];
    improvementAreas: string[];
    riskFactors: string[];
  };
}

export class GoalProgressEngine {
  
  async calculateGoalProgress(goalId: number): Promise<GoalProgress | null> {
    const goal = await dbUtils.getGoal(goalId);
    if (!goal) return null;

    const progressHistory = await dbUtils.getGoalProgressHistory(goalId, 20);
    const milestones = await dbUtils.getGoalMilestones(goalId);
    
    const currentValue = progressHistory.length > 0 ? progressHistory[0].measuredValue : goal.baselineValue;
    const progressPercentage = dbUtils.calculateGoalProgressPercentage(
      goal.baselineValue,
      currentValue,
      goal.targetValue,
      goal.goalType
    );

    const trajectory = this.analyzeTrajectory(goal, progressPercentage, progressHistory);
    const projectedCompletion = this.projectCompletionDate(goal, progressHistory);
    const nextMilestone = this.getNextMilestone(milestones, progressPercentage);
    const daysUntilDeadline = Math.ceil((goal.timeBound.deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    const improvementRate = this.calculateImprovementRate(goal, progressHistory);
    const recentTrend = this.analyzeRecentTrend(progressHistory);

    return {
      goalId,
      currentValue,
      targetValue: goal.targetValue,
      baselineValue: goal.baselineValue,
      progressPercentage,
      trajectory,
      projectedCompletion,
      nextMilestone,
      daysUntilDeadline,
      improvementRate,
      recentTrend
    };
  }

  private analyzeTrajectory(
    goal: Goal, 
    currentProgress: number, 
    progressHistory: GoalProgressHistory[]
  ): GoalProgress['trajectory'] {
    const timeElapsed = this.getTimeElapsedPercentage(goal, progressHistory);
    const expectedProgress = timeElapsed;
    const progressGap = currentProgress - expectedProgress;
    
    // Consider recent trend for trajectory analysis
    const recentTrend = this.analyzeRecentTrend(progressHistory);
    
    if (progressGap >= 30) {
      return 'ahead';
    } else if (progressGap >= -10) {
      return recentTrend === 'declining' ? 'behind' : 'on_track';
    } else if (progressGap >= -30) {
      return 'behind';
    } else {
      return 'at_risk';
    }
  }

  private getTimeElapsedPercentage(goal: Goal, progressHistory: GoalProgressHistory[] = []): number {
    const now = new Date();
    const earliestMeasurement = progressHistory.reduce<Date | null>((earliest, entry) => {
      if (!(entry.measurementDate instanceof Date)) {
        return earliest;
      }
      if (!earliest || entry.measurementDate.getTime() < earliest.getTime()) {
        return entry.measurementDate;
      }
      return earliest;
    }, null);

    const startDate = earliestMeasurement && earliestMeasurement.getTime() < goal.timeBound.startDate.getTime()
      ? earliestMeasurement
      : goal.timeBound.startDate;
    const startTime = startDate.getTime();
    const totalDurationDays = Number.isFinite(goal.timeBound.totalDuration) && goal.timeBound.totalDuration > 0
      ? goal.timeBound.totalDuration
      : null;
    const endTime = totalDurationDays
      ? startTime + totalDurationDays * 24 * 60 * 60 * 1000
      : goal.timeBound.deadline.getTime();
    const currentTime = now.getTime();
    
    if (currentTime <= startTime) return 0;
    if (currentTime >= endTime) return 100;
    
    return ((currentTime - startTime) / (endTime - startTime)) * 100;
  }

  private projectCompletionDate(goal: Goal, progressHistory: GoalProgressHistory[]): Date {
    if (progressHistory.length < 2) {
      // Not enough data, return deadline
      return goal.timeBound.deadline;
    }

    const improvementRate = this.calculateImprovementRate(goal, progressHistory);
    
    if (improvementRate <= 0) {
      // No progress or declining, return far future date
      const farFuture = new Date(goal.timeBound.deadline);
      farFuture.setFullYear(farFuture.getFullYear() + 1);
      return farFuture;
    }

    const currentValue = progressHistory[0].measuredValue;
    const remainingImprovement = Math.abs(goal.targetValue - currentValue);
    const daysToCompletion = Math.ceil(remainingImprovement / Math.abs(improvementRate));
    
    const projectedDate = new Date();
    projectedDate.setDate(projectedDate.getDate() + daysToCompletion);
    
    return projectedDate;
  }

  private getNextMilestone(milestones: GoalMilestone[], currentProgress: number): GoalMilestone | undefined {
    return milestones
      .filter(m => m.status === 'pending')
      .sort((a, b) => a.milestoneOrder - b.milestoneOrder)
      .find(m => {
        // Find the next milestone that hasn't been achieved
        const milestoneProgress = (m.milestoneOrder * 100) / (milestones.length + 1);
        return milestoneProgress > currentProgress;
      });
  }

  private calculateImprovementRate(goal: Goal, progressHistory: GoalProgressHistory[]): number {
    if (progressHistory.length < 2) return 0;

    // Calculate improvement rate based on recent progress
    const recent = progressHistory.slice(0, Math.min(5, progressHistory.length));
    if (recent.length < 2) return 0;

    const timeSpan = recent[0].measurementDate.getTime() - recent[recent.length - 1].measurementDate.getTime();
    const valueChange = recent[0].measuredValue - recent[recent.length - 1].measuredValue;
    
    if (timeSpan <= 0) return 0;
    
    const daysSpan = timeSpan / (1000 * 60 * 60 * 24);
    return valueChange / daysSpan;
  }

  private analyzeRecentTrend(progressHistory: GoalProgressHistory[]): GoalProgress['recentTrend'] {
    if (progressHistory.length < 3) return 'stable';

    const recent = progressHistory.slice(0, 3);
    const values = recent.map(p => p.measuredValue);
    
    // Calculate trend based on slope
    let increasingCount = 0;
    let decreasingCount = 0;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i-1] > values[i]) increasingCount++; // For time goals, decreasing time is improving
      else if (values[i-1] < values[i]) decreasingCount++;
    }
    
    if (increasingCount > decreasingCount) return 'improving';
    if (decreasingCount > increasingCount) return 'declining';
    return 'stable';
  }

  async generateGoalAnalytics(goalId: number): Promise<GoalAnalytics | null> {
    const goal = await dbUtils.getGoal(goalId);
    if (!goal) return null;

    const progress = await this.calculateGoalProgress(goalId);
    if (!progress) return null;

    const milestones = await dbUtils.getGoalMilestones(goalId);
    const progressHistory = await dbUtils.getGoalProgressHistory(goalId);
    
    const recommendations = this.generateRecommendations(goal, progress);
    const insights = this.generateInsights(goal, progress, progressHistory);

    return {
      goal,
      progress,
      milestones,
      progressHistory,
      recommendations,
      insights
    };
  }

  private generateRecommendations(goal: Goal, progress: GoalProgress): string[] {
    const recommendations: string[] = [];

    switch (progress.trajectory) {
      case 'ahead':
        recommendations.push('You\'re ahead of schedule! Consider setting a more challenging target or maintaining this pace.');
        break;
      case 'on_track':
        recommendations.push('Great progress! Continue with your current training approach.');
        break;
      case 'behind':
        recommendations.push('Consider increasing training frequency or intensity to get back on track.');
        if (progress.daysUntilDeadline > 30) {
          recommendations.push('You still have time to adjust your approach and reach your goal.');
        }
        break;
      case 'at_risk':
        recommendations.push('Your goal may need adjustment. Consider extending the deadline or modifying the target.');
        recommendations.push('Focus on consistency rather than intensity to build momentum.');
        break;
    }

    // Trend-based recommendations
    if (progress.recentTrend === 'declining') {
      recommendations.push('Recent progress has slowed. Consider reviewing your training plan or taking a rest day.');
    } else if (progress.recentTrend === 'improving') {
      recommendations.push('Your improvement trend is positive! Keep up the momentum.');
    }

    // Time-based recommendations
    if (progress.daysUntilDeadline < 14) {
      recommendations.push('With less than 2 weeks remaining, focus on maintaining fitness rather than major improvements.');
    } else if (progress.daysUntilDeadline > 90) {
      recommendations.push('You have plenty of time. Consider setting intermediate goals to maintain motivation.');
    }

    return recommendations;
  }

  private generateInsights(
    goal: Goal, 
    progress: GoalProgress, 
    progressHistory: GoalProgressHistory[]
  ): GoalAnalytics['insights'] {
    const strengthAreas: string[] = [];
    const improvementAreas: string[] = [];
    const riskFactors: string[] = [];

    // Analyze consistency
    const consistencyScore = this.calculateConsistencyScore(progressHistory);
    if (consistencyScore > 0.8) {
      strengthAreas.push('Excellent consistency in tracking progress');
    } else if (consistencyScore < 0.5) {
      improvementAreas.push('More consistent progress tracking needed');
    }

    // Analyze progress rate
    if (progress.improvementRate > 0) {
      strengthAreas.push(`Positive improvement rate of ${Math.abs(progress.improvementRate).toFixed(2)} per day`);
    } else if (progress.improvementRate < 0) {
      riskFactors.push('Recent progress shows decline - review training approach');
    }

    // Time-based insights
    const timeRemaining = progress.daysUntilDeadline;
    if (timeRemaining < 7 && progress.progressPercentage < 80) {
      riskFactors.push('Limited time remaining with significant progress needed');
    }

    // Goal type specific insights
    if (goal.goalType === 'time_improvement') {
      if (progress.progressPercentage > 50) {
        strengthAreas.push('Strong progress toward time improvement goal');
      }
    } else if (goal.goalType === 'frequency') {
      if (progress.recentTrend === 'improving') {
        strengthAreas.push('Building good training consistency');
      }
    }

    return {
      strengthAreas,
      improvementAreas,
      riskFactors
    };
  }

  private calculateConsistencyScore(progressHistory: GoalProgressHistory[]): number {
    if (progressHistory.length < 2) return 0;

    // Calculate expected vs actual measurement frequency
    const timeSpan = progressHistory[0].measurementDate.getTime() - 
                    progressHistory[progressHistory.length - 1].measurementDate.getTime();
    const days = timeSpan / (1000 * 60 * 60 * 24);
    
    if (days <= 0) return 0;
    
    const expectedMeasurements = Math.max(1, Math.floor(days / 3)); // Expect measurement every 3 days
    const actualMeasurements = progressHistory.length;
    
    return Math.min(1, actualMeasurements / expectedMeasurements);
  }

  // Check for milestone achievements
  async checkMilestoneAchievements(goalId: number): Promise<GoalMilestone[]> {
    const goal = await dbUtils.getGoal(goalId);
    if (!goal) return [];

    const milestones = await dbUtils.getGoalMilestones(goalId);
    const progress = await this.calculateGoalProgress(goalId);
    if (!progress) return [];

    const achievedMilestones: GoalMilestone[] = [];

    for (const milestone of milestones) {
      if (milestone.status === 'pending') {
        // Check if milestone should be achieved based on current progress
        const milestoneProgress = (milestone.milestoneOrder * 100) / (milestones.length + 1);
        
        if (progress.progressPercentage >= milestoneProgress) {
          await dbUtils.markMilestoneAchieved(milestone.id!, progress.currentValue);
          achievedMilestones.push({
            ...milestone,
            status: 'achieved',
            achievedValue: progress.currentValue,
            achievedDate: new Date()
          });
        }
      }
    }

    return achievedMilestones;
  }

  // Generate goal completion prediction
  async predictGoalCompletion(goalId: number): Promise<{
    probability: number;
    confidenceLevel: 'high' | 'medium' | 'low';
    factors: string[];
  }> {
    const progress = await this.calculateGoalProgress(goalId);
    if (!progress) {
      return { probability: 0, confidenceLevel: 'low', factors: ['Goal not found'] };
    }

    let probability = 0;
    const factors: string[] = [];

    // Base probability on current progress and time remaining
    const timeProgress = 100 - ((progress.daysUntilDeadline / progress.daysUntilDeadline) * 100);
    const progressRatio = progress.progressPercentage / Math.max(timeProgress, 1);

    if (progressRatio >= 1.2) {
      probability = 0.9;
      factors.push('Ahead of schedule');
    } else if (progressRatio >= 1.0) {
      probability = 0.8;
      factors.push('On track');
    } else if (progressRatio >= 0.8) {
      probability = 0.6;
      factors.push('Slightly behind but achievable');
    } else if (progressRatio >= 0.5) {
      probability = 0.3;
      factors.push('Significant effort needed');
    } else {
      probability = 0.1;
      factors.push('Goal may need adjustment');
    }

    // Adjust based on recent trend
    if (progress.recentTrend === 'improving') {
      probability = Math.min(1, probability + 0.1);
      factors.push('Positive trend');
    } else if (progress.recentTrend === 'declining') {
      probability = Math.max(0, probability - 0.2);
      factors.push('Concerning trend');
    }

    // Determine confidence level
    let confidenceLevel: 'high' | 'medium' | 'low' = 'medium';
    if (progress.daysUntilDeadline > 30) {
      confidenceLevel = 'high';
    } else if (progress.daysUntilDeadline < 7) {
      confidenceLevel = 'low';
    }

    return {
      probability: Math.round(probability * 100) / 100,
      confidenceLevel,
      factors
    };
  }
}

export const goalProgressEngine = new GoalProgressEngine();
