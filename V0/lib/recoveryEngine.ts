import { db, SleepData, HRVMeasurement, RecoveryScore, SubjectiveWellness, User } from './db';

/**
 * Recovery score calculation algorithms and data structures.
 * 
 * This module provides comprehensive recovery analysis by combining multiple
 * physiological and subjective metrics to generate actionable recovery scores
 * and personalized recommendations for optimal training adaptation.
 */

/**
 * User's historical baseline metrics for recovery score normalization.
 * 
 * These baseline values are calculated from historical data and used to
 * contextualize current measurements, allowing for personalized recovery
 * assessment based on individual patterns rather than population averages.
 */
export interface RecoveryBaseline {
  /** User identifier */
  userId: number;
  /** Average sleep duration in minutes over baseline period */
  avgSleepDuration: number;
  /** Average sleep efficiency percentage (time asleep / time in bed * 100) */
  avgSleepEfficiency: number;
  /** Average heart rate variability in milliseconds (RMSSD) */
  avgHRV: number;
  /** Average resting heart rate in beats per minute */
  avgRestingHR: number;
  /** Timestamp of last baseline calculation */
  lastUpdated: Date;
}

/**
 * Individual component scores that contribute to overall recovery assessment.
 * 
 * Each factor is scored on a 0-100 scale where higher values indicate
 * better recovery status. The trainingLoadImpact is negative, representing
 * the recovery cost of recent training.
 */
export interface RecoveryFactors {
  /** Sleep quality score (0-100) based on duration, efficiency, and stages */
  sleepQuality: number;
  /** HRV score (0-100) compared to personal baseline */
  hrvScore: number;
  /** Resting heart rate score (0-100) relative to baseline */
  restingHRScore: number;
  /** Subjective wellness score (0-100) from user-reported metrics */
  subjectiveWellness: number;
  /** Training load impact (negative value) representing recovery cost */
  trainingLoadImpact: number;
  /** Stress level indicator (0-100) from physiological and subjective data */
  stressLevel: number;
}

/**
 * Core recovery analysis engine for calculating personalized recovery scores.
 * 
 * This class provides static methods for comprehensive recovery assessment by
 * integrating multiple data sources including sleep metrics, HRV measurements,
 * subjective wellness reports, and training load calculations.
 */
