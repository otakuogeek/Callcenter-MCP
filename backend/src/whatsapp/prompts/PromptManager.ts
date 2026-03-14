/**
 * Gestor de prompts con templates externos (.md)
 * Carga, compila y cachea prompts desde archivos en disco.
 * Soporta hot-reload en desarrollo.
 *
 * @module whatsapp/prompts/PromptManager
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../config';
import type { StateContext } from '../types';
import {
  generateContextForAI
} from '../../services/ConversationPersistence';

const TEMPLATES_DIR = path.join(__dirname, 'templates');

// Cache de plantillas compiladas
const templateCache = new Map<string, string>();

// ─── Carga de plantillas ─────────────────────────────────────────────────────

/** Lee un archivo de plantilla .md desde disco (con cache) */
function loadTemplate(name: string): string {
  if (templateCache.has(name) && process.env.NODE_ENV === 'production') {
    return templateCache.get(name)!;
  }

  const filePath = path.join(TEMPLATES_DIR, name);
  if (!fs.existsSync(filePath)) {
    logger.warn({ template: name }, 'Prompt template file not found');
    return '';
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  templateCache.set(name, content);
  logger.debug({ template: name, size: content.length }, 'Prompt template loaded');
  return content;
}

/** Invalida el cache (para hot-reload en dev) */
export function invalidateCache(): void {
  templateCache.clear();
  logger.info('Prompt template cache invalidated');
}

// ─── Compilación ─────────────────────────────────────────────────────────────

/** Reemplaza variables {{VAR}} en el template */
function compileTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

// ─── API Pública ─────────────────────────────────────────────────────────────

/** Construye el system prompt completo de Valeria */
export function buildSystemPrompt(vars?: {
  currentDateTime?: string;
  currentISODate?: string;
  currentISODateTime?: string;
  userPhone?: string;
}): string {
  const now = new Date();
  const colombiaDate = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const defaultDateTime = colombiaDate.toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const defaultISODate = colombiaDate.toISOString().split('T')[0];
  const defaultISODateTime = colombiaDate.toISOString().replace('Z', '-05:00');

  const raw = loadTemplate('system.md');
  return compileTemplate(raw, {
    CURRENT_DATETIME: vars?.currentDateTime || defaultDateTime,
    CURRENT_ISO_DATE: vars?.currentISODate || defaultISODate,
    CURRENT_ISO_DATETIME: vars?.currentISODateTime || defaultISODateTime,
    USER_PHONE: vars?.userPhone || 'desconocido'
  });
}

/** Genera el bloque de contexto dinámico que resume qué datos ya tenemos */
export function generateDynamicContext(stateContext: StateContext, phone?: string): string {
  const lines: string[] = [];

  // Contexto de persistencia JSON
  if (phone) {
    const persistentContext = generateContextForAI(phone);
    if (persistentContext && persistentContext.includes('PACIENTE IDENTIFICADO')) {
      lines.push(persistentContext);
      lines.push('');
    }
  }

  lines.push('## 📋 CONTEXTO ACTUAL');
  lines.push('');

  // Paciente
  if (stateContext.patientId) {
    lines.push(`✅ **Paciente:** ${stateContext.patientName || 'Identificado'} (ID: ${stateContext.patientId})`);
    if (stateContext.patientDocument) lines.push(`   Documento: ${stateContext.patientDocument}`);
    if ((stateContext as any).patientAge) lines.push(`   Edad: ${(stateContext as any).patientAge} años`);
    if ((stateContext as any).patientGender) lines.push(`   Género: ${(stateContext as any).patientGender === 'M' ? 'Masculino' : (stateContext as any).patientGender === 'F' ? 'Femenino' : (stateContext as any).patientGender}`);
    if ((stateContext as any).patientEpsName) lines.push(`   EPS: ${(stateContext as any).patientEpsName}`);
    // Eligibility reminders for AI
    if ((stateContext as any).patientGender === 'M') {
      lines.push('   ⚠️ Género MASCULINO → NO ofrecer Ginecología ni Control Prenatal');
    }
    if ((stateContext as any).patientAge && (stateContext as any).patientAge > 17) {
      lines.push(`   ⚠️ Mayor de 17 años (${(stateContext as any).patientAge}) → NO ofrecer Pediatría`);
    }
    lines.push('   → NO pidas cédula de nuevo');
  } else {
    lines.push('❌ **Paciente:** No identificado → Pedir cédula');
  }

  // Especialidad
  if (stateContext.specialtyName) {
    lines.push(`✅ **Especialidad:** ${stateContext.specialtyName}`);
    lines.push('   → NO preguntes especialidad de nuevo');
  } else if (stateContext.patientId) {
    lines.push('❌ **Especialidad:** Pendiente → Preguntar qué necesita');
  }

  // Doctor / Fecha / Disponibilidad
  if (stateContext.selectedDoctor) {
    lines.push(`✅ **Doctor:** ${stateContext.selectedDoctor}`);
  }
  if (stateContext.selectedDate) {
    lines.push(`✅ **Fecha:** ${stateContext.selectedDate} ${stateContext.selectedTime || ''}`);
  }
  if (stateContext.availabilityId) {
    lines.push(`✅ **Availability ID:** ${stateContext.availabilityId}`);
  }
  if (stateContext.availableAppointments?.length) {
    lines.push(`📅 **Opciones cargadas:** ${stateContext.availableAppointments.length} citas disponibles`);
  }
  if (stateContext.lastAppointmentId) {
    lines.push(`🎉 **Cita #${stateContext.lastAppointmentId}** ya confirmada - NO agendar de nuevo`);
  }

  lines.push('');
  lines.push('---');

  return lines.join('\n');
}

// ─── Hot-reload en desarrollo ────────────────────────────────────────────────

if (process.env.NODE_ENV !== 'production') {
  try {
    fs.watch(TEMPLATES_DIR, { recursive: true }, (eventType, filename) => {
      if (filename && filename.endsWith('.md')) {
        logger.info({ file: filename, event: eventType }, 'Prompt template changed — invalidating cache');
        templateCache.delete(filename);
      }
    });
  } catch {
    // fs.watch puede fallar en algunos sistemas, no es crítico
  }
}
