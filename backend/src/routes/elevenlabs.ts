import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { elevenLabsService } from '../services/elevenLabsService';
import { z } from 'zod';
import pool from '../db/pool';
import { RowDataPacket } from 'mysql2';

const router = Router();

// Esquemas de validación
const initiateCallSchema = z.object({
  phoneNumber: z.string().min(10, 'Número telefónico inválido'),
  patientId: z.number().optional(),
  patientName: z.string().optional(),
  appointmentId: z.number().optional(),
  agentId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  customVariables: z.record(z.string()).optional()
});

const getStatsSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  patientId: z.number().optional(),
  status: z.string().optional()
});

/**
 * GET /api/elevenlabs/agents
 * Obtiene la lista de agentes disponibles
 */
router.get('/agents', requireAuth, async (req: Request, res: Response) => {
  try {
    const agents = await elevenLabsService.listAgents();
    
    res.json({
      success: true,
      data: agents,
      count: agents.length
    });
  } catch (error: any) {
    console.error('Error listing agents:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener agentes',
      details: error.message
    });
  }
});

/**
 * GET /api/elevenlabs/agents/:agentId
 * Obtiene información de un agente específico
 */
router.get('/agents/:agentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const agent = await elevenLabsService.getAgent(agentId);
    
    res.json({
      success: true,
      data: agent
    });
  } catch (error: any) {
    console.error('Error getting agent:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener agente',
      details: error.message
    });
  }
});

/**
 * POST /api/elevenlabs/call
 * Inicia una llamada saliente
 */
router.post('/call', requireAuth, async (req: Request, res: Response) => {
  try {
    const validatedData = initiateCallSchema.parse(req.body);
    
    // Si no se proporciona patientId, intentar buscarlo por teléfono
    let patientId = validatedData.patientId;
    let patientName = validatedData.patientName;

    if (!patientId) {
      patientId = await elevenLabsService.findPatientByPhone(validatedData.phoneNumber) || undefined;
      
      // Si encontramos el paciente, obtener su nombre
      if (patientId) {
        const [rows] = await pool.execute<RowDataPacket[]>(
          'SELECT name FROM patients WHERE id = ?',
          [patientId]
        );
        
        if (rows.length > 0) {
          patientName = rows[0].name;
        }
      }
    }

    console.log('📞 Iniciando llamada ElevenLabs:', {
      phoneNumber: validatedData.phoneNumber,
      patientId,
      patientName,
      appointmentId: validatedData.appointmentId
    });

    const result = await elevenLabsService.initiateCall({
      ...validatedData,
      patientId,
      patientName
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Llamada iniciada exitosamente',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Error al iniciar llamada',
        details: result.error
      });
    }
  } catch (error: any) {
    console.error('Error iniciando llamada:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error al iniciar llamada',
      details: error.message
    });
  }
});

/**
 * POST /api/elevenlabs/call-real
 * Inicia una llamada telefónica REAL usando ElevenLabs
 * Esta llamada sonará en el teléfono del destinatario
 */
router.post('/call-real', requireAuth, async (req: Request, res: Response) => {
  try {
    const callRealSchema = z.object({
      phoneNumber: z.string().min(10, 'Número telefónico inválido'),
      message: z.string().min(10, 'El mensaje debe tener al menos 10 caracteres'),
      patientId: z.number().optional(),
      patientName: z.string().optional(),
      appointmentId: z.number().optional()
    });

    const validatedData = callRealSchema.parse(req.body);

    console.log('🚀 [API] Iniciando llamada REAL:', {
      phoneNumber: validatedData.phoneNumber,
      patientId: validatedData.patientId
    });

    const result = await elevenLabsService.initiateRealCall({
      phoneNumber: validatedData.phoneNumber,
      message: validatedData.message,
      patientId: validatedData.patientId,
      patientName: validatedData.patientName,
      appointmentId: validatedData.appointmentId
    });

    if (result.success) {
      res.json({
        success: true,
        message: '¡Llamada telefónica REAL iniciada! El teléfono debería estar sonando.',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Error al iniciar llamada real',
        details: result.details
      });
    }
  } catch (error: any) {
    console.error('❌ [API] Error iniciando llamada real:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error al iniciar llamada real',
      details: error.message
    });
  }
});

