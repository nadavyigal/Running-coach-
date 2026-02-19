import { db, SleepData, HRVMeasurement, RecoveryScore, SubjectiveWellness, type GarminSummaryRecord } from './db';
import { deriveGarminRecoverySignals, getGarminRecoveryDatasets, type GarminRecoverySignals } from './garminRecoverySignals';
import {
  calculateBaselinePace,
  estimatePaceEffort,
  getEffortMultiplier,
  normalizeRunPaceSecondsPerKm,
} from './pace-effort-estimator';
import { PersonalizationContext } from './personalizationContext';

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
  /** Behavioral adherence score (0-100) based on consistency */
  behavioralScore?: number;
  /** Weekly load increase percentage */
  loadIncreasePct?: number;
}

/**
 * Core recovery analysis engine for calculating personalized recovery scores.
 * 
 * This class provides static methods for comprehensive recovery assessment by
 * integrating multiple data sources including sleep metrics, HRV measurements,
 * subjective wellness reports, and training load calculations.
 */
export class RecoveryEngine {
  private static getHrvValue(hrvData: HRVMeasurement | null): number | null {
    if (!hrvData) return null;
    const candidate = typeof hrvData.hrvValue === 'number' ? hrvData.hrvValue : null;
    if (candidate != null && Number.isFinite(candidate)) return candidate;

    const legacy = (hrvData as unknown as { rmssd?: unknown }).rmssd;
    return typeof legacy === 'number' && Number.isFinite(legacy) ? legacy : null;
  }

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
      const loadIncreasePct = await this.calculateWeeklyLoadIncrease(userId, date);
      const behavioralScore = await this.calculateBehavioralScore(userId, date);
      const hasWearableSignals = await this.hasHeartRateData(userId, date);
      const garminSignals = await this.getGarminRecoverySignalsForDate(userId, date);
      
      // Calculate individual scores
      const sleepScore = this.calculateSleepScore(sleepData, baseline);
      const hrvScore = this.calculateHRVScore(hrvData, baseline);
      const restingHRScore = await this.calculateRestingHRScore(
        userId,
        baseline,
        garminSignals.restingHeartRate
      );
      const subjectiveScore = this.calculateSubjectiveScore(subjectiveData);
      const trainingLoadImpact = this.calculateTrainingLoadImpact(trainingLoad, garminSignals);
      const stressLevel = this.calculateStressLevel(sleepData, hrvData, subjectiveData, garminSignals);
      const phoneOnly = !hrvData && !hasWearableSignals && !garminSignals.hasSignals;
      
      // Calculate overall score with weighted factors
      const overallScore = this.calculateOverallScore({
        sleepQuality: sleepScore,
        hrvScore,
        restingHRScore,
        subjectiveWellness: subjectiveScore,
        trainingLoadImpact,
        stressLevel,
        behavioralScore,
        ...(typeof loadIncreasePct === 'number' ? { loadIncreasePct } : {})
      }, { phoneOnly });
      
      // Generate recommendations
      const recommendations = this.generateRecommendations({
        sleepQuality: sleepScore,
        hrvScore,
        restingHRScore,
        subjectiveWellness: subjectiveScore,
        trainingLoadImpact,
        stressLevel,
        behavioralScore,
        ...(typeof loadIncreasePct === 'number' ? { loadIncreasePct } : {})
      });
      
      // Calculate confidence based on data availability
      const confidence = this.calculateConfidence(sleepData, hrvData, subjectiveData, garminSignals);
      
