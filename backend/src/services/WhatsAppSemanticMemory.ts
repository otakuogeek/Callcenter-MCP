/**
 * WhatsApp Semantic Memory Service
 * 
 * Sistema de memoria semántica inspirado en moltbot/memory-lancedb
 * Características:
 * - Búsqueda vectorial de memorias relevantes
 * - Auto-captura de información importante
 * - Auto-recall contextual antes de cada respuesta
 * - Categorización automática de memorias
 * - Detección de duplicados
 * 
 * @version 1.0.0
 * @description Memoria a largo plazo con búsqueda semántica para WhatsApp
 */

import pool from '../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pino from 'pino';
import axios from 'axios';

const logger = pino({
  name: 'whatsapp-semantic-memory',
  level: process.env.LOG_LEVEL || 'info'
});

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const SIMILARITY_THRESHOLD = 0.7; // Umbral mínimo de similitud
const DUPLICATE_THRESHOLD = 0.95; // Umbral para detectar duplicados
const MAX_MEMORIES_PER_CAPTURE = 3; // Máximo de memorias a capturar por conversación
const AUTO_RECALL_LIMIT = 5; // Máximo de memorias a inyectar

// ============================================================================
// CACHE DE EMBEDDINGS (Inspirado en moltbot)
// ============================================================================

interface CachedEmbedding {
  embedding: number[];
  timestamp: number;
}

const EMBEDDING_CACHE_TTL = 60 * 60 * 1000; // 1 hora en ms
const embeddingCache = new Map<string, CachedEmbedding>();

/**
 * Genera un hash simple para usar como clave de cache
 */
function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `emb_${hash.toString(16)}`;
}

/**
 * Limpia entradas expiradas del cache
 */
function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, value] of embeddingCache.entries()) {
    if (now - value.timestamp > EMBEDDING_CACHE_TTL) {
      embeddingCache.delete(key);
    }
  }
}

// Limpiar cache cada 10 minutos
setInterval(cleanExpiredCache, 10 * 60 * 1000);

// ============================================================================
// TIPOS
// ============================================================================

export type MemoryCategory = 
  | 'preference'    // Preferencias del usuario (doctor preferido, horario, sede)
  | 'medical_info'  // Información médica (alergias, condiciones)
  | 'contact_info'  // Información de contacto (teléfono, dirección)
  | 'appointment'   // Historial de citas
  | 'feedback'      // Retroalimentación del servicio
  | 'entity'        // Entidades mencionadas (nombres, fechas importantes)
  | 'fact'          // Hechos sobre el paciente
  | 'other';        // Otros

export interface SemanticMemory {
  id: number;
  session_id: number;
  patient_id: number | null;
  category: MemoryCategory;
  content: string;
  embedding: number[] | null;
  importance: number; // 0-1
  source: 'auto' | 'manual' | 'tool';
  metadata: Record<string, any> | null;
  created_at: Date;
  last_accessed_at: Date;
  access_count: number;
}

export interface MemorySearchResult {
  memory: SemanticMemory;
  similarity: number;
}

// ============================================================================
// PATRONES DE CAPTURA AUTOMÁTICA
// ============================================================================

/**
 * Patrones que indican información importante que debe ser guardada
 * Inspirado en moltbot MEMORY_TRIGGERS
 */
