import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import axios from 'axios';
import { ElevenLabsSync } from '../services/elevenLabsSync';

const router = Router();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID || 'agent_4701k42pdkwcfqcachm8mn7wf9cf';

/**
 * Obtener conversaciones híbridas:
 * - Las 5 últimas desde la API de ElevenLabs (tiempo real)
 * - El resto desde la base de datos local (alta velocidad)
 */
router.get('/elevenlabs', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ 
        success: false, 
        message: 'API key de ElevenLabs no configurada' 
      });
    }

    // Parámetros de consulta
    const { 
      page = '1',
      page_size = '20',
      search,
      date_filter
    } = req.query;

    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(page_size as string);

    // PASO 1: Obtener TODAS las llamadas necesarias de la API (tiempo real con números de teléfono)
    let latestCalls: any[] = [];
    
    try {
      // ElevenLabs API tiene límite de 100 por página
      const apiPageSize = Math.min(100, Math.max(pageSizeNum, 20));
      console.log(`[Consultations] Fetching ${apiPageSize} calls from ElevenLabs API for page ${pageNum}...`);
      const apiResponse = await axios.get(
        'https://api.elevenlabs.io/v1/convai/conversations',
        {
          headers: { 'xi-api-key': ELEVENLABS_API_KEY },
          params: {
            agent_id: ELEVENLABS_AGENT_ID,
            page_size: apiPageSize
          }
        }
      );

      const basicCalls = apiResponse.data.conversations || [];
      
      // Para la primera página, obtener datos completos (con phone_call metadata) individualmente
      if (pageNum === 1 && basicCalls.length > 0) {
        console.log(`[Consultations] Fetching detailed data for ${basicCalls.length} conversations...`);
        const detailedCallsPromises = basicCalls.map(async (call: any) => {
          try {
            const detailResponse = await axios.get(
              `https://api.elevenlabs.io/v1/convai/conversations/${call.conversation_id}`,
              { headers: { 'xi-api-key': ELEVENLABS_API_KEY } }
            );
            return detailResponse.data;
          } catch (err) {
            console.error(`[Consultations] Error fetching details for ${call.conversation_id}:`, err);
            return call; // Fallback al objeto básico
          }
        });
        
        latestCalls = await Promise.all(detailedCallsPromises);
      } else {
        latestCalls = basicCalls;
      }
      
      // Sincronizar las llamadas en background
      if (latestCalls.length > 0) {
        Promise.all(latestCalls.map((call: any) => ElevenLabsSync.upsertCall(call)))
          .catch(err => console.error('[Consultations] Error syncing latest calls:', err));
      }
    } catch (apiError: any) {
      // Si el agent no existe o hay error de API, solo usar datos de BD
      console.error('[Consultations] Error fetching from ElevenLabs API:', apiError.response?.data || apiError.message);
      console.log('[Consultations] Falling back to database only...');
    }

    // PASO 2: Obtener el resto desde la base de datos local (solo como fallback)
    console.log('[Consultations] Fetching from database...');
    const { calls: dbCalls, total: dbTotal } = await ElevenLabsSync.getCallsFromDB(
      pageNum,
      pageSizeNum,
      search as string,
      date_filter as string
    );

    // PASO 3: Combinar resultados (evitar duplicados)
    const latestCallIds = new Set(latestCalls.map((c: any) => c.conversation_id));
    const uniqueDbCalls = dbCalls.filter(call => !latestCallIds.has(call.conversation_id));

    // Formatear las llamadas de la API al mismo formato que la DB
    const formattedLatestCalls = latestCalls.map((conv: any) => {
      // Extraer números de teléfono de múltiples ubicaciones posibles
      const dynamicVars = conv.conversation_initiation_client_data?.dynamic_variables;
      const phoneCall = conv.metadata?.phone_call;
      
      const callerNumber = dynamicVars?.system__caller_id || 
                          phoneCall?.external_number ||
                          conv.metadata?.caller_number || 
                          conv.metadata?.from_number || 
                          null;
      const calleeNumber = dynamicVars?.system__called_number ||
                          phoneCall?.agent_number ||
                          conv.metadata?.callee_number || 
                          conv.metadata?.to_number ||
                          process.env.ELEVENLABS_PHONE_NUMBER || 
                          null;
      
      return {
        conversation_id: conv.conversation_id,
        agent_id: conv.agent_id,
        status: conv.status,
        start_time: conv.start_time_unix_secs ? new Date(conv.start_time_unix_secs * 1000).toISOString() : null,
        started_at: conv.start_time_unix_secs ? new Date(conv.start_time_unix_secs * 1000).toISOString() : null,
        ended_at: conv.end_time_unix_secs ? new Date(conv.end_time_unix_secs * 1000).toISOString() : null,
        duration_seconds: conv.end_time_unix_secs && conv.start_time_unix_secs 
          ? conv.end_time_unix_secs - conv.start_time_unix_secs 
          : null,
        transcript: conv.transcript || [],
        metadata: conv.metadata || conv, // Incluir todo el objeto para acceso a campos anidados
        analysis: conv.analysis || null,
        call_id: conv.call_id || null,
        caller_number: callerNumber,
        callee_number: calleeNumber,
        summary: conv.metadata?.summary || null,
        end_reason: conv.metadata?.end_reason || conv.metadata?.termination_reason || null,
        call_direction: conv.metadata?.call_direction || 'inbound',
        call_type: conv.metadata?.call_type || null
      };
    });

    // Combinar: API calls primero, luego DB calls
    const allCalls = [...formattedLatestCalls, ...uniqueDbCalls];

    // Estadísticas
    const stats = {
      total_conversations: dbTotal + latestCalls.length,
      from_api: latestCalls.length,
      from_database: uniqueDbCalls.length,
      total_duration_minutes: Math.round(
        allCalls.reduce((sum: number, conv: any) => 
          sum + (conv.duration_seconds || 0), 0
        ) / 60
      ),
      by_status: {
        completed: allCalls.filter((c: any) => c.status === 'done').length,
        in_progress: allCalls.filter((c: any) => c.status === 'in_progress').length,
        failed: allCalls.filter((c: any) => c.status === 'failed').length
      }
    };

    return res.json({
      success: true,
      agent_id: ELEVENLABS_AGENT_ID,
      data: allCalls,
      stats,
      pagination: {
        page: pageNum,
        page_size: pageSizeNum,
        total: dbTotal + latestCalls.length,
        total_pages: Math.ceil((dbTotal + latestCalls.length) / pageSizeNum)
      }
    });

  } catch (error: any) {
    console.error('Error consultando ElevenLabs:', error.response?.data || error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al consultar conversaciones de ElevenLabs',
      error: error.response?.data?.detail || error.message 
    });
  }
});

