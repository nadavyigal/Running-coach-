/**
 * Route Helper Utilities
 * Shared utility functions for route components
 */

// Constants
export const UNKNOWN_DISTANCE_KM = 999;
export const MAX_NAME_LENGTH = 100;
export const MAX_NOTES_LENGTH = 500;
export const MAX_DISTANCE_KM = 100;

/**
 * Get color class for difficulty badge
 */
export function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case "beginner":
      return "bg-green-100 text-green-800";
    case "intermediate":
      return "bg-yellow-100 text-yellow-800";
    case "advanced":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

/**
 * Get human-readable difficulty label
 */
export function getDifficultyLabel(difficulty: string): string {
  switch (difficulty) {
    case "beginner": return "Easy";
    case "intermediate": return "Moderate";
    case "advanced": return "Hard";
    default: return difficulty;
  }
}

/**
 * Get color class for safety score
 */
export function getSafetyColor(score: number): string {
  if (score >= 90) return "text-green-600";
  if (score >= 75) return "text-yellow-600";
  return "text-red-600";
}

/**
 * Validate latitude coordinate
 */
export function isValidLatitude(lat: number): boolean {
  return !isNaN(lat) && lat >= -90 && lat <= 90;
}

/**
 * Validate longitude coordinate
 */
export function isValidLongitude(lng: number): boolean {
  return !isNaN(lng) && lng >= -180 && lng <= 180;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production';
}