      const recoveryScore: RecoveryScore = {
        userId,
        date,
        scoreDate: date,
        overallScore,
        sleepScore,
        hrvScore,
        restingHRScore,
        subjectiveWellnessScore: subjectiveScore,
        trainingLoadImpact,
        stressLevel,
        readinessScore: overallScore,
        recommendations,
        confidence,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Save to database
      const id = await db.recoveryScores.add(recoveryScore);
      return typeof id === 'number' ? { ...recoveryScore, id } : recoveryScore;
      
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
    const targetDuration = baseline.avgSleepDuration || 480; // Default to 8 hours when baseline unavailable
    const targetEfficiency = baseline.avgSleepEfficiency || 85; // Default to 85% when baseline unavailable
    
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

    const currentHRV = this.getHrvValue(hrvData);
    if (currentHRV == null) return 50;
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
  
  private static scoreRestingHeartRateValue(restingHeartRate: number, baselineRestingHeartRate: number): number {
    const hrDiff = restingHeartRate - baselineRestingHeartRate;

    // Lower-than-baseline resting HR typically indicates better recovery.
    if (hrDiff <= -5) return 90;
    if (hrDiff <= 0) return 80;
    if (hrDiff <= 5) return 70;
    if (hrDiff <= 10) return 60;
    if (hrDiff <= 15) return 40;
    return 20;
  }

  // Calculate resting heart rate score
  static async calculateRestingHRScore(
    userId: number,
    baseline: RecoveryBaseline,
    garminRestingHeartRate?: number | null
  ): Promise<number> {
    try {
      // Get recent runs first, then their heart rate data
      const recentRuns = await db.runs
        .where('userId').equals(userId)
        .reverse()
        .limit(5)
        .toArray();

      const baselineHR = baseline.avgRestingHR;
      let runDerivedScore: number | null = null;

      if (recentRuns.length > 0) {
        const runIds = recentRuns.map(run => run.id).filter((id): id is number => typeof id === 'number');
        if (runIds.length > 0) {
          const recentHRData = await db.heartRateData
            .where('runId')
            .anyOf(runIds)
            .toArray();

          if (recentHRData.length > 0) {
            // Use lowest 10% HR samples as a proxy for resting HR.
            const sortedHR = recentHRData.map(data => data.heartRate).sort((a, b) => a - b);
            const lowSampleCount = Math.max(1, Math.floor(sortedHR.length * 0.1));
            const restingHREstimate =
              sortedHR.slice(0, lowSampleCount).reduce((sum, hr) => sum + hr, 0) / lowSampleCount;
            runDerivedScore = this.scoreRestingHeartRateValue(restingHREstimate, baselineHR);
          }
        }
      }

      const garminScore =
        typeof garminRestingHeartRate === 'number' && Number.isFinite(garminRestingHeartRate)
          ? this.scoreRestingHeartRateValue(garminRestingHeartRate, baselineHR)
          : null;

      if (runDerivedScore != null && garminScore != null) {
        return Math.round(runDerivedScore * 0.6 + garminScore * 0.4);
      }

      if (runDerivedScore != null) return runDerivedScore;
      if (garminScore != null) return garminScore;
      return 50; // Default score when no resting HR signals are available.
    } catch (error) {
      console.error('Error calculating resting HR score:', error);
      return 50; // Default fallback score
    }
  }
  
  // Calculate subjective wellness score
  static calculateSubjectiveScore(subjectiveData: SubjectiveWellness | null): number {
    if (!subjectiveData) return 50; // Default score if no data
    
    // Convert 1-10 scales to 0-100 scores
    const energyLevel = subjectiveData.energyLevel ?? subjectiveData.overallWellness ?? 5;
    const moodLevel = subjectiveData.moodScore ?? subjectiveData.mood ?? 5;
    const sorenessLevel = subjectiveData.sorenessLevel ?? subjectiveData.soreness ?? 5;
    const stressLevel = subjectiveData.stressLevel ?? 5;
    const motivationLevel = subjectiveData.motivationLevel ?? subjectiveData.motivation ?? 5;

    const energyScore = (energyLevel / 10) * 100;
    const moodScore = (moodLevel / 10) * 100;
    const sorenessScore = ((11 - sorenessLevel) / 10) * 100; // Inverted
    const stressScore = ((11 - stressLevel) / 10) * 100; // Inverted
    const motivationScore = (motivationLevel / 10) * 100;
    
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
  static calculateTrainingLoadImpact(
    trainingLoad: number,
    garminSignals?: GarminRecoverySignals
  ): number {
    // Training load impact is negative - higher load reduces recovery
    let impact = 0;
    if (trainingLoad <= 20) impact = 0; // Low load, no impact
    else if (trainingLoad <= 40) impact = -5; // Moderate load
    else if (trainingLoad <= 60) impact = -10; // High load
    else if (trainingLoad <= 80) impact = -15; // Very high load
    else impact = -20; // Extreme load

    // Add Garmin-derived active-time load from epochs/dailies.
    if (garminSignals?.activeMinutes != null) {
      if (garminSignals.activeMinutes >= 180) impact -= 6;
      else if (garminSignals.activeMinutes >= 120) impact -= 4;
      else if (garminSignals.activeMinutes >= 90) impact -= 2;
    }

    return Math.max(-25, impact);
  }
  
  // Calculate stress level based on multiple factors
  static calculateStressLevel(
    sleepData: SleepData | null,
    hrvData: HRVMeasurement | null,
    subjectiveData: SubjectiveWellness | null,
    garminSignals?: GarminRecoverySignals
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
      const hrvValue = this.getHrvValue(hrvData);
      if (hrvValue != null) {
        if (hrvValue < 30) stressFactors += 25; // Very low HRV
        else if (hrvValue < 40) stressFactors += 15; // Low HRV
        factorCount++;
      }
    }
    
    // Subjective stress factor
    if (subjectiveData) {
      const subjectiveStress =
        typeof subjectiveData.stressLevel === 'number' ? subjectiveData.stressLevel : 5;
      stressFactors += (subjectiveStress / 10) * 30;
      factorCount++;
    }

    if (garminSignals?.stressLevel != null) {
      stressFactors += garminSignals.stressLevel;
      factorCount++;
    }

    // Elevated respiration can indicate autonomic strain or poor recovery.
    if (garminSignals?.respirationRate != null) {
      if (garminSignals.respirationRate >= 20) stressFactors += 80;
      else if (garminSignals.respirationRate >= 18) stressFactors += 65;
      else if (garminSignals.respirationRate >= 16) stressFactors += 50;
      else stressFactors += 35;
      factorCount++;
    }

    if (garminSignals?.activeMinutes != null) {
      if (garminSignals.activeMinutes >= 180) stressFactors += 75;
      else if (garminSignals.activeMinutes >= 120) stressFactors += 65;
      else if (garminSignals.activeMinutes >= 90) stressFactors += 55;
      else stressFactors += 45;
      factorCount++;
    }

    return factorCount > 0 ? Math.round(stressFactors / factorCount) : 50;
  }
  
  // Calculate overall recovery score with weighted factors
  static calculateOverallScore(
    factors: RecoveryFactors,
    options?: { phoneOnly?: boolean }
  ): number {
    const {
      sleepQuality,
      hrvScore,
      restingHRScore,
      subjectiveWellness,
      trainingLoadImpact,
      stressLevel,
      behavioralScore
    } = factors;

    if (options?.phoneOnly) {
      const trainingLoadScore = Math.max(0, Math.min(100, 100 + trainingLoadImpact));
      const behaviorScore =
        typeof behavioralScore === 'number' && Number.isFinite(behavioralScore)
          ? behavioralScore
          : 50;
      const weightedScore =
        subjectiveWellness * 0.4 +
        trainingLoadScore * 0.25 +
        sleepQuality * 0.25 +
        behaviorScore * 0.10;
      return Math.max(0, Math.min(100, Math.round(weightedScore)));
    }

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

    if (typeof factors.loadIncreasePct === 'number' && factors.loadIncreasePct > 10) {
      recommendations.push(
        `Your weekly volume increased by ${Math.round(factors.loadIncreasePct)}%. Consider an easier day to stay under the 10% rule`
      );
    }

    if (typeof factors.behavioralScore === 'number' && factors.behavioralScore < 50) {
      recommendations.push('Consistency dipped recently. Aim for one easy run to rebuild the habit');
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
    subjectiveData: SubjectiveWellness | null,
    garminSignals?: GarminRecoverySignals
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

    if (garminSignals?.hasSignals) {
      confidence += 20;
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
    
    return (await db.sleepData
      .where('userId').equals(userId)
      .and((sleep) => {
        const sleepDate = sleep.sleepDate ?? sleep.date;
        if (!sleepDate) return false;
        return sleepDate >= startOfDay && sleepDate <= endOfDay;
      })
      .first()) ?? null;
  }
  
  // Get HRV data for a specific date
  static async getHRVDataForDate(userId: number, date: Date): Promise<HRVMeasurement | null> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return (await db.hrvMeasurements
      .where('userId').equals(userId)
      .and(hrv => hrv.measurementDate >= startOfDay && hrv.measurementDate <= endOfDay)
      .first()) ?? null;
  }
  
  // Get subjective wellness data for a specific date
  static async getSubjectiveWellnessForDate(userId: number, date: Date): Promise<SubjectiveWellness | null> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return (await db.subjectiveWellness
      .where('userId').equals(userId)
      .and((wellness) => {
        const wellnessDate = wellness.assessmentDate ?? wellness.date;
        if (!wellnessDate) return false;
        return wellnessDate >= startOfDay && wellnessDate <= endOfDay;
      })
      .first()) ?? null;
  }

  static async getGarminRecoverySignalsForDate(
    userId: number,
    date: Date
  ): Promise<GarminRecoverySignals> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const recoveryDatasets = getGarminRecoveryDatasets();
    const rows = await db.garminSummaryRecords
      .where('[userId+recordedAt]')
      .between([userId, startOfDay], [userId, endOfDay], true, true)
      .toArray();

    const filteredRows = rows.filter((row) =>
      recoveryDatasets.has(row.datasetKey)
    ) as GarminSummaryRecord[];

    return deriveGarminRecoverySignals(filteredRows);
  }
  
