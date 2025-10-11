import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import axios from 'axios';

const router = Router();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = 'agent_6401k614mt5sfmkrmgs4s8r5ygh0';

// Obtener conversaciones del agente de ElevenLabs
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
      start_date, 
      end_date, 
      page_size = 100,
      cursor 
    } = req.query;

    // Construir URL con parámetros
    const params: any = {
      agent_id: ELEVENLABS_AGENT_ID,
      page_size: page_size
    };

    if (start_date) params.start_date = start_date;
    if (end_date) params.end_date = end_date;
    if (cursor) params.cursor = cursor;

    // Llamar a la API de ElevenLabs
    const response = await axios.get(
      'https://api.elevenlabs.io/v1/convai/conversations',
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY
        },
        params
      }
    );

    // Procesar las conversaciones
    const conversations = response.data.conversations || [];
    
    // Mapear a formato más amigable
    const processedConversations = conversations.map((conv: any) => ({
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
      caller_number: conv.metadata?.caller_number || null,
      summary: conv.metadata?.summary || null
    }));

    // Estadísticas
    const stats = {
      total_conversations: processedConversations.length,
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
      agent_id: ELEVENLABS_AGENT_ID,
      data: processedConversations,
      stats,
      pagination: {
        has_more: response.data.has_more || false,
        next_cursor: response.data.next_cursor || null
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

export default router;
