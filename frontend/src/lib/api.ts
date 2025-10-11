// Cliente API simple con fetch y manejo de token
import { logger } from './logger';
import type {
  CreatePatientData,
  UpdatePatientData,
  CreateDoctorData,
  UpdateDoctorData,
  CreateSpecialtyData,
  UpdateSpecialtyData,
  CreateLocationData,
  UpdateLocationData,
  CreateEpsData,
  UpdateEpsData,
  CreateZoneData,
  UpdateZoneData,
  CreateLocationTypeData,
  UpdateLocationTypeData,
  ApiResponse,
} from '@/types/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Verifica si un token JWT está expirado
 * @param token - JWT token string
 * @returns true si el token está expirado o inválido
 */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convertir a milisegundos
    const now = Date.now();
    const fiveMinutesFromNow = now + (5 * 60 * 1000); // 5 minutos extra de margen
    return exp <= fiveMinutesFromNow; // Considerar expirado si expira en los próximos 5 minutos
  } catch {
    return true; // Si no se puede decodificar, considerarlo expirado
  }
}

/**
 * Limpia la autenticación expirada y redirige al login
 */
function clearExpiredAuth(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

/**
 * Realiza una petición HTTP a la API con manejo automático de autenticación
 * @param path - Ruta de la API (ej: '/patients')
 * @param options - Opciones de la petición (método, body, token)
 * @returns Promesa con la respuesta parseada
 */
async function request<T>(
  path: string,
  options: { method?: Method; body?: unknown; token?: string } = {}
): Promise<T> {
  let token = options.token || localStorage.getItem('token') || undefined;
  
  // Verificar si el token está expirado antes de hacer la petición
  if (token && isTokenExpired(token)) {
    logger.warn('Token expirado detectado, limpiando autenticación');
    clearExpiredAuth();
    throw new Error('Token expirado');
  }
  
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  logger.debug(`API Request: ${options.method || 'GET'} ${API_BASE}${path}`);
  if (options.body) {
    logger.debug('Request body:', options.body);
  }
  
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  
  logger.debug(`API Response: ${res.status} ${res.statusText}`);
  
  if (!res.ok) {
    // Si hay error 401 (token expirado), limpiar localStorage y redirigir
    if (res.status === 401) {
      logger.warn('Error 401 recibido, limpiando autenticación');
      clearExpiredAuth();
    }
    
    let msg = `HTTP ${res.status}`;
    try {
      const errorData = await res.json();
      logger.debug('Error response data:', errorData);
      msg = errorData.message || errorData.error || msg;
    } catch {
      logger.debug('No se pudo parsear la respuesta de error como JSON');
    }
    throw new Error(msg);
  }
  
  const data = await res.json();
  logger.debug('API Response data:', data);
  return data;
}

export const api = {
  // Métodos genéricos
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  
  // Autenticación
  login: (email: string, password: string) => 
    request<{ token: string; user: unknown }>(`/auth/login`, { 
      method: 'POST', 
      body: { email, password } 
    }),
  
  // Pacientes v1 (legacy - mantener por compatibilidad)
  getPatients: (q?: string) => 
    request<unknown[]>(`/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createPatient: (data: CreatePatientData) => 
    request<ApiResponse<unknown>>(`/patients`, { method: 'POST', body: data }),
  updatePatient: (id: number, data: UpdatePatientData) => 
    request<ApiResponse<unknown>>(`/patients/${id}`, { method: 'PUT', body: data }),
  deletePatient: (id: number) => 
    request<void>(`/patients/${id}`, { method: 'DELETE' }),
  getPatientAppointments: (patient_id: number) => 
    request<unknown[]>(`/appointments?patient_id=${patient_id}`),
  getPatientCallLogs: (patient_id: number) => 
    request<unknown[]>(`/call-logs?patient_id=${patient_id}`),
  
  // Búsqueda rápida de pacientes con autocompletado
  quickSearchPatients: (query: string) => 
    request<{ success: boolean; data: unknown[]; total: number }>(
      `/patients/search/quicksearch?query=${encodeURIComponent(query)}`
    ),
  
  // Availabilities - opciones inteligentes
  getSmartAvailabilityOptions: (filters?: { date?: string; specialty_id?: number; location_id?: number; doctor_id?: number }) => {
    const params = new URLSearchParams();
    if (filters?.date) params.append('date', filters.date);
    if (filters?.specialty_id) params.append('specialty_id', filters.specialty_id.toString());
    if (filters?.location_id) params.append('location_id', filters.location_id.toString());
    if (filters?.doctor_id) params.append('doctor_id', filters.doctor_id.toString());
    
    const queryString = params.toString();
    return request<{ 
      success: boolean; 
      data: { 
        specialties: any[]; 
        locations: any[]; 
        doctors: any[]; 
        available_slots: any[] 
      } 
    }>(`/availabilities/smart-options${queryString ? '?' + queryString : ''}`);
  },

  // Distribución de disponibilidad por doctor
  getDistributionCalendar: (filters: { doctor_id: number; specialty_id?: number; location_id?: number; start_date?: string; end_date?: string }) => {
    const params = new URLSearchParams();
    params.append('doctor_id', filters.doctor_id.toString());
    if (filters.specialty_id) params.append('specialty_id', filters.specialty_id.toString());
    if (filters.location_id) params.append('location_id', filters.location_id.toString());
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    
    return request<{
      success: boolean;
      data: {
        available_dates: Array<{
          date: string;
          day_name: string;
          total_available_slots: number;
          time_slots: Array<{
            distribution_id: number;
            availability_id: number;
            start_time: string;
            end_time: string;
            available_slots: number;
            quota: number;
            assigned: number;
          }>;
        }>;
        grouped_by_date: any;
        total_days: number;
        total_slots: number;
      };
    }>(`/availabilities/distribution-calendar?${params.toString()}`);
  },

  // Distribución de disponibilidad simplificada para dropdown
  getDistributionDropdown: (filters: { doctor_id: number; specialty_id?: number; location_id?: number; start_date?: string; end_date?: string }) => {
    const params = new URLSearchParams();
    params.append('doctor_id', filters.doctor_id.toString());
    if (filters.specialty_id) params.append('specialty_id', filters.specialty_id.toString());
    if (filters.location_id) params.append('location_id', filters.location_id.toString());
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    
    return request<{
      success: boolean;
      data: {
        available_dates: Array<{
          date: string;
          day_name: string;
          total_available_slots: number;
          time_slots: Array<{
            distribution_id: number;
            availability_id: number;
            start_time: string;
            end_time: string;
            available_slots: number;
            quota: number;
            assigned: number;
            doctor_name: string;
            specialty_name: string;
            location_name: string;
          }>;
        }>;
        total_dates: number;
        total_slots: number;
      };
    }>(`/availabilities/distribution-dropdown?${params.toString()}`);
  },
  
  // Pacientes v2 (nuevo con campos extendidos)
  getPatientsV2: (params?: { 
    page?: number; 
    limit?: number; 
    search?: string; 
    filters?: Record<string, unknown> 
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        if (value && value !== 'all') queryParams.append(key, value.toString());
      });
    }
    const queryString = queryParams.toString();
    return request<unknown>(`/patients-v2${queryString ? `?${queryString}` : ''}`);
  },
  createPatientV2: (data: CreatePatientData) => 
    request<ApiResponse<unknown>>(`/patients-v2`, { method: 'POST', body: data }),
  getPatientV2: (id: string) => 
    request<ApiResponse<unknown>>(`/patients-v2/${id}`),
  updatePatientV2: (id: string, data: UpdatePatientData) => 
    request<ApiResponse<unknown>>(`/patients-v2/${id}`, { method: 'PUT', body: data }),
  deletePatientV2: (id: string) => 
    request<void>(`/patients-v2/${id}`, { method: 'DELETE' }),
  searchPatientsV2: (query: string) => 
    request<ApiResponse<unknown>>(`/patients-v2/search?q=${encodeURIComponent(query)}`),
  getPatientStatsV2: () => 
    request<ApiResponse<unknown>>(`/patients-v2/statistics`),
  
  // Lookups (datos de referencia)
  getAllLookups: () => request<ApiResponse<unknown>>(`/lookups/all`),
  getDocumentTypes: () => request<ApiResponse<unknown[]>>(`/lookups/document-types`),
  getBloodGroups: () => request<ApiResponse<unknown[]>>(`/lookups/blood-groups`),
  getEducationLevels: () => request<ApiResponse<unknown[]>>(`/lookups/education-levels`),
  getMaritalStatuses: () => request<ApiResponse<unknown[]>>(`/lookups/marital-statuses`),
  getPopulationGroups: () => request<ApiResponse<unknown[]>>(`/lookups/population-groups`),
  getDisabilityTypes: () => request<ApiResponse<unknown[]>>(`/lookups/disability-types`),
  getMunicipalities: () => request<ApiResponse<unknown[]>>(`/lookups/municipalities`),
  getEPS: () => request<ApiResponse<unknown[]>>(`/lookups/eps`),
  
  // Doctores
  getDoctors: () => request<unknown[]>(`/doctors`),
  getDoctorsBySpecialty: (specialtyId: number) => request<unknown[]>(`/doctors/by-specialty/${specialtyId}`),
  createDoctor: (data: CreateDoctorData) => 
    request<ApiResponse<unknown>>(`/doctors`, { method: 'POST', body: data }),
  updateDoctor: (id: number, data: UpdateDoctorData) => 
    request<ApiResponse<unknown>>(`/doctors/${id}`, { method: 'PUT', body: data }),
  deleteDoctor: (id: number) => 
    request<void>(`/doctors/${id}`, { method: 'DELETE' }),
  getDoctorSpecialties: (doctorId: number) => 
    request<unknown[]>(`/doctors/${doctorId}/specialties`),
  setDoctorSpecialties: (doctorId: number, specialty_ids: number[]) =>
    request<{ doctor_id: number; specialty_ids: number[] }>(
      `/doctors/${doctorId}/specialties`, 
      { method: 'PUT', body: { specialty_ids } }
    ),
  getDoctorLocations: (doctorId: number) => 
    request<unknown[]>(`/doctors/${doctorId}/locations`),
  setDoctorLocations: (doctorId: number, location_ids: number[]) =>
    request<{ doctor_id: number; location_ids: number[] }>(
      `/doctors/${doctorId}/locations`, 
      { method: 'PUT', body: { location_ids } }
    ),
  
  // Especialidades
  getSpecialties: () => request<unknown[]>(`/specialties`),
  createSpecialty: (data: CreateSpecialtyData) => 
    request<ApiResponse<unknown>>(`/specialties`, { method: 'POST', body: data }),
  updateSpecialty: (id: number, data: UpdateSpecialtyData) => 
    request<ApiResponse<unknown>>(`/specialties/${id}`, { method: 'PUT', body: data }),
  deleteSpecialty: (id: number) => 
    request<void>(`/specialties/${id}`, { method: 'DELETE' }),
  getSpecialtyUsage: (id: number) => 
    request<{ doctors: number; locations: number; queue: number }>(`/specialties/${id}/usage`),
  
  // Sedes
  getLocations: () => request<unknown[]>(`/locations`),
  createLocation: (data: CreateLocationData) => 
    request<ApiResponse<unknown>>(`/locations`, { method: 'POST', body: data }),
  updateLocation: (id: number, data: UpdateLocationData) => 
    request<ApiResponse<unknown>>(`/locations/${id}`, { method: 'PUT', body: data }),
  deleteLocation: (id: number) => 
    request<void>(`/locations/${id}`, { method: 'DELETE' }),
  getLocationSpecialties: (locationId: number) => 
    request<unknown[]>(`/locations/${locationId}/specialties`),
  setLocationSpecialties: (locationId: number, specialty_ids: number[]) =>
    request<{ location_id: number; specialty_ids: number[] }>(
      `/locations/${locationId}/specialties`, 
      { method: 'PUT', body: { specialty_ids } }
    ),
  getLocationMetrics: (locationId: number, month?: number, year?: number) => {
    const params = new URLSearchParams();
    if (month) params.set('month', String(month));
    if (year) params.set('year', String(year));
    const qs = params.toString();
    return request<{ 
      month: number; 
      year: number; 
      weeks: { wom: number; citas: number; capacidad: number }[]; 
      totals: unknown 
    }>(`/locations/${locationId}/metrics${qs ? `?${qs}` : ''}`);
  },
  
  // EPS
  getEps: () => request<unknown[]>(`/eps`),
  createEps: (data: CreateEpsData) => 
    request<ApiResponse<unknown>>(`/eps`, { method: 'POST', body: data }),
  updateEps: (id: number, data: UpdateEpsData) => 
    request<ApiResponse<unknown>>(`/eps/${id}`, { method: 'PUT', body: data }),
  deleteEps: (id: number) => 
    request<void>(`/eps/${id}`, { method: 'DELETE' }),
  
  // Location Types
  getLocationTypes: () => request<unknown[]>(`/location-types`),
  createLocationType: (data: CreateLocationTypeData) => 
    request<ApiResponse<unknown>>(`/location-types`, { method: 'POST', body: data }),
  updateLocationType: (id: number, data: UpdateLocationTypeData) => 
    request<ApiResponse<unknown>>(`/location-types/${id}`, { method: 'PUT', body: data }),
  deleteLocationType: (id: number) => 
    request<void>(`/location-types/${id}`, { method: 'DELETE' }),
  
  // Zonas
  getZones: () => request<unknown[]>(`/zones`),
  createZone: (data: CreateZoneData) => 
    request<ApiResponse<unknown>>(`/zones`, { method: 'POST', body: data }),
  updateZone: (id: number, data: UpdateZoneData) => 
    request<ApiResponse<unknown>>(`/zones/${id}`, { method: 'PUT', body: data }),
  deleteZone: (id: number) => 
    request<void>(`/zones/${id}`, { method: 'DELETE' }),
  
  // Municipios (gestión completa)
  getMunicipalitiesByZone: (zone_id?: number) => 
    request<unknown[]>(`/municipalities${zone_id ? `?zone_id=${zone_id}` : ''}`),
  createMunicipality: (data: unknown) => 
    request<ApiResponse<unknown>>(`/municipalities`, { method: 'POST', body: data }),
  updateMunicipality: (id: number, data: unknown) => 
    request<ApiResponse<unknown>>(`/municipalities/${id}`, { method: 'PUT', body: data }),
  deleteMunicipality: (id: number) => request<void>(`/municipalities/${id}`, { method: 'DELETE' }),
  // Disponibilidades
  /**
   * Get availabilities with optional date filtering
   */
  getAvailabilities: (params?: { date?: string; start_date?: string; end_date?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.date) searchParams.set('date', params.date);
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);
    const qs = searchParams.toString();
    return request<unknown[]>(`/availabilities${qs ? `?${qs}` : ''}`);
  },
  createAvailability: (data: unknown) => 
    request<ApiResponse<unknown>>(`/availabilities`, { method: 'POST', body: data }),
  updateAvailability: (id: number, data: unknown) => 
    request<ApiResponse<unknown>>(`/availabilities/${id}`, { method: 'PUT', body: data }),
  deleteAvailability: (id: number) => 
    request<void>(`/availabilities/${id}`, { method: 'DELETE' }),
  
  // Distribución de disponibilidades
  getAvailabilityDistribution: (availabilityId: number) => 
    request<unknown>(`/availabilities/${availabilityId}/distribution`),
  getAllDistributions: () => 
    request<unknown>(`/availabilities/distributions`),
  getDistributionsByRange: (params: { start_date?: string; end_date?: string; doctor_id?: number; specialty_id?: number; location_id?: number }) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value.toString());
      }
    });
    const queryString = queryParams.toString();
    return request<unknown>(`/availabilities/distributions/range${queryString ? `?${queryString}` : ''}`);
  },
  getDistributionStats: () => 
    request<unknown>(`/availabilities/distributions/stats`),
  updateDistributionAssigned: (distributionId: number, assigned: number) => 
    request<ApiResponse<unknown>>(`/availabilities/distributions/${distributionId}/assigned`, { 
      method: 'PUT', 
      body: { assigned } 
    }),
  getActiveAvailabilities: () => 
    request<unknown>(`/availabilities/active`),
  regenerateDistribution: (availabilityId: number) => 
    request<ApiResponse<unknown>>(`/availabilities/${availabilityId}/regenerate-distribution`, { 
      method: 'POST' 
    }),
  
  // Citas
  /**
   * Get appointments with optional filters
   */
  getAppointments: (params?: { status?: string; date?: string; availability_id?: number; start_date?: string; end_date?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.date) searchParams.set('date', params.date);
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);
    if (typeof params?.availability_id === 'number') searchParams.set('availability_id', String(params.availability_id));
    const qs = searchParams.toString();
    return request<unknown[]>(`/appointments${qs ? `?${qs}` : ''}`);
  },
  getAppointmentsSummary: (start: string, end: string) =>
    request<{ 
      by_day: Array<{ date: string; appointments: number; availabilities: number }> 
    }>(`/appointments/summary?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  createAppointment: (data: unknown) => 
    request<ApiResponse<unknown>>(`/appointments`, { method: 'POST', body: data }),
  updateAppointment: (id: number, data: unknown) => 
    request<ApiResponse<unknown>>(`/appointments/${id}`, { method: 'PUT', body: data }),
  checkAppointmentConflicts: (params: { 
    doctor_id?: number; 
    patient_id?: number; 
    room_id?: number; 
    scheduled_at: string; 
    duration_minutes: number; 
    exclude_id?: number 
  }) => {
    const p = new URLSearchParams();
    if (typeof params.doctor_id === 'number') p.set('doctor_id', String(params.doctor_id));
    if (typeof params.patient_id === 'number') p.set('patient_id', String(params.patient_id));
    if (typeof params.room_id === 'number') p.set('room_id', String(params.room_id));
    p.set('scheduled_at', params.scheduled_at);
    p.set('duration_minutes', String(params.duration_minutes));
    if (typeof params.exclude_id === 'number') p.set('exclude_id', String(params.exclude_id));
    return request<{ 
      conflict: boolean; 
      doctor_conflict?: boolean; 
      patient_conflict?: boolean; 
      room_conflict?: boolean; 
      items: Array<{ 
        id: number; 
        patient_id: number; 
        scheduled_at: string; 
        duration_minutes: number 
      }> 
    }>(`/appointments/conflicts?${p.toString()}`);
  },
  // Usuarios
  getUsers: () => request<unknown[]>(`/users`),
  createUser: (data: unknown) => 
    request<ApiResponse<unknown>>(`/users`, { method: 'POST', body: data }),
  updateUser: (id: number, data: unknown) => 
    request<ApiResponse<unknown>>(`/users/${id}`, { method: 'PUT', body: data }),
  deleteUser: (id: number) => 
    request<void>(`/users/${id}`, { method: 'DELETE' }),
  
  // Configuración del sistema
  getSettings: () => 
    request<unknown>(`/settings`),
  updateSettings: (data: unknown) => 
    request<ApiResponse<unknown>>(`/settings`, { method: 'PUT', body: data }),
  
  // Analytics
  /**
   * Get analytics overview with optional filters
   */
  getAnalyticsOverview: (params?: { range?: '7d'|'30d'|'90d'|'365d'; zone_id?: number }) => {
    const p = new URLSearchParams();
    if (params?.range) p.set('range', params.range);
    if (typeof params?.zone_id === 'number') p.set('zone_id', String(params.zone_id));
    const qs = p.toString();
    return request<{ 
      range: string; 
      totals: { 
        total_consultations: number; 
        unique_patients: number; 
        avg_duration_minutes: number | null; 
        completion_rate: number | null 
      }; 
      by_day: { date: string; consultations: number }[]; 
      by_hour: { hour: string; consultations: number }[] 
    }>(`/analytics/overview${qs ? `?${qs}` : ''}`);
  },
  getAnalyticsLocations: (params?: { range?: '7d'|'30d'|'90d'|'365d'; months?: number }) => {
    const p = new URLSearchParams();
    if (params?.range) p.set('range', params.range);
    if (typeof params?.months === 'number') p.set('months', String(params.months));
    const qs = p.toString();
    return request<{ 
      by_zone: { name: string; value: number }[]; 
      top_municipalities: { name: string; consultations: number; zone: string }[]; 
      trend_by_zone: { month: string; zone: string; consultations: number }[] 
    }>(`/analytics/locations${qs ? `?${qs}` : ''}`);
  },
  getAnalyticsSpecialties: (params?: { range?: '7d'|'30d'|'90d'|'365d' }) => {
    const p = new URLSearchParams();
    if (params?.range) p.set('range', params.range);
    const qs = p.toString();
    return request<{ 
      by_specialty: { name: string; consultations: number }[] 
    }>(`/analytics/specialties${qs ? `?${qs}` : ''}`);
  },
  // Subida de archivos (logo u otras imágenes)
  /**
   * Upload an image file to the server
   */
  uploadImage: async (file: File): Promise<{ url: string; filename: string }> => {
    const token = localStorage.getItem('token') || undefined;
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/uploads`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } as HeadersInit : undefined,
      body: form,
    });
    if (!res.ok) {
      const errorText = await res.text();
      logger.error('Image upload failed:', errorText);
      throw new Error(errorText);
    }
    return res.json();
  },
  
  // Listado estático de zonas horarias comunes (puede moverse a backend si se requiere dinámico)
  getTimezones: (): string[] => [
    'UTC',
    'America/Bogota', 'America/Lima', 'America/Guayaquil', 'America/Caracas',
    'America/Mexico_City', 'America/Panama', 'America/Santo_Domingo',
    'America/La_Paz', 'America/Santiago', 'America/Asuncion', 'America/Montevideo', 'America/Argentina/Buenos_Aires',
    'America/Chicago', 'America/New_York', 'America/Los_Angeles',
    'Atlantic/Cape_Verde', 'Atlantic/Azores',
    'Europe/London', 'Europe/Madrid', 'Europe/Berlin', 'Europe/Paris', 'Europe/Rome',
  ],
  fetchTimezones: async (): Promise<string[]> => {
    try {
      return await request<string[]>(`/timezones`);
    } catch (error) {
      logger.warn('Failed to fetch timezones from backend, using static list:', error);
      return api.getTimezones();
    }
  },
  
  // Call Statuses
  getCallStatuses: () => 
    request<unknown[]>(`/call-statuses`),
  createCallStatus: (payload: { 
    name: string; 
    color?: string | null; 
    sort_order?: number | null; 
    active?: 'active' | 'inactive' 
  }) =>
    request<ApiResponse<unknown>>(`/call-statuses`, { method: 'POST', body: payload }),
  updateCallStatus: (id: number, payload: Partial<{ 
    name: string; 
    color?: string | null; 
    sort_order?: number | null; 
    active?: 'active' | 'inactive' 
  }>) =>
    request<ApiResponse<unknown>>(`/call-statuses/${id}`, { method: 'PUT', body: payload }),
  deleteCallStatus: (id: number) => 
    request<void>(`/call-statuses/${id}`, { method: 'DELETE' }),
  
  // Call Logs
  getCallLogs: (params?: { 
    date?: string; 
    status_id?: number; 
    channel?: 'AI' | 'Manual'; 
    q?: string 
  }) => {
    const p = new URLSearchParams();
    if (params?.date) p.set('date', params.date);
    if (typeof params?.status_id === 'number') p.set('status_id', String(params.status_id));
    if (params?.channel) p.set('channel', params.channel);
    if (params?.q) p.set('q', params.q);
    const qs = p.toString();
    return request<unknown[]>(`/call-logs${qs ? `?${qs}` : ''}`);
  },
  createCallLog: (payload: { 
    patient_id?: number | null; 
    specialty_id?: number | null; 
    queue_id?: number | null; 
    user_id?: number | null; 
    channel?: 'AI' | 'Manual'; 
    outcome: 'Cita agendada' | 'No contestó' | 'Rechazó' | 'Número inválido' | 'Otro'; 
    notes?: string | null; 
    status_id?: number | null; 
  }) =>
    request<ApiResponse<unknown>>(`/call-logs`, { method: 'POST', body: payload }),
  updateCallLog: (id: number, payload: Partial<{ 
    patient_id?: number | null; 
    specialty_id?: number | null; 
    queue_id?: number | null; 
    user_id?: number | null; 
    channel?: 'AI' | 'Manual'; 
    outcome?: 'Cita agendada' | 'No contestó' | 'Rechazó' | 'Número inválido' | 'Otro'; 
    notes?: string | null; 
    status_id?: number | null; 
  }>) =>
    request<ApiResponse<unknown>>(`/call-logs/${id}`, { method: 'PUT', body: payload }),
  
  // Queue (Cola de Espera)
  getQueueOverview: () => 
    request<{ 
      waiting: number; 
      avg_wait_seconds: number; 
      avg_wait_hm?: string; 
      max_wait_seconds: number; 
      max_wait_hm?: string; 
      agents_available: number 
    }>(`/queue/overview`),
  getQueue: () => 
    request<unknown[]>(`/queue`),
  getQueueGrouped: () => 
    request<Array<{ 
      specialty_id: number; 
      specialty_name: string; 
      count: number; 
      items: Array<{ 
        id: number; 
        position: number; 
        priority: 'Alta' | 'Normal' | 'Baja'; 
        wait_seconds: number; 
        patient: { id: number; name: string; phone?: string } 
      }> 
    }>>(`/queue/grouped`),
  enqueue: (payload: { 
    patient_id: number; 
    specialty_id: number; 
    priority?: 'Alta' | 'Normal' | 'Baja'; 
    reason?: string | null; 
    phone?: string | null 
  }) =>
    request<ApiResponse<unknown>>(`/queue`, { method: 'POST', body: payload }),
  assignQueueItem: (id: number) => 
    request<ApiResponse<unknown>>(`/queue/${id}/assign`, { method: 'POST' }),
  nextInQueue: (specialty_id: number) => 
    request<ApiResponse<unknown>>(`/queue/next`, { method: 'POST', body: { specialty_id } }),
  scheduleFromQueue: (id: number, payload?: { 
    outcome?: 'Cita agendada' | 'No contestó' | 'Rechazó' | 'Número inválido' | 'Otro'; 
    notes?: string | null 
  }) =>
    request<ApiResponse<unknown>>(`/queue/${id}/schedule`, { 
      method: 'POST', 
      body: payload || { outcome: 'Cita agendada' } 
    }),
  cancelQueueItem: (id: number) => 
    request<void>(`/queue/${id}`, { method: 'DELETE' }),
  
  // Transfers (IA -> agentes)
  getTransfers: (status: 'pending' | 'accepted' | 'rejected' | 'completed' = 'pending') => 
    request<unknown[]>(`/transfers?status=${status}`),
  acceptTransfer: (id: number) => 
    request<ApiResponse<unknown>>(`/transfers/${id}/accept`, { method: 'POST' }),
  rejectTransfer: (id: number, reason?: string) => 
    request<ApiResponse<unknown>>(`/transfers/${id}/reject`, { method: 'POST', body: { reason } }),
  completeTransfer: (id: number) => 
    request<ApiResponse<unknown>>(`/transfers/${id}/complete`, { method: 'POST' }),

  // ======== NUEVAS FUNCIONALIDADES MEJORADAS ========

  // Sistema de Notificaciones
  notifications: {
    // Obtener notificaciones del usuario
    getMyNotifications: (page: number = 1, limit: number = 20) => 
      request<{ success: boolean; data: unknown[]; pagination: unknown }>(`/notifications/my?page=${page}&limit=${limit}`),
    
    // Marcar notificación como leída
    markAsRead: (id: number) => 
      request<{ success: boolean }>(`/notifications/${id}/read`, { method: 'PUT' }),
    
    // Marcar todas como leídas
    markAllAsRead: () => 
      request<{ success: boolean }>(`/notifications/mark-all-read`, { method: 'PUT' }),
    
    // Crear notificación (solo admin/sistema)
    create: (data: { 
      user_id: number; 
      type: string; 
      title: string; 
      message: string; 
      user_type: 'patient' | 'doctor' | 'user' 
    }) =>
      request<{ success: boolean; data: unknown }>(`/notifications`, { method: 'POST', body: data }),
    
    // Obtener preferencias de notificación
    getPreferences: () => 
      request<{ success: boolean; data: unknown }>(`/notifications/preferences`),
    
    // Actualizar preferencias
    updatePreferences: (preferences: unknown) =>
      request<{ success: boolean }>(`/notifications/preferences`, { method: 'PUT', body: preferences }),
    
    // Obtener estadísticas (admin)
    getStats: () => 
      request<{ success: boolean; data: unknown }>(`/notifications/stats`),
  },

  // Sistema de Documentos Médicos
  documents: {
    /**
     * Upload a medical document file
     */
    upload: async (file: File, data: { 
      patient_id: number; 
      category: string; 
      description?: string 
    }): Promise<{ success: boolean; data: unknown }> => {
      const token = localStorage.getItem('token') || undefined;
      const form = new FormData();
      form.append('file', file);
      form.append('patient_id', data.patient_id.toString());
      form.append('category', data.category);
      if (data.description) form.append('description', data.description);
      
      const res = await fetch(`${API_BASE}/documents`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } as HeadersInit : undefined,
        body: form,
      });
      if (!res.ok) {
        const errorText = await res.text();
        logger.error('Document upload failed:', errorText);
        throw new Error(errorText);
      }
      return res.json();
    },
    
    // Obtener documentos de un paciente
    getPatientDocuments: (patientId: number, category?: string) => {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      const qs = params.toString();
      return request<{ success: boolean; data: unknown[] }>(`/documents/patient/${patientId}${qs ? `?${qs}` : ''}`);
    },
    
    // Descargar documento
    download: (id: number) => {
      const token = localStorage.getItem('token') || '';
      window.open(`${API_BASE}/documents/${id}/download?token=${encodeURIComponent(token)}`);
    },
    
    // Actualizar documento
    update: (id: number, data: { description?: string; category?: string }) =>
      request<{ success: boolean }>(`/documents/${id}`, { method: 'PUT', body: data }),
    
    // Eliminar documento
    delete: (id: number) =>
      request<{ success: boolean }>(`/documents/${id}`, { method: 'DELETE' }),
    
    // Obtener categorías disponibles
    getCategories: () => 
      request<{ success: boolean; data: string[] }>(`/documents/categories`),
  },

  // Sistema de Métricas y Analytics Avanzado
  metrics: {
    // Dashboard principal
    getDashboard: (period: '7d' | '30d' | '90d' | '365d' = '30d') =>
      request<{ success: boolean; data: unknown }>(`/metrics/dashboard?period=${period}`),
    
    // Métricas de pacientes
    getPatientMetrics: (period: '7d' | '30d' | '90d' | '365d' = '30d') =>
      request<{ success: boolean; data: unknown }>(`/metrics/patients?period=${period}`),
    
    // Métricas de citas
    getAppointmentMetrics: (period: '7d' | '30d' | '90d' | '365d' = '30d') =>
      request<{ success: boolean; data: unknown }>(`/metrics/appointments?period=${period}`),
    
    // Métricas de doctores
    getDoctorMetrics: (period: '7d' | '30d' | '90d' | '365d' = '30d') =>
      request<{ success: boolean; data: unknown }>(`/metrics/doctors?period=${period}`),
    
    // Métricas financieras
    getFinancialMetrics: (period: '7d' | '30d' | '90d' | '365d' = '30d') =>
      request<{ success: boolean; data: unknown }>(`/metrics/financial?period=${period}`),
    
    // Métricas del sistema
    getSystemMetrics: () =>
      request<{ success: boolean; data: unknown }>(`/metrics/system`),
    
    // Exportar métricas
    export: (type: 'pdf' | 'excel', period: '7d' | '30d' | '90d' | '365d' = '30d') => {
      const token = localStorage.getItem('token') || '';
      window.open(`${API_BASE}/metrics/export/${type}?period=${period}&token=${encodeURIComponent(token)}`);
    },
  },

  // Sistema de Auditoría
  audit: {
    // Obtener logs de auditoría (solo admin/supervisor)
    getLogs: (params?: { 
      table_name?: string; 
      record_id?: number; 
      user_id?: number; 
      page?: number; 
      limit?: number 
    }) => {
      const p = new URLSearchParams();
      if (params?.table_name) p.set('table_name', params.table_name);
      if (params?.record_id) p.set('record_id', params.record_id.toString());
      if (params?.user_id) p.set('user_id', params.user_id.toString());
      if (params?.page) p.set('page', params.page.toString());
      if (params?.limit) p.set('limit', params.limit.toString());
      const qs = p.toString();
      return request<{ success: boolean; data: unknown[]; pagination: unknown }>(`/audit${qs ? `?${qs}` : ''}`);
    },
    
    // Obtener resumen de auditoría (solo admin)
    getSummary: (days: number = 30) =>
      request<{ success: boolean; data: unknown }>(`/audit/summary?days=${days}`),
  },

  // Sistema de Sesiones
  sessions: {
    // Obtener mis sesiones
    getMySessions: () =>
      request<{ success: boolean; data: unknown[] }>(`/sessions/my-sessions`),
    
    // Terminar una sesión específica
    endSession: (sessionId: string) =>
      request<{ success: boolean; message: string }>(`/sessions/${sessionId}`, { method: 'DELETE' }),
    
    // Terminar todas mis sesiones (excepto la actual)
    endAllSessions: (excludeCurrent: boolean = true) =>
      request<{ success: boolean; message: string }>(`/sessions?exclude_current=${excludeCurrent}`, { method: 'DELETE' }),
    
    // Obtener sesiones activas (solo admin)
    getActiveSessions: () =>
      request<{ success: boolean; data: unknown[] }>(`/sessions/active`),
    
    // Forzar cierre de sesiones de un usuario (solo admin)
    forceEndUserSessions: (userId: number) =>
      request<{ success: boolean; message: string }>(`/sessions/user/${userId}`, { method: 'DELETE' }),
  },

  // Pacientes Mejorados (manteniendo compatibilidad)
  enhancedPatients: {
    // Crear paciente con auditoría y notificaciones
    create: (data: unknown) => 
      request<{ success: boolean; message: string; data: { id: number } }>(`/enhanced-patients`, { method: 'POST', body: data }),
    
    // Obtener paciente con documentos y notificaciones
    getWithDetails: (id: number) =>
      request<{ 
        success: boolean; 
        data: { 
          paciente: unknown; 
          documentos: unknown[]; 
          notificaciones: unknown[]; 
          historial_medico: unknown[] 
        } 
      }>(`/enhanced-patients/${id}`),
    
    // Actualizar con auditoría
    update: (id: number, data: unknown) =>
      request<{ success: boolean; message: string }>(`/enhanced-patients/${id}`, { method: 'PUT', body: data }),
    
    // Eliminar (soft delete) con auditoría
    delete: (id: number) =>
      request<{ success: boolean; message: string }>(`/enhanced-patients/${id}`, { method: 'DELETE' }),
    
    // Buscar con filtros avanzados
    search: (params?: {
      search?: string;
      eps_id?: number;
      municipio_id?: number;
      tipo_documento?: string;
      genero?: string;
      page?: number;
      limit?: number;
      sort_by?: string;
      sort_order?: 'ASC' | 'DESC';
    }) => {
      const p = new URLSearchParams();
      if (params?.search) p.set('search', params.search);
      if (params?.eps_id) p.set('eps_id', params.eps_id.toString());
      if (params?.municipio_id) p.set('municipio_id', params.municipio_id.toString());
      if (params?.tipo_documento) p.set('tipo_documento', params.tipo_documento);
      if (params?.genero) p.set('genero', params.genero);
      if (params?.page) p.set('page', params.page.toString());
      if (params?.limit) p.set('limit', params.limit.toString());
      if (params?.sort_by) p.set('sort_by', params.sort_by);
      if (params?.sort_order) p.set('sort_order', params.sort_order);
      const qs = p.toString();
      return request<{ success: boolean; data: unknown[]; pagination: unknown }>(`/enhanced-patients${qs ? `?${qs}` : ''}`);
    },
  },

  // Plantillas de Disponibilidad
  getAvailabilityTemplates: () => 
    request<unknown[]>(`/availability-templates`),
  createAvailabilityTemplate: (data: unknown) => 
    request<ApiResponse<unknown>>(`/availability-templates`, { method: 'POST', body: data }),
  updateAvailabilityTemplate: (id: string, data: unknown) => 
    request<ApiResponse<unknown>>(`/availability-templates/${id}`, { method: 'PUT', body: data }),
  deleteAvailabilityTemplate: (id: string) => 
    request<void>(`/availability-templates/${id}`, { method: 'DELETE' }),
  generateScheduleFromTemplate: (data: { 
    template_id: string; 
    start_date: string; 
    end_date: string 
  }) => 
    request<ApiResponse<unknown>>(`/availability-templates/generate-schedule`, { method: 'POST', body: data }),
  getTemplateAnalytics: () => 
    request<unknown>(`/availability-templates/analytics`),

  // Agenda Templates (backend: /agenda-templates)
  getAgendaTemplates: () => 
    request<{ success: boolean; data: unknown[] }>(`/agenda-templates`),
  createAgendaTemplate: (data: unknown) => 
    request<{ success: boolean; data: unknown }>(`/agenda-templates`, { method: 'POST', body: data }),
  updateAgendaTemplate: (id: number, data: unknown) => 
    request<{ success: boolean; message: string }>(`/agenda-templates/${id}`, { method: 'PUT', body: data }),
  deleteAgendaTemplate: (id: number) => 
    request<{ success: boolean; message: string }>(`/agenda-templates/${id}`, { method: 'DELETE' }),
  generateFromAgendaTemplate: (data: { 
    template_id: number; 
    start_date: string; 
    end_date: string; 
    exclude_holidays?: boolean 
  }) =>
    request<{ 
      success: boolean; 
      data: { generated_count: number; slots: unknown[] } 
    }>(`/agenda-templates/generate-bulk`, { method: 'POST', body: data }),
  duplicateAgendaTemplate: (id: number) =>
    request<{ success: boolean; data: any }>(`/agenda-templates/${id}/duplicate`, { method: 'POST' }),

  // Opciones para filtros de distribución
  getFilterOptions: () => request<{ 
    success: boolean; 
    data: { 
      doctors: Array<{ id: number; name: string }>; 
      specialties: Array<{ id: number; name: string }>; 
      locations: Array<{ id: number; name: string }> 
    } 
  }>(`/availabilities/filters/options`),

  // Cola de espera de citas
  getWaitingList: () => 
    request<{ 
      success: boolean; 
      data: Array<{
        specialty_id: number;
        specialty_name: string;
        total_waiting: number;
        patients: Array<{
          id: number;
          patient_id: number;
          patient_name: string;
          patient_phone: string;
          patient_document: string;
          scheduled_date: string;
          priority_level: string;
          created_at: string;
          reason: string;
          notes: string;
          doctor_name: string;
          location_name: string;
          appointment_date: string;
          start_time: string;
          queue_position: number;
        }>;
      }>;
      stats: {
        total_specialties: number;
        total_patients_waiting: number;
        by_priority: {
          urgente: number;
          alta: number;
          normal: number;
          baja: number;
        };
      };
    }>(`/appointments/waiting-list`),

  // Obtener cola diaria (citas del día actual)
  async getDailyQueue() {
    return this.get<{
      success: boolean;
      date: string;
      data: Array<{
        specialty_id: number;
        specialty_name: string;
        waiting_count: number;
        scheduled_count: number;
        items: Array<any>;
      }>;
      stats: {
        total_waiting: number;
        total_scheduled: number;
        total_today: number;
        by_status: {
          pending: number;
          confirmed: number;
          completed: number;
          cancelled: number;
        };
        by_priority: {
          urgente: number;
          alta: number;
          normal: number;
          baja: number;
        };
      };
    }>('/appointments/daily-queue');
  },

  // Obtener consultas telefónicas de ElevenLabs
  async getElevenLabsConsultations(params?: { page_size?: number; cursor?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
    if (params?.cursor) queryParams.append('cursor', params.cursor);
    
    return this.get<{
      success: boolean;
      agent_id: string;
      data: Array<any>;
      stats: {
        total_conversations: number;
        total_duration_minutes: number;
        by_status: {
          completed: number;
          in_progress: number;
          failed: number;
        };
      };
      pagination: {
        has_more: boolean;
        next_cursor: string | null;
      };
    }>(`/consultations/elevenlabs?${queryParams.toString()}`);
  },

  // Obtener una consulta específica
  async getElevenLabsConversation(conversationId: string) {
    return this.get<{
      success: boolean;
      data: any;
    }>(`/consultations/elevenlabs/${conversationId}`);
  },
};

export default api;
