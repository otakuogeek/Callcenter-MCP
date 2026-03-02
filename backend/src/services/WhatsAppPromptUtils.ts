// ============================================================================
// WHATSAPP PROMPT UTILS - Módulo de funciones de formato y limpieza para IA
// ============================================================================

import { logger as aiLogger } from '../lib/logger';

/**
 * Detecta si un valor es un placeholder (e.g. "[id]", "[numero]", etc.)
 * que el modelo AI envió en lugar de un número real.
 */
export function isPlaceholder(val: any): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim();
    return lower === '[id]' || lower === '[id real]' ||
      lower === 'id' || lower === '[numero]' ||
      lower.includes('[') || lower.includes('{{') ||
      lower === 'real' || lower === 'pendiente';
  }
  return false;
}

/**
 * Corrige argumentos de tool calls reemplazando placeholders con valores reales del estado.
 * Aplica a patient_id, availability_id y scheduled_date.
 */
export function fixToolCallPlaceholders(
  args: Record<string, any>,
  stateCtx: any,
  context: any,
  phone: string
): void {
  // Corregir patient_id
  if (isPlaceholder(args.patient_id)) {
    const realPatientId = stateCtx?.patientId || context.patient_id;
    if (realPatientId) {
      aiLogger.warn({ phone, original: args.patient_id, corrected: realPatientId }, '🔧 Corrigiendo patient_id placeholder');
      args.patient_id = realPatientId;
    }
  }

  // Corregir availability_id
  if (isPlaceholder(args.availability_id)) {
    const realAvailabilityId = stateCtx?.availabilityId;
    if (realAvailabilityId) {
      aiLogger.warn({ phone, original: args.availability_id, corrected: realAvailabilityId }, '🔧 Corrigiendo availability_id placeholder');
      args.availability_id = realAvailabilityId;
    }
  }

  // Corregir scheduled_date/scheduled_datetime - soportar ambos campos
  const hasScheduledDate = args.scheduled_date && !isPlaceholder(args.scheduled_date);
  const hasScheduledDatetime = args.scheduled_datetime && !isPlaceholder(args.scheduled_datetime);

  if (!hasScheduledDate && !hasScheduledDatetime) {
    if (stateCtx?.scheduledDatetime) {
      args.scheduled_datetime = stateCtx.scheduledDatetime;
      args.scheduled_date = stateCtx.scheduledDatetime;
    } else if (stateCtx?.selectedDate && stateCtx?.selectedTime) {
      args.scheduled_datetime = `${stateCtx.selectedDate} ${stateCtx.selectedTime}`;
      args.scheduled_date = args.scheduled_datetime;
    } else if (stateCtx?.selectedDate) {
      args.scheduled_datetime = stateCtx.selectedDate;
      args.scheduled_date = stateCtx.selectedDate;
    }
    if (args.scheduled_datetime) {
      aiLogger.warn({ phone, corrected: args.scheduled_datetime }, '🔧 Corrigiendo scheduled_datetime desde estado');
    }
  } else if (hasScheduledDate && !hasScheduledDatetime) {
    // Si la IA pasó scheduled_date pero no scheduled_datetime, copiar
    args.scheduled_datetime = args.scheduled_date;
  }
}

// ============================================================================
// LIMPIEZA DE RESPUESTAS - REMOVER JSON Y RESULTADOS DE HERRAMIENTAS
// ============================================================================

/**
 * Limpia la respuesta final removiendo cualquier JSON o resultado de herramienta
 * que el modelo haya incluido incorrectamente
 */
