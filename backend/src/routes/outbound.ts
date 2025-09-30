import express from 'express';
import { z } from 'zod';
import OutboundCallManager, { CampaignSchema, OutboundCallSchema } from '../services/OutboundCallManager.js';

const router = express.Router();

// Middleware para validar que OutboundCallManager esté disponible
const validateOutboundManager = (req: any, res: any, next: any) => {
  if (!req.app.locals.outboundManager) {
    return res.status(503).json({
      success: false,
      error: 'Outbound call service not available'
    });
  }
  next();
};

// ==================== CAMPAÑAS ====================

/**
 * @route POST /api/outbound/campaigns
 * @desc Crear nueva campaña de llamadas salientes
 */
router.post('/campaigns', validateOutboundManager, async (req: any, res: any) => {
  try {
    const manager: OutboundCallManager = req.app.locals.outboundManager;
    const campaignId = await manager.createCampaign(req.body);
    
    res.json({
      success: true,
      data: { campaign_id: campaignId },
      message: 'Campaign created successfully'
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create campaign'
    });
  }
});

/**
 * @route GET /api/outbound/campaigns
 * @desc Listar todas las campañas
 */
router.get('/campaigns', validateOutboundManager, async (req: any, res: any) => {
  try {
    const manager: OutboundCallManager = req.app.locals.outboundManager;
    const campaigns = await manager.getCampaigns();
    
    res.json({
      success: true,
      data: campaigns
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaigns'
    });
  }
});

/**
 * @route GET /api/outbound/campaigns/:id
 * @desc Obtener detalles de una campaña
 */
router.get('/campaigns/:id', validateOutboundManager, async (req: any, res: any) => {
  try {
    const manager: OutboundCallManager = req.app.locals.outboundManager;
    const campaignId = parseInt(req.params.id);
    
    if (isNaN(campaignId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid campaign ID'
      });
    }
    
    const campaign = await manager.getCampaign(campaignId);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }
    
    res.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign'
    });
  }
});

/**
 * @route GET /api/outbound/campaigns/:id/stats
 * @desc Obtener estadísticas de una campaña
 */
router.get('/campaigns/:id/stats', validateOutboundManager, async (req: any, res: any) => {
  try {
    const manager: OutboundCallManager = req.app.locals.outboundManager;
    const campaignId = parseInt(req.params.id);
    
    if (isNaN(campaignId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid campaign ID'
      });
    }
    
    const stats = await manager.getCampaignStats(campaignId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign statistics'
    });
  }
});

/**
 * @route PATCH /api/outbound/campaigns/:id/status
 * @desc Actualizar estado de una campaña
 */
router.patch('/campaigns/:id/status', validateOutboundManager, async (req: any, res: any) => {
  try {
    const manager: OutboundCallManager = req.app.locals.outboundManager;
    const campaignId = parseInt(req.params.id);
    const { status } = req.body;
    
    if (isNaN(campaignId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid campaign ID'
      });
    }
    
    if (!['active', 'paused', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be: active, paused, or completed'
      });
    }
    
    await manager.updateCampaignStatus(campaignId, status);
    
    res.json({
      success: true,
      message: `Campaign status updated to ${status}`
    });
  } catch (error) {
    console.error('Error updating campaign status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update campaign status'
    });
  }
});

// ==================== LLAMADAS INDIVIDUALES ====================

/**
 * @route POST /api/outbound/campaigns/:id/calls
 * @desc Programar una llamada individual en una campaña
 */
router.post('/campaigns/:id/calls', validateOutboundManager, async (req: any, res: any) => {
  try {
    const manager: OutboundCallManager = req.app.locals.outboundManager;
    const campaignId = parseInt(req.params.id);
    
    if (isNaN(campaignId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid campaign ID'
      });
    }
    
    // Agregar campaign_id al body
    const callData = {
      ...req.body,
      campaign_id: campaignId,
      scheduled_at: new Date(req.body.scheduled_at)
    };
    
    const callId = await manager.scheduleCall(callData);
    
    res.json({
      success: true,
      data: { call_id: callId },
      message: 'Call scheduled successfully'
    });
  } catch (error) {
    console.error('Error scheduling call:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to schedule call'
    });
  }
});

