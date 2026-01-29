/**
 * MCP Client para integración con WhatsApp
 * Permite llamar las herramientas del servidor MCP desde el sistema WhatsApp
 */

import axios, { AxiosInstance } from 'axios';

interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

interface MCPResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class MCPClient {
  private client: AxiosInstance;
  private endpoint: string;

  constructor() {
    // Usar endpoint interno o externo según configuración
    this.endpoint = process.env.MCP_SERVER_URL || 'http://127.0.0.1:8977/mcp';
    
    this.client = axios.create({
      baseURL: this.endpoint,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`[MCPClient] Inicializado con endpoint: ${this.endpoint}`);
  }

  /**
   * Llama una herramienta MCP
   */
  async callTool(name: string, args: Record<string, any> = {}): Promise<MCPResponse> {
    try {
      console.log(`[MCPClient] Llamando herramienta: ${name}`, args);

      const response = await this.client.post('', {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name,
          arguments: args
        }
      });

      if (response.data.error) {
        console.error(`[MCPClient] Error en ${name}:`, response.data.error);
        return {
          success: false,
          error: response.data.error.message || 'Error en herramienta MCP'
        };
      }

      // Parsear el contenido de la respuesta
      const result = response.data.result;
      let data = result;

      // Si el resultado tiene content, extraerlo
      if (result?.content && Array.isArray(result.content)) {
        const textContent = result.content.find((c: any) => c.type === 'text');
        if (textContent?.text) {
          try {
            data = JSON.parse(textContent.text);
          } catch {
            data = textContent.text;
          }
        }
      }

      console.log(`[MCPClient] ${name} exitoso`);
      return { success: true, data };

    } catch (error: any) {
      console.error(`[MCPClient] Error llamando ${name}:`, error.message);
      return {
        success: false,
        error: error.message || 'Error de conexión con MCP'
      };
    }
  }

  /**
   * Lista las herramientas disponibles
   */
  async listTools(): Promise<string[]> {
    try {
      const response = await this.client.post('', {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/list'
      });

      if (response.data.result?.tools) {
        return response.data.result.tools.map((t: any) => t.name);
      }
      return [];
    } catch (error) {
      console.error('[MCPClient] Error listando herramientas:', error);
      return [];
    }
  }

  // =========================================================================
  // MÉTODOS DE CONVENIENCIA PARA HERRAMIENTAS ESPECÍFICAS
  // =========================================================================

  /**
   * Buscar paciente por documento
   */
  async searchPatient(document: string): Promise<MCPResponse> {
    // Normalizar documento (solo dígitos)
    const cleanDoc = document.replace(/\D/g, '');
    return this.callTool('searchPatient', { document: cleanDoc });
  }

  /**
   * Registrar paciente nuevo
   */
  async registerPatient(data: {
    document: string;
    name: string;
    phone: string;
    phone_alt?: string;
    birth_date: string;
    gender: 'Masculino' | 'Femenino' | 'Otro' | 'No especificado';
    zone_id: number;
    insurance_eps_id: number;
    notes?: string;
  }): Promise<MCPResponse> {
    return this.callTool('registerPatientSimple', {
      ...data,
      document: data.document.replace(/\D/g, '')
    });
  }

  /**
   * Listar EPS activas
   */
  async listActiveEPS(): Promise<MCPResponse> {
    return this.callTool('listActiveEPS', {});
  }

  /**
   * Listar zonas disponibles
   */
  async listZones(): Promise<MCPResponse> {
    return this.callTool('listZones', {});
  }

  /**
   * Obtener servicios por EPS
   */
  async getEPSServices(eps_id: number): Promise<MCPResponse> {
    return this.callTool('getEPSServices', { eps_id });
  }

  /**
   * Obtener citas disponibles
   */
  async getAvailableAppointments(filters?: {
    specialty_id?: number;
    location_id?: number;
    doctor_id?: number;
    limit?: number;
  }): Promise<MCPResponse> {
    return this.callTool('getAvailableAppointments', filters || {});
  }

  /**
   * Verificar cupos disponibles
   */
  async checkAvailabilityQuota(specialty_id: number, location_id: number, day_date?: string): Promise<MCPResponse> {
    const args: any = { specialty_id, location_id };
    if (day_date) args.day_date = day_date;
    return this.callTool('checkAvailabilityQuota', args);
  }

  /**
   * Agendar cita
   */
  async scheduleAppointment(data: {
    patient_id: number;
    availability_id: number;
    scheduled_date: string;
    reason: string;
    appointment_type?: 'Presencial' | 'Telemedicina';
    notes?: string;
    priority_level?: 'Baja' | 'Normal' | 'Alta' | 'Urgente';
  }): Promise<MCPResponse> {
    return this.callTool('scheduleAppointment', data);
  }

  /**
   * Agregar a lista de espera
   */
  async addToWaitingList(data: {
    patient_id: number;
    specialty_id: number;
    reason: string;
    cups_id?: number;
    priority_level?: 'Baja' | 'Normal' | 'Alta' | 'Urgente';
  }): Promise<MCPResponse> {
    return this.callTool('addToWaitingList', data);
  }

  /**
   * Obtener citas de un paciente
   */
  async getPatientAppointments(patient_id?: number, document?: string): Promise<MCPResponse> {
    const args: any = {};
    if (patient_id) args.patient_id = patient_id;
    if (document) args.document = document.replace(/\D/g, '');
    return this.callTool('getPatientAppointments', args);
  }

  /**
   * Buscar especialidades
   */
  async searchSpecialties(name?: string): Promise<MCPResponse> {
    const args: any = { active_only: true };
    if (name) args.name = name;
    return this.callTool('searchSpecialties', args);
  }

  /**
   * Buscar CUPS por código
   */
  async searchCups(code: string): Promise<MCPResponse> {
    return this.callTool('searchCups', { code });
  }

  /**
   * Buscar CUPS por nombre
   */
  async searchCupsByName(name: string): Promise<MCPResponse> {
    return this.callTool('searchCupsByName', { name });
  }

  /**
   * Actualizar teléfono de paciente
   */
  async actualizarPhone(document: string, new_phone?: string, new_phone_alt?: string): Promise<MCPResponse> {
    const args: any = { document: document.replace(/\D/g, '') };
    if (new_phone) args.new_phone = new_phone;
    if (new_phone_alt) args.new_phone_alt = new_phone_alt;
    return this.callTool('actualizarPhone', args);
  }

  /**
   * Cancelar citas vencidas de un paciente
   */
  async cancelarCitasVencidas(document: string): Promise<MCPResponse> {
    return this.callTool('cancelarCitasVencidas', {
      document: document.replace(/\D/g, ''),
      current_date: new Date().toISOString(),
      dry_run: false
    });
  }

  /**
   * Cancelar una cita específica
   */
  async cancelAppointment(appointment_id: number, reason: string): Promise<MCPResponse> {
    return this.callTool('cancelAppointment', {
      appointment_id,
      cancellation_reason: reason
    });
  }
}

// Instancia singleton
export const mcpClient = new MCPClient();
