
import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { useErrorHandler } from './useErrorHandler';
import { convertColombiaTimeToUTC, convertUTCToColombiaTime24 } from '@/utils/dateHelpers';

export interface Location {
  id: number;
  name: string;
  address: string;
  phone: string;
  type: string;
  status: string;
  capacity: number;
  currentPatients: number;
  specialties: string[];
  hours: string;
  emergencyHours: string;
}

export interface Availability {
  id: number;
  locationId: number;
  locationName: string;
  specialty: string;
  doctor: string;
  date: string;
  startTime: string;
  endTime: string;
  startTimeRaw?: string; // 🔥 Hora cruda de BD (UTC-0) sin conversión
  endTimeRaw?: string; // 🔥 Hora cruda de BD (UTC-0) sin conversión
  capacity: number;
  bookedSlots: number;
  status: 'active' | 'cancelled' | 'completed';
  isPaused?: boolean; // 🔥 NUEVO: Indica si la agenda está pausada
  notes?: string;
  createdAt: string;
  // IDs adicionales para edición
  doctor_id?: number;
  specialty_id?: number;
  location_id?: number;
}

export interface AvailabilityForm {
  locationId: string;
  specialty: string;
  doctor: string;
  date: string; // Fecha principal (para compatibilidad)
  dates?: string[]; // 🔥 NUEVO: Array de fechas para creación múltiple
  startTime: string;
  endTime: string;
  capacity: number;
  durationMinutes: number; // 🔥 Duración por agenda (independiente de especialidad)
  notes: string;
  autoPreallocate?: boolean;
  preallocationPublishDate?: string; // YYYY-MM-DD opcional
  // Nuevos campos para distribución automática
  autoDistribute?: boolean;
  distributionStartDate?: string; // YYYY-MM-DD
  distributionEndDate?: string; // YYYY-MM-DD
  excludeWeekends?: boolean;
}

