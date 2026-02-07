/**
 * ConversationPersistenceService.ts
 * =====================================
 * Servicio de persistencia de conversaciones WhatsApp
 * 
 * Cada conversación tiene:
 * - Un registro en la tabla whatsapp_conversation_persistence
 * - Un archivo JSON único en /data/conversations/{phone}.json
 * 
 * El modelo siempre consulta este historial antes de responder
 * para no repetir preguntas y recordar todo lo conversado.
 */

import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import pool from '../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Directorio donde se guardan los archivos JSON
const CONVERSATIONS_DIR = path.join(__dirname, '../../data/conversations');

// Interfaz para los datos del paciente conocidos
export interface KnownPatientData {
  patientId?: number;
  documentNumber?: string;
  fullName?: string;
  firstName?: string;
  phone?: string;
  eps?: string;
  email?: string;
  birthDate?: string;
  gender?: string;
}

// Interfaz para datos de cita
export interface AppointmentData {
  appointmentId: number;
  specialty: string;
  doctorName: string;
  date: string;
  time: string;
  location: string;
  status: string;
  scheduledAt: string;
}

// Interfaz para lo que se ha preguntado
export interface AskedQuestions {
  cedula: boolean;
  nombre: boolean;
  telefono: boolean;
  eps: boolean;
  especialidad: boolean;
  fecha: boolean;
  motivo: boolean;
}

// Interfaz para preferencias del paciente
export interface PatientPreferences {
  preferredLocation?: string;
  preferredTimeSlot?: 'morning' | 'afternoon' | 'any';
  preferredDoctor?: string;
}

// Estructura completa del archivo JSON de conversación
export interface ConversationData {
  // Metadatos
  phoneNumber: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  
  // Datos del paciente
  patient: KnownPatientData;
  
  // Estado de identificación
  isIdentified: boolean;
  identifiedAt?: string;
  
  // Preguntas ya realizadas (para no repetir)
  askedQuestions: AskedQuestions;
  
  // Respuestas obtenidas
  collectedAnswers: {
    [key: string]: {
      value: string;
      collectedAt: string;
    };
  };
  
  // Preferencias conocidas
  preferences: PatientPreferences;
  
  // Citas agendadas
  appointments: AppointmentData[];
  
  // Historial de temas discutidos
  topicsDiscussed: string[];
  
  // Última interacción
  lastInteraction: {
    timestamp: string;
    userMessage: string;
    botResponse: string;
    intent?: string;
  };
  
  // Contexto actual de la conversación
  currentContext: {
    state: 'greeting' | 'identification' | 'specialty_selection' | 'date_selection' | 'confirmation' | 'completed' | 'general_inquiry';
    pendingAction?: string;
    selectedSpecialty?: string;
    selectedAvailabilityId?: number;
    selectedDate?: string;
    selectedTime?: string;
    selectedLocation?: string;
    selectedDoctor?: string;
  };
  
  // Resumen de la conversación para el modelo
  conversationSummary: string;
}

// Función para normalizar número de teléfono
function normalizePhone(phone: string): string {
  // Eliminar todo excepto dígitos
  let cleaned = phone.replace(/\D/g, '');
  
  // Si empieza con 57 y tiene más de 10 dígitos, es colombiano
  if (cleaned.startsWith('57') && cleaned.length > 10) {
    return cleaned;
  }
  
  // Si tiene 10 dígitos, agregar 57
  if (cleaned.length === 10) {
    return '57' + cleaned;
  }
  
  return cleaned;
}

// Función para crear estructura inicial de conversación
function createEmptyConversation(phoneNumber: string): ConversationData {
  const now = new Date().toISOString();
  return {
    phoneNumber,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    patient: {},
    isIdentified: false,
    askedQuestions: {
      cedula: false,
      nombre: false,
      telefono: false,
      eps: false,
      especialidad: false,
      fecha: false,
      motivo: false
    },
    collectedAnswers: {},
    preferences: {},
    appointments: [],
    topicsDiscussed: [],
    lastInteraction: {
      timestamp: now,
      userMessage: '',
      botResponse: ''
    },
    currentContext: {
      state: 'greeting'
    },
    conversationSummary: ''
  };
}

