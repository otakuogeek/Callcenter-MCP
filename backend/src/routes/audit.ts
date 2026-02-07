/**
 * 🔒 RUTAS DE AUDITORÍA - BIOSANAR IPS
 * 
 * Endpoints para consultar logs de auditoría (INMUTABLE).
 * Los logs solo pueden ser creados y leídos, nunca modificados o eliminados.
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import pool from '../db/pool';
import { 
  queryAuditLogs, 
  getAuditStats, 
  getEntityHistory, 
  getUserActivity,
  getActiveUsers,
  getEntityTypes,
  AuditActionType,
  logAudit
} from '../services/auditService';

const router = Router();

// ============================================
// ENDPOINTS PÚBLICOS (solo requieren autenticación)
// ============================================

/**
 * POST /api/audit/heartbeat
 * Actualiza la última actividad del usuario (llamar cada minuto desde frontend)
 */
router.post('/heartbeat', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!userId || !token) {
      return res.status(401).json({ success: false, error: 'No autorizado' });
    }
    
    // Crear hash simple del token para identificar la sesión
    const sessionToken = Buffer.from(token.substring(0, 50)).toString('base64');
    
    // Upsert de la sesión
    await pool.execute(`
      INSERT INTO user_sessions (user_id, session_token, ip_address, user_agent, last_activity)
      VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE 
        last_activity = NOW(),
        ip_address = VALUES(ip_address),
        user_agent = VALUES(user_agent)
    `, [userId, sessionToken, req.ip, req.headers['user-agent']]);
    
    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error en heartbeat:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar actividad' });
  }
});

/**
 * POST /api/audit/logout
 * Cierra la sesión actual del usuario que hace la petición
 */
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!userId || !token) {
      return res.status(401).json({ success: false, error: 'No autorizado' });
    }
    
    const sessionToken = Buffer.from(token.substring(0, 50)).toString('base64');
    
    // Marcar sesión como inactiva
    await pool.execute(`
      UPDATE user_sessions 
      SET is_active = FALSE 
      WHERE session_token = ? AND user_id = ?
    `, [sessionToken, userId]);
    
    // Registrar en auditoría
    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      actionType: 'LOGOUT',
      entityType: 'session',
      description: 'Cerró sesión manualmente',
      ipAddress: req.ip
    });
    
    res.json({ success: true, message: 'Sesión cerrada correctamente' });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({ success: false, error: 'Error al cerrar sesión' });
  }
});

/**
 * GET /api/audit/session-check
 * Verifica si la sesión actual es válida (para auto-logout)
 */
router.get('/session-check', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!userId || !token) {
      return res.json({ valid: false, reason: 'no_auth' });
    }
    
    const sessionToken = Buffer.from(token.substring(0, 50)).toString('base64');
    
    const [rows] = await pool.execute(`
      SELECT is_active, last_activity,
        TIMESTAMPDIFF(MINUTE, last_activity, NOW()) as minutes_inactive
      FROM user_sessions 
      WHERE session_token = ? AND user_id = ?
    `, [sessionToken, userId]);
    
    const session = (rows as any[])[0];
    
    if (!session) {
      // Si no hay sesión registrada, la creamos
      return res.json({ valid: true, new_session: true });
    }
    
    if (!session.is_active) {
      return res.json({ valid: false, reason: 'session_closed' });
    }
    
    res.json({ 
      valid: true, 
      minutes_inactive: session.minutes_inactive,
      last_activity: session.last_activity
    });
  } catch (error) {
    console.error('Error verificando sesión:', error);
    res.json({ valid: true }); // En caso de error, no cerramos la sesión
  }
});

// ============================================
// ENDPOINTS RESTRINGIDOS (requieren superadmin)
// ============================================

// Todas las rutas siguientes requieren autenticación + rol superadmin
router.use(requireAuth, requireRole(['superadmin']));

/**
 * GET /api/audit/logs
 * Consulta logs de auditoría con filtros y paginación
 */
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      actionType,
      entityType,
      entityId,
      startDate,
      endDate,
      ipAddress,
      search,
      page = '1',
      limit = '50'
    } = req.query;

    const result = await queryAuditLogs({
      userId: userId ? parseInt(userId as string) : undefined,
      actionType: actionType as AuditActionType | undefined,
      entityType: entityType as string | undefined,
      entityId: entityId as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      ipAddress: ipAddress as string | undefined,
      search: search as string | undefined,
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    });

    res.json({
      success: true,
      data: result.logs,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    console.error('Error obteniendo logs de auditoría:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener logs de auditoría' 
    });
  }
});

