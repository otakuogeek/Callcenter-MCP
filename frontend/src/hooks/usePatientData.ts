import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import api from "@/lib/api";

interface ScheduledPatient {
  id: string;
  patientName: string;
  patientId: string;
  phone: string;
  email: string;
  age: number;
  doctor: string;
  specialty: string;
  date: string;     // yyyy-MM-dd
  time: string;     // HH:mm
  duration: number; // minutes
  appointmentType: string;
  location: string;
  reason: string;
  status: string;
  insuranceType: string;
  notes?: string;
}

export const usePatientData = () => {
  const [items, setItems] = useState<ScheduledPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapRow = (row: any): ScheduledPatient => {
    const dt = new Date(row.scheduled_at);
    const status = row.status === 'Pendiente' ? 'Pendiente confirmación' : row.status;
    return {
      id: String(row.id),
      patientName: row.patient_name || '',
      patientId: String(row.patient_id ?? ''),
      phone: row.patient_phone || '',
      email: row.patient_email || '',
      age: 0,
      doctor: row.doctor_name || '',
      specialty: row.specialty_name || '',
      date: format(dt, 'yyyy-MM-dd'),
      time: format(dt, 'HH:mm'),
      duration: Number(row.duration_minutes || 0),
      appointmentType: row.appointment_type || '',
      location: row.location_name || '',
      reason: row.reason || '',
      status,
      insuranceType: row.insurance_type || '',
      notes: row.notes || '',
    };
  };

  const fetchAppointments = async (status?: string, date?: string) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.getAppointments(status, date);
      setItems(rows.map(mapRow));
    } catch (e: any) {
      setError(e?.message || 'Error cargando agendas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const getFilteredPatients = (searchTerm: string, specialtyFilter: string) => {
    const term = searchTerm.trim().toLowerCase();
    return items.filter(p => {
      const matchesSearch = !term ||
        p.patientName.toLowerCase().includes(term) ||
        p.doctor.toLowerCase().includes(term) ||
        p.location.toLowerCase().includes(term) ||
        p.reason.toLowerCase().includes(term);
      const matchesSpecialty = specialtyFilter === 'all' || p.specialty === specialtyFilter;
      return matchesSearch && matchesSpecialty;
    });
  };

  const getGroupedByDate = (list: ScheduledPatient[]) => {
    return list.reduce((acc, p) => {
      if (!acc[p.date]) acc[p.date] = [];
      acc[p.date].push(p);
      return acc;
    }, {} as Record<string, ScheduledPatient[]>);
  };

  const getGroupedBySpecialty = (list: ScheduledPatient[]) => {
    return list.reduce((acc, p) => {
      if (!acc[p.specialty]) acc[p.specialty] = [];
      acc[p.specialty].push(p);
      return acc;
    }, {} as Record<string, ScheduledPatient[]>);
  };

  const specialties = useMemo(() => {
    return Array.from(new Set(items.map(p => p.specialty)));
  }, [items]);

  return {
    scheduledPatients: items,
    specialties,
    getFilteredPatients,
    getGroupedBySpecialty,
    getGroupedByDate,
    loading,
    error,
    refresh: fetchAppointments,
  };
};
