/**
 * Pace Zones Calculator using Jack Daniels' VDOT methodology
 *
 * VDOT is a measure of running fitness that allows calculation of
 * equivalent performances across different distances and training paces.
 */

export interface PaceRange {
  min: number;  // seconds per km (faster)
  max: number;  // seconds per km (slower)
  label: string; // formatted "M:SS-M:SS/km"
}

export interface PaceZones {
  vdot: number;
  race: PaceRange;       // Goal race pace
  easy: PaceRange;       // E pace (65-79% VO2max) - recovery and base building
  marathon: PaceRange;   // M pace (80-85%) - marathon specific
  tempo: PaceRange;      // T pace (88-90%) - lactate threshold
  interval: PaceRange;   // I pace (95-100%) - VO2max development
  repetition: PaceRange; // R pace - speed/form work
  recovery: PaceRange;   // Recovery jog between intervals
}

/**
 * Calculate VDOT from race performance using Jack Daniels' formula
 *
 * @param distanceKm - Race distance in kilometers
 * @param timeSeconds - Race time in seconds
 * @returns VDOT value (typically 30-85 for most runners)
 */
export function calculateVDOT(distanceKm: number, timeSeconds: number): number {
  const distanceMeters = distanceKm * 1000;
  const timeMinutes = timeSeconds / 60;

  // Velocity in meters per minute
  const velocity = distanceMeters / timeMinutes;

  // Percent of VO2max based on race duration
  // Formula: %VO2max = 0.8 + 0.1894393 * e^(-0.012778*t) + 0.2989558 * e^(-0.1932605*t)
  const percentVO2max = 0.8 +
    0.1894393 * Math.exp(-0.012778 * timeMinutes) +
    0.2989558 * Math.exp(-0.1932605 * timeMinutes);

  // VO2 demand at given velocity
  // Formula: VO2 = -4.6 + 0.182258*v + 0.000104*v^2
  const vo2 = -4.6 + 0.182258 * velocity + 0.000104 * Math.pow(velocity, 2);

  // VDOT = VO2 / %VO2max
  const vdot = vo2 / percentVO2max;

  return Math.round(vdot * 10) / 10; // Round to 1 decimal
}

/**
 * Calculate pace (seconds per km) for a given VDOT at a specific percentage of VO2max
 */
function calculatePaceFromVDOT(vdot: number, percentVO2max: number): number {
  // Target VO2 at given percentage
  const targetVO2 = vdot * percentVO2max;

  // Solve for velocity: VO2 = -4.6 + 0.182258*v + 0.000104*v^2
  // Rearranged: 0.000104*v^2 + 0.182258*v + (-4.6 - targetVO2) = 0
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - targetVO2;

  // Quadratic formula: v = (-b + sqrt(b^2 - 4ac)) / 2a
  const discriminant = Math.pow(b, 2) - 4 * a * c;
  if (discriminant < 0) return 600; // Fallback to 10:00/km

  const velocity = (-b + Math.sqrt(discriminant)) / (2 * a); // meters per minute

  // Convert to seconds per km
  const paceSecondsPerKm = (1000 / velocity) * 60;

  return Math.round(paceSecondsPerKm);
}

/**
 * Get all training pace zones from a VDOT value
 * Based on Jack Daniels' Running Formula training intensities
 */