  // Calculate training load for a specific date
  static async calculateTrainingLoad(userId: number, date: Date): Promise<number> {
    // Get runs from the last 7 days to calculate acute training load
    const sevenDaysAgo = new Date(date);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const baselineStart = new Date(date);
    baselineStart.setDate(baselineStart.getDate() - 28);
    
    const recentRuns = await db.runs
      .where('userId').equals(userId)
      .and(run => new Date(run.completedAt) >= sevenDaysAgo)
      .toArray();

    const baselineRuns = await db.runs
      .where('userId').equals(userId)
      .and(run => new Date(run.completedAt) >= baselineStart)
      .toArray();
    const baselinePace = calculateBaselinePace(baselineRuns);
    
    // Simple training load calculation based on distance and duration
    let totalLoad = 0;
    for (const run of recentRuns) {
      const paceSeconds = normalizeRunPaceSecondsPerKm(run);
      const effort = baselinePace && paceSeconds
        ? estimatePaceEffort(paceSeconds, baselinePace)
        : 'moderate';
      const effortMultiplier = getEffortMultiplier(effort);
      const intensity = run.distance * (run.duration / 3600) * effortMultiplier; // Distance * hours * effort
      totalLoad += intensity;
    }
    
    return totalLoad;
  }

  static async calculateWeeklyLoadIncrease(userId: number, date: Date): Promise<number | null> {
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    const currentStart = new Date(endDate);
    currentStart.setDate(currentStart.getDate() - 7);
    currentStart.setHours(0, 0, 0, 0);

    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - 7);
    previousStart.setHours(0, 0, 0, 0);

