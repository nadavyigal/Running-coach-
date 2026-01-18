import { z } from 'zod';

/**
 * Validation ranges for user physiological data
 * Based on scientific literature and practical running metrics
 */
export const USER_DATA_CONSTRAINTS = {
  age: { min: 10, max: 100 },
  lactateThreshold: { min: 180, max: 600 },
  lactateThresholdHR: { min: 100, max: 220 },
  vo2Max: { min: 20, max: 85 },
  hrvBaseline: { min: 10, max: 200 },
  maxHeartRate: { min: 120, max: 220 },
  restingHeartRate: { min: 30, max: 100 },
  averageWeeklyKm: { min: 0, max: 300 },
  referenceRaceDistance: { options: [5, 10, 21.1, 42.2] },
  historicalRunDistance: { min: 0, max: 50 },
  historicalRunTime: { min: 0, max: 28800 },
} as const;

/**
 * Zod schemas for runtime validation
 */
export const UserDataSchemas = {
  lactateThreshold: z.number()
    .min(USER_DATA_CONSTRAINTS.lactateThreshold.min)
    .max(USER_DATA_CONSTRAINTS.lactateThreshold.max)
    .describe('Lactate threshold pace in seconds per km'),

  lactateThresholdHR: z.number()
    .min(USER_DATA_CONSTRAINTS.lactateThresholdHR.min)
    .max(USER_DATA_CONSTRAINTS.lactateThresholdHR.max)
    .describe('Heart rate at lactate threshold in bpm'),

  vo2Max: z.number()
    .min(USER_DATA_CONSTRAINTS.vo2Max.min)
    .max(USER_DATA_CONSTRAINTS.vo2Max.max)
    .describe('VO2 Max in ml/kg/min'),

  hrvBaseline: z.number()
    .min(USER_DATA_CONSTRAINTS.hrvBaseline.min)
    .max(USER_DATA_CONSTRAINTS.hrvBaseline.max)
    .describe('HRV baseline in milliseconds (RMSSD)'),

  maxHeartRate: z.number()
    .min(USER_DATA_CONSTRAINTS.maxHeartRate.min)
    .max(USER_DATA_CONSTRAINTS.maxHeartRate.max)
    .describe('Maximum heart rate in bpm'),

  restingHeartRate: z.number()
    .min(USER_DATA_CONSTRAINTS.restingHeartRate.min)
    .max(USER_DATA_CONSTRAINTS.restingHeartRate.max)
    .describe('Resting heart rate in bpm'),

  historicalRun: z.object({
    distance: z.number().min(0).max(50),
    time: z.number().min(0).max(28800),
    date: z.date(),
    type: z.enum(['race', 'long_run', 'workout', 'easy']).optional(),
    notes: z.string().max(500).optional(),
    surface: z.enum(['road', 'trail', 'track', 'treadmill']).optional(),
  }),
};

/**
 * Calculate max heart rate from age using Tanaka formula
 * More accurate than 220-age for runners
 */
export function calculateMaxHR(age: number): number {
  if (age < USER_DATA_CONSTRAINTS.age.min || age > USER_DATA_CONSTRAINTS.age.max) {
    throw new Error('Age must be between 10 and 100');
  }
  return Math.round(208 - (0.7 * age));
}

/**
 * Estimate VO2 Max from VDOT (Jack Daniels formula)
 */
export function estimateVO2MaxFromVDOT(vdot: number): number {
  if (vdot < USER_DATA_CONSTRAINTS.vo2Max.min || vdot > USER_DATA_CONSTRAINTS.vo2Max.max) {
    throw new Error('VDOT must be between 20 and 85');
  }
  // Approximate: VDOT is a close proxy for VO2 Max
  return Math.round(vdot);
}

/**
 * Calculate lactate threshold as % of VO2 Max
 * Typical range: 75-85% for trained runners, 65-75% for beginners
 */
export function calculateLTPercentOfVO2Max(
  vo2Max: number,
  lactateThreshold: number
): number {
  if (!Number.isFinite(vo2Max) || !Number.isFinite(lactateThreshold)) {
    throw new Error('VO2 Max and lactate threshold must be valid numbers');
  }
  // Placeholder for a proper formula that accounts for economy and pace-VO2 relationship.
  return 80;
}

/**
 * Validate a single user data field
 */
export function validateUserDataField(
  field: keyof typeof USER_DATA_CONSTRAINTS,
  value: number
): { valid: boolean; error?: string } {
  const constraints = USER_DATA_CONSTRAINTS[field];

  if (!constraints) {
    return { valid: false, error: `Unknown field: ${field}` };
  }

  if ('min' in constraints && 'max' in constraints) {
    if (!Number.isFinite(value)) {
      return { valid: false, error: 'Value must be a valid number' };
    }
    if (value < constraints.min || value > constraints.max) {
      return {
        valid: false,
        error: `Value must be between ${constraints.min} and ${constraints.max}`,
      };
    }
  }

  if ('options' in constraints) {
    if (!constraints.options.includes(value as any)) {
      return {
        valid: false,
        error: `Value must be one of: ${constraints.options.join(', ')}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validate multiple user data fields at once
 */
export function validateUserData(data: Record<string, any>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  for (const [field, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;

    const constraint = USER_DATA_CONSTRAINTS[field as keyof typeof USER_DATA_CONSTRAINTS];
    if (!constraint) continue;

    const validation = validateUserDataField(field as keyof typeof USER_DATA_CONSTRAINTS, value as number);
    if (!validation.valid && validation.error) {
      errors[field] = validation.error;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Format pace from seconds per km to MM:SS
 */
export function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.floor(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Parse pace from MM:SS string to seconds per km
 */
export function parsePace(paceString: string): number | null {
  const match = paceString.match(/^(\d+):(\d{2})$/);
  if (!match) return null;

  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);

  if (seconds >= 60) return null;

  return minutes * 60 + seconds;
}

/**
 * Get user-friendly descriptions for metrics
 */
export const METRIC_DESCRIPTIONS: Record<
  string,
  { label: string; description: string; unit: string }
> = {
  lactateThreshold: {
    label: 'Lactate Threshold Pace',
    description: 'The pace at which lactate begins to accumulate in your blood. Key for setting tempo run paces.',
    unit: 'min/km',
  },
  lactateThresholdHR: {
    label: 'LT Heart Rate',
    description: 'Your heart rate at lactate threshold. Use this to guide threshold workouts.',
    unit: 'bpm',
  },
  vo2Max: {
    label: 'VO2 Max',
    description: 'Maximum oxygen uptake - a measure of aerobic fitness. Higher is better.',
    unit: 'ml/kg/min',
  },
  hrvBaseline: {
    label: 'HRV Baseline',
    description: 'Heart rate variability baseline (RMSSD). Higher typically indicates better recovery.',
    unit: 'ms',
  },
  maxHeartRate: {
    label: 'Max Heart Rate',
    description: 'Your maximum heart rate during intense exercise. Used to calculate training zones.',
    unit: 'bpm',
  },
  restingHeartRate: {
    label: 'Resting Heart Rate',
    description: 'Your heart rate when fully rested (morning measurement). Lower indicates better fitness.',
    unit: 'bpm',
  },
};