class ConversationPersistenceService {
  
  constructor() {
    this.ensureDirectoryExists();
  }
  
  /**
   * Asegura que el directorio de conversaciones existe
   */
  private ensureDirectoryExists(): void {
    if (!fs.existsSync(CONVERSATIONS_DIR)) {
      fs.mkdirSync(CONVERSATIONS_DIR, { recursive: true });
      console.log(`[ConversationPersistence] Directorio creado: ${CONVERSATIONS_DIR}`);
    }
  }
  
  /**
   * Obtiene la ruta del archivo JSON para un teléfono
   */
  private getFilePath(phoneNumber: string): string {
    const normalized = normalizePhone(phoneNumber);
    return path.join(CONVERSATIONS_DIR, `${normalized}.json`);
  }
  
  /**
   * Obtiene o crea una conversación por número de teléfono
   * Esta es la función principal que se llama al inicio de cada mensaje
   */
  async getOrCreateConversation(phoneNumber: string): Promise<ConversationData> {
    const normalized = normalizePhone(phoneNumber);
    const filePath = this.getFilePath(normalized);
    
    try {
      // 1. Intentar cargar desde archivo JSON (más rápido)
      try {
        const content = await fsPromises.readFile(filePath, 'utf-8');
        const data = JSON.parse(content) as ConversationData;
        console.log(`[ConversationPersistence] Conversación cargada desde archivo: ${normalized}`);
        return data;
      } catch {
        // Archivo no existe, continuar a BD
      }
      
      // 2. Buscar en base de datos
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM whatsapp_conversation_persistence WHERE phone_number = ?`,
        [normalized]
      );
      
      if (rows.length > 0) {
        const dbRecord = rows[0];
        
        // Si existe en BD pero no el archivo, recrear archivo
        if (dbRecord.json_file_path) {
          try {
            const content = await fsPromises.readFile(dbRecord.json_file_path, 'utf-8');
            return JSON.parse(content) as ConversationData;
          } catch {
            // Archivo de BD no existe, recrear desde datos
          }
        }
        
        // Recrear desde datos de BD
        const conversation = createEmptyConversation(normalized);
        if (dbRecord.patient_id) {
          conversation.patient.patientId = dbRecord.patient_id;
          conversation.patient.documentNumber = dbRecord.document_number;
          conversation.patient.fullName = dbRecord.patient_name;
          conversation.patient.firstName = dbRecord.patient_first_name;
          conversation.patient.eps = dbRecord.patient_eps;
          conversation.isIdentified = true;
          conversation.identifiedAt = dbRecord.first_contact_at;
        }
        conversation.messageCount = dbRecord.message_count || 0;
        conversation.conversationSummary = dbRecord.conversation_summary || '';
        
        // Guardar archivo
        await this.saveConversation(conversation);
        return conversation;
      }
      
      // 3. Crear nueva conversación
      console.log(`[ConversationPersistence] Creando nueva conversación para: ${normalized}`);
      const newConversation = createEmptyConversation(normalized);
      
      // Guardar en BD
      await pool.query<ResultSetHeader>(
        `INSERT INTO whatsapp_conversation_persistence 
         (phone_number, json_file_path, conversation_state, first_contact_at) 
         VALUES (?, ?, 'new', NOW())`,
        [normalized, filePath]
      );
      
      // Guardar archivo
      await this.saveConversation(newConversation);
      
      return newConversation;
      
    } catch (error) {
      console.error('[ConversationPersistence] Error obteniendo conversación:', error);
      // En caso de error, devolver conversación vacía pero funcional
      return createEmptyConversation(normalized);
    }
  }
  
  /**
   * Guarda la conversación tanto en archivo como en BD
   */
  async saveConversation(conversation: ConversationData): Promise<void> {
    const filePath = this.getFilePath(conversation.phoneNumber);
    conversation.updatedAt = new Date().toISOString();
    
    try {
      // 1. Guardar archivo JSON (async)
      await fsPromises.writeFile(filePath, JSON.stringify(conversation, null, 2), 'utf-8');
      
      // 2. Actualizar BD
      await pool.query(
        `UPDATE whatsapp_conversation_persistence SET
          patient_id = ?,
          document_number = ?,
          patient_name = ?,
          patient_first_name = ?,
          patient_eps = ?,
          conversation_state = ?,
          last_specialty_requested = ?,
          message_count = ?,
          last_message_at = NOW(),
          conversation_summary = ?,
          appointments_scheduled = ?,
          updated_at = NOW()
        WHERE phone_number = ?`,
        [
          conversation.patient.patientId || null,
          conversation.patient.documentNumber || null,
          conversation.patient.fullName || null,
          conversation.patient.firstName || null,
          conversation.patient.eps || null,
          conversation.currentContext.state === 'completed' ? 'completed' : 
            conversation.isIdentified ? 'identified' : 'new',
          conversation.currentContext.selectedSpecialty || null,
          conversation.messageCount,
          conversation.conversationSummary,
          JSON.stringify(conversation.appointments),
          conversation.phoneNumber
        ]
      );
      
      console.log(`[ConversationPersistence] Conversación guardada: ${conversation.phoneNumber}`);
      
    } catch (error) {
      console.error('[ConversationPersistence] Error guardando conversación:', error);
    }
  }
  
  /**
   * Actualiza los datos del paciente cuando se identifica
   */
  async updatePatientData(phoneNumber: string, patientData: KnownPatientData): Promise<void> {
    const conversation = await this.getOrCreateConversation(phoneNumber);
    
    conversation.patient = {
      ...conversation.patient,
      ...patientData
    };
    conversation.isIdentified = true;
    conversation.identifiedAt = new Date().toISOString();
    conversation.askedQuestions.cedula = true;
    conversation.askedQuestions.nombre = true;
    
    if (patientData.documentNumber) {
      conversation.collectedAnswers['cedula'] = {
        value: patientData.documentNumber,
        collectedAt: new Date().toISOString()
      };
    }
    
    if (patientData.fullName) {
      conversation.collectedAnswers['nombre'] = {
        value: patientData.fullName,
        collectedAt: new Date().toISOString()
      };
    }
    
    await this.saveConversation(conversation);
  }
  
  /**
   * Marca una pregunta como realizada
   */
  async markQuestionAsked(phoneNumber: string, question: keyof AskedQuestions): Promise<void> {
    const conversation = await this.getOrCreateConversation(phoneNumber);
    conversation.askedQuestions[question] = true;
    await this.saveConversation(conversation);
  }
  
  /**
   * Guarda una respuesta recolectada
   */
  async saveCollectedAnswer(phoneNumber: string, key: string, value: string): Promise<void> {
    const conversation = await this.getOrCreateConversation(phoneNumber);
    conversation.collectedAnswers[key] = {
      value,
      collectedAt: new Date().toISOString()
    };
    await this.saveConversation(conversation);
  }
  
  /**
   * Actualiza el contexto actual de la conversación
   */
  async updateContext(phoneNumber: string, context: Partial<ConversationData['currentContext']>): Promise<void> {
    const conversation = await this.getOrCreateConversation(phoneNumber);
    conversation.currentContext = {
      ...conversation.currentContext,
      ...context
    };
    await this.saveConversation(conversation);
  }
  
  /**
   * Registra una nueva interacción (mensaje enviado/recibido)
   */
  async recordInteraction(
    phoneNumber: string, 
    userMessage: string, 
    botResponse: string,
    intent?: string
  ): Promise<void> {
    const conversation = await this.getOrCreateConversation(phoneNumber);
    
    conversation.messageCount++;
    conversation.lastInteraction = {
      timestamp: new Date().toISOString(),
      userMessage,
      botResponse,
      intent
    };
    
    // Actualizar resumen automáticamente
    await this.updateSummary(conversation);
    
    await this.saveConversation(conversation);
    
    // Guardar en historial de mensajes
    try {
      const [convRecord] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM whatsapp_conversation_persistence WHERE phone_number = ?`,
        [normalizePhone(phoneNumber)]
      );
      
      if (convRecord.length > 0) {
        await pool.query(
          `INSERT INTO whatsapp_message_history 
           (conversation_id, direction, message_text, extracted_data) 
           VALUES (?, 'incoming', ?, NULL)`,
          [convRecord[0].id, userMessage]
        );
        await pool.query(
          `INSERT INTO whatsapp_message_history 
           (conversation_id, direction, message_text, extracted_data) 
           VALUES (?, 'outgoing', ?, NULL)`,
          [convRecord[0].id, botResponse]
        );
      }
    } catch (error) {
      // No crítico, solo logging
      console.error('[ConversationPersistence] Error guardando historial:', error);
    }
  }
  
  /**
   * Agrega una cita agendada a la conversación
   */
  async addAppointment(phoneNumber: string, appointment: AppointmentData): Promise<void> {
    const conversation = await this.getOrCreateConversation(phoneNumber);
    conversation.appointments.push(appointment);
    conversation.currentContext.state = 'completed';
    await this.saveConversation(conversation);
  }
  
  /**
   * Actualiza el resumen de la conversación
   */
  private async updateSummary(conversation: ConversationData): Promise<void> {
    const parts: string[] = [];
    
    if (conversation.isIdentified && conversation.patient.firstName) {
      parts.push(`Paciente identificado: ${conversation.patient.fullName}`);
    }
    
    if (conversation.patient.eps) {
      parts.push(`EPS: ${conversation.patient.eps}`);
    }
    
    if (conversation.currentContext.selectedSpecialty) {
      parts.push(`Especialidad solicitada: ${conversation.currentContext.selectedSpecialty}`);
    }
    
    if (conversation.currentContext.selectedDate) {
      parts.push(`Fecha preferida: ${conversation.currentContext.selectedDate}`);
    }
    
    if (conversation.appointments.length > 0) {
      const lastAppt = conversation.appointments[conversation.appointments.length - 1];
      parts.push(`Última cita agendada: ${lastAppt.specialty} con ${lastAppt.doctorName} el ${lastAppt.date}`);
    }
    
    conversation.conversationSummary = parts.join('. ');
  }
  
  /**
   * Genera el contexto para inyectar en el prompt del modelo
   * Esta es la función clave que proporciona memoria al bot
   */
  async generateContextForModel(phoneNumber: string): Promise<string> {
    const conversation = await this.getOrCreateConversation(phoneNumber);
    
    const lines: string[] = [];
    lines.push('=== MEMORIA DE CONVERSACIÓN PREVIA ===');
    
    // Información del paciente
    if (conversation.isIdentified) {
      lines.push(`✓ PACIENTE YA IDENTIFICADO:`);
      lines.push(`  - Nombre: ${conversation.patient.fullName || 'No registrado'}`);
      lines.push(`  - Cédula: ${conversation.patient.documentNumber || 'No registrada'}`);
      lines.push(`  - EPS: ${conversation.patient.eps || 'No registrada'}`);
      lines.push(`  - ID en sistema: ${conversation.patient.patientId || 'N/A'}`);
      lines.push(`  → USA EL NOMBRE "${conversation.patient.firstName}" AL DIRIGIRTE AL PACIENTE`);
    } else {
      lines.push(`✗ PACIENTE AÚN NO IDENTIFICADO - Debes solicitar la cédula`);
    }
    
    // Preguntas ya realizadas
    const askedList = Object.entries(conversation.askedQuestions)
      .filter(([_, asked]) => asked)
      .map(([q, _]) => q);
    
    if (askedList.length > 0) {
      lines.push(`\n✓ PREGUNTAS YA REALIZADAS (NO REPETIR):`);
      askedList.forEach(q => lines.push(`  - ${q}`));
    }
    
    // Respuestas conocidas
    const knownAnswers = Object.entries(conversation.collectedAnswers);
    if (knownAnswers.length > 0) {
      lines.push(`\n✓ INFORMACIÓN YA RECOLECTADA:`);
      knownAnswers.forEach(([key, data]) => {
        lines.push(`  - ${key}: ${data.value}`);
      });
    }
    
    // Contexto actual
    lines.push(`\n✓ ESTADO ACTUAL DE LA CONVERSACIÓN: ${conversation.currentContext.state}`);
    
    if (conversation.currentContext.selectedSpecialty) {
      lines.push(`  - Especialidad seleccionada: ${conversation.currentContext.selectedSpecialty}`);
    }
    if (conversation.currentContext.selectedDate) {
      lines.push(`  - Fecha seleccionada: ${conversation.currentContext.selectedDate}`);
    }
    if (conversation.currentContext.selectedLocation) {
      lines.push(`  - Sede seleccionada: ${conversation.currentContext.selectedLocation}`);
    }
    
    // Citas previas
    if (conversation.appointments.length > 0) {
      lines.push(`\n✓ CITAS AGENDADAS EN ESTA CONVERSACIÓN:`);
      conversation.appointments.forEach((apt, i) => {
        lines.push(`  ${i + 1}. ${apt.specialty} - ${apt.date} ${apt.time} - ${apt.location}`);
      });
    }
    
    // Última interacción
    if (conversation.lastInteraction.userMessage) {
      lines.push(`\n✓ ÚLTIMA INTERACCIÓN:`);
      lines.push(`  Usuario dijo: "${conversation.lastInteraction.userMessage.substring(0, 100)}..."`);
    }
    
    // Total de mensajes
    lines.push(`\nTotal mensajes en esta conversación: ${conversation.messageCount}`);
    lines.push('=== FIN MEMORIA ===\n');
    
    return lines.join('\n');
  }
  
  /**
   * Limpia conversaciones inactivas (más de X días)
   */
  async cleanupOldConversations(daysOld: number = 30): Promise<number> {
    try {
      const [result] = await pool.query<ResultSetHeader>(
        `DELETE FROM whatsapp_conversation_persistence 
         WHERE last_message_at < DATE_SUB(NOW(), INTERVAL ? DAY)
         AND conversation_state IN ('completed', 'inactive')`,
        [daysOld]
      );
      
      console.log(`[ConversationPersistence] Limpieza: ${result.affectedRows} conversaciones eliminadas`);
      return result.affectedRows;
    } catch (error) {
      console.error('[ConversationPersistence] Error en limpieza:', error);
      return 0;
    }
  }
  
  /**
   * Busca si el teléfono ya está asociado a un paciente en el sistema
   */
  async findPatientByPhone(phoneNumber: string): Promise<KnownPatientData | null> {
    const normalized = normalizePhone(phoneNumber);
    
    try {
      // Buscar en pacientes por teléfono
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, document, first_name, last_name, phone, email, birth_date, gender
         FROM patients 
         WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') LIKE ?
         LIMIT 1`,
        [`%${normalized.slice(-10)}%`]  // Últimos 10 dígitos
      );
      
      if (rows.length > 0) {
        const p = rows[0];
        return {
          patientId: p.id,
          documentNumber: p.document,
          fullName: `${p.first_name} ${p.last_name}`.trim(),
          firstName: p.first_name,
          phone: p.phone,
          email: p.email,
          birthDate: p.birth_date,
          gender: p.gender
        };
      }
      
      return null;
    } catch (error) {
      console.error('[ConversationPersistence] Error buscando paciente por teléfono:', error);
      return null;
    }
  }
  
  /**
   * Al recibir el primer mensaje, intenta identificar automáticamente
   */
  async autoIdentifyFromPhone(phoneNumber: string): Promise<ConversationData> {
    const conversation = await this.getOrCreateConversation(phoneNumber);
    
    // Si ya está identificado, no hacer nada
    if (conversation.isIdentified) {
      return conversation;
    }
    
    // Intentar encontrar paciente por teléfono
    const patient = await this.findPatientByPhone(phoneNumber);
    
    if (patient) {
      console.log(`[ConversationPersistence] Paciente auto-identificado por teléfono: ${patient.fullName}`);
      
      // Buscar EPS del paciente
      const [epsRows] = await pool.query<RowDataPacket[]>(
        `SELECT e.name FROM eps e 
         INNER JOIN patients p ON p.eps_id = e.id 
         WHERE p.id = ?`,
        [patient.patientId]
      );
      
      if (epsRows.length > 0) {
        patient.eps = epsRows[0].name;
      }
      
      await this.updatePatientData(phoneNumber, patient);
      return this.getOrCreateConversation(phoneNumber);
    }
    
    return conversation;
  }
}

// Exportar instancia singleton
export const conversationPersistence = new ConversationPersistenceService();

// ============================================================================
// FUNCIONES DE COMPATIBILIDAD PARA USO SÍNCRONO
// ============================================================================

// Cache en memoria para acceso rápido síncrono
const MAX_MEMORY_CACHE = 500;
const memoryCache = new Map<string, ConversationData>();

/**
 * Agregar entrada al cache con límite de tamaño (LRU simple)
 */
function setCacheEntry(key: string, value: ConversationData): void {
  // Si ya existe, eliminar para re-insertar al final (más reciente)
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
  }
  // Si excede el límite, eliminar las entradas más antiguas
  if (memoryCache.size >= MAX_MEMORY_CACHE) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) memoryCache.delete(firstKey);
  }
  memoryCache.set(key, value);
}

/**
 * Función SÍNCRONA para generar contexto para el prompt de IA
 * Lee de la cache en memoria o del archivo JSON directamente
 * Esta función es llamada por generateDynamicContext en WhatsAppAIService
 */
export function generateContextForAI(phoneNumber: string): string {
  const normalized = normalizePhone(phoneNumber);
  const filePath = path.join(CONVERSATIONS_DIR, `${normalized}.json`);
  
  try {
    // Intentar leer de cache primero
    let conversation = memoryCache.get(normalized);
    
    // Si no está en cache, leer del archivo
    if (!conversation && fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      conversation = JSON.parse(content) as ConversationData;
      setCacheEntry(normalized, conversation);
    }
    
    if (!conversation) {
      return ''; // No hay conversación previa
    }
    
    const lines: string[] = [];
    
    // Solo agregar contexto si hay información útil
    if (conversation.isIdentified && conversation.patient.fullName) {
      lines.push('=== 🧠 MEMORIA PERSISTENTE DE CONVERSACIÓN ===');
      lines.push('');
      lines.push('## PACIENTE IDENTIFICADO:');
      lines.push(`- Nombre completo: ${conversation.patient.fullName}`);
      lines.push(`- Nombre a usar: ${conversation.patient.firstName}`);
      if (conversation.patient.documentNumber) {
        lines.push(`- Cédula: ${conversation.patient.documentNumber}`);
      }
      if (conversation.patient.eps) {
        lines.push(`- EPS: ${conversation.patient.eps}`);
      }
      lines.push('');
      lines.push(`⚠️ IMPORTANTE: Usa "${conversation.patient.firstName}" al dirigirte al paciente.`);
      lines.push('⚠️ NO preguntes cédula ni nombre - ya los conoces.');
      
      // Agregar preguntas ya realizadas
      const askedList = Object.entries(conversation.askedQuestions || {})
        .filter(([_, asked]) => asked)
        .map(([q, _]) => q);
      
      if (askedList.length > 0) {
        lines.push('');
        lines.push('## PREGUNTAS YA REALIZADAS (NO REPETIR):');
        askedList.forEach(q => lines.push(`- ${q}`));
      }
      
      // Información recolectada
      const collected = Object.entries(conversation.collectedAnswers || {});
      if (collected.length > 0) {
        lines.push('');
        lines.push('## INFORMACIÓN YA RECOLECTADA:');
        collected.forEach(([key, data]) => {
          lines.push(`- ${key}: ${data.value}`);
        });
      }
      
      // Contexto actual
      if (conversation.currentContext) {
        if (conversation.currentContext.selectedSpecialty) {
          lines.push('');
          lines.push(`## ESPECIALIDAD SOLICITADA: ${conversation.currentContext.selectedSpecialty}`);
          lines.push('→ NO preguntes especialidad de nuevo');
        }
        if (conversation.currentContext.selectedDate) {
          lines.push(`## FECHA SELECCIONADA: ${conversation.currentContext.selectedDate}`);
        }
        if (conversation.currentContext.selectedLocation) {
          lines.push(`## SEDE SELECCIONADA: ${conversation.currentContext.selectedLocation}`);
        }
      }
      
      // Citas agendadas
      if (conversation.appointments && conversation.appointments.length > 0) {
        lines.push('');
        lines.push('## CITAS AGENDADAS ANTERIORMENTE:');
        conversation.appointments.forEach((apt, i) => {
          lines.push(`${i + 1}. ${apt.specialty} - ${apt.date} ${apt.time} con ${apt.doctorName}`);
        });
      }
      
      lines.push('');
      lines.push(`Mensajes en esta conversación: ${conversation.messageCount || 0}`);
      lines.push('=== FIN MEMORIA PERSISTENTE ===');
      lines.push('');
    }
    
    return lines.join('\n');
  } catch (error) {
    console.error('[ConversationPersistence] Error generando contexto:', error);
    return '';
  }
}