export function getPaceZonesFromVDOT(vdot: number): PaceZones {
  // Training intensities as percentages of VO2max
  // E (Easy): 59-74% VO2max
  // M (Marathon): 75-84% VO2max
  // T (Threshold): 83-88% VO2max
  // I (Interval): 95-100% VO2max
  // R (Repetition): 105-120% VO2max equivalent (faster than VO2max)

  const easyMin = calculatePaceFromVDOT(vdot, 0.74);
  const easyMax = calculatePaceFromVDOT(vdot, 0.59);

  const marathonMin = calculatePaceFromVDOT(vdot, 0.84);
  const marathonMax = calculatePaceFromVDOT(vdot, 0.75);

  const tempoMin = calculatePaceFromVDOT(vdot, 0.88);
  const tempoMax = calculatePaceFromVDOT(vdot, 0.83);

  const intervalMin = calculatePaceFromVDOT(vdot, 1.0);
  const intervalMax = calculatePaceFromVDOT(vdot, 0.95);

  // Repetition pace is faster than VO2max pace
  const repMin = calculatePaceFromVDOT(vdot, 1.10);
  const repMax = calculatePaceFromVDOT(vdot, 1.05);

  // Recovery pace is very easy
  const recoveryMin = calculatePaceFromVDOT(vdot, 0.65);
  const recoveryMax = calculatePaceFromVDOT(vdot, 0.55);

  // Race pace at ~95-100% for common race distances
  const raceMin = calculatePaceFromVDOT(vdot, 0.98);
  const raceMax = calculatePaceFromVDOT(vdot, 0.92);

  return {
    vdot,
    race: {
      min: raceMin,
      max: raceMax,
      label: formatPaceRange({ min: raceMin, max: raceMax, label: '' })
    },
    easy: {
      min: easyMin,
      max: easyMax,
      label: formatPaceRange({ min: easyMin, max: easyMax, label: '' })
    },
    marathon: {
      min: marathonMin,
      max: marathonMax,
      label: formatPaceRange({ min: marathonMin, max: marathonMax, label: '' })
    },
    tempo: {
      min: tempoMin,
      max: tempoMax,
      label: formatPaceRange({ min: tempoMin, max: tempoMax, label: '' })
    },
    interval: {
      min: intervalMin,
      max: intervalMax,
      label: formatPaceRange({ min: intervalMin, max: intervalMax, label: '' })
    },
    repetition: {
      min: repMin,
      max: repMax,
      label: formatPaceRange({ min: repMin, max: repMax, label: '' })
    },
    recovery: {
      min: recoveryMin,
      max: recoveryMax,
      label: formatPaceRange({ min: recoveryMin, max: recoveryMax, label: '' })
    }
  };
}

/**
 * Format seconds per km to "M:SS" string
 */
export function formatPace(secondsPerKm: number): string {
  if (secondsPerKm <= 0 || !isFinite(secondsPerKm)) return '0:00';

  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format a pace range to "M:SS-M:SS/km" string
 */
export function formatPaceRange(range: PaceRange): string {
  const minPace = formatPace(range.min);
  const maxPace = formatPace(range.max);

  if (minPace === maxPace) {
    return `${minPace}/km`;
  }

  return `${minPace}-${maxPace}/km`;
}

/**
 * Get the middle pace of a range (for display as target)
 */
export function getTargetPace(range: PaceRange): number {
  return Math.round((range.min + range.max) / 2);
}

/**
 * Format target pace with range: "M:SS/km (M:SS-M:SS/km)"
 */
export function formatTargetWithRange(range: PaceRange): string {
  const target = formatPace(getTargetPace(range));
  const rangeStr = formatPaceRange(range);

  return `${target}/km (${rangeStr})`;
}

/**
 * Convert time string (MM:SS or HH:MM:SS) to seconds
 */
export function parseTimeToSeconds(timeStr: string): number | null {
  const parts = timeStr.split(':').map(p => parseInt(p, 10));

  if (parts.some(isNaN)) return null;

  if (parts.length === 2) {
    // MM:SS format
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  } else if (parts.length === 3) {
    // HH:MM:SS format
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
}

/**
 * Format seconds to time string (MM:SS or HH:MM:SS)
 */
export function formatTime(totalSeconds: number): string {
  if (totalSeconds < 0 || !isFinite(totalSeconds)) return '0:00';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.round(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get default pace zones for a user without reference race data
 * Uses experience level to estimate a reasonable VDOT
 */
export function getDefaultPaceZones(experience: 'beginner' | 'intermediate' | 'advanced'): PaceZones {
  // Default VDOT estimates by experience level
  const defaultVDOT: Record<string, number> = {
    beginner: 30,      // ~7:30/km easy, ~6:30/km race
    intermediate: 40,  // ~6:00/km easy, ~5:15/km race
    advanced: 50       // ~5:00/km easy, ~4:15/km race
  };

  return getPaceZonesFromVDOT(defaultVDOT[experience] || 35);
}

/**
 * Get pace zone appropriate for a specific workout type
 */
export function getPaceForWorkoutType(
  paceZones: PaceZones,
  workoutType: string
): PaceRange {
  const workoutPaceMap: Record<string, keyof PaceZones> = {
    'easy': 'easy',
    'recovery': 'recovery',
    'steady': 'marathon',
    'tempo': 'tempo',
    'threshold': 'tempo',
    'intervals': 'interval',
    'vo2max': 'interval',
    'long': 'easy',
    'long-progression': 'easy',
    'progression': 'marathon',
    'hill': 'tempo',
    'strides': 'repetition',
    'fartlek': 'tempo',
    'race-pace': 'race',
    'time-trial': 'tempo'
  };

  const paceKey = workoutPaceMap[workoutType.toLowerCase()] || 'easy';
  return paceZones[paceKey] as PaceRange;
}
