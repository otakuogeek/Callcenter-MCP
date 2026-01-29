/**
 * Cliente MCP para invocar herramientas del servidor MCP de Biosanar
 * Permite al bot de WhatsApp ejecutar las mismas funciones que usa ElevenLabs
 * 
 * Mejoras implementadas:
 * - Logging estructurado con pino
 * - Retry automático con backoff exponencial
 * - Circuit breaker para fallos consecutivos
 * - Métricas de llamadas MCP
 */

import axios from 'axios';
import pino from 'pino';

// Logger estructurado para MCP Client
const mcpLogger = pino({
  name: 'mcp-tools-client',
  level: process.env.LOG_LEVEL || 'info'
});

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://127.0.0.1:8977';
const MCP_ENDPOINT = process.env.MCP_ENDPOINT || '/mcp-unified';
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

// Circuit breaker state
let consecutiveFailures = 0;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 30000;
let circuitOpenUntil = 0;

// Métricas
interface MCPMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  retriedCalls: number;
  averageResponseTimeMs: number;
  toolCallCounts: Record<string, number>;
}

const metrics: MCPMetrics = {
  totalCalls: 0,
  successfulCalls: 0,
  failedCalls: 0,
  retriedCalls: 0,
  averageResponseTimeMs: 0,
  toolCallCounts: {}
};

interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  retried?: boolean;
  responseTimeMs?: number;
}

interface JSONRPCRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: {
    name: string;
    arguments: Record<string, any>;
  };
}

/**
 * Obtener métricas del cliente MCP
 */
export function getMCPMetrics(): MCPMetrics {
  return { ...metrics };
}

/**
 * Reset circuit breaker manualmente
 */
export function resetCircuitBreaker(): void {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
  mcpLogger.info('Circuit breaker reset manually');
}

/**
 * Invoca una herramienta del servidor MCP con retry y circuit breaker
 */
async function invokeMCPTool(toolName: string, args: Record<string, any>): Promise<MCPToolResult> {
  const startTime = Date.now();
  metrics.totalCalls++;
  metrics.toolCallCounts[toolName] = (metrics.toolCallCounts[toolName] || 0) + 1;
  
  // Verificar circuit breaker
  if (circuitOpenUntil > Date.now()) {
    mcpLogger.warn({ 
      tool: toolName, 
      circuitOpenFor: Math.round((circuitOpenUntil - Date.now()) / 1000) 
    }, 'Circuit breaker open, rejecting call');
    metrics.failedCalls++;
    return {
      success: false,
      error: 'Servicio temporalmente no disponible. Intente nuevamente en unos segundos.'
    };
  }

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      };

      if (attempt > 0) {
        metrics.retriedCalls++;
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        mcpLogger.debug({ tool: toolName, attempt, delay }, 'Retrying MCP call');
        await new Promise(r => setTimeout(r, delay));
      }

      mcpLogger.debug({ tool: toolName, args, attempt }, 'Invoking MCP tool');

      const response = await axios.post(`${MCP_SERVER_URL}${MCP_ENDPOINT}`, request, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 45000
      });

      if (response.data.error) {
        mcpLogger.error({ tool: toolName, error: response.data.error }, 'MCP tool returned error');
        throw new Error(response.data.error.message || 'Error desconocido');
      }

      // Éxito - resetear circuit breaker
      consecutiveFailures = 0;
      metrics.successfulCalls++;
      
      const responseTime = Date.now() - startTime;
      metrics.averageResponseTimeMs = Math.round(
        (metrics.averageResponseTimeMs * (metrics.successfulCalls - 1) + responseTime) / metrics.successfulCalls
      );

      // El resultado viene en response.data.result.content[0].text (JSON string)
      const result = response.data.result;
      if (result?.content?.[0]?.text) {
        try {
          const parsed = JSON.parse(result.content[0].text);
          return { 
            success: true, 
            data: parsed, 
            retried: attempt > 0,
            responseTimeMs: responseTime 
          };
        } catch {
          return { 
            success: true, 
            data: result.content[0].text,
            retried: attempt > 0,
            responseTimeMs: responseTime 
          };
        }
      }

      return { 
        success: true, 
        data: result,
        retried: attempt > 0,
        responseTimeMs: responseTime 
      };
      
    } catch (error: any) {
      lastError = error;
      
      // No reintentar si es error del cliente (4xx)
      if (error.response?.status >= 400 && error.response?.status < 500) {
        break;
      }
      
      mcpLogger.warn({ 
        tool: toolName, 
        attempt, 
        error: error.message 
      }, 'MCP call failed, may retry');
    }
  }

  // Todos los intentos fallaron
  consecutiveFailures++;
  metrics.failedCalls++;
  
  if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_RESET_MS;
    mcpLogger.error({ 
      consecutiveFailures, 
      circuitOpenFor: CIRCUIT_BREAKER_RESET_MS / 1000 
    }, 'Circuit breaker opened');
  }

  mcpLogger.error({ 
    tool: toolName, 
    error: lastError?.message 
  }, 'MCP call failed after all retries');
  
  return {
    success: false,
    error: lastError?.message || 'Error de conexión con MCP',
    responseTimeMs: Date.now() - startTime
  };
}

