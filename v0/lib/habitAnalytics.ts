import { subDays, startOfWeek, endOfWeek, differenceInDays } from 'date-fns';
import { ENABLE_WEEKLY_RECAP } from '@/lib/featureFlags';
import { db, type User, type Run, type Workout, type Goal } from './db';
import { calculateConsistency, calculatePace, formatPace } from './workout-utils';

export interface HabitAnalytics {
  // Core habit metrics
  currentStreak: number;
  longestStreak: number;
  weeklyConsistency: number; // 0-100 percentage
  monthlyConsistency: number; // 0-100 percentage
  
  // Behavioral patterns
  preferredDays: DayPattern[];
  consistencyTrend: 'improving' | 'stable' | 'declining';
  riskLevel: 'low' | 'medium' | 'high';
  
  // Motivation insights
  motivationFactors: MotivationFactor[];
  barriers: string[];
  suggestions: string[];
  
  // Progress tracking
  goalAlignment: number; // 0-100 how well habits align with goals
  planAdherence: number; // 0-100 workout completion rate
  
  // Comparative metrics
  weekOverWeek: number; // percentage change
  monthOverMonth: number; // percentage change
  
  // Timing analysis
  optimalTimes: string[];
  consistentDuration: number; // average duration in minutes
  
  lastUpdated: Date;
}

export interface DayPattern {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  dayName: string;
  frequency: number; // 0-1, how often they run on this day
  avgPerformance: number; // average performance score
  consistency: number; // how consistent they are on this day
}

export interface MotivationFactor {
  factor: string;
  impact: number; // 0-1 scale
  evidence: string;
  actionable: boolean;
}

export interface WeeklyHabitData {
  weekStart: Date;
  plannedWorkouts: number;
  completedWorkouts: number;
  consistency: number;
  streakChange: number;
}

export interface HabitRisk {
  level: 'low' | 'medium' | 'high';
  factors: string[];
  recommendations: string[];
  priority: number;
}

export interface WeeklyRecap {
  weekStartDate: Date;
  weekEndDate: Date;
  totalDistance: number;
  totalRuns: number;
  totalDuration: number;
  averagePace: string;
  weekOverWeekChange: { distance: number; runs: number }; // % change
  streakStatus: 'continued' | 'broken' | 'started';
  currentStreak: number;
  topAchievement: string;
  consistencyScore: number; // 0-100
  nextWeekGoal: string;
  dailyRunTotals: number[];
}

const WEEKLY_RECAP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface WeeklyRecapCacheEntry {
  cachedAt: number;
  recap: WeeklyRecap;
}

const canAccessStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const buildWeeklyRecapCacheKey = (userId: number, weekStartDate: Date) =>
  `weeklyRecap_${userId}_${weekStartDate.toISOString()}`;

const reviveWeeklyRecapDates = (recap: WeeklyRecap): WeeklyRecap => ({
  ...recap,
  weekStartDate: new Date(recap.weekStartDate),
  weekEndDate: new Date(recap.weekEndDate)
});

export const getCachedWeeklyRecap = (
  userId: number,
  weekStartDate: Date
): WeeklyRecap | null => {
  if (!canAccessStorage()) {
    return null;
  }

  try {
    const cacheKey = buildWeeklyRecapCacheKey(userId, weekStartDate);
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as WeeklyRecapCacheEntry;
    if (!parsed || typeof parsed.cachedAt !== 'number' || !parsed.recap) {
      return null;
    }

    if (Date.now() - parsed.cachedAt > WEEKLY_RECAP_CACHE_TTL_MS) {
      window.localStorage.removeItem(cacheKey);
      return null;
    }

    return reviveWeeklyRecapDates(parsed.recap);
  } catch {
    return null;
  }
};

const setCachedWeeklyRecap = (
  userId: number,
  weekStartDate: Date,
  recap: WeeklyRecap
): void => {
  if (!canAccessStorage()) {
    return;
  }

  try {
    const cacheKey = buildWeeklyRecapCacheKey(userId, weekStartDate);
    const payload: WeeklyRecapCacheEntry = {
      cachedAt: Date.now(),
      recap
    };
    window.localStorage.setItem(cacheKey, JSON.stringify(payload));
  } catch {
  }
};

