/**
 * Structured Workout Steps - Garmin-compatible workout structure
 *
 * Defines workout steps with duration, pace targets, and visual indicators
 * matching the Garmin Connect workout format.
 */

import {
  PaceZones,
  PaceRange,
  formatPace,
  formatPaceRange,
  getTargetPace,
  formatTime
} from './pace-zones';

export type StepType = 'warmup' | 'run' | 'recover' | 'cooldown' | 'rest' | 'drills';
export type DurationType = 'time' | 'distance' | 'lap';

export interface WorkoutStep {
  type: StepType;
  durationType: DurationType;
  duration: number;        // seconds (for time) or meters (for distance)
  targetPace?: PaceRange;  // target pace range
  description: string;     // e.g., "Stride run fast", "Get ready"
  color: string;           // CSS color class for left border
}

export interface RepeatBlock {
  times: number;
  steps: WorkoutStep[];
}

export interface StructuredWorkout {
  name: string;
  notes: string;              // Short summary e.g., "8x2:00@4:25/km"
  warmup?: WorkoutStep;
  drills?: WorkoutStep;
  mainSteps: (WorkoutStep | RepeatBlock)[];
  cooldown?: WorkoutStep;
  totalDuration: number;      // estimated total seconds
  estimatedDistance: number;  // estimated km
}

// Color classes for step types (matching Garmin colors)
export const STEP_COLORS: Record<StepType, string> = {
  warmup: 'bg-red-500',      // Red
  run: 'bg-blue-500',        // Blue
  recover: 'bg-gray-400',    // Gray
  cooldown: 'bg-green-500',  // Green
  rest: 'bg-gray-300',       // Light gray
  drills: 'bg-yellow-500'    // Yellow
};

/**
 * Check if a step is a RepeatBlock
 */
export function isRepeatBlock(step: WorkoutStep | RepeatBlock): step is RepeatBlock {
  return 'times' in step && 'steps' in step;
}

/**
 * Format step duration for display
 */
export function formatStepDuration(step: WorkoutStep): string {
  if (step.durationType === 'time') {
    return formatTime(step.duration);
  } else if (step.durationType === 'distance') {
    const km = step.duration / 1000;
    return km >= 1 ? `${km.toFixed(1)} km` : `${step.duration} m`;
  } else {
    return 'Lap Button Press';
  }
}

/**
 * Calculate total duration of a workout
 */
export function calculateWorkoutDuration(workout: StructuredWorkout): number {
  let total = 0;

  if (workout.warmup) {
    total += workout.warmup.durationType === 'time' ? workout.warmup.duration : 0;
  }

  if (workout.drills) {
    total += workout.drills.durationType === 'time' ? workout.drills.duration : 0;
  }

  for (const step of workout.mainSteps) {
    if (isRepeatBlock(step)) {
      let blockDuration = 0;
      for (const s of step.steps) {
        if (s.durationType === 'time') {
          blockDuration += s.duration;
        }
      }
      total += blockDuration * step.times;
    } else {
      if (step.durationType === 'time') {
        total += step.duration;
      }
    }
  }

  if (workout.cooldown) {
    total += workout.cooldown.durationType === 'time' ? workout.cooldown.duration : 0;
  }

  return total;
}

/**
 * Generate a structured workout based on workout type and user pace zones
 */