// ============================================================================
// HERRAMIENTAS MCP DISPONIBLES
// ============================================================================

/**
 * Buscar paciente por documento, nombre o teléfono
 */
export async function searchPatient(params: {
  document?: string;
  name?: string;
  phone?: string;
  patient_id?: number;
}): Promise<MCPToolResult> {
  // Normalizar documento (quitar caracteres no numéricos)
  if (params.document) {
    params.document = params.document.replace(/\D/g, '');
  }
  return invokeMCPTool('searchPatient', params);
}

/**
 * Registrar nuevo paciente
 */
export async function registerPatientSimple(params: {
  document: string;
  name: string;
  phone: string;
  phone_alt?: string;
  birth_date: string;
  gender: 'Masculino' | 'Femenino' | 'Otro' | 'No especificado';
  zone_id: number;
  insurance_eps_id: number;
  notes?: string;
}): Promise<MCPToolResult> {
  // Normalizar documento
  params.document = params.document.replace(/\D/g, '');
  return invokeMCPTool('registerPatientSimple', params);
}

/**
 * Listar EPS activas
 */
export async function listActiveEPS(): Promise<MCPToolResult> {
  return invokeMCPTool('listActiveEPS', {});
}

/**
 * Listar zonas disponibles
 */
export async function listZones(): Promise<MCPToolResult> {
  return invokeMCPTool('listZones', {});
}

/**
 * Obtener servicios disponibles para una EPS
 */
export async function getEPSServices(eps_id: number): Promise<MCPToolResult> {
  return invokeMCPTool('getEPSServices', { eps_id });
}

/**
 * Obtener citas de un paciente
 */
export async function getPatientAppointments(params: {
  patient_id?: number;
  document?: string;
  status?: string;
}): Promise<MCPToolResult> {
  if (params.document) {
    params.document = params.document.replace(/\D/g, '');
  }
  return invokeMCPTool('getPatientAppointments', params);
}

/**
 * Obtener disponibilidad de citas
 */
export async function getAvailableAppointments(params: {
  specialty_id?: number;
  specialty_name?: string;
  zone_id?: number;
  zone_name?: string;
  date?: string;
}): Promise<MCPToolResult> {
  return invokeMCPTool('getAvailableAppointments', params);
}

/**
 * Verificar cupos disponibles
 */
export async function checkAvailabilityQuota(params: {
  specialty_id: number;
  location_id: number;
  date?: string;
}): Promise<MCPToolResult> {
  return invokeMCPTool('checkAvailabilityQuota', params);
}

/**
 * Agendar cita
 */
export async function scheduleAppointment(params: {
  patient_id: number;
  availability_id: number;
  reason?: string;
  cups_id?: number;
  priority_level?: 'Urgente' | 'Alta' | 'Normal' | 'Baja';
  scheduled_date?: string;
}): Promise<MCPToolResult> {
  return invokeMCPTool('scheduleAppointment', params);
}

/**
 * Buscar especialidades
 */
export async function searchSpecialties(params: {
  name?: string;
  zone_id?: number;
}): Promise<MCPToolResult> {
  return invokeMCPTool('searchSpecialties', params);
}

/**
 * Buscar CUPS por código
 */
