/**
 * WhatsApp Response Chunker Service
 * 
 * Inspirado en moltbot/auto-reply/chunk.ts
 * 
 * Divide respuestas largas en chunks apropiados para WhatsApp,
 * preservando la estructura del texto (párrafos, listas, código).
 * 
 * @version 1.0.0
 */

import pino from 'pino';

const logger = pino({
  name: 'whatsapp-chunker',
  level: process.env.LOG_LEVEL || 'info'
});

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

// Límite máximo de caracteres por mensaje de WhatsApp
const WHATSAPP_MAX_LENGTH = parseInt(process.env.WHATSAPP_MAX_MESSAGE_LENGTH || '4000', 10);

// Límite preferido (dejar margen para emojis, etc.)
const PREFERRED_CHUNK_SIZE = Math.floor(WHATSAPP_MAX_LENGTH * 0.95);

// Mínimo de caracteres para un chunk (evitar chunks muy pequeños)
const MIN_CHUNK_SIZE = 100;

// ============================================================================
// TIPOS
// ============================================================================

export type ChunkMode = 'length' | 'paragraph' | 'smart';

export interface ChunkOptions {
  maxLength?: number;
  mode?: ChunkMode;
  preserveMarkdown?: boolean;
  addContinuationMarker?: boolean;
}

export interface ChunkResult {
  chunks: string[];
  originalLength: number;
  chunkCount: number;
  mode: ChunkMode;
}

// ============================================================================
// UTILIDADES DE DETECCIÓN
// ============================================================================

/**
 * Detecta si el texto contiene bloques de código markdown
 */
function containsCodeBlock(text: string): boolean {
  return /```[\s\S]*?```/.test(text) || /`[^`]+`/.test(text);
}

/**
 * Detecta si una posición está dentro de un bloque de código
 */
function isInsideCodeBlock(text: string, position: number): boolean {
  const beforeText = text.substring(0, position);
  const tripleBacktickCount = (beforeText.match(/```/g) || []).length;
  return tripleBacktickCount % 2 !== 0;
}

/**
 * Encuentra el mejor punto de corte cerca de una posición
 */
function findBestBreakPoint(text: string, targetPosition: number, maxLength: number): number {
  // Nunca cortar dentro de un bloque de código
  if (isInsideCodeBlock(text, targetPosition)) {
    // Buscar el cierre del bloque de código
    const closePos = text.indexOf('```', targetPosition);
    if (closePos !== -1 && closePos < maxLength) {
      return closePos + 3;
    }
  }

  // Prioridades de puntos de corte (de mejor a peor)
  const breakPriorities = [
    // 1. Párrafos (doble salto de línea)
    { pattern: /\n\n+/g, offset: 0 },
    // 2. Fin de oración con salto de línea
    { pattern: /[.!?]\n/g, offset: 2 },
    // 3. Fin de lista
    { pattern: /\n(?=[-*•]|\d+\.)/g, offset: 1 },
    // 4. Fin de oración
    { pattern: /[.!?]\s+/g, offset: 2 },
    // 5. Coma o punto y coma
    { pattern: /[,;]\s+/g, offset: 2 },
    // 6. Cualquier espacio
    { pattern: /\s+/g, offset: 1 },
  ];

  const searchStart = Math.max(0, targetPosition - 200);
  const searchEnd = Math.min(text.length, targetPosition + 50);
  const searchText = text.substring(searchStart, searchEnd);

  for (const { pattern, offset } of breakPriorities) {
    let match: RegExpExecArray | null;
    let bestMatch: RegExpExecArray | null = null;
    
    // Reset regex
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(searchText)) !== null) {
      const absolutePos = searchStart + match.index + offset;
      
      // Buscar el match más cercano al target que no exceda maxLength
      if (absolutePos <= maxLength && absolutePos > MIN_CHUNK_SIZE) {
        if (!bestMatch || absolutePos > searchStart + bestMatch.index + offset) {
          bestMatch = match;
        }
      }
    }
    
    if (bestMatch) {
      return searchStart + bestMatch.index + offset;
    }
  }

  // Si no encontramos buen punto, cortar en maxLength
  return Math.min(targetPosition, maxLength);
}

// ============================================================================
// FUNCIONES DE CHUNKING
// ============================================================================

/**
 * Divide texto por longitud máxima
 */
function chunkByLength(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining.trim());
      break;
    }

    const breakPoint = findBestBreakPoint(remaining, maxLength, maxLength);
    const chunk = remaining.substring(0, breakPoint).trim();
    
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    
    remaining = remaining.substring(breakPoint).trim();
  }

  return chunks.filter(c => c.length > 0);
}

/**
 * Divide texto por párrafos, agrupando los que quepan juntos
 */