const MEMORY_TRIGGERS: Array<{ pattern: RegExp; category: MemoryCategory; importance: number }> = [
  // Preferencias explícitas
  { pattern: /prefiero|me gusta m[aá]s|siempre quiero|mejor si/i, category: 'preference', importance: 0.8 },
  { pattern: /no me gusta|evitar|nunca|no quiero/i, category: 'preference', importance: 0.8 },
  
  // Información médica
  { pattern: /soy al[ée]rgico|tengo alergia|no puedo (tomar|consumir)/i, category: 'medical_info', importance: 0.95 },
  { pattern: /padezco|sufro de|tengo (diabetes|hipertensi[oó]n|asma)/i, category: 'medical_info', importance: 0.9 },
  { pattern: /tomo (medicamento|pastilla|medicina)/i, category: 'medical_info', importance: 0.85 },
  { pattern: /mi (enfermedad|condici[oó]n|diagn[oó]stico)/i, category: 'medical_info', importance: 0.85 },
  
  // Información de contacto
  { pattern: /mi (n[uú]mero|tel[eé]fono|celular) (es|nuevo)/i, category: 'contact_info', importance: 0.9 },
  { pattern: /vivo en|mi direcci[oó]n|me mud[eé]/i, category: 'contact_info', importance: 0.8 },
  { pattern: /mi correo|email/i, category: 'contact_info', importance: 0.8 },
  
  // Preferencias de citas
  { pattern: /prefiero (ma[nñ]ana|tarde|noche)/i, category: 'preference', importance: 0.7 },
  { pattern: /mi doctor favorito|siempre me atiende/i, category: 'preference', importance: 0.8 },
  { pattern: /la sede (de|m[aá]s cerca|que me queda)/i, category: 'preference', importance: 0.7 },
  
  // Información familiar
  { pattern: /mi (esposo|esposa|hijo|hija|mam[aá]|pap[aá])/i, category: 'entity', importance: 0.6 },
  { pattern: /trabajo en|soy (doctor|ingeniero|abogado|profesor)/i, category: 'fact', importance: 0.5 },
  
  // Feedback
  { pattern: /muy (buen|mal|excelente) (servicio|atenci[oó]n)/i, category: 'feedback', importance: 0.7 },
  { pattern: /queja|reclamo|felicitaci[oó]n/i, category: 'feedback', importance: 0.8 },
  
  // Entidades importantes
  { pattern: /\+?\d{10,12}/, category: 'contact_info', importance: 0.8 }, // Números telefónicos
  { pattern: /[\w.-]+@[\w.-]+\.\w+/, category: 'contact_info', importance: 0.8 }, // Emails
];

// ============================================================================
// FUNCIONES DE EMBEDDING
// ============================================================================

/**
 * Genera embedding vectorial para un texto usando OpenAI
 * CON CACHE para evitar llamadas repetidas (inspirado en moltbot)
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY) {
    logger.warn('OPENAI_API_KEY no configurada, embeddings deshabilitados');
    return null;
  }

  // Normalizar texto para cache
  const normalizedText = text.trim().toLowerCase().slice(0, 500);
  const cacheKey = hashText(normalizedText);
  
  // Verificar cache
  const cached = embeddingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < EMBEDDING_CACHE_TTL) {
    logger.debug({ cacheKey, textLength: text.length }, 'Embedding obtenido de cache');
    return cached.embedding;
  }

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/embeddings',
      {
        model: EMBEDDING_MODEL,
        input: text,
        dimensions: EMBEDDING_DIMENSIONS
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    const embedding = response.data.data[0].embedding;
    
    // Guardar en cache
    embeddingCache.set(cacheKey, {
      embedding,
      timestamp: Date.now()
    });
    
    logger.debug({ cacheKey, textLength: text.length }, 'Embedding generado y cacheado');
    return embedding;
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error generando embedding');
    return null;
  }
}

/**
 * Calcula la similitud coseno entre dos vectores
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ============================================================================
// BÚSQUEDA HÍBRIDA (Inspirado en moltbot/hybrid.ts)
// ============================================================================

/**
 * Búsqueda por texto completo (Full-Text Search)
 * Usa LIKE con wildcards como fallback si FULLTEXT no está disponible
 */
async function searchByFullText(
  sessionId: number,
  query: string,
  limit: number = 10
): Promise<MemorySearchResult[]> {
  try {
    // Preparar términos de búsqueda (palabras con más de 2 caracteres)
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2)
      .slice(0, 5); // Máximo 5 términos
    
    if (terms.length === 0) return [];
    
    // Construir consulta con LIKE para cada término
    const likeConditions = terms.map(() => 'LOWER(content) LIKE ?').join(' OR ');
    const likeParams = terms.map(t => `%${t}%`);
    
    const sql = `
      SELECT *, 
        (${terms.map(() => '(CASE WHEN LOWER(content) LIKE ? THEN 1 ELSE 0 END)').join(' + ')}) as match_score
      FROM whatsapp_semantic_memories 
      WHERE session_id = ? AND (${likeConditions})
      ORDER BY match_score DESC, importance DESC
      LIMIT ?
    `;
    
    const params = [
      ...terms.map(t => `%${t}%`), // Para match_score
      sessionId,
      ...likeParams, // Para WHERE
      limit
    ];
    
    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    
    return rows.map(row => ({
      memory: {
        id: row.id,
        session_id: row.session_id,
        patient_id: row.patient_id,
        category: row.category as MemoryCategory,
        content: row.content,
        embedding: null,
        importance: row.importance,
        source: row.source,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
        created_at: row.created_at,
        last_accessed_at: row.last_accessed_at,
        access_count: row.access_count
      },
      similarity: Math.min(0.9, (row.match_score / terms.length) * 0.7 + 0.2) // Normalizar score FTS
    }));
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error en búsqueda FTS');
    return [];
  }
}

