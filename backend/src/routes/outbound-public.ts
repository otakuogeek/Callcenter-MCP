import { Router, Request, Response } from 'express';
import outboundRoutes from './outbound';

const router = Router();

// Health check específico para outbound
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Verificar estado de Redis, Base de datos, etc.
    const health = {
      redis: true, // TODO: verificar Redis realmente
      database: true, // TODO: verificar DB realmente
      api: true,
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: health,
      message: 'Outbound system is healthy'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: error
    });
  }
});

// Listar campañas (sin autenticación para demo)
router.get('/campaigns', async (req: Request, res: Response) => {
  try {
    // Simulamos algunas campañas por defecto
    const mockCampaigns = [
      {
        id: 1,
        name: 'Recordatorios de Citas',
        type: 'appointment_reminder',
        status: 'active',
        script_template: 'Hola {patient_name}, soy Valeria de Biosanarcall. Tiene una cita programada para {appointment_date}.',
        max_attempts: 3,
        retry_interval: 3600,
        priority: 5,
        created_at: new Date('2024-01-15T09:00:00Z'),
        updated_at: new Date('2024-01-15T09:00:00Z')
      },
      {
        id: 2,
        name: 'Seguimiento Post-Consulta',
        type: 'post_consultation',
        status: 'paused',
        script_template: 'Hola {patient_name}, soy Valeria de Biosanarcall. ¿Cómo se siente después de su consulta con el Dr. {doctor_name}?',
        max_attempts: 2,
        retry_interval: 7200,
        priority: 3,
        created_at: new Date('2024-01-10T14:30:00Z'),
        updated_at: new Date('2024-01-15T10:15:00Z')
      },
      {
        id: 3,
        name: 'Encuesta de Satisfacción',
        type: 'satisfaction_survey',
        status: 'completed',
        script_template: 'Hola {patient_name}, soy Valeria de Biosanarcall. Nos gustaría conocer su opinión sobre el servicio recibido.',
        max_attempts: 1,
        retry_interval: 0,
        priority: 1,
        created_at: new Date('2024-01-05T11:00:00Z'),
        updated_at: new Date('2024-01-12T16:45:00Z')
      }
    ];

    res.json({
      success: true,
      data: mockCampaigns,
      count: mockCampaigns.length
    });
  } catch (error) {
    console.error('Error loading campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load campaigns',
      details: error
    });
  }
});

// Crear campaña (sin autenticación para demo)
router.post('/campaigns', async (req: Request, res: Response) => {
  try {
    const { name, type, script_template, max_attempts, priority } = req.body;

    // Validación básica
    if (!name || !type || !script_template) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, type, script_template'
      });
    }

    // Simular creación de campaña
    const newCampaign = {
      id: Math.floor(Math.random() * 10000) + 100,
      name,
      type,
      status: 'active',
      script_template,
      max_attempts: max_attempts || 3,
      retry_interval: 3600,
      priority: priority || 5,
      created_at: new Date(),
      updated_at: new Date()
    };

    res.status(201).json({
      success: true,
      data: newCampaign,
      message: 'Campaign created successfully'
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create campaign',
      details: error
    });
  }
});

// Obtener estadísticas de campaña
router.get('/campaigns/:id/stats', async (req: Request, res: Response) => {
  try {
    const campaignId = parseInt(req.params.id);

    // Estadísticas simuladas
    const stats = {
      campaign_id: campaignId,
      total_calls: Math.floor(Math.random() * 100) + 50,
      completed_calls: Math.floor(Math.random() * 40) + 30,
      failed_calls: Math.floor(Math.random() * 10) + 5,
      pending_calls: Math.floor(Math.random() * 20) + 10,
      success_rate: Math.round((Math.random() * 30 + 60) * 100) / 100, // 60-90%
      average_duration: Math.floor(Math.random() * 120) + 30, // 30-150 segundos
      last_updated: new Date()
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error loading campaign stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load campaign statistics',
      details: error
    });
  }
});

// Programar llamada (sin autenticación para demo)
router.post('/calls', async (req: Request, res: Response) => {
  try {
    const { campaign_id, phone_number, scheduled_at, variables } = req.body;

    // Validación básica
    if (!campaign_id || !phone_number || !scheduled_at) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: campaign_id, phone_number, scheduled_at'
      });
    }

    // Simular programación de llamada
    const newCall = {
      call_id: Math.floor(Math.random() * 100000) + 10000,
      campaign_id,
      phone_number,
      scheduled_at,
      status: 'scheduled',
      variables: variables || {},
      created_at: new Date()
    };

    res.status(201).json({
      success: true,
      data: newCall,
      message: 'Call scheduled successfully'
    });
  } catch (error) {
    console.error('Error scheduling call:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule call',
      details: error
    });
  }
});

// Triggers para acciones rápidas
router.post('/campaigns/triggers/appointment-reminders', async (req: Request, res: Response) => {
  try {
    // Simular generación de recordatorios
    const result = {
      triggered: true,
      calls_generated: Math.floor(Math.random() * 20) + 5,
      timestamp: new Date()
    };

    res.json({
      success: true,
      data: result,
      message: 'Appointment reminders triggered successfully'
    });
  } catch (error) {
    console.error('Error triggering appointment reminders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger appointment reminders',
      details: error
    });
  }
});

router.post('/campaigns/triggers/post-consultation', async (req: Request, res: Response) => {
  try {
    // Simular generación de seguimientos
    const result = {
      triggered: true,
      calls_generated: Math.floor(Math.random() * 15) + 3,
      timestamp: new Date()
    };

    res.json({
      success: true,
      data: result,
      message: 'Post-consultation follow-ups triggered successfully'
    });
  } catch (error) {
    console.error('Error triggering post-consultation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger post-consultation follow-ups',
      details: error
    });
  }
});

// Mantenimiento
router.delete('/maintenance/clear-logs', async (req: Request, res: Response) => {
  try {
    // Simular limpieza de logs
    res.json({
      success: true,
      message: 'Logs cleared successfully',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error clearing logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear logs',
      details: error
    });
  }
});

// Estadísticas del sistema
router.get('/stats/system', async (req: Request, res: Response) => {
  try {
    const systemStats = {
      total_campaigns: 3,
      active_campaigns: 1,
      total_calls_today: Math.floor(Math.random() * 50) + 20,
      successful_calls_today: Math.floor(Math.random() * 30) + 15,
      failed_calls_today: Math.floor(Math.random() * 10) + 2,
      pending_calls: Math.floor(Math.random() * 25) + 10,
      system_uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      timestamp: new Date()
    };

    res.json({
      success: true,
      data: systemStats
    });
  } catch (error) {
    console.error('Error loading system stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load system statistics',
      details: error
    });
  }
});

export default router;