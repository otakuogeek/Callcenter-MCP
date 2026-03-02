/**
 * Estado unificado de conversaciones WhatsApp
 * Fuente de verdad única: Map en memoria + write-through a Redis.
 * Reemplaza los 3 sistemas anteriores (WhatsAppStateManager, ConversationManager, ConversationPersistence parcial).
 *
 * @module whatsapp/state/UnifiedStateManager
 */

import { ConversationState, StateContext, createDefaultStateContext } from '../types';
import { logger, STATE_TIMEOUT_MS, MAX_STATE_CONTEXTS } from '../config';
import { saveStateToRedis, loadStateFromRedis, deleteStateFromRedis } from '../../services/WhatsAppStateRedis';

// ─── Store en memoria ────────────────────────────────────────────────────────

const stateContexts = new Map<string, StateContext>();

// ─── Lectura ─────────────────────────────────────────────────────────────────

/** Obtiene el contexto de estado (sync, solo memoria). Crea uno nuevo si no existe. */
export function getStateContext(phone: string): StateContext {
  let context = stateContexts.get(phone);

  // Expiry check
  if (context && (Date.now() - context.timestamp) > STATE_TIMEOUT_MS) {
    logger.info({ phone, lastState: context.currentState }, 'State expired, resetting');
    deleteStateFromRedis(phone).catch(() => {});
    context = undefined;
  }

  if (!context) {
    evictIfFull();
    context = createDefaultStateContext();
    stateContexts.set(phone, context);
  }

  return context;
}

/** Versión async que intenta recuperar de Redis si no hay estado en memoria (post-restart). */
export async function getStateContextAsync(phone: string): Promise<StateContext> {
  let context = stateContexts.get(phone);

  if (context && (Date.now() - context.timestamp) > STATE_TIMEOUT_MS) {
    deleteStateFromRedis(phone).catch(() => {});
    context = undefined;
  }

  // Intento de recovery desde Redis
  if (!context) {
    try {
      const redisState = await loadStateFromRedis(phone);
      if (redisState && redisState.currentState && (Date.now() - redisState.timestamp) <= STATE_TIMEOUT_MS) {
        context = redisState as StateContext;
        stateContexts.set(phone, context);
        logger.info({ phone, state: context.currentState }, 'State restored from Redis');
        return context;
      }
    } catch {
      logger.warn({ phone }, 'Failed to load state from Redis');
    }
  }

  if (!context) {
    evictIfFull();
    context = createDefaultStateContext();
    stateContexts.set(phone, context);
  }

  return context;
}

// ─── Escritura ───────────────────────────────────────────────────────────────

/**
 * Actualizar estado. Dos firmas soportadas:
 *   updateState(phone, ConversationState.X, { ...updates })
 *   updateState(phone, { ...partialUpdates })  // mantiene estado actual
 */
export function updateState(
  phone: string,
  newStateOrUpdates: ConversationState | Partial<StateContext>,
  updates?: Partial<StateContext>
): void {
  const context = getStateContext(phone);
  const previousState = context.currentState;

  if (typeof newStateOrUpdates === 'string' && Object.values(ConversationState).includes(newStateOrUpdates as ConversationState)) {
    // Firma: updateState(phone, ConversationState.X, updates?)
    context.previousState = previousState;
    context.currentState = newStateOrUpdates as ConversationState;
    context.timestamp = Date.now();
    context.stateTransitions++;
    context.retryCount = 0;
    if (updates) Object.assign(context, updates);

    logger.info({ phone, from: previousState, to: newStateOrUpdates, transitions: context.stateTransitions }, 'State transition');
  } else if (typeof newStateOrUpdates === 'object') {
    // Firma: updateState(phone, { ...partial })
    context.timestamp = Date.now();
    Object.assign(context, newStateOrUpdates);

    logger.debug({ phone, state: context.currentState, updatedKeys: Object.keys(newStateOrUpdates) }, 'State context updated');
  }

  stateContexts.set(phone, context);

  // Write-through a Redis (fire-and-forget)
  saveStateToRedis(phone, context).catch(() => {});
}

/** Resetear estado completamente */
export function resetState(phone: string): void {
  const oldContext = stateContexts.get(phone);
  const context = createDefaultStateContext();
  stateContexts.set(phone, context);
  deleteStateFromRedis(phone).catch(() => {});

  logger.info({
    phone,
    previousState: oldContext?.currentState,
    previousTransitions: oldContext?.stateTransitions
  }, 'State reset');
}

// ─── Retry / Recovery ────────────────────────────────────────────────────────