/**
 * Fusiona resultados de búsqueda vectorial y FTS (Reciprocal Rank Fusion)
 * Inspirado en moltbot/hybrid.ts mergeHybridResults
 */
function mergeHybridResults(
  vectorResults: MemorySearchResult[],
  ftsResults: MemorySearchResult[],
  weights: { vector: number; fts: number } = { vector: 0.6, fts: 0.4 }
): MemorySearchResult[] {
  const k = 60; // Constante RRF
  const merged = new Map<number, { memory: SemanticMemory; score: number }>();
  
  // Agregar scores de resultados vectoriales
  vectorResults.forEach((result, idx) => {
    const rrfScore = weights.vector * (1 / (k + idx + 1));
    const existing = merged.get(result.memory.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      merged.set(result.memory.id, { memory: result.memory, score: rrfScore });
    }
  });
  
  // Agregar scores de resultados FTS
  ftsResults.forEach((result, idx) => {
    const rrfScore = weights.fts * (1 / (k + idx + 1));
    const existing = merged.get(result.memory.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      merged.set(result.memory.id, { memory: result.memory, score: rrfScore });
    }
  });
  
  // Convertir a array y ordenar por score
  const results = Array.from(merged.values())
    .sort((a, b) => b.score - a.score)
    .map(item => ({
      memory: item.memory,
      similarity: Math.min(1, item.score * 100) // Normalizar score
    }));
  
  return results;
}

/**
 * Búsqueda híbrida combinando vector + FTS
 */
async function hybridSearch(
  sessionId: number,
  query: string,
  options?: {
    limit?: number;
    minSimilarity?: number;
    categories?: MemoryCategory[];
    vectorWeight?: number;
    ftsWeight?: number;
  }
): Promise<MemorySearchResult[]> {
  const limit = options?.limit || AUTO_RECALL_LIMIT;
  const vectorWeight = options?.vectorWeight || 0.6;
  const ftsWeight = options?.ftsWeight || 0.4;
  
  // Ejecutar ambas búsquedas en paralelo
  const [vectorResults, ftsResults] = await Promise.all([
    searchMemoriesVector(sessionId, query, options),
    searchByFullText(sessionId, query, limit * 2)
  ]);
  
  // Fusionar resultados
  const merged = mergeHybridResults(
    vectorResults, 
    ftsResults,
    { vector: vectorWeight, fts: ftsWeight }
  );
  
  logger.debug({
    sessionId,
    vectorCount: vectorResults.length,
    ftsCount: ftsResults.length,
    mergedCount: merged.length
  }, 'Búsqueda híbrida completada');
  
  return merged.slice(0, limit);
}

/**
 * Búsqueda solo vectorial (función interna)
 */
async function searchMemoriesVector(
  sessionId: number,
  query: string,
  options?: {
    limit?: number;
    minSimilarity?: number;
    categories?: MemoryCategory[];
  }
): Promise<MemorySearchResult[]> {
  const limit = options?.limit || AUTO_RECALL_LIMIT;
  const minSimilarity = options?.minSimilarity || SIMILARITY_THRESHOLD;
  
  try {
    const queryEmbedding = await generateEmbedding(query);
    if (!queryEmbedding) return [];
    
    let sql = `SELECT * FROM whatsapp_semantic_memories 
               WHERE session_id = ? AND embedding IS NOT NULL`;
    const params: any[] = [sessionId];
    
    if (options?.categories && options.categories.length > 0) {
      sql += ` AND category IN (${options.categories.map(() => '?').join(',')})`;
      params.push(...options.categories);
    }
    
    sql += ' ORDER BY importance DESC, created_at DESC LIMIT 100';
    
    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    
    const results: MemorySearchResult[] = [];
    
    for (const row of rows) {
      const memoryEmbedding = JSON.parse(row.embedding);
      const similarity = cosineSimilarity(queryEmbedding, memoryEmbedding);
      
      if (similarity >= minSimilarity) {
        results.push({
          memory: {
            id: row.id,
            session_id: row.session_id,
            patient_id: row.patient_id,
            category: row.category as MemoryCategory,
            content: row.content,
            embedding: null,
            importance: row.importance,
            source: row.source,
            metadata: row.metadata ? JSON.parse(row.metadata) : null,
            created_at: row.created_at,
            last_accessed_at: row.last_accessed_at,
            access_count: row.access_count
          },
          similarity
        });
      }
    }
    
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error en búsqueda vectorial');
    return [];
  }
}

