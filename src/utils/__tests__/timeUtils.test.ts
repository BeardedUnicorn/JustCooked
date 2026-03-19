import { describe, test, expect } from 'vitest';
import {
  parseIsoDuration,
  formatTimeForDisplay,
  calculateTotalTime,
  formatLocalDate,
  parseDateOnly,
  getTodayLocalDateString,
} from '@utils/timeUtils';

describe('timeUtils', () => {
  describe('parseIsoDuration', () => {
    test('should parse ISO 8601 duration with minutes only', () => {
      expect(parseIsoDuration('PT50M')).toBe('50 minutes');
      expect(parseIsoDuration('PT1M')).toBe('1 minute');
      expect(parseIsoDuration('PT0M')).toBe('0 minutes');
    });

    test('should parse ISO 8601 duration with hours only', () => {
      expect(parseIsoDuration('PT2H')).toBe('2 hours');
      expect(parseIsoDuration('PT1H')).toBe('1 hour');
    });

    test('should parse ISO 8601 duration with hours and minutes', () => {
      expect(parseIsoDuration('PT1H30M')).toBe('1 hour 30 minutes');
      expect(parseIsoDuration('PT2H15M')).toBe('2 hours 15 minutes');
      expect(parseIsoDuration('PT1H1M')).toBe('1 hour 1 minute');
    });

    test('should handle edge cases', () => {
      expect(parseIsoDuration('')).toBe('');
      expect(parseIsoDuration('   ')).toBe('');
      expect(parseIsoDuration('PT')).toBe('0 minutes');
      expect(parseIsoDuration('PT0H0M')).toBe('0 minutes');
    });

    test('should return non-ISO duration strings as-is', () => {
      expect(parseIsoDuration('30 minutes')).toBe('30 minutes');
      expect(parseIsoDuration('1 hour')).toBe('1 hour');
      expect(parseIsoDuration('Quick prep')).toBe('Quick prep');
    });

    test('should handle malformed ISO durations gracefully', () => {
      expect(parseIsoDuration('PT')).toBe('0 minutes');
      expect(parseIsoDuration('PTXM')).toBe('0 minutes');
      expect(parseIsoDuration('PT-5M')).toBe('5 minutes'); // Current implementation extracts the number
    });

    test('should handle large numbers', () => {
      expect(parseIsoDuration('PT120M')).toBe('120 minutes');
      expect(parseIsoDuration('PT10H')).toBe('10 hours');
      expect(parseIsoDuration('PT5H90M')).toBe('5 hours 90 minutes');
    });
  });

  describe('formatTimeForDisplay', () => {
    test('should format ISO 8601 durations', () => {
      expect(formatTimeForDisplay('PT30M')).toBe('30 minutes');
      expect(formatTimeForDisplay('PT1H15M')).toBe('1 hour 15 minutes');
    });

    test('should return non-ISO strings as-is', () => {
      expect(formatTimeForDisplay('30 minutes')).toBe('30 minutes');
      expect(formatTimeForDisplay('Quick')).toBe('Quick');
    });

    test('should handle empty strings', () => {
      expect(formatTimeForDisplay('')).toBe('');
      expect(formatTimeForDisplay('   ')).toBe('');
    });
  });

  describe('calculateTotalTime', () => {
    test('should use provided total time when available', () => {
      expect(calculateTotalTime('PT15M', 'PT30M', 'PT45M')).toBe('45 minutes');
      expect(calculateTotalTime('PT15M', 'PT30M', '1 hour')).toBe('1 hour');
    });

    test('should calculate from prep and cook time when total time is empty', () => {
      expect(calculateTotalTime('PT15M', 'PT30M', '')).toBe('15 minutes + 30 minutes');
      expect(calculateTotalTime('PT1H', 'PT30M', '')).toBe('1 hour + 30 minutes');
    });

    test('should handle missing prep or cook time', () => {
      expect(calculateTotalTime('PT15M', '', '')).toBe('15 minutes');
      expect(calculateTotalTime('', 'PT30M', '')).toBe('30 minutes');
      expect(calculateTotalTime('', '', '')).toBe('');
    });

    test('should handle mixed ISO and non-ISO formats', () => {
      expect(calculateTotalTime('15 minutes', 'PT30M', '')).toBe('15 minutes + 30 minutes');
      expect(calculateTotalTime('PT15M', '30 minutes', '')).toBe('15 minutes + 30 minutes');
    });

    test('should prioritize total time over calculated time', () => {
      expect(calculateTotalTime('PT15M', 'PT30M', 'PT60M')).toBe('60 minutes');
      expect(calculateTotalTime('PT15M', 'PT30M', 'Custom time')).toBe('Custom time');
    });

    test('should handle whitespace in total time', () => {
      expect(calculateTotalTime('PT15M', 'PT30M', '   ')).toBe('15 minutes + 30 minutes');
      expect(calculateTotalTime('PT15M', 'PT30M', ' PT45M ')).toBe(' PT45M '); // formatTimeForDisplay doesn't trim whitespace
    });
  });

  describe('local date helpers', () => {
    test('formatLocalDate uses the local calendar date instead of UTC normalization', () => {
      expect(formatLocalDate(new Date(2024, 0, 15, 23, 45))).toBe('2024-01-15');
      expect(formatLocalDate(new Date(2024, 10, 5, 0, 5))).toBe('2024-11-05');
    });

    test('parseDateOnly creates a local midnight date', () => {
      const parsed = parseDateOnly('2024-03-18');

      expect(parsed.getFullYear()).toBe(2024);
      expect(parsed.getMonth()).toBe(2);
      expect(parsed.getDate()).toBe(18);
      expect(parsed.getHours()).toBe(0);
      expect(parsed.getMinutes()).toBe(0);
    });

    test('getTodayLocalDateString returns the local date string for now', () => {
      const today = new Date();
      const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      expect(getTodayLocalDateString()).toBe(expected);
    });
  });
});