// Obtener detalles de una conversación específica
router.get('/elevenlabs/:conversation_id', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ 
        success: false, 
        message: 'API key de ElevenLabs no configurada' 
      });
    }

    const { conversation_id } = req.params;

    // Llamar a la API de ElevenLabs para obtener detalles
    const response = await axios.get(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversation_id}`,
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY
        }
      }
    );

    const conv = response.data;

    // Formatear respuesta
    const conversationDetails = {
      conversation_id: conv.conversation_id,
      agent_id: conv.agent_id,
      status: conv.status,
      started_at: conv.start_time_unix_secs ? new Date(conv.start_time_unix_secs * 1000).toISOString() : null,
      ended_at: conv.end_time_unix_secs ? new Date(conv.end_time_unix_secs * 1000).toISOString() : null,
      duration_seconds: conv.end_time_unix_secs && conv.start_time_unix_secs 
        ? conv.end_time_unix_secs - conv.start_time_unix_secs 
        : null,
      transcript: conv.transcript || [],
      metadata: conv.metadata || {},
      analysis: conv.analysis || null,
      call_id: conv.call_id || null,
      audio_url: conv.audio_url || null,
      recording_url: conv.recording_url || null
    };

    return res.json({
      success: true,
      data: conversationDetails
    });

  } catch (error: any) {
    console.error('Error obteniendo conversación:', error.response?.data || error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al obtener conversación',
      error: error.response?.data?.detail || error.message 
    });
  }
});

// Obtener conversaciones del día actual
router.get('/elevenlabs/today', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ 
        success: false, 
        message: 'API key de ElevenLabs no configurada' 
      });
    }

    // Fecha de hoy en formato ISO
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = today.toISOString();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endDate = tomorrow.toISOString();

    // Llamar al endpoint principal con filtro de fecha
    const response = await axios.get(
      'https://api.elevenlabs.io/v1/convai/conversations',
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY
        },
        params: {
          agent_id: ELEVENLABS_AGENT_ID,
          start_date: startDate,
          end_date: endDate,
          page_size: 100
        }
      }
    );

    const conversations = response.data.conversations || [];
    
    // Procesar conversaciones del día
    const processedConversations = conversations.map((conv: any) => ({
      conversation_id: conv.conversation_id,
      status: conv.status,
      started_at: conv.start_time_unix_secs ? new Date(conv.start_time_unix_secs * 1000).toISOString() : null,
      ended_at: conv.end_time_unix_secs ? new Date(conv.end_time_unix_secs * 1000).toISOString() : null,
      duration_seconds: conv.end_time_unix_secs && conv.start_time_unix_secs 
        ? conv.end_time_unix_secs - conv.start_time_unix_secs 
        : null,
      caller_number: conv.metadata?.caller_number || null,
      summary: conv.metadata?.summary || null,
      transcript_preview: conv.transcript?.slice(0, 3) || []
    }));

    const stats = {
      total_calls_today: processedConversations.length,
      total_duration_minutes: Math.round(
        processedConversations.reduce((sum: number, conv: any) => 
          sum + (conv.duration_seconds || 0), 0
        ) / 60
      ),
      by_status: {
        completed: processedConversations.filter((c: any) => c.status === 'done').length,
        in_progress: processedConversations.filter((c: any) => c.status === 'in_progress').length,
        failed: processedConversations.filter((c: any) => c.status === 'failed').length
      }
    };

    return res.json({
      success: true,
      date: today.toISOString().split('T')[0],
      agent_id: ELEVENLABS_AGENT_ID,
      data: processedConversations,
      stats
    });

  } catch (error: any) {
    console.error('Error consultando llamadas del día:', error.response?.data || error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al consultar llamadas del día',
      error: error.response?.data?.detail || error.message 
    });
  }
});

/**
 * Endpoint para sincronizar manualmente las llamadas de ElevenLabs
 * Útil para sincronización inicial o cuando se necesite actualizar
 */
router.post('/elevenlabs/sync', requireAuth, async (req: Request, res: Response) => {
  try {
    const { limit = 100 } = req.body;
    
    console.log(`[Sync Endpoint] Starting manual sync of ${limit} calls...`);
    const result = await ElevenLabsSync.syncLatestCalls(limit);
    
    return res.json({
      success: true,
      message: 'Sincronización completada',
      ...result
    });
    
  } catch (error: any) {
    console.error('[Sync Endpoint] Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error en la sincronización',
      error: error.message
    });
  }
});

/**
 * Obtener estadísticas de sincronización
 */
router.get('/elevenlabs/sync/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const pool = require('../db').default;
    const connection = await pool.getConnection();
    
    try {
      // Últimas sincronizaciones
      const [syncLogs] = await connection.execute(
        `SELECT * FROM elevenlabs_sync_log 
         ORDER BY sync_started_at DESC 
         LIMIT 10`
      );
      
      // Total de llamadas en BD
      const [totalCalls] = await connection.execute(
        `SELECT COUNT(*) as total FROM elevenlabs_calls`
      );
      
      // Llamadas por estado
      const [callsByStatus] = await connection.execute(
        `SELECT status, COUNT(*) as count 
         FROM elevenlabs_calls 
         GROUP BY status`
      );
      
      return res.json({
        success: true,
        stats: {
          total_calls: totalCalls[0].total,
          by_status: callsByStatus,
          recent_syncs: syncLogs
        }
      });
      
    } finally {
      connection.release();
    }
    
  } catch (error: any) {
    console.error('[Sync Stats] Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas de sincronización',
      error: error.message
    });
  }
});

export default router;
