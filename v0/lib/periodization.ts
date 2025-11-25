import { PeriodizationPhase, RaceGoal, Workout, WorkoutTemplate } from './db';

export interface PeriodizationConfig {
  totalWeeks: number;
  raceDate: Date;
  trainingDaysPerWeek: number;
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  targetDistance: number;
  targetTime?: number;
}

export interface WorkoutPlan {
  workouts: Workout[];
  phases: PeriodizationPhase[];
  peakWeeklyVolume: number;
  taperStrategy: {
    weeksBeforeRace: number;
    volumeReduction: number[];
    intensityMaintenance: boolean;
  };
}

export class PeriodizationEngine {
  /**
   * Generate periodized training plan based on race goal and fitness level
   */
  static generatePeriodizedPlan(
    userId: number,
    planId: number,
    raceGoal: RaceGoal,
    config: PeriodizationConfig
  ): WorkoutPlan {
    const phases = this.calculatePeriodizationPhases(config);
    const workouts = this.generateWorkouts(userId, planId, phases, config);
    const peakWeeklyVolume = this.calculatePeakWeeklyVolume(config);
    const taperStrategy = this.generateTaperStrategy(config);

    return {
      workouts,
      phases,
      peakWeeklyVolume,
      taperStrategy
    };
  }

  /**
   * Calculate periodization phases (base: 60%, build: 30%, peak: 10%)
   */
  private static calculatePeriodizationPhases(config: PeriodizationConfig): PeriodizationPhase[] {
    const { totalWeeks, fitnessLevel } = config;
    
    // Calculate phase durations based on periodization principles
    const baseWeeks = Math.floor(totalWeeks * 0.6);
    const buildWeeks = Math.floor(totalWeeks * 0.3);
    const peakWeeks = totalWeeks - baseWeeks - buildWeeks;

    const phases: PeriodizationPhase[] = [
      {
        phase: 'base',
        duration: baseWeeks,
        weeklyVolumePercentage: this.getBaseVolumePercentage(fitnessLevel),
        intensityDistribution: { easy: 80, moderate: 15, hard: 5 },
        keyWorkouts: ['easy', 'long', 'recovery'],
        focus: 'Aerobic base building and endurance development'
      },
      {
        phase: 'build',
        duration: buildWeeks,
        weeklyVolumePercentage: this.getBuildVolumePercentage(fitnessLevel),
        intensityDistribution: { easy: 70, moderate: 20, hard: 10 },
        keyWorkouts: ['easy', 'tempo', 'intervals', 'long'],
        focus: 'Lactate threshold and VO2 max development'
      },
      {
        phase: 'peak',
        duration: peakWeeks,
        weeklyVolumePercentage: this.getPeakVolumePercentage(fitnessLevel),
        intensityDistribution: { easy: 60, moderate: 25, hard: 15 },
        keyWorkouts: ['race-pace', 'intervals', 'time-trial', 'recovery'],
        focus: 'Race-specific preparation and speed development'
      }
    ];

    return phases;
  }

  /**
   * Generate workouts for each phase
   */
  private static generateWorkouts(
    userId: number,
    planId: number,
    phases: PeriodizationPhase[],
    config: PeriodizationConfig
  ): Workout[] {
    const workouts: Workout[] = [];
    let currentWeek = 1;
    const startDate = new Date();

    for (const phase of phases) {
      for (let week = 0; week < phase.duration; week++) {
        const weeklyWorkouts = this.generateWeeklyWorkouts(
          userId,
          planId,
          currentWeek,
          phase,
          config,
          startDate
        );
        workouts.push(...weeklyWorkouts);
        currentWeek++;
      }
    }

    return workouts;
  }