export function cleanResponseFromToolResults(text: string): string {
  if (!text) return text;

  let cleaned = text;

  // 1. Remover bloques [Resultado de XXX]: {...}
  // Este patrón busca [Resultado de cualquierHerramienta]: seguido de un JSON
  cleaned = cleaned.replace(/\[Resultado de \w+\]:\s*\{[\s\S]*?\n\}/g, '');

  // 2. Remover bloques que empiezan con { "success": true/false
  cleaned = cleaned.replace(/\{\s*"success":\s*(true|false)[\s\S]*?\n\s*\}/g, '');

  // 3. Remover bloques JSON completos que quedaron sueltos
  cleaned = cleaned.replace(/^\s*\{[^{}]*("data"|"patient"|"appointments"|"doctor_name")[^{}]*\}\s*$/gm, '');

  // 4. Remover mensajes de "Un momento" o "Estoy verificando"
  cleaned = cleaned.replace(/¡?Un momento,?\s*por favor!?\s*[🔄⏳]?\s*(Estoy verificando|voy a verificar|verificando)[^\n]*\n*/gi, '');

  // 5. Remover líneas que son puramente JSON properties
  cleaned = cleaned.replace(/^\s*"[a-z_]+"\s*:\s*[^,\n]+,?\s*$/gm, '');

  // 6. Remover corchetes y llaves sueltas
  cleaned = cleaned.replace(/^\s*[\[\]{}]\s*$/gm, '');

  // 7. Remover líneas que parecen ser parte de un JSON (empiezan con comillas y dos puntos)
  cleaned = cleaned.replace(/^\s*"[^"]+"\s*:\s*\[[\s\S]*?\],?\s*$/gm, '');

  // 8. Limpiar múltiples saltos de línea
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // =========================================================================
  // DETECCIÓN Y ELIMINACIÓN DE TEXTO REPETITIVO
  // =========================================================================

  // 9. Detectar frases repetidas (el modelo a veces entra en loops)
  // Buscar patrones que se repiten 3+ veces
  const lines = cleaned.split('\n');
  const uniqueLines: string[] = [];
  const seenLines = new Set<string>();

  for (const line of lines) {
    const normalizedLine = line.trim().toLowerCase();
    // Permitir líneas vacías y líneas cortas (números, emojis)
    if (normalizedLine.length === 0 || normalizedLine.length < 10) {
      uniqueLines.push(line);
    } else if (!seenLines.has(normalizedLine)) {
      seenLines.add(normalizedLine);
      uniqueLines.push(line);
    }
  }
  cleaned = uniqueLines.join('\n');

  // 10. Detectar patrones repetitivos en texto continuo
  const repeatPattern = /(.{20,}?)\1{2,}/g;
  if (repeatPattern.test(cleaned)) {
    cleaned = cleaned.replace(repeatPattern, '$1');
  }

  // 11. Detectar "no, pero si"
  const confusionPattern = /(no,?\s*pero\s*si|si,?\s*pero\s*no)/gi;
  const confusionMatches = cleaned.match(confusionPattern);
  if (confusionMatches && confusionMatches.length > 2) {
    aiLogger.warn('[WhatsAppAI] ⚠️ Detectado texto confuso/repetitivo, limpiando respuesta');
    cleaned = "Un momento, déjame verificar la información correcta en el sistema. 😊";
  }

  // 12. Limitar longitud máxima
  if (cleaned.length > 1500) {
    aiLogger.warn(`[WhatsAppAI] ⚠️ Respuesta muy larga (${cleaned.length} chars), truncando`);
    const cutPoint = cleaned.lastIndexOf('.', 1400);
    if (cutPoint > 500) {
      cleaned = cleaned.substring(0, cutPoint + 1);
    } else {
      cleaned = cleaned.substring(0, 1400) + '...';
    }
  }

  // 13. Limpiar espacios
  cleaned = cleaned.trim();

  return cleaned;
}

// ============================================================================
// POLÍTICA DE EMOJIS
// ============================================================================

export function limitEmojisPerLine(text: string, maxPerLine = 1, maxTotal = 2): string {
  if (!text) return text;

  const emojiRegex = /\p{Extended_Pictographic}/gu;
  let totalCount = 0;

  const limited = text
    .split('\n')
    .map(line => {
      let lineCount = 0;
      return line.replace(emojiRegex, (match) => {
        if (totalCount >= maxTotal) return '';
        if (lineCount >= maxPerLine) return '';
        totalCount += 1;
        lineCount += 1;
        return match;
      }).replace(/\s{2,}/g, ' ').replace(/\s+$/g, '');
    })
    .join('\n')
    .replace(/[ \t]+\n/g, '\n');

  return limited.trim();
}

