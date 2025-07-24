import { db, SleepData, HRVMeasurement, RecoveryScore, SubjectiveWellness, User } from './db';

// Recovery score calculation algorithms
export interface RecoveryBaseline {
  userId: number;
  avgSleepDuration: number; // minutes
  avgSleepEfficiency: number; // percentage
  avgHRV: number; // milliseconds
  avgRestingHR: number; // bpm
  lastUpdated: Date;
}

export interface RecoveryFactors {
  sleepQuality: number; // 0-100
  hrvScore: number; // 0-100
  restingHRScore: number; // 0-100
  subjectiveWellness: number; // 0-100
  trainingLoadImpact: number; // negative impact
  stressLevel: number; // 0-100
}

export class RecoveryEngine {
  // Calculate comprehensive recovery score (0-100)
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
      const restingHRScore = this.calculateRestingHRScore(userId, baseline);
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
  
  // Calculate sleep score based on duration, efficiency, and quality
  static calculateSleepScore(sleepData: SleepData | null, baseline: RecoveryBaseline): number {
    if (!sleepData) return 50; // Default score if no data
    
    const targetDuration = 480; // 8 hours in minutes
    const targetEfficiency = 85; // 85% efficiency
    
    // Duration score (0-40 points)
    const durationDiff = Math.abs(sleepData.totalSleepTime - targetDuration);
    const durationScore = Math.max(0, 40 - (durationDiff / 60) * 5);
    
    // Efficiency score (0-30 points)
    const efficiencyDiff = Math.abs(sleepData.sleepEfficiency - targetEfficiency);
    const efficiencyScore = Math.max(0, 30 - efficiencyDiff * 0.5);
    
    // Quality score (0-30 points) - based on deep sleep percentage
    let qualityScore = 30;
    if (sleepData.deepSleepTime && sleepData.totalSleepTime) {
      const deepSleepPercentage = (sleepData.deepSleepTime / sleepData.totalSleepTime) * 100;
      const targetDeepSleep = 20; // 20% of total sleep
      const qualityDiff = Math.abs(deepSleepPercentage - targetDeepSleep);
      qualityScore = Math.max(0, 30 - qualityDiff * 1.5);
    }
    
    return Math.round(durationScore + efficiencyScore + qualityScore);
  }
  
  // Calculate HRV score based on current measurement vs baseline
  static calculateHRVScore(hrvData: HRVMeasurement | null, baseline: RecoveryBaseline): number {
    if (!hrvData) return 50; // Default score if no data
    
    const currentHRV = hrvData.rmssd;
    const baselineHRV = baseline.avgHRV;
    
    // Calculate HRV score based on deviation from baseline
    const hrvRatio = currentHRV / baselineHRV;
    
    if (hrvRatio >= 1.1) return 90; // Excellent - 10% above baseline
    if (hrvRatio >= 1.0) return 80; // Good - at or above baseline
    if (hrvRatio >= 0.9) return 70; // Fair - slightly below baseline
    if (hrvRatio >= 0.8) return 60; // Below average
    if (hrvRatio >= 0.7) return 40; // Poor
    return 20; // Very poor
  }
  
  // Calculate resting heart rate score
  static async calculateRestingHRScore(userId: number, baseline: RecoveryBaseline): Promise<number> {
    // Get recent heart rate data to estimate resting HR
    const recentHRData = await db.heartRateData
      .where('runId')
      .anyOf([]) // Would need to get recent run IDs
      .toArray();
    
    if (recentHRData.length === 0) return 50; // Default score
    
    // Calculate average resting HR from recent data
    const avgHR = recentHRData.reduce((sum, data) => sum + data.heartRate, 0) / recentHRData.length;
    const baselineHR = baseline.avgRestingHR;
    
    // Lower HR is generally better for recovery
    const hrDiff = avgHR - baselineHR;
    
    if (hrDiff <= -5) return 90; // Excellent - lower than baseline
    if (hrDiff <= 0) return 80; // Good - at or below baseline
    if (hrDiff <= 5) return 70; // Fair - slightly above baseline
    if (hrDiff <= 10) return 60; // Below average
    if (hrDiff <= 15) return 40; // Poor
    return 20; // Very poor
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
    
    // Add positive recommendations for good recovery
    if (factors.overallScore > 80) {
      recommendations.push('Excellent recovery! You\'re ready for quality training');
    } else if (factors.overallScore > 60) {
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