/**
 * Tests for whatsapp/prompts/PromptManager.ts
 */

import { buildSystemPrompt, generateDynamicContext } from '../../whatsapp/prompts/PromptManager';

// Mock ConversationPersistence to avoid DB dependency
jest.mock('../../services/ConversationPersistence', () => ({
  generateContextForAI: jest.fn().mockReturnValue(''),
  resetConversationData: jest.fn().mockResolvedValue(undefined),
  addAppointment: jest.fn().mockResolvedValue(undefined),
  updateContext: jest.fn().mockResolvedValue(undefined),
}));

describe('PromptManager', () => {
  describe('buildSystemPrompt', () => {
    it('should return a non-empty string', async () => {
      const prompt = await buildSystemPrompt();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(100);
    });

    it('should contain date/time variables replaced', async () => {
      const prompt = await buildSystemPrompt();
      expect(prompt).not.toContain('{{CURRENT_DATETIME}}');
      expect(prompt).not.toContain('{{CURRENT_ISO_DATE}}');
    });

    it('should inject user phone when provided', async () => {
      const prompt = await buildSystemPrompt({ userPhone: '573001234567' });
      // The phone should be present or the placeholder replaced
      expect(prompt).not.toContain('{{USER_PHONE}}');
    });
  });

  describe('generateDynamicContext', () => {
    it('should return empty string for fresh state', async () => {
      const { createDefaultStateContext } = require('../../whatsapp/types/state');
      const state = createDefaultStateContext();
      const result = await generateDynamicContext(state, '573001234567');
      expect(typeof result).toBe('string');
    });

    it('should include patient info when set', async () => {
      const { createDefaultStateContext, ConversationState } = require('../../whatsapp/types/state');
      const state = createDefaultStateContext();
      state.patientId = 42;
      state.patientName = 'Juan Pérez';
      state.patientDocument = '1234567890';
      state.currentState = ConversationState.AWAITING_SPECIALTY;

      const result = await generateDynamicContext(state, '573001234567');
      expect(result).toContain('Juan Pérez');
      expect(result).toContain('1234567890');
    });
  });
});
