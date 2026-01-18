import { describe, it, expect } from 'vitest';
import {
  calculateMaxHR,
  estimateVO2MaxFromVDOT,
  validateUserDataField,
  formatPace,
  parsePace,
} from './userDataValidation';

describe('userDataValidation', () => {
  describe('calculateMaxHR', () => {
    it('calculates max HR using Tanaka formula', () => {
      expect(calculateMaxHR(30)).toBe(187);
      expect(calculateMaxHR(40)).toBe(180);
      expect(calculateMaxHR(50)).toBe(173);
    });

    it('throws for invalid ages', () => {
      expect(() => calculateMaxHR(5)).toThrow();
      expect(() => calculateMaxHR(150)).toThrow();
    });
  });

  describe('estimateVO2MaxFromVDOT', () => {
    it('estimates VO2 Max from VDOT', () => {
      expect(estimateVO2MaxFromVDOT(50)).toBe(50);
    });
  });

  describe('validateUserDataField', () => {
    it('validates lactate threshold', () => {
      expect(validateUserDataField('lactateThreshold', 270).valid).toBe(true);
      expect(validateUserDataField('lactateThreshold', 100).valid).toBe(false);
    });

    it('validates VO2 Max', () => {
      expect(validateUserDataField('vo2Max', 55).valid).toBe(true);
      expect(validateUserDataField('vo2Max', 100).valid).toBe(false);
    });
  });

  describe('pace formatting', () => {
    it('formats pace correctly', () => {
      expect(formatPace(300)).toBe('5:00');
      expect(formatPace(270)).toBe('4:30');
      expect(formatPace(365)).toBe('6:05');
    });

    it('parses pace correctly', () => {
      expect(parsePace('5:00')).toBe(300);
      expect(parsePace('4:30')).toBe(270);
      expect(parsePace('invalid')).toBe(null);
    });
  });
});
