// ==============================================
// RUTAS DE AUDITORÍA
// ==============================================

import express from 'express';
import { AuditService } from '../services/auditService';
import { requireAuth, requireRole } from '../middleware/auth';

const router = express.Router();

// Obtener logs de auditoría (solo admin/supervisor)
router.get('/', requireAuth, requireRole(['admin', 'supervisor']), async (req, res) => {
  try {
    const tableName = req.query.table_name as string;
    const recordId = req.query.record_id ? parseInt(req.query.record_id as string) : undefined;
    const userId = req.query.user_id ? parseInt(req.query.user_id as string) : undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const logs = await AuditService.getAuditLogs(
      tableName,
      recordId,
      userId,
      limit,
      offset
    );

    res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total: logs.length
      }
    });
  } catch (error) {
    console.error('Error getting audit logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener logs de auditoría'
    });
  }
});

// Obtener resumen de auditoría (solo admin)
router.get('/summary', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const summary = await AuditService.getAuditSummary(days);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting audit summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener resumen de auditoría'
    });
  }
});

export default router;
