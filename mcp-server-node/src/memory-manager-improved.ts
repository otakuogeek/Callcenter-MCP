import { pool } from './db/mysql.js';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// Interfaces mejoradas para el sistema de memoria
interface ConversationMemory {
  session_id: string;
  conversation_context: {
    user_preferences: Record<string, any>;
    topics_discussed: string[];
    current_step?: string;
    purpose?: string;
    medical_context: {
      patient_references: string[];
      discussed_symptoms: string[];
      mentioned_procedures: string[];
      doctor_instructions: string[];
      urgency_level: 'low' | 'medium' | 'high' | 'critical';
      medical_specialty: string[];
    };
    voice_preferences: {
      language: string;
      tone: string;
      speed: number;
      voice_model: string;
      emotional_state: string;
    };
    performance_metrics: {
      response_times: number[];
      interaction_quality: number[];
      user_satisfaction: number[];
    };
  };
  interaction_history: {
    timestamp: string;
    type: 'message' | 'action' | 'response' | 'system' | 'question' | 'answer' | 'verification';
    content: string;
    validated: boolean;
    field?: string;
    confidence_score?: number;
    emotional_context?: string;
    processing_time?: number;
  }[];
  metadata: {
    created_at: string;
    last_activity: string;
    total_interactions: number;
    session_duration: number;
    memory_size: number;
    compression_ratio: number;
    last_optimized: string;
    start_time?: string;
  };
  cache: {
    frequent_queries: Record<string, any>;
    user_patterns: Record<string, number>;
    quick_access: Record<string, any>;
  };
  // Propiedades de compatibilidad con el código existente
  patient_info?: Record<string, any>;
  collected_data?: {
    personal_info?: Record<string, any>;
    medical_info?: Record<string, any>;
    appointment_info?: Record<string, any>;
  };
}

interface MemoryCacheEntry {
  data: ConversationMemory;
  lastAccessed: number;
  accessCount: number;
}

// Configuración mejorada
const MEMORY_DIR = join(process.cwd(), 'memory');
if (!existsSync(MEMORY_DIR)) {
  mkdirSync(MEMORY_DIR, { recursive: true });
}

export class ConversationMemoryManager {
  private static memoryCache: Map<string, MemoryCacheEntry> = new Map();
  private static cacheTimeout: Map<string, NodeJS.Timeout> = new Map();
  private static readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutos
  private static readonly MAX_CACHE_SIZE = 100;
  private static readonly MEMORY_OPTIMIZATION_INTERVAL = 60 * 60 * 1000; // 1 hora
  private static readonly MAX_INTERACTION_HISTORY = 1000;
  private static readonly COMPRESSION_THRESHOLD = 500;

  static {
    // Inicializar optimización automática de memoria
    setInterval(() => {
      this.optimizeMemoryStorage();
    }, this.MEMORY_OPTIMIZATION_INTERVAL);

    // Limpiar cache periódicamente
    setInterval(() => {
      this.cleanupCache();
    }, 10 * 60 * 1000); // 10 minutos
  }

  /**
   * Optimizar almacenamiento de memoria
   */
  private static async optimizeMemoryStorage(): Promise<void> {
    try {
      console.log('🧠 Iniciando optimización de memoria...');
      
      // Obtener todas las sesiones activas
      const query = `
        SELECT session_id, conversation_data, last_updated 
        FROM conversation_memory 
        WHERE status = 'active' 
        AND last_updated < DATE_SUB(NOW(), INTERVAL 1 HOUR)
      `;
      
      const [rows] = await pool.execute(query) as any[];
      
      for (const row of rows) {
        const sessionId = row.session_id;
        const memoryData: ConversationMemory = JSON.parse(row.conversation_data);
        
        // Comprimir historial si es necesario
        if (memoryData.interaction_history.length > this.COMPRESSION_THRESHOLD) {
          memoryData.interaction_history = this.compressInteractionHistory(memoryData.interaction_history);
          memoryData.metadata.compression_ratio = this.COMPRESSION_THRESHOLD / memoryData.interaction_history.length;
        }
        
        // Calcular métricas de rendimiento
        memoryData.metadata.memory_size = JSON.stringify(memoryData).length;
        memoryData.metadata.last_optimized = new Date().toISOString();
        
        // Actualizar en base de datos
        const updateQuery = `
          UPDATE conversation_memory 
          SET conversation_data = ?, last_updated = CURRENT_TIMESTAMP
          WHERE session_id = ?
        `;
        
        await pool.execute(updateQuery, [JSON.stringify(memoryData), sessionId]);
        
        // Actualizar cache si existe
        if (this.memoryCache.has(sessionId)) {
          this.memoryCache.set(sessionId, {
            data: memoryData,
            lastAccessed: Date.now(),
            accessCount: this.memoryCache.get(sessionId)!.accessCount
          });
        }
      }
      
      console.log(`✅ Optimización completada para ${rows.length} sesiones`);
    } catch (error) {
      console.error('❌ Error en optimización de memoria:', error);
    }
  }

