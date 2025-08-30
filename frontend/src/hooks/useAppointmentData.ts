
import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { useErrorHandler } from './useErrorHandler';

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
  capacity: number;
  bookedSlots: number;
  status: 'Activa' | 'Cancelada' | 'Completa';
  notes?: string;
  createdAt: string;
}

export interface AvailabilityForm {
  locationId: string;
  specialty: string;
  doctor: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  notes: string;
}

export const useAppointmentData = () => {
  const { handleApiCall, handleError } = useErrorHandler();
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

        // Cargar disponibilidades del día por defecto
        const today = new Date().toISOString().split('T')[0];
        await loadAvailabilities(today, dMap, sMap, new Map(locList.map(l => [l.id, l.name])));
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
      startTime: r.start_time,
      endTime: r.end_time,
      capacity: r.capacity,
      bookedSlots: r.booked_slots ?? 0,
      status: (r.status === 'active' ? 'Activa' : r.status === 'cancelled' ? 'Cancelada' : r.status === 'full' ? 'Completa' : r.status) as any,
      notes: r.notes || '',
      createdAt: r.created_at,
    }));
  }, [doctorById, specialtyById, locationById]);

  const loadAvailabilities = useCallback(async (date: string, dMap = doctorById, sMap = specialtyById, lMap = locationById) => {
    try {
      const rows = await api.getAvailabilities(date);
      setAvailabilities(mapAvailabilities(rows, dMap, sMap, lMap));
    } catch {
      setAvailabilities([]);
    }
  }, [doctorById, specialtyById, locationById, mapAvailabilities]);

  const loadCalendarSummary = useCallback(async (month: number, year: number) => {
    // month: 0-11
    const startDate = new Date(Date.UTC(year, month, 1));
    const endDate = new Date(Date.UTC(year, month + 1, 0));
    const start = startDate.toISOString().slice(0, 10);
    const end = endDate.toISOString().slice(0, 10);
    try {
      const { by_day } = await api.getAppointmentsSummary(start, end);
      const map: Record<string, { appointments: number; availabilities: number }> = {};
      by_day.forEach(d => { map[d.date] = { appointments: d.appointments, availabilities: d.availabilities }; });
      setCalendarSummary(map);
    } catch {
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

  const addAvailability = async (availabilityData: AvailabilityForm) => {
    return handleApiCall(
      async () => {
        await api.createAvailability({
          location_id: Number(availabilityData.locationId),
          specialty_id: Number(availabilityData.specialty),
          doctor_id: Number(availabilityData.doctor),
          date: availabilityData.date,
          start_time: availabilityData.startTime,
          end_time: availabilityData.endTime,
          capacity: availabilityData.capacity,
          notes: availabilityData.notes,
        });
        // Recargar las disponibilidades para la fecha especificada
        await loadAvailabilities(availabilityData.date);
      },
      "Agenda creada exitosamente",
      "No se pudo crear la agenda"
    );
  };

  const updateAvailabilityStatus = async (id: number, status: 'Activa' | 'Cancelada' | 'Completa') => {
    await api.updateAvailability(id, { status });
    setAvailabilities(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  const updateAvailability = async (id: number, updates: Partial<Availability>) => {
    return handleApiCall(
      async () => {
        // Convertir el objeto de updates al formato que espera la API
        const apiUpdates: any = {};
        if (updates.date) apiUpdates.date = updates.date;
        if (updates.startTime) apiUpdates.start_time = updates.startTime;
        if (updates.endTime) apiUpdates.end_time = updates.endTime;
        if (updates.capacity) apiUpdates.capacity = updates.capacity;
        if (updates.notes !== undefined) apiUpdates.notes = updates.notes;
        if (updates.status) apiUpdates.status = updates.status;

        await api.updateAvailability(id, apiUpdates);
        
        // Actualizar el estado local
        setAvailabilities(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
        
        // Si se cambió la fecha, recargar las disponibilidades
        if (updates.date) {
          await loadAvailabilities(updates.date);
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
    addAvailability,
    updateAvailabilityStatus,
    updateAvailability
  };
};
