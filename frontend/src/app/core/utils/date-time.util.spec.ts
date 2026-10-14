import { describe, it, expect } from 'vitest';
import {
  BUSINESS_TIMEZONE,
  BUSINESS_TIMEZONE_OFFSET_HOURS,
  isLeapYear,
  getDaysInMonth,
  isValidCalendarDate,
  parseDateParts,
  formatCalendarDate,
  parseCalendarDate,
  getStartOfDayUtc,
  getStartOfNextDayUtc,
  formatBusinessDate,
  formatBusinessDateTime
} from './date-time.util';

describe('DateTime Utilities - Strict Validation & Vietnam Business Timezone', () => {
  describe('1. Leap Year Calculation (isLeapYear)', () => {
    it('identifies standard leap years divisible by 4', () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2028)).toBe(true);
      expect(isLeapYear(2032)).toBe(true);
    });

    it('identifies century leap years divisible by 400', () => {
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(2400)).toBe(true);
    });

    it('rejects century years not divisible by 400', () => {
      expect(isLeapYear(1900)).toBe(false);
      expect(isLeapYear(2100)).toBe(false);
      expect(isLeapYear(2200)).toBe(false);
    });

    it('rejects standard non-leap years', () => {
      expect(isLeapYear(2025)).toBe(false);
      expect(isLeapYear(2026)).toBe(false);
      expect(isLeapYear(2027)).toBe(false);
    });
  });

  describe('2. Days In Month (getDaysInMonth)', () => {
    it('returns 31 days for months with 31 days', () => {
      const months31 = [1, 3, 5, 7, 8, 10, 12];
      for (const m of months31) {
        expect(getDaysInMonth(2026, m)).toBe(31);
      }
    });

    it('returns 30 days for months with 30 days', () => {
      const months30 = [4, 6, 9, 11];
      for (const m of months30) {
        expect(getDaysInMonth(2026, m)).toBe(30);
      }
    });

    it('returns 29 days for February in leap years', () => {
      expect(getDaysInMonth(2024, 2)).toBe(29);
      expect(getDaysInMonth(2000, 2)).toBe(29);
    });

    it('returns 28 days for February in non-leap years', () => {
      expect(getDaysInMonth(2026, 2)).toBe(28);
      expect(getDaysInMonth(2025, 2)).toBe(28);
      expect(getDaysInMonth(1900, 2)).toBe(28);
    });

    it('returns 0 for invalid month numbers', () => {
      expect(getDaysInMonth(2026, 0)).toBe(0);
      expect(getDaysInMonth(2026, 13)).toBe(0);
    });
  });

  describe('3. Strict Calendar Date Validation (No Auto-Normalization)', () => {
    it('strictly accepts valid existing calendar dates', () => {
      expect(isValidCalendarDate(2026, 10, 9)).toBe(true);
      expect(isValidCalendarDate(2026, 1, 1)).toBe(true);
      expect(isValidCalendarDate(2026, 12, 31)).toBe(true);
      expect(isValidCalendarDate(2026, 2, 28)).toBe(true);
      expect(isValidCalendarDate(2024, 2, 29)).toBe(true); // Leap year
    });

    it('strictly REJECTS 31/02 and 29/02 in non-leap years without auto-normalizing', () => {
      expect(isValidCalendarDate(2026, 2, 31)).toBe(false); // 31/02
      expect(isValidCalendarDate(2026, 2, 30)).toBe(false); // 30/02
      expect(isValidCalendarDate(2026, 2, 29)).toBe(false); // 29/02 non-leap
      expect(isValidCalendarDate(2025, 2, 29)).toBe(false); // 29/02 non-leap
      expect(isValidCalendarDate(1900, 2, 29)).toBe(false); // 29/02 non-leap century
    });

    it('strictly REJECTS 31st day in 30-day months without auto-normalizing', () => {
      expect(isValidCalendarDate(2026, 4, 31)).toBe(false);  // 31/04 April
      expect(isValidCalendarDate(2026, 6, 31)).toBe(false);  // 31/06 June
      expect(isValidCalendarDate(2026, 9, 31)).toBe(false);  // 31/09 September
      expect(isValidCalendarDate(2026, 11, 31)).toBe(false); // 31/11 November
    });

    it('strictly REJECTS invalid months, days and years', () => {
      expect(isValidCalendarDate(2026, 0, 10)).toBe(false);  // Month 0
      expect(isValidCalendarDate(2026, 13, 10)).toBe(false); // Month 13
      expect(isValidCalendarDate(2026, 5, 0)).toBe(false);   // Day 0
      expect(isValidCalendarDate(2026, 5, 32)).toBe(false);  // Day 32
      expect(isValidCalendarDate(999, 1, 1)).toBe(false);    // Year < 1000
    });
  });

  describe('4. parseDateParts & parseCalendarDate (Strict YYYY-MM-DD)', () => {
    it('parses valid dates correctly', () => {
      expect(parseDateParts('2026-10-09')).toEqual({ year: 2026, month: 10, day: 9 });
      expect(parseDateParts('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
    });

    it('rejects invalid dates and returns null without auto-normalization', () => {
      expect(parseDateParts('2026-02-31')).toBeNull(); // 31/02
      expect(parseDateParts('2026-04-31')).toBeNull(); // 31/04
      expect(parseDateParts('2026-02-29')).toBeNull(); // 29/02 non-leap
      expect(parseDateParts('2025-02-29')).toBeNull(); // 29/02 non-leap
      expect(parseDateParts('2026-09-31')).toBeNull(); // 31/09
      expect(parseDateParts('2026-11-31')).toBeNull(); // 31/11
    });

    it('rejects non-strict formatting (must be YYYY-MM-DD)', () => {
      expect(parseDateParts('2026-2-5')).toBeNull();
      expect(parseDateParts('09/10/2026')).toBeNull();
      expect(parseDateParts('2026/10/09')).toBeNull();
      expect(parseDateParts('2026-10-9')).toBeNull();
      expect(parseDateParts('')).toBeNull();
      expect(parseDateParts('not-a-date')).toBeNull();
    });

    it('parseCalendarDate returns null for invalid dates', () => {
      expect(parseCalendarDate('2026-02-31')).toBeNull();
      expect(parseCalendarDate('2026-04-31')).toBeNull();
      expect(parseCalendarDate('2026-02-29')).toBeNull();
    });
  });

  describe('5. Calendar Date-Only Preservation (formatCalendarDate)', () => {
    it('formats Date object to YYYY-MM-DD based on calendar date', () => {
      const d = new Date(2026, 9, 9, 14, 30, 0); // Month 9 = October
      expect(formatCalendarDate(d)).toBe('2026-10-09');
    });

    it('roundtrip formatCalendarDate(parseCalendarDate(dateStr)) is invariant for valid dates', () => {
      const dates = ['2026-01-01', '2026-02-28', '2024-02-29', '2026-10-09', '2026-12-31'];
      for (const str of dates) {
        const parsed = parseCalendarDate(str);
        expect(formatCalendarDate(parsed)).toBe(str);
      }
    });
  });

  describe('6. Month & Year Boundaries in Vietnam Timezone [startUtc, endExclusiveUtc)', () => {
    it('Date 09/10/2026 in Vietnam corresponds exactly to UTC [2026-10-08T17:00:00Z, 2026-10-09T17:00:00Z)', () => {
      const startUtc = getStartOfDayUtc('2026-10-09');
      const endExclusiveUtc = getStartOfNextDayUtc('2026-10-09');

      expect(startUtc).toBe('2026-10-08T17:00:00.000Z');
      expect(endExclusiveUtc).toBe('2026-10-09T17:00:00.000Z');
    });

    it('New Year boundary: 01/01/2026 corresponds to [2025-12-31T17:00:00Z, 2026-01-01T17:00:00Z)', () => {
      const startUtc = getStartOfDayUtc('2026-01-01');
      const endExclusiveUtc = getStartOfNextDayUtc('2026-01-01');

      expect(startUtc).toBe('2025-12-31T17:00:00.000Z');
      expect(endExclusiveUtc).toBe('2026-01-01T17:00:00.000Z');
    });

    it('Year End boundary: 31/12/2026 corresponds to [2026-12-30T17:00:00Z, 2026-12-31T17:00:00Z)', () => {
      const startUtc = getStartOfDayUtc('2026-12-31');
      const endExclusiveUtc = getStartOfNextDayUtc('2026-12-31');

      expect(startUtc).toBe('2026-12-30T17:00:00.000Z');
      expect(endExclusiveUtc).toBe('2026-12-31T17:00:00.000Z');
    });

    it('Month End boundary: 28/02/2026 corresponds to [2026-02-27T17:00:00Z, 2026-02-28T17:00:00Z)', () => {
      const startUtc = getStartOfDayUtc('2026-02-28');
      const endExclusiveUtc = getStartOfNextDayUtc('2026-02-28');

      expect(startUtc).toBe('2026-02-27T17:00:00.000Z');
      expect(endExclusiveUtc).toBe('2026-02-28T17:00:00.000Z');
    });

    it('Leap Day boundary: 29/02/2024 corresponds to [2024-02-28T17:00:00Z, 2024-02-29T17:00:00Z)', () => {
      const startUtc = getStartOfDayUtc('2024-02-29');
      const endExclusiveUtc = getStartOfNextDayUtc('2024-02-29');

      expect(startUtc).toBe('2024-02-28T17:00:00.000Z');
      expect(endExclusiveUtc).toBe('2024-02-29T17:00:00.000Z');
    });

    it('returns empty string for invalid dates without throwing or normalizing', () => {
      expect(getStartOfDayUtc('2026-02-31')).toBe('');
      expect(getStartOfNextDayUtc('2026-02-31')).toBe('');
      expect(getStartOfDayUtc('2026-04-31')).toBe('');
      expect(getStartOfNextDayUtc('2026-04-31')).toBe('');
    });
  });

  describe('7. Display Timestamp in Vietnam Business Timezone (24h Format)', () => {
    it('formatBusinessDateTime formats ISO UTC into dd/mm/yyyy HH:mm in Vietnam time', () => {
      expect(formatBusinessDateTime('2026-10-08T17:00:00.000Z')).toBe('09/10/2026 00:00');
      expect(formatBusinessDateTime('2026-10-08T17:30:00.000Z')).toBe('09/10/2026 00:30');
      expect(formatBusinessDateTime('2026-10-09T16:59:00.000Z')).toBe('09/10/2026 23:59');
      expect(formatBusinessDateTime('2026-10-09T17:00:00.000Z')).toBe('10/10/2026 00:00');
    });

    it('formatBusinessDate formats ISO UTC into dd/mm/yyyy in Vietnam time', () => {
      expect(formatBusinessDate('2026-10-08T16:59:59.000Z')).toBe('08/10/2026');
      expect(formatBusinessDate('2026-10-08T17:00:00.000Z')).toBe('09/10/2026');
      expect(formatBusinessDate('2026-10-09T16:59:59.000Z')).toBe('09/10/2026');
      expect(formatBusinessDate('2026-10-09T17:00:00.000Z')).toBe('10/10/2026');
    });

    it('gracefully handles null/empty/invalid values', () => {
      expect(formatBusinessDateTime(null)).toBe('—');
      expect(formatBusinessDateTime('')).toBe('—');
      expect(formatBusinessDate(null)).toBe('—');
      expect(formatBusinessDate('')).toBe('—');
    });
  });
});