/**
 * POST /api/elevenlabs/call-physical
 * Inicia una llamada telefónica FÍSICA REAL usando Zadarma SIP verificado
 * Esta llamada REALMENTE sonará en el teléfono del destinatario
 */
router.post('/call-physical', requireAuth, async (req: Request, res: Response) => {
  try {
    const callPhysicalSchema = z.object({
      phoneNumber: z.string().min(10, 'Número telefónico inválido'),
      message: z.string().min(10, 'El mensaje debe tener al menos 10 caracteres'),
      patientId: z.number().optional(),
      patientName: z.string().optional(),
      appointmentId: z.number().optional()
    });

    const validatedData = callPhysicalSchema.parse(req.body);

    console.log('🚀 [API] Iniciando llamada FÍSICA REAL:', {
      phoneNumber: validatedData.phoneNumber,
      patientId: validatedData.patientId
    });

    const result = await elevenLabsService.makePhysicalCall({
      phoneNumber: validatedData.phoneNumber,
      message: validatedData.message,
      patientId: validatedData.patientId,
      patientName: validatedData.patientName,
      appointmentId: validatedData.appointmentId
    });

    if (result.success) {
      res.json({
        success: true,
        message: '🎉 ¡LLAMADA FÍSICA INICIADA! El teléfono está sonando AHORA.',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Error al iniciar llamada física',
        details: result.details
      });
    }
  } catch (error: any) {
    console.error('❌ [API] Error iniciando llamada física:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error al iniciar llamada física',
      details: error.message
    });
  }
});

/**
 * GET /api/elevenlabs/conversation/:conversationId
 * Obtiene el estado de una conversación
 */
router.get('/conversation/:conversationId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const conversation = await elevenLabsService.getConversationStatus(conversationId);
    
    res.json({
      success: true,
      data: conversation
    });
  } catch (error: any) {
    console.error('Error getting conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener conversación',
      details: error.message
    });
  }
});

/**
 * DELETE /api/elevenlabs/conversation/:conversationId
 * Finaliza una llamada activa
 */
router.delete('/conversation/:conversationId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const success = await elevenLabsService.endCall(conversationId);
    
    if (success) {
      res.json({
        success: true,
        message: 'Llamada finalizada exitosamente'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Error al finalizar llamada'
      });
    }
  } catch (error: any) {
    console.error('Error ending call:', error);
    res.status(500).json({
      success: false,
      error: 'Error al finalizar llamada',
      details: error.message
    });
  }
});

/**
 * GET /api/elevenlabs/calls
 * Obtiene el historial de llamadas
 */
router.get('/calls', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const patientId = req.query.patientId ? parseInt(req.query.patientId as string) : null;
    const status = req.query.status as string;

    let query = `
      SELECT 
        ec.id,
        ec.conversation_id,
        ec.agent_id,
        ec.phone_number,
        ec.patient_id,
        ec.appointment_id,
        ec.status,
        ec.start_time,
        ec.end_time,
        ec.duration_secs,
        ec.cost,
        ec.call_successful,
        ec.transcript_summary,
        ec.created_at,
        p.name as patient_name,
        p.document as patient_document
      FROM elevenlabs_conversations ec
      LEFT JOIN patients p ON ec.patient_id = p.id
      WHERE 1=1
    `;

    let countQuery = `
      SELECT COUNT(*) as total
      FROM elevenlabs_conversations ec
      WHERE 1=1
    `;

    const params: any[] = [];
    const countParams: any[] = [];

    if (patientId) {
      query += ' AND ec.patient_id = ?';
      countQuery += ' AND ec.patient_id = ?';
      params.push(patientId);
      countParams.push(patientId);
    }

    if (status) {
      query += ' AND ec.status = ?';
      countQuery += ' AND ec.status = ?';
      params.push(status);
      countParams.push(status);
    }

    query += ' ORDER BY ec.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.execute<RowDataPacket[]>(query, params);
    const [countRows] = await pool.execute<RowDataPacket[]>(countQuery, countParams);

    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error: any) {
    console.error('Error getting calls:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener llamadas',
      details: error.message
    });
  }
});

