/**
 * Tests for whatsapp/ai/AIProvider.ts
 */

import { parseToolCalls, buildChatMessages } from '../../whatsapp/ai/AIProvider';

describe('parseToolCalls', () => {
  it('should parse a single tool call', () => {
    const msg = 'Déjame buscar... [TOOL:searchPatient:{"document":"123456"}]';
    const { toolCalls } = parseToolCalls(msg);
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].name).toBe('searchPatient');
    expect(toolCalls[0].args.document).toBe('123456');
  });

  it('should parse multiple tool calls', () => {
    const msg = `
      Primero busco al paciente [TOOL:searchPatient:{"document":"123"}]
      Y luego las citas [TOOL:getAvailableAppointments:{}]
    `;
    const { toolCalls } = parseToolCalls(msg);
    expect(toolCalls).toHaveLength(2);
    expect(toolCalls[0].name).toBe('searchPatient');
    expect(toolCalls[1].name).toBe('getAvailableAppointments');
  });

  it('should handle malformed JSON gracefully', () => {
    const msg = '[TOOL:searchPatient:{bad json}]';
    const { toolCalls } = parseToolCalls(msg);
    // Should either parse with recovery or skip
    expect(Array.isArray(toolCalls)).toBe(true);
  });

  it('should deduplicate identical tool calls', () => {
    const msg = '[TOOL:searchPatient:{"document":"123"}] [TOOL:searchPatient:{"document":"123"}]';
    const { toolCalls } = parseToolCalls(msg);
    expect(toolCalls).toHaveLength(1);
  });

  it('should return empty array for no tool calls', () => {
    const msg = 'Hola, ¿cómo estás?';
    const { toolCalls } = parseToolCalls(msg);
    expect(toolCalls).toEqual([]);
  });
});

describe('buildChatMessages', () => {
  it('should put system prompt first', () => {
    const messages = buildChatMessages('Eres Valeria', [], 15);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toBe('Eres Valeria');
  });

  it('should include history after system', () => {
    const history = [
      { role: 'user' as const, content: 'Hola' },
      { role: 'assistant' as const, content: 'Hola! Soy Valeria.' },
    ];
    const messages = buildChatMessages('Eres Valeria', history, 15);
    expect(messages).toHaveLength(3);
    expect(messages[1].role).toBe('user');
    expect(messages[2].role).toBe('assistant');
  });

  it('should limit history to maxHistory', () => {
    const history = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `message ${i}`,
    }));
    const messages = buildChatMessages('System', history, 5);
    // 1 system + 5 history
    expect(messages).toHaveLength(6);
  });
});