export function generateStructuredWorkout(
  workoutType: string,
  paceZones: PaceZones,
  targetDistance: number,
  experience: 'beginner' | 'intermediate' | 'advanced'
): StructuredWorkout {
  // Normalize workout type: lowercase, replace common words, handle spaces
  const type = workoutType
    .toLowerCase()
    .replace(/\s+run$/i, '')     // Remove trailing "run" (e.g., "Easy Run" -> "easy")
    .replace(/\s+/g, '-')        // Replace spaces with dashes
    .trim();

  // Easy/Recovery runs
  if (type === 'easy' || type === 'recovery' || type.includes('easy') || type.includes('recovery')) {
    return generateEasyWorkout(paceZones, targetDistance, experience);
  }

  // Tempo/Threshold runs
  if (type === 'tempo' || type === 'threshold' || type.includes('tempo') || type.includes('threshold')) {
    return generateTempoWorkout(paceZones, targetDistance, experience);
  }

  // Intervals/VO2max
  if (type === 'intervals' || type === 'vo2max' || type === 'interval' ||
      type.includes('interval') || type.includes('vo2') || type.includes('speed')) {
    return generateIntervalsWorkout(paceZones, targetDistance, experience);
  }

  // Long runs
  if (type === 'long' || type === 'long-progression' || type.includes('long')) {
    return generateLongRunWorkout(paceZones, targetDistance, experience);
  }

  // Hill workouts
  if (type === 'hill' || type.includes('hill')) {
    return generateHillWorkout(paceZones, targetDistance, experience);
  }

  // Fartlek
  if (type === 'fartlek' || type.includes('fartlek')) {
    return generateFartlekWorkout(paceZones, targetDistance, experience);
  }

  // Strides
  if (type === 'strides' || type.includes('stride')) {
    return generateStridesWorkout(paceZones, targetDistance, experience);
  }

  // Race pace
  if (type === 'race-pace' || type === 'race' || type.includes('race')) {
    return generateRacePaceWorkout(paceZones, targetDistance, experience);
  }

  // Default to easy workout
  console.log(`[generateStructuredWorkout] Unknown workout type "${workoutType}", defaulting to easy`);
  return generateEasyWorkout(paceZones, targetDistance, experience);
}

/**
 * Easy/Recovery run - continuous easy effort
 */
function generateEasyWorkout(
  paceZones: PaceZones,
  targetDistance: number,
  experience: 'beginner' | 'intermediate' | 'advanced'
): StructuredWorkout {
  const warmupDuration = experience === 'beginner' ? 300 : experience === 'intermediate' ? 480 : 600;
  const cooldownDuration = 300;

  // Main run duration based on distance and easy pace
  const avgPace = getTargetPace(paceZones.easy);
  const mainDuration = Math.round(targetDistance * avgPace);

  return {
    name: 'Easy Run',
    notes: `${targetDistance}km @ ${formatPace(avgPace)}/km`,
    warmup: {
      type: 'warmup',
      durationType: 'time',
      duration: warmupDuration,
      targetPace: paceZones.recovery,
      description: 'Easy warm-up',
      color: STEP_COLORS.warmup
    },
    mainSteps: [
      {
        type: 'run',
        durationType: 'distance',
        duration: targetDistance * 1000,
        targetPace: paceZones.easy,
        description: 'Continuous easy run',
        color: STEP_COLORS.run
      }
    ],
    cooldown: {
      type: 'cooldown',
      durationType: 'time',
      duration: cooldownDuration,
      targetPace: paceZones.recovery,
      description: 'Easy cool-down',
      color: STEP_COLORS.cooldown
    },
    totalDuration: warmupDuration + mainDuration + cooldownDuration,
    estimatedDistance: targetDistance + 1 // Account for warmup/cooldown
  };
}

/**
 * Tempo/Threshold run - sustained hard effort
 */