// ============================================================================
// DETECCIÓN DE INFORMACIÓN IMPORTANTE
// ============================================================================

/**
 * Determina si un texto contiene información que debe ser capturada
 */
function shouldCapture(text: string): { should: boolean; category: MemoryCategory; importance: number } | null {
  // Filtrar textos muy cortos o muy largos
  if (text.length < 15 || text.length > 500) return null;
  
  // Ignorar respuestas del sistema/bot
  if (text.includes('[TOOL:') || text.includes('CONTEXTO DEL SISTEMA')) return null;
  
  // Ignorar mensajes con muchos emojis (probablemente del bot)
  const emojiCount = (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  if (emojiCount > 3) return null;
  
  // Buscar patrones de captura
  for (const trigger of MEMORY_TRIGGERS) {
    if (trigger.pattern.test(text)) {
      return {
        should: true,
        category: trigger.category,
        importance: trigger.importance
      };
    }
  }
  
  return null;
}

/**
 * Detecta la categoría de un texto basado en su contenido
 */
function detectCategory(text: string): MemoryCategory {
  const lower = text.toLowerCase();
  
  if (/al[ée]rgico|medicamento|enfermedad|dolor|s[ií]ntoma/i.test(lower)) return 'medical_info';
  if (/prefiero|me gusta|siempre|nunca|mejor/i.test(lower)) return 'preference';
  if (/tel[ée]fono|n[uú]mero|direcci[oó]n|correo/i.test(lower)) return 'contact_info';
  if (/cita|agenda|doctor|consulta/i.test(lower)) return 'appointment';
  if (/servicio|atenci[oó]n|queja|felicit/i.test(lower)) return 'feedback';
  if (/es|son|tiene|hay/i.test(lower)) return 'fact';
  
  return 'other';
}

// ============================================================================
// GESTIÓN DE MEMORIAS
// ============================================================================

/**
 * Guarda una nueva memoria semántica
 */
export async function storeMemory(
  sessionId: number,
  content: string,
  options?: {
    patientId?: number;
    category?: MemoryCategory;
    importance?: number;
    source?: 'auto' | 'manual' | 'tool';
    metadata?: Record<string, any>;
  }
): Promise<number | null> {
  const category = options?.category || detectCategory(content);
  const importance = options?.importance || 0.7;
  const source = options?.source || 'auto';
  
  try {
    // Generar embedding
    const embedding = await generateEmbedding(content);
    
    // Verificar duplicados si tenemos embedding
    if (embedding) {
      const isDuplicate = await checkDuplicate(sessionId, embedding);
      if (isDuplicate) {
        logger.info({ sessionId, content: content.slice(0, 50) }, 'Memoria duplicada detectada, ignorando');
        return null;
      }
    }
    
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO whatsapp_semantic_memories 
       (session_id, patient_id, category, content, embedding, importance, source, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        options?.patientId || null,
        category,
        content,
        embedding ? JSON.stringify(embedding) : null,
        importance,
        source,
        options?.metadata ? JSON.stringify(options.metadata) : null
      ]
    );
    
    logger.info({ 
      memoryId: result.insertId, 
      sessionId, 
      category, 
      importance 
    }, 'Memoria semántica guardada');
    
    return result.insertId;
  } catch (error: any) {
    logger.error({ error: error.message, sessionId }, 'Error guardando memoria semántica');
    return null;
  }
}

/**
 * Verifica si ya existe una memoria similar (duplicado)
 */