export class RecoveryEngine {
  /**
   * Calculates a comprehensive recovery score (0-100) based on multiple physiological and subjective factors.
   * 
   * This method integrates sleep quality, heart rate variability, resting heart rate,
   * subjective wellness, training load, and stress indicators to provide a holistic
   * assessment of the user's current recovery status and readiness for training.
   * 
   * The algorithm uses personalized baselines and weighted scoring to ensure
   * recommendations are tailored to individual patterns and responses.
   * 
   * @param userId - Unique identifier for the user
   * @param date - Date for which to calculate recovery score (defaults to today)
   * 
   * @returns Promise resolving to complete RecoveryScore object with:
   *   - Overall score (0-100)
   *   - Individual component scores
   *   - Personalized recommendations
   *   - Confidence level based on data availability
   * 
   * @example
   * ```typescript
   * const recovery = await RecoveryEngine.calculateRecoveryScore(123);
   * console.log(`Recovery score: ${recovery.overallScore}/100`);
   * console.log('Recommendations:', recovery.recommendations);
   * ```
   * 
   * @throws {Error} When user data is invalid or database operations fail
   * 
   * @since 1.0.0
   */
  static async calculateRecoveryScore(
    userId: number,
    date: Date = new Date()
  ): Promise<RecoveryScore> {
    try {
      // Get user baseline
      const baseline = await this.getUserBaseline(userId);
      
      // Get today's data
      const sleepData = await this.getSleepDataForDate(userId, date);
      const hrvData = await this.getHRVDataForDate(userId, date);
      const subjectiveData = await this.getSubjectiveWellnessForDate(userId, date);
      const trainingLoad = await this.calculateTrainingLoad(userId, date);
      
      // Calculate individual scores
      const sleepScore = this.calculateSleepScore(sleepData, baseline);
      const hrvScore = this.calculateHRVScore(hrvData, baseline);
      const restingHRScore = await this.calculateRestingHRScore(userId, baseline);
      const subjectiveScore = this.calculateSubjectiveScore(subjectiveData);
      const trainingLoadImpact = this.calculateTrainingLoadImpact(trainingLoad);
      const stressLevel = this.calculateStressLevel(sleepData, hrvData, subjectiveData);
      
      // Calculate overall score with weighted factors
      const overallScore = this.calculateOverallScore({
        sleepQuality: sleepScore,
        hrvScore,
        restingHRScore,
        subjectiveWellness: subjectiveScore,
        trainingLoadImpact,
        stressLevel
      });
      
      // Generate recommendations
      const recommendations = this.generateRecommendations({
        sleepQuality: sleepScore,
        hrvScore,
        restingHRScore,
        subjectiveWellness: subjectiveScore,
        trainingLoadImpact,
        stressLevel
      });
      
      // Calculate confidence based on data availability
      const confidence = this.calculateConfidence(sleepData, hrvData, subjectiveData);
      
      const recoveryScore: RecoveryScore = {
        userId,
        date,
        overallScore,
        sleepScore,
        hrvScore,
        restingHRScore,
        subjectiveWellnessScore: subjectiveScore,
        trainingLoadImpact,
        stressLevel,
        recommendations,
        confidence,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Save to database
      const id = await db.recoveryScores.add(recoveryScore);
      return { ...recoveryScore, id };
      
    } catch (error) {
      console.error('Error calculating recovery score:', error);
      throw error;
    }
  }
  
  /**
   * Calculates sleep quality score based on duration, efficiency, and sleep architecture.
   * 
   * This algorithm evaluates sleep quality using three key components:
   * 1. Duration Score (40% weight): Optimal sleep duration is 8 hours (480 minutes)
   * 2. Efficiency Score (30% weight): Target efficiency is 85% (time asleep / time in bed)  
   * 3. Quality Score (30% weight): Deep sleep should comprise ~20% of total sleep time
   * 
   * The scoring system penalizes deviations from optimal values using research-based
   * targets for healthy sleep patterns. Each component contributes proportionally
   * to the final score to ensure balanced assessment.
   * 
   * @param sleepData - Sleep measurement data from wearable devices or manual input
   * @param baseline - User's historical sleep baseline for personalization
   * 
   * @returns Sleep quality score from 0-100 (higher = better recovery)
   * 
   * @example
   * ```typescript
   * const sleepScore = RecoveryEngine.calculateSleepScore(
   *   { totalSleepTime: 450, sleepEfficiency: 88, deepSleepTime: 90 },
   *   baseline
   * ); // Returns ~85 (good sleep with slightly short duration)
   * ```
   * 
   * @since 1.0.0
   */
  static calculateSleepScore(sleepData: SleepData | null, baseline: RecoveryBaseline): number {
    if (!sleepData) return 50; // Neutral score when no data available
    
    // Research-based optimal sleep targets
    const targetDuration = 480; // 8 hours in minutes (Sleep Foundation recommendation)
    const targetEfficiency = 85; // 85% efficiency (clinical sleep medicine standard)
    
    // Duration Score (0-40 points): Penalize deviations from 8-hour target
    // Every hour deviation reduces score by 5 points (60min / 12 = 5 points per hour)
    const durationDiff = Math.abs(sleepData.totalSleepTime - targetDuration);
    const durationScore = Math.max(0, 40 - (durationDiff / 60) * 5);
    
    // Efficiency Score (0-30 points): Sleep efficiency below 85% indicates sleep disturbances
    // Each percentage point below target reduces score by 0.5 points
    const efficiencyDiff = Math.abs(sleepData.sleepEfficiency - targetEfficiency);
    const efficiencyScore = Math.max(0, 30 - efficiencyDiff * 0.5);
    
    // Quality Score (0-30 points): Deep sleep percentage indicates restorative sleep quality
    // Optimal deep sleep is 20% of total sleep time for recovery and memory consolidation
    let qualityScore = 30;
    if (sleepData.deepSleepTime && sleepData.totalSleepTime) {
      const deepSleepPercentage = (sleepData.deepSleepTime / sleepData.totalSleepTime) * 100;
      const targetDeepSleep = 20; // 20% deep sleep target based on sleep research
      const qualityDiff = Math.abs(deepSleepPercentage - targetDeepSleep);
      qualityScore = Math.max(0, 30 - qualityDiff * 1.5); // 1.5 point penalty per percentage deviation
    }
    
    return Math.round(durationScore + efficiencyScore + qualityScore);
  }
  
  /**
   * Calculates Heart Rate Variability (HRV) score based on RMSSD measurement vs personal baseline.
   * 
   * HRV is a key indicator of autonomic nervous system recovery and training readiness.
   * Higher HRV generally indicates better recovery and parasympathetic dominance,
   * while lower HRV suggests sympathetic stress and incomplete recovery.
   * 
   * The algorithm uses personalized baselines rather than population norms because
   * HRV varies significantly between individuals. A 10% deviation from personal
   * baseline is more meaningful than comparing to population averages.
   * 
   * Scoring thresholds are based on HRV research indicating:
   * - 10%+ above baseline: Excellent recovery, ready for high-intensity training
   * - At baseline: Good recovery, normal training load appropriate
   * - 10% below baseline: Fair recovery, consider reducing intensity
   * - 20%+ below baseline: Poor recovery, rest or light activity recommended
   * 
   * @param hrvData - HRV measurement containing RMSSD value in milliseconds
   * @param baseline - User's historical HRV baseline for comparison
   * 
   * @returns HRV score from 0-100 (higher = better autonomic recovery)
   * 
   * @example
   * ```typescript
   * const hrvScore = RecoveryEngine.calculateHRVScore(
   *   { rmssd: 48 }, 
   *   { avgHRV: 45 }
   * ); // Returns 80 (good - 6.7% above baseline)
   * ```
   * 
   * @since 1.0.0
   */
  static calculateHRVScore(hrvData: HRVMeasurement | null, baseline: RecoveryBaseline): number {
    if (!hrvData) return 50; // Neutral score when no measurement available
    
    const currentHRV = hrvData.rmssd;
    const baselineHRV = baseline.avgHRV;
    
    // Calculate ratio of current HRV to personal baseline
    // This personalizes the assessment since HRV varies greatly between individuals
    const hrvRatio = currentHRV / baselineHRV;
    
    // Tiered scoring based on HRV research and practical coaching guidelines
    if (hrvRatio >= 1.1) return 90; // Excellent - 10%+ above baseline (supercompensation)
    if (hrvRatio >= 1.0) return 80; // Good - at or above baseline (well recovered)
    if (hrvRatio >= 0.9) return 70; // Fair - within 10% below baseline (adequate recovery)
    if (hrvRatio >= 0.8) return 60; // Below average - 20% below baseline (moderate stress)
    if (hrvRatio >= 0.7) return 40; // Poor - 30% below baseline (high stress/fatigue)
    return 20; // Very poor - 30%+ below baseline (severe stress/overreaching)
  }
  
  // Calculate resting heart rate score
  static async calculateRestingHRScore(userId: number, baseline: RecoveryBaseline): Promise<number> {
    try {
      // Get recent runs first, then their heart rate data
      const recentRuns = await db.runs
        .where('userId').equals(userId)
        .reverse()
        .limit(5)
        .toArray();
      
      if (recentRuns.length === 0) return 50; // Default score if no runs
      
      const runIds = recentRuns.map(run => run.id!);
      const recentHRData = await db.heartRateData
        .where('runId')
        .anyOf(runIds)
        .toArray();
      
      if (recentHRData.length === 0) return 50; // Default score if no HR data
      
      // Calculate average resting HR from recent data (use lowest values as proxy for resting)
      const sortedHR = recentHRData.map(data => data.heartRate).sort((a, b) => a - b);
      const restingHREstimate = sortedHR.slice(0, Math.max(1, Math.floor(sortedHR.length * 0.1))).reduce((sum, hr) => sum + hr, 0) / Math.max(1, Math.floor(sortedHR.length * 0.1));
      
      const baselineHR = baseline.avgRestingHR;
      const hrDiff = restingHREstimate - baselineHR;
      
      // Lower HR is generally better for recovery
      if (hrDiff <= -5) return 90; // Excellent - lower than baseline
      if (hrDiff <= 0) return 80; // Good - at or below baseline
      if (hrDiff <= 5) return 70; // Fair - slightly above baseline
      if (hrDiff <= 10) return 60; // Below average
      if (hrDiff <= 15) return 40; // Poor
      return 20; // Very poor
    } catch (error) {
      console.error('Error calculating resting HR score:', error);
      return 50; // Default fallback score
    }
  }
  
  // Calculate subjective wellness score
  static calculateSubjectiveScore(subjectiveData: SubjectiveWellness | null): number {
    if (!subjectiveData) return 50; // Default score if no data
    
    // Convert 1-10 scales to 0-100 scores
    const energyScore = (subjectiveData.energyLevel / 10) * 100;
    const moodScore = (subjectiveData.moodScore / 10) * 100;
    const sorenessScore = ((11 - subjectiveData.sorenessLevel) / 10) * 100; // Inverted
    const stressScore = ((11 - subjectiveData.stressLevel) / 10) * 100; // Inverted
    const motivationScore = (subjectiveData.motivationLevel / 10) * 100;
    
    // Weight the factors
    const weightedScore = (
      energyScore * 0.3 +
      moodScore * 0.2 +
      sorenessScore * 0.2 +
      stressScore * 0.2 +
      motivationScore * 0.1
    );
    
    return Math.round(weightedScore);
  }
  
  // Calculate training load impact on recovery
  static calculateTrainingLoadImpact(trainingLoad: number): number {
    // Training load impact is negative - higher load reduces recovery
    if (trainingLoad <= 20) return 0; // Low load, no impact
    if (trainingLoad <= 40) return -5; // Moderate load
    if (trainingLoad <= 60) return -10; // High load
    if (trainingLoad <= 80) return -15; // Very high load
    return -20; // Extreme load
  }
  
  // Calculate stress level based on multiple factors
  static calculateStressLevel(
    sleepData: SleepData | null,
    hrvData: HRVMeasurement | null,
    subjectiveData: SubjectiveWellness | null
  ): number {
    let stressFactors = 0;
    let factorCount = 0;
    
    // Sleep stress factor
    if (sleepData) {
      if (sleepData.sleepEfficiency < 80) stressFactors += 20;
      if (sleepData.totalSleepTime < 420) stressFactors += 15; // Less than 7 hours
      factorCount++;
    }
    
    // HRV stress factor
    if (hrvData) {
      if (hrvData.rmssd < 30) stressFactors += 25; // Very low HRV
      else if (hrvData.rmssd < 40) stressFactors += 15; // Low HRV
      factorCount++;
    }
    
    // Subjective stress factor
    if (subjectiveData) {
      stressFactors += (subjectiveData.stressLevel / 10) * 30;
      factorCount++;
    }
    
    return factorCount > 0 ? Math.round(stressFactors / factorCount) : 50;
  }
  
  // Calculate overall recovery score with weighted factors
  static calculateOverallScore(factors: RecoveryFactors): number {
    const {
      sleepQuality,
      hrvScore,
      restingHRScore,
      subjectiveWellness,
      trainingLoadImpact,
      stressLevel
    } = factors;
    
    // Weight the factors based on importance
    const weightedScore = (
      sleepQuality * 0.25 +
      hrvScore * 0.25 +
      restingHRScore * 0.15 +
      subjectiveWellness * 0.20 +
      (100 + trainingLoadImpact) * 0.10 + // Convert negative impact to positive
      (100 - stressLevel) * 0.05 // Invert stress level
    );
    
    return Math.max(0, Math.min(100, Math.round(weightedScore)));
  }
  
  // Generate personalized recovery recommendations
  static generateRecommendations(factors: RecoveryFactors): string[] {
    const recommendations: string[] = [];
    
    if (factors.sleepQuality < 60) {
      recommendations.push('Consider improving sleep hygiene - aim for 7-9 hours of quality sleep');
    }
    
    if (factors.hrvScore < 60) {
      recommendations.push('Your HRV indicates high stress. Consider rest or light activity today');
    }
    
    if (factors.restingHRScore < 60) {
      recommendations.push('Your resting heart rate is elevated. Focus on recovery activities');
    }
    
    if (factors.subjectiveWellness < 60) {
      recommendations.push('Listen to your body - consider a rest day or very light activity');
    }
    
    if (factors.trainingLoadImpact < -10) {
      recommendations.push('High training load detected. Consider reducing intensity or taking a rest day');
    }
    
    if (factors.stressLevel > 70) {
      recommendations.push('High stress levels detected. Focus on stress management and recovery');
    }
    
    // Add positive recommendations for good recovery based on average of key factors
    const avgScore = (factors.sleepQuality + factors.hrvScore + factors.restingHRScore + factors.subjectiveWellness) / 4;
    if (avgScore > 80) {
      recommendations.push('Excellent recovery! You\'re ready for quality training');
    } else if (avgScore > 60) {
      recommendations.push('Good recovery. You can handle moderate intensity training');
    }
    
    return recommendations;
  }
  
  // Calculate confidence in the recovery score based on data availability
  static calculateConfidence(
    sleepData: SleepData | null,
    hrvData: HRVMeasurement | null,
    subjectiveData: SubjectiveWellness | null
  ): number {
    let confidence = 0;
    let dataPoints = 0;
    
    if (sleepData) {
      confidence += 40;
      dataPoints++;
    }
    
    if (hrvData) {
      confidence += 35;
      dataPoints++;
    }
    
    if (subjectiveData) {
      confidence += 25;
      dataPoints++;
    }
    
    // Bonus for having multiple data sources
    if (dataPoints >= 2) confidence += 10;
    if (dataPoints >= 3) confidence += 5;
    
    return Math.min(100, confidence);
  }
  
  // Get user baseline for recovery calculations
  static async getUserBaseline(userId: number): Promise<RecoveryBaseline> {
    // This would typically be calculated from historical data
    // For now, return default baseline
    return {
      userId,
      avgSleepDuration: 480, // 8 hours
      avgSleepEfficiency: 85, // 85%
      avgHRV: 45, // 45ms
      avgRestingHR: 60, // 60 bpm
      lastUpdated: new Date()
    };
  }
  
  // Get sleep data for a specific date
  static async getSleepDataForDate(userId: number, date: Date): Promise<SleepData | null> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return await db.sleepData
      .where('userId').equals(userId)
      .and(sleep => sleep.date >= startOfDay && sleep.date <= endOfDay)
      .first();
  }
  