export class HabitAnalyticsService {
  private getDatabase() {
    if (Object.prototype.hasOwnProperty.call(globalThis, 'db')) {
      const globalDb = (globalThis as any).db;
      if (globalDb !== undefined) {
        return globalDb;
      }
    }
    return db;
  }

  async calculateHabitAnalytics(userId: number): Promise<HabitAnalytics | null> {
    try {
      const database = this.getDatabase();
      if (!database) {
        throw new Error('Database not available');
      }

      const user = await database.users.get(userId);
      if (!user) {
        throw new Error('User not found');
      }

    const runs = await this.getUserRuns(userId);
    const workouts = await this.getUserWorkouts(userId);
    const goals = await this.getUserGoals(userId);

    const currentDate = new Date();
    const thirtyDaysAgo = subDays(currentDate, 30);
    const sevenDaysAgo = subDays(currentDate, 7);

    // Calculate core metrics
    const currentStreak = user.currentStreak || 0;
    const longestStreak = user.longestStreak || 0;
    
    const weeklyConsistency = await this.calculateWeeklyConsistency(userId, sevenDaysAgo, currentDate);
    const monthlyConsistency = await this.calculateMonthlyConsistency(userId, thirtyDaysAgo, currentDate);
    
    // Analyze behavioral patterns
    const preferredDays = await this.analyzePreferredDays(runs);
    const consistencyTrend = this.analyzeConsistencyTrend(await this.getWeeklyData(userId, 4));
    const riskLevel = this.assessRiskLevel(user, weeklyConsistency, currentStreak);
    
    // Generate insights
    const motivationFactors = this.identifyMotivationFactors(runs, workouts, goals);
    const barriers = this.identifyBarriers(user, workouts, runs);
    const suggestions = this.generateSuggestions(user, weeklyConsistency, riskLevel, preferredDays);
    
    // Progress metrics
    const goalAlignment = await this.calculateGoalAlignment(goals);
    const planAdherence = this.calculatePlanAdherence(workouts);
    
    // Comparative analysis
    const weekOverWeek = await this.calculateWeekOverWeekChange(userId);
    const monthOverMonth = await this.calculateMonthOverMonthChange(userId);
    
    // Timing analysis
    const optimalTimes = this.identifyOptimalTimes(runs);
    const consistentDuration = this.calculateAverageDuration(runs);

    return {
      currentStreak,
      longestStreak,
      weeklyConsistency,
      monthlyConsistency,
      preferredDays,
      consistencyTrend,
      riskLevel,
      motivationFactors,
      barriers,
      suggestions,
      goalAlignment,
      planAdherence,
      weekOverWeek,
      monthOverMonth,
      optimalTimes,
      consistentDuration,
      lastUpdated: new Date()
    };
    } catch (error) {
      console.error('[HabitAnalytics] Error calculating analytics:', error);
      throw error;
    }
  }

