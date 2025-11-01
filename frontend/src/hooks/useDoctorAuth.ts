import { useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

interface Doctor {
  id: number;
  name: string;
  email: string;
  phone: string;
  license_number: string;
}

interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    doctor: Doctor;
  };
}

export function useDoctorAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login(email: string, password: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post<LoginResponse>(`${API_URL}/doctor-auth/login`, {
        email,
        password,
      });

      const { token, doctor } = response.data.data;
      
      // Guardar token y datos del doctor en localStorage
      localStorage.setItem('doctorToken', token);
      localStorage.setItem('doctor', JSON.stringify(doctor));
      localStorage.setItem('isDoctorAuthenticated', 'true');
      
      return doctor;
    } catch (e: any) {
      const errorMessage = e?.response?.data?.error || 'Error de autenticación';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    const token = localStorage.getItem('doctorToken');
    
    if (token) {
      try {
        await axios.post(`${API_URL}/doctor-auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {
        console.error('Error al cerrar sesión:', e);
      }
    }
    
    // Limpiar localStorage
    localStorage.removeItem('doctorToken');
    localStorage.removeItem('doctor');
    localStorage.removeItem('isDoctorAuthenticated');
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    const token = localStorage.getItem('doctorToken');
    
    if (!token) {
      throw new Error('No autenticado');
    }

    setLoading(true);
    setError(null);

    try {
      await axios.post(`${API_URL}/doctor-auth/change-password`, {
        currentPassword,
        newPassword,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e: any) {
      const errorMessage = e?.response?.data?.error || 'Error al cambiar la contraseña';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function getMe() {
    const token = localStorage.getItem('doctorToken');
    
    if (!token) {
      throw new Error('No autenticado');
    }

    try {
      const response = await axios.get<{ success: boolean; data: Doctor }>(
        `${API_URL}/doctor-auth/me`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      return response.data.data;
    } catch (e: any) {
      // Si el token es inválido, limpiar localStorage
      if (e?.response?.status === 401) {
        await logout();
      }
      throw e;
    }
  }

  async function getAppointments(filters?: { 
    status?: string; 
    date?: string; 
    limit?: number;
    availability_id?: number;
    include_cancelled?: 'true' | 'false';
  }) {
    const token = localStorage.getItem('doctorToken');
    
    if (!token) {
      throw new Error('No autenticado');
    }

    console.log('🔐 Token encontrado, longitud:', token.length);
    console.log('📋 Solicitando citas con filtros:', filters);

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.date) params.append('date', filters.date);
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.availability_id) params.append('availability_id', filters.availability_id.toString());
      if (filters?.include_cancelled) params.append('include_cancelled', filters.include_cancelled);

      const url = `${API_URL}/doctor-auth/appointments?${params.toString()}`;
      console.log('🌐 URL de solicitud:', url);

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Respuesta del servidor:', response.data);
      console.log('📊 Appointments recibidos:', response.data.data.appointments?.length || 0);
      
      // Retornar solo el array de appointments
      return response.data.data.appointments || [];
    } catch (e: any) {
      console.error('❌ Error en getAppointments:', e.response?.data || e.message);
      const errorMessage = e?.response?.data?.error || 'Error al obtener citas';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function getTodayAppointments() {
    const token = localStorage.getItem('doctorToken');
    
    if (!token) {
      throw new Error('No autenticado');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `${API_URL}/doctor-auth/appointments/today`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      return response.data.data;
    } catch (e: any) {
      const errorMessage = e?.response?.data?.error || 'Error al obtener citas de hoy';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function getStats() {
    const token = localStorage.getItem('doctorToken');
    
    if (!token) {
      throw new Error('No autenticado');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `${API_URL}/doctor-auth/stats`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      return response.data.data;
    } catch (e: any) {
      const errorMessage = e?.response?.data?.error || 'Error al obtener estadísticas';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  // Buscar pacientes
  async function searchPatients(query: string) {
    const token = localStorage.getItem('doctorToken');
    
    if (!token || !query || query.length < 2) {
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `${API_URL}/medical-records/patients/search?q=${encodeURIComponent(query)}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      return response.data.data || [];
    } catch (e: any) {
      const errorMessage = e?.response?.data?.error || 'Error al buscar pacientes';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  // Obtener historial completo del paciente
  async function getPatientHistory(patientId: number) {
    const token = localStorage.getItem('doctorToken');
    
    if (!token) {
      throw new Error('No autenticado');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `${API_URL}/medical-records/patients/${patientId}/history`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      return response.data.data;
    } catch (e: any) {
      const errorMessage = e?.response?.data?.error || 'Error al obtener historial';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  // Crear historia clínica
  async function createMedicalRecord(data: any) {
    const token = localStorage.getItem('doctorToken');
    
    if (!token) {
      throw new Error('No autenticado');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${API_URL}/medical-records`,
        data,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      return response.data.data;
    } catch (e: any) {
      const errorMessage = e?.response?.data?.error || 'Error al crear historia clínica';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  // Transcribir audio a texto usando Whisper
  async function transcribeAudio(audioBlob: Blob): Promise<string> {
    const token = localStorage.getItem('doctorToken');
    
    if (!token) {
      throw new Error('No autenticado');
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');

      const response = await axios.post(
        `${API_URL}/transcription/transcribe`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      return response.data.data.text || '';
    } catch (e: any) {
      const errorMessage = e?.response?.data?.error || 'Error al transcribir audio';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return { 
    login, 
    logout, 
    changePassword,
    getMe,
    getAppointments,
    getTodayAppointments,
    getStats,
    searchPatients,
    getPatientHistory,
    createMedicalRecord,
    transcribeAudio,
    loading, 
    error 
  };
}
