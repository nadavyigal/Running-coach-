/**
 * Workout calculation utilities
 * Centralized functions for workout-related calculations and formatting
 */

import { WORKOUT } from './constants';
import type { Workout, Run } from './db';

/**
 * Calculate estimated duration range for a workout
 *
 * @param workout - Workout object
 * @returns Object with min and max duration in minutes
 */
export function calculateDurationRange(workout: Workout | null): { min: number; max: number } {
  if (!workout) {
    return { min: 20, max: 25 };
  }

  if (workout.duration) {
    const buffer = WORKOUT.PACE_BUFFER_MIN;
    return {
      min: Math.max(20, workout.duration - buffer),
      max: workout.duration + buffer,
    };
  }

  if (workout.distance) {
    return {
      min: Math.round(workout.distance * WORKOUT.DISTANCE_TO_TIME_MIN),
      max: Math.round(workout.distance * WORKOUT.DISTANCE_TO_TIME_MAX),
    };
  }

  return { min: 20, max: 25 };
}

/**
 * Format duration range as string
 *
 * @param min - Minimum duration in minutes
 * @param max - Maximum duration in minutes
 * @returns Formatted string (e.g., "20-25m")
 */
export function formatDurationRange(min: number, max: number): string {
  return `${min}-${max}m`;
}

/**
 * Calculate workout distance or duration display value
 *
 * @param workout - Workout object
 * @returns Formatted string for display
 */
export function getWorkoutMetric(workout: Workout): string {
  if (workout.distance) {
    return `${workout.distance}km`;
  }

  if (workout.duration) {
    return `${workout.duration}min`;
  }

  return 'N/A';
}

/**
 * Calculate running pace in min/km from distance and duration
 *
 * @param distance - Distance in kilometers
 * @param duration - Duration in seconds
 * @returns Pace in seconds per kilometer
 */
export function calculatePace(distance: number, duration: number): number {
  if (distance <= 0) return 0;
  return duration / distance;
}

/**
 * Format pace as MM:SS/km string
 *
 * @param paceSecondsPerKm - Pace in seconds per kilometer
 * @returns Formatted pace string (e.g., "5:20/km")
 */
export function formatPace(paceSecondsPerKm: number): string {
  if (paceSecondsPerKm <= 0) return '0:00/km';

  const minutes = Math.floor(paceSecondsPerKm / 60);
  const seconds = Math.round(paceSecondsPerKm % 60);

  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
}

/**
 * Calculate workout streak from runs
 *
 * @param workouts - Array of workouts
 * @returns Current streak count
 */