  async generateWeeklyRecap(userId: number, weekStartDate: Date): Promise<WeeklyRecap> {
    if (!ENABLE_WEEKLY_RECAP) {
      throw new Error('Weekly recap feature is disabled');
    }

    const normalizedWeekStart = this.normalizeWeekStart(weekStartDate);
    const cached = getCachedWeeklyRecap(userId, normalizedWeekStart);
    if (cached) {
      return cached;
    }

    const database = this.getDatabase();
    if (!database) {
      throw new Error('Database not available');
    }

    const user = await database.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const weekEndDate = this.getWeekEnd(normalizedWeekStart);

    const currentWeekRuns = await database.runs
      .where('[userId+completedAt]')
      .between([userId, normalizedWeekStart], [userId, weekEndDate], true, true)
      .toArray();

    const currentStats = this.summarizeRuns(currentWeekRuns);
    const averagePaceSeconds = calculatePace(currentStats.totalDistance, currentStats.totalDuration);
    const averagePace = formatPace(averagePaceSeconds);

    const previousWeekStart = subDays(normalizedWeekStart, 7);
    const previousWeekEnd = subDays(weekEndDate, 7);
    const previousWeekRuns = await database.runs
      .where('[userId+completedAt]')
      .between([userId, previousWeekStart], [userId, previousWeekEnd], true, true)
      .toArray();
    const previousStats = this.summarizeRuns(previousWeekRuns);

    const workouts = await this.getUserWorkouts(userId);
    const weekWorkouts = workouts.filter(workout =>
      workout.scheduledDate >= normalizedWeekStart &&
      workout.scheduledDate <= weekEndDate &&
      workout.type !== 'rest'
    );
    const consistencyScore = calculateConsistency(currentStats.totalRuns, weekWorkouts.length);

    const dailyRunTotals = this.getDailyRunTotals(currentWeekRuns, normalizedWeekStart);

    const recap: WeeklyRecap = {
      weekStartDate: normalizedWeekStart,
      weekEndDate,
      totalDistance: currentStats.totalDistance,
      totalRuns: currentStats.totalRuns,
      totalDuration: currentStats.totalDuration,
      averagePace,
      weekOverWeekChange: {
        distance: this.calculatePercentChange(
          currentStats.totalDistance,
          previousStats.totalDistance
        ),
        runs: this.calculatePercentChange(currentStats.totalRuns, previousStats.totalRuns)
      },
      streakStatus: this.getWeeklyStreakStatus(user, currentStats.totalRuns, previousStats.totalRuns),
      currentStreak: user.currentStreak ?? 0,
      topAchievement: this.getTopAchievement(currentStats, averagePaceSeconds),
      consistencyScore,
      nextWeekGoal: this.getNextWeekGoal(currentStats.totalDistance, consistencyScore),
      dailyRunTotals
    };

    setCachedWeeklyRecap(userId, normalizedWeekStart, recap);

    return recap;
  }

  private async getUserRuns(userId: number): Promise<Run[]> {
    const database = this.getDatabase();
    if (!database) return [];
    return await database.runs.where('userId').equals(userId).toArray();
  }

  private async getUserWorkouts(userId: number): Promise<Workout[]> {
    const database = this.getDatabase();
    if (!database) return [];
    // Get workouts through plans
    const plans = await database.plans.where('userId').equals(userId).toArray();
    const planIds = plans.map(p => p.id!).filter(Boolean);
    
    if (planIds.length === 0) return [];
    
    // Use filter instead of anyOf for better compatibility
    const allWorkouts = await database.workouts.toArray();
    return allWorkouts.filter(workout => planIds.includes(workout.planId));
  }

  private async getUserGoals(userId: number): Promise<Goal[]> {
    const database = this.getDatabase();
    if (!database) return [];
    return await database.goals.where('userId').equals(userId).toArray();
  }

  private async calculateWeeklyConsistency(userId: number, startDate: Date, endDate: Date): Promise<number> {
    const workouts = await this.getUserWorkouts(userId);
    const weekWorkouts = workouts.filter(w => 
      w.scheduledDate >= startDate && w.scheduledDate <= endDate
    );
    
    if (weekWorkouts.length === 0) return 100; // No workouts planned = 100% consistency
    
    const completed = weekWorkouts.filter(w => w.completed).length;
    return Math.round((completed / weekWorkouts.length) * 100);
  }

  private async calculateMonthlyConsistency(userId: number, startDate: Date, endDate: Date): Promise<number> {
    const workouts = await this.getUserWorkouts(userId);
    const monthWorkouts = workouts.filter(w => 
      w.scheduledDate >= startDate && w.scheduledDate <= endDate
    );
    
    if (monthWorkouts.length === 0) return 100;
    
    const completed = monthWorkouts.filter(w => w.completed).length;
    return Math.round((completed / monthWorkouts.length) * 100);
  }

