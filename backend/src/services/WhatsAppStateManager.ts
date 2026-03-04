/**
 * Sistema de Gestión de Estados para WhatsApp
 * Maneja el flujo conversacional con recuperación automática
 * 
 * Mejoras implementadas:
 * - Logging estructurado con pino
 * - Mensajes de recuperación más naturales y contextuales
 * - Tracking de transiciones para analytics
 * - Métricas de estados
 */

import pino from 'pino';
import { saveStateToRedis, loadStateFromRedis, deleteStateFromRedis } from './WhatsAppStateRedis';

// Logger estructurado para StateManager
const stateLogger = pino({
  name: 'wa-state-manager',
  level: process.env.LOG_LEVEL || 'info'
});

export enum ConversationState {
  IDLE = 'idle',
  AWAITING_DOCUMENT = 'awaiting_document',
  AWAITING_PATIENT_DATA = 'awaiting_patient_data',
  AWAITING_PHONE_CONFIRMATION = 'awaiting_phone_confirmation',
  AWAITING_SPECIALTY = 'awaiting_specialty',
  AWAITING_LOCATION = 'awaiting_location',  // Selección de sede
  AWAITING_DOCTOR_SELECTION = 'awaiting_doctor_selection',  // NUEVO: Selección de doctor
  AWAITING_DATE = 'awaiting_date',
  AWAITING_TIME_PREFERENCE = 'awaiting_time_preference',  // NUEVO: Preferencia mañana/tarde
  AWAITING_TIME = 'awaiting_time',
  AWAITING_REASON = 'awaiting_reason',
  AWAITING_CONFIRMATION = 'awaiting_confirmation',
  CHECKING_APPOINTMENTS = 'checking_appointments',  // NUEVO: Consultando citas
  CANCELING_APPOINTMENT = 'canceling_appointment',  // NUEVO: Cancelando cita
  RESCHEDULING = 'rescheduling',  // NUEVO: Reprogramando cita
  WAITING_LIST = 'waiting_list',  // NUEVO: Gestionando lista de espera
  AWAITING_BENEFICIARY = 'awaiting_beneficiary',  // NUEVO: ¿La cita es para ti o para otra persona?
  COMPLETED = 'completed',
  ERROR = 'error'
}

export interface StateContext {
  currentState: ConversationState;
  previousState?: ConversationState;
  suppressAutoIdentifyUntil?: number; // Si existe y es futuro, NO auto-identificar por teléfono
  confirmationRequestedAt?: number; // Timestamp cuando se pidió confirmar cita (AWAITING_CONFIRMATION)
  patientId?: number;
  patientName?: string;
  patientDocument?: string;
  patientPhone?: string;  // Teléfono del paciente de la base de datos
  patientGender?: string; // Género del paciente (Masculino, Femenino, Otro, No especificado)
  registrationPending?: boolean;  // NUEVO: Indica que el paciente necesita registrarse
  specialty?: any;
  specialtyId?: number;  // NUEVO: ID de especialidad seleccionada
  specialtyName?: string;  // NUEVO: Nombre de especialidad
  selectedDoctor?: string;  // NUEVO: Doctor seleccionado
  selectedDoctorId?: number;  // NUEVO: ID del doctor seleccionado
  selectedLocation?: string;  // Nombre de la sede seleccionada
  selectedLocationId?: number;  // ID de la sede seleccionada
  selectedDate?: string;
  selectedTime?: string;
  scheduledDatetime?: string;  // Fecha y hora completa para scheduleAppointment (YYYY-MM-DD HH:MM:SS)
  availabilityId?: number;
  timeSlots?: any[];
  availableDoctors?: any[];  // NUEVO: Lista de doctores disponibles
  availableAppointments?: any[];  // NUEVO: Lista completa de citas disponibles (de getAvailableAppointments)
  timePreference?: 'morning' | 'afternoon' | 'any';  // NUEVO: Preferencia de horario
  lastQuestion?: string;
  lastAppointmentId?: number;  // ID de la última cita agendada para evitar duplicados
  appointmentToCancel?: number;  // NUEVO: ID de cita a cancelar
  appointmentToReschedule?: number;  // NUEVO: ID de cita a reprogramar
  pendingIntent?: string;  // Intent pendiente (ej: 'cancel') para continuar tras identificar paciente
  reason?: string;  // Motivo de consulta (guardado entre AWAITING_REASON y AWAITING_CONFIRMATION)
  cancelAll?: boolean;  // Flag para cancelación masiva de citas
  // Beneficiario (tercero)
  isThirdParty?: boolean;               // ¿La cita es para otra persona?
  requestorPatientId?: number;           // ID del paciente que llama (solicitante)
  requestorPatientName?: string;         // Nombre del solicitante
  requestorPatientDocument?: string;     // Cédula del solicitante
  // Datos de registro de paciente nuevo (flujo conversacional)
  regStep?: 'name' | 'birth_date' | 'gender' | 'phone' | 'eps' | 'confirm';
  regName?: string;
  regBirthDate?: string;            // YYYY-MM-DD
  regGender?: string;               // M / F
  regPhone?: string;
  regEpsId?: number;
  regEpsName?: string;
  retryCount: number;
  lastError?: string;
  timestamp: number;
  createdAt: number;
  stateTransitions: number;
}

