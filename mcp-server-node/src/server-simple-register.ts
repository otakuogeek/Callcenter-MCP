import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const app = express();

// Configuración CORS amplia para MCP Inspector y ElevenLabs
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'x-requested-with', 'X-Requested-With', 'Accept'],
  credentials: false,
  optionsSuccessStatus: 200,
  exposedHeaders: ['*']
}));

app.use(express.json({ limit: '50mb' }));

// Middleware para headers específicos de ElevenLabs y MCP
app.use((req, res, next) => {
  // Headers CORS críticos para ElevenLabs
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  
  // Headers para streaming HTTP
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Headers específicos para MCP
  res.setHeader('X-MCP-Server', 'Biosanarcall-Simple-Register');
  res.setHeader('X-MCP-Version', '1.0.0');
  res.setHeader('X-MCP-Tools-Count', '2');
  res.setHeader('X-MCP-Protocol', 'JSON-RPC-2.0');
  
  // Headers para ElevenLabs compatibility
  res.setHeader('X-ElevenLabs-Compatible', 'true');
  res.setHeader('X-Streaming-Support', 'true');
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Middleware para logging
app.use((req, res, next) => {
  if (req.path.includes('mcp')) {
    console.log(`🔍 MCP Request: ${req.method} ${req.path}`);
    console.log(`🔍 Headers:`, req.headers);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log(`🔍 Body:`, JSON.stringify(req.body, null, 2));
    }
  }
  next();
});

let pool: mysql.Pool;

// Crear pool de conexiones
try {
  pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'biosanar_user',
    password: process.env.DB_PASS || '/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU',
    database: process.env.DB_NAME || 'biosanar',
    charset: 'utf8mb4',
    timezone: '+00:00',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  console.log('✅ Pool de conexión MySQL creado exitosamente');
} catch (error) {
  console.error('❌ Error creando pool de conexión:', error);
  process.exit(1);
}

// Verificar conexión inicial
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexión inicial a la base de datos exitosa');
    connection.release();
  } catch (error) {
    console.error('❌ Error en la conexión inicial:', error);
    process.exit(1);
  }
})();

// ===================================================================
// HERRAMIENTAS MCP: CONSULTA EPS Y REGISTRO DE PACIENTES
// ===================================================================

const MCP_TOOLS = [
  {
    name: 'listActiveEPS',
    description: 'Consulta las EPS (Entidades Promotoras de Salud) activas disponibles para registro de pacientes. Retorna ID, nombre y código de cada EPS.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'registerPatientSimple',
    description: 'Registro simplificado de pacientes con datos mínimos requeridos: nombre, cédula y teléfono. La EPS es opcional y puede agregarse posteriormente.',
    inputSchema: {
      type: 'object',
      properties: {
        // Datos mínimos obligatorios
        document: { 
          type: 'string', 
          description: 'Documento de identidad (cédula)',
          minLength: 5,
          maxLength: 20
        },
        name: { 
          type: 'string', 
          description: 'Nombre completo del paciente',
          minLength: 3,
          maxLength: 150
      },
      phone: { 
        type: 'string', 
        description: 'Teléfono principal',
        minLength: 7,
        maxLength: 15
      },
      
      // Datos opcionales adicionales
      insurance_eps_id: { 
        type: 'number', 
        description: 'ID de la EPS (opcional). Use listActiveEPS para obtener IDs válidos',
        minimum: 1
      },
      email: { 
        type: 'string', 
        description: 'Correo electrónico (opcional)',
        format: 'email'
      },
      birth_date: { 
        type: 'string', 
        description: 'Fecha de nacimiento YYYY-MM-DD (opcional)',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$'
      },
      gender: { 
        type: 'string', 
        enum: ['Masculino', 'Femenino', 'Otro', 'No especificado'], 
        description: 'Género (opcional)',
        default: 'No especificado'
      },
      address: { 
        type: 'string', 
        description: 'Dirección (opcional)',
        maxLength: 200
      },
      municipality_id: { 
        type: 'number', 
        description: 'ID del municipio (opcional)'
      },
      
      // Configuraciones
      check_duplicates: { 
        type: 'boolean', 
        description: 'Verificar duplicados por documento',
        default: true
      },
      notes: { 
        type: 'string', 
        description: 'Notas adicionales (opcional)',
        maxLength: 500
      }
    },
    required: ['document', 'name', 'phone']
  }
}
];