function generateTempoWorkout(
  paceZones: PaceZones,
  targetDistance: number,
  experience: 'beginner' | 'intermediate' | 'advanced'
): StructuredWorkout {
  const warmupDuration = experience === 'beginner' ? 600 : 900; // 10-15 min
  const cooldownDuration = 600;

  // Tempo duration based on experience
  const tempoDuration = experience === 'beginner' ? 1200 : // 20 min
    experience === 'intermediate' ? 1500 : // 25 min
      1800; // 30 min

  const tempoDistanceKm = tempoDuration / getTargetPace(paceZones.tempo);

  return {
    name: 'Tempo Run',
    notes: `${formatTime(tempoDuration)} @ ${formatPace(getTargetPace(paceZones.tempo))}/km`,
    warmup: {
      type: 'warmup',
      durationType: 'time',
      duration: warmupDuration,
      targetPace: paceZones.easy,
      description: 'Warm-up + strides',
      color: STEP_COLORS.warmup
    },
    drills: {
      type: 'drills',
      durationType: 'time',
      duration: 180,
      description: '3-4 x 20s strides',
      color: STEP_COLORS.drills
    },
    mainSteps: [
      {
        type: 'run',
        durationType: 'time',
        duration: tempoDuration,
        targetPace: paceZones.tempo,
        description: 'Tempo effort - comfortably hard',
        color: STEP_COLORS.run
      }
    ],
    cooldown: {
      type: 'cooldown',
      durationType: 'time',
      duration: cooldownDuration,
      targetPace: paceZones.easy,
      description: 'Easy cool-down',
      color: STEP_COLORS.cooldown
    },
    totalDuration: warmupDuration + 180 + tempoDuration + cooldownDuration,
    estimatedDistance: tempoDistanceKm + 2.5
  };
}

/**
 * Intervals/VO2max workout - repeated hard efforts with recovery
 */
function generateIntervalsWorkout(
  paceZones: PaceZones,
  targetDistance: number,
  experience: 'beginner' | 'intermediate' | 'advanced'
): StructuredWorkout {
  const warmupDuration = experience === 'beginner' ? 600 : 900; // 10-15 min
  const cooldownDuration = 600;

  // Interval structure based on experience
  let reps: number;
  let intervalDuration: number; // seconds
  let recoveryDuration: number;

  if (experience === 'beginner') {
    reps = 6;
    intervalDuration = 60;  // 1 min
    recoveryDuration = 90;  // 1:30
  } else if (experience === 'intermediate') {
    reps = 8;
    intervalDuration = 120; // 2 min
    recoveryDuration = 60;  // 1 min
  } else {
    reps = 10;
    intervalDuration = 180; // 3 min
    recoveryDuration = 90;  // 1:30
  }

  const intervalPace = formatPace(getTargetPace(paceZones.interval));

  return {
    name: 'Intervals',
    notes: `${reps}x${formatTime(intervalDuration)}@${intervalPace}/km`,
    warmup: {
      type: 'warmup',
      durationType: 'time',
      duration: warmupDuration,
      targetPace: paceZones.easy,
      description: 'Warm-up + drills',
      color: STEP_COLORS.warmup
    },
    drills: {
      type: 'drills',
      durationType: 'time',
      duration: 240,
      description: '3-4 min activation drills',
      color: STEP_COLORS.drills
    },
    mainSteps: [
      {
        times: reps,
        steps: [
          {
            type: 'run',
            durationType: 'time',
            duration: intervalDuration,
            targetPace: paceZones.interval,
            description: 'Hard interval effort',
            color: STEP_COLORS.run
          },
          {
            type: 'recover',
            durationType: 'time',
            duration: recoveryDuration,
            targetPace: paceZones.recovery,
            description: 'Easy recovery jog',
            color: STEP_COLORS.recover
          }
        ]
      }
    ],
    cooldown: {
      type: 'cooldown',
      durationType: 'time',
      duration: cooldownDuration,
      targetPace: paceZones.easy,
      description: 'Easy cool-down',
      color: STEP_COLORS.cooldown
    },
    totalDuration: warmupDuration + 240 + (reps * (intervalDuration + recoveryDuration)) + cooldownDuration,
    estimatedDistance: targetDistance
  };
}

/**
 * Long run - extended easy effort with optional progression
 */