// Métricas de estados
interface StateMetrics {
  totalContexts: number;
  stateDistribution: Record<string, number>;
  averageTransitions: number;
  oldestContext: number;
}

const stateContexts = new Map<string, StateContext>();
const MAX_RETRIES = 3;
const STATE_TIMEOUT = 7200000; // 2 horas (120 minutos)
const MAX_STATE_CONTEXTS = 1000; // Límite máximo de estados en memoria

/**
 * Obtener o crear contexto de estado
 */
/**
 * Obtener o crear contexto de estado.
 * L1: Map en memoria (microsegundos)
 * L2: Redis (fallback tras restart)
 */
export function getStateContext(phone: string): StateContext {
  let context = stateContexts.get(phone);

  // Limpiar si el estado está muy antiguo
  if (context && (Date.now() - context.timestamp) > STATE_TIMEOUT) {
    stateLogger.info({ phone, lastState: context.currentState }, 'State expired, resetting');
    deleteStateFromRedis(phone).catch(() => {}); // Limpiar Redis también
    context = undefined;
  }

  if (!context) {
    // Evict oldest entries if at capacity
    if (stateContexts.size >= MAX_STATE_CONTEXTS) {
      let oldestPhone = '';
      let oldestTime = Infinity;
      for (const [p, c] of stateContexts.entries()) {
        if (c.timestamp < oldestTime) {
          oldestTime = c.timestamp;
          oldestPhone = p;
        }
      }
      if (oldestPhone) stateContexts.delete(oldestPhone);
    }

    const now = Date.now();
    context = {
      currentState: ConversationState.IDLE,
      retryCount: 0,
      timestamp: now,
      createdAt: now,
      stateTransitions: 0
    };
    stateContexts.set(phone, context);
  }

  return context;
}

/**
 * Versión async de getStateContext que intenta recuperar de Redis
 * si no hay estado en memoria (post-restart).
 * Usar desde processWhatsAppMessage antes del flujo principal.
 */