    const runs = await db.runs
      .where('userId').equals(userId)
      .and(run => {
        const completedAt = new Date(run.completedAt);
        return completedAt >= previousStart && completedAt <= endDate;
      })
      .toArray();

    let currentTotal = 0;
    let previousTotal = 0;
    runs.forEach((run) => {
      const completedAt = new Date(run.completedAt);
      const distance = Number.isFinite(run.distance) ? run.distance : 0;
      if (completedAt >= currentStart) {
        currentTotal += distance;
      } else {
        previousTotal += distance;
      }
    });

    if (!Number.isFinite(previousTotal) || previousTotal <= 0) {
      return null;
    }

    return ((currentTotal - previousTotal) / previousTotal) * 100;
  }

  static async calculateBehavioralScore(userId: number, date: Date): Promise<number> {
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const [user, runs, wellnessEntries] = await Promise.all([
      db.users.get(userId),
      db.runs.where('userId').equals(userId).and(run => new Date(run.completedAt) >= weekStart).toArray(),
      db.subjectiveWellness.where('userId').equals(userId).and((wellness) => {
        const wellnessDate = wellness.assessmentDate ?? wellness.date;
        return wellnessDate ? wellnessDate >= weekStart : false;
      }).toArray()
    ]);

    const targetDays = user?.daysPerWeek ?? 3;
    const runCount = runs.length;
    let adherenceScore = Math.round((runCount / Math.max(targetDays, 1)) * 100);
    adherenceScore = Math.min(100, adherenceScore);

    const motivationScores = wellnessEntries
      .map((entry) => entry.motivationLevel ?? entry.motivation)
      .filter((value): value is number => Number.isFinite(value));
    const avgMotivation = motivationScores.length > 0
      ? motivationScores.reduce((sum, value) => sum + value, 0) / motivationScores.length
      : null;

    if (avgMotivation !== null && avgMotivation < 5) {
      adherenceScore = Math.max(0, adherenceScore - 10);
    }

    return adherenceScore;
  }

  static async hasHeartRateData(userId: number, date: Date): Promise<boolean> {
    const since = new Date(date);
    since.setDate(since.getDate() - 30);
    const recentHrv = await db.hrvMeasurements
      .where('userId').equals(userId)
      .and(hrv => hrv.measurementDate >= since)
      .limit(1)
      .first();

    return Boolean(recentHrv);
  }
  
  // Save sleep data
  static async saveSleepData(sleepData: Omit<SleepData, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date();
    const resolvedSleepDate = sleepData.sleepDate ?? sleepData.date ?? now;
    const id = await db.sleepData.add({
      ...sleepData,
      sleepDate: resolvedSleepDate,
      date: sleepData.date ?? resolvedSleepDate,
      createdAt: now,
      updatedAt: now
    });
    return typeof id === 'number' ? id : 0;
  }
  
  // Save HRV measurement
  static async saveHRVMeasurement(hrvData: Omit<HRVMeasurement, 'id' | 'createdAt'>): Promise<number> {
    const id = await db.hrvMeasurements.add({
      ...hrvData,
      createdAt: new Date()
    });
    return typeof id === 'number' ? id : 0;
  }
  
  // Save subjective wellness data
  static async saveSubjectiveWellness(wellnessData: Omit<SubjectiveWellness, 'id' | 'createdAt'>): Promise<number> {
    const resolvedDate = wellnessData.assessmentDate ?? wellnessData.date ?? new Date();
    const id = await db.subjectiveWellness.add({
      ...wellnessData,
      assessmentDate: resolvedDate,
      date: wellnessData.date ?? resolvedDate,
      createdAt: new Date()
    });
    return typeof id === 'number' ? id : 0;
  }
  
  // Get recovery score for a specific date
  static async getRecoveryScore(userId: number, date: Date): Promise<RecoveryScore | null> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return (await db.recoveryScores
      .where('userId').equals(userId)
      .and((score) => {
        const scoreDate = score.scoreDate ?? score.date;
        if (!scoreDate) return false;
        return scoreDate >= startOfDay && scoreDate <= endOfDay;
      })
      .first()) ?? null;
  }
  
  // Get recovery trends over time
  static async getRecoveryTrends(userId: number, days: number = 30): Promise<RecoveryScore[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await db.recoveryScores
      .where('userId').equals(userId)
      .and((score) => {
        const scoreDate = score.scoreDate ?? score.date;
        if (!scoreDate) return false;
        return scoreDate >= startDate;
      })
      .reverse()
      .sortBy('scoreDate');
  }

  /**
   * Generate personalized recovery recommendations based on user profile and context
   * @param userId - User ID
   * @param recoveryScore - Current recovery score
   * @param context - Personalization context
   * @returns Personalized recommendations
   */
  static async generatePersonalizedRecommendations(
    _userId: number,
    recoveryScore: RecoveryScore,
    context: PersonalizationContext
  ): Promise<string[]> {
    // Start with base recommendations
    const baseRecs = this.generateRecommendations({
      sleepQuality: recoveryScore.sleepScore,
      hrvScore: recoveryScore.hrvScore,
      restingHRScore: recoveryScore.restingHRScore,
      subjectiveWellness: recoveryScore.subjectiveWellnessScore,
      trainingLoadImpact: recoveryScore.trainingLoadImpact,
      stressLevel: recoveryScore.stressLevel,
    });

    // Apply coaching style to all recommendations
    const styledRecs = baseRecs.map((rec) =>
      this.applyCoachingStyle(rec, context.userProfile.coachingStyle)
    );

    // Add goal-specific recommendations
    const goalRecs = this.getGoalSpecificRecoveryAdvice(
      recoveryScore.overallScore,
      context.userProfile.goal
    );

    // Add barrier-specific recommendations
    const barrierRecs = context.userProfile.barriers
      .map((barrier) => this.getBarrierSpecificRecoveryAdvice(barrier, recoveryScore.overallScore))
      .filter((rec) => rec !== null) as string[];

    // Add motivation-based framing
    const motivationFrame = this.selectMotivationalFrame(
      context.userProfile.motivations,
      context.userProfile.coachingStyle
    );

    // Combine all recommendations with motivation framing
    const allRecs = [...styledRecs, ...goalRecs, ...barrierRecs];

    // Apply motivation frame to first recommendation if available
    if (allRecs.length > 0 && motivationFrame) {
      allRecs[0] = `${motivationFrame} ${allRecs[0]}`;
    }

    return allRecs;
  }

  /**
   * Apply coaching style to a recommendation
   * @param recommendation - Base recommendation text
   * @param style - User's preferred coaching style
   * @returns Styled recommendation
   */
  private static applyCoachingStyle(
    recommendation: string,
    style: 'supportive' | 'challenging' | 'analytical' | 'encouraging'
  ): string {
    const styleTemplates = {
      supportive: (rec: string) => `Take care of yourself: ${rec}`,
      challenging: (rec: string) => `Push smart: ${rec}`,
      analytical: (rec: string) => `Data shows: ${rec}`,
      encouraging: (rec: string) => `Great progress! ${rec}`,
    };

    // Apply style template
    const template = styleTemplates[style];
    return template ? template(recommendation) : recommendation;
  }

  /**
   * Get goal-specific recovery advice
   * @param recoveryScore - Current recovery score
   * @param goal - User's primary goal
   * @returns Goal-specific recommendations
   */
  private static getGoalSpecificRecoveryAdvice(
    recoveryScore: number,
    goal: 'habit' | 'distance' | 'speed'
  ): string[] {
    const recs: string[] = [];

    if (goal === 'habit') {
      if (recoveryScore < 60) {
        recs.push(
          'Maintain your streak with a light recovery walk or easy jog today'
        );
      } else {
        recs.push('Your recovery supports your consistency goal - keep it going!');
      }
    } else if (goal === 'distance') {
      if (recoveryScore < 60) {
        recs.push(
          'Focus on aerobic base recovery - save long runs for when you\'re fully recovered'
        );
      } else {
        recs.push(
          'Good recovery for building endurance - ready for progressive mileage'
        );
      }
    } else if (goal === 'speed') {
      if (recoveryScore < 60) {
        recs.push(
          'Skip high-intensity work today - speed training requires full recovery'
        );
      } else {
        recs.push('Optimal recovery for quality speed work - your intervals will benefit');
      }
    }

    return recs;
  }

  /**
   * Get barrier-specific recovery advice
   * @param barrier - User's barrier
   * @param recoveryScore - Current recovery score
   * @returns Barrier-specific recommendation or null
   */
  private static getBarrierSpecificRecoveryAdvice(
    barrier: string,
    recoveryScore: number
  ): string | null {
    const lowerBarrier = barrier.toLowerCase();

    if (lowerBarrier.includes('time')) {
      return 'Quick 10-min recovery routine: light stretching and foam rolling';
    }

    if (lowerBarrier.includes('motivation') || lowerBarrier.includes('tired')) {
      if (recoveryScore < 60) {
        return 'Small steps count - even light movement aids recovery';
      }
    }

    if (lowerBarrier.includes('sleep')) {
      return 'Prioritize sleep quality tonight - it\'s your best recovery tool';
    }

    return null;
  }

  /**
   * Select motivational frame based on user motivations
   * @param motivations - User's motivations
   * @param coachingStyle - User's coaching style
   * @returns Motivational frame or empty string
   */
  private static selectMotivationalFrame(
    motivations: string[],
    _coachingStyle: string
  ): string {
    if (motivations.length === 0) return '';

    const firstMotivation = (motivations[0] ?? '').toLowerCase();

    if (firstMotivation.includes('health')) {
      return '💚 For your health:';
    }

    if (firstMotivation.includes('stress') || firstMotivation.includes('mental')) {
      return '🧠 For your mental wellbeing:';
    }

    if (firstMotivation.includes('race') || firstMotivation.includes('performance')) {
      return '🏃 To achieve your race goals:';
    }

    if (firstMotivation.includes('weight') || firstMotivation.includes('fitness')) {
      return '💪 For your fitness journey:';
    }

    return '';
  }
} 
