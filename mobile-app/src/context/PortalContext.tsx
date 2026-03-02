import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { portalApi } from '../api/portalApi';
import { clearPatientSession, loadPatientSession, savePatientSession } from '../storage/patientSession';
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

type ScheduleParams = {
  patient_id: number;
  specialty_id: number;
  doctor_id: number;
  availability_id: number;
  reason: string;
  selected_time?: string;
};

type RescheduleParams = {
  appointmentId: number;
  patientId: number;
  newAvailabilityId: number;
  reason: string;
  selected_time?: string;
};

type PortalContextValue = {
  loading: boolean;
  bootstrapping: boolean;
  isAuthenticated: boolean;
  patient: Patient | null;
  appointments: Appointment[];
  waitingList: WaitingListItem[];
  notifications: SmsNotification[];
  unreadCount: number;
  requestLoginOtp: (document: string, phone?: string) => Promise<{
    document: string;
    patient_id: number;
    masked_phone: string;
    phone: string;
    expires_in_seconds: number;
    resend_cooldown_seconds: number;
  }>;
  verifyLoginOtp: (document: string, code: string, remember?: boolean) => Promise<Patient>;
  login: (document: string, remember?: boolean) => Promise<Patient>;
  logout: () => void;
  refreshData: () => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  updatePhone: (digits10: string) => Promise<void>;
  cancelAppointment: (appointmentId: number, cancellationReason: string) => Promise<any>;
  rescheduleAppointment: (params: RescheduleParams) => Promise<any>;
  deleteWaitingListItem: (waitingListId: number) => Promise<any>;
  getAuthorizedSpecialties: () => Promise<Specialty[]>;
  getAuthorizedLocations: () => Promise<LocationAuthorization[]>;
  getAvailabilitiesBySpecialty: (specialtyId: number) => Promise<PublicAvailability[]>;
  getAvailableSchedulesForReschedule: (specialtyId: number) => Promise<PublicAvailability[]>;
  scheduleAppointment: (params: Omit<ScheduleParams, 'patient_id'>) => Promise<any>;
  addToWaitingList: (specialtyId: number, reason: string) => Promise<WaitingListResponse>;
};

