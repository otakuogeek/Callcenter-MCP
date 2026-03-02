/**
 * Tests for whatsapp/state/UnifiedStateManager.ts
 */

// Mock Redis before import
jest.mock('../../services/WhatsAppStateRedis', () => ({
  saveStateToRedis: jest.fn().mockResolvedValue(undefined),
  getStateFromRedis: jest.fn().mockResolvedValue(null),
  deleteStateFromRedis: jest.fn().mockResolvedValue(undefined),
}));

import {
  getStateContext,
  updateState,
  resetState,
  incrementRetry,
  shouldResetDueToErrors,
  getRecoveryMessage,
  getStateMetrics,
} from '../../whatsapp/state/UnifiedStateManager';
import { ConversationState } from '../../whatsapp/types/state';

describe('UnifiedStateManager', () => {
  const testPhone = '573001234567';

  beforeEach(() => {
    resetState(testPhone);
  });

  describe('getStateContext', () => {
    it('should return a default IDLE state for new phone', () => {
      const state = getStateContext(testPhone);
      expect(state.currentState).toBe(ConversationState.IDLE);
      expect(state.retryCount).toBe(0);
      expect(state.patientId).toBeUndefined();
    });
  });

  describe('updateState', () => {
    it('should update state enum', () => {
      updateState(testPhone, ConversationState.AWAITING_DOCUMENT, {});
      const state = getStateContext(testPhone);
      expect(state.currentState).toBe(ConversationState.AWAITING_DOCUMENT);
    });

    it('should update partial fields', () => {
      updateState(testPhone, ConversationState.AWAITING_SPECIALTY, {
        patientId: 42,
        patientName: 'Juan Pérez',
      });
      const state = getStateContext(testPhone);
      expect(state.patientId).toBe(42);
      expect(state.patientName).toBe('Juan Pérez');
      expect(state.currentState).toBe(ConversationState.AWAITING_SPECIALTY);
    });

    it('should preserve previous fields on partial update', () => {
      updateState(testPhone, ConversationState.AWAITING_SPECIALTY, {
        patientId: 42,
        patientName: 'Juan',
      });
      updateState(testPhone, { patientDocument: '123456' });
      const state = getStateContext(testPhone);
      expect(state.patientId).toBe(42);
      expect(state.patientDocument).toBe('123456');
    });
  });

  describe('resetState', () => {
    it('should remove phone from state map', () => {
      updateState(testPhone, ConversationState.AWAITING_DOCUMENT, {});
      resetState(testPhone);
      const state = getStateContext(testPhone);
      expect(state.currentState).toBe(ConversationState.IDLE);
    });
  });

  describe('incrementRetry / shouldResetDueToErrors', () => {
    it('should increment retry count', () => {
      incrementRetry(testPhone);
      const state = getStateContext(testPhone);
      expect(state.retryCount).toBe(1);
    });

    it('should not reset after few retries', () => {
      incrementRetry(testPhone);
      incrementRetry(testPhone);
      expect(shouldResetDueToErrors(testPhone)).toBe(false);
    });

    it('should reset after many retries', () => {
      for (let i = 0; i < 4; i++) {
        incrementRetry(testPhone);
      }
      expect(shouldResetDueToErrors(testPhone)).toBe(true);
    });
  });

  describe('getRecoveryMessage', () => {
    it('should return a contextual message for IDLE', () => {
      const msg = getRecoveryMessage(testPhone);
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(10);
    });

    it('should return a contextual message for AWAITING_SPECIALTY', () => {
      updateState(testPhone, ConversationState.AWAITING_SPECIALTY, {});
      const msg = getRecoveryMessage(testPhone);
      expect(msg).toContain('especialidad');
    });
  });

  describe('getStateMetrics', () => {
    it('should return metrics object', () => {
      const metrics = getStateMetrics();
      expect(metrics).toHaveProperty('totalContexts');
      expect(metrics).toHaveProperty('stateDistribution');
      expect(typeof metrics.totalContexts).toBe('number');
    });
  });
});
