/**
 * Timezone utilities for handling UTC dates and user timezone conversions
 * Ensures consistent cross-timezone behavior for plan activation and scheduling
 */

/**
 * Get current UTC date
 */
export function nowUTC(): Date {
  return new Date(Date.now());
}

/**
 * Create a UTC date from components (year, month, day, etc.)
 */
export function createUTCDate(
  year: number,
  month: number, // 0-indexed (January = 0)
  day: number,
  hours: number = 0,
  minutes: number = 0,
  seconds: number = 0,
  milliseconds: number = 0
): Date {
  return new Date(Date.UTC(year, month, day, hours, minutes, seconds, milliseconds));
}

/**
 * Get user's timezone from browser or fallback to UTC
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Convert UTC date to user's local timezone for display
 */
export function utcToLocal(utcDate: Date, timezone?: string): Date {
  const userTimezone = timezone || getUserTimezone();
  
  // Create a new date that represents the UTC time in the user's timezone
  const localDate = new Date(utcDate.toLocaleString('en-US', { timeZone: userTimezone }));
  return localDate;
}

/**
 * Convert local date to UTC for storage
 */
export function localToUTC(localDate: Date, _timezone?: string): Date {
  // For now, we'll use a simple approach - this is a complex timezone conversion
  // In production, consider using a library like date-fns-tz for accurate conversions
  return new Date(localDate.getTime());
}

/**
 * Format UTC date as localized string
 */
export function formatLocalizedDate(
  utcDate: Date, 
  timezone?: string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const userTimezone = timezone || getUserTimezone();
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: userTimezone
  };
  
  return utcDate.toLocaleDateString('en-US', { ...defaultOptions, ...options });
}

/**
 * Format UTC date as localized date and time string
 */
export function formatLocalizedDateTime(
  utcDate: Date,
  timezone?: string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const userTimezone = timezone || getUserTimezone();
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: userTimezone
  };
  
  return utcDate.toLocaleString('en-US', { ...defaultOptions, ...options });
}

/**
 * Create a date that's offset by days from now in UTC
 */
export function addDaysUTC(days: number, fromDate?: Date): Date {
  const baseDate = fromDate || nowUTC();
  const result = new Date(baseDate.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Create a date that's offset by weeks from now in UTC
 */
export function addWeeksUTC(weeks: number, fromDate?: Date): Date {
  return addDaysUTC(weeks * 7, fromDate);
}

/**
 * Get the start of day in UTC for a given date
 */
export function startOfDayUTC(date: Date): Date {
  const result = new Date(date.getTime());
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the end of day in UTC for a given date
 */
export function endOfDayUTC(date: Date): Date {
  const result = new Date(date.getTime());
  result.setUTCHours(23, 59, 59, 999);
  return result;
}

/**
 * Check if two dates are the same day in UTC
 */
export function isSameDayUTC(date1: Date, date2: Date): boolean {
  return date1.getUTCFullYear() === date2.getUTCFullYear() &&
         date1.getUTCMonth() === date2.getUTCMonth() &&
         date1.getUTCDate() === date2.getUTCDate();
}

/**
 * Check if two dates are the same day in user's local timezone
 */
export function isSameDayLocal(date1: Date, date2: Date, timezone?: string): boolean {
  const userTimezone = timezone || getUserTimezone();
  
  const local1 = utcToLocal(date1, userTimezone);
  const local2 = utcToLocal(date2, userTimezone);
  
  return local1.getFullYear() === local2.getFullYear() &&
         local1.getMonth() === local2.getMonth() &&
         local1.getDate() === local2.getDate();
}

/**
 * Get today's date at start of day in UTC
 */
export function todayUTC(): Date {
  return startOfDayUTC(nowUTC());
}

/**
 * Get tomorrow's date at start of day in UTC
 */
export function tomorrowUTC(): Date {
  return startOfDayUTC(addDaysUTC(1));
}

/**
 * Calculate days between two UTC dates
 */
export function daysBetweenUTC(startDate: Date, endDate: Date): number {
  const start = startOfDayUTC(startDate);
  const end = startOfDayUTC(endDate);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay);
}

/**
 * Calculate weeks between two UTC dates
 */
export function weeksBetweenUTC(startDate: Date, endDate: Date): number {
  return Math.floor(daysBetweenUTC(startDate, endDate) / 7);
}

/**
 * Ensure a date is in UTC (converts if necessary)
 */
export function ensureUTC(date: Date | string | number): Date {
  if (typeof date === 'string' || typeof date === 'number') {
    return new Date(date);
  }
  return new Date(date.getTime());
}

/**
 * Migrate existing local dates to UTC
 * This is for migrating existing data that was stored in local timezone
 */
export function migrateLocalDateToUTC(localDate: Date, originalTimezone?: string): Date {
  if (!originalTimezone) {
    // If we don't know the original timezone, assume it was created in the current user's timezone
    originalTimezone = getUserTimezone();
  }
  
  // Convert the local date to UTC assuming it was created in the original timezone
  return localToUTC(localDate, originalTimezone);
}