  private async analyzePreferredDays(runs: Run[]): Promise<DayPattern[]> {
    if (runs.length === 0) return [];
    const dayStats = new Map<number, { count: number, totalDuration: number }>();
    
    // Initialize all days
    for (let i = 0; i < 7; i++) {
      dayStats.set(i, { count: 0, totalDuration: 0 });
    }
    
    // Analyze run patterns
    runs.forEach(run => {
      const dayOfWeek = run.completedAt.getDay();
      const stats = dayStats.get(dayOfWeek)!;
      stats.count++;
      stats.totalDuration += run.duration;
    });
    
    const totalRuns = runs.length || 1;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    return Array.from(dayStats.entries()).map(([dayOfWeek, stats]) => ({
      dayOfWeek,
      dayName: dayNames.at(dayOfWeek) ?? 'Unknown',
      frequency: stats.count / totalRuns,
      avgPerformance: stats.count > 0 ? stats.totalDuration / stats.count : 0,
      consistency: this.calculateDayConsistency(runs, dayOfWeek)
    })).sort((a, b) => b.frequency - a.frequency);
  }

  private calculateDayConsistency(runs: Run[], dayOfWeek: number): number {
    const runsOnDay = runs.filter(r => r.completedAt.getDay() === dayOfWeek);
    if (runsOnDay.length === 0) return 0;
    
    // Calculate consistency based on how regularly they run on this day
    const weeksCovered = Math.ceil(runs.length / 7);
    return Math.min(runsOnDay.length / weeksCovered, 1);
  }

  private analyzeConsistencyTrend(weeklyData: WeeklyHabitData[]): 'improving' | 'stable' | 'declining' {
    if (weeklyData.length < 2) return 'stable';
    
    const recentWeeks = weeklyData.slice(-3);
    const olderWeeks = weeklyData.slice(0, -3);
    
    const recentAvg = recentWeeks.reduce((sum, week) => sum + week.consistency, 0) / recentWeeks.length;
    const olderAvg = olderWeeks.length > 0 
      ? olderWeeks.reduce((sum, week) => sum + week.consistency, 0) / olderWeeks.length 
      : recentAvg;
    
    const difference = recentAvg - olderAvg;
    
    if (difference > 5) return 'improving';
    if (difference < -5) return 'declining';
    return 'stable';
  }