  /**
   * Comprimir historial de interacciones manteniendo las más importantes
   */
  private static compressInteractionHistory(history: ConversationMemory['interaction_history']): ConversationMemory['interaction_history'] {
    // Mantener siempre las últimas 100 interacciones
    const recent = history.slice(-100);
    
    // Seleccionar interacciones importantes del resto
    const older = history.slice(0, -100);
    const important = older.filter(interaction => 
      interaction.type === 'answer' && interaction.validated ||
      interaction.type === 'system' ||
      interaction.confidence_score && interaction.confidence_score > 0.8
    );
    
    // Tomar una muestra representativa del resto
    const sample = older.filter((_, index) => index % 10 === 0);
    
    return [...important, ...sample, ...recent];
  }

  /**
   * Limpiar cache de memoria
   */
  private static cleanupCache(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];
    
    // Identificar sesiones expiradas
    for (const [sessionId, entry] of this.memoryCache.entries()) {
      if (now - entry.lastAccessed > this.CACHE_DURATION) {
        expiredSessions.push(sessionId);
      }
    }
    
    // Remover sesiones expiradas
    for (const sessionId of expiredSessions) {
      this.memoryCache.delete(sessionId);
      
      // Limpiar timeout si existe
      const timeout = this.cacheTimeout.get(sessionId);
      if (timeout) {
        clearTimeout(timeout);
        this.cacheTimeout.delete(sessionId);
      }
    }
    
    // Si el cache sigue siendo muy grande, remover las menos utilizadas
    if (this.memoryCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.memoryCache.entries())
        .sort((a, b) => a[1].accessCount - b[1].accessCount)
        .slice(0, this.memoryCache.size - this.MAX_CACHE_SIZE);
      