async function checkDuplicate(sessionId: number, embedding: number[]): Promise<boolean> {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, embedding FROM whatsapp_semantic_memories 
       WHERE session_id = ? AND embedding IS NOT NULL
       ORDER BY created_at DESC LIMIT 50`,
      [sessionId]
    );
    
    for (const row of rows) {
      const existingEmbedding = JSON.parse(row.embedding);
      const similarity = cosineSimilarity(embedding, existingEmbedding);
      if (similarity >= DUPLICATE_THRESHOLD) {
        return true;
      }
    }
    
    return false;
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error verificando duplicados');
    return false;
  }
}

/**
 * Busca memorias relevantes usando BÚSQUEDA HÍBRIDA (Vector + FTS)
 * Combina lo mejor de ambos mundos para mejores resultados
 * Inspirado en moltbot/hybrid.ts
 */
export async function searchMemories(
  sessionId: number,
  query: string,
  options?: {
    limit?: number;
    minSimilarity?: number;
    categories?: MemoryCategory[];
    useHybrid?: boolean; // Por defecto true
  }
): Promise<MemorySearchResult[]> {
  const limit = options?.limit || AUTO_RECALL_LIMIT;
  const useHybrid = options?.useHybrid !== false; // Híbrido por defecto
  
  try {
    let results: MemorySearchResult[];
    
    if (useHybrid) {
      // Usar búsqueda híbrida (vector + FTS)
      results = await hybridSearch(sessionId, query, {
        limit,
        minSimilarity: options?.minSimilarity,
        categories: options?.categories
      });
      
      logger.debug({ 
        sessionId, 
        query: query.slice(0, 50), 
        resultsCount: results.length,
        mode: 'hybrid'
      }, 'Búsqueda híbrida completada');
    } else {
      // Fallback a solo vectorial
      results = await searchMemoriesVector(sessionId, query, options);
      
      logger.debug({ 
        sessionId, 
        query: query.slice(0, 50), 
        resultsCount: results.length,
        mode: 'vector-only'
      }, 'Búsqueda vectorial completada');
    }
    
    // Actualizar contadores de acceso
    if (results.length > 0) {
      const ids = results.map(r => r.memory.id);
      await pool.execute(
        `UPDATE whatsapp_semantic_memories 
         SET access_count = access_count + 1, last_accessed_at = NOW()
         WHERE id IN (${ids.join(',')})`,
        []
      );
    }
    
    return results;
  } catch (error: any) {
    logger.error({ error: error.message, sessionId }, 'Error buscando memorias');
    return [];
  }
}

/**
 * Genera el contexto de memoria para inyectar en el prompt
 * Similar a moltbot "auto-recall"
 */
export async function generateMemoryContext(
  sessionId: number,
  currentMessage: string
): Promise<string | null> {
  try {
    const memories = await searchMemories(sessionId, currentMessage, {
      limit: 5,
      minSimilarity: 0.5 // Umbral más bajo para recall
    });
    
    if (memories.length === 0) return null;
    
    const memoryLines = memories.map((m, i) => {
      const categoryEmoji = getCategoryEmoji(m.memory.category);
      const confidenceStr = Math.round(m.similarity * 100);
      return `${i + 1}. ${categoryEmoji} [${m.memory.category}] ${m.memory.content} (${confidenceStr}% relevante)`;
    });
    
    return `
---
🧠 MEMORIAS RELEVANTES DEL PACIENTE (usar para personalizar respuesta):
${memoryLines.join('\n')}
---
`;
  } catch (error: any) {
    logger.error({ error: error.message, sessionId }, 'Error generando contexto de memoria');
    return null;
  }
}

function getCategoryEmoji(category: MemoryCategory): string {
  const emojis: Record<MemoryCategory, string> = {
    preference: '⭐',
    medical_info: '🏥',
    contact_info: '📞',
    appointment: '📅',
    feedback: '💬',
    entity: '👤',
    fact: '📋',
    other: '📝'
  };
  return emojis[category] || '📝';
}

// ============================================================================
// AUTO-CAPTURA DE MEMORIAS
// ============================================================================

/**
 * Analiza mensajes de una conversación y captura información importante
 * Similar a moltbot "auto-capture"
 */
export async function autoCapture(
  sessionId: number,
  messages: Array<{ role: string; content: string }>,
  patientId?: number
): Promise<number> {
  let capturedCount = 0;
  
  // Solo procesar mensajes del usuario
  const userMessages = messages.filter(m => m.role === 'user');
  
  for (const msg of userMessages) {
    if (capturedCount >= MAX_MEMORIES_PER_CAPTURE) break;
    
    const captureResult = shouldCapture(msg.content);
    if (captureResult && captureResult.should) {
      const memoryId = await storeMemory(sessionId, msg.content, {
        patientId,
        category: captureResult.category,
        importance: captureResult.importance,
        source: 'auto'
      });
      
      if (memoryId) {
        capturedCount++;
        logger.info({ 
          memoryId, 
          category: captureResult.category,
          content: msg.content.slice(0, 50) 
        }, 'Memoria auto-capturada');
      }
    }
  }
  
  return capturedCount;
}

// ============================================================================
// RESÚMENES INTELIGENTES
// ============================================================================

/**
 * Genera un resumen de la conversación usando IA
 */
export async function generateConversationSummary(
  sessionId: number,
  messages: Array<{ role: string; content: string }>
): Promise<string | null> {
  if (!OPENAI_API_KEY || messages.length < 5) return null;
  
  try {
    const conversationText = messages
      .slice(-20) // Últimos 20 mensajes
      .map(m => `${m.role === 'user' ? 'Paciente' : 'Valeria'}: ${m.content}`)
      .join('\n');
    
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Eres un asistente que resume conversaciones médicas.
Genera un resumen conciso (máximo 3 oraciones) de los puntos clave:
- Intención principal del paciente
- Información importante mencionada (preferencias, condiciones médicas)
- Resultado de la conversación (cita agendada, información proporcionada, etc.)
Solo devuelve el resumen, sin explicaciones adicionales.`
          },
          {
            role: 'user',
            content: `Resume esta conversación:\n\n${conversationText}`
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );
    
    const summary = response.data.choices[0]?.message?.content;
    
    if (summary) {
      // Guardar en la tabla de resúmenes
      await pool.execute(
        `INSERT INTO whatsapp_chat_summaries 
         (session_id, summary, period_start, period_end, messages_count)
         VALUES (?, ?, NOW() - INTERVAL 1 HOUR, NOW(), ?)`,
        [sessionId, summary, messages.length]
      );
      
      logger.info({ sessionId, messagesCount: messages.length }, 'Resumen de conversación generado');
    }
    
    return summary;
  } catch (error: any) {
    logger.error({ error: error.message }, 'Error generando resumen de conversación');
    return null;
  }
}

