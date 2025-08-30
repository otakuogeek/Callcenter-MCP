import express from 'express';
import { authenticateApiKey } from '../middleware/auth';
import { searchPatients, getPatientById, getAppointmentsByDate, getDoctors, getDaySummary } from '../db/queries';
import { testDbConnection } from '../db/mysql';
import logger from '../logger-mysql';

const router = express.Router();

// MCP Protocol Types
interface JSONRPCRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: any;
}

interface JSONRPCResponse {
  jsonrpc: string;
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

// Helper functions
function createSuccessResponse(id: string | number, result: any): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id,
    result
  };
}

function createErrorResponse(id: string | number, code: number, message: string, data?: any): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, data }
  };
}

// MCP Tools for ElevenLabs (optimized set)
const ELEVENLABS_TOOLS = [
  {
    name: 'searchPatients',
    description: 'Buscar pacientes por nombre o documento',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Término de búsqueda' },
        limit: { type: 'number', description: 'Máximo resultados (1-20)', minimum: 1, maximum: 20 }
      },
      required: ['q']
    }
  },
  {
    name: 'getAppointments',
    description: 'Ver citas de una fecha específica',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Fecha YYYY-MM-DD (opcional, hoy por defecto)' }
      }
    }
  },
  {
    name: 'getDaySummary',
    description: 'Resumen hablado del día para voz',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Fecha YYYY-MM-DD (opcional, hoy por defecto)' }
      }
    }
  }
];