export function calculateWorkoutStreak(workouts: Workout[]): number {
  if (!workouts.length) return 0;

  const completedWorkouts = workouts
    .filter(w => w.completed && w.type !== 'rest')
    .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());

  if (completedWorkouts.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < completedWorkouts.length; i++) {
    const workout = completedWorkouts[i]
    if (!workout) break

    const workoutDate = new Date(workout.scheduledDate);
    workoutDate.setHours(0, 0, 0, 0);
    const daysDiff = Math.floor((today.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === i) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Calculate consistency percentage from workouts
 *
 * @param completedCount - Number of completed workouts
 * @param plannedCount - Number of planned workouts
 * @returns Consistency percentage (0-100)
 */
export function calculateConsistency(completedCount: number, plannedCount: number): number {
  if (plannedCount === 0) return 0;
  return Math.min(100, Math.round((completedCount / plannedCount) * 100));
}

/**
 * Get workout color class based on type
 *
 * @param type - Workout type
 * @returns Tailwind color class
 */
export function getWorkoutColor(type: string): string {
  const colorMap: Record<string, string> = {
    easy: 'bg-green-500',
    tempo: 'bg-orange-500',
    intervals: 'bg-pink-500',
    long: 'bg-blue-500',
    rest: 'bg-gray-400',
    'time-trial': 'bg-red-500',
    hill: 'bg-purple-500',
    'race-pace': 'bg-indigo-500',
    recovery: 'bg-teal-500',
    fartlek: 'bg-amber-500',
  };

  return colorMap[type] || 'bg-gray-500';
}

/**
 * Check if date is today
 *
 * @param date - Date to check
 * @returns Boolean indicating if date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if dates are the same day
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Boolean indicating if dates are same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}

/**
 * Get workouts for specific date
 *
 * @param workouts - Array of workouts
 * @param date - Date to filter by
 * @returns Filtered workouts array
 */
export function getWorkoutsForDate(workouts: Workout[], date: Date): Workout[] {
  return workouts.filter(workout => isSameDay(workout.scheduledDate, date));
}

/**
 * Calculate total distance from runs
 *
 * @param runs - Array of runs
 * @returns Total distance in kilometers
 */
export function calculateTotalDistance(runs: Run[]): number {
  return runs.reduce((total, run) => total + (run.distance || 0), 0);
}

/**
 * Calculate total duration from runs
 *
 * @param runs - Array of runs
 * @returns Total duration in seconds
 */
export function calculateTotalDuration(runs: Run[]): number {
  return runs.reduce((total, run) => total + (run.duration || 0), 0);
}

/**
 * Calculate average pace from runs
 *
 * @param runs - Array of runs
 * @returns Average pace in seconds per kilometer
 */
export function calculateAveragePace(runs: Run[]): number {
  if (runs.length === 0) return 0;

  const totalDistance = calculateTotalDistance(runs);
  const totalDuration = calculateTotalDuration(runs);

  if (totalDistance === 0) return 0;

  return totalDuration / totalDistance;
}

/**
 * Format duration in seconds to human-readable string
 *
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "1h 23m")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

/**
 * Format distance to 1 decimal place
 *
 * @param distance - Distance in kilometers
 * @returns Formatted distance string
 */
export function formatDistance(distance: number): string {
  return `${distance.toFixed(1)}km`;
}

/**
 * Calculate percentage progress towards goal
 *
 * @param current - Current value
 * @param target - Target value
 * @returns Progress percentage (0-100)
 */
export function calculateProgress(current: number, target: number): number {
  if (target === 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

/**
 * Get workout type display name
 *
 * @param type - Workout type
 * @returns Capitalized display name
 */
export function getWorkoutDisplayName(type: string): string {
  const displayNames: Record<string, string> = {
    easy: 'Easy Run',
    tempo: 'Tempo Run',
    intervals: 'Interval Training',
    long: 'Long Run',
    rest: 'Rest Day',
    'time-trial': 'Time Trial',
    hill: 'Hill Workout',
    'race-pace': 'Race Pace',
    recovery: 'Recovery Run',
    fartlek: 'Fartlek',
  };

  return displayNames[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Sort workouts by date (most recent first)
 *
 * @param workouts - Array of workouts
 * @returns Sorted workouts array
 */
export function sortWorkoutsByDate(workouts: Workout[]): Workout[] {
  return [...workouts].sort(
    (a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()
  );
}

/**
 * Filter completed workouts
 *
 * @param workouts - Array of workouts
 * @param excludeRest - Whether to exclude rest days (default: true)
 * @returns Filtered workouts array
 */
export function getCompletedWorkouts(workouts: Workout[], excludeRest = true): Workout[] {
  return workouts.filter(
    w => w.completed && (!excludeRest || w.type !== 'rest')
  );
}

/**
 * Filter pending workouts
 *
 * @param workouts - Array of workouts
 * @returns Filtered workouts array
 */
export function getPendingWorkouts(workouts: Workout[]): Workout[] {
  return workouts.filter(w => !w.completed);
}

/**
 * Calculate weekly volume in kilometers
 *
 * @param workouts - Array of workouts for the week
 * @returns Total weekly volume
 */
export function calculateWeeklyVolume(workouts: Workout[]): number {
  return workouts
    .filter(w => w.type !== 'rest')
    .reduce((total, w) => total + (w.distance || 0), 0);
}