/**
 * Obtener mensaje de error amigable según la herramienta y tipo de error
 */
export function getToolErrorMessage(toolName: string, error: any): string {
  const errorMessage = error?.message?.toLowerCase() || '';

  // Errores de conexión
  if (errorMessage.includes('timeout') || errorMessage.includes('econnrefused') || errorMessage.includes('network')) {
    return 'Hay un problema temporal de conexión con el sistema. Por favor, intenta de nuevo en unos segundos.';
  }

  // Errores específicos por herramienta
  const toolErrors: Record<string, string> = {
    'searchPatient': 'No pude verificar tu información en este momento. ¿Podrías confirmarme tu número de documento nuevamente?',
    'registerPatientSimple': 'Hubo un problema al crear tu perfil. ¿Podrías confirmar tus datos nuevamente?',
    'getAvailableAppointments': 'No pude consultar la disponibilidad de citas. Por favor, intenta de nuevo.',
    'scheduleAppointment': 'No pude confirmar tu cita en este momento. ¿Deseas que lo intentemos de nuevo?',
    'cancelAppointment': 'No pude procesar la cancelación. Por favor, intenta de nuevo o llámanos al 6076911308.',
    'getAvailableTimeSlots': 'No pude obtener los horarios disponibles. ¿Podrías indicarme nuevamente la fecha que prefieres?',
    'getAvailableTimeSlotsForDoctorOnDate': 'No pude verificar los horarios disponibles para esa fecha. Por favor, intenta de nuevo.',
    'checkAvailabilityQuota': 'No pude verificar los cupos disponibles. Por favor, intenta de nuevo.',
    'actualizarPhone': 'No pude actualizar tu número de teléfono. ¿Podrías confirmármelo nuevamente?',
    'listActiveEPS': 'No pude consultar la lista de EPS disponibles.',
    'searchCups': 'No pude encontrar ese código CUPS. ¿Podrías verificarlo?',
    'searchCupsByName': 'No pude buscar el procedimiento. ¿Podrías darme más detalles?'
  };

  return toolErrors[toolName] || 'Hubo un problema técnico. Por favor, intenta de nuevo.';
}