function chunkByParagraph(text: string, maxLength: number): string[] {
  // Normalizar saltos de línea
  const normalized = text.replace(/\r\n?/g, '\n');
  
  // Si no hay separadores de párrafo, usar chunking por longitud
  if (!/\n\s*\n/.test(normalized)) {
    return chunkByLength(normalized, maxLength);
  }

  // Dividir en párrafos
  const paragraphs = normalized.split(/\n\s*\n+/).filter(p => p.trim().length > 0);
  
  const chunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    
    // Si el párrafo solo es muy largo, dividirlo
    if (trimmedParagraph.length > maxLength) {
      // Guardar chunk actual si tiene contenido
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      // Dividir párrafo largo
      chunks.push(...chunkByLength(trimmedParagraph, maxLength));
      continue;
    }

    // Ver si cabe en el chunk actual
    const potentialChunk = currentChunk 
      ? currentChunk + '\n\n' + trimmedParagraph 
      : trimmedParagraph;

    if (potentialChunk.length <= maxLength) {
      currentChunk = potentialChunk;
    } else {
      // No cabe, guardar chunk actual y empezar nuevo
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = trimmedParagraph;
    }
  }

  // Guardar último chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Chunking inteligente que detecta el mejor modo automáticamente
 */
function chunkSmart(text: string, maxLength: number, preserveMarkdown: boolean): string[] {
  // Si el texto es corto, no dividir
  if (text.length <= maxLength) {
    return [text];
  }

  // Si contiene código, ser más cuidadoso
  if (preserveMarkdown && containsCodeBlock(text)) {
    return chunkByLength(text, maxLength);
  }

  // Si tiene estructura de párrafos, usar ese modo
  if (/\n\s*\n/.test(text)) {
    return chunkByParagraph(text, maxLength);
  }

  // Default: por longitud
  return chunkByLength(text, maxLength);
}

// ============================================================================
// API PÚBLICA
// ============================================================================

/**
 * Divide una respuesta en chunks apropiados para WhatsApp
 */
export function chunkResponse(text: string, options?: ChunkOptions): ChunkResult {
  const maxLength = options?.maxLength ?? PREFERRED_CHUNK_SIZE;
  const mode = options?.mode ?? 'smart';
  const preserveMarkdown = options?.preserveMarkdown ?? true;
  const addContinuationMarker = options?.addContinuationMarker ?? false;

  if (!text || text.trim().length === 0) {
    return {
      chunks: [],
      originalLength: 0,
      chunkCount: 0,
      mode
    };
  }

  const trimmedText = text.trim();
  let chunks: string[];

  switch (mode) {
    case 'length':
      chunks = chunkByLength(trimmedText, maxLength);
      break;
    case 'paragraph':
      chunks = chunkByParagraph(trimmedText, maxLength);
      break;
    case 'smart':
    default:
      chunks = chunkSmart(trimmedText, maxLength, preserveMarkdown);
      break;
  }

  // Agregar marcadores de continuación si se solicita
  if (addContinuationMarker && chunks.length > 1) {
    chunks = chunks.map((chunk, index) => {
      if (index < chunks.length - 1) {
        return chunk + ' ...';
      }
      return chunk;
    });
  }

  if (chunks.length > 1) {
    logger.info({
      originalLength: trimmedText.length,
      chunkCount: chunks.length,
      mode,
      chunkSizes: chunks.map(c => c.length)
    }, 'Response chunked');
  }

  return {
    chunks,
    originalLength: trimmedText.length,
    chunkCount: chunks.length,
    mode
  };
}

/**
 * Verifica si un texto necesita ser dividido
 */
export function needsChunking(text: string, maxLength?: number): boolean {
  const limit = maxLength ?? PREFERRED_CHUNK_SIZE;
  return text.length > limit;
}

/**
 * Obtiene la configuración actual del chunker
 */
export function getChunkerConfig(): {
  maxLength: number;
  preferredSize: number;
  minSize: number;
} {
  return {
    maxLength: WHATSAPP_MAX_LENGTH,
    preferredSize: PREFERRED_CHUNK_SIZE,
    minSize: MIN_CHUNK_SIZE
  };
}

// ============================================================================
// UTILIDADES ADICIONALES
// ============================================================================

/**
 * Estima cuántos chunks resultarán de un texto
 */
export function estimateChunkCount(text: string, maxLength?: number): number {
  const limit = maxLength ?? PREFERRED_CHUNK_SIZE;
  if (text.length <= limit) return 1;
  return Math.ceil(text.length / limit);
}

/**
 * Trunca un texto de forma inteligente si excede el límite
 */
export function smartTruncate(text: string, maxLength?: number): string {
  const limit = maxLength ?? PREFERRED_CHUNK_SIZE;
  
  if (text.length <= limit) return text;

  const breakPoint = findBestBreakPoint(text, limit - 10, limit - 10);
  return text.substring(0, breakPoint).trim() + '...';
}

export default {
  chunkResponse,
  needsChunking,
  getChunkerConfig,
  estimateChunkCount,
  smartTruncate
};
