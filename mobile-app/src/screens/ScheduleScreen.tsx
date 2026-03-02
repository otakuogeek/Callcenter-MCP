import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePortal } from '../context/PortalContext';
import { PublicAvailability, Specialty } from '../types/portal';
import { convertUTCToColombiaTime, formatDateLabel, formatTimeTo12h, getTodayInColombia } from '../utils/date';

export function ScheduleScreen() {
  const {
    loading,
    patient,
    getAuthorizedSpecialties,
    getAuthorizedLocations,
    getAvailabilitiesBySpecialty,
    scheduleAppointment,
    addToWaitingList,
  } = usePortal();

  const [screenLoading, setScreenLoading] = useState(false);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [availableSchedules, setAvailableSchedules] = useState<PublicAvailability[]>([]);
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [selectedScheduleForTime, setSelectedScheduleForTime] = useState<PublicAvailability | null>(null);
  const [showWaitingListFallback, setShowWaitingListFallback] = useState(false);
  const [autoAdvanceTarget, setAutoAdvanceTarget] = useState<'step2' | 'fallback' | null>(null);

  const scrollRef = useRef<ScrollView | null>(null);
  const stepTwoYRef = useRef(0);
  const fallbackYRef = useRef(0);

  const scrollToSection = (y: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ y: Math.max(0, y - 10), animated: true });
  };

  useEffect(() => {
    if (autoAdvanceTarget === 'step2' && stepTwoYRef.current > 0) {
      scrollToSection(stepTwoYRef.current);
      setAutoAdvanceTarget(null);
      return;
    }

    if (autoAdvanceTarget === 'fallback' && fallbackYRef.current > 0) {
      scrollToSection(fallbackYRef.current);
      setAutoAdvanceTarget(null);
    }
  }, [autoAdvanceTarget]);

  const loadSpecialties = async () => {
    if (!patient?.insurance_eps_id) {
      Alert.alert('Sin EPS', 'No se detectó EPS para agendamiento.');
      return;
    }

    setScreenLoading(true);
    try {
      const list = await getAuthorizedSpecialties();
      setSpecialties(list || []);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudieron cargar especialidades.');
    } finally {
      setScreenLoading(false);
    }
  };

  const selectSpecialty = async (specialty: Specialty) => {
    if (!patient?.insurance_eps_id) return;

    setSelectedSpecialty(specialty);
    setSelectedLocationId(null);
    setAvailableSchedules([]);
    setShowWaitingListFallback(false);
    setScreenLoading(true);

    try {
      const [locations, availabilities] = await Promise.all([
        getAuthorizedLocations(),
        getAvailabilitiesBySpecialty(specialty.id),
      ]);

      const authorizedIds = new Set((locations || []).map((location) => location.id));
      const today = getTodayInColombia();

      const filtered = (availabilities || [])
        .map((schedule) => ({
          ...schedule,
          availability_id: schedule.availability_id || schedule.id,
        }))
        .filter((schedule) => {
          const isFuture = schedule.date > today;
          const isAuthorizedLocation = authorizedIds.has(schedule.location_id);
          return isFuture && isAuthorizedLocation && schedule.available_slots > 0;
        });

      setAvailableSchedules(filtered);
      setSelectedLocationId(filtered.length > 0 ? filtered[0].location_id : null);
      setShowWaitingListFallback(filtered.length === 0);
      setAutoAdvanceTarget(filtered.length > 0 ? 'step2' : 'fallback');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo cargar disponibilidad.');
    } finally {
      setScreenLoading(false);
    }
  };

  const filteredSchedules = useMemo(() => {
    if (!selectedLocationId) return availableSchedules;
    return availableSchedules.filter((schedule) => schedule.location_id === selectedLocationId);
  }, [availableSchedules, selectedLocationId]);

  const executeSchedule = async (schedule: PublicAvailability, selectedTime?: string) => {
    if (!selectedSpecialty || !schedule.availability_id) return;

    try {
      const response = await scheduleAppointment({
        specialty_id: selectedSpecialty.id,
        doctor_id: schedule.doctor_id,
        availability_id: schedule.availability_id,
        reason: `Consulta de ${selectedSpecialty.name}`,
        selected_time: selectedTime,
      });

      if (response?.success) {
        Alert.alert('Cita confirmada', `Tu cita #${response?.data?.appointment_id} fue agendada correctamente.`);
      } else {
        Alert.alert('Error', response?.error || 'No se pudo agendar la cita.');
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo agendar.');
    }
  };

  const handleSchedulePress = async (schedule: PublicAvailability) => {
    const slots = schedule.available_time_slots || [];
    if (slots.length <= 1) {
      await executeSchedule(schedule, slots[0]);
      return;
    }

    setSelectedScheduleForTime(schedule);
    setTimeModalVisible(true);
  };

  const handleWaitingList = async () => {
    if (!selectedSpecialty) {
      Alert.alert('Validación', 'Selecciona una especialidad primero.');
      return;
    }

    try {
      const result = await addToWaitingList(selectedSpecialty.id, `Consulta de ${selectedSpecialty.name}`);
      if (result.success) {
        Alert.alert(
          'Agregado a lista de espera',
          `Tu posición actual es ${result.data?.position || '-'} y el radicado es ${result.data?.waiting_list_id || '-'}.`,
        );
      } else {
        Alert.alert('Error', result.error || 'No se pudo agregar a la lista de espera.');
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo agregar a lista de espera.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Agendar Cita</Text>
        <TouchableOpacity style={styles.button} onPress={loadSpecialties}>
          <Text style={styles.buttonText}>Cargar especialidades</Text>
        </TouchableOpacity>
      </View>

      {(loading || screenLoading) && <ActivityIndicator style={{ marginVertical: 8 }} />}

      <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>1</Text>
            </View>
            <View>
              <Text style={styles.sectionTitle}>Elige especialidad</Text>
              <Text style={styles.sectionHint}>Selecciona el servicio que necesitas</Text>
            </View>
          </View>

          {specialties.length === 0 && <Text style={styles.emptyText}>Pulsa "Cargar especialidades" para iniciar.</Text>}

          {specialties.map((specialty) => {
            const isSelected = selectedSpecialty?.id === specialty.id;
            return (
              <TouchableOpacity
                key={specialty.id}
                style={[styles.specialtyCard, isSelected && styles.specialtyCardActive]}
                onPress={() => selectSpecialty(specialty)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.specialtyTitle, isSelected && styles.specialtyTitleActive]}>{specialty.name}</Text>
                  {!!specialty.description && <Text style={styles.specialtyDescription}>{specialty.description}</Text>}
                </View>
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'chevron-forward-circle-outline'}
                  size={22}
                  color={isSelected ? '#2563eb' : '#9ca3af'}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedSpecialty && (
          <View
            style={styles.sectionCard}
            onLayout={(event) => {
              stepTwoYRef.current = event.nativeEvent.layout.y;
              if (autoAdvanceTarget === 'step2') {
                scrollToSection(stepTwoYRef.current);
                setAutoAdvanceTarget(null);
              }
            }}
          >
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>2</Text>
              </View>
              <View>
                <Text style={styles.sectionTitle}>Selecciona sede</Text>
                <Text style={styles.sectionHint}>Filtra agendas por sede autorizada</Text>
              </View>
            </View>

            {availableSchedules.length > 0 ? (
              <>
                <View style={styles.chipsWrap}>
                  {Array.from(new Set(availableSchedules.map((schedule) => schedule.location_id))).map((locationId) => {
                    const sample = availableSchedules.find((schedule) => schedule.location_id === locationId);
                    return (
                      <TouchableOpacity
                        key={locationId}
                        style={[styles.chip, selectedLocationId === locationId && styles.chipActive]}
                        onPress={() => setSelectedLocationId(locationId)}
                      >
                        <Text style={[styles.chipText, selectedLocationId === locationId && { color: '#fff' }]}>{sample?.location_name || `Sede ${locationId}`}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.sectionHeaderRowAlt}>
                  <View style={styles.sectionBadge}>
                    <Text style={styles.sectionBadgeText}>3</Text>
                  </View>
                  <View>
                    <Text style={styles.sectionTitle}>Agenda disponible</Text>
                    <Text style={styles.sectionHint}>Toca una tarjeta para continuar</Text>
                  </View>
                </View>
                {filteredSchedules.map((schedule) => (
                  <TouchableOpacity
                    key={`${schedule.availability_id}-${schedule.date}`}
                    style={styles.scheduleItem}
                    onPress={() => handleSchedulePress(schedule)}
                  >
                    <Text style={styles.scheduleTitle}>{schedule.location_name}</Text>
                    <Text style={styles.scheduleMeta}>{formatDateLabel(schedule.date)}</Text>
                    <Text style={styles.scheduleMeta}>
                      {formatTimeTo12h(convertUTCToColombiaTime(schedule.start_time))} - {formatTimeTo12h(convertUTCToColombiaTime(schedule.end_time))}
                    </Text>
                    <Text style={styles.scheduleMeta}>Doctor: {schedule.doctor_name}</Text>
                    <Text style={styles.scheduleMeta}>Cupos: {schedule.available_slots}</Text>
                    <View style={styles.scheduleActionRow}>
                      <Text style={styles.scheduleActionText}>Seleccionar horario</Text>
                      <Ionicons name="arrow-forward" size={16} color="#2563eb" />
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <Text style={styles.emptyText}>
                {screenLoading ? 'Cargando disponibilidad...' : 'No encontramos agendas disponibles para esta especialidad.'}
              </Text>
            )}
          </View>
        )}

        {showWaitingListFallback && selectedSpecialty && (
          <View
            style={styles.fallbackCard}
            onLayout={(event) => {
              fallbackYRef.current = event.nativeEvent.layout.y;
              if (autoAdvanceTarget === 'fallback') {
                scrollToSection(fallbackYRef.current);
                setAutoAdvanceTarget(null);
              }
            }}
          >
            <Text style={styles.fallbackText}>No hay cupos disponibles para {selectedSpecialty.name}.</Text>
            <TouchableOpacity style={[styles.button, { alignSelf: 'flex-start', marginTop: 10 }]} onPress={handleWaitingList}>
              <Text style={styles.buttonText}>Agregar a lista de espera</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal visible={timeModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecciona hora</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {(selectedScheduleForTime?.available_time_slots || []).map((timeSlot) => (
                <TouchableOpacity
                  key={timeSlot}
                  style={styles.optionItem}
                  onPress={async () => {
                    setTimeModalVisible(false);
                    if (selectedScheduleForTime) await executeSchedule(selectedScheduleForTime, timeSlot);
                  }}
                >
                  <Text style={styles.optionText}>{formatTimeTo12h(timeSlot)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.button, { marginTop: 12, backgroundColor: '#6b7280' }]} onPress={() => setTimeModalVisible(false)}>
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { flex: 1 },
  contentContainer: { padding: 14, paddingBottom: 24 },
  sectionCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  sectionHeaderRowAlt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    marginBottom: 8,
  },
  sectionBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8, marginTop: 10 },
  sectionHint: { fontSize: 12, color: '#6b7280', marginTop: -6 },
  emptyText: { color: '#6b7280' },
  specialtyCard: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  specialtyCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  specialtyTitle: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 14,
  },
  specialtyTitleActive: {
    color: '#1d4ed8',
  },
  specialtyDescription: {
    marginTop: 2,
    color: '#6b7280',
    fontSize: 12,
  },
  optionItem: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  optionItemActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  optionText: { color: '#111827', fontWeight: '600' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#e5e7eb' },
  chipActive: { backgroundColor: '#2563eb' },
  chipText: { color: '#111827', fontWeight: '700', fontSize: 12 },
  scheduleItem: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  scheduleTitle: { fontWeight: '800', color: '#1f2937', marginBottom: 2 },
  scheduleMeta: { fontSize: 12, color: '#374151', marginBottom: 1 },
  scheduleActionRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  scheduleActionText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '700',
  },
  fallbackCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    padding: 12,
  },
  fallbackText: { color: '#78350f', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 8 },
});