export function parseToolCalls(message: string): { text: string; toolCalls: Array<{ name: string; args: Record<string, any> }> } {
  const toolCalls: Array<{ name: string; args: Record<string, any> }> = [];
  const seenTools = new Set<string>(); // Deduplicar tool calls idénticos

  // Buscar patrones [TOOL:nombre:{"args"}]
  const toolPattern = /\[(?:TOOL|TODOL|TOOl|tool):(\w+):(\{[^]*?\})\]/gi;
  let match;

  while ((match = toolPattern.exec(message)) !== null) {
    const [, toolName, argsJson] = match;
    try {
      const args = JSON.parse(argsJson);

      const dedupKey = `${toolName}:${JSON.stringify(args)}`;
      if (!seenTools.has(dedupKey)) {
        seenTools.add(dedupKey);
        toolCalls.push({ name: toolName, args });
      } else {
        aiLogger.debug({ tool: toolName }, 'Duplicate tool call filtered out in parser');
      }
    } catch (e) {
      try {
        const fixedJson = argsJson
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          .replace(/'/g, '"')
          .replace(/(\w+)\s*:/g, '"$1":')
          .replace(/""+/g, '"');
        const args = JSON.parse(fixedJson);
        const dedupKey = `${toolName}:${JSON.stringify(args)}`;
        if (!seenTools.has(dedupKey)) {
          seenTools.add(dedupKey);
          toolCalls.push({ name: toolName, args });
          aiLogger.info({ tool: toolName }, 'Recovered malformed JSON in tool call');
        }
      } catch {
        aiLogger.warn({ tool: toolName, argsJson: argsJson.substring(0, 200) }, 'Error parsing tool args (unrecoverable)');
      }
    }
  }

  let cleanText = message.replace(toolPattern, '').trim();
  cleanText = cleanText.replace(/\[(?:TOOL|TODOL|TOOl|tool):\s*\w+[^\]]*\]/gi, '').trim();
  cleanText = cleanText.replace(/\[Resultado de \w+\]:\s*\{[\s\S]*?\}(?=\n\n|$|\[|¡|[A-Z])/gi, '').trim();
  cleanText = cleanText.replace(/^\s*\{\s*"success":\s*(true|false)[\s\S]*?\}\s*$/gm, '').trim();
  cleanText = cleanText.replace(/¡?Un momento,?\s*por favor!?\s*[🔄⏳]?\s*(Estoy verificando|voy a verificar|verificando)[^\n]*\n*/gi, '').trim();
  cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();

  return { text: cleanText, toolCalls };
}

export function formatDateForComparison(dateStr: string): string {
  try {
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const date = new Date(dateStr + 'T12:00:00');
    const day = date.getDate();
    const month = months[date.getMonth()];
    return `${day} de ${month}`;
  } catch {
    return dateStr;
  }
}

export function formatTimeForComparison(timeStr: string): string {
  try {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const hour12 = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    return `${hour12}:${String(minutes).padStart(2, '0')}`;
  } catch {
    return timeStr;
  }
}

// ============================================================================
// NORMALIZACIÓN DE FECHAS PARA WHATSAPP (UTC-0 -> UTC-5 Colombia)
// ============================================================================

const WHATSAPP_AMPM_REGEX = /(a\.?\s?m\.?|p\.?\s?m\.?|am|pm)/i;
const WHATSAPP_DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const WHATSAPP_TIME_ONLY_REGEX = /^\d{2}:\d{2}(:\d{2})?$/;
const WHATSAPP_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/;

import { formatDateTimeColombia, formatDateColombia, formatTimeColombia, formatFullDateColombia } from '../utils/dateUtils';

export function normalizeToolResultDatesForWhatsApp(result: any): any {
  const visited = new WeakMap<object, any>();

  const shouldSkipKey = (key?: string) => !!key && /local|colombia/i.test(key);

  const convertTimeOnlyToColombia = (timeValue: string) => {
    const normalized = timeValue.length === 5 ? `${timeValue}:00` : timeValue;
    return formatTimeColombia(`1970-01-01 ${normalized}`);
  };

  const addColombiaFields = (out: any, key: string, value: string) => {
    if (shouldSkipKey(key) || WHATSAPP_AMPM_REGEX.test(value)) return;

    if (WHATSAPP_DATETIME_REGEX.test(value) || value.includes('T')) {
      out[`${key}_colombia`] = formatDateTimeColombia(value);
      out[`${key}_date_colombia`] = formatDateColombia(value);
      out[`${key}_time_colombia`] = formatTimeColombia(value);
      out[`${key}_full_date_colombia`] = formatFullDateColombia(value);
      return;
    }

    if (WHATSAPP_DATE_ONLY_REGEX.test(value)) {
      out[`${key}_colombia`] = formatDateColombia(value);
      out[`${key}_full_date_colombia`] = formatFullDateColombia(value);
      return;
    }

    if (WHATSAPP_TIME_ONLY_REGEX.test(value)) {
      out[`${key}_colombia`] = convertTimeOnlyToColombia(value);
    }
  };

  const walk = (value: any, key?: string): any => {
    if (value === null || value === undefined) return value;

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(item => walk(item));
    }

    if (typeof value === 'object') {
      if (visited.has(value)) return visited.get(value);

      const out: any = {};
      visited.set(value, out);

      for (const [k, v] of Object.entries(value)) {
        if (v instanceof Date) {
          const iso = v.toISOString();
          out[k] = iso;
          addColombiaFields(out, k, iso);
          continue;
        }

        out[k] = walk(v, k);

        if (typeof v === 'string') {
          addColombiaFields(out, k, v);
        }
      }

      return out;
    }

    return value;
  };

  return walk(result);
}

// ============================================================================
// COMPRESIÓN DE RESULTADOS DE HERRAMIENTAS PARA HISTORIAL
// Reduce el tamaño de los resultados en context.messages para ahorrar tokens
// ============================================================================

