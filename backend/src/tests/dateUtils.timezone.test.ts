import { formatDateForMySQLUTC, parseTimeToParts, utcDateFromYMDAndColombiaTime, utcDateFromYMDAndUTCTime } from '../utils/dateUtils';

describe('dateUtils timezone helpers', () => {
  it('convierte fecha/hora Colombia a Date UTC', () => {
    const d = utcDateFromYMDAndColombiaTime('2026-01-27', '08:00');
    expect(d.toISOString()).toBe('2026-01-27T13:00:00.000Z');
  });

  it('maneja cruce de medianoche al convertir Colombia a UTC', () => {
    const d = utcDateFromYMDAndColombiaTime('2026-01-27', '20:30');
    expect(d.toISOString()).toBe('2026-01-28T01:30:00.000Z');
  });

  it('construye Date UTC desde fecha y hora UTC', () => {
    const d = utcDateFromYMDAndUTCTime('2026-01-27', '13:15:00');
    expect(d.toISOString()).toBe('2026-01-27T13:15:00.000Z');
  });

  it('formatea Date UTC a string MySQL UTC', () => {
    const d = new Date('2026-01-27T13:00:00.000Z');
    expect(formatDateForMySQLUTC(d)).toBe('2026-01-27 13:00:00');
  });

  it('parsea horas con meridiem', () => {
    expect(parseTimeToParts('9:00 a.m.')).toEqual({ hour: 9, minute: 0, second: 0 });
    expect(parseTimeToParts('12:00 a.m.')).toEqual({ hour: 0, minute: 0, second: 0 });
    expect(parseTimeToParts('12:00 p.m.')).toEqual({ hour: 12, minute: 0, second: 0 });
    expect(parseTimeToParts('1:05 p.m.')).toEqual({ hour: 13, minute: 5, second: 0 });
  });
});