export async function getStateContextAsync(phone: string): Promise<StateContext> {
  let context = stateContexts.get(phone);

  // Limpiar si está expirado
  if (context && (Date.now() - context.timestamp) > STATE_TIMEOUT) {
    stateLogger.info({ phone, lastState: context.currentState }, 'State expired, resetting');
    deleteStateFromRedis(phone).catch(() => {});
    context = undefined;
  }

  // Si no hay en memoria, intentar Redis (post-restart recovery)
  if (!context) {
    try {
      const redisState = await loadStateFromRedis(phone);
      if (redisState && redisState.currentState && (Date.now() - redisState.timestamp) <= STATE_TIMEOUT) {
        context = redisState as StateContext;
        stateContexts.set(phone, context);
        stateLogger.info({ phone, state: context.currentState }, '🔄 State restored from Redis after restart');
        return context;
      }
    } catch (err) {
      stateLogger.warn({ phone }, 'Failed to load state from Redis, creating new');
    }
  }

  if (!context) {
    // Evict si está lleno
    if (stateContexts.size >= MAX_STATE_CONTEXTS) {
      let oldestPhone = '';
      let oldestTime = Infinity;
      for (const [p, c] of stateContexts.entries()) {
        if (c.timestamp < oldestTime) {
          oldestTime = c.timestamp;
          oldestPhone = p;
        }
      }
      if (oldestPhone) stateContexts.delete(oldestPhone);
    }

    const now = Date.now();
    context = {
      currentState: ConversationState.IDLE,
      retryCount: 0,
      timestamp: now,
      createdAt: now,
      stateTransitions: 0
    };
    stateContexts.set(phone, context);
  }

  return context;
}

/**
 * Actualizar estado con tracking de transiciones
 * Supports two call signatures:
 *   updateState(phone, ConversationState.X, { ...updates })
 *   updateState(phone, { ...partialUpdates })  // keeps current state
 */
export function updateState(
  phone: string,
  newStateOrUpdates: ConversationState | Partial<StateContext>,
  updates?: Partial<StateContext>
): void {
  const context = getStateContext(phone);
  const previousState = context.currentState;

  // Detect which overload is being used
  if (typeof newStateOrUpdates === 'string' && Object.values(ConversationState).includes(newStateOrUpdates as ConversationState)) {
    // Called as updateState(phone, ConversationState.X, updates?)
    context.previousState = previousState;
    context.currentState = newStateOrUpdates as ConversationState;
    context.timestamp = Date.now();
    context.stateTransitions++;
    context.retryCount = 0;

    if (updates) {
      Object.assign(context, updates);
    }

    stateLogger.info({
      phone,
      from: previousState,
      to: newStateOrUpdates,
      transitions: context.stateTransitions
    }, 'State transition');
  } else if (typeof newStateOrUpdates === 'object') {
    // Called as updateState(phone, { partialUpdates }) — no state change
    context.timestamp = Date.now();
    Object.assign(context, newStateOrUpdates);

    stateLogger.debug({
      phone,
      state: context.currentState,
      updatedKeys: Object.keys(newStateOrUpdates)
    }, 'State context updated (no transition)');
  }

  stateContexts.set(phone, context);

  // Write-through: persistir en Redis (fire-and-forget)
  saveStateToRedis(phone, context).catch(() => {});
}

/**
 * Incrementar contador de reintentos
 */
export function incrementRetry(phone: string): number {
  const context = getStateContext(phone);
  context.retryCount++;
  context.timestamp = Date.now();
  stateContexts.set(phone, context);
  return context.retryCount;
}

/**
 * Verificar si debe reiniciar por demasiados errores
 */
export function shouldResetDueToErrors(phone: string): boolean {
  const context = getStateContext(phone);
  return context.retryCount >= MAX_RETRIES;
}

/**
 * Resetear estado completamente
 */
export function resetState(phone: string): void {
  const oldContext = stateContexts.get(phone);
  const now = Date.now();

  const context: StateContext = {
    currentState: ConversationState.IDLE,
    retryCount: 0,
    timestamp: now,
    createdAt: now,
    stateTransitions: 0
  };
  stateContexts.set(phone, context);

  // Limpiar Redis
  deleteStateFromRedis(phone).catch(() => {});

  stateLogger.info({
    phone,
    previousState: oldContext?.currentState,
    previousTransitions: oldContext?.stateTransitions
  }, 'State reset');
}