/**
 * GET /api/elevenlabs/stats
 * Obtiene estadísticas de llamadas
 */
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const filters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      patientId: req.query.patientId ? parseInt(req.query.patientId as string) : undefined,
      status: req.query.status as string
    };

    const stats = await elevenLabsService.getCallStats(filters);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas',
      details: error.message
    });
  }
});

/**
 * POST /api/elevenlabs/call-patient
 * Endpoint simplificado para llamar a un paciente por su ID
 */
router.post('/call-patient/:patientId', requireAuth, async (req: Request, res: Response) => {
  try {
    const patientId = parseInt(req.params.patientId);
    
    // Obtener datos del paciente
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, name, phone FROM patients WHERE id = ?',
      [patientId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Paciente no encontrado'
      });
    }

    const patient = rows[0];

    if (!patient.phone) {
      return res.status(400).json({
        success: false,
        error: 'El paciente no tiene número telefónico registrado'
      });
    }

    const result = await elevenLabsService.initiateCall({
      phoneNumber: patient.phone,
      patientId: patient.id,
      patientName: patient.name,
      appointmentId: req.body.appointmentId,
      metadata: req.body.metadata,
      customVariables: req.body.customVariables
    });

    if (result.success) {
      res.json({
        success: true,
        message: `Llamada iniciada a ${patient.name}`,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Error al iniciar llamada',
        details: result.error
      });
    }
  } catch (error: any) {
    console.error('Error calling patient:', error);
    res.status(500).json({
      success: false,
      error: 'Error al llamar al paciente',
      details: error.message
    });
  }
});

/**
 * POST /api/elevenlabs/call-direct
 * Realiza una llamada directa con un mensaje simple sin usar agente
 */
router.post('/call-direct', requireAuth, async (req: Request, res: Response) => {
  try {
    const { phoneNumber, message, patientId, voiceId } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'phoneNumber y message son requeridos'
      });
    }

    console.log('📞 Iniciando llamada directa:', {
      phoneNumber,
      messageLength: message.length,
      patientId
    });

    const result = await elevenLabsService.initiateCall({
      phoneNumber,
      message,
      patientId,
      voiceId,
      directCall: true,
      metadata: {
        call_type: 'direct',
        created_by: 'api'
      }
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Audio generado exitosamente para llamada directa',
        data: result,
        note: 'Para completar la llamada, usa la integración con Zadarma u otro proveedor de telefonía'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Error al generar llamada directa',
        details: result.error
      });
    }
  } catch (error: any) {
    console.error('Error en llamada directa:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar llamada directa',
      details: error.message
    });
  }
});

/**
 * POST /api/elevenlabs/call-with-zadarma
 * Realiza una llamada completa usando ElevenLabs (audio) + Zadarma (telefonía)
 */
router.post('/call-with-zadarma', requireAuth, async (req: Request, res: Response) => {
  try {
    const { phoneNumber, message, patientId, voiceId } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'phoneNumber y message son requeridos'
      });
    }

    console.log('📞 Iniciando llamada completa ElevenLabs + Zadarma:', {
      phoneNumber,
      messageLength: message.length,
      patientId
    });

    // 1. Generar audio con ElevenLabs (modo directo)
    const audioResult = await elevenLabsService.initiateCall({
      phoneNumber,
      message,
      patientId,
      voiceId,
      directCall: true,
      metadata: {
        call_type: 'zadarma_integrated',
        created_by: 'api'
      }
    });

    if (!audioResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Error al generar audio',
        details: audioResult.error
      });
    }

    // 2. TODO: Integrar con Zadarma para realizar la llamada
    // Por ahora retornamos éxito indicando que el audio está listo
    
    res.json({
      success: true,
      message: 'Audio generado exitosamente. Integración con Zadarma pendiente.',
      data: {
        conversationId: audioResult.conversationId,
        phoneNumber,
        audioGenerated: true,
        zadarmaIntegration: 'pending',
        note: 'El audio TTS ha sido generado. La integración con Zadarma para realizar la llamada física está en desarrollo.'
      }
    });

  } catch (error: any) {
    console.error('Error en llamada completa:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar llamada',
      details: error.message
    });
  }
});

export default router;