/**
 * @route POST /api/outbound/calls/bulk
 * @desc Programar múltiples llamadas en lote
 */
router.post('/calls/bulk', validateOutboundManager, async (req: any, res: any) => {
  try {
    const manager: OutboundCallManager = req.app.locals.outboundManager;
    const { calls } = req.body;
    
    if (!Array.isArray(calls) || calls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Calls array is required and must not be empty'
      });
    }
    
    if (calls.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 calls per batch'
      });
    }
    
    const results = [];
    const errors = [];
    
    for (let i = 0; i < calls.length; i++) {
      try {
        const callData = {
          ...calls[i],
          scheduled_at: new Date(calls[i].scheduled_at)
        };
        
        const callId = await manager.scheduleCall(callData);
        results.push({ index: i, call_id: callId, status: 'scheduled' });
        
      } catch (error) {
        errors.push({ 
          index: i, 
          error: error instanceof Error ? error.message : 'Unknown error',
          call_data: calls[i]
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        scheduled: results.length,
        failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined
      },
      message: `${results.length} calls scheduled, ${errors.length} failed`
    });
  } catch (error) {
    console.error('Error in bulk call scheduling:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process bulk call scheduling'
    });
  }
});

// ==================== CAMPAÑAS AUTOMÁTICAS ====================

/**
 * @route POST /api/outbound/auto/appointment-reminders
 * @desc Programar recordatorios automáticos de citas
 */
router.post('/auto/appointment-reminders', validateOutboundManager, async (req: any, res: any) => {
  try {
    const manager: OutboundCallManager = req.app.locals.outboundManager;
    await manager.scheduleAppointmentReminders();
    
    res.json({
      success: true,
      message: 'Appointment reminders scheduled successfully'
    });
  } catch (error) {
    console.error('Error scheduling appointment reminders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule appointment reminders'
    });
  }
});

/**
 * @route POST /api/outbound/auto/post-consultation-followups
 * @desc Programar seguimientos automáticos post-consulta
 */
router.post('/auto/post-consultation-followups', validateOutboundManager, async (req: any, res: any) => {
  try {
    const manager: OutboundCallManager = req.app.locals.outboundManager;
    await manager.schedulePostConsultationFollowups();
    
    res.json({
      success: true,
      message: 'Post-consultation followups scheduled successfully'
    });
  } catch (error) {
    console.error('Error scheduling post-consultation followups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule post-consultation followups'
    });
  }
});

// ==================== REPORTES Y ANÁLISIS ====================

/**
 * @route GET /api/outbound/reports/daily
 * @desc Obtener reporte diario de llamadas salientes
 */
router.get('/reports/daily', validateOutboundManager, async (req: any, res: any) => {
  try {
    const manager: OutboundCallManager = req.app.locals.outboundManager;
    const date = req.query.date ? new Date(req.query.date as string) : new Date();
    
    const report = await manager.generateDailyReport(date);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error generating daily report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate daily report'
    });
  }
});

/**
 * @route GET /api/outbound/reports/top-campaigns
 * @desc Obtener campañas con mejor rendimiento
 */
router.get('/reports/top-campaigns', validateOutboundManager, async (req: any, res: any) => {
  try {
    const manager: OutboundCallManager = req.app.locals.outboundManager;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const topCampaigns = await manager.getTopPerformingCampaigns(limit);
    
    res.json({
      success: true,
      data: topCampaigns
    });
  } catch (error) {
    console.error('Error fetching top campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top performing campaigns'
    });
  }
});

// ==================== ESTADO Y SALUD DEL SISTEMA ====================