export function summarizeToolResult(toolName: string, result: any): string {
  if (!result || !result.success) {
    return JSON.stringify(result);
  }

  const d = result.data;

  switch (toolName) {
    case 'searchPatient':
      if (d?.found) {
        const p = d.patient || d.patients?.[0];
        return JSON.stringify({
          success: true,
          data: {
            found: true,
            patient: {
              id: p?.id, name: p?.full_name || p?.name, document: p?.document,
              phone: p?.phone || p?.mobile, eps_name: p?.eps_name, eps_id: p?.eps_id
            }
          }
        });
      }
      return JSON.stringify({ success: true, data: { found: false } });

    case 'getAvailableAppointments':
      // Pre-formatear datos claros para GPT-5-mini (modelo de razonamiento)
      if (d?.opciones_disponibles && d.opciones_disponibles.length > 0) {
        // Agrupar por doctor para mostrar especialistas disponibles
        const doctorMap: Record<string, { doctor_name: string; doctor_id: number; dates: any[] }> = {};
        for (const o of d.opciones_disponibles) {
          const dName = o.doctor || 'Sin asignar';
          if (!doctorMap[dName]) {
            doctorMap[dName] = { doctor_name: dName, doctor_id: o.doctor_id, dates: [] };
          }
          doctorMap[dName].dates.push({
            availability_id: o.availability_id,
            fecha: o.fecha,
            fecha_iso: o.fecha_iso,
            sede: o.sede,
            direccion_sede: o.direccion_sede,
            cupos: o.cupos,
            specialty_id: o.specialty_id,
            horarios_disponibles: (o.horarios_disponibles || []).slice(0, 6),
            horarios_24h: (o.horarios_24h || []).slice(0, 6)
          });
        }
        const specialists = Object.values(doctorMap);
        return JSON.stringify({
          success: true,
          data: {
            total_agendas: d.total,
            total_especialistas: specialists.length,
            especialistas: specialists.map((s: any) => ({
              doctor_name: s.doctor_name,
              doctor_id: s.doctor_id,
              fechas_disponibles: s.dates.slice(0, 5)
            })),
            instrucciones: 'Presenta máximo 3 fechas al usuario. Si hay más, pregunta si desea ver más opciones. Cuando elija fecha, llama getAvailableTimeSlots con el availability_id correspondiente.'
          }
        });
      }
      return JSON.stringify({ success: true, data: { total_agendas: 0, mensaje: 'No hay agendas disponibles' } });

    case 'getAvailableTimeSlots':
    case 'getAvailableTimeSlotsForDoctorOnDate':
      if (d?.available_time_slots || d?.available_times) {
        const slots = (d.available_time_slots || d.slots_detail || []).slice(0, 12);
        return JSON.stringify({
          success: true,
          data: { ...d, available_time_slots: slots, slots_detail: slots.slice(0, 12) }
        });
      }
      return JSON.stringify(result).substring(0, 1500);

    case 'scheduleAppointment':
      // Mantener resultado completo — es crítico para la confirmación
      return JSON.stringify(result);

    case 'listActiveEPS':
      // Solo nombres y IDs
      if (d?.eps_list) {
        return JSON.stringify({
          success: true,
          data: { eps_list: d.eps_list.map((e: any) => ({ id: e.id, name: e.name })) }
        });
      }
      return JSON.stringify(result);

    case 'getPatientAppointments':
      if (d?.appointments) {
        return JSON.stringify({
          success: true,
          data: {
            appointments: d.appointments.slice(0, 5).map((a: any) => ({
              id: a.id, specialty: a.specialty_name, doctor: a.doctor_name,
              date: a.scheduled_date_colombia || a.scheduled_date,
              time: a.scheduled_time_colombia || a.scheduled_time,
              status: a.status, location: a.location_name
            }))
          }
        });
      }
      return JSON.stringify(result).substring(0, 1500);

    default:
      // Para otras herramientas, truncar a máx 1500 chars
      const json = JSON.stringify(result);
      return json.length > 1500 ? json.substring(0, 1500) + '...' : json;
  }
}