/**
 * Actualiza la cache en memoria después de guardar
 */
export function updateCache(phoneNumber: string, conversation: ConversationData): void {
  const normalized = normalizePhone(phoneNumber);
  setCacheEntry(normalized, conversation);
}

/**
 * Limpia la cache de un teléfono específico
 */
export function clearCache(phoneNumber: string): void {
  const normalized = normalizePhone(phoneNumber);
  memoryCache.delete(normalized);
}

/**
 * Funciones wrapper para uso más fácil
 */
export const getConversation = (phone: string) => conversationPersistence.getOrCreateConversation(phone);
export const saveConversation = (conv: ConversationData) => {
  updateCache(conv.phoneNumber, conv);
  return conversationPersistence.saveConversation(conv);
};
export const updatePatient = (phone: string, data: KnownPatientData) => conversationPersistence.updatePatientData(phone, data);
export const recordMessage = (phone: string, userMsg: string, botResp: string) => conversationPersistence.recordInteraction(phone, userMsg, botResp);
export const addAppointment = (phone: string, apt: AppointmentData) => conversationPersistence.addAppointment(phone, apt);
export const autoIdentify = (phone: string) => conversationPersistence.autoIdentifyFromPhone(phone);
export const generateContextAsync = (phone: string) => conversationPersistence.generateContextForModel(phone);
export const updateContext = (phone: string, ctx: Partial<ConversationData['currentContext']>) => conversationPersistence.updateContext(phone, ctx);
export const markQuestion = (phone: string, q: keyof AskedQuestions) => conversationPersistence.markQuestionAsked(phone, q);
export const saveAnswer = (phone: string, key: string, value: string) => conversationPersistence.saveCollectedAnswer(phone, key, value);

export default conversationPersistence;