  private assessRiskLevel(user: User, weeklyConsistency: number, currentStreak: number): 'low' | 'medium' | 'high' {
    let riskScore = 0;
    
    // Consistency risk
    if (weeklyConsistency < 50) riskScore += 3;
    else if (weeklyConsistency < 75) riskScore += 1;
    
    // Streak risk
    if (currentStreak === 0) riskScore += 2;
    else if (currentStreak < 3) riskScore += 1;
    
    // Time since last activity
    if (currentStreak === 0) {
      if (user.lastActivityDate) {
        const daysSinceLastActivity = differenceInDays(new Date(), user.lastActivityDate);
        if (daysSinceLastActivity > 7) riskScore += 3;
        else if (daysSinceLastActivity > 3) riskScore += 1;
      } else {
        riskScore += 2;
      }
    }
    
    if (riskScore >= 5) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  private identifyMotivationFactors(runs: Run[], workouts: Workout[], goals: Goal[]): MotivationFactor[] {
    const factors: MotivationFactor[] = [];
    
    // Goal alignment factor
    if (goals.length > 0) {
      const activeGoals = goals.filter(g => g.status === 'active');
      factors.push({
        factor: 'Goal-driven motivation',
        impact: Math.min(activeGoals.length * 0.3, 1),
        evidence: `${activeGoals.length} active goals providing direction`,
        actionable: true
      });
    }
    
    // Consistency factor
    const completionRate = workouts.length > 0 
      ? workouts.filter(w => w.completed).length / workouts.length 
      : 0;
    
    if (completionRate > 0.7) {
      factors.push({
        factor: 'Strong consistency habit',
        impact: completionRate,
        evidence: `${Math.round(completionRate * 100)}% workout completion rate`,
        actionable: false
      });
    }
    
    // Recent activity factor
    const referenceDate = runs.length > 0
      ? runs.reduce((latest, run) => (run.completedAt > latest ? run.completedAt : latest), runs[0].completedAt)
      : new Date();
    const recentRuns = runs.filter(r => 
      differenceInDays(referenceDate, r.completedAt) <= 7
    );
    
    if (recentRuns.length > 0) {
      factors.push({
        factor: 'Recent activity momentum',
        impact: Math.min(recentRuns.length * 0.2, 1),
        evidence: `${recentRuns.length} runs in the past week`,
        actionable: true
      });
    }
    
    return factors.sort((a, b) => b.impact - a.impact);
  }

  private identifyBarriers(user: User, workouts: Workout[], runs: Run[]): string[] {
    const barriers: string[] = [];
    
    // Inconsistent scheduling
    const completionRate = workouts.length > 0 
      ? workouts.filter(w => w.completed).length / workouts.length 
      : 1;
    
    if (completionRate < 0.5) {
      barriers.push('Low workout completion rate suggests scheduling or motivation challenges');
    }
    
    // Long gaps between activities
    if (user.lastActivityDate) {
      const daysSinceLastActivity = differenceInDays(new Date(), user.lastActivityDate);
      if (daysSinceLastActivity > 7) {
        barriers.push('Extended periods between activities disrupting habit formation');
      }
    }
    
    // Inconsistent timing
    const runTimes = runs.map(r => r.completedAt.getHours());
    const timeVariance = this.calculateVariance(runTimes);
    if (timeVariance > 4) {
      barriers.push('Inconsistent workout timing making habit formation difficult');
    }
    
    return barriers;
  }

  private generateSuggestions(
    user: User, 
    weeklyConsistency: number, 
    riskLevel: 'low' | 'medium' | 'high',
    preferredDays: DayPattern[]
  ): string[] {
    const suggestions: string[] = [];
    
    // Risk-based suggestions
    if (riskLevel === 'high') {
      suggestions.push('Start with just 10-15 minute easy runs to rebuild consistency');
      suggestions.push('Focus on 2-3 specific days per week to establish routine');
    } else if (riskLevel === 'medium') {
      suggestions.push('Try linking runs to existing daily habits (after morning coffee, before dinner)');
    }
    
    // Consistency-based suggestions
    if (weeklyConsistency < 75) {
      suggestions.push('Set smaller, more achievable weekly goals to build momentum');
      suggestions.push('Use reminders or alarms for your planned workout times');
    }
    
    // Day pattern suggestions
    const topDay = preferredDays[0];
    if (topDay && topDay.frequency > 0.3) {
      suggestions.push(`Build on your ${topDay.dayName} consistency - you run best on this day`);
    }
    
    // Goal alignment
    if (user.goal === 'habit') {
      suggestions.push('Focus on frequency over intensity - consistency builds habits');
    }
    
    return suggestions;
  }

  private async calculateGoalAlignment(goals: Goal[]): Promise<number> {
    if (goals.length === 0) return 50; // Neutral if no goals
    
    const activeGoals = goals.filter(g => g.status === 'active');
    if (activeGoals.length === 0) return 25; // Low if no active goals
    
    // Calculate based on goal progress
    let totalAlignment = 0;
    let goalCount = 0;
    
    for (const goal of activeGoals) {
      const progress = goal.currentValue / goal.targetValue;
      totalAlignment += Math.min(progress * 100, 100);
      goalCount++;
    }
    
    return goalCount > 0 ? Math.round(totalAlignment / goalCount) : 50;
  }

  private calculatePlanAdherence(workouts: Workout[]): number {
    if (workouts.length === 0) return 100;
    
    const completed = workouts.filter(w => w.completed).length;
    return Math.round((completed / workouts.length) * 100);
  }

  private async calculateWeekOverWeekChange(userId: number): Promise<number> {
    const thisWeekData = await this.getWeeklyData(userId, 1);
    const lastWeekData = await this.getWeeklyData(userId, 2);
    
    if (thisWeekData.length === 0 || lastWeekData.length < 2) return 0;
    
    const thisWeek = thisWeekData.at(0)?.consistency ?? 0;
    const lastWeek = lastWeekData.at(1)?.consistency ?? 0;
    if (lastWeek === 0) return 0;
    
    return Math.round(((thisWeek - lastWeek) / lastWeek) * 100) || 0;
  }

  private async calculateMonthOverMonthChange(userId: number): Promise<number> {
    // Simplified calculation - would need more sophisticated date handling for full implementation
    const monthlyData = await this.getWeeklyData(userId, 8);
    
    if (monthlyData.length < 8) return 0;
    
    const recentMonth = monthlyData.slice(0, 4).reduce((sum, week) => sum + week.consistency, 0) / 4;
    const previousMonth = monthlyData.slice(4, 8).reduce((sum, week) => sum + week.consistency, 0) / 4;
    
    return Math.round(((recentMonth - previousMonth) / previousMonth) * 100) || 0;
  }

  private identifyOptimalTimes(runs: Run[]): string[] {
    if (runs.length === 0) return [];
    const hourCounts = new Map<number, number>();
    
    runs.forEach(run => {
      const hour = run.completedAt.getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    });
    
    const sortedHours = Array.from(hourCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    return sortedHours.map(([hour]) => {
      if (hour < 12) return `${hour}:00 AM`;
      if (hour === 12) return '12:00 PM';
      return `${hour - 12}:00 PM`;
    });
  }

  private calculateAverageDuration(runs: Run[]): number {
    if (runs.length === 0) return 0;
    
    const totalDuration = runs.reduce((sum, run) => sum + run.duration, 0);
    return Math.round(totalDuration / runs.length / 60); // Convert to minutes
  }

  private async getWeeklyData(userId: number, weeksBack: number): Promise<WeeklyHabitData[]> {
    const weeks: WeeklyHabitData[] = [];
    const workouts = await this.getUserWorkouts(userId);
    
    for (let i = 0; i < weeksBack; i++) {
      const weekStart = startOfWeek(subDays(new Date(), i * 7));
      const weekEnd = endOfWeek(weekStart);
      
      const weekWorkouts = workouts.filter(w => 
        w.scheduledDate >= weekStart && w.scheduledDate <= weekEnd
      );
      
      const completedWorkouts = weekWorkouts.filter(w => w.completed).length;
      const plannedWorkouts = weekWorkouts.length;
      
      weeks.push({
        weekStart,
        plannedWorkouts,
        completedWorkouts,
        consistency: plannedWorkouts > 0 ? (completedWorkouts / plannedWorkouts) * 100 : 100,
        streakChange: 0 // Would need more complex calculation
      });
    }
    
    return weeks;
  }

  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length);
  }