// ===================================================================
// IMPLEMENTACIÓN: LISTAR EPS ACTIVAS
// ===================================================================

async function listActiveEPS(): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    const [rows] = await connection.execute(`
      SELECT 
        id,
        name,
        code,
        status,
        has_agreement,
        agreement_date,
        notes,
        created_at
      FROM eps 
      WHERE status = 'active'
      ORDER BY name ASC
    `);
    
    const epsList = (rows as any[]).map(eps => ({
      id: eps.id,
      name: eps.name,
      code: eps.code,
      has_agreement: eps.has_agreement === 1,
      agreement_date: eps.agreement_date,
      notes: eps.notes || '',
      created_at: eps.created_at
    }));
    
    return {
      success: true,
      count: epsList.length,
      eps_list: epsList,
      message: `Se encontraron ${epsList.length} EPS activas disponibles`,
      usage_note: 'Use el campo "id" como insurance_eps_id para registrar pacientes con registerPatientSimple (opcional)'
    };
    
  } catch (error: any) {
    console.error('Error consultando EPS:', error);
    return {
      success: false,
      error: 'Error al consultar EPS activas',
      details: error.message
    };
  } finally {
    connection.release();
  }
}

// ===================================================================
// IMPLEMENTACIÓN: REGISTRO SIMPLIFICADO DE PACIENTES
// ===================================================================