const MAX_RETRIES = 3;

export function incrementRetry(phone: string): number {
  const context = getStateContext(phone);
  context.retryCount++;
  context.timestamp = Date.now();
  stateContexts.set(phone, context);
  return context.retryCount;
}

export function shouldResetDueToErrors(phone: string): boolean {
  return getStateContext(phone).retryCount >= MAX_RETRIES;
}

/** Mensaje de recuperación contextual según el estado actual */
export function getRecoveryMessage(phone: string): string {
  const context = getStateContext(phone);
  const retryNum = context.retryCount;
  const retryPrefix = retryNum > 1 ? 'Perdona que insista, ' : '';

  switch (context.currentState) {
    case ConversationState.AWAITING_DOCUMENT:
      if (retryNum === 1) return 'Disculpa, no pude entender tu número de documento. ¿Podrías escribirlo nuevamente solo con números?';
      if (retryNum === 2) return 'Parece que hay un problema con el documento. Por favor, escríbelo sin puntos ni espacios, solo los números.';
      return 'Si tienes problemas, también puedes llamarnos al 6076911308 para ayudarte. 📞';

    case ConversationState.AWAITING_SPECIALTY:
      if (retryNum === 1) return 'No encontré esa especialidad. ¿Podrías decirme de otra forma qué tipo de cita necesitas?';
      return `${retryPrefix}¿Es una cita de Medicina General, Odontología, Ginecología, u otra especialidad?`;

    case ConversationState.AWAITING_DOCTOR_SELECTION:
      return '¿Con cuál de los doctores disponibles prefieres agendar tu cita? 👨‍⚕️';

    case ConversationState.AWAITING_DATE:
      return '¿Para qué día te gustaría la cita? Puedes decirme "mañana", "el miércoles" o una fecha específica. 📅';

    case ConversationState.AWAITING_TIME:
      if (context.timeSlots && context.timeSlots.length > 0) {
        const slots = context.timeSlots.slice(0, 3).map((s: any) =>
          typeof s === 'string' ? s : (s.time_formatted || s.time)
        ).join(', ');
        return `¿A qué hora prefieres? Tenemos: ${slots}... 🕐`;
      }
      return '¿En qué horario prefieres la cita? ¿Mañana o tarde?';

    case ConversationState.AWAITING_REASON:
      return '¿Cuál es el motivo de tu consulta? 📋';

    case ConversationState.AWAITING_CONFIRMATION:
      return '¿Confirmamos la cita? Responde "Sí" para confirmar o "No" para hacer cambios.';

    case ConversationState.AWAITING_PATIENT_DATA:
      return '¿Cuál es tu nombre completo para registrarte en el sistema?';

    default:
      return `${retryPrefix}Disculpa, no entendí bien. ¿Podrías repetir tu solicitud? 😊`;
  }
}

// ─── Métricas ────────────────────────────────────────────────────────────────

export function getStateMetrics() {
  const distribution: Record<string, number> = {};
  let totalTransitions = 0;
  let oldest = Infinity;

  for (const ctx of stateContexts.values()) {
    distribution[ctx.currentState] = (distribution[ctx.currentState] || 0) + 1;
    totalTransitions += ctx.stateTransitions;
    if (ctx.createdAt < oldest) oldest = ctx.createdAt;
  }

  return {
    totalContexts: stateContexts.size,
    stateDistribution: distribution,
    averageTransitions: stateContexts.size > 0 ? totalTransitions / stateContexts.size : 0,
    oldestContext: oldest === Infinity ? 0 : oldest
  };
}

// ─── Limpieza ────────────────────────────────────────────────────────────────

function evictIfFull(): void {
  if (stateContexts.size < MAX_STATE_CONTEXTS) return;
  let oldestPhone = '';
  let oldestTime = Infinity;
  for (const [p, c] of stateContexts.entries()) {
    if (c.timestamp < oldestTime) { oldestTime = c.timestamp; oldestPhone = p; }
  }
  if (oldestPhone) stateContexts.delete(oldestPhone);
}

/** Limpia estados expirados. Llamar periódicamente. */
export function cleanupExpiredStates(): void {
  const now = Date.now();
  let removed = 0;
  for (const [phone, ctx] of stateContexts.entries()) {
    if ((now - ctx.timestamp) > STATE_TIMEOUT_MS) {
      stateContexts.delete(phone);
      deleteStateFromRedis(phone).catch(() => {});
      removed++;
    }
  }
  if (removed > 0) logger.debug({ removed, remaining: stateContexts.size }, 'Cleaned up expired states');
}