  private normalizeWeekStart(weekStartDate: Date): Date {
    const normalized = new Date(weekStartDate);
    normalized.setHours(0, 0, 0, 0);
    const dayOfWeek = normalized.getDay();
    const offset = (dayOfWeek + 6) % 7;
    if (offset !== 0) {
      normalized.setDate(normalized.getDate() - offset);
    }
    return normalized;
  }

  private getWeekEnd(weekStartDate: Date): Date {
    const weekEnd = new Date(weekStartDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return weekEnd;
  }

  private summarizeRuns(runs: Run[]): {
    totalDistance: number;
    totalDuration: number;
    totalRuns: number;
    longestRun: number;
    fastestPace: number;
  } {
    let totalDistance = 0;
    let totalDuration = 0;
    let longestRun = 0;
    let fastestPace = Number.POSITIVE_INFINITY;

    for (const run of runs) {
      totalDistance += run.distance;
      totalDuration += run.duration;
      if (run.distance > longestRun) {
        longestRun = run.distance;
      }

      const pace = run.pace ?? (run.distance > 0 ? run.duration / run.distance : 0);
      if (pace > 0 && pace < fastestPace) {
        fastestPace = pace;
      }
    }

    return {
      totalDistance,
      totalDuration,
      totalRuns: runs.length,
      longestRun,
      fastestPace
    };
  }

  private getDailyRunTotals(runs: Run[], weekStartDate: Date): number[] {
    const totals = Array(7).fill(0);
    const weekStartUtc = Date.UTC(weekStartDate.getFullYear(), weekStartDate.getMonth(), weekStartDate.getDate());

    for (const run of runs) {
      const completedAt = run.completedAt;
      if (!completedAt) continue;

      const runDayUtc = Date.UTC(completedAt.getFullYear(), completedAt.getMonth(), completedAt.getDate());
      const dayIndex = Math.floor((runDayUtc - weekStartUtc) / (1000 * 60 * 60 * 24));
      if (dayIndex >= 0 && dayIndex < 7) {
        totals[dayIndex] += 1;
      }
    }

    return totals;
  }

  private calculatePercentChange(current: number, previous: number): number {
    if (previous <= 0) return 0;
    return Math.round(((current - previous) / previous) * 100) || 0;
  }

  private formatDistance(distance: number): string {
    if (!Number.isFinite(distance) || distance <= 0) {
      return '0';
    }

    return distance % 1 === 0 ? `${distance}` : distance.toFixed(1);
  }

  private getTopAchievement(
    stats: {
      totalRuns: number;
      longestRun: number;
      fastestPace: number;
    },
    averagePaceSeconds: number
  ): string {
    if (stats.totalRuns === 0) {
      return 'No runs logged this week';
    }

    const hasFastPace = Number.isFinite(stats.fastestPace);
    const paceImprovement =
      hasFastPace && averagePaceSeconds > 0
        ? (averagePaceSeconds - stats.fastestPace) / averagePaceSeconds
        : 0;

    if (hasFastPace && paceImprovement >= 0.1) {
      return `Best pace of ${formatPace(stats.fastestPace)}`;
    }

    if (stats.longestRun > 0) {
      return `Longest run of ${this.formatDistance(stats.longestRun)} km`;
    }

    return 'Completed your runs this week';
  }

  private getNextWeekGoal(totalDistance: number, consistencyScore: number): string {
    if (totalDistance <= 0) {
      return 'Aim for 1-2 easy runs next week';
    }

    if (consistencyScore >= 80) {
      const targetDistance = totalDistance * 1.1;
      return `Aim for ${this.formatDistance(targetDistance)} km next week`;
    }

    return `Maintain around ${this.formatDistance(totalDistance)} km next week`;
  }

  private getWeeklyStreakStatus(
    user: User,
    currentWeekRuns: number,
    previousWeekRuns: number
  ): WeeklyRecap['streakStatus'] {
    const currentStreak = user.currentStreak ?? 0;

    if (currentStreak === 0) {
      return currentWeekRuns > 0 ? 'started' : 'broken';
    }

    if (previousWeekRuns === 0 && currentWeekRuns > 0) {
      return 'started';
    }

    return 'continued';
  }

  // Public method to get habit risk assessment
  async getHabitRisk(userId: number): Promise<HabitRisk> {
    const analytics = await this.calculateHabitAnalytics(userId);
    
    const factors: string[] = [];
    const recommendations: string[] = [];
    
    if (analytics.currentStreak === 0) {
      factors.push('No current activity streak');
      recommendations.push('Start with a small, achievable goal to rebuild momentum');
    }
    
    if (analytics.weeklyConsistency < 50) {
      factors.push('Low weekly consistency');
      recommendations.push('Focus on completing 2-3 workouts per week consistently');
    }
    
    if (analytics.planAdherence < 60) {
      factors.push('Poor plan adherence');
      recommendations.push('Review and adjust your training plan to be more realistic');
    }
    
    return {
      level: analytics.riskLevel,
      factors,
      recommendations,
      priority: analytics.riskLevel === 'high' ? 1 : analytics.riskLevel === 'medium' ? 2 : 3
    };
  }
}
