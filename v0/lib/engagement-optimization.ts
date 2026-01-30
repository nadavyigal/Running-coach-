import { type User, type Run, type Goal, type Badge } from '@/lib/db';
import { dbUtils } from '@/lib/dbUtils';

export interface EngagementOptimization {
  userId: string;
  notificationPreferences: NotificationPreferences;
  engagementPatterns: EngagementPattern[];
  optimalTiming: OptimalTiming;
  motivationalTriggers: MotivationalTrigger[];
}

export interface NotificationPreferences {
  frequency: 'low' | 'medium' | 'high';
  timing: 'morning' | 'afternoon' | 'evening';
  types: NotificationType[];
  quietHours: { start: string; end: string };
}

export interface NotificationType {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: 'motivational' | 'reminder' | 'achievement' | 'milestone';
}

export interface OptimalTiming {
  bestTime: string;
  timezone: string;
  lastEngagement: Date;
  engagementScore: number;
}

export interface EngagementPattern {
  patternType: 'time_preference' | 'frequency_pattern' | 'motivation_response' | 'achievement_celebration';
  pattern: string;
  confidence: number;
  frequency: number;
  impact: number;
  lastObserved: Date;
}

export interface MotivationalTrigger {
  id: string;
  type: 'streak_milestone' | 'achievement' | 'goal_progress' | 'personal_record' | 'consistency_boost';
  condition: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  isActive: boolean;
}

export interface NotificationPersonalization {
  userMood?: string;
  recentPerformance?: string;
  weatherConditions?: string;
  timeOfDay?: string;
  motivationalFactor?: string;
}

export interface EnhancedNotification {
  id: string;
  userId: string;
  type: 'motivational' | 'reminder' | 'achievement' | 'milestone';
  title: string;
  message: string;
  personalization: NotificationPersonalization;
  engagementScore: number;
  priority: 'low' | 'medium' | 'high';
  scheduledFor: Date;
  isRead: boolean;
  createdAt: Date;
}

class EngagementOptimizationService {
  private static instance: EngagementOptimizationService;

  static getInstance(): EngagementOptimizationService {
    if (!EngagementOptimizationService.instance) {
      EngagementOptimizationService.instance = new EngagementOptimizationService();
    }
    return EngagementOptimizationService.instance;
  }

  async calculateEngagementScore(userId: number): Promise<number> {
    try {
      const user = await dbUtils.getCurrentUser();
      if (!user) return 0;

      const runs: Run[] = await dbUtils.getUserRuns(userId);
      const goals: Goal[] = await dbUtils.getUserGoals(userId);
      
      // Calculate various engagement factors
      const activityScore = this.calculateActivityScore(runs);
      const consistencyScore = this.calculateConsistencyScore(user);
      const goalProgressScore = this.calculateGoalProgressScore(goals);
      const streakScore = this.calculateStreakScore(user);
      
      // Weighted average of all scores
      const overallScore = Math.round(
        (activityScore * 0.3) +
        (consistencyScore * 0.25) +
        (goalProgressScore * 0.25) +
        (streakScore * 0.2)
      );

      return Math.min(100, Math.max(0, overallScore));
    } catch (error) {
      console.error('Failed to calculate engagement score:', error);
      return 50; // Default score
    }
  }

  private calculateActivityScore(runs: Run[]): number {
    if (runs.length === 0) return 0;

    const recentRuns = runs.filter((run: Run) => {
      const runDate = new Date(run.completedAt);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return runDate > thirtyDaysAgo;
    });

    // Score based on recent activity frequency
    const activityFrequency = recentRuns.length / 30; // runs per day
    return Math.min(100, activityFrequency * 100);
  }

  private calculateConsistencyScore(user: User): number {
    if (!user.currentStreak) return 0;
    
    // Score based on current streak length
    return Math.min(100, (user.currentStreak / 7) * 100);
  }

  private calculateGoalProgressScore(goals: Goal[]): number {
    if (goals.length === 0) return 0;

    const activeGoals = goals.filter(goal => goal.status === 'active');
    if (activeGoals.length === 0) return 0;

    const totalProgress = activeGoals.reduce((sum, goal) => {
      const progress = (goal.currentValue / goal.targetValue) * 100;
      return sum + Math.min(100, progress);
    }, 0);

    return Math.round(totalProgress / activeGoals.length);
  }

