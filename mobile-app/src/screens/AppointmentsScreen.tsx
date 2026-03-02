import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { usePortal } from '../context/PortalContext';
import { Appointment, PublicAvailability, WaitingListItem } from '../types/portal';
import { convertUTCToColombiaTime, formatDateLabel, formatTimeTo12h } from '../utils/date';

export function AppointmentsScreen() {
  const {
    loading,
    patient,
    appointments,
    waitingList,
    refreshData,
    logout,
    updatePhone,
    cancelAppointment,
    getAvailableSchedulesForReschedule,
    rescheduleAppointment,
    deleteWaitingListItem,
  } = usePortal();

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);

  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [appointmentToReschedule, setAppointmentToReschedule] = useState<Appointment | null>(null);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleSchedules, setRescheduleSchedules] = useState<PublicAvailability[]>([]);
  const [selectedRescheduleSchedule, setSelectedRescheduleSchedule] = useState<PublicAvailability | null>(null);
  const [rescheduleTimeModalVisible, setRescheduleTimeModalVisible] = useState(false);

  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [screenLoading, setScreenLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshData().catch(() => {});
    }, [refreshData]),
  );

  const openCancelModal = (appointment: Appointment) => {
    setAppointmentToCancel(appointment);
    setCancelReason('');
    setCancelModalVisible(true);
  };

  const submitCancel = async () => {
    if (!appointmentToCancel) return;
    if (!cancelReason.trim()) {
      Alert.alert('Validación', 'Ingresa un motivo de cancelación.');
      return;
    }

    try {
      const response = await cancelAppointment(appointmentToCancel.appointment_id, cancelReason.trim());
      if (response?.success) {
        Alert.alert('Cita cancelada', 'La cita fue cancelada exitosamente.');
        setCancelModalVisible(false);
      } else {
        Alert.alert('Error', response?.error || 'No se pudo cancelar la cita.');
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo cancelar la cita.');
    }
  };

  const openRescheduleModal = async (appointment: Appointment) => {
    setAppointmentToReschedule(appointment);
    setRescheduleReason('');
    setSelectedRescheduleSchedule(null);
    setRescheduleModalVisible(true);
    setScreenLoading(true);

    try {
      const schedules = await getAvailableSchedulesForReschedule(appointment.specialty_id);
      setRescheduleSchedules(schedules || []);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudieron cargar horarios para reasignar.');
      setRescheduleModalVisible(false);
    } finally {
      setScreenLoading(false);
    }
  };

  const executeReschedule = async (selectedTime?: string) => {
    if (!patient || !appointmentToReschedule || !selectedRescheduleSchedule?.availability_id) return;
    if (!rescheduleReason.trim()) {
      Alert.alert('Validación', 'Ingresa un motivo de reasignación.');
      return;
    }

    try {
      const response = await rescheduleAppointment({
        appointmentId: appointmentToReschedule.appointment_id,
        patientId: patient.patient_id,
        newAvailabilityId: selectedRescheduleSchedule.availability_id,
        reason: rescheduleReason.trim(),
        selected_time: selectedTime,
      });

      if (response?.success) {
        Alert.alert('Cita reasignada', 'La cita se reasignó correctamente.');
        setRescheduleModalVisible(false);
      } else {
        Alert.alert('Error', response?.error || 'No se pudo reasignar la cita.');
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo reasignar.');
    }
  };

  const handleReschedulePress = async () => {
    if (!selectedRescheduleSchedule) {
      Alert.alert('Validación', 'Selecciona una nueva agenda.');
      return;
    }

    const slots = selectedRescheduleSchedule.available_time_slots || [];
    if (slots.length <= 1) {
      await executeReschedule(slots[0]);
      return;
    }

    setRescheduleTimeModalVisible(true);
  };

  const submitUpdatePhone = async () => {
    try {
      await updatePhone(newPhone);
      setPhoneModalVisible(false);
      setNewPhone('');
      Alert.alert('Actualizado', 'Teléfono actualizado correctamente.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo actualizar el teléfono.');
    }
  };

  const removeWaitingListItem = async (item: WaitingListItem) => {
    Alert.alert('Confirmar', '¿Eliminar esta solicitud de lista de espera?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWaitingListItem(item.id);
          } catch (error: any) {
            Alert.alert('Error', error?.message || 'No se pudo eliminar la solicitud.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcomeText}>Bienvenido(a), {patient?.name}</Text>
          <Text style={styles.metaText}>Cédula: {patient?.document}</Text>
          <Text style={styles.metaText}>EPS ID: {patient?.insurance_eps_id || '-'}</Text>
          <Text style={styles.metaText}>Teléfono: {patient?.phone || '-'}</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.smallButton, styles.gray]} onPress={() => setPhoneModalVisible(true)}>
            <Text style={styles.smallButtonText}>Editar tel.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.smallButton, styles.red]} onPress={logout}>
            <Text style={styles.smallButtonText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {(loading || screenLoading) && <ActivityIndicator style={{ marginVertical: 8 }} />}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.sectionTitle}>Citas activas</Text>
        {appointments.length === 0 && <Text style={styles.emptyText}>No tienes citas activas.</Text>}

        {appointments.map((appointment) => (
          <View key={appointment.appointment_id} style={styles.appointmentCard}>
            <View style={styles.appointmentHeader}>
              <Text style={styles.appointmentDate}>{formatDateLabel(appointment.scheduled_date)}</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{appointment.status}</Text>
              </View>
            </View>

            <Text style={styles.appointmentTime}>
              {formatTimeTo12h(convertUTCToColombiaTime(appointment.scheduled_time))}
            </Text>
            <Text style={styles.appointmentLine}>Doctor(a): {appointment.doctor_name}</Text>
            <Text style={styles.appointmentLine}>Especialidad: {appointment.specialty_name}</Text>
            <Text style={styles.appointmentLine}>Sede: {appointment.location_name}</Text>
            <Text style={styles.appointmentLine}>Motivo: {appointment.reason || 'Consulta médica'}</Text>

            <View style={styles.rowButtons}>
              <TouchableOpacity style={[styles.actionButton, styles.green]} onPress={() => openRescheduleModal(appointment)}>
                <Text style={styles.actionText}>Reagendar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.red]} onPress={() => openCancelModal(appointment)}>
                <Text style={styles.actionText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Lista de espera</Text>
        {waitingList.length === 0 && <Text style={styles.emptyText}>No tienes solicitudes en espera.</Text>}

        {waitingList.map((item) => (
          <View key={item.id} style={styles.waitingCard}>
            <Text style={styles.waitingTitle}>{item.specialty_name}</Text>
            <Text style={styles.waitingMeta}>Prioridad: {item.priority_level || 'Normal'}</Text>
            <Text style={styles.waitingMeta}>Estado: {item.status}</Text>
            <Text style={styles.waitingMeta}>Posición: {item.queue_position || '-'}</Text>

            <TouchableOpacity style={[styles.actionButton, styles.red, { marginTop: 8 }]} onPress={() => removeWaitingListItem(item)}>
              <Text style={styles.actionText}>Eliminar solicitud</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <Modal visible={cancelModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cancelar cita</Text>
            <Text style={styles.modalSubtitle}>Motivo</Text>
            <TextInput
              style={[styles.input, { minHeight: 88 }]}
              multiline
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Describe el motivo"
            />

            <View style={styles.rowButtons}>
              <TouchableOpacity style={[styles.actionButton, styles.gray]} onPress={() => setCancelModalVisible(false)}>
                <Text style={styles.actionText}>Cerrar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.red]} onPress={submitCancel}>
                <Text style={styles.actionText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={rescheduleModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reagendar cita</Text>

            {screenLoading && <ActivityIndicator style={{ marginBottom: 12 }} />}

            <Text style={styles.modalSubtitle}>Selecciona nueva agenda</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              {rescheduleSchedules.map((schedule) => (
                <TouchableOpacity
                  key={`${schedule.availability_id}-${schedule.date}`}
                  style={[
                    styles.scheduleItem,
                    selectedRescheduleSchedule?.availability_id === schedule.availability_id && styles.optionItemActive,
                  ]}
                  onPress={() => setSelectedRescheduleSchedule(schedule)}
                >
                  <Text style={styles.scheduleTitle}>{schedule.location_name}</Text>
                  <Text style={styles.scheduleMeta}>{formatDateLabel(schedule.date)}</Text>
                  <Text style={styles.scheduleMeta}>Doctor: {schedule.doctor_name}</Text>
                  <Text style={styles.scheduleMeta}>Cupos: {schedule.available_slots}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.modalSubtitle, { marginTop: 10 }]}>Motivo de reasignación</Text>
            <TextInput
              style={[styles.input, { minHeight: 80 }]}
              multiline
              value={rescheduleReason}
              onChangeText={setRescheduleReason}
              placeholder="Ej: Cambio de horario"
            />

            <View style={styles.rowButtons}>
              <TouchableOpacity style={[styles.actionButton, styles.gray]} onPress={() => setRescheduleModalVisible(false)}>
                <Text style={styles.actionText}>Cerrar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.green]} onPress={handleReschedulePress}>
                <Text style={styles.actionText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={rescheduleTimeModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecciona hora nueva</Text>
            <ScrollView style={{ maxHeight: 280 }}>
              {(selectedRescheduleSchedule?.available_time_slots || []).map((timeSlot) => (
                <TouchableOpacity
                  key={timeSlot}
                  style={styles.optionItem}
                  onPress={async () => {
                    setRescheduleTimeModalVisible(false);
                    await executeReschedule(timeSlot);
                  }}
                >
                  <Text style={styles.optionText}>{formatTimeTo12h(timeSlot)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={[styles.actionButton, styles.gray, { marginTop: 12 }]} onPress={() => setRescheduleTimeModalVisible(false)}>
              <Text style={styles.actionText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={phoneModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Actualizar teléfono</Text>
            <Text style={styles.modalSubtitle}>Ingresa 10 dígitos (sin +57)</Text>
            <TextInput
              style={styles.input}
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
              placeholder="Ej: 3121234567"
              maxLength={10}
            />

            <View style={styles.rowButtons}>
              <TouchableOpacity style={[styles.actionButton, styles.gray]} onPress={() => setPhoneModalVisible(false)}>
                <Text style={styles.actionText}>Cerrar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.green]} onPress={submitUpdatePhone}>
                <Text style={styles.actionText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { backgroundColor: '#fff', padding: 14, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  welcomeText: { fontWeight: '800', fontSize: 18, color: '#111827' },
  metaText: { color: '#4b5563', fontSize: 12, marginTop: 2 },
  headerActions: { gap: 8, justifyContent: 'center' },

  content: { flex: 1 },
  contentContainer: { padding: 14, paddingBottom: 30 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },

  appointmentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  appointmentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appointmentDate: { fontSize: 16, fontWeight: '800', color: '#1d4ed8' },
  appointmentTime: { fontSize: 18, fontWeight: '800', color: '#111827', marginVertical: 6 },
  appointmentLine: { color: '#374151', fontSize: 13, marginBottom: 2 },
  statusBadge: { backgroundColor: '#dcfce7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { color: '#166534', fontWeight: '700', fontSize: 12 },

  waitingCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  waitingTitle: { fontSize: 15, fontWeight: '800', color: '#92400e' },
  waitingMeta: { fontSize: 13, color: '#78350f', marginTop: 2 },
  emptyText: { color: '#6b7280', marginBottom: 10 },

  rowButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  smallButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  smallButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  gray: { backgroundColor: '#6b7280' },
  green: { backgroundColor: '#16a34a' },
  red: { backgroundColor: '#dc2626' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 8 },
  modalSubtitle: { fontSize: 13, color: '#374151', marginBottom: 6, marginTop: 6, fontWeight: '700' },

  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },

  optionItem: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  optionItemActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  optionText: { color: '#111827', fontWeight: '600' },
  scheduleItem: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
  },
  scheduleTitle: { fontWeight: '800', color: '#1f2937', marginBottom: 2 },
  scheduleMeta: { fontSize: 12, color: '#374151', marginBottom: 1 },
});