      for (const [sessionId] of entries) {
        this.memoryCache.delete(sessionId);
        const timeout = this.cacheTimeout.get(sessionId);
        if (timeout) {
          clearTimeout(timeout);
          this.cacheTimeout.delete(sessionId);
        }
      }
    }
    
    console.log(`🧹 Cache limpiado: ${expiredSessions.length} sesiones removidas, ${this.memoryCache.size} sesiones activas`);
  }

  /**
   * Obtener memoria de cache o base de datos
   */
  private static async getMemoryFromCacheOrDB(sessionId: string): Promise<ConversationMemory | null> {
    // Verificar cache primero
    const cached = this.memoryCache.get(sessionId);
    if (cached) {
      cached.lastAccessed = Date.now();
      cached.accessCount++;
      return cached.data;
    }
    
    // Buscar en base de datos
    try {
      const query = `SELECT conversation_data FROM conversation_memory WHERE session_id = ? AND status = 'active'`;
      const [rows] = await pool.execute(query, [sessionId]) as any[];
      
      if (rows.length > 0) {
        const memoryData: ConversationMemory = JSON.parse(rows[0].conversation_data);
        
        // Agregar al cache
        this.memoryCache.set(sessionId, {
          data: memoryData,
          lastAccessed: Date.now(),
          accessCount: 1
        });
        
        return memoryData;
      }
    } catch (error) {
      console.error('Error obteniendo memoria de DB:', error);
    }
    
    // Verificar archivo local como respaldo
    const filePath = join(MEMORY_DIR, `${sessionId}.json`);
    if (existsSync(filePath)) {
      try {
        const memoryData: ConversationMemory = JSON.parse(readFileSync(filePath, 'utf8'));
        
        // Agregar al cache
        this.memoryCache.set(sessionId, {
          data: memoryData,
          lastAccessed: Date.now(),
          accessCount: 1
        });
        
        return memoryData;
      } catch (error) {
        console.error('Error leyendo archivo de memoria:', error);
      }
    }
    
    return null;
  }

  /**
   * Inicializar memoria para una nueva sesión
   */
  static async initializeMemory(sessionId: string, purpose: string = 'general'): Promise<string> {
    try {
      // Verificar si ya existe
      const existing = await this.getMemoryFromCacheOrDB(sessionId);
      if (existing) {
        return JSON.stringify({
          success: true,
          message: 'Memoria ya inicializada',
          session_id: sessionId
        });
      }

      const memoryData: ConversationMemory = {
        session_id: sessionId,
        conversation_context: {
          user_preferences: {},
          topics_discussed: [],
          purpose,
          medical_context: {
            patient_references: [],
            discussed_symptoms: [],
            mentioned_procedures: [],
            doctor_instructions: [],
            urgency_level: 'low',
            medical_specialty: []
          },
          voice_preferences: {
            language: 'es',
            tone: 'professional',
            speed: 1.0,
            voice_model: 'elevenlabs',
            emotional_state: 'neutral'
          },
          performance_metrics: {
            response_times: [],
            interaction_quality: [],
            user_satisfaction: []
          }
        },
        collected_data: {
          personal_info: {},
          medical_info: {},
          appointment_info: {}
        },
        patient_info: {},
        interaction_history: [],
        metadata: {
          created_at: new Date().toISOString(),
          last_activity: new Date().toISOString(),
          total_interactions: 0,
          session_duration: 0,
          memory_size: 0,
          compression_ratio: 1.0,
          last_optimized: new Date().toISOString(),
          start_time: new Date().toISOString()
        },
        cache: {
          frequent_queries: {},
          user_patterns: {},
          quick_access: {}
        }
      };

      // Guardar en archivo
      const filePath = join(MEMORY_DIR, `${sessionId}.json`);
      writeFileSync(filePath, JSON.stringify(memoryData, null, 2), 'utf8');

      // Guardar en base de datos
      const query = `
        INSERT INTO conversation_memory (session_id, conversation_data, status, created_at, last_updated)
        VALUES (?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE
        conversation_data = VALUES(conversation_data),
        last_updated = CURRENT_TIMESTAMP
      `;
      
      await pool.execute(query, [sessionId, JSON.stringify(memoryData)]);

      // Agregar al cache
      this.memoryCache.set(sessionId, {
        data: memoryData,
        lastAccessed: Date.now(),
        accessCount: 1
      });

      return JSON.stringify({
        success: true,
        message: 'Memoria inicializada exitosamente',
        session_id: sessionId
      });

    } catch (error) {
      console.error('Error inicializando memoria:', error);
      return JSON.stringify({
        success: false,
        error: 'Error al inicializar memoria'
      });
    }
  }

  /**
   * Agregar información a la memoria con mejoras de rendimiento
   */
  static async addToMemory(
    sessionId: string, 
    type: string, 
    content: string, 
    field?: string, 
    data?: any, 
    validated?: boolean
  ): Promise<string> {
    try {
      const memoryData = await this.getMemoryFromCacheOrDB(sessionId);
      
      if (!memoryData) {
        return JSON.stringify({
          success: false,
          message: 'Sesión de memoria no encontrada'
        });
      }

      const startTime = Date.now();

      // Agregar nueva interacción con métricas mejoradas
      const interaction = {
        timestamp: new Date().toISOString(),
        type: type as 'message' | 'action' | 'response' | 'system' | 'question' | 'answer' | 'verification',
        content,
        field,
        validated: validated ?? false,
        confidence_score: validated ? 1.0 : 0.5,
        processing_time: 0 // Se calculará al final
      };

      memoryData.interaction_history.push(interaction);

      // Actualizar metadata con métricas de rendimiento
      memoryData.metadata.last_activity = new Date().toISOString();
      memoryData.metadata.total_interactions = (memoryData.metadata.total_interactions || 0) + 1;
      
      const processingTime = Date.now() - startTime;
      memoryData.conversation_context.performance_metrics.response_times.push(processingTime);
      interaction.processing_time = processingTime;

      // Agregar datos específicos con inicialización segura
      if (data && field) {
        if (!memoryData.collected_data) {
          memoryData.collected_data = {
            personal_info: {},
            medical_info: {},
            appointment_info: {}
          };
        }

        if (field.includes('personal')) {
          memoryData.collected_data.personal_info = {
            ...memoryData.collected_data.personal_info,
            [field]: data
          };
        } else if (field.includes('medical')) {
          memoryData.collected_data.medical_info = {
            ...memoryData.collected_data.medical_info,
            [field]: data
          };
          
          // Actualizar contexto médico
          if (field.includes('symptom')) {
            memoryData.conversation_context.medical_context.discussed_symptoms.push(data);
          } else if (field.includes('procedure')) {
            memoryData.conversation_context.medical_context.mentioned_procedures.push(data);
          }
        } else if (field.includes('appointment') || field.includes('cita')) {
          memoryData.collected_data.appointment_info = {
            ...memoryData.collected_data.appointment_info,
            [field]: data
          };
        }
      }

      // Actualizar patrones de usuario
      if (!memoryData.cache.user_patterns[type]) {
        memoryData.cache.user_patterns[type] = 0;
      }
      memoryData.cache.user_patterns[type]++;

      // Mantener límite de historial
      if (memoryData.interaction_history.length > this.MAX_INTERACTION_HISTORY) {
        memoryData.interaction_history = this.compressInteractionHistory(memoryData.interaction_history);
      }

      // Actualizar tamaño de memoria
      memoryData.metadata.memory_size = JSON.stringify(memoryData).length;

      // Guardar cambios
      await this.saveMemory(sessionId, memoryData);

      return JSON.stringify({
        success: true,
        message: 'Información agregada a memoria',
        processing_time: processingTime,
        memory_size: memoryData.metadata.memory_size
      });

    } catch (error) {
      console.error('Error agregando a memoria:', error);
      return JSON.stringify({
        success: false,
        error: 'Error al agregar información a memoria'
      });
    }
  }

  /**
   * Guardar memoria en cache, archivo y base de datos
   */
  private static async saveMemory(sessionId: string, memoryData: ConversationMemory): Promise<void> {
    // Actualizar cache
    this.memoryCache.set(sessionId, {
      data: memoryData,
      lastAccessed: Date.now(),
      accessCount: this.memoryCache.get(sessionId)?.accessCount || 1
    });

    // Guardar en archivo
    const filePath = join(MEMORY_DIR, `${sessionId}.json`);
    writeFileSync(filePath, JSON.stringify(memoryData, null, 2), 'utf8');

    // Guardar en base de datos
    const query = `
      UPDATE conversation_memory 
      SET conversation_data = ?, last_updated = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `;
    
    await pool.execute(query, [JSON.stringify(memoryData), sessionId]);
  }

  /**
   * Verificar información en memoria con búsqueda mejorada
   */
  static async checkMemory(sessionId: string, field: string): Promise<string> {
    try {
      const memoryData = await this.getMemoryFromCacheOrDB(sessionId);
      
      if (!memoryData) {
        return JSON.stringify({
          success: false,
          message: 'Sesión de memoria no encontrada'
        });
      }

      let foundData = null;
      let source = '';

      // Búsqueda en cache rápido primero
      if (memoryData.cache.quick_access[field]) {
        foundData = memoryData.cache.quick_access[field];
        source = 'cache';
      }
      // Búsqueda en patient_info
      else if (memoryData.patient_info && memoryData.patient_info[field]) {
        foundData = memoryData.patient_info[field];
        source = 'patient_info';
      }
      // Búsqueda en collected_data
      else if (memoryData.collected_data) {
        const sections = ['personal_info', 'medical_info', 'appointment_info'];
        for (const section of sections) {
          const sectionData = memoryData.collected_data[section as keyof typeof memoryData.collected_data];
          if (sectionData && sectionData[field]) {
            foundData = sectionData[field];
            source = section;
            break;
          }
        }
      }

      // Búsqueda en historial de interacciones
      if (!foundData) {
        const relevantInteraction = memoryData.interaction_history
          .reverse()
          .find(interaction => 
            interaction.field === field && 
            interaction.type === 'answer' && 
            interaction.validated
          );
        
        if (relevantInteraction) {
          foundData = relevantInteraction.content;
          source = 'interaction_history';
        }
      }

      // Si se encontró, agregar al cache rápido
      if (foundData && source !== 'cache') {
        memoryData.cache.quick_access[field] = foundData;
        await this.saveMemory(sessionId, memoryData);
      }

      return JSON.stringify({
        success: true,
        found: !!foundData,
        data: foundData,
        source: source,
        field: field
      });

    } catch (error) {
      console.error('Error verificando memoria:', error);
      return JSON.stringify({
        success: false,
        error: 'Error al verificar memoria'
      });
    }
  }

  /**
   * Obtener resumen completo de memoria con análisis inteligente
   */
  static async getMemory(sessionId: string): Promise<string> {
    try {
      const memoryData = await this.getMemoryFromCacheOrDB(sessionId);
      
      if (!memoryData) {
        return JSON.stringify({
          success: false,
          message: 'Sesión de memoria no encontrada'
        });
      }

      // Calcular duración de sesión
      const startTime = new Date(memoryData.metadata.created_at);
      const currentTime = new Date();
      const sessionDuration = Math.floor((currentTime.getTime() - startTime.getTime()) / 1000 / 60); // minutos

      // Calcular métricas de calidad
      const validatedInteractions = memoryData.interaction_history.filter(i => i.validated).length;
      const totalInteractions = memoryData.interaction_history.length;
      const qualityScore = totalInteractions > 0 ? (validatedInteractions / totalInteractions) * 100 : 0;

      // Calcular tiempo promedio de respuesta
      const responseTimes = memoryData.conversation_context.performance_metrics.response_times;
      const avgResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
        : 0;

      // Obtener temas más discutidos
      const topTopics = memoryData.conversation_context.topics_discussed.slice(0, 5);

      return JSON.stringify({
        success: true,
        session_id: sessionId,
        session_duration_minutes: sessionDuration,
        total_interactions: totalInteractions,
        quality_score: Math.round(qualityScore),
        avg_response_time_ms: Math.round(avgResponseTime),
        memory_size_kb: Math.round(memoryData.metadata.memory_size / 1024),
        compression_ratio: memoryData.metadata.compression_ratio,
        conversation_context: {
          purpose: memoryData.conversation_context.purpose,
          current_step: memoryData.conversation_context.current_step,
          topics_discussed: topTopics,
          medical_urgency: memoryData.conversation_context.medical_context.urgency_level,
          voice_preferences: memoryData.conversation_context.voice_preferences
        },
        collected_data: memoryData.collected_data,
        patient_info: memoryData.patient_info,
        recent_interactions: memoryData.interaction_history.slice(-5),
        cache_stats: {
          frequent_queries_count: Object.keys(memoryData.cache.frequent_queries).length,
          user_patterns: memoryData.cache.user_patterns,
          quick_access_items: Object.keys(memoryData.cache.quick_access).length
        },
        metadata: memoryData.metadata
      });

    } catch (error) {
      console.error('Error obteniendo memoria:', error);
      return JSON.stringify({
        success: false,
        error: 'Error al obtener memoria'
      });
    }
  }

  /**
   * Actualizar contexto de conversación con validación mejorada
   */
  static async updateContext(sessionId: string, updates: Partial<ConversationMemory['conversation_context']>): Promise<string> {
    try {
      const memoryData = await this.getMemoryFromCacheOrDB(sessionId);
      
      if (!memoryData) {
        return JSON.stringify({
          success: false,
          message: 'Sesión de memoria no encontrada'
        });
      }

      // Validar y fusionar actualizaciones
      const validatedUpdates: Partial<ConversationMemory['conversation_context']> = {};
      
      if (updates.purpose) validatedUpdates.purpose = updates.purpose;
      if (updates.current_step) validatedUpdates.current_step = updates.current_step;
      if (updates.topics_discussed) validatedUpdates.topics_discussed = [...new Set(updates.topics_discussed)];
      if (updates.medical_context) {
        validatedUpdates.medical_context = {
          ...memoryData.conversation_context.medical_context,
          ...updates.medical_context
        };
      }
      if (updates.voice_preferences) {
        validatedUpdates.voice_preferences = {
          ...memoryData.conversation_context.voice_preferences,
          ...updates.voice_preferences
        };
      }

      // Actualizar contexto
      memoryData.conversation_context = {
        ...memoryData.conversation_context,
        ...validatedUpdates
      };

      memoryData.metadata.last_activity = new Date().toISOString();

      // Guardar cambios
      await this.saveMemory(sessionId, memoryData);

      return JSON.stringify({
        success: true,
        message: 'Contexto actualizado exitosamente',
        updated_fields: Object.keys(validatedUpdates),
        new_context: memoryData.conversation_context
      });

    } catch (error) {
      console.error('Error actualizando contexto:', error);
      return JSON.stringify({
        success: false,
        error: 'Error al actualizar contexto'
      });
    }
  }

  /**
   * Cerrar sesión de memoria con análisis final
   */
  static async closeMemory(sessionId: string, reason: string = 'completed'): Promise<string> {
    try {
      const memoryData = await this.getMemoryFromCacheOrDB(sessionId);
      
      if (memoryData) {
        // Calcular estadísticas finales
        const sessionEndTime = new Date();
        const sessionStartTime = new Date(memoryData.metadata.created_at);
        const totalDuration = Math.floor((sessionEndTime.getTime() - sessionStartTime.getTime()) / 1000 / 60);
        
        // Agregar interacción de cierre con estadísticas
        const closingInteraction = {
          timestamp: new Date().toISOString(),
          type: 'system' as const,
          content: `Conversación finalizada: ${reason}. Duración: ${totalDuration}min, Interacciones: ${memoryData.metadata.total_interactions}`,
          validated: true,
          confidence_score: 1.0
        };
        
        memoryData.interaction_history.push(closingInteraction);
        memoryData.metadata.last_activity = new Date().toISOString();
        memoryData.metadata.session_duration = totalDuration;

        // Actualizar en base de datos con estado completado
        const query = `
          UPDATE conversation_memory 
          SET conversation_data = ?, status = 'completed', last_updated = CURRENT_TIMESTAMP
          WHERE session_id = ?
        `;
        
        await pool.execute(query, [JSON.stringify(memoryData), sessionId]);

        // Mantener archivo temporal para posible análisis posterior
        const filePath = join(MEMORY_DIR, `${sessionId}.json`);
        writeFileSync(filePath, JSON.stringify(memoryData, null, 2), 'utf8');

        // Remover del cache activo
        this.memoryCache.delete(sessionId);
        const timeout = this.cacheTimeout.get(sessionId);
        if (timeout) {
          clearTimeout(timeout);
          this.cacheTimeout.delete(sessionId);
        }
      }

      return JSON.stringify({
        success: true,
        message: 'Sesión de memoria cerrada exitosamente',
        final_stats: memoryData ? {
          duration_minutes: memoryData.metadata.session_duration,
          total_interactions: memoryData.metadata.total_interactions,
          memory_size_kb: Math.round(memoryData.metadata.memory_size / 1024)
        } : null
      });

    } catch (error) {
      console.error('Error cerrando memoria:', error);
      return JSON.stringify({
        success: false,
        error: 'Error al cerrar memoria'
      });
    }
  }

  /**
   * Buscar en memoria con capacidades avanzadas
   */
  static async searchMemory(sessionId: string, query: string, type?: string): Promise<string> {
    try {
      const memoryData = await this.getMemoryFromCacheOrDB(sessionId);
      
      if (!memoryData) {
        return JSON.stringify({
          success: false,
          message: 'Sesión de memoria no encontrada'
        });
      }

      const searchResults: any[] = [];
      const queryLower = query.toLowerCase();

      // Buscar en historial de interacciones
      const relevantInteractions = memoryData.interaction_history.filter(interaction => {
        const matchesContent = interaction.content.toLowerCase().includes(queryLower);
        const matchesType = !type || interaction.type === type;
        return matchesContent && matchesType;
      });

      searchResults.push(...relevantInteractions.map(interaction => ({
        source: 'interaction_history',
        type: interaction.type,
        content: interaction.content,
        timestamp: interaction.timestamp,
        validated: interaction.validated,
        relevance_score: this.calculateRelevanceScore(interaction.content, query)
      })));

      // Buscar en datos recopilados
      if (memoryData.collected_data) {
        for (const [section, data] of Object.entries(memoryData.collected_data)) {
          if (data) {
            for (const [field, value] of Object.entries(data)) {
              if (typeof value === 'string' && value.toLowerCase().includes(queryLower)) {
                searchResults.push({
                  source: `collected_data.${section}`,
                  field: field,
                  content: value,
                  relevance_score: this.calculateRelevanceScore(value, query)
                });
              }
            }
          }
        }
      }

      // Ordenar por relevancia
      searchResults.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));

      // Actualizar estadísticas de consulta
      if (!memoryData.cache.frequent_queries[query]) {
        memoryData.cache.frequent_queries[query] = 0;
      }
      memoryData.cache.frequent_queries[query]++;

      // Guardar estadísticas actualizadas
      await this.saveMemory(sessionId, memoryData);

      return JSON.stringify({
        success: true,
        query: query,
        results_count: searchResults.length,
        results: searchResults.slice(0, 20), // Limitar a 20 resultados
        search_timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error buscando en memoria:', error);
      return JSON.stringify({
        success: false,
        error: 'Error al buscar en memoria'
      });
    }
  }

  /**
   * Calcular puntuación de relevancia para búsquedas
   */
  private static calculateRelevanceScore(content: string, query: string): number {
    const contentLower = content.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Coincidencia exacta
    if (contentLower.includes(queryLower)) {
      return 1.0;
    }
    
    // Coincidencia de palabras
    const queryWords = queryLower.split(' ');
    const contentWords = contentLower.split(' ');
    const matchingWords = queryWords.filter(word => 
      contentWords.some(contentWord => contentWord.includes(word))
    );
    
    return matchingWords.length / queryWords.length;
  }

  /**
   * Obtener estadísticas de rendimiento del sistema de memoria
   */
  static async getMemoryStats(): Promise<string> {
    try {
      // Estadísticas de cache
      const cacheStats = {
        active_sessions: this.memoryCache.size,
        cache_hit_ratio: 0, // Se calcularía con métricas adicionales
        memory_usage_mb: process.memoryUsage().heapUsed / 1024 / 1024
      };

      // Estadísticas de base de datos
      const dbQuery = `
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_sessions,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions,
          AVG(CHAR_LENGTH(conversation_data)) as avg_memory_size
        FROM conversation_memory
      `;
      
      const [dbStats] = await pool.execute(dbQuery) as any[];
      
      return JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        cache_stats: cacheStats,
        database_stats: dbStats[0],
        system_stats: {
          optimization_interval_minutes: this.MEMORY_OPTIMIZATION_INTERVAL / 60000,
          max_cache_size: this.MAX_CACHE_SIZE,
          max_interaction_history: this.MAX_INTERACTION_HISTORY,
          compression_threshold: this.COMPRESSION_THRESHOLD
        }
      });

    } catch (error) {
      console.error('Error obteniendo estadísticas de memoria:', error);
      return JSON.stringify({
        success: false,
        error: 'Error al obtener estadísticas de memoria'
      });
    }
  }
}