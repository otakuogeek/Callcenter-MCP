/**
 * Utilidades de procesamiento de texto para WhatsApp
 * @module whatsapp/utils/text
 */

import { logger } from '../config';

/**
 * Limpia la respuesta final removiendo JSON, resultados de herramientas,
 * texto repetitivo y otros artefactos del procesamiento de IA.
 */
export function cleanResponseFromToolResults(text: string): string {
  if (!text) return text;

  let cleaned = text;

  // 0. Remove [TOOL:name:{args}] calls and [TOOL_RESULT:name:{result}] blocks
  cleaned = cleaned.replace(/\[TOOL:\w+:\{[^}]*\}\]/g, '');
  cleaned = cleaned.replace(/\[TOOL_RESULT:\w+:[^\]]*\]/g, '');

  // 1. Bloques [Resultado de XXX]: {...}
  cleaned = cleaned.replace(/\[Resultado de \w+\]:\s*\{[\s\S]*?\n\}/g, '');

  // 2. Bloques JSON { "success": true/false }
  cleaned = cleaned.replace(/\{\s*"success":\s*(true|false)[\s\S]*?\n\s*\}/g, '');

  // 3. JSON completos sueltos con keys comunes
  cleaned = cleaned.replace(/^\s*\{[^{}]*("data"|"patient"|"appointments"|"doctor_name")[^{}]*\}\s*$/gm, '');

  // 4. Mensajes de "Un momento"
  cleaned = cleaned.replace(/¡?Un momento,?\s*por favor!?\s*[🔄⏳]?\s*(Estoy verificando|voy a verificar|verificando)[^\n]*\n*/gi, '');

  // 5. Líneas de properties JSON
  cleaned = cleaned.replace(/^\s*"[a-z_]+"\s*:\s*[^,\n]+,?\s*$/gm, '');

  // 6. Llaves/corchetes sueltos
  cleaned = cleaned.replace(/^\s*[\[\]{}]\s*$/gm, '');

  // 7. Arrays JSON
  cleaned = cleaned.replace(/^\s*"[^"]+"\s*:\s*\[[\s\S]*?\],?\s*$/gm, '');

  // 8. Múltiples saltos de línea
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // 9. Líneas repetidas
  const lines = cleaned.split('\n');
  const uniqueLines: string[] = [];
  const seenLines = new Set<string>();

  for (const line of lines) {
    const normalized = line.trim().toLowerCase();
    if (normalized.length === 0 || normalized.length < 10) {
      uniqueLines.push(line);
    } else if (!seenLines.has(normalized)) {
      seenLines.add(normalized);
      uniqueLines.push(line);
    }
  }
  cleaned = uniqueLines.join('\n');

  // 10. Patrones repetitivos en texto continuo
  const repeatPattern = /(.{20,}?)\1{2,}/g;
  if (repeatPattern.test(cleaned)) {
    cleaned = cleaned.replace(repeatPattern, '$1');
  }

  // 11. Detección de texto confuso
  const confusionPattern = /(no,?\s*pero\s*si|si,?\s*pero\s*no)/gi;
  const confusionMatches = cleaned.match(confusionPattern);
  if (confusionMatches && confusionMatches.length > 2) {
    logger.warn('Detectado texto confuso/repetitivo, limpiando respuesta');
    cleaned = 'Un momento, déjame verificar la información correcta en el sistema. 😊';
  }

  // 12. Limitar longitud
  if (cleaned.length > 1500) {
    logger.warn({ length: cleaned.length }, 'Respuesta muy larga, truncando');
    const cutPoint = cleaned.lastIndexOf('.', 1400);
    cleaned = cutPoint > 500 ? cleaned.substring(0, cutPoint + 1) : cleaned.substring(0, 1400) + '...';
  }

  return cleaned.trim();
}

/** Limita emojis por línea y en total */
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

/** Limpia placeholders residuales de la respuesta */
export function stripResidualPlaceholders(text: string): string {
  return text
    .replace(/\[data\.appointment_id\]/gi, '')
    .replace(/data\.appointment_id/gi, '')
    .replace(/\[esperando.*herramienta\]/gi, '')
    .replace(/\*\*Cita #\*\*:\s*$/gm, '')
    .trim();
}

/** Reemplaza placeholders con un appointment_id real */
export function replacePlaceholdersWithId(text: string, appointmentId: number): string {
  return text
    .replace(/\[data\.appointment_id\]/gi, String(appointmentId))
    .replace(/data\.appointment_id/gi, String(appointmentId))
    .replace(/\[esperando.*herramienta\]/gi, String(appointmentId))
    .replace(/\*\*Cita #\*\*:\s*\[.*?\]/gi, `**Cita #**: ${appointmentId}`)
    .replace(/Cita #\*:\s*\[.*?\]/gi, `Cita #*: ${appointmentId}`);
}

/** Limpia número de teléfono del formato WhatsApp */
export function cleanPhone(phone: string): string {
  return phone.replace(/@.*/, '');
}