/**
 * GET /api/audit (legacy endpoint - igual que /logs)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await queryAuditLogs({
      userId: req.query.user_id ? parseInt(req.query.user_id as string) : undefined,
      entityType: req.query.table_name as string | undefined,
      entityId: req.query.record_id as string | undefined,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50
    });

    res.json({
      success: true,
      data: result.logs,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    console.error('Error obteniendo logs:', error);
    res.status(500).json({ success: false, error: 'Error al obtener logs' });
  }
});

/**
 * GET /api/audit/stats
 * Obtiene estadísticas generales de auditoría
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string) : 7;
    const stats = await getAuditStats(days);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener estadísticas' 
    });
  }
});

/**
 * GET /api/audit/summary (legacy - igual que /stats)
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    const stats = await getAuditStats(days);
    
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error obteniendo resumen:', error);
    res.status(500).json({ success: false, error: 'Error al obtener resumen' });
  }
});

/**
 * GET /api/audit/entity/:entityType/:entityId
 * Obtiene el historial de cambios de un registro específico
 */
router.get('/entity/:entityType/:entityId', async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    const history = await getEntityHistory(entityType, entityId);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener historial' 
    });
  }
});

/**
 * GET /api/audit/user/:userId
 * Obtiene la actividad de un usuario específico
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    
    if (isNaN(userId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID de usuario inválido' 
      });
    }
    
    const activity = await getUserActivity(userId, limit);
    
    res.json({
      success: true,
      data: activity
    });
  } catch (error) {
    console.error('Error obteniendo actividad:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener actividad' 
    });
  }
});

/**
 * GET /api/audit/users
 * Obtiene lista de usuarios con actividad
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await getActiveUsers();
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener usuarios' 
    });
  }
});

/**
 * GET /api/audit/entity-types
 * Obtiene lista de tipos de entidades
 */
router.get('/entity-types', async (req: Request, res: Response) => {
  try {
    const entityTypes = await getEntityTypes();
    
    res.json({
      success: true,
      data: entityTypes
    });
  } catch (error) {
    console.error('Error obteniendo tipos:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener tipos de entidades' 
    });
  }
});

/**
 * GET /api/audit/action-types
 * Devuelve los tipos de acciones disponibles
 */
router.get('/action-types', (_req: Request, res: Response) => {
  const actionTypes: AuditActionType[] = [
    'CREATE', 'UPDATE', 'DELETE', 'READ', 'BULK_UPDATE', 'BULK_DELETE',
    'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_CHANGE', 'PASSWORD_RESET',
    'EXPORT', 'IMPORT', 'UPLOAD', 'DOWNLOAD',
    'SMS_SENT', 'EMAIL_SENT', 'CALL_INITIATED', 'WHATSAPP_SENT',
    'APPOINTMENT_SCHEDULED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_RESCHEDULED',
    'PATIENT_REGISTERED', 'WAITING_LIST_ADDED', 'WAITING_LIST_REMOVED',
    'AVAILABILITY_CREATED', 'AVAILABILITY_DELETED', 'AVAILABILITY_PAUSED',
    'CONFIG_CHANGED', 'PERMISSION_CHANGED', 'USER_CREATED', 'USER_DELETED',
    'OTHER'
  ];
  
  res.json({
    success: true,
    data: actionTypes
  });
});

/**
 * GET /api/audit/online-users
 * Obtiene usuarios actualmente en línea (actividad en últimos 5 minutos)
 */
