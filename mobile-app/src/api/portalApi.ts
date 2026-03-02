import {
  Appointment,
  LocationAuthorization,
  Patient,
  PublicAvailability,
  SmsNotification,
  Specialty,
  WaitingListItem,
  WaitingListResponse,
} from '../types/portal';
import { getTodayInColombia } from '../utils/date';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://biosanarcall.site/api';
const REQUEST_TIMEOUT_MS = 15000;

export class PortalApiError extends Error {
  status?: number;
  retry_after_seconds?: number;
  masked_phone?: string;
}

function safeJsonParse(text: string): any {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      signal: controller.signal,
      ...options,
    });

    const text = await response.text();
    const data = safeJsonParse(text);

    if (!response.ok) {
      const apiError = new PortalApiError(data?.error || data?.message || `HTTP ${response.status}`);
      apiError.status = response.status;
      if (typeof data?.retry_after_seconds === 'number') {
        apiError.retry_after_seconds = data.retry_after_seconds;
      }
      if (typeof data?.masked_phone === 'string') {
        apiError.masked_phone = data.masked_phone;
      }
      throw apiError;
    }

    return data as T;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('La solicitud tardó demasiado. Verifica conexión e intenta de nuevo.');
    }

    if (error?.message) {
      throw error;
    }

    throw new Error('No se pudo conectar con el servidor.');
  } finally {
    clearTimeout(timeoutId);
  }
}

export const portalApi = {
  async requestPatientLoginOtp(document: string, phone?: string): Promise<{
    document: string;
    patient_id: number;
    masked_phone: string;
    phone: string;
    expires_in_seconds: number;
    resend_cooldown_seconds: number;
  }> {
    const normalized = document.trim().replace(/\s+/g, '').replace(/[.-]/g, '').toUpperCase();
    const response = await request<any>('/patients-v2/public/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ document: normalized, phone }),
    });

    if (!response?.success || !response?.data) {
      throw new Error(response?.error || response?.message || 'No se pudo solicitar el OTP.');
    }

    return response.data;
  },

  async verifyPatientLoginOtp(document: string, code: string): Promise<{
    document: string;
    patient_id: number;
    phone: string;
    verified: boolean;
  }> {
    const normalized = document.trim().replace(/\s+/g, '').replace(/[.-]/g, '').toUpperCase();
    const response = await request<any>('/patients-v2/public/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ document: normalized, code }),
    });

    if (!response?.success || !response?.data?.verified) {
      throw new Error(response?.error || response?.message || 'No se pudo verificar el OTP.');
    }

    return response.data;
  },

  async searchPatient(document: string): Promise<Patient | null> {
    const normalized = document.trim().replace(/\s+/g, '').replace(/[.-]/g, '').toUpperCase();
    const response = await request<any>(`/patients-v2/search?q=${encodeURIComponent(normalized)}`);
    const list = response?.patients || response?.data || [];
    return list.length > 0 ? (list[0] as Patient) : null;
  },

  async getPatientAppointments(patientId: number): Promise<{ appointments: Appointment[]; waitingList: WaitingListItem[] }> {
    const response = await request<any>(`/patients-v2/${patientId}/appointments`);
    const today = getTodayInColombia();
    const appointments = (response?.data || []).filter((a: Appointment) => a.status !== 'Cancelada' && a.scheduled_date >= today);
    const waitingList = response?.waiting_list || [];
    return { appointments, waitingList };
  },

  async getSmsNotifications(patientId: number): Promise<SmsNotification[]> {
    const response = await request<any>(`/sms/patient/${patientId}`);
    return response?.data || [];
  },

  async getUnreadCount(patientId: number): Promise<number> {
    const response = await request<any>(`/sms/patient/${patientId}/unread-count`);
    return response?.data?.unread || 0;
  },

  async markSmsRead(patientId: number): Promise<void> {
    await request(`/sms/patient/${patientId}/mark-read`, { method: 'POST' });
  },

  async updatePhone(patientId: number, document: string, phone: string): Promise<void> {
    await request('/patients-v2/public/update-phone', {
      method: 'PUT',
      body: JSON.stringify({ patientId: patientId, document, phone }),
    });
  },

  async getAuthorizedSpecialties(epsId: number): Promise<Specialty[]> {
    const response = await request<any>(`/patients-v2/public/authorized-specialties/${epsId}`);
    return response?.data || [];
  },

  async getAuthorizedLocations(epsId: number): Promise<LocationAuthorization[]> {
    const response = await request<any>(`/locations/public/eps/${epsId}`);
    return Array.isArray(response) ? response : [];
  },

  async getAvailabilitiesBySpecialty(specialtyId: number): Promise<PublicAvailability[]> {
    const response = await request<any>(`/availabilities/public?specialty_id=${specialtyId}`);
    return Array.isArray(response) ? response : [];
  },

  async addToWaitingList(patientId: number, specialtyId: number, epsId: number, reason: string): Promise<WaitingListResponse> {
    return await request<WaitingListResponse>('/patients-v2/public/add-to-waiting-list', {
      method: 'POST',
      body: JSON.stringify({ patient_id: patientId, specialty_id: specialtyId, eps_id: epsId, reason }),
    });
  },

  async scheduleAppointment(params: {
    patient_id: number;
    specialty_id: number;
    doctor_id: number;
    availability_id: number;
    reason: string;
    selected_time?: string;
  }): Promise<any> {
    return await request('/patients-v2/public/schedule-appointment', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async cancelAppointment(appointmentId: number, patientId: number, cancellationReason: string): Promise<any> {
    return await request(`/patients-v2/public/appointments/${appointmentId}/cancel`, {
      method: 'PUT',
      body: JSON.stringify({ patientId, cancellationReason }),
    });
  },

  async getAvailableSchedulesForReschedule(specialtyId: number, epsId: number): Promise<PublicAvailability[]> {
    const response = await request<any>(`/patients-v2/public/available-schedules/${specialtyId}/${epsId}`);
    return response?.data || [];
  },

  async rescheduleAppointment(params: {
    appointmentId: number;
    patientId: number;
    newAvailabilityId: number;
    reason: string;
    selected_time?: string;
  }): Promise<any> {
    const { appointmentId, ...body } = params;
    return await request(`/patients-v2/public/appointments/${appointmentId}/reschedule`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  async deleteWaitingListItem(patientId: number, waitingListId: number): Promise<any> {
    return await request(`/appointments/waiting-list/patient/${patientId}/${waitingListId}`, {
      method: 'DELETE',
    });
  },
};