/**
 * Obtener mensaje de recuperación según el estado
 * Mensajes más naturales y contextuales
 */
export function getRecoveryMessage(phone: string): string {
  const context = getStateContext(phone);
  const retryNum = context.retryCount;

  // Mensajes que varían según el número de intentos para sonar más naturales
  const retryPrefix = retryNum > 1 ? "Perdona que insista, " : "";

  switch (context.currentState) {
    case ConversationState.AWAITING_DOCUMENT:
      if (retryNum === 1) {
        return "Disculpa, no pude entender tu número de documento. ¿Podrías escribirlo nuevamente solo con números?";
      } else if (retryNum === 2) {
        return "Parece que hay un problema con el documento. Por favor, escríbelo sin puntos ni espacios, solo los números.";
      }
      return "Si tienes problemas, también puedes agendar desde nuestro portal web https://biosanarcall.site/ o llamarnos al 607 691 1308 📞";

    case ConversationState.AWAITING_SPECIALTY:
      if (retryNum === 1) {
        return "No encontré esa especialidad. ¿Podrías decirme de otra forma qué tipo de cita necesitas?";
      }
      return `${retryPrefix}¿Es una cita de Medicina General, Odontología, Ginecología, u otra especialidad?`;
    
    case ConversationState.AWAITING_DOCTOR_SELECTION:
      return "¿Con cuál de los doctores disponibles prefieres agendar tu cita? 👨‍⚕️";

    case ConversationState.AWAITING_DATE:
      return "¿Para qué día te gustaría la cita? Tenemos atención de Lunes a Viernes. Puedes decirme 'mañana', 'el miércoles' o una fecha específica. 📅";
    
    case ConversationState.AWAITING_TIME_PREFERENCE:
      return "¿Prefieres la cita en la mañana ☀️ o en la tarde 🌙?";

    case ConversationState.AWAITING_TIME:
      if (context.timeSlots && context.timeSlots.length > 0) {
        const slots = context.timeSlots.slice(0, 4);
        // Los slots pueden ser strings simples ('08:00') u objetos con time_formatted
        const options = slots.map((s: any, i: number) => {
          // Priorizar time_formatted que ya viene convertido a hora Colombia
          if (typeof s === 'object' && s.time_formatted) {
            return `${i + 1}️⃣ ${s.time_formatted}`;
          }

          // Si es string o no tiene time_formatted, convertir de UTC a Colombia (restar 5 horas)
          const timeStr = typeof s === 'string' ? s : (s.time || s.start_time || s);

          // Convertir de UTC (base de datos) a Colombia (UTC-5) y luego a AM/PM
          const convertUTCToColombiaAMPM = (utcTime: string): string => {
            const [h, m] = utcTime.split(':').map(Number);
            let colombiaHour = h - 5; // UTC-5
            if (colombiaHour < 0) colombiaHour += 24;
            const period = colombiaHour >= 12 ? 'PM' : 'AM';
            const hour12 = colombiaHour > 12 ? colombiaHour - 12 : (colombiaHour === 0 ? 12 : colombiaHour);
            return `${hour12}:${(m || 0).toString().padStart(2, '0')} ${period}`;
          };

          return `${i + 1}️⃣ ${convertUTCToColombiaAMPM(timeStr)}`;
        }).join('\n');
        return `Te recuerdo los horarios disponibles:\n\n${options}\n\n¿Cuál prefieres? Puedes responder con el número.`;
      }
      return "¿Prefieres cita en la mañana o en la tarde?";

    case ConversationState.AWAITING_REASON:
      return "¿Cuál es el motivo de tu consulta? Esto ayuda al doctor a prepararse mejor para atenderte. 😊";

    case ConversationState.AWAITING_CONFIRMATION:
      if (retryNum === 1) {
        return "¿Confirmas que quieres agendar esta cita? Solo responde 'sí' o 'no'.";
      }
      return "Por favor, responde 'sí' para confirmar o 'no' para cancelar.";

    case ConversationState.AWAITING_PATIENT_DATA:
      return "Necesito algunos datos para registrarte. ¿Me indicas tu nombre completo, por favor?";

    case ConversationState.AWAITING_PHONE_CONFIRMATION:
      // Mostrar el teléfono del paciente si está disponible
      if (context.patientPhone && context.patientName) {
        return `Tu número de contacto registrado es ${context.patientPhone}. ¿Es correcto?`;
      }
      return "¿Me confirmas tu número de contacto para continuar?";
    
    case ConversationState.CHECKING_APPOINTMENTS:
      return "Déjame verificar tus citas... ¿Me confirmas tu número de cédula?";
    
    case ConversationState.CANCELING_APPOINTMENT:
      return "¿Cuál cita deseas cancelar? Puedes indicarme la fecha o el número de la cita.";
    
    case ConversationState.RESCHEDULING:
      return "¿Cuál cita deseas reprogramar? Puedes indicarme la fecha actual de la cita.";
    
    case ConversationState.WAITING_LIST:
      return "Te encuentras en lista de espera. ¿Quieres consultar tu posición o agregar otra especialidad?";

    case ConversationState.ERROR:
      return "Parece que algo no funcionó bien. Empecemos de nuevo. ¿En qué puedo ayudarte? 😊";

    default:
      if (retryNum >= MAX_RETRIES) {
        return "Parece que hay dificultades técnicas. Puedes agendar desde nuestro portal web https://biosanarcall.site/ o llamarnos al 607 691 1308 📞";
      }
      return "Disculpa, no entendí bien. ¿Podrías repetir, por favor?";
  }
}