async function registerPatientSimple(args: any): Promise<any> {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // 1. Validar duplicados si se solicita
    if (args.check_duplicates !== false) {
      const [duplicates] = await connection.execute(`
        SELECT id, document, name, phone, status
        FROM patients 
        WHERE document = ? AND status = 'Activo'
        LIMIT 1
      `, [args.document]);
      
      if ((duplicates as any[]).length > 0) {
        const duplicate = (duplicates as any[])[0];
        await connection.rollback();
        return {
          success: false,
          error: 'Paciente duplicado encontrado',
          duplicate_patient: {
            id: duplicate.id,
            document: duplicate.document,
            name: duplicate.name,
            phone: duplicate.phone,
            status: duplicate.status
          },
          suggestion: 'Ya existe un paciente activo con este documento'
        };
      }
    }
    
    // 2. Verificar que la EPS existe (solo si se proporciona)
    if (args.insurance_eps_id) {
      const [epsCheck] = await connection.execute(`
        SELECT id, name FROM eps WHERE id = ? AND status = 'active'
      `, [args.insurance_eps_id]);
      
      if ((epsCheck as any[]).length === 0) {
        await connection.rollback();
        return {
          success: false,
          error: 'EPS no válida',
          suggestion: 'Verificar que el ID de EPS exista y esté activa. Use listActiveEPS para obtener IDs válidos.'
        };
      }
    }
    
    // 3. Verificar municipio si se proporciona
    if (args.municipality_id) {
      const [municipalityCheck] = await connection.execute(`
        SELECT id, name FROM municipalities WHERE id = ?
      `, [args.municipality_id]);
      
      if ((municipalityCheck as any[]).length === 0) {
        await connection.rollback();
        return {
          success: false,
          error: 'Municipio no válido',
          suggestion: 'Verificar que el ID de municipio exista'
        };
      }
    }
    
    // 4. Preparar datos para inserción
    const insertData = {
      document: args.document,
      name: args.name.trim(),
      phone: args.phone,
      insurance_eps_id: args.insurance_eps_id || null,
      email: args.email || null,
      birth_date: args.birth_date || null,
      gender: args.gender || 'No especificado',
      address: args.address ? args.address.trim() : null,
      municipality_id: args.municipality_id || null,
      notes: args.notes ? args.notes.trim() : null,
      status: 'Activo',
      created_at: new Date()
    };
    
    // 5. Insertar paciente
    const [result] = await connection.execute(`
      INSERT INTO patients (
        document, name, phone, email, birth_date, gender, 
        address, municipality_id, insurance_eps_id, 
        notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Activo', NOW())
    `, [
      insertData.document,
      insertData.name,
      insertData.phone,
      insertData.email,
      insertData.birth_date,
      insertData.gender,
      insertData.address,
      insertData.municipality_id,
      insertData.insurance_eps_id,
      insertData.notes
    ]);
    
    const patient_id = (result as any).insertId;
    
    await connection.commit();
    
    // 6. Obtener el paciente completo creado con datos relacionados
    const [patientData] = await connection.execute(`
      SELECT 
        p.id,
        p.document,
        p.name,
        p.phone,
        p.email,
        p.birth_date,
        p.gender,
        p.address,
        p.status,
        p.created_at,
        CASE 
          WHEN p.birth_date IS NOT NULL 
          THEN TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) 
          ELSE NULL 
        END as age,
        m.name as municipality_name,
        eps.name as eps_name,
        eps.code as eps_code
      FROM patients p
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      LEFT JOIN eps ON p.insurance_eps_id = eps.id
      WHERE p.id = ?
    `, [patient_id]);
    
    const patient = (patientData as any[])[0];
    
    return {
      success: true,
      message: 'Paciente registrado exitosamente',
      patient_id: patient_id,
      patient: {
        id: patient.id,
        document: patient.document,
        name: patient.name,
        phone: patient.phone,
        email: patient.email,
        birth_date: patient.birth_date,
        age: patient.age,
        gender: patient.gender,
        address: patient.address,
        municipality: patient.municipality_name,
        eps: patient.eps_name,
        eps_code: patient.eps_code,
        status: patient.status,
        created_at: patient.created_at
      },
      registration_summary: {
        total_fields_completed: Object.values(insertData).filter(v => v !== null && v !== '').length,
        required_fields_completed: 3, // document, name, phone
        optional_fields_completed: Object.values(insertData).filter(v => v !== null && v !== '').length - 3,
        eps_provided: args.insurance_eps_id ? true : false
      }
    };
    
  } catch (error: any) {
    await connection.rollback();
    console.error('Error registrando paciente:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return {
        success: false,
        error: 'Documento duplicado',
        suggestion: 'Ya existe un paciente con este documento en el sistema'
      };
    }
    
    throw new Error(`Error registrando paciente: ${error.message}`);
  } finally {
    connection.release();
  }
}

// ===================================================================
// RUTAS MCP
// ===================================================================

// Ruta de salud del servidor
app.get('/', (req, res) => {
  res.json({
    server: 'Biosanarcall MCP Simple Patient Register',
    version: '1.0.0',
    status: 'active',
    description: 'Servidor MCP simplificado para consulta de EPS y registro de pacientes',
    tools_count: 2,
    database: 'Connected to ' + process.env.DB_NAME,
    timestamp: new Date().toISOString()
  });
});

// Endpoint GET para información del servidor MCP
app.get('/mcp', (req, res) => {
  res.json({
    server: 'Biosanarcall MCP Simple Patient Register',
    version: '1.0.0',
    status: 'active',
    description: 'Servidor MCP simplificado para consulta de EPS y registro de pacientes con ElevenLabs',
    protocol: 'JSON-RPC 2.0',
    endpoint: '/mcp',
    method: 'POST',
    tools_count: 2,
    available_tools: ['listActiveEPS', 'registerPatientSimple'],
    streaming_support: true,
    elevenlabs_compatible: true,
    usage: {
      list_tools: {
        method: 'POST',
        body: {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list'
        }
      },
      call_tool: {
        method: 'POST',
        body: {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'registerPatientSimple',
            arguments: {
              document: 'string',
              name: 'string',
              phone: 'string',
              insurance_eps_id: 'number'
            }
          }
        }
      }
    },
    database: 'Connected to ' + process.env.DB_NAME,
    timestamp: new Date().toISOString()
  });
});