  private calculateStreakScore(user: User): number {
    if (!user.longestStreak) return 0;
    
    // Score based on longest streak achievement
    return Math.min(100, (user.longestStreak / 30) * 100);
  }

  async determineOptimalTiming(userId: number): Promise<OptimalTiming> {
    try {
      const runs: Run[] = await dbUtils.getUserRuns(userId);
      const user = await dbUtils.getCurrentUser();
      
      if (!user || runs.length === 0) {
        return {
          bestTime: '08:00',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          lastEngagement: new Date(),
          engagementScore: 50
        };
      }

      // Analyze run times to find optimal timing
      const runTimes = runs.map((run: Run) => new Date(run.completedAt).getHours());
      const timeDistribution = this.analyzeTimeDistribution(runTimes);
      const bestHour = this.findPeakHour(timeDistribution);
      
      return {
        bestTime: `${bestHour.toString().padStart(2, '0')}:00`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        lastEngagement: new Date(),
        engagementScore: await this.calculateEngagementScore(userId)
      };
    } catch (error) {
      console.error('Failed to determine optimal timing:', error);
      return {
        bestTime: '08:00',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        lastEngagement: new Date(),
        engagementScore: 50
      };
    }
  }

  private analyzeTimeDistribution(runTimes: number[]): Record<number, number> {
    const distribution: Record<number, number> = {};
    
    for (let hour = 0; hour < 24; hour++) {
      distribution[hour] = 0;
    }
    
    runTimes.forEach(hour => {
      distribution[hour] = (distribution[hour] || 0) + 1;
    });
    
    return distribution;
  }

  private findPeakHour(distribution: Record<number, number>): number {
    let maxCount = 0;
    let peakHour = 8; // Default to 8 AM
    
    Object.entries(distribution).forEach(([hour, count]) => {
      if (count > maxCount) {
        maxCount = count;
        peakHour = parseInt(hour);
      }
    });
    
    return peakHour;
  }

  async generateMotivationalTriggers(userId: number): Promise<MotivationalTrigger[]> {
    try {
      const user = await dbUtils.getCurrentUser();
      if (!user) return [];

      const triggers: MotivationalTrigger[] = [];

      // Streak-based triggers
      if (user.currentStreak && user.currentStreak >= 3) {
        triggers.push({
          id: 'streak_3_days',
          type: 'streak_milestone',
          condition: 'currentStreak >= 3',
          message: `Great job! You're on a ${user.currentStreak}-day streak. Keep it going!`,
          priority: 'medium',
          isActive: true
        });
      }

      if (user.currentStreak && user.currentStreak >= 7) {
        triggers.push({
          id: 'streak_week',
          type: 'streak_milestone',
          condition: 'currentStreak >= 7',
          message: `Amazing! You've been running for a whole week straight!`,
          priority: 'high',
          isActive: true
        });
      }

      // Achievement-based triggers
      const badges: Badge[] = await dbUtils.getUserBadges(userId);
      const recentBadges = badges.filter((badge: Badge) => {
        const badgeDate = new Date(badge.unlockedAt);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return badgeDate > sevenDaysAgo;
      });

      if (recentBadges.length > 0) {
        triggers.push({
          id: 'recent_achievement',
          type: 'achievement',
          condition: 'recentBadges.length > 0',
          message: `Congratulations! You've earned ${recentBadges.length} new badge${recentBadges.length > 1 ? 's' : ''}!`,
          priority: 'high',
          isActive: true
        });
      }

      // Goal progress triggers
      const goals: Goal[] = await dbUtils.getUserGoals(userId);
      const activeGoals = goals.filter((goal: Goal) => goal.status === 'active');
      
      activeGoals.forEach((goal: Goal) => {
        const progress = (goal.currentValue / goal.targetValue) * 100;
        if (progress >= 50 && progress < 100) {
          triggers.push({
            id: `goal_progress_${goal.id}`,
            type: 'goal_progress',
            condition: `goalProgress >= 50`,
            message: `You're ${Math.round(progress)}% of the way to your "${goal.title}" goal!`,
            priority: 'medium',
            isActive: true
          });
        }
      });

      return triggers;
    } catch (error) {
      console.error('Failed to generate motivational triggers:', error);
      return [];
    }
  }