function generateLongRunWorkout(
  paceZones: PaceZones,
  targetDistance: number,
  experience: 'beginner' | 'intermediate' | 'advanced'
): StructuredWorkout {
  const warmupDuration = experience === 'beginner' ? 300 : 600;
  const cooldownDuration = 300;

  const avgPace = getTargetPace(paceZones.easy);
  const mainDuration = Math.round(targetDistance * avgPace);

  return {
    name: 'Long Run',
    notes: `${targetDistance}km @ ${formatPace(avgPace)}/km`,
    warmup: {
      type: 'warmup',
      durationType: 'time',
      duration: warmupDuration,
      targetPace: paceZones.recovery,
      description: 'Easy start',
      color: STEP_COLORS.warmup
    },
    mainSteps: [
      {
        type: 'run',
        durationType: 'distance',
        duration: targetDistance * 1000,
        targetPace: paceZones.easy,
        description: 'Steady long run effort',
        color: STEP_COLORS.run
      }
    ],
    cooldown: {
      type: 'cooldown',
      durationType: 'time',
      duration: cooldownDuration,
      targetPace: paceZones.recovery,
      description: 'Walk cool-down',
      color: STEP_COLORS.cooldown
    },
    totalDuration: warmupDuration + mainDuration + cooldownDuration,
    estimatedDistance: targetDistance + 0.5
  };
}

/**
 * Hill workout - hill repeats for strength
 */
function generateHillWorkout(
  paceZones: PaceZones,
  targetDistance: number,
  experience: 'beginner' | 'intermediate' | 'advanced'
): StructuredWorkout {
  const warmupDuration = 600;
  const cooldownDuration = 600;

  const reps = experience === 'beginner' ? 4 : experience === 'intermediate' ? 6 : 8;
  const hillDuration = experience === 'beginner' ? 45 : 60; // seconds
  const recoveryDuration = 90;

  return {
    name: 'Hill Repeats',
    notes: `${reps}x${hillDuration}s hill sprints`,
    warmup: {
      type: 'warmup',
      durationType: 'time',
      duration: warmupDuration,
      targetPace: paceZones.easy,
      description: 'Warm-up + drills',
      color: STEP_COLORS.warmup
    },
    drills: {
      type: 'drills',
      durationType: 'time',
      duration: 180,
      description: 'Dynamic stretches',
      color: STEP_COLORS.drills
    },
    mainSteps: [
      {
        times: reps,
        steps: [
          {
            type: 'run',
            durationType: 'time',
            duration: hillDuration,
            targetPace: paceZones.interval,
            description: 'Hill sprint - strong effort',
            color: STEP_COLORS.run
          },
          {
            type: 'recover',
            durationType: 'time',
            duration: recoveryDuration,
            targetPace: paceZones.recovery,
            description: 'Jog down recovery',
            color: STEP_COLORS.recover
          }
        ]
      }
    ],
    cooldown: {
      type: 'cooldown',
      durationType: 'time',
      duration: cooldownDuration,
      targetPace: paceZones.easy,
      description: 'Easy cool-down',
      color: STEP_COLORS.cooldown
    },
    totalDuration: warmupDuration + 180 + (reps * (hillDuration + recoveryDuration)) + cooldownDuration,
    estimatedDistance: targetDistance
  };
}

/**
 * Fartlek workout - unstructured speed play
 */
function generateFartlekWorkout(
  paceZones: PaceZones,
  targetDistance: number,
  experience: 'beginner' | 'intermediate' | 'advanced'
): StructuredWorkout {
  const warmupDuration = 600;
  const cooldownDuration = 600;

  const surges = experience === 'beginner' ? 6 : experience === 'intermediate' ? 8 : 10;
  const surgeDuration = experience === 'beginner' ? 30 : 45;
  const easyDuration = 90;

  return {
    name: 'Fartlek',
    notes: `${surges} surges - fun speed play`,
    warmup: {
      type: 'warmup',
      durationType: 'time',
      duration: warmupDuration,
      targetPace: paceZones.easy,
      description: 'Easy warm-up',
      color: STEP_COLORS.warmup
    },
    mainSteps: [
      {
        times: surges,
        steps: [
          {
            type: 'run',
            durationType: 'time',
            duration: surgeDuration,
            targetPace: paceZones.tempo,
            description: 'Fast surge',
            color: STEP_COLORS.run
          },
          {
            type: 'recover',
            durationType: 'time',
            duration: easyDuration,
            targetPace: paceZones.easy,
            description: 'Easy running',
            color: STEP_COLORS.recover
          }
        ]
      }
    ],
    cooldown: {
      type: 'cooldown',
      durationType: 'time',
      duration: cooldownDuration,
      targetPace: paceZones.easy,
      description: 'Easy cool-down',
      color: STEP_COLORS.cooldown
    },
    totalDuration: warmupDuration + (surges * (surgeDuration + easyDuration)) + cooldownDuration,
    estimatedDistance: targetDistance
  };
}

