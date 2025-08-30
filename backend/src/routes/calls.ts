import { Router, Request, Response } from 'express';
import { NotificationService } from '../services/notificationService';
import { CallManagerService } from '../services/callManagerService';
import { requireAuth } from '../middleware/auth';
import pool from '../db/pool';
import { RowDataPacket } from 'mysql2';
import { z } from 'zod';

const router = Router();

/**
 * Obtener estado de llamadas - Compatible con tabla calls
 */
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    // Obtener llamadas activas desde la tabla calls
    const [activeCallsResult] = await pool.execute<RowDataPacket[]>(
      `SELECT 
         conversation_id,
         patient_name,
         agent_name,
         call_type,
         status,
         priority,
         start_time,
         duration,
         webhook_data as call_data
       FROM calls
       WHERE status = 'active'
       AND start_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       ORDER BY start_time DESC
       LIMIT 20`
    );

    // Obtener llamadas completadas desde la tabla calls
    const [completedCallsResult] = await pool.execute<RowDataPacket[]>(
      `SELECT 
         conversation_id,
         patient_name,
         agent_name,
         call_type,
         status,
         priority,
         start_time,
         end_time,
         duration,
         transcript,
         webhook_data as call_data
       FROM calls
       WHERE status = 'ended'
       AND start_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
       ORDER BY end_time DESC
       LIMIT 20`
    );

    const activeCalls = activeCallsResult.map(call => ({
      id: call.conversation_id,
      patient_name: call.patient_name,
      agent_name: call.agent_name,
      call_type: call.call_type,
      status: call.status,
      priority: call.priority,
      started_at: call.start_time,
      duration: call.duration,
      data: call.call_data
    }));

    const completedCalls = completedCallsResult.map(call => ({
      id: call.conversation_id,
      patient_name: call.patient_name,
      agent_name: call.agent_name,
      call_type: call.call_type,
      status: call.status,
      priority: call.priority,
      started_at: call.start_time,
      ended_at: call.end_time,
      duration: call.duration,
      transcript: call.transcript,
      data: call.call_data
    }));

    // Métricas reales a partir de eventos en últimas 24h
    const [eventCounts] = await pool.execute<RowDataPacket[]>(
      `SELECT event_type, COUNT(*) as c FROM call_events WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) GROUP BY event_type`
    );
    const countMap: Record<string, number> = {};
    eventCounts.forEach(r => { countMap[r.event_type] = r.c; });
    const stats = {
      active_calls: activeCalls.length,
      completed_calls: completedCalls.length,
      call_started: countMap['started'] || 0,
      call_ended: countMap['ended'] || 0,
      total: activeCalls.length + completedCalls.length
    };

    res.json({
      success: true,
      data: {
        stats,
        last_updated: new Date().toISOString(),
        active_calls: activeCalls,
        completed_calls: completedCalls
      }
    });

  } catch (error) {
    console.error('Error getting call status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get call status'
    });
  }
});

/**
 * Obtener historial de una llamada específica
 */
router.get('/:conversationId/history', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;

    const [historyResult] = await pool.execute<RowDataPacket[]>(
      `SELECT 
         type,
         title,
         message,
         data,
         created_at,
         status
       FROM notifications
       WHERE (type = 'call_started' OR type = 'call_ended')
       AND data->>'$.conversation_id' = ?
       ORDER BY created_at ASC`,
      [conversationId]
    );

    if (historyResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Call not found'
      });
    }

    const events = historyResult.map(event => ({
      type: event.type,
      title: event.title,
      message: event.message,
      data: event.data,
      timestamp: event.created_at,
      status: event.status
    }));

    const startEvent = events.find(e => e.type === 'call_started');
    const endEvent = events.find(e => e.type === 'call_ended');

    const callInfo = {
      conversation_id: conversationId,
      status: endEvent ? 'completed' : 'active',
      started_at: startEvent?.timestamp,
      ended_at: endEvent?.timestamp,
      duration: endEvent && startEvent ? 
        Math.floor((new Date(endEvent.timestamp).getTime() - new Date(startEvent.timestamp).getTime()) / 1000) : 
        (startEvent ? Math.floor((Date.now() - new Date(startEvent.timestamp).getTime()) / 1000) : 0),
      events
    };

    res.json({
      success: true,
      data: callInfo
    });

  } catch (error) {
    console.error('Error getting call history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get call history'
    });
  }
});

/**
 * Obtener historial completo de llamadas con filtros
 */