/**
 * @route GET /api/outbound/health
 * @desc Health check del sistema de llamadas salientes
 */
router.get('/health', validateOutboundManager, async (req: any, res: any) => {
  try {
    const manager: OutboundCallManager = req.app.locals.outboundManager;
    
    // Verificar estado básico del sistema
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'outbound_calls',
      version: '1.0.0'
    };
    
    res.json({
      success: true,
      data: healthStatus
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      success: false,
      error: 'Service unhealthy',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/outbound/stats/system
 * @desc Estadísticas generales del sistema
 */
router.get('/stats/system', validateOutboundManager, async (req: any, res: any) => {
  try {
    const db = req.app.locals.db;
    
    // Estadísticas básicas del sistema
    const [totalCalls] = await db.execute(
      'SELECT COUNT(*) as count FROM outbound_calls'
    );
    
    const [activeCampaigns] = await db.execute(
      'SELECT COUNT(*) as count FROM outbound_campaigns WHERE status = ?',
      ['active']
    );
    
    const [todayCalls] = await db.execute(
      'SELECT COUNT(*) as count FROM outbound_calls WHERE DATE(scheduled_at) = CURDATE()'
    );
    
    const [callsByStatus] = await db.execute(
      `SELECT status, COUNT(*) as count 
       FROM outbound_calls 
       WHERE DATE(scheduled_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY status`
    );
    
    res.json({
      success: true,
      data: {
        total_calls: (totalCalls as any[])[0].count,
        active_campaigns: (activeCampaigns as any[])[0].count,
        today_calls: (todayCalls as any[])[0].count,
        calls_by_status: callsByStatus,
        last_updated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching system stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system statistics'
    });
  }
});

// ==================== TEMPLATES DE CAMPAÑA ====================

/**
 * @route GET /api/outbound/templates
 * @desc Obtener plantillas predefinidas para campañas
 */
router.get('/templates', (req: any, res: any) => {
  const templates = {
    appointment_reminder: {
      name: 'Recordatorio de Cita',
      script: `Hola {patient_name}, soy Valeria de Biosanarcall.
Le recordamos que tiene una cita médica programada para {date} a las {time} con el Dr. {doctor_name}.

Para confirmar su cita, presione 1.
Para reprogramar, presione 2.
Para cancelar, presione 3.

Si no puede atender ahora, también puede confirmar por WhatsApp.
Gracias y que tenga un buen día.`,
      variables: ['patient_name', 'date', 'time', 'doctor_name'],
      max_attempts: 2,
      retry_interval: 7200
    },
    
    post_consultation: {
      name: 'Seguimiento Post-Consulta',
      script: `Hola {patient_name}, soy Valeria de Biosanarcall.
Espero se encuentre bien. Le llamo para hacer seguimiento a su consulta del {consultation_date} con el Dr. {doctor_name}.

¿Cómo se ha sentido después del tratamiento?
¿Ha seguido las indicaciones del doctor?
¿Ha presentado algún síntoma nuevo?

Para responder Sí, presione 1. Para No, presione 2.
Si necesita una nueva cita, presione 3.`,
      variables: ['patient_name', 'consultation_date', 'doctor_name'],
      max_attempts: 2,
      retry_interval: 10800
    },
    
    satisfaction_survey: {
      name: 'Encuesta de Satisfacción',
      script: `Hola {patient_name}, soy Valeria de Biosanarcall.
Nos gustaría conocer su opinión sobre la atención recibida.

En una escala del 1 al 5, donde 5 es excelente:
¿Cómo califica la atención del Dr. {doctor_name}? Presione del 1 al 5.
¿Recomendaría nuestros servicios? Presione 1 para Sí, 2 para No.

Gracias por su tiempo y confianza en Biosanarcall.`,
      variables: ['patient_name', 'doctor_name'],
      max_attempts: 1,
      retry_interval: 86400
    }
  };
  
  res.json({
    success: true,
    data: templates
  });
});

export default router;