const PortalContext = createContext<PortalContextValue | undefined>(undefined);

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [waitingList, setWaitingList] = useState<WaitingListItem[]>([]);
  const [notifications, setNotifications] = useState<SmsNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadPatientData = async (currentPatient: Patient) => {
    const [appointmentsResult, notificationsResult, unread] = await Promise.all([
      portalApi.getPatientAppointments(currentPatient.patient_id),
      portalApi.getSmsNotifications(currentPatient.patient_id),
      portalApi.getUnreadCount(currentPatient.patient_id),
    ]);

    setAppointments(appointmentsResult.appointments || []);
    setWaitingList(appointmentsResult.waitingList || []);
    setNotifications(notificationsResult || []);
    setUnreadCount(unread || 0);
  };

  const refreshData = async () => {
    if (!patient) return;
    await loadPatientData(patient);
  };

  const requestLoginOtp = async (document: string, phone?: string) => {
    setLoading(true);
    try {
      return await portalApi.requestPatientLoginOtp(document, phone);
    } finally {
      setLoading(false);
    }
  };

  const verifyLoginOtp = async (document: string, code: string, remember = false): Promise<Patient> => {
    setLoading(true);
    try {
      await portalApi.verifyPatientLoginOtp(document, code);
      return await login(document, remember);
    } finally {
      setLoading(false);
    }
  };

  const login = async (document: string, remember = false): Promise<Patient> => {
    setLoading(true);
    try {
      const found = await portalApi.searchPatient(document);
      if (!found) {
        throw new Error('No encontramos un paciente con ese documento.');
      }

      setPatient(found);
      await loadPatientData(found);
      setIsAuthenticated(true);

      if (remember) {
        await savePatientSession(found.document || document);
      } else {
        await clearPatientSession();
      }

      return found;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await clearPatientSession();
    setIsAuthenticated(false);
    setPatient(null);
    setAppointments([]);
    setWaitingList([]);
    setNotifications([]);
    setUnreadCount(0);
  };

  useEffect(() => {
    let mounted = true;

    const restoreRememberedSession = async () => {
      try {
        const stored = await loadPatientSession();
        if (!stored?.document) return;
        await login(stored.document, true);
      } catch {
        await clearPatientSession();
      } finally {
        if (mounted) {
          setBootstrapping(false);
        }
      }
    };

    restoreRememberedSession();

    return () => {
      mounted = false;
    };
  }, []);

  const markNotificationsRead = async () => {
    if (!patient) return;

    await portalApi.markSmsRead(patient.patient_id);
    const refreshed = await portalApi.getSmsNotifications(patient.patient_id);
    setNotifications(refreshed || []);
    setUnreadCount(0);
  };

  const updatePhone = async (digits10: string) => {
    if (!patient) throw new Error('Paciente no autenticado.');

    const onlyDigits = digits10.replace(/\D/g, '');
    if (onlyDigits.length !== 10) {
      throw new Error('El número debe tener 10 dígitos.');
    }

    const phone = `+57${onlyDigits}`;
    await portalApi.updatePhone(patient.patient_id, patient.document, phone);
    setPatient({ ...patient, phone });
  };

  const cancelAppointment = async (appointmentId: number, cancellationReason: string) => {
    if (!patient) throw new Error('Paciente no autenticado.');
    const result = await portalApi.cancelAppointment(appointmentId, patient.patient_id, cancellationReason);
    await refreshData();
    return result;
  };

  const rescheduleAppointment = async (params: RescheduleParams) => {
    if (!patient) throw new Error('Paciente no autenticado.');
    const result = await portalApi.rescheduleAppointment(params);
    await refreshData();
    return result;
  };

  const deleteWaitingListItem = async (waitingListId: number) => {
    if (!patient) throw new Error('Paciente no autenticado.');
    const result = await portalApi.deleteWaitingListItem(patient.patient_id, waitingListId);
    await refreshData();
    return result;
  };

  const getAuthorizedSpecialties = async () => {
    if (!patient?.insurance_eps_id) return [];
    return portalApi.getAuthorizedSpecialties(patient.insurance_eps_id);
  };

  const getAuthorizedLocations = async () => {
    if (!patient?.insurance_eps_id) return [];
    return portalApi.getAuthorizedLocations(patient.insurance_eps_id);
  };

  const getAvailabilitiesBySpecialty = async (specialtyId: number) => {
    return portalApi.getAvailabilitiesBySpecialty(specialtyId);
  };

  const getAvailableSchedulesForReschedule = async (specialtyId: number) => {
    if (!patient?.insurance_eps_id) return [];
    return portalApi.getAvailableSchedulesForReschedule(specialtyId, patient.insurance_eps_id);
  };

  const scheduleAppointment = async (params: Omit<ScheduleParams, 'patient_id'>) => {
    if (!patient) throw new Error('Paciente no autenticado.');
    const result = await portalApi.scheduleAppointment({ patient_id: patient.patient_id, ...params });
    await refreshData();
    return result;
  };

  const addToWaitingList = async (specialtyId: number, reason: string) => {
    if (!patient?.insurance_eps_id) {
      throw new Error('No se detectó EPS para lista de espera.');
    }
    const result = await portalApi.addToWaitingList(patient.patient_id, specialtyId, patient.insurance_eps_id, reason);
    await refreshData();
    return result;
  };

  const value = useMemo<PortalContextValue>(
    () => ({
      loading,
      bootstrapping,
      isAuthenticated,
      patient,
      appointments,
      waitingList,
      notifications,
      unreadCount,
      requestLoginOtp,
      verifyLoginOtp,
      login,
      logout,
      refreshData,
      markNotificationsRead,
      updatePhone,
      cancelAppointment,
      rescheduleAppointment,
      deleteWaitingListItem,
      getAuthorizedSpecialties,
      getAuthorizedLocations,
      getAvailabilitiesBySpecialty,
      getAvailableSchedulesForReschedule,
      scheduleAppointment,
      addToWaitingList,
    }),
    [
      loading,
      bootstrapping,
      isAuthenticated,
      patient,
      appointments,
      waitingList,
      notifications,
      unreadCount,
    ],
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal() {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('usePortal debe usarse dentro de PortalProvider');
  }
  return context;
}
