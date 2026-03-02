/**
 * Tests for whatsapp/utils/validation.ts
 */

import {
  isPlaceholder,
  isAffirmative,
  isNegative,
  DOCUMENT_REGEX,
  GREETING_REGEX,
} from '../../whatsapp/utils/validation';

describe('isPlaceholder', () => {
  it('should detect known placeholder patterns', () => {
    expect(isPlaceholder('[id]')).toBe(true);
    expect(isPlaceholder('[id real]')).toBe(true);
    expect(isPlaceholder('[numero]')).toBe(true);
    expect(isPlaceholder('pendiente')).toBe(true);
  });

  it('should detect bracket/mustache patterns', () => {
    expect(isPlaceholder('[NOMBRE_COMPLETO]')).toBe(true);
    expect(isPlaceholder('{{patient_id}}')).toBe(true);
  });

  it('should return true for null/undefined/empty', () => {
    expect(isPlaceholder(null)).toBe(true);
    expect(isPlaceholder(undefined)).toBe(true);
  });

  it('should return false for real values', () => {
    expect(isPlaceholder('Juan Pérez')).toBe(false);
    expect(isPlaceholder('1234567890')).toBe(false);
    expect(isPlaceholder(42)).toBe(false);
  });
});

describe('isAffirmative', () => {
  it('should detect affirmative words', () => {
    expect(isAffirmative('sí')).toBe(true);
    expect(isAffirmative('si')).toBe(true);
    expect(isAffirmative('correcto')).toBe(true);
    expect(isAffirmative('dale')).toBe(true);
    expect(isAffirmative('claro')).toBe(true);
    expect(isAffirmative('ok')).toBe(true);
    expect(isAffirmative('vale')).toBe(true);
    expect(isAffirmative('perfecto')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isAffirmative('SÍ')).toBe(true);
    expect(isAffirmative('Correcto')).toBe(true);
  });

  it('should reject non-affirmative text', () => {
    expect(isAffirmative('no')).toBe(false);
    expect(isAffirmative('quiero una cita')).toBe(false);
  });
});

describe('isNegative', () => {
  it('should detect negative words', () => {
    expect(isNegative('no')).toBe(true);
    expect(isNegative('nel')).toBe(true);
    expect(isNegative('nop')).toBe(true);
    expect(isNegative('negativo')).toBe(true);
    expect(isNegative('para nada')).toBe(true);
  });

  it('should reject non-negative text', () => {
    expect(isNegative('sí')).toBe(false);
    expect(isNegative('quiero cita')).toBe(false);
  });
});

describe('DOCUMENT_REGEX', () => {
  it('should match 6-12 digit documents', () => {
    expect(DOCUMENT_REGEX.test('123456')).toBe(true);
    expect(DOCUMENT_REGEX.test('1234567890')).toBe(true);
    expect(DOCUMENT_REGEX.test('123456789012')).toBe(true);
  });

  it('should not match shorter or longer', () => {
    expect(DOCUMENT_REGEX.test('12345')).toBe(false);
    expect(DOCUMENT_REGEX.test('1234567890123')).toBe(false);
  });
});

describe('GREETING_REGEX', () => {
  it('should match common greetings', () => {
    expect(GREETING_REGEX.test('hola')).toBe(true);
    expect(GREETING_REGEX.test('buenos días')).toBe(true);
    expect(GREETING_REGEX.test('buenas tardes')).toBe(true);
    expect(GREETING_REGEX.test('buenas noches')).toBe(true);
  });
});