// Simple tools (9 tools for general MCP)
const SIMPLE_TOOLS = [
  ...ELEVENLABS_TOOLS,
  {
    name: 'getPatient',
    description: 'Obtener detalle de un paciente',
    inputSchema: {
      type: 'object',
      properties: {
        patient_id: { type: 'number', description: 'ID del paciente' }
      },
      required: ['patient_id']
    }
  },
  {
    name: 'getDoctors',
    description: 'Listar médicos disponibles',
    inputSchema: {
      type: 'object',
      properties: {
        speciality: { type: 'string', description: 'Filtrar por especialidad (opcional)' }
      }
    }
  },
  {
    name: 'getStats',
    description: 'Estadísticas generales',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// Tool execution
async function executeTool(name: string, args: any): Promise<string> {
  logger.info(`Executing tool: ${name}`, { args });

  try {
    switch (name) {
      case 'searchPatients':
        const query = args.q?.trim();
        if (!query) throw new Error('Query parameter is required');
        
        const limit = Math.min(args.limit || 10, 20);
        const patients = await searchPatients(query, limit) as any[];
        return `${patients.length} paciente(s) encontrados: ${patients.map((p: any) => `${p.name} (${p.document})`).join(', ')}`;

      case 'getPatient':
        const patientId = parseInt(args.patient_id);
        if (!patientId) throw new Error('Valid patient_id is required');
        
        const patient = await getPatientById(patientId);
        if (!patient) return `Paciente ${patientId} no encontrado`;
        
        return `${patient.name}, ${patient.document}, ${patient.phone || 'Sin teléfono'}, Estado: ${patient.status}`;

      case 'getAppointments':
        const date = args.date || new Date().toISOString().split('T')[0];
        const appointments = await getAppointmentsByDate(date) as any[];
        
        if (appointments.length === 0) return `Sin citas para ${date}`;
        
        return `${appointments.length} citas en ${date}: ${appointments.map((a: any) => 
          `${a.patient_name} ${a.scheduled_at.substring(11, 16)} (${a.status})`
        ).join(', ')}`;

      case 'getDaySummary':
        const summaryDate = args.date || new Date().toISOString().split('T')[0];
        const summary = await getDaySummary(summaryDate);
        return summary ? JSON.stringify(summary) : `No hay datos disponibles para ${summaryDate}`;

      case 'getDoctors':
        const doctors = await getDoctors() as any[];
        return `${doctors.length} médicos: ${doctors.map((d: any) => 
          `${d.name}${d.specialty_name ? ` (${d.specialty_name})` : ''}`
        ).join(', ')}`;

      case 'getStats':
        const dbConnected = await testDbConnection();
        return `Base de datos: ${dbConnected ? 'Conectada' : 'Desconectada'}. Servidor funcionando correctamente.`;

      default:
        throw new Error(`Tool '${name}' not found`);
    }
  } catch (error) {
    logger.error(`Tool execution failed: ${name}`, { error: error instanceof Error ? error.message : error });
    throw error;
  }
}

// Routes

// Info endpoint (sin autenticación para debugging)
router.get('/info', async (req, res) => {
  const currentTime = new Date().toISOString();
  const expectedApiKey = process.env.MCP_API_KEY || 'biosanarcall_mcp_node_2025';
  
  res.json({
    server: 'Biosanarcall MCP Node.js',
    version: '1.0.0',
    timestamp: currentTime,
    endpoints: {
      elevenlabs: {
        url: '/api/elevenlabs',
        tools: ELEVENLABS_TOOLS.length,
        description: 'Optimizado para ElevenLabs Voice AI',
        methods: ['initialize', 'tools/list', 'tools/call', 'ping']
      },
      simple: {
        url: '/api/mcp-simple',
        tools: SIMPLE_TOOLS.length,
        description: 'Set completo de herramientas MCP',
        methods: ['initialize', 'tools/list', 'tools/call', 'ping']
      }
    },
    authentication: {
      method: 'API Key',
      header: 'X-API-Key',
      expected_key_format: 'biosanarcall_mcp_node_XXXX',
      key_length: expectedApiKey.length,
      note: 'Clave requerida para todos los endpoints MCP'
    },
    configuration: {
      domain: 'https://biosanarcall.site',
      direct_urls: {
        health: 'https://biosanarcall.site/mcp-node-health',
        elevenlabs: 'https://biosanarcall.site/mcp-elevenlabs',
        simple: 'https://biosanarcall.site/mcp-simple',
        info: 'https://biosanarcall.site/mcp-node-info'
      }
    },
    tools: {
      elevenlabs: ELEVENLABS_TOOLS.map(t => ({ name: t.name, description: t.description })),
      simple: SIMPLE_TOOLS.map(t => ({ name: t.name, description: t.description }))
    },
    usage_examples: {
      test_auth: "curl -X POST https://biosanarcall.site/mcp-elevenlabs -H 'Content-Type: application/json' -H 'X-API-Key: " + expectedApiKey + "' -d '{\"jsonrpc\":\"2.0\",\"id\":\"test\",\"method\":\"tools/list\"}'",
      test_tool: "curl -X POST https://biosanarcall.site/mcp-elevenlabs -H 'Content-Type: application/json' -H 'X-API-Key: " + expectedApiKey + "' -d '{\"jsonrpc\":\"2.0\",\"id\":\"search\",\"method\":\"tools/call\",\"params\":{\"name\":\"searchPatients\",\"arguments\":{\"q\":\"Juan\",\"limit\":3}}}'"
    }
  });
});

// Health endpoint
router.get('/health', async (req, res) => {
  try {
    // Add timeout to prevent hanging
    const dbConnected = await Promise.race([
      testDbConnection(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), 3000))
    ]);
    
    res.json({
      status: 'ok',
      database: dbConnected ? 'connected' : 'disconnected',
      server: 'Biosanarcall MCP Node.js',
      timestamp: new Date().toISOString(),
      tools: {
        elevenlabs: ELEVENLABS_TOOLS.length,
        simple: SIMPLE_TOOLS.length
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// MCP Endpoints

// GET endpoint para ElevenLabs - Llamadas directas a herramientas
router.get('/elevenlabs', authenticateApiKey, async (req, res) => {
  const { method, tool, q, limit, date, patient_id, speciality } = req.query;
  
  logger.info('ElevenLabs GET request', { method, tool, query: req.query });
  
  try {
    // Si se especifica un método MCP
    if (method === 'tools/list' || method === 'list') {
      return res.json({
        tools: ELEVENLABS_TOOLS,
        count: ELEVENLABS_TOOLS.length,
        server: 'biosanarcall-elevenlabs'
      });
    }
    
    // Si se especifica una herramienta directa
    if (tool) {
      const toolName = tool as string;
      const args: any = {};
      
      // Mapear parámetros de query a argumentos de herramienta
      if (q) args.q = q;
      if (limit) args.limit = parseInt(limit as string);
      if (date) args.date = date;
      if (patient_id) args.patient_id = parseInt(patient_id as string);
      if (speciality) args.speciality = speciality;
      
      const result = await executeTool(toolName, args);
      return res.json({
        tool: toolName,
        result: result,
        timestamp: new Date().toISOString()
      });
    }
    
    // Respuesta por defecto - información del servidor
    res.json({
      server: 'Biosanarcall MCP ElevenLabs',
      version: '1.0.0',
      protocol: 'MCP 2024-11-05',
      status: 'ready',
      tools_available: ELEVENLABS_TOOLS.length,
      capabilities: ['initialize', 'tools/list', 'tools/call', 'ping'],
      direct_access: {
        list_tools: '?method=tools/list',
        search_patients: '?tool=searchPatients&q=Juan&limit=5',
        get_appointments: '?tool=getAppointments&date=2025-08-19',
        day_summary: '?tool=getDaySummary&date=2025-08-19'
      },
      note: 'Use POST for full MCP protocol communication',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('ElevenLabs GET error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal error',
      timestamp: new Date().toISOString()
    });
  }
});

// ElevenLabs endpoint POST - Protocolo MCP completo
router.post('/elevenlabs', authenticateApiKey, async (req, res) => {
  const request: JSONRPCRequest = req.body;
  
  try {
    switch (request.method) {
      case 'initialize':
        res.json(createSuccessResponse(request.id, {
          capabilities: { tools: true },
          serverInfo: { name: 'biosanarcall-elevenlabs', version: '1.0.0' }
        }));
        break;

      case 'tools/list':
        res.json(createSuccessResponse(request.id, { tools: ELEVENLABS_TOOLS }));
        break;

      case 'tools/call':
        const toolName = request.params?.name;
        const toolArgs = request.params?.arguments || {};
        
        if (!toolName) {
          return res.json(createErrorResponse(request.id, -32602, 'Missing tool name'));
        }

        const result = await executeTool(toolName, toolArgs);
        res.json(createSuccessResponse(request.id, {
          content: [{ type: 'text', text: result }]
        }));
        break;

      case 'ping':
        res.json(createSuccessResponse(request.id, { pong: true }));
        break;

      default:
        res.json(createErrorResponse(request.id, -32601, `Method not found: ${request.method}`));
    }
  } catch (error) {
    logger.error('ElevenLabs endpoint error:', error);
    res.json(createErrorResponse(request.id, -32000, 
      error instanceof Error ? error.message : 'Internal error'));
  }
});

// Simple MCP endpoint (6 tools)
router.post('/mcp-simple', authenticateApiKey, async (req, res) => {
  const request: JSONRPCRequest = req.body;
  
  try {
    switch (request.method) {
      case 'initialize':
        res.json(createSuccessResponse(request.id, {
          capabilities: { tools: true },
          serverInfo: { name: 'biosanarcall-mcp-simple', version: '1.0.0' }
        }));
        break;

      case 'tools/list':
        res.json(createSuccessResponse(request.id, { tools: SIMPLE_TOOLS }));
        break;

      case 'tools/call':
        const toolName = request.params?.name;
        const toolArgs = request.params?.arguments || {};
        
        if (!toolName) {
          return res.json(createErrorResponse(request.id, -32602, 'Missing tool name'));
        }

        const result = await executeTool(toolName, toolArgs);
        res.json(createSuccessResponse(request.id, {
          content: [{ type: 'text', text: result }]
        }));
        break;

      case 'ping':
        res.json(createSuccessResponse(request.id, { pong: true }));
        break;

      default:
        res.json(createErrorResponse(request.id, -32601, `Method not found: ${request.method}`));
    }
  } catch (error) {
    logger.error('Simple MCP endpoint error:', error);
    res.json(createErrorResponse(request.id, -32000, 
      error instanceof Error ? error.message : 'Internal error'));
  }
});

// MCP Inspector endpoint - Sin autenticación para testing del Inspector
router.post('/mcp-inspector', async (req, res) => {
  const request: JSONRPCRequest = req.body;
  
  logger.info('MCP Inspector request:', { method: request.method, params: request.params });
  
  try {
    switch (request.method) {
      case 'initialize':
        res.json(createSuccessResponse(request.id, {
          protocolVersion: '2024-11-05',
          capabilities: { 
            tools: { listChanged: false }
          },
          serverInfo: { 
            name: 'biosanarcall-mcp-inspector', 
            version: '1.0.0' 
          }
        }));
        break;

      case 'tools/list':
        res.json(createSuccessResponse(request.id, { tools: ELEVENLABS_TOOLS }));
        break;

      case 'tools/call':
        const toolName = request.params?.name;
        const toolArgs = request.params?.arguments || {};
        
        if (!toolName) {
          return res.json(createErrorResponse(request.id, -32602, 'Missing tool name'));
        }

        const result = await executeTool(toolName, toolArgs);
        res.json(createSuccessResponse(request.id, {
          content: [{ type: 'text', text: result }]
        }));
        break;

      case 'ping':
        res.json(createSuccessResponse(request.id, {}));
        break;

      default:
        res.json(createErrorResponse(request.id, -32601, `Method not found: ${request.method}`));
    }
  } catch (error) {
    logger.error('MCP Inspector endpoint error:', error);
    res.json(createErrorResponse(request.id, -32000, 
      error instanceof Error ? error.message : 'Internal error'));
  }
});

// Debug endpoints
router.get('/tools', (req, res) => {
  res.json({
    elevenlabs: ELEVENLABS_TOOLS,
    simple: SIMPLE_TOOLS,
    counts: {
      elevenlabs: ELEVENLABS_TOOLS.length,
      simple: SIMPLE_TOOLS.length
    }
  });
});

export default router;