export async function searchCups(cups_code: string): Promise<MCPToolResult> {
  return invokeMCPTool('searchCups', { cups_code });
}

/**
 * Buscar CUPS por nombre
 */
export async function searchCupsByName(name: string): Promise<MCPToolResult> {
  return invokeMCPTool('searchCupsByName', { name });
}

/**
 * Agregar a lista de espera
 */
export async function addToWaitingList(params: {
  patient_id: number;
  specialty_id: number;
  location_id?: number;
  cups_id?: number;
  priority_level?: 'Urgente' | 'Alta' | 'Normal' | 'Baja';
  notes?: string;
}): Promise<MCPToolResult> {
  return invokeMCPTool('addToWaitingList', params);
}

/**
 * Cancelar citas vencidas de un paciente
 */
export async function cancelarCitasVencidas(params: {
  document: string;
  current_date: string;
  dry_run?: boolean;
}): Promise<MCPToolResult> {
  params.document = params.document.replace(/\D/g, '');
  return invokeMCPTool('cancelarCitasVencidas', params);
}

/**
 * Actualizar teléfono de paciente
 */
export async function actualizarPhone(params: {
  document: string;
  new_phone?: string;
  new_phone_alt?: string;
}): Promise<MCPToolResult> {
  params.document = params.document.replace(/\D/g, '');
  return invokeMCPTool('actualizarPhone', params);
}

/**
 * Obtener horarios específicos disponibles
 */
export async function getAvailableTimeSlots(params: {
  availability_id: number;
  day_date: string;
  limit?: number;
}): Promise<MCPToolResult> {
  return invokeMCPTool('getAvailableTimeSlots', params);
}

/**
 * Cancelar una cita existente
 */
export async function cancelAppointment(params: {
  appointment_id: number;
  cancellation_reason: string;
}): Promise<MCPToolResult> {
  return invokeMCPTool('cancelAppointment', params);
}

/**
 * Obtener solicitudes en lista de espera
 */
export async function getWaitingListAppointments(params: {
  patient_id?: number;
  doctor_id?: number;
  specialty_id?: number;
  location_id?: number;
  priority_level?: string;
  status?: string;
  limit?: number;
}): Promise<MCPToolResult> {
  return invokeMCPTool('getWaitingListAppointments', params);
}

/**
 * Procesar automáticamente lista de espera
 */
export async function reassignWaitingListAppointments(params: {
  availability_id: number;
}): Promise<MCPToolResult> {
  return invokeMCPTool('reassignWaitingListAppointments', params);
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Verifica la conexión con el servidor MCP
 */
export async function testMCPConnection(): Promise<boolean> {
  try {
    // El servidor MCP unificado tiene health en la raíz
    const response = await axios.get(`${MCP_SERVER_URL}/health`, { timeout: 5000 });
    const isHealthy = response.status === 200 && response.data?.status === 'ok';
    
    if (isHealthy) {
      consecutiveFailures = 0; // Reset circuit breaker on successful health check
    }
    
    return isHealthy;
  } catch (error: any) {
    mcpLogger.error({ error: error.message }, 'MCP health check failed');
    return false;
  }
}

/**
 * Obtiene la lista de herramientas disponibles
 */
export async function listMCPTools(): Promise<MCPToolResult> {
  try {
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/list',
      params: {}
    };

    const response = await axios.post(`${MCP_SERVER_URL}${MCP_ENDPOINT}`, request, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    return { success: true, data: { tools: response.data.result?.tools || [] } };
  } catch (error: any) {
    mcpLogger.error({ error: error.message }, 'Failed to list MCP tools');
    return { success: false, error: error.message };
  }
}

export default {
  searchPatient,
  registerPatientSimple,
  listActiveEPS,
  listZones,
  getEPSServices,
  getPatientAppointments,
  getAvailableAppointments,
  checkAvailabilityQuota,
  scheduleAppointment,
  searchSpecialties,
  searchCups,
  searchCupsByName,
  addToWaitingList,
  cancelarCitasVencidas,
  actualizarPhone,
  getAvailableTimeSlots,
  cancelAppointment,
  getWaitingListAppointments,
  reassignWaitingListAppointments,
  testMCPConnection,
  listMCPTools,
  getMCPMetrics,
  resetCircuitBreaker
};