router.get('/online-users', async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        us.user_id,
        u.name as user_name,
        u.email as user_email,
        u.role,
        us.ip_address,
        us.last_activity,
        us.created_at as session_started,
        TIMESTAMPDIFF(MINUTE, us.last_activity, NOW()) as minutes_inactive
      FROM user_sessions us
      INNER JOIN users u ON us.user_id = u.id
      WHERE us.is_active = TRUE 
        AND us.last_activity >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
      ORDER BY us.last_activity DESC
    `);
    
    const users = (rows as any[]).map(row => ({
      ...row,
      is_online: row.minutes_inactive <= 5,
      status: row.minutes_inactive <= 5 ? 'online' : row.minutes_inactive <= 15 ? 'idle' : 'away'
    }));
    
    res.json({
      success: true,
      data: {
        users,
        total_online: users.filter((u: any) => u.is_online).length,
        total_sessions: users.length
      }
    });
  } catch (error) {
    console.error('Error obteniendo usuarios en línea:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener usuarios en línea' 
    });
  }
});

/**
 * POST /api/audit/logout-all
 * Cierra todas las sesiones de todos los usuarios (solo superadmin)
 */
router.post('/logout-all', async (req: Request, res: Response) => {
  try {
    const [result] = await pool.execute(`
      UPDATE user_sessions 
      SET is_active = FALSE 
      WHERE is_active = TRUE
    `);
    
    const affectedRows = (result as any).affectedRows;
    
    // Registrar en auditoría
    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      actionType: 'OTHER',
      entityType: 'session',
      description: `Cerró todas las sesiones activas (${affectedRows} sesiones)`,
      ipAddress: req.ip,
      metadata: { sessions_closed: affectedRows }
    });
    
    res.json({
      success: true,
      message: `Se cerraron ${affectedRows} sesiones activas`,
      sessions_closed: affectedRows
    });
  } catch (error) {
    console.error('Error cerrando sesiones:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al cerrar sesiones' 
    });
  }
});

/**
 * POST /api/audit/logout-user/:userId
 * Cierra todas las sesiones de un usuario específico
 */
router.post('/logout-user/:userId', async (req: Request, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.userId);
    
    if (isNaN(targetUserId)) {
      return res.status(400).json({ success: false, error: 'ID de usuario inválido' });
    }
    
    // Obtener info del usuario antes de cerrar
    const [userRows] = await pool.execute(
      'SELECT name, email FROM users WHERE id = ?',
      [targetUserId]
    );
    const targetUser = (userRows as any[])[0];
    
    const [result] = await pool.execute(`
      UPDATE user_sessions 
      SET is_active = FALSE 
      WHERE user_id = ? AND is_active = TRUE
    `, [targetUserId]);
    
    const affectedRows = (result as any).affectedRows;
    
    // Registrar en auditoría
    await logAudit({
      userId: req.user?.id,
      userName: req.user?.name,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      actionType: 'LOGOUT',
      entityType: 'user',
      entityId: targetUserId,
      entityName: targetUser?.name,
      description: `Cerró sesiones de ${targetUser?.name || 'Usuario #' + targetUserId}`,
      ipAddress: req.ip,
      metadata: { sessions_closed: affectedRows }
    });
    
    res.json({
      success: true,
      message: `Se cerraron ${affectedRows} sesiones del usuario`,
      sessions_closed: affectedRows
    });
  } catch (error) {
    console.error('Error cerrando sesión de usuario:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al cerrar sesión del usuario' 
    });
  }
});

/**
 * GET /api/audit/field-changes
 * Obtiene historial de cambios a campos específicos
 */
router.get('/field-changes', async (req: Request, res: Response) => {
  try {
    const { 
      field, 
      entityType,
      startDate,
      endDate,
      page = '1',
      limit = '50'
    } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    
    let whereClause = "changed_fields IS NOT NULL AND changed_fields != '[]'";
    const params: any[] = [];
    
    if (field) {
      whereClause += " AND JSON_CONTAINS(changed_fields, ?)";
      params.push(JSON.stringify(field));
    }
    
    if (entityType) {
      whereClause += " AND entity_type = ?";
      params.push(entityType);
    }
    
    if (startDate) {
      whereClause += " AND created_at >= ?";
      params.push(startDate);
    }
    
    if (endDate) {
      whereClause += " AND created_at <= ?";
      params.push(endDate + ' 23:59:59');
    }
    
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM audit_logs WHERE ${whereClause}`,
      params
    );
    const total = (countRows as any[])[0].total;
    
    const [rows] = await pool.execute(`
      SELECT 
        id, created_at, user_name, user_email, user_role,
        action_type, entity_type, entity_id, entity_name,
        old_values, new_values, changed_fields, description
      FROM audit_logs 
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);
    
    res.json({
      success: true,
      data: rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error obteniendo cambios de campos:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener cambios de campos' 
    });
  }
});

export default router;
