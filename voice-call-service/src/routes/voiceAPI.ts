import { Router } from 'express';
import { ZadarmaClient } from '../services/ZadarmaClient';
import { CallLogService } from '../services/CallLogService';

const router = Router();
const zadarmaClient = new ZadarmaClient(
  process.env.ZADARMA_KEY || '2eeea07f46fcf59e3a10',
  process.env.ZADARMA_SECRET || 'c87065c063195ad4b3da',
  false
);
const callLogService = new CallLogService();

/**
 * Health check para el servicio de voz
 */
router.get('/health', (req, res) => {
  try {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'voice-call-service',
      version: '1.0.0'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: error.message
    });
  }
});

/**
 * Obtener balance de Zadarma
 */
router.get('/balance', async (req, res) => {
  try {
    const result = await zadarmaClient.getBalance();
    
    if (result.success && result.data) {
      res.json({
        success: true,
        balance: `$${result.data.balance} ${result.data.currency}`,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Error obteniendo balance',
        details: result.error
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Error interno obteniendo balance',
      details: error.message
    });
  }
});

/**
 * Test de conectividad con API de Zadarma
 */
router.post('/test-zadarma', async (req, res) => {
  try {
    const results: {
      balance: any;
      sip: any;
      errors: string[];
    } = {
      balance: null,
      sip: null,
      errors: []
    };

    // Test balance
    try {
      const balanceResult = await zadarmaClient.getBalance();
      results.balance = balanceResult.success ? balanceResult.data : balanceResult.error;
    } catch (error: any) {
      results.errors = results.errors || [];
      results.errors.push(`Balance: ${error.message}`);
    }

    // Test SIP information
    try {
      const sipResult = await zadarmaClient.getSip();
      results.sip = sipResult.success ? sipResult.data : sipResult.error;
    } catch (error: any) {
      results.errors = results.errors || [];
      results.errors.push(`SIP: ${error.message}`);
    }

    const hasErrors = results.errors.length > 0;
    res.status(hasErrors ? 207 : 200).json({
      success: !hasErrors,
      message: hasErrors ? 'Tests completados con errores' : 'Todos los tests exitosos',
      results,
      errors: results.errors
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Error ejecutando tests de Zadarma',
      details: error.message
    });
  }
});

/**
 * Simular llamada para testing
 */
router.post('/simulate-call', async (req, res) => {
  try {
    const { caller, called } = req.body;

    if (!caller || !called) {
      return res.status(400).json({
        success: false,
        error: 'Caller y called son requeridos'
      });
    }

        // Crear llamada simulada en la base de datos
    const callData = {
      call_id: `sim_${Date.now()}`,
      caller_number: caller,
      called_number: called,
      start_time: new Date(),
      status: 'incoming' as const
    };

    const callId = await callLogService.createCallRecord(callData);

    // Simular procesamiento después de 2 segundos
    setTimeout(async () => {
      await callLogService.updateCallRecord(callId.toString(), {
        status: 'completed' as const,
        end_time: new Date(),
        duration: Math.floor(Math.random() * 120) + 30 // 30-150 segundos
      });
    }, 2000);

    return res.json({
      success: true,
      message: 'Llamada simulada creada exitosamente',
      callId,
      data: callData
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Error creando llamada simulada',
      details: error.message
    });
  }
});

/**
 * Obtener historial de llamadas
 */
router.get('/calls', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const calls = await callLogService.getRecentCalls(limit);
    
    const formattedCalls = calls.map((call: any) => ({
      id: call.id,
      date: call.created_at?.toLocaleDateString() || 'N/A',
      time: call.created_at?.toLocaleTimeString() || 'N/A',
      number: call.caller_number,
      duration: call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : '-',
      status: call.status,
      transcription: call.transcript || '',
      response: call.agent_response || ''
    }));

    res.json({
      success: true,
      calls: formattedCalls,
      pagination: {
        page,
        limit,
        total: calls.length
      }
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Error obteniendo historial de llamadas',
      details: error.message
    });
  }
});

/**
 * Obtener estadísticas del día
 */
router.get('/stats/today', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const stats = await callLogService.getCallStatistics();

    res.json({
      success: true,
      stats: {
        totalCalls: stats.totalCalls,
        completedCalls: stats.completedCalls,
        failedCalls: stats.failedCalls,
        averageDuration: stats.avgDuration,
        successRate: stats.totalCalls > 0 ? 
          Math.round((stats.completedCalls / stats.totalCalls) * 100) : 0
      }
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estadísticas',
      details: error.message
    });
  }
});

/**
 * Descargar grabación de llamada
 */
router.get('/calls/:callId/recording', async (req, res) => {
  try {
    const { callId } = req.params;
    
    const call = await callLogService.getCallRecord(callId);
    
    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Llamada no encontrada'
      });
    }

    if (!call.recording_url) {
      return res.status(404).json({
        success: false,
        error: 'Grabación no disponible'
      });
    }

    // Redirect to recording URL or serve file
    return res.redirect(call.recording_url);

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Error obteniendo grabación',
      details: error.message
    });
  }
});

export default router;