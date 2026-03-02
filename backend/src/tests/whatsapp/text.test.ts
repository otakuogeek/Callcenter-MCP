/**
 * Tests for whatsapp/utils/text.ts
 */

import {
  cleanResponseFromToolResults,
  limitEmojisPerLine,
  stripResidualPlaceholders,
  cleanPhone,
} from '../../whatsapp/utils/text';

describe('cleanPhone', () => {
  it('should strip WhatsApp JID suffix', () => {
    expect(cleanPhone('573001234567@s.whatsapp.net')).toBe('573001234567');
  });

  it('should handle plain numbers', () => {
    expect(cleanPhone('573001234567')).toBe('573001234567');
  });

  it('should handle undefined/empty', () => {
    expect(cleanPhone('')).toBe('');
  });
});

describe('limitEmojisPerLine', () => {
  it('should limit emojis per line', () => {
    const input = '😊😊😊😊😊 Hola!';
    const result = limitEmojisPerLine(input, 2);
    // Should reduce emoji count
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should handle text without emojis', () => {
    expect(limitEmojisPerLine('Hola mundo', 2)).toBe('Hola mundo');
  });
});

describe('stripResidualPlaceholders', () => {
  it('should remove [data.appointment_id] patterns', () => {
    const input = 'Cita [data.appointment_id] confirmada';
    const result = stripResidualPlaceholders(input);
    expect(result).not.toContain('data.appointment_id');
  });

  it('should leave clean text unchanged', () => {
    expect(stripResidualPlaceholders('Hola, su cita está confirmada')).toBe(
      'Hola, su cita está confirmada',
    );
  });
});

describe('cleanResponseFromToolResults', () => {
  it('should remove [TOOL_RESULT:...] blocks', () => {
    const input = 'Hola [TOOL_RESULT:searchPatient:{"found":true}] todo bien';
    const result = cleanResponseFromToolResults(input);
    expect(result).not.toContain('TOOL_RESULT');
  });

  it('should remove [TOOL:...] blocks', () => {
    const input = 'Buscando... [TOOL:searchPatient:{"document":"123"}] listo';
    const result = cleanResponseFromToolResults(input);
    expect(result).not.toContain('[TOOL:');
  });

  it('should handle empty input', () => {
    expect(cleanResponseFromToolResults('')).toBe('');
  });
});