router.get('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const { status, priority, search } = req.query;
    const limit = Math.min(parseInt((req.query.limit as string) || '50'), 200);
    const offset = Math.max(parseInt((req.query.offset as string) || '0'), 0);

    // Construir cláusulas para total y items (sin duplicar demasiado código)
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    if (status && status !== 'all') { whereClause += ' AND status = ?'; params.push(status); }
    if (priority && priority !== 'all') { whereClause += ' AND priority = ?'; params.push(priority); }
    if (search && (search as string).trim() !== '') {
      whereClause += ' AND (patient_name LIKE ? OR patient_phone LIKE ? OR agent_name LIKE ?)';
      const s = `%${(search as string).trim()}%`; params.push(s, s, s);
    }

    const [countRows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as total FROM calls ${whereClause}`, params);
    const total = countRows[0]?.total || 0;

    const items = await CallManagerService.getCallHistory({
      status: status as string,
      priority: priority as string,
      search: search as string,
      limit,
      offset
    });

    res.json({
      success: true,
      data: { items, total, limit, offset }
    });
  } catch (error) {
    console.error('Error getting call history:', error);
    res.status(500).json({ success: false, error: 'Failed to get call history' });
  }
});

// ==============================================
// NUEVOS ENDPOINTS PARA GESTIÓN DE LLAMADAS
// ==============================================

/**
 * Obtener llamadas activas usando CallManagerService
 */
router.get('/active', requireAuth, async (req: Request, res: Response) => {
  try {
    const activeCalls = await CallManagerService.getActiveCalls();
    res.json({
      success: true,
      data: activeCalls,
      count: activeCalls.length
    });
  } catch (error) {
    console.error('Error getting active calls:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener llamadas activas'
    });
  }
});

/**
 * Obtener llamadas en espera
 */
router.get('/waiting', requireAuth, async (req: Request, res: Response) => {
  try {
    const waitingCalls = await CallManagerService.getWaitingCalls();
    res.json({
      success: true,
      data: waitingCalls,
      count: waitingCalls.length
    });
  } catch (error) {
    console.error('Error getting waiting calls:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener llamadas en espera'
    });
  }
});

/**
 * Obtener estadísticas mejoradas de llamadas
 */
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const stats = await CallManagerService.getCallStats(hours);
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting call stats:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas de llamadas'
    });
  }
});

/**
 * Obtener todas las llamadas (activas + en espera) para el dashboard
 */
router.get('/dashboard', requireAuth, async (req: Request, res: Response) => {
  try {
    const [activeCalls, waitingCalls, stats] = await Promise.all([
      CallManagerService.getActiveCalls(),
      CallManagerService.getWaitingCalls(),
      CallManagerService.getCallStats()
    ]);

    res.json({
      success: true,
      data: {
        active: activeCalls,
        waiting: waitingCalls,
        stats: stats
      }
    });
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener información del dashboard'
    });
  }
});

/**
 * Transferir llamada
 */
const idParamSchema = z.object({ id: z.string().regex(/^\d+$/) });
const transferSchema = z.object({ agent_name: z.string().min(2) });

router.post('/:id/transfer', requireAuth, async (req: Request, res: Response) => {
  try {
    const idParsed = idParamSchema.safeParse(req.params);
    if (!idParsed.success) return res.status(400).json({ success: false, error: 'ID inválido' });
    const bodyParsed = transferSchema.safeParse(req.body);
    if (!bodyParsed.success) return res.status(400).json({ success: false, error: 'Nombre del agente requerido' });
    const callId = parseInt(idParsed.data.id, 10);
    const { agent_name } = bodyParsed.data;
    const success = await CallManagerService.transferCall(callId, agent_name);
    if (success) return res.json({ success: true, message: 'Llamada transferida exitosamente' });
    return res.status(404).json({ success: false, error: 'No se pudo transferir la llamada' });
  } catch (error) {
    console.error('Error transferring call:', error);
    return res.status(500).json({ success: false, error: 'Error al transferir llamada' });
  }
});

/**
 * Atender llamada desde cola de espera
 */
router.post('/:id/attend', requireAuth, async (req: Request, res: Response) => {
  try {
    const idParsed = idParamSchema.safeParse(req.params);
    if (!idParsed.success) return res.status(400).json({ success: false, error: 'ID inválido' });
    const bodyParsed = transferSchema.safeParse(req.body);
    if (!bodyParsed.success) return res.status(400).json({ success: false, error: 'Nombre del agente requerido' });
    const callId = parseInt(idParsed.data.id, 10);
    const { agent_name } = bodyParsed.data;
    const success = await CallManagerService.attendCall(callId, agent_name);
    if (success) return res.json({ success: true, message: 'Llamada atendida exitosamente' });
    return res.status(404).json({ success: false, error: 'No se pudo atender la llamada' });
  } catch (error) {
    console.error('Error attending call:', error);
    return res.status(500).json({ success: false, error: 'Error al atender llamada' });
  }
});

/**
 * Poner llamada en espera
 */
router.post('/:id/hold', requireAuth, async (req: Request, res: Response) => {
  try {
    const idParsed = idParamSchema.safeParse(req.params);
    if (!idParsed.success) return res.status(400).json({ success: false, error: 'ID inválido' });
    const callId = parseInt(idParsed.data.id, 10);
    const success = await CallManagerService.holdCall(callId);
    if (success) return res.json({ success: true, message: 'Llamada puesta en espera exitosamente' });
    return res.status(404).json({ success: false, error: 'No se pudo poner la llamada en espera' });
  } catch (error) {
    console.error('Error holding call:', error);
    return res.status(500).json({ success: false, error: 'Error al poner llamada en espera' });
  }
});

/**
 * Estadísticas de almacenamiento (tendencia de crecimiento)
 */
router.get('/storage-stats', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [[liveCount]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) as c FROM calls`);
    const [[archCount]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) as c FROM calls_archive`);
    // Velocidad de crecimiento últimos 7 días (eventos started)
    const [daily] = await pool.query<RowDataPacket[]>(
      `SELECT DATE(created_at) d, COUNT(*) c FROM call_events WHERE event_type='started' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) GROUP BY d ORDER BY d`
    );
    res.json({
      success: true,
      data: {
        live: liveCount.c,
        archived: archCount.c,
        total: liveCount.c + archCount.c,
        last7days: daily
      }
    });
  } catch (e) {
    console.error('Error getting storage stats', e);
    res.status(500).json({ success: false, error: 'Error al obtener storage stats' });
  }
});

export default router;
