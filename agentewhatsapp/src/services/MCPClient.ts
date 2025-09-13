import axios, { AxiosInstance } from 'axios';
import { Logger } from '../utils/Logger';

interface MCPRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

export class MCPClient {
  private client: AxiosInstance;
  private logger: Logger;
  private baseUrl: string;
  private requestId: number = 1;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.logger = Logger.getInstance();
    
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Biosanarcall-WhatsApp-Agent/1.0.0'
      }
    });

    // Interceptor para logging
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug('MCP Request', { 
          url: config.url, 
          method: config.method,
          data: config.data 
        });
        return config;
      },
      (error) => {
        this.logger.error('MCP Request Error', { error });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug('MCP Response', { 
          status: response.status,
          data: response.data 
        });
        return response;
      },
      (error) => {
        this.logger.error('MCP Response Error', { 
          status: error.response?.status,
          data: error.response?.data,
          message: error.message 
        });
        return Promise.reject(error);
      }
    );
  }

  private async makeRequest(method: string, params?: any): Promise<any> {
    const request: MCPRequest = {
      jsonrpc: "2.0",
      id: this.requestId++,
      method: method,
      params: params
    };

    try {
      const response = await this.client.post('', request);
      const mcpResponse: MCPResponse = response.data;

      if (mcpResponse.error) {
        throw new Error(`MCP Error: ${mcpResponse.error.message} (Code: ${mcpResponse.error.code})`);
      }

      return mcpResponse.result;
    } catch (error) {
      this.logger.error(`Error en MCP request ${method}`, { error, params });
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await this.makeRequest('tools/list');
      this.logger.info('MCP Connection test successful', { 
        toolsCount: result?.tools?.length || 0 
      });
      return true;
    } catch (error) {
      this.logger.error('MCP Connection test failed', { error });
      return false;
    }
  }

  async getAvailableTools(): Promise<any[]> {
    try {
      const result = await this.makeRequest('tools/list');
      return result?.tools || [];
    } catch (error) {
      this.logger.error('Error obteniendo herramientas MCP', { error });
      return [];
    }
  }

  // === MÉTODOS DE MEMORIA ===
  async initializeMemory(sessionId: string, purpose: string = 'whatsapp_consultation'): Promise<any> {
    return this.callTool('initializeMemory', {
      session_id: sessionId,
      purpose: purpose
    });
  }

  async addToMemory(sessionId: string, type: string, content: string, field?: string, data?: any): Promise<any> {
    return this.callTool('addToMemory', {
      session_id: sessionId,
      type: type,
      content: content,
      field: field,
      data: data,
      validated: type === 'response'
    });
  }

  async getMemory(sessionId: string): Promise<any> {
    return this.callTool('getMemory', {
      session_id: sessionId
    });
  }

  async searchMemory(sessionId: string, query: string, type?: string): Promise<any> {
    return this.callTool('searchMemory', {
      session_id: sessionId,
      query: query,
      type: type
    });
  }

  async checkMemory(sessionId: string, field: string): Promise<any> {
    return this.callTool('checkMemory', {
      session_id: sessionId,
      field: field
    });
  }

  // === MÉTODOS DE PACIENTES ===
  async searchPatients(query: string, limit: number = 5): Promise<any> {
    try {
      const result = await this.callTool('searchPatients', {
        q: query,
        limit: limit
      });
      
      return JSON.parse(result?.content?.[0]?.text || '{"patients": []}');
    } catch (error) {
      this.logger.error('Error buscando pacientes', { error, query });
      return null;
    }
  }

  async getPatient(patientId: number): Promise<any> {
    try {
      const result = await this.callTool('getPatient', {
        patient_id: patientId
      });
      
      return JSON.parse(result?.content?.[0]?.text || 'null');
    } catch (error) {
      this.logger.error('Error obteniendo paciente', { error, patientId });
      return null;
    }
  }

  async createPatient(patientData: any): Promise<any> {
    return this.callTool('createPatient', patientData);
  }

  // === MÉTODOS DE CITAS ===
  async searchAvailabilities(date?: string, doctorId?: number, limit: number = 10): Promise<any> {
    try {
      const params: any = { limit };
      if (date) params.date = date;
      if (doctorId) params.doctor_id = doctorId;
      
      const result = await this.callTool('searchAvailabilities', params);
      return JSON.parse(result?.content?.[0]?.text || '[]');
    } catch (error) {
      this.logger.error('Error buscando disponibilidades', { error });
      return [];
    }
  }

  async createAppointment(appointmentData: any): Promise<any> {
    return this.callTool('createAppointment', appointmentData);
  }

  async getAppointments(patientId?: number, doctorId?: number, date?: string): Promise<any> {
    const params: any = {};
    if (patientId) params.patient_id = patientId;
    if (doctorId) params.doctor_id = doctorId;
    if (date) params.date = date;
    
    return this.callTool('getAppointments', params);
  }

  // === MÉTODOS DE MÉDICOS ===
  async getDoctors(specialtyId?: number, limit: number = 20): Promise<any> {
    try {
      const params: any = { limit };
      if (specialtyId) params.specialty_id = specialtyId;
      
      const result = await this.callTool('getDoctors', params);
      return JSON.parse(result?.content?.[0]?.text || '[]');
    } catch (error) {
      this.logger.error('Error obteniendo médicos', { error });
      return [];
    }
  }

  async getSpecialties(): Promise<any> {
    try {
      const result = await this.callTool('getSpecialties', {});
      return JSON.parse(result?.content?.[0]?.text || '[]');
    } catch (error) {
      this.logger.error('Error obteniendo especialidades', { error });
      return [];
    }
  }

  // === MÉTODOS DE INFORMACIÓN MÉDICA ===
  async getDaySummary(date?: string): Promise<any> {
    const params: any = {};
    if (date) params.date = date;
    
    return this.callTool('getDaySummary', params);
  }

  async getStats(): Promise<any> {
    try {
      const result = await this.callTool('getSystemStats', {});
      return JSON.parse(result?.content?.[0]?.text || '{}');
    } catch (error) {
      this.logger.error('Error obteniendo estadísticas', { error });
      return {};
    }
  }

  // === MÉTODO GENÉRICO PARA LLAMAR HERRAMIENTAS ===
  private async callTool(toolName: string, arguments_: any): Promise<any> {
    try {
      const result = await this.makeRequest('tools/call', {
        name: toolName,
        arguments: arguments_
      });

      this.logger.debug(`Tool ${toolName} executed successfully`, { 
        arguments: arguments_,
        resultType: typeof result
      });

      return result;
    } catch (error) {
      this.logger.error(`Error ejecutando herramienta ${toolName}`, { 
        error, 
        arguments: arguments_ 
      });
      throw error;
    }
  }

  // === MÉTODOS DE UTILIDAD ===
  async ping(): Promise<boolean> {
    try {
      await this.testConnection();
      return true;
    } catch (error) {
      return false;
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  updateBaseUrl(newUrl: string): void {
    this.baseUrl = newUrl;
    this.client.defaults.baseURL = newUrl;
    this.logger.info('MCP Base URL updated', { newUrl });
  }
}