/**
 * Verificar si la respuesta es afirmativa
 */
export function isAffirmative(message: string): boolean {
  const affirmatives = /^(sí|si|yes|ok|vale|dale|claro|exacto|correcto|afirmativo|confirmo)/i;
  return affirmatives.test(message.trim());
}

/**
 * Verificar si la respuesta es negativa
 */
export function isNegative(message: string): boolean {
  const negatives = /^(no|nope|nop|negativo|nanai|para nada|qué va)/i;
  return negatives.test(message.trim());
}

/**
 * Limpiar estados antiguos (ejecutar periódicamente)
 */
export function cleanupOldStates(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  stateContexts.forEach((context, phone) => {
    if ((now - context.timestamp) > STATE_TIMEOUT) {
      keysToDelete.push(phone);
    }
  });

  keysToDelete.forEach(phone => stateContexts.delete(phone));

  if (keysToDelete.length > 0) {
    stateLogger.info({ count: keysToDelete.length }, 'Cleaned up old states');
  }
}

/**
 * Obtener métricas de estados para monitoreo
 */
export function getStateMetrics(): StateMetrics {
  const stateDistribution: Record<string, number> = {};
  let totalTransitions = 0;
  let oldestContext = Date.now();

  stateContexts.forEach((context) => {
    // Distribución de estados
    const state = context.currentState;
    stateDistribution[state] = (stateDistribution[state] || 0) + 1;

    // Promedio de transiciones
    totalTransitions += context.stateTransitions;

    // Contexto más antiguo
    if (context.createdAt < oldestContext) {
      oldestContext = context.createdAt;
    }
  });

  return {
    totalContexts: stateContexts.size,
    stateDistribution,
    averageTransitions: stateContexts.size > 0
      ? Math.round(totalTransitions / stateContexts.size * 10) / 10
      : 0,
    oldestContext: stateContexts.size > 0 ? oldestContext : 0
  };
}

// Limpiar estados cada 10 minutos
setInterval(cleanupOldStates, 600000);

// Log de métricas cada 15 minutos
setInterval(() => {
  const metrics = getStateMetrics();
  if (metrics.totalContexts > 0) {
    stateLogger.info({ metrics }, 'State manager metrics');
  }
}, 900000);