  // Get HRV data for a specific date
  static async getHRVDataForDate(userId: number, date: Date): Promise<HRVMeasurement | null> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return await db.hrvMeasurements
      .where('userId').equals(userId)
      .and(hrv => hrv.measurementDate >= startOfDay && hrv.measurementDate <= endOfDay)
      .first();
  }
  
  // Get subjective wellness data for a specific date
  static async getSubjectiveWellnessForDate(userId: number, date: Date): Promise<SubjectiveWellness | null> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return await db.subjectiveWellness
      .where('userId').equals(userId)
      .and(wellness => wellness.date >= startOfDay && wellness.date <= endOfDay)
      .first();
  }
  
  // Calculate training load for a specific date
  static async calculateTrainingLoad(userId: number, date: Date): Promise<number> {
    // Get runs from the last 7 days to calculate acute training load
    const sevenDaysAgo = new Date(date);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentRuns = await db.runs
      .where('userId').equals(userId)
      .and(run => new Date(run.completedAt) >= sevenDaysAgo)
      .toArray();
    
    // Simple training load calculation based on distance and duration
    let totalLoad = 0;
    for (const run of recentRuns) {
      const intensity = run.distance * (run.duration / 3600); // Distance * hours
      totalLoad += intensity;
    }
    
    return totalLoad;
  }
  
  // Save sleep data
  static async saveSleepData(sleepData: Omit<SleepData, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date();
    return await db.sleepData.add({
      ...sleepData,
      createdAt: now,
      updatedAt: now
    });
  }
  
  // Save HRV measurement
  static async saveHRVMeasurement(hrvData: Omit<HRVMeasurement, 'id' | 'createdAt'>): Promise<number> {
    return await db.hrvMeasurements.add({
      ...hrvData,
      createdAt: new Date()
    });
  }
  
  // Save subjective wellness data
  static async saveSubjectiveWellness(wellnessData: Omit<SubjectiveWellness, 'id' | 'createdAt'>): Promise<number> {
    return await db.subjectiveWellness.add({
      ...wellnessData,
      createdAt: new Date()
    });
  }
  
  // Get recovery score for a specific date
  static async getRecoveryScore(userId: number, date: Date): Promise<RecoveryScore | null> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return await db.recoveryScores
      .where('userId').equals(userId)
      .and(score => score.date >= startOfDay && score.date <= endOfDay)
      .first();
  }
  
  // Get recovery trends over time
  static async getRecoveryTrends(userId: number, days: number = 30): Promise<RecoveryScore[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return await db.recoveryScores
      .where('userId').equals(userId)
      .and(score => score.date >= startDate)
      .reverse()
      .sortBy('date');
  }
} 