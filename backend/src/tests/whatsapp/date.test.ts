/**
 * Tests for whatsapp/utils/date.ts
 */

import {
  convertToColombiaTime,
  formatDate,
  formatTime,
  formatDateForComparison,
  getCurrentDateTimeColombia,
  getTodayColombia,
} from '../../whatsapp/utils/date';

describe('convertToColombiaTime', () => {
  it('should subtract 5 hours from UTC', () => {
    const result = convertToColombiaTime('2025-01-15', '15:30');
    expect(result.date).toBe('2025-01-15');
    expect(result.time).toBe('10:30');
  });

  it('should handle day rollback (midnight UTC → previous day Colombia)', () => {
    const result = convertToColombiaTime('2025-01-15', '03:00');
    expect(result.date).toBe('2025-01-14');
    expect(result.time).toBe('22:00');
  });

  it('should handle empty strings gracefully', () => {
    const result = convertToColombiaTime('', '');
    expect(result.date).toBe('');
    expect(result.time).toBe('');
  });
});

describe('formatDate', () => {
  it('should format YYYY-MM-DD to DD/MM/YYYY', () => {
    expect(formatDate('2025-01-15')).toBe('15/01/2025');
  });

  it('should return fallback for empty', () => {
    expect(formatDate('')).toBe('Fecha pendiente');
  });
});

describe('formatTime', () => {
  it('should format 24h to 12h with a.m./p.m.', () => {
    expect(formatTime('14:30')).toBe('2:30 p.m.');
    expect(formatTime('08:00')).toBe('8:00 a.m.');
  });

  it('should handle 12:00 as p.m.', () => {
    expect(formatTime('12:00')).toBe('12:00 p.m.');
  });

  it('should handle 00:00 as 12:00 a.m.', () => {
    expect(formatTime('00:00')).toBe('12:00 a.m.');
  });

  it('should return fallback for empty', () => {
    expect(formatTime('')).toBe('Hora pendiente');
  });
});

describe('formatDateForComparison', () => {
  it('should return human-readable date', () => {
    expect(formatDateForComparison('2025-01-15')).toBe('15 de enero');
  });
});

describe('getCurrentDateTimeColombia', () => {
  it('should return a formatted date/time string', () => {
    const result = getCurrentDateTimeColombia();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(10);
  });
});

describe('getTodayColombia', () => {
  it('should return YYYY-MM-DD format', () => {
    const result = getTodayColombia();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
