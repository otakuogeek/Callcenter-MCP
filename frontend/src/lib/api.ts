// Cliente API simple con fetch y manejo de token
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

// Función para verificar si un token JWT está expirado
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convertir a milisegundos
    return Date.now() >= exp;
  } catch {
    return true; // Si no se puede decodificar, considerarlo expirado
  }
}

// Función para limpiar autenticación expirada
function clearExpiredAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

async function request<T>(path: string, options: { method?: Method; body?: any; token?: string } = {}): Promise<T> {
  let token = options.token || localStorage.getItem('token') || undefined;
  
  // Verificar si el token está expirado antes de hacer la petición
  if (token && isTokenExpired(token)) {
    clearExpiredAuth();
    throw new Error('Token expirado');
  }
  
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  
  if (!res.ok) {
    // Si hay error 401 (token expirado), limpiar localStorage y redirigir
    if (res.status === 401) {
      clearExpiredAuth();
    }
    
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      msg = (data && (data.message || data.error)) || msg;
    } catch {
      try { msg = await res.text(); } catch { /* ignore */ }
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) => request<{ token: string; user: any }>(`/auth/login`, { method: 'POST', body: { email, password } }),
  // Pacientes v1 (legacy)
  getPatients: (q?: string) => request<any[]>(`/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createPatient: (data: any) => request<any>(`/patients`, { method: 'POST', body: data }),
  updatePatient: (id: number, data: any) => request<any>(`/patients/${id}`, { method: 'PUT', body: data }),
  deletePatient: (id: number) => request<void>(`/patients/${id}`, { method: 'DELETE' }),
  getPatientAppointments: (patient_id: number) => request<any[]>(`/appointments?patient_id=${patient_id}`),
  getPatientCallLogs: (patient_id: number) => request<any[]>(`/call-logs?patient_id=${patient_id}`),
  
  // Pacientes v2 (nuevo con campos extendidos)
  getPatientsV2: (params?: { page?: number; limit?: number; search?: string; filters?: any }) => {
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
    return request<any>(`/patients-v2${queryString ? `?${queryString}` : ''}`);
  },
  createPatientV2: (data: any) => request<any>(`/patients-v2`, { method: 'POST', body: data }),
  getPatientV2: (id: string) => request<any>(`/patients-v2/${id}`),
  updatePatientV2: (id: string, data: any) => request<any>(`/patients-v2/${id}`, { method: 'PUT', body: data }),
  deletePatientV2: (id: string) => request<void>(`/patients-v2/${id}`, { method: 'DELETE' }),
  searchPatientsV2: (query: string) => request<any>(`/patients-v2/search?q=${encodeURIComponent(query)}`),
  getPatientStatsV2: () => request<any>(`/patients-v2/statistics`),
  
  // Lookups (datos de referencia)
  getAllLookups: () => request<any>(`/lookups/all`),
  getDocumentTypes: () => request<any>(`/lookups/document-types`),
  getBloodGroups: () => request<any>(`/lookups/blood-groups`),
  getEducationLevels: () => request<any>(`/lookups/education-levels`),
  getMaritalStatuses: () => request<any>(`/lookups/marital-statuses`),
  getPopulationGroups: () => request<any>(`/lookups/population-groups`),
  getDisabilityTypes: () => request<any>(`/lookups/disability-types`),
  getMunicipalities: () => request<any>(`/lookups/municipalities`),
  getEPS: () => request<any>(`/lookups/eps`),
  // Doctores
  getDoctors: () => request<any[]>(`/doctors`),
  createDoctor: (data: any) => request<any>(`/doctors`, { method: 'POST', body: data }),
  updateDoctor: (id: number, data: any) => request<any>(`/doctors/${id}`, { method: 'PUT', body: data }),
  deleteDoctor: (id: number) => request<void>(`/doctors/${id}`, { method: 'DELETE' }),
  getDoctorSpecialties: (doctorId: number) => request<any[]>(`/doctors/${doctorId}/specialties`),
  setDoctorSpecialties: (doctorId: number, specialty_ids: number[]) =>
    request<{ doctor_id: number; specialty_ids: number[] }>(`/doctors/${doctorId}/specialties`, { method: 'PUT', body: { specialty_ids } }),
  getDoctorLocations: (doctorId: number) => request<any[]>(`/doctors/${doctorId}/locations`),
  setDoctorLocations: (doctorId: number, location_ids: number[]) =>
    request<{ doctor_id: number; location_ids: number[] }>(`/doctors/${doctorId}/locations`, { method: 'PUT', body: { location_ids } }),
  // Especialidades
  getSpecialties: () => request<any[]>(`/specialties`),
  createSpecialty: (data: any) => request<any>(`/specialties`, { method: 'POST', body: data }),
  updateSpecialty: (id: number, data: any) => request<any>(`/specialties/${id}`, { method: 'PUT', body: data }),
  deleteSpecialty: (id: number) => request<void>(`/specialties/${id}`, { method: 'DELETE' }),
  getSpecialtyUsage: (id: number) => request<{ doctors: number; locations: number; queue: number }>(`/specialties/${id}/usage`),
  // Sedes
  getLocations: () => request<any[]>(`/locations`),
  createLocation: (data: any) => request<any>(`/locations`, { method: 'POST', body: data }),
  updateLocation: (id: number, data: any) => request<any>(`/locations/${id}`, { method: 'PUT', body: data }),
  deleteLocation: (id: number) => request<void>(`/locations/${id}`, { method: 'DELETE' }),
  getLocationSpecialties: (locationId: number) => request<any[]>(`/locations/${locationId}/specialties`),
  setLocationSpecialties: (locationId: number, specialty_ids: number[]) =>
    request<{ location_id: number; specialty_ids: number[] }>(`/locations/${locationId}/specialties`, { method: 'PUT', body: { specialty_ids } }),
  getLocationMetrics: (locationId: number, month?: number, year?: number) => {
    const params = new URLSearchParams();
    if (month) params.set('month', String(month));
    if (year) params.set('year', String(year));
    const qs = params.toString();
    return request<{ month: number; year: number; weeks: { wom: number; citas: number; capacidad: number }[]; totals: any }>(`/locations/${locationId}/metrics${qs ? `?${qs}` : ''}`);
  },
  // EPS
  getEps: () => request<any[]>(`/eps`),
  createEps: (data: any) => request<any>(`/eps`, { method: 'POST', body: data }),
  updateEps: (id: number, data: any) => request<any>(`/eps/${id}`, { method: 'PUT', body: data }),
  deleteEps: (id: number) => request<void>(`/eps/${id}`, { method: 'DELETE' }),
    // Location Types
    getLocationTypes: () => request<any[]>(`/location-types`),
    createLocationType: (data: any) => request<any>(`/location-types`, { method: 'POST', body: data }),
    updateLocationType: (id: number, data: any) => request<any>(`/location-types/${id}`, { method: 'PUT', body: data }),
    deleteLocationType: (id: number) => request<void>(`/location-types/${id}`, { method: 'DELETE' }),
  // Zonas
  getZones: () => request<any[]>(`/zones`),
  createZone: (data: any) => request<any>(`/zones`, { method: 'POST', body: data }),
  updateZone: (id: number, data: any) => request<any>(`/zones/${id}`, { method: 'PUT', body: data }),
  deleteZone: (id: number) => request<void>(`/zones/${id}`, { method: 'DELETE' }),
  // Municipios (gestión completa)
  getMunicipalitiesByZone: (zone_id?: number) => request<any[]>(`/municipalities${zone_id ? `?zone_id=${zone_id}` : ''}`),
  createMunicipality: (data: any) => request<any>(`/municipalities`, { method: 'POST', body: data }),
  updateMunicipality: (id: number, data: any) => request<any>(`/municipalities/${id}`, { method: 'PUT', body: data }),
  deleteMunicipality: (id: number) => request<void>(`/municipalities/${id}`, { method: 'DELETE' }),
  // Disponibilidades
  getAvailabilities: (date?: string) => request<any[]>(`/availabilities${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  createAvailability: (data: any) => request<any>(`/availabilities`, { method: 'POST', body: data }),
  updateAvailability: (id: number, data: any) => request<any>(`/availabilities/${id}`, { method: 'PUT', body: data }),
  deleteAvailability: (id: number) => request<void>(`/availabilities/${id}`, { method: 'DELETE' }),
  // Citas
  getAppointments: (status?: string, date?: string, availability_id?: number) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (date) params.set('date', date);
    if (typeof availability_id === 'number') params.set('availability_id', String(availability_id));
    const qs = params.toString();
    return request<any[]>(`/appointments${qs ? `?${qs}` : ''}`);
  },
  getAppointmentsSummary: (start: string, end: string) =>
    request<{ by_day: Array<{ date: string; appointments: number; availabilities: number }> }>(`/appointments/summary?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  createAppointment: (data: any) => request<any>(`/appointments`, { method: 'POST', body: data }),
  updateAppointment: (id: number, data: any) => request<any>(`/appointments/${id}`, { method: 'PUT', body: data }),
  checkAppointmentConflicts: (params: { doctor_id?: number; patient_id?: number; room_id?: number; scheduled_at: string; duration_minutes: number; exclude_id?: number }) => {
    const p = new URLSearchParams();
    if (typeof params.doctor_id === 'number') p.set('doctor_id', String(params.doctor_id));
    if (typeof params.patient_id === 'number') p.set('patient_id', String(params.patient_id));
    if (typeof params.room_id === 'number') p.set('room_id', String(params.room_id));
    p.set('scheduled_at', params.scheduled_at);
    p.set('duration_minutes', String(params.duration_minutes));
    if (typeof params.exclude_id === 'number') p.set('exclude_id', String(params.exclude_id));
    return request<{ conflict: boolean; doctor_conflict?: boolean; patient_conflict?: boolean; room_conflict?: boolean; items: Array<{ id: number; patient_id: number; scheduled_at: string; duration_minutes: number }>}>(`/appointments/conflicts?${p.toString()}`);
  },
  // Usuarios
  getUsers: () => request<any[]>(`/users`),
  createUser: (data: any) => request<any>(`/users`, { method: 'POST', body: data }),
  updateUser: (id: number, data: any) => request<any>(`/users/${id}`, { method: 'PUT', body: data }),
  deleteUser: (id: number) => request<void>(`/users/${id}`, { method: 'DELETE' }),
  // Configuración del sistema
  getSettings: () => request<any>(`/settings`),
  updateSettings: (data: any) => request<any>(`/settings`, { method: 'PUT', body: data }),
  // Analytics
  getAnalyticsOverview: (params?: { range?: '7d'|'30d'|'90d'|'365d'; zone_id?: number }) => {
    const p = new URLSearchParams();
    if (params?.range) p.set('range', params.range);
    if (typeof params?.zone_id === 'number') p.set('zone_id', String(params.zone_id));
    const qs = p.toString();
    return request<{ range: string; totals: { total_consultations: number; unique_patients: number; avg_duration_minutes: number | null; completion_rate: number | null }; by_day: { date: string; consultations: number }[]; by_hour: { hour: string; consultations: number }[] }>(`/analytics/overview${qs ? `?${qs}` : ''}`);
  },
  getAnalyticsLocations: (params?: { range?: '7d'|'30d'|'90d'|'365d'; months?: number }) => {
    const p = new URLSearchParams();
    if (params?.range) p.set('range', params.range);
    if (typeof params?.months === 'number') p.set('months', String(params.months));
    const qs = p.toString();
    return request<{ by_zone: { name: string; value: number }[]; top_municipalities: { name: string; consultations: number; zone: string }[]; trend_by_zone: { month: string; zone: string; consultations: number }[] }>(`/analytics/locations${qs ? `?${qs}` : ''}`);
  },
  getAnalyticsSpecialties: (params?: { range?: '7d'|'30d'|'90d'|'365d' }) => {
    const p = new URLSearchParams();
    if (params?.range) p.set('range', params.range);
    const qs = p.toString();
    return request<{ by_specialty: { name: string; consultations: number }[] }>(`/analytics/specialties${qs ? `?${qs}` : ''}`);
  },
  // Subida de archivos (logo u otras imágenes)
  uploadImage: async (file: File): Promise<{ url: string; filename: string }> => {
    const token = localStorage.getItem('token') || undefined;
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/uploads`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } as any : undefined,
      body: form,
    });
    if (!res.ok) throw new Error(await res.text());
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
    } catch {
      return api.getTimezones();
    }
  },
    // Call Statuses
    getCallStatuses: () => request<any[]>(`/call-statuses`),
    createCallStatus: (payload: { name: string; color?: string | null; sort_order?: number | null; active?: 'active' | 'inactive' }) =>
      request(`/call-statuses`, { method: 'POST', body: payload }),
    updateCallStatus: (id: number, payload: Partial<{ name: string; color?: string | null; sort_order?: number | null; active?: 'active' | 'inactive' }>) =>
      request(`/call-statuses/${id}`, { method: 'PUT', body: payload }),
    deleteCallStatus: (id: number) => request(`/call-statuses/${id}`, { method: 'DELETE' }),
    // Call Logs
    getCallLogs: (params?: { date?: string; status_id?: number; channel?: 'AI' | 'Manual'; q?: string }) => {
      const p = new URLSearchParams();
      if (params?.date) p.set('date', params.date);
      if (typeof params?.status_id === 'number') p.set('status_id', String(params.status_id));
      if (params?.channel) p.set('channel', params.channel);
      if (params?.q) p.set('q', params.q);
      const qs = p.toString();
      return request<any[]>(`/call-logs${qs ? `?${qs}` : ''}`);
    },
    createCallLog: (payload: { patient_id?: number | null; specialty_id?: number | null; queue_id?: number | null; user_id?: number | null; channel?: 'AI'|'Manual'; outcome: 'Cita agendada'|'No contestó'|'Rechazó'|'Número inválido'|'Otro'; notes?: string | null; status_id?: number | null; }) =>
      request(`/call-logs`, { method: 'POST', body: payload }),
    updateCallLog: (id: number, payload: Partial<{ patient_id?: number | null; specialty_id?: number | null; queue_id?: number | null; user_id?: number | null; channel?: 'AI'|'Manual'; outcome?: 'Cita agendada'|'No contestó'|'Rechazó'|'Número inválido'|'Otro'; notes?: string | null; status_id?: number | null; }>) =>
      request(`/call-logs/${id}`, { method: 'PUT', body: payload }),
  // Queue (Cola de Espera)
  getQueueOverview: () => request<{ waiting: number; avg_wait_seconds: number; avg_wait_hm?: string; max_wait_seconds: number; max_wait_hm?: string; agents_available: number }>(`/queue/overview`),
  getQueue: () => request<any[]>(`/queue`),
  getQueueGrouped: () => request<Array<{ specialty_id: number; specialty_name: string; count: number; items: Array<{ id: number; position: number; priority: 'Alta'|'Normal'|'Baja'; wait_seconds: number; patient: { id: number; name: string; phone?: string } }> }>>(`/queue/grouped`),
  enqueue: (payload: { patient_id: number; specialty_id: number; priority?: 'Alta'|'Normal'|'Baja'; reason?: string | null; phone?: string | null }) =>
    request(`/queue`, { method: 'POST', body: payload }),
  assignQueueItem: (id: number) => request(`/queue/${id}/assign`, { method: 'POST' }),
  nextInQueue: (specialty_id: number) => request(`/queue/next`, { method: 'POST', body: { specialty_id } }),
  scheduleFromQueue: (id: number, payload?: { outcome?: 'Cita agendada'|'No contestó'|'Rechazó'|'Número inválido'|'Otro'; notes?: string | null }) =>
    request(`/queue/${id}/schedule`, { method: 'POST', body: payload || { outcome: 'Cita agendada' } }),
  cancelQueueItem: (id: number) => request<void>(`/queue/${id}`, { method: 'DELETE' }),
  // Transfers (IA -> agentes)
  getTransfers: (status: 'pending'|'accepted'|'rejected'|'completed' = 'pending') => request<any[]>(`/transfers?status=${status}`),
  acceptTransfer: (id: number) => request(`/transfers/${id}/accept`, { method: 'POST' }),
  rejectTransfer: (id: number, reason?: string) => request(`/transfers/${id}/reject`, { method: 'POST', body: { reason } }),
  completeTransfer: (id: number) => request(`/transfers/${id}/complete`, { method: 'POST' }),

  // ======== NUEVAS FUNCIONALIDADES MEJORADAS ========

  // Sistema de Notificaciones
  notifications: {
    // Obtener notificaciones del usuario
    getMyNotifications: (page: number = 1, limit: number = 20) => 
      request<{ success: boolean; data: any[]; pagination: any }>(`/notifications/my?page=${page}&limit=${limit}`),
    
    // Marcar notificación como leída
    markAsRead: (id: number) => 
      request<{ success: boolean }>(`/notifications/${id}/read`, { method: 'PUT' }),
    
    // Marcar todas como leídas
    markAllAsRead: () => 
      request<{ success: boolean }>(`/notifications/mark-all-read`, { method: 'PUT' }),
    
    // Crear notificación (solo admin/sistema)
    create: (data: { user_id: number; type: string; title: string; message: string; user_type: 'patient' | 'doctor' | 'user' }) =>
      request<{ success: boolean; data: any }>(`/notifications`, { method: 'POST', body: data }),
    
    // Obtener preferencias de notificación
    getPreferences: () => 
      request<{ success: boolean; data: any }>(`/notifications/preferences`),
    
    // Actualizar preferencias
    updatePreferences: (preferences: any) =>
      request<{ success: boolean }>(`/notifications/preferences`, { method: 'PUT', body: preferences }),
    
    // Obtener estadísticas (admin)
    getStats: () => 
      request<{ success: boolean; data: any }>(`/notifications/stats`),
  },

  // Sistema de Documentos Médicos
  documents: {
    // Subir documento médico
    upload: async (file: File, data: { patient_id: number; category: string; description?: string }): Promise<{ success: boolean; data: any }> => {
      const token = localStorage.getItem('token') || undefined;
      const form = new FormData();
      form.append('file', file);
      form.append('patient_id', data.patient_id.toString());
      form.append('category', data.category);
      if (data.description) form.append('description', data.description);
      
      const res = await fetch(`${API_BASE}/documents`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } as any : undefined,
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    
    // Obtener documentos de un paciente
    getPatientDocuments: (patientId: number, category?: string) => {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      const qs = params.toString();
      return request<{ success: boolean; data: any[] }>(`/documents/patient/${patientId}${qs ? `?${qs}` : ''}`);
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
      request<{ success: boolean; data: any }>(`/metrics/dashboard?period=${period}`),
    
    // Métricas de pacientes
    getPatientMetrics: (period: '7d' | '30d' | '90d' | '365d' = '30d') =>
      request<{ success: boolean; data: any }>(`/metrics/patients?period=${period}`),
    
    // Métricas de citas
    getAppointmentMetrics: (period: '7d' | '30d' | '90d' | '365d' = '30d') =>
      request<{ success: boolean; data: any }>(`/metrics/appointments?period=${period}`),
    
    // Métricas de doctores
    getDoctorMetrics: (period: '7d' | '30d' | '90d' | '365d' = '30d') =>
      request<{ success: boolean; data: any }>(`/metrics/doctors?period=${period}`),
    
    // Métricas financieras
    getFinancialMetrics: (period: '7d' | '30d' | '90d' | '365d' = '30d') =>
      request<{ success: boolean; data: any }>(`/metrics/financial?period=${period}`),
    
    // Métricas del sistema
    getSystemMetrics: () =>
      request<{ success: boolean; data: any }>(`/metrics/system`),
    
    // Exportar métricas
    export: (type: 'pdf' | 'excel', period: '7d' | '30d' | '90d' | '365d' = '30d') => {
      const token = localStorage.getItem('token') || '';
      window.open(`${API_BASE}/metrics/export/${type}?period=${period}&token=${encodeURIComponent(token)}`);
    },
  },

  // Sistema de Auditoría
  audit: {
    // Obtener logs de auditoría (solo admin/supervisor)
    getLogs: (params?: { table_name?: string; record_id?: number; user_id?: number; page?: number; limit?: number }) => {
      const p = new URLSearchParams();
      if (params?.table_name) p.set('table_name', params.table_name);
      if (params?.record_id) p.set('record_id', params.record_id.toString());
      if (params?.user_id) p.set('user_id', params.user_id.toString());
      if (params?.page) p.set('page', params.page.toString());
      if (params?.limit) p.set('limit', params.limit.toString());
      const qs = p.toString();
      return request<{ success: boolean; data: any[]; pagination: any }>(`/audit${qs ? `?${qs}` : ''}`);
    },
    
    // Obtener resumen de auditoría (solo admin)
    getSummary: (days: number = 30) =>
      request<{ success: boolean; data: any }>(`/audit/summary?days=${days}`),
  },

  // Sistema de Sesiones
  sessions: {
    // Obtener mis sesiones
    getMySessions: () =>
      request<{ success: boolean; data: any[] }>(`/sessions/my-sessions`),
    
    // Terminar una sesión específica
    endSession: (sessionId: string) =>
      request<{ success: boolean; message: string }>(`/sessions/${sessionId}`, { method: 'DELETE' }),
    
    // Terminar todas mis sesiones (excepto la actual)
    endAllSessions: (excludeCurrent: boolean = true) =>
      request<{ success: boolean; message: string }>(`/sessions?exclude_current=${excludeCurrent}`, { method: 'DELETE' }),
    
    // Obtener sesiones activas (solo admin)
    getActiveSessions: () =>
      request<{ success: boolean; data: any[] }>(`/sessions/active`),
    
    // Forzar cierre de sesiones de un usuario (solo admin)
    forceEndUserSessions: (userId: number) =>
      request<{ success: boolean; message: string }>(`/sessions/user/${userId}`, { method: 'DELETE' }),
  },

  // Pacientes Mejorados (manteniendo compatibilidad)
  enhancedPatients: {
    // Crear paciente con auditoría y notificaciones
    create: (data: any) => 
      request<{ success: boolean; message: string; data: { id: number } }>(`/enhanced-patients`, { method: 'POST', body: data }),
    
    // Obtener paciente con documentos y notificaciones
    getWithDetails: (id: number) =>
      request<{ success: boolean; data: { paciente: any; documentos: any[]; notificaciones: any[]; historial_medico: any[] } }>(`/enhanced-patients/${id}`),
    
    // Actualizar con auditoría
    update: (id: number, data: any) =>
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
      return request<{ success: boolean; data: any[]; pagination: any }>(`/enhanced-patients${qs ? `?${qs}` : ''}`);
    },
  },
};

export default api;