  async createPersonalizedNotification(
    userId: number,
    type: 'motivational' | 'reminder' | 'achievement' | 'milestone',
    baseMessage: string
  ): Promise<EnhancedNotification> {
    try {
      const user = await dbUtils.getCurrentUser();
      if (!user) throw new Error('User not found');

      const personalization = await this.generatePersonalization(userId);
      const engagementScore = await this.calculateEngagementScore(userId);
      
      const notification: EnhancedNotification = {
        id: `notification_${Date.now()}_${Math.random()}`,
        userId: userId.toString(),
        type,
        title: this.generateNotificationTitle(type),
        message: this.personalizeMessage(baseMessage, personalization),
        personalization,
        engagementScore,
        priority: this.determinePriority(type, engagementScore),
        scheduledFor: new Date(),
        isRead: false,
        createdAt: new Date()
      };

      return notification;
    } catch (error) {
      console.error('Failed to create personalized notification:', error);
      throw error;
    }
  }

  private async generatePersonalization(userId: number): Promise<NotificationPersonalization> {
    try {
      const user = await dbUtils.getCurrentUser();
      if (!user) return {};

      const runs: Run[] = await dbUtils.getUserRuns(userId);
      const recentRuns = runs.slice(-5); // Last 5 runs

      const personalization: NotificationPersonalization = {
        timeOfDay: this.getTimeOfDay(),
        motivationalFactor: this.getMotivationalFactor(user)
      };

      if (recentRuns.length > 0) {
        const latestRun = recentRuns[recentRuns.length - 1];
        personalization.recentPerformance = this.analyzeRecentPerformance(latestRun);
      }

      return personalization;
    } catch (error) {
      console.error('Failed to generate personalization:', error);
      return {};
    }
  }

  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  private getMotivationalFactor(user: User): string {
    if (user.currentStreak && user.currentStreak >= 7) return 'streak';
    if (user.longestStreak && user.longestStreak >= 30) return 'consistency';
    return 'progress';
  }

  private analyzeRecentPerformance(run: Run): string {
    const pace = run.pace || 0;
    
    if (pace < 300) return 'excellent';
    if (pace < 360) return 'good';
    if (pace < 420) return 'steady';
    return 'building';
  }

  private generateNotificationTitle(type: string): string {
    const titles = {
      motivational: 'Stay Motivated!',
      reminder: 'Time to Run',
      achievement: 'Congratulations!',
      milestone: 'Milestone Reached!'
    };
    return titles[type as keyof typeof titles] || 'Notification';
  }

  private personalizeMessage(baseMessage: string, personalization: NotificationPersonalization): string {
    let message = baseMessage;
    
    if (personalization.timeOfDay === 'morning') {
      message = `Good morning! ${message}`;
    } else if (personalization.timeOfDay === 'afternoon') {
      message = `Afternoon motivation: ${message}`;
    } else {
      message = `Evening reminder: ${message}`;
    }

    if (personalization.recentPerformance === 'excellent') {
      message += ' You\'ve been crushing it lately!';
    } else if (personalization.recentPerformance === 'good') {
      message += ' Keep up the great work!';
    }

    return message;
  }

  private determinePriority(type: string, engagementScore: number): 'low' | 'medium' | 'high' {
    if (type === 'achievement' || type === 'milestone') return 'high';
    if (engagementScore < 50) return 'high';
    if (engagementScore < 75) return 'medium';
    return 'low';
  }

  async adaptNotificationFrequency(userId: number, currentFrequency: 'low' | 'medium' | 'high'): Promise<'low' | 'medium' | 'high'> {
    try {
      const engagementScore = await this.calculateEngagementScore(userId);
      
      // Adapt frequency based on engagement score
      if (engagementScore < 30) {
        return 'low'; // Reduce frequency for low engagement
      } else if (engagementScore > 80) {
        return 'high'; // Increase frequency for high engagement
      } else {
        return 'medium'; // Keep medium for moderate engagement
      }
    } catch (error) {
      console.error('Failed to adapt notification frequency:', error);
      return currentFrequency;
    }
  }

  async trackEngagementEvent(userId: number, eventType: string, metadata?: any): Promise<void> {
    try {
      // Track engagement events for analytics
      console.log('Engagement event tracked:', { userId, eventType, metadata, timestamp: new Date() });
      
      // In a real implementation, this would save to analytics database
      // For now, we'll just log the event
    } catch (error) {
      console.error('Failed to track engagement event:', error);
    }
  }
}

export const engagementOptimizationService = EngagementOptimizationService.getInstance();
