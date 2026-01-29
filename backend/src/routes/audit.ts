/**
 * 🔒 RUTAS DE AUDITORÍA - BIOSANAR IPS
 * 
 * Endpoints para consultar logs de auditoría (INMUTABLE).
 * Los logs solo pueden ser creados y leídos, nunca modificados o eliminados.
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { 
  queryAuditLogs, 
  getAuditStats, 
  getEntityHistory, 
  getUserActivity,
  getActiveUsers,
  getEntityTypes,
  AuditActionType
} from '../services/auditService';

const router = Router();

// Todas las rutas requieren autenticación y rol superadmin ÚNICAMENTE
// Los superadmins pueden ver TODOS los registros de auditoría, incluyendo los suyos
router.use(requireAuth);
router.use(requireRole(['superadmin']));

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

export default router;