  /**
   * Generate workouts for a specific week
   */
  private static generateWeeklyWorkouts(
    userId: number,
    planId: number,
    week: number,
    phase: PeriodizationPhase,
    config: PeriodizationConfig,
    startDate: Date
  ): Workout[] {
    const workouts: Workout[] = [];
    const weeklyVolume = this.calculateWeeklyVolume(week, phase, config);
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    // Determine workout schedule based on training days per week
    const trainingDays = this.getTrainingDaySchedule(config.trainingDaysPerWeek);
    
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const day = daysOfWeek[dayIndex];
      const scheduledDate = new Date(startDate);
      scheduledDate.setDate(startDate.getDate() + (week - 1) * 7 + dayIndex);

      if (trainingDays.includes(dayIndex)) {
        const workout = this.generateWorkoutForDay(
          userId,
          planId,
          week,
          day,
          dayIndex,
          phase,
          weeklyVolume,
          config,
          scheduledDate
        );
        workouts.push(workout);
      } else {
        // Rest day
        workouts.push({
          planId,
          week,
          day,
          type: 'rest',
          distance: 0,
          duration: 0,
          intensity: undefined,
          trainingPhase: phase.phase,
          notes: 'Rest day for recovery',
          completed: false,
          scheduledDate,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    return workouts;
  }

  /**
   * Generate a specific workout for a day
   */
  private static generateWorkoutForDay(
    userId: number,
    planId: number,
    week: number,
    day: string,
    dayIndex: number,
    phase: PeriodizationPhase,
    weeklyVolume: number,
    config: PeriodizationConfig,
    scheduledDate: Date
  ): Workout {
    const workoutType = this.selectWorkoutType(dayIndex, phase, config);
    const distance = this.calculateWorkoutDistance(workoutType, weeklyVolume, config);
    const duration = this.calculateWorkoutDuration(distance, workoutType, config);
    const intensity = this.getWorkoutIntensity(workoutType);
    const notes = this.generateWorkoutNotes(workoutType, phase, config);

    return {
      planId,
      week,
      day,
      type: workoutType,
      distance,
      duration,
      intensity,
      trainingPhase: phase.phase,
      notes,
      completed: false,
      scheduledDate,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Select appropriate workout type based on day and phase
   */
  private static selectWorkoutType(
    dayIndex: number,
    phase: PeriodizationPhase,
    config: PeriodizationConfig
  ): Workout['type'] {
    const { phase: phaseName } = phase;
    
    switch (phaseName) {
      case 'base':
        if (dayIndex === 0) return 'easy'; // Monday
        if (dayIndex === 2) return 'easy'; // Wednesday
        if (dayIndex === 4) return 'easy'; // Friday
        if (dayIndex === 6) return 'long'; // Sunday
        return 'easy';
        
      case 'build':
        if (dayIndex === 0) return 'easy'; // Monday
        if (dayIndex === 2) return 'tempo'; // Wednesday
        if (dayIndex === 4) return 'intervals'; // Friday
        if (dayIndex === 6) return 'long'; // Sunday
        return 'easy';
        
      case 'peak':
        if (dayIndex === 0) return 'easy'; // Monday
        if (dayIndex === 2) return 'race-pace'; // Wednesday
        if (dayIndex === 4) return 'intervals'; // Friday
        if (dayIndex === 6) return 'time-trial'; // Sunday
        return 'easy';
        
      default:
        return 'easy';
    }
  }

  /**
   * Calculate workout distance based on type and weekly volume
   */
  private static calculateWorkoutDistance(
    workoutType: Workout['type'],
    weeklyVolume: number,
    config: PeriodizationConfig
  ): number {
    const { fitnessLevel } = config;
    
    switch (workoutType) {
      case 'easy':
        return weeklyVolume * 0.25; // 25% of weekly volume
      case 'tempo':
        return weeklyVolume * 0.2; // 20% of weekly volume
      case 'intervals':
        return weeklyVolume * 0.15; // 15% of weekly volume
      case 'long':
        return weeklyVolume * 0.35; // 35% of weekly volume
      case 'race-pace':
        return weeklyVolume * 0.2; // 20% of weekly volume
      case 'time-trial':
        return config.targetDistance * 0.5; // Half race distance
      case 'recovery':
        return weeklyVolume * 0.15; // 15% of weekly volume
      case 'rest':
        return 0;
      default:
        return weeklyVolume * 0.2;
    }
  }

  /**
   * Calculate workout duration based on distance and type
   */
  private static calculateWorkoutDuration(
    distance: number,
    workoutType: Workout['type'],
    config: PeriodizationConfig
  ): number {
    const { fitnessLevel, targetTime, targetDistance } = config;
    
    // Estimate pace based on fitness level and target time
    let basePace = 360; // 6:00/km for beginner
    if (fitnessLevel === 'intermediate') basePace = 330; // 5:30/km
    if (fitnessLevel === 'advanced') basePace = 300; // 5:00/km
    
    if (targetTime && targetDistance) {
      basePace = targetTime / targetDistance; // Use target race pace
    }

    // Adjust pace based on workout type
    let workoutPace = basePace;
    switch (workoutType) {
      case 'easy':
        workoutPace = basePace * 1.2; // 20% slower
        break;
      case 'tempo':
        workoutPace = basePace * 1.05; // 5% slower
        break;
      case 'intervals':
        workoutPace = basePace * 0.95; // 5% faster
        break;
      case 'race-pace':
        workoutPace = basePace; // Race pace
        break;
      case 'recovery':
        workoutPace = basePace * 1.3; // 30% slower
        break;
      default:
        workoutPace = basePace;
    }

    return Math.round(distance * workoutPace / 60); // Convert to minutes
  }

  /**
   * Get workout intensity zone
   */
  private static getWorkoutIntensity(workoutType: Workout['type']): Workout['intensity'] {
    switch (workoutType) {
      case 'easy':
      case 'recovery':
        return 'easy';
      case 'tempo':
      case 'race-pace':
        return 'threshold';
      case 'intervals':
        return 'vo2max';
      case 'time-trial':
        return 'anaerobic';
      default:
        return 'easy';
    }
  }

  /**
   * Generate workout notes based on type and phase
   */
  private static generateWorkoutNotes(
    workoutType: Workout['type'],
    phase: PeriodizationPhase,
    config: PeriodizationConfig
  ): string {
    const baseNotes = {
      easy: 'Comfortable aerobic pace. You should be able to hold a conversation.',
      tempo: 'Comfortably hard effort. Sustainable for 20-60 minutes.',
      intervals: 'High-intensity efforts with recovery periods. Focus on form.',
      long: 'Steady aerobic pace. Build endurance gradually.',
      'race-pace': 'Practice your target race pace. Get comfortable with race rhythm.',
      'time-trial': 'All-out effort. Test your current fitness level.',
      recovery: 'Very easy pace. Focus on active recovery and leg turnover.',
      rest: 'Complete rest day. Focus on recovery, stretching, and preparation.'
    };

    const phaseSpecificNotes = {
      base: ' Focus on building aerobic capacity and preparing your body for harder training.',
      build: ' Incorporate speed and power work while maintaining your aerobic base.',
      peak: ' Fine-tune your race readiness with race-specific intensities.',
      taper: ' Maintain fitness while allowing for full recovery before race day.'
    };

    return baseNotes[workoutType] + phaseSpecificNotes[phase.phase];
  }

  /**
   * Calculate weekly training volume
   */
  private static calculateWeeklyVolume(
    week: number,
    phase: PeriodizationPhase,
    config: PeriodizationConfig
  ): number {
    const peakVolume = this.calculatePeakWeeklyVolume(config);
    const phaseVolumePercentage = phase.weeklyVolumePercentage / 100;
    
    // Progressive volume increase within phase
    const phaseProgress = (week - 1) / phase.duration;
    const volumeMultiplier = 0.7 + (0.3 * phaseProgress); // Start at 70%, build to 100%
    
    return peakVolume * phaseVolumePercentage * volumeMultiplier;
  }

  /**
   * Calculate peak weekly volume based on fitness level and target
   */
  private static calculatePeakWeeklyVolume(config: PeriodizationConfig): number {
    const { fitnessLevel, targetDistance, trainingDaysPerWeek } = config;
    
    // Base volume by fitness level
    let baseVolume = 30; // km/week for beginner
    if (fitnessLevel === 'intermediate') baseVolume = 50;
    if (fitnessLevel === 'advanced') baseVolume = 70;
    
    // Adjust for target distance
    const distanceMultiplier = Math.max(1, targetDistance / 10); // Scale based on 10k baseline
    baseVolume *= distanceMultiplier;
    
    // Adjust for training days per week
    const dayMultiplier = trainingDaysPerWeek / 5; // Scale based on 5 days baseline
    baseVolume *= dayMultiplier;
    
    return Math.round(baseVolume);
  }

  /**
   * Generate taper strategy
   */
  private static generateTaperStrategy(config: PeriodizationConfig): {
    weeksBeforeRace: number;
    volumeReduction: number[];
    intensityMaintenance: boolean;
  } {
    const { totalWeeks, fitnessLevel } = config;
    
    // Taper duration based on fitness level
    let taperWeeks = 2;
    if (fitnessLevel === 'advanced') taperWeeks = 3;
    
    // Volume reduction per week (percentage)
    const volumeReduction = [];
    for (let i = 0; i < taperWeeks; i++) {
      volumeReduction.push(25 + (i * 15)); // 25%, 40%, 55% reduction
    }
    
    return {
      weeksBeforeRace: taperWeeks,
      volumeReduction,
      intensityMaintenance: true
    };
  }

  /**
   * Get training day schedule based on days per week
   */
  private static getTrainingDaySchedule(daysPerWeek: number): number[] {
    const schedules = {
      3: [0, 2, 6], // Mon, Wed, Sun
      4: [0, 2, 4, 6], // Mon, Wed, Fri, Sun
      5: [0, 1, 2, 4, 6], // Mon, Tue, Wed, Fri, Sun
      6: [0, 1, 2, 3, 4, 6], // Mon-Fri, Sun
      7: [0, 1, 2, 3, 4, 5, 6] // Every day
    };
    
    return schedules[daysPerWeek as keyof typeof schedules] || schedules[4];
  }

  /**
   * Get volume percentage for base phase
   */
  private static getBaseVolumePercentage(fitnessLevel: string): number {
    switch (fitnessLevel) {
      case 'beginner': return 70;
      case 'intermediate': return 80;
      case 'advanced': return 85;
      default: return 75;
    }
  }

  /**
   * Get volume percentage for build phase
   */
  private static getBuildVolumePercentage(fitnessLevel: string): number {
    switch (fitnessLevel) {
      case 'beginner': return 85;
      case 'intermediate': return 95;
      case 'advanced': return 100;
      default: return 90;
    }
  }

  /**
   * Get volume percentage for peak phase
   */
  private static getPeakVolumePercentage(fitnessLevel: string): number {
    switch (fitnessLevel) {
      case 'beginner': return 75;
      case 'intermediate': return 85;
      case 'advanced': return 90;
      default: return 80;
    }
  }
}