// ============================================================================
// GESTIÓN DE PREFERENCIAS
// ============================================================================

/**
 * Actualiza las preferencias del usuario basado en sus interacciones
 */
export async function updateUserPreferences(
  phone: string,
  preferences: {
    preferredSpecialtyId?: number;
    preferredLocationId?: number;
    preferredDoctorId?: number;
    notes?: string;
  }
): Promise<void> {
  try {
    const updates: string[] = [];
    const params: any[] = [];
    
    if (preferences.preferredSpecialtyId) {
      updates.push('preferred_specialty_id = ?');
      params.push(preferences.preferredSpecialtyId);
    }
    if (preferences.preferredLocationId) {
      updates.push('preferred_location_id = ?');
      params.push(preferences.preferredLocationId);
    }
    if (preferences.preferredDoctorId) {
      updates.push('preferred_doctor_id = ?');
      params.push(preferences.preferredDoctorId);
    }
    if (preferences.notes) {
      updates.push('notes = CONCAT(COALESCE(notes, ""), "\n", ?)');
      params.push(preferences.notes);
    }
    
    if (updates.length > 0) {
      // Upsert: insertar o actualizar
      await pool.execute(
        `INSERT INTO whatsapp_user_preferences (phone, ${updates.map(u => u.split(' = ')[0]).join(', ')})
         VALUES (?, ${params.map(() => '?').join(', ')})
         ON DUPLICATE KEY UPDATE ${updates.join(', ')}`,
        [phone, ...params, ...params]
      );
      
      logger.info({ phone }, 'Preferencias de usuario actualizadas');
    }
  } catch (error: any) {
    logger.error({ error: error.message, phone }, 'Error actualizando preferencias');
  }
}

/**
 * Obtiene las preferencias del usuario
 */
export async function getUserPreferences(phone: string): Promise<{
  preferredSpecialtyId?: number;
  preferredLocationId?: number;
  preferredDoctorId?: number;
  notes?: string;
} | null> {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT preferred_specialty_id, preferred_location_id, preferred_doctor_id, notes
       FROM whatsapp_user_preferences WHERE phone = ?`,
      [phone]
    );
    
    if (rows.length === 0) return null;
    
    return {
      preferredSpecialtyId: rows[0].preferred_specialty_id,
      preferredLocationId: rows[0].preferred_location_id,
      preferredDoctorId: rows[0].preferred_doctor_id,
      notes: rows[0].notes
    };
  } catch (error: any) {
    logger.error({ error: error.message, phone }, 'Error obteniendo preferencias');
    return null;
  }
}

// ============================================================================
// EXPORTACIÓN
// ============================================================================

export default {
  // Almacenamiento
  storeMemory,
  
  // Búsqueda
  searchMemories,
  generateMemoryContext,
  
  // Auto-captura
  autoCapture,
  shouldCapture,
  
  // Resúmenes
  generateConversationSummary,
  
  // Preferencias
  updateUserPreferences,
  getUserPreferences,
  
  // Utilidades
  detectCategory,
  generateEmbedding
};