export const useAppointmentData = () => {
  const { handleApiCall, handleError, handleSuccess } = useErrorHandler();
  const [locations, setLocations] = useState<Location[]>([]);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [calendarSummary, setCalendarSummary] = useState<Record<string, { appointments: number; availabilities: number }>>({});
  const [doctorById, setDoctorById] = useState<Map<number, string>>(new Map());
  const [specialtyById, setSpecialtyById] = useState<Map<number, string>>(new Map());
  const [locationById, setLocationById] = useState<Map<number, string>>(new Map());
  const [locationSpecialties, setLocationSpecialties] = useState<Map<number, { id: number; name: string }[]>>(new Map());

  const doctors = useMemo(() => Array.from(doctorById.entries()).map(([id, name]) => ({ id, name })), [doctorById]);
  const specialtiesAll = useMemo(() => Array.from(specialtyById.values()), [specialtyById]);

  useEffect(() => {
    // Cargar catálogos base en paralelo
    const loadBase = async () => {
      try {
        const [locRows, docRows, specRows] = await Promise.all([
          api.getLocations(),
          api.getDoctors(),
          api.getSpecialties(),
        ]);

        const locList: Location[] = locRows.map((r: any) => ({
          id: r.id,
          name: r.name,
          address: r.address || '',
          phone: r.phone || '',
          type: r.type,
          status: r.status === 'active' ? 'Activa' : r.status === 'inactive' ? 'Inactiva' : (r.status || 'Activa'),
          capacity: r.capacity ?? 0,
          currentPatients: 0,
          specialties: [],
          hours: r.hours || '',
          emergencyHours: r.emergency_hours || '',
        }));
        setLocations(locList);
        setLocationById(new Map(locList.map(l => [l.id, l.name])));

        const dMap = new Map<number, string>();
        (docRows || []).forEach((d: any) => dMap.set(Number(d.id), d.name || d.full_name || `Doctor ${d.id}`));
        setDoctorById(dMap);

        const sMap = new Map<number, string>();
        (specRows || []).forEach((s: any) => sMap.set(Number(s.id), s.name || `Especialidad ${s.id}`));
        setSpecialtyById(sMap);

        // No cargar disponibilidades aquí - dejar que el componente las cargue con sus parámetros
        // Esto permite que el componente controle los filtros de visualización
      } catch {
        setLocations([]);
        setAvailabilities([]);
      }
    };
    loadBase();
  }, []);

  const mapAvailabilities = useCallback((rows: any[], dMap = doctorById, sMap = specialtyById, lMap = locationById): Availability[] => {
    return rows.map((r: any) => ({
      id: r.id,
      locationId: r.location_id,
      locationName: lMap.get(Number(r.location_id)) || String(r.location_name || r.location_id),
      specialty: sMap.get(Number(r.specialty_id)) || String(r.specialty_name || r.specialty_id),
      doctor: dMap.get(Number(r.doctor_id)) || String(r.doctor_name || r.doctor_id),
      date: r.date,
      // Convertir horas de UTC-0 (BD) a UTC-5 (Colombia) para visualización
      startTime: convertUTCToColombiaTime24(r.start_time),
      endTime: convertUTCToColombiaTime24(r.end_time),
      // 🔥 Guardar horas crudas de la BD sin ninguna conversión
      startTimeRaw: r.start_time,
      endTimeRaw: r.end_time,
      capacity: r.capacity,
      bookedSlots: r.booked_slots ?? 0,
      status: r.status as any, // El backend ya devuelve: "Activa", "Cancelada", "Completa"
      isPaused: Boolean(r.is_paused), // 🔥 NUEVO: Mapear campo is_paused
      notes: r.notes || '',
      createdAt: r.created_at,
      // IDs adicionales para edición
      doctor_id: Number(r.doctor_id),
      specialty_id: Number(r.specialty_id),
      location_id: Number(r.location_id),
    }));
  }, [doctorById, specialtyById, locationById]);

  const loadAvailabilities = useCallback(async (
    params?: { 
      date?: string; 
      include_past?: boolean; 
      include_all_status?: boolean 
    }, 
    dMap = doctorById, 
    sMap = specialtyById, 
    lMap = locationById
  ) => {
    try {
      const rows = await api.getAvailabilities(params);
      setAvailabilities(mapAvailabilities(rows, dMap, sMap, lMap));
    } catch {
      setAvailabilities([]);
    }
  }, [doctorById, specialtyById, locationById, mapAvailabilities]);

  const loadCalendarSummary = useCallback(async (month?: number, year?: number) => {
    // month: 0-11, usar fecha actual si no se proporcionan parámetros
    const now = new Date();
    const targetMonth = month !== undefined ? month : now.getMonth();
    const targetYear = year !== undefined ? year : now.getFullYear();
    
    // Validar que month y year sean valores válidos
    if (isNaN(targetMonth) || isNaN(targetYear) || targetMonth < 0 || targetMonth > 11) {
      console.warn('Invalid month/year for loadCalendarSummary:', { month, year, targetMonth, targetYear });
      setCalendarSummary({});
      return;
    }
    
    try {
      const startDate = new Date(Date.UTC(targetYear, targetMonth, 1));
      const endDate = new Date(Date.UTC(targetYear, targetMonth + 1, 0));
      
      // Verificar que las fechas sean válidas
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.warn('Invalid dates created in loadCalendarSummary:', { startDate, endDate, targetYear, targetMonth });
        setCalendarSummary({});
        return;
      }
      
      const start = startDate.toISOString().slice(0, 10);
      const end = endDate.toISOString().slice(0, 10);
      
      const { by_day } = await api.getAppointmentsSummary(start, end);
      const map: Record<string, { appointments: number; availabilities: number }> = {};
      by_day.forEach(d => { map[d.date] = { appointments: d.appointments, availabilities: d.availabilities }; });
      setCalendarSummary(map);
    } catch (error) {
      console.warn('Error loading calendar summary:', error);
      setCalendarSummary({});
    }
  }, []);

  const getLocationSpecialtyOptions = (locationId: string) => {
    const id = Number(locationId);
    return locationSpecialties.get(id) || [];
  };
  const getLocationSpecialties = (locationId: string) => getLocationSpecialtyOptions(locationId).map(o => o.name);

  const fetchLocationSpecialties = async (locationId: number) => {
    try {
      const rows = await api.getLocationSpecialties(locationId);
      const opts: { id: number; name: string }[] = (rows || []).map((r: any) => ({ id: Number(r.id || r.specialty_id), name: r.name || String(r.specialty_id) }));
      setLocationSpecialties(prev => new Map(prev).set(locationId, opts));
      return opts;
    } catch {
      setLocationSpecialties(prev => new Map(prev).set(locationId, []));
      return [] as { id: number; name: string }[];
    }
  };

  const getActiveLocations = () => locations.filter(l => l.status === 'Activa');

  const getDoctorsBySpecialty = async (specialtyId: number) => {
    try {
      const doctors = await api.getDoctorsBySpecialty(specialtyId);
      return (doctors || []).map((d: any) => ({ id: d.id, name: d.name }));
    } catch (error) {
      console.error('Error fetching doctors by specialty:', error);
      return [];
    }
  };

  const addAvailability = async (availabilityData: AvailabilityForm) => {
    if (!availabilityData) {
      console.error('[addAvailability] availabilityData undefined');
      throw new Error('Formulario de disponibilidad no inicializado');
    }
    
    // 🔥 NUEVO: Validar que haya fechas (array o campo date)
    const hasDates = (availabilityData.dates && availabilityData.dates.length > 0) || availabilityData.date;
    if (!hasDates) {
      throw new Error('Debe seleccionar al menos una fecha');
    }
    
    // Validación básica defensiva para evitar TypeError silencioso
    const required: Array<keyof AvailabilityForm> = ['locationId','specialty','doctor','startTime','endTime'];
    const missing = required.filter(k => !availabilityData[k] || (typeof availabilityData[k] === 'string' && (availabilityData[k] as any).trim() === ''));
    if (missing.length) {
      console.warn('[addAvailability] Campos faltantes:', missing);
      throw new Error('Faltan campos obligatorios: ' + missing.join(', '));
    }
    if (Number.isNaN(Number(availabilityData.locationId))) {
      console.error('[addAvailability] locationId inválido:', availabilityData.locationId);
      throw new Error('Ubicación inválida');
    }
    
    try {
      // Convertir horas de UTC-5 (Colombia) a UTC-0 antes de enviar al backend
      const startTimeUTC = convertColombiaTimeToUTC(availabilityData.startTime);
      const endTimeUTC = convertColombiaTimeToUTC(availabilityData.endTime);
      
      const response = await api.createAvailability({
        location_id: Number(availabilityData.locationId),
        specialty_id: Number(availabilityData.specialty),
        doctor_id: Number(availabilityData.doctor),
        date: availabilityData.date, // Mantener por compatibilidad
        dates: availabilityData.dates, // 🔥 NUEVO: Enviar array de fechas
        start_time: startTimeUTC,
        end_time: endTimeUTC,
        capacity: availabilityData.capacity,
        duration_minutes: availabilityData.durationMinutes,
        notes: availabilityData.notes,
        auto_preallocate: availabilityData.autoPreallocate || false,
        preallocation_publish_date: availabilityData.preallocationPublishDate || undefined,
        auto_distribute: availabilityData.autoDistribute || false,
        distribution_start_date: availabilityData.distributionStartDate || undefined,
        distribution_end_date: availabilityData.distributionEndDate || undefined,
        exclude_weekends: availabilityData.excludeWeekends ?? true,
      });
      
      // 🔥 NUEVO: Recargar todas las fechas afectadas
      const datesToReload = availabilityData.dates && availabilityData.dates.length > 0 
        ? availabilityData.dates 
        : [availabilityData.date];
      
      for (const dateStr of datesToReload) {
        await loadAvailabilities({ date: dateStr });
      }
      
      // 🔥 Construir mensaje de éxito con información detallada
      const totalCreated = response.created_count || (availabilityData.dates?.length || 1);
      const doctorName = doctorById.get(Number(availabilityData.doctor)) || 'el doctor';
      const specialtyName = specialtyById.get(Number(availabilityData.specialty)) || 'la especialidad';
      const locationName = locationById.get(Number(availabilityData.locationId)) || 'la sede';
      
      // Formatear fechas y horas
      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('es-CO', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      };
      
      const dateText = totalCreated === 1 
        ? `📅 Fecha: ${formatDate(availabilityData.date || availabilityData.dates?.[0] || '')}`
        : `📅 Fechas: ${totalCreated} días seleccionados`;
      
      let successMessage = '';
      if (totalCreated === 1) {
        successMessage = `✅ Agenda creada exitosamente\n📋 Doctor: ${doctorName}\n🏥 Especialidad: ${specialtyName}\n📍 Sede: ${locationName}\n${dateText}\n⏰ Horario: ${availabilityData.startTime} - ${availabilityData.endTime}`;
      } else {
        successMessage = `✅ ${totalCreated} agendas creadas exitosamente\n📋 Doctor: ${doctorName}\n🏥 Especialidad: ${specialtyName}\n📍 Sede: ${locationName}\n${dateText}\n⏰ Horario: ${availabilityData.startTime} - ${availabilityData.endTime}`;
      }
      
      handleSuccess(successMessage);
      return response;
    } catch (error) {
      handleError(error, "No se pudo crear la(s) agenda(s)");
      return null;
    }
  };

  const updateAvailabilityStatus = async (id: number, status: 'Activa' | 'Cancelada' | 'Completa') => {
    // Mapear estado del español al inglés para el backend
    const statusMap = {
      'Activa': 'active',
      'Cancelada': 'cancelled',
      'Completa': 'completed'
    } as const;
    
    const backendStatus = statusMap[status];
    
    try {
      await api.updateAvailability(id, { status: backendStatus });
      
      // Actualizar el estado local (mantener la agenda para auditoría)
      setAvailabilities(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } catch (error: any) {
      // Si el error es por citas confirmadas, lanzar un error descriptivo
      if (error.response?.data?.error === 'confirmed_appointments_exist') {
        const confirmedCount = error.response.data.confirmedAppointments || 0;
        throw new Error(`No se puede cancelar la agenda porque hay ${confirmedCount} cita(s) confirmada(s). Por favor, cancele todas las citas confirmadas primero.`);
      }
      throw error;
    }
  };

  const updateAvailability = async (id: number, updates: Partial<Availability>) => {
    return handleApiCall(
      async () => {
        // Mapear estado del español al inglés si es necesario
        const statusMap: Record<string, string> = {
          'Activa': 'active',
          'Cancelada': 'cancelled',
          'Completa': 'completed'
        };
        
        // Convertir el objeto de updates al formato que espera la API
        const apiUpdates: any = {};
        if (updates.date) apiUpdates.date = updates.date;
        // Convertir horas de UTC-5 (Colombia) a UTC-0 antes de enviar al backend
        if (updates.startTime) apiUpdates.start_time = convertColombiaTimeToUTC(updates.startTime);
        if (updates.endTime) apiUpdates.end_time = convertColombiaTimeToUTC(updates.endTime);
        if (updates.capacity) apiUpdates.capacity = updates.capacity;
        if (updates.notes !== undefined) apiUpdates.notes = updates.notes;
        if (updates.status) {
          // Mapear el estado al formato inglés del backend
          apiUpdates.status = statusMap[updates.status] || updates.status.toLowerCase();
        }

        await api.updateAvailability(id, apiUpdates);
        
        // Actualizar el estado local
        setAvailabilities(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
        
        // Si se cambió la fecha, recargar las disponibilidades
        if (updates.date) {
          await loadAvailabilities({ date: updates.date });
        }
      },
      "Agenda actualizada exitosamente",
      "No se pudo actualizar la agenda"
    );
  };

  return {
    locations,
    availabilities,
    loadAvailabilities,
    calendarSummary,
    loadCalendarSummary,
    getLocationSpecialties,
    getLocationSpecialtyOptions,
    fetchLocationSpecialties,
    getActiveLocations,
    doctors,
    specialtiesAll,
    getDoctorsBySpecialty,
    addAvailability,
    updateAvailabilityStatus,
    updateAvailability
  };
};
