/**
 * Tests for timezone utilities
 * Ensures UTC handling works correctly for plan activation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  nowUTC,
  createUTCDate,
  getUserTimezone,
  utcToLocal,
  localToUTC,
  formatLocalizedDate,
  formatLocalizedDateTime,
  addDaysUTC,
  addWeeksUTC,
  startOfDayUTC,
  endOfDayUTC,
  isSameDayUTC,
  isSameDayLocal,
  todayUTC,
  tomorrowUTC,
  daysBetweenUTC,
  weeksBetweenUTC,
  ensureUTC,
  migrateLocalDateToUTC
} from '../timezone-utils';

describe('Timezone Utils', () => {
  beforeEach(() => {
    // Reset any date mocks
    vi.restoreAllMocks();
  });

  describe('Basic UTC Operations', () => {
    it('should create UTC dates correctly', () => {
      const utcDate = createUTCDate(2025, 0, 13, 12, 0, 0); // Jan 13, 2025 12:00 UTC
      expect(utcDate.getUTCFullYear()).toBe(2025);
      expect(utcDate.getUTCMonth()).toBe(0);
      expect(utcDate.getUTCDate()).toBe(13);
      expect(utcDate.getUTCHours()).toBe(12);
    });

    it('should get current UTC time', () => {
      const before = Date.now();
      const utcNow = nowUTC();
      const after = Date.now();
      
      expect(utcNow.getTime()).toBeGreaterThanOrEqual(before);
      expect(utcNow.getTime()).toBeLessThanOrEqual(after);
    });

    it('should add days correctly in UTC', () => {
      const baseDate = createUTCDate(2025, 0, 13); // Jan 13, 2025
      const futureDate = addDaysUTC(7, baseDate);
      
      expect(futureDate.getUTCDate()).toBe(20); // Jan 20, 2025
      expect(futureDate.getUTCMonth()).toBe(0);
      expect(futureDate.getUTCFullYear()).toBe(2025);
    });

    it('should add weeks correctly in UTC', () => {
      const baseDate = createUTCDate(2025, 0, 13); // Jan 13, 2025
      const futureDate = addWeeksUTC(2, baseDate);
      
      expect(futureDate.getUTCDate()).toBe(27); // Jan 27, 2025
      expect(futureDate.getUTCMonth()).toBe(0);
      expect(futureDate.getUTCFullYear()).toBe(2025);
    });
  });

  describe('Day Operations', () => {
    it('should get start of day in UTC', () => {
      const date = createUTCDate(2025, 0, 13, 15, 30, 45); // Jan 13, 2025 15:30:45
      const startOfDay = startOfDayUTC(date);
      
      expect(startOfDay.getUTCHours()).toBe(0);
      expect(startOfDay.getUTCMinutes()).toBe(0);
      expect(startOfDay.getUTCSeconds()).toBe(0);
      expect(startOfDay.getUTCMilliseconds()).toBe(0);
      expect(startOfDay.getUTCDate()).toBe(13);
    });

    it('should get end of day in UTC', () => {
      const date = createUTCDate(2025, 0, 13, 15, 30, 45); // Jan 13, 2025 15:30:45
      const endOfDay = endOfDayUTC(date);
      
      expect(endOfDay.getUTCHours()).toBe(23);
      expect(endOfDay.getUTCMinutes()).toBe(59);
      expect(endOfDay.getUTCSeconds()).toBe(59);
      expect(endOfDay.getUTCMilliseconds()).toBe(999);
      expect(endOfDay.getUTCDate()).toBe(13);
    });

    it('should check if two dates are the same day in UTC', () => {
      const date1 = createUTCDate(2025, 0, 13, 10, 0, 0);
      const date2 = createUTCDate(2025, 0, 13, 20, 0, 0);
      const date3 = createUTCDate(2025, 0, 14, 2, 0, 0);
      
      expect(isSameDayUTC(date1, date2)).toBe(true);
      expect(isSameDayUTC(date1, date3)).toBe(false);
    });

    it('should calculate days between UTC dates', () => {
      const start = createUTCDate(2025, 0, 13); // Jan 13, 2025
      const end = createUTCDate(2025, 0, 20); // Jan 20, 2025
      
      expect(daysBetweenUTC(start, end)).toBe(7);
    });

    it('should calculate weeks between UTC dates', () => {
      const start = createUTCDate(2025, 0, 13); // Jan 13, 2025
      const end = createUTCDate(2025, 0, 27); // Jan 27, 2025
      
      expect(weeksBetweenUTC(start, end)).toBe(2);
    });
  });

  describe('Timezone Detection', () => {
    it('should get user timezone', () => {
      const timezone = getUserTimezone();
      expect(typeof timezone).toBe('string');
      expect(timezone.length).toBeGreaterThan(0);
      // Should be a valid IANA timezone or fallback to UTC
      expect(timezone).toMatch(/^[A-Z][a-zA-Z_\/]+$|^UTC$/);
    });
  });

  describe('Date Formatting', () => {
    it('should format localized date', () => {
      const utcDate = createUTCDate(2025, 0, 13, 12, 0, 0);
      const formatted = formatLocalizedDate(utcDate, 'UTC');
      
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('13');
      expect(formatted).toContain('2025');
    });

    it('should format localized date and time', () => {
      const utcDate = createUTCDate(2025, 0, 13, 12, 30, 0);
      const formatted = formatLocalizedDateTime(utcDate, 'UTC');
      
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('13');
      expect(formatted).toContain('2025');
      expect(formatted).toContain('12:30');
    });
  });

  describe('Date Conversion', () => {
    it('should ensure UTC conversion', () => {
      const dateString = '2025-01-13T12:00:00.000Z';
      const utcDate = ensureUTC(dateString);
      
      expect(utcDate).toBeInstanceOf(Date);
      expect(utcDate.toISOString()).toBe(dateString);
    });

    it('should handle date migration', () => {
      const localDate = new Date('2025-01-13T12:00:00'); // Local date
      const migratedDate = migrateLocalDateToUTC(localDate, 'UTC');
      
      expect(migratedDate).toBeInstanceOf(Date);
      // The exact conversion depends on timezone, but should be a valid date
      expect(migratedDate.getTime()).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle month boundaries when adding days', () => {
      const endOfMonth = createUTCDate(2025, 0, 31); // Jan 31, 2025
      const nextMonth = addDaysUTC(1, endOfMonth);
      
      expect(nextMonth.getUTCDate()).toBe(1);
      expect(nextMonth.getUTCMonth()).toBe(1); // February
    });

    it('should handle year boundaries when adding days', () => {
      const endOfYear = createUTCDate(2024, 11, 31); // Dec 31, 2024
      const nextYear = addDaysUTC(1, endOfYear);
      
      expect(nextYear.getUTCDate()).toBe(1);
      expect(nextYear.getUTCMonth()).toBe(0); // January
      expect(nextYear.getUTCFullYear()).toBe(2025);
    });

    it('should handle leap years', () => {
      const feb28LeapYear = createUTCDate(2024, 1, 28); // Feb 28, 2024 (leap year)
      const feb29 = addDaysUTC(1, feb28LeapYear);
      
      expect(feb29.getUTCDate()).toBe(29);
      expect(feb29.getUTCMonth()).toBe(1); // February
    });
  });
});