/**
 * Servicio API para gestión de llamadas con ElevenLabs
 */

import axios from 'axios';

const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://127.0.0.1:4000/api'
  : 'https://biosanarcall.site/api';

// Crear instancia de axios con configuración base
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token de autenticación
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token'); // Cambiar de 'authToken' a 'token'
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('isAuthenticated');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Tipos de datos
export interface CallData {
  id: number;
  conversation_id: string;
  patient_name: string;
  patient_phone: string;
  agent_name: string;
  call_type: string;
  status: 'active' | 'waiting' | 'ended';
  priority: string;
  start_time: string | null;
  end_time: string | null;
  duration: number;
  current_duration?: number;
  waiting_time?: number;
  transcript?: string | null;
  audio_url?: string | null;
  webhook_data?: any;
  webhook_data_end?: any;
  created_at: string;
  updated_at: string;
}

export interface CallStats {
  active: number;
  waiting: number;
  completed_today: number;
  total_duration: number;
  avg_duration: number;
}

export interface DashboardData {
  active: CallData[];
  waiting: CallData[];
  stats: CallStats;
}

// Respuesta de historial paginado
export interface CallHistoryResponse {
  items: CallData[];
  total: number;
  limit: number;
  offset: number;
}

// Datos para monitor simple (/calls/status)
export interface CallStatusStats {
  active_calls: number;
  completed_calls: number;
  call_started: number;
  call_ended: number;
  total: number;
  // Campos legacy (compatibilidad)
  active?: number;
  completed?: number;
}

export interface CallStatusData {
  stats: CallStatusStats;
  last_updated: string;
  active_calls: Array<{
    id: string;
    patient_name?: string;
    agent_name?: string;
    call_type?: string;
    status: string;
    priority?: string;
    started_at?: string;
    duration?: number;
    data?: any;
  }>;
  completed_calls: Array<{
    id: string;
    patient_name?: string;
    agent_name?: string;
    call_type?: string;
    status: string;
    priority?: string;
    started_at?: string;
    ended_at?: string;
    duration?: number;
    transcript?: string;
    data?: any;
  }>;
}

// Servicios API
export const callsApi = {
  // Obtener llamadas activas
  getActiveCalls: async (): Promise<CallData[]> => {
    const response = await api.get('/calls/active');
    return response.data.data;
  },

  // Obtener llamadas en espera
  getWaitingCalls: async (): Promise<CallData[]> => {
    const response = await api.get('/calls/waiting');
    return response.data.data;
  },

  // Obtener datos del dashboard completo
  getDashboardData: async (): Promise<DashboardData> => {
    const response = await api.get('/calls/dashboard');
    return response.data.data;
  },

  // Obtener estadísticas
  getCallStats: async (hours: number = 24): Promise<CallStats> => {
    const response = await api.get(`/calls/stats?hours=${hours}`);
    return response.data.data;
  },

  // Obtener historial de llamadas
  getCallHistory: async (params?: {
    status?: string;
    priority?: string;
    search?: string;
    limit?: number;
    page?: number; // se convierte a offset
  }): Promise<CallHistoryResponse> => {
    const { status, priority, search, limit = 50, page = 0 } = params || {};
    const query = new URLSearchParams();
    if (status && status !== 'all') query.set('status', status);
    if (priority && priority !== 'all') query.set('priority', priority);
    if (search && search.trim() !== '') query.set('search', search.trim());
    query.set('limit', String(limit));
    query.set('offset', String(page * limit));
    const response = await api.get(`/calls/history?${query.toString()}`);
    const data = response.data.data;
    // Compatibilidad retro (si backend antiguo devuelve array)
    if (Array.isArray(data)) {
      return { items: data, total: data.length, limit, offset: page * limit };
    }
    return data as CallHistoryResponse;
  },

  // Estado simplificado para monitor
  getCallStatus: async (): Promise<CallStatusData> => {
    const response = await api.get('/calls/status');
    return response.data.data as CallStatusData;
  },

  // Transferir llamada
  transferCall: async (callId: number, agentName: string): Promise<void> => {
    await api.post(`/calls/${callId}/transfer`, { agent_name: agentName });
  },

  // Atender llamada desde cola de espera
  attendCall: async (callId: number, agentName: string): Promise<void> => {
    await api.post(`/calls/${callId}/attend`, { agent_name: agentName });
  },

  // Poner llamada en espera
  holdCall: async (callId: number): Promise<void> => {
    await api.post(`/calls/${callId}/hold`);
  },
};

// Utilidades para formateo
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

export const getPriorityColor = (priority: string): string => {
  switch (priority.toLowerCase()) {
    case 'urgencia':
      return 'text-red-600 bg-red-100';
    case 'alta':
      return 'text-orange-600 bg-orange-100';
    case 'normal':
      return 'text-blue-600 bg-blue-100';
    case 'baja':
      return 'text-green-600 bg-green-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'active':
      return 'text-green-600 bg-green-100';
    case 'waiting':
      return 'text-yellow-600 bg-yellow-100';
    case 'ended':
      return 'text-gray-600 bg-gray-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};