/**
 * Strides workout - short speed bursts
 */
function generateStridesWorkout(
  paceZones: PaceZones,
  targetDistance: number,
  experience: 'beginner' | 'intermediate' | 'advanced'
): StructuredWorkout {
  const warmupDuration = 600;
  const cooldownDuration = 300;

  const reps = experience === 'beginner' ? 4 : 6;
  const strideDuration = 20; // seconds
  const recoveryDuration = 60;

  return {
    name: 'Strides',
    notes: `${reps}x20s strides`,
    warmup: {
      type: 'warmup',
      durationType: 'time',
      duration: warmupDuration,
      targetPace: paceZones.easy,
      description: 'Easy warm-up',
      color: STEP_COLORS.warmup
    },
    mainSteps: [
      {
        times: reps,
        steps: [
          {
            type: 'run',
            durationType: 'time',
            duration: strideDuration,
            targetPace: paceZones.repetition,
            description: 'Stride - fast but controlled',
            color: STEP_COLORS.run
          },
          {
            type: 'recover',
            durationType: 'time',
            duration: recoveryDuration,
            description: 'Walk recovery',
            color: STEP_COLORS.recover
          }
        ]
      }
    ],
    cooldown: {
      type: 'cooldown',
      durationType: 'time',
      duration: cooldownDuration,
      targetPace: paceZones.easy,
      description: 'Easy jog finish',
      color: STEP_COLORS.cooldown
    },
    totalDuration: warmupDuration + (reps * (strideDuration + recoveryDuration)) + cooldownDuration,
    estimatedDistance: targetDistance
  };
}

/**
 * Race pace workout - practice goal race pace
 */
function generateRacePaceWorkout(
  paceZones: PaceZones,
  targetDistance: number,
  experience: 'beginner' | 'intermediate' | 'advanced'
): StructuredWorkout {
  const warmupDuration = 900;
  const cooldownDuration = 600;

  // Race pace segments
  const reps = experience === 'beginner' ? 3 : experience === 'intermediate' ? 4 : 5;
  const segmentDuration = 300; // 5 min
  const recoveryDuration = 120;

  const racePace = formatPace(getTargetPace(paceZones.race));

  return {
    name: 'Race Pace',
    notes: `${reps}x5:00@${racePace}/km`,
    warmup: {
      type: 'warmup',
      durationType: 'time',
      duration: warmupDuration,
      targetPace: paceZones.easy,
      description: 'Warm-up + strides',
      color: STEP_COLORS.warmup
    },
    drills: {
      type: 'drills',
      durationType: 'time',
      duration: 180,
      description: '3x20s strides',
      color: STEP_COLORS.drills
    },
    mainSteps: [
      {
        times: reps,
        steps: [
          {
            type: 'run',
            durationType: 'time',
            duration: segmentDuration,
            targetPace: paceZones.race,
            description: 'Race pace effort',
            color: STEP_COLORS.run
          },
          {
            type: 'recover',
            durationType: 'time',
            duration: recoveryDuration,
            targetPace: paceZones.easy,
            description: 'Easy recovery',
            color: STEP_COLORS.recover
          }
        ]
      }
    ],
    cooldown: {
      type: 'cooldown',
      durationType: 'time',
      duration: cooldownDuration,
      targetPace: paceZones.easy,
      description: 'Easy cool-down',
      color: STEP_COLORS.cooldown
    },
    totalDuration: warmupDuration + 180 + (reps * (segmentDuration + recoveryDuration)) + cooldownDuration,
    estimatedDistance: targetDistance
  };
}