// Endpoint específico para ElevenLabs streaming
app.get('/mcp/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Enviar información de herramientas como evento SSE
  const data = {
    server: 'Biosanarcall MCP Simple Patient Register',
    tools: [
      {
        name: 'registerPatientSimple',
        description: 'Registro simplificado de pacientes',
        required_fields: ['document', 'name', 'phone', 'insurance_eps_id']
      }
    ],
    timestamp: new Date().toISOString()
  };
  
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  res.end();
});

// Ruta para listar herramientas disponibles
app.post('/mcp', async (req, res) => {
  try {
    const { jsonrpc, id, method, params } = req.body;
    
    // Headers adicionales para cada respuesta
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
    if (method === 'tools/list') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS
        }
      });
    }
    
    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      
      if (name === 'listActiveEPS') {
        const result = await listActiveEPS();
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          }
        });
      }
      
      if (name === 'registerPatientSimple') {
        const result = await registerPatientSimple(args);
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          }
        });
      }
      
      throw new Error(`Herramienta no reconocida: ${name}`);
    }
    
    throw new Error(`Método no reconocido: ${method}`);
    
  } catch (error: any) {
    console.error('Error en endpoint MCP:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body.id,
      error: {
        code: -32603,
        message: error.message
      }
    });
  }
});

// Ruta de diagnóstico para verificar conexión DB
app.get('/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    // Verificar conexión
    await connection.ping();
    
    // Verificar tabla patients
    const [tables] = await connection.execute(`
      SELECT COUNT(*) as count FROM patients WHERE status = 'Activo'
    `);
    
    // Verificar tabla eps
    const [eps] = await connection.execute(`
      SELECT COUNT(*) as count FROM eps WHERE status = 'active'
    `);
    
    connection.release();
    
    res.json({
      status: 'healthy',
      database: 'connected',
      active_patients: (tables as any[])[0].count,
      active_eps: (eps as any[])[0].count,
      mcp_tools_count: 1,
      elevenlabs_ready: true,
      streaming_support: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      elevenlabs_ready: false,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint específico para diagnóstico de ElevenLabs
app.get('/mcp/elevenlabs-check', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-ElevenLabs-Compatible', 'true');
  
  res.json({
    server_name: 'Biosanarcall MCP Simple Patient Register',
    elevenlabs_compatible: true,
    tools_available: 1,
    tools: [
      {
        name: 'registerPatientSimple',
        description: 'Registro de pacientes con datos mínimos',
        required_params: ['document', 'name', 'phone', 'insurance_eps_id'],
        optional_params: ['email', 'birth_date', 'gender', 'address', 'municipality_id', 'notes']
      }
    ],
    connection_test: {
      method: 'POST',
      url: 'https://biosanarcall.site/mcp/',
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      }
    },
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

// Manejar errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception thrown:', error);
  process.exit(1);
});

// Iniciar servidor
const serverPort = Number(process.env.PORT) || 8978;
app.listen(serverPort, '0.0.0.0', () => {
  console.log(`🚀 Servidor MCP Simple Patient Register iniciado en puerto ${serverPort}`);
  console.log(`📊 Base de datos: ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);
  console.log(`🔧 Endpoint principal: http://localhost:${serverPort}/mcp`);
  console.log(`💉 Endpoint health: http://localhost:${serverPort}/health`);
  console.log(`📋 Herramientas activas: listActiveEPS, registerPatientSimple`);
});

export default app;