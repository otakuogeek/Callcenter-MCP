import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Esquema para optimización de recursos
const resourceOptimizationSchema = z.object({
  location_id: z.number().int(),
  date: z.string(),
  specialty_id: z.number().int().optional(),
  appointment_type: z.enum(['Presencial', 'Telemedicina']).optional(),
  duration_minutes: z.number().int().min(5).max(480).default(30),
  requires_special_equipment: z.boolean().default(false),
  priority_level: z.enum(['Baja', 'Media', 'Alta', 'Urgente']).default('Media'),
});

// Obtener optimización de recursos para un día específico
router.get('/optimize/:locationId/:date', requireAuth, async (req: Request, res: Response) => {
  const { locationId, date } = req.params;
  const specialtyId = req.query.specialty_id ? Number(req.query.specialty_id) : undefined;

  try {
    const optimization = await optimizeResourcesForDay(
      Number(locationId),
      date,
      specialtyId
    );

    return res.json({
      success: true,
      data: optimization
    });

  } catch (error) {
    console.error('Error en optimización de recursos:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Obtener recomendaciones de asignación de sala
router.post('/room-recommendations', requireAuth, async (req: Request, res: Response) => {
  const parsed = resourceOptimizationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Datos inválidos',
      errors: parsed.error.flatten()
    });
  }

  const data = parsed.data;

  try {
    const recommendations = await getRoomRecommendations(data);

    return res.json({
      success: true,
      data: {
        recommendations,
        total_available: recommendations.length
      }
    });

  } catch (error) {
    console.error('Error obteniendo recomendaciones de sala:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Función principal de optimización de recursos
async function optimizeResourcesForDay(
  locationId: number,
  date: string,
  specialtyId?: number
): Promise<any> {
  // 1. Obtener todas las salas disponibles en la ubicación
  const [rooms] = await pool.query(
    `SELECT r.id, r.name, r.capacity, r.equipment, r.specialties_allowed,
            r.is_active, r.notes
     FROM rooms r
     WHERE r.location_id = ? AND r.is_active = true`,
    [locationId]
  );

  // 2. Obtener todas las citas del día
  const [appointments] = await pool.query(
    `SELECT a.id, a.scheduled_at, a.duration_minutes, a.room_id,
            a.appointment_type, a.requires_special_equipment,
            a.priority_level, a.specialty_id,
            d.name as doctor_name, p.name as patient_name
     FROM appointments a
     JOIN doctors d ON d.id = a.doctor_id
     JOIN patients p ON p.id = a.patient_id
     WHERE a.location_id = ? AND DATE(a.scheduled_at) = ?
     AND a.status != 'Cancelada'
     ORDER BY a.scheduled_at ASC`,
    [locationId, date]
  );

  // 3. Calcular métricas de ocupación por sala
  const roomMetrics = calculateRoomMetrics(rooms as any[], appointments as any[], date);

  // 4. Generar recomendaciones de optimización
  const recommendations = generateOptimizationRecommendations(roomMetrics, specialtyId);

  return {
    date,
    location_id: locationId,
    total_rooms: (rooms as any[]).length,
    occupied_rooms: roomMetrics.filter(r => r.occupancy_rate > 0).length,
    room_metrics: roomMetrics,
    recommendations,
    optimization_score: calculateOptimizationScore(roomMetrics)
  };
}

// Calcular métricas de ocupación por sala
function calculateRoomMetrics(rooms: any[], appointments: any[], date: string): any[] {
  const metrics = [];

  for (const room of rooms) {
    // Filtrar citas de esta sala
    const roomAppointments = appointments.filter(a => a.room_id === room.id);

    // Calcular tiempo total ocupado
    let totalOccupiedMinutes = 0;
    const timeSlots = [];

    for (const appointment of roomAppointments) {
      const startTime = new Date(appointment.scheduled_at);
      const endTime = new Date(startTime.getTime() + appointment.duration_minutes * 60000);

      totalOccupiedMinutes += appointment.duration_minutes;
      timeSlots.push({
        start: startTime.toTimeString().slice(0, 5),
        end: endTime.toTimeString().slice(0, 5),
        appointment_id: appointment.id,
        doctor_name: appointment.doctor_name,
        patient_name: appointment.patient_name,
        specialty_id: appointment.specialty_id
      });
    }

    // Calcular tasa de ocupación (asumiendo jornada de 8 horas = 480 minutos)
    const totalAvailableMinutes = 480; // 8 horas
    const occupancyRate = (totalOccupiedMinutes / totalAvailableMinutes) * 100;

    // Calcular eficiencia
    const efficiency = calculateRoomEfficiency(roomAppointments, totalOccupiedMinutes);

    metrics.push({
      room_id: room.id,
      room_name: room.name,
      capacity: room.capacity,
      appointments_count: roomAppointments.length,
      total_occupied_minutes: totalOccupiedMinutes,
      occupancy_rate: Math.round(occupancyRate * 100) / 100,
      efficiency_score: efficiency.score,
      efficiency_factors: efficiency.factors,
      time_slots: timeSlots,
      utilization_gaps: identifyUtilizationGaps(timeSlots, date),
      recommendations: generateRoomRecommendations(room, roomAppointments, occupancyRate)
    });
  }

  return metrics.sort((a, b) => b.occupancy_rate - a.occupancy_rate);
}

// Calcular eficiencia de la sala
function calculateRoomEfficiency(appointments: any[], totalOccupiedMinutes: number): {
  score: number;
  factors: any[];
} {
  let score = 100;
  const factors = [];

  // Factor 1: Distribución de citas (evitar citas muy juntas o muy separadas)
  if (appointments.length > 1) {
    const timeGaps = calculateTimeGaps(appointments);
    const avgGap = timeGaps.reduce((sum, gap) => sum + gap, 0) / timeGaps.length;

    if (avgGap < 15) { // Menos de 15 minutos entre citas
      score -= 15;
      factors.push({ type: 'tight_schedule', impact: -15, description: 'Citas muy juntas' });
    } else if (avgGap > 120) { // Más de 2 horas entre citas
      score -= 10;
      factors.push({ type: 'sparse_schedule', impact: -10, description: 'Demasiado tiempo entre citas' });
    }
  }

  // Factor 2: Uso de capacidad máxima
  const maxCapacityUsed = Math.max(...appointments.map(a => 1)); // Simplificado
  if (maxCapacityUsed === 1 && appointments.length > 2) {
    score += 10;
    factors.push({ type: 'optimal_capacity', impact: 10, description: 'Buen uso de capacidad' });
  }

  // Factor 3: Duración de citas vs tiempo disponible
  const avgAppointmentDuration = totalOccupiedMinutes / appointments.length;
  if (avgAppointmentDuration > 90) {
    score -= 5;
    factors.push({ type: 'long_appointments', impact: -5, description: 'Citas predominantemente largas' });
  }

  return { score: Math.max(0, score), factors };
}

// Calcular brechas de tiempo entre citas
function calculateTimeGaps(appointments: any[]): number[] {
  const gaps = [];
  const sortedAppointments = appointments.sort((a, b) =>
    new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );

  for (let i = 1; i < sortedAppointments.length; i++) {
    const prevEnd = new Date(sortedAppointments[i-1].scheduled_at).getTime() +
                   sortedAppointments[i-1].duration_minutes * 60000;
    const currentStart = new Date(sortedAppointments[i].scheduled_at).getTime();
    const gapMinutes = (currentStart - prevEnd) / 60000;
    gaps.push(gapMinutes);
  }

  return gaps;
}

// Identificar brechas de utilización
function identifyUtilizationGaps(timeSlots: any[], date: string): any[] {
  const gaps = [];
  const workingHours = { start: '08:00', end: '18:00' };

  // Ordenar slots por tiempo
  const sortedSlots = timeSlots.sort((a, b) => a.start.localeCompare(b.start));

  // Brecha antes de la primera cita
  if (sortedSlots.length > 0) {
    const firstAppointment = sortedSlots[0];
    if (firstAppointment.start > workingHours.start) {
      gaps.push({
        start_time: workingHours.start,
        end_time: firstAppointment.start,
        duration_minutes: timeToMinutes(firstAppointment.start) - timeToMinutes(workingHours.start),
        type: 'morning_gap'
      });
    }
  }

  // Brechas entre citas
  for (let i = 1; i < sortedSlots.length; i++) {
    const prevEnd = sortedSlots[i-1].end;
    const currentStart = sortedSlots[i].start;

    if (prevEnd < currentStart) {
      gaps.push({
        start_time: prevEnd,
        end_time: currentStart,
        duration_minutes: timeToMinutes(currentStart) - timeToMinutes(prevEnd),
        type: 'inter_appointment_gap'
      });
    }
  }

  // Brecha después de la última cita
  if (sortedSlots.length > 0) {
    const lastAppointment = sortedSlots[sortedSlots.length - 1];
    if (lastAppointment.end < workingHours.end) {
      gaps.push({
        start_time: lastAppointment.end,
        end_time: workingHours.end,
        duration_minutes: timeToMinutes(workingHours.end) - timeToMinutes(lastAppointment.end),
        type: 'afternoon_gap'
      });
    }
  }

  // Brecha completa si no hay citas
  if (sortedSlots.length === 0) {
    gaps.push({
      start_time: workingHours.start,
      end_time: workingHours.end,
      duration_minutes: timeToMinutes(workingHours.end) - timeToMinutes(workingHours.start),
      type: 'full_day_gap'
    });
  }

  return gaps.filter(gap => gap.duration_minutes >= 30); // Solo brechas de 30+ minutos
}

// Generar recomendaciones para sala específica
function generateRoomRecommendations(room: any, appointments: any[], occupancyRate: number): any[] {
  const recommendations = [];

  if (occupancyRate < 30) {
    recommendations.push({
      type: 'low_utilization',
      priority: 'high',
      message: `Sala subutilizada (${occupancyRate.toFixed(1)}%). Considerar reasignar citas.`,
      action: 'reassign_appointments'
    });
  } else if (occupancyRate > 90) {
    recommendations.push({
      type: 'high_utilization',
      priority: 'medium',
      message: `Sala sobrecargada (${occupancyRate.toFixed(1)}%). Considerar redistribuir.`,
      action: 'redistribute_load'
    });
  }

  // Verificar brechas grandes
  const gaps = identifyUtilizationGaps(
    appointments.map(a => ({
      start: new Date(a.scheduled_at).toTimeString().slice(0, 5),
      end: new Date(new Date(a.scheduled_at).getTime() + a.duration_minutes * 60000).toTimeString().slice(0, 5),
      appointment_id: a.id
    })),
    new Date().toISOString().split('T')[0]
  );

  const largeGaps = gaps.filter(gap => gap.duration_minutes >= 60);
  if (largeGaps.length > 0) {
    recommendations.push({
      type: 'large_gaps',
      priority: 'medium',
      message: `${largeGaps.length} brecha(s) de 1+ hora(s). Oportunidad para más citas.`,
      action: 'schedule_additional_appointments',
      gaps: largeGaps
    });
  }

  return recommendations;
}

// Generar recomendaciones generales de optimización
function generateOptimizationRecommendations(roomMetrics: any[], specialtyId?: number): any[] {
  const recommendations = [];

  // Identificar salas subutilizadas
  const underutilizedRooms = roomMetrics.filter(r => r.occupancy_rate < 40);
  if (underutilizedRooms.length > 0) {
    recommendations.push({
      type: 'underutilized_rooms',
      priority: 'high',
      message: `${underutilizedRooms.length} sala(s) con ocupación < 40%.`,
      rooms: underutilizedRooms.map(r => ({ id: r.room_id, name: r.room_name, occupancy: r.occupancy_rate })),
      action: 'optimize_room_assignment'
    });
  }

  // Identificar salas sobrecargadas
  const overutilizedRooms = roomMetrics.filter(r => r.occupancy_rate > 85);
  if (overutilizedRooms.length > 0) {
    recommendations.push({
      type: 'overutilized_rooms',
      priority: 'high',
      message: `${overutilizedRooms.length} sala(s) con ocupación > 85%.`,
      rooms: overutilizedRooms.map(r => ({ id: r.room_id, name: r.room_name, occupancy: r.occupancy_rate })),
      action: 'redistribute_workload'
    });
  }

  // Calcular distribución óptima
  const avgOccupancy = roomMetrics.reduce((sum, r) => sum + r.occupancy_rate, 0) / roomMetrics.length;
  if (avgOccupancy < 60) {
    recommendations.push({
      type: 'overall_low_utilization',
      priority: 'medium',
      message: `Utilización general baja (${avgOccupancy.toFixed(1)}%). Oportunidad de crecimiento.`,
      action: 'increase_appointment_volume'
    });
  }

  return recommendations;
}

// Calcular score general de optimización
function calculateOptimizationScore(roomMetrics: any[]): number {
  if (roomMetrics.length === 0) return 0;

  const avgOccupancy = roomMetrics.reduce((sum, r) => sum + r.occupancy_rate, 0) / roomMetrics.length;
  const variance = roomMetrics.reduce((sum, r) => sum + Math.pow(r.occupancy_rate - avgOccupancy, 2), 0) / roomMetrics.length;
  const stdDev = Math.sqrt(variance);

  // Score basado en ocupación promedio y distribución equitativa
  let score = Math.min(100, avgOccupancy); // Máximo 100 puntos por ocupación
  score -= stdDev * 0.5; // Penalizar distribución desigual

  return Math.max(0, Math.round(score));
}

// Función auxiliar para convertir tiempo a minutos
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Obtener recomendaciones de sala para una nueva cita
async function getRoomRecommendations(data: any): Promise<any[]> {
  const { location_id, date, specialty_id, appointment_type, duration_minutes, requires_special_equipment } = data;

  // Obtener salas disponibles
  let query = `
    SELECT r.id, r.name, r.capacity, r.equipment, r.specialties_allowed,
           r.is_active, r.notes
    FROM rooms r
    WHERE r.location_id = ? AND r.is_active = true
  `;

  const params = [location_id];

  // Filtrar por especialidad si se especifica
  if (specialty_id) {
    query += ' AND (r.specialties_allowed IS NULL OR JSON_CONTAINS(r.specialties_allowed, ?))';
    params.push(JSON.stringify(specialty_id));
  }

  // Filtrar por equipo especial si se requiere
  if (requires_special_equipment) {
    query += ' AND r.equipment IS NOT NULL';
  }

  const [rooms] = await pool.query(query, params);

  const recommendations = [];

  for (const room of rooms as any[]) {
    // Verificar disponibilidad de horario
    const availability = await checkRoomAvailability(room.id, date, duration_minutes);

    if (availability.available) {
      // Calcular score de recomendación
      const score = calculateRoomRecommendationScore(room, availability, data);

      recommendations.push({
        room_id: room.id,
        room_name: room.name,
        capacity: room.capacity,
        equipment: room.equipment,
        availability_score: availability.score,
        equipment_match: calculateEquipmentMatch(room.equipment, requires_special_equipment),
        total_score: score,
        available_slots: availability.available_slots,
        next_available: availability.next_available
      });
    }
  }

  // Ordenar por score descendente
  return recommendations.sort((a, b) => b.total_score - a.total_score);
}

// Verificar disponibilidad de sala
async function checkRoomAvailability(roomId: number, date: string, durationMinutes: number): Promise<{
  available: boolean;
  score: number;
  available_slots: any[];
  next_available: string | null;
}> {
  // Obtener citas existentes de la sala
  const [appointments] = await pool.query(
    `SELECT scheduled_at, duration_minutes
     FROM appointments
     WHERE room_id = ? AND DATE(scheduled_at) = ? AND status != 'Cancelada'
     ORDER BY scheduled_at ASC`,
    [roomId, date]
  );

  // Generar slots disponibles (simplificado - en producción usar lógica más compleja)
  const availableSlots = generateAvailableTimeSlots(appointments as any[], durationMinutes, date);

  const occupancyRate = (appointments as any[]).length > 0 ?
    ((appointments as any[]).reduce((sum: number, apt: any) => sum + apt.duration_minutes, 0) / 480) * 100 : 0;

  return {
    available: availableSlots.length > 0,
    score: Math.max(0, 100 - occupancyRate), // Score basado en disponibilidad
    available_slots: availableSlots,
    next_available: availableSlots.length > 0 ? availableSlots[0].start_time : null
  };
}

// Generar slots de tiempo disponibles (simplificado)
function generateAvailableTimeSlots(appointments: any[], durationMinutes: number, date: string): any[] {
  const slots = [];
  const workingDay = { start: '08:00', end: '18:00' };

  // Lógica simplificada - en producción implementar algoritmo más robusto
  const busyPeriods = appointments.map(apt => ({
    start: new Date(apt.scheduled_at),
    end: new Date(new Date(apt.scheduled_at).getTime() + apt.duration_minutes * 60000)
  }));

  // Para este ejemplo, devolver algunos slots disponibles
  slots.push({
    start_time: '09:00',
    end_time: '09:30',
    duration_minutes: 30
  });

  return slots;
}

// Calcular score de recomendación de sala
function calculateRoomRecommendationScore(room: any, availability: any, data: any): number {
  let score = 50; // Score base

  // Factor de disponibilidad
  score += availability.score * 0.4;

  // Factor de capacidad vs requerimientos
  if (room.capacity >= 1) score += 10;

  // Factor de equipo
  score += calculateEquipmentMatch(room.equipment, data.requires_special_equipment) * 20;

  return Math.round(score);
}

// Calcular coincidencia de equipo
function calculateEquipmentMatch(equipment: any, requiresSpecial: boolean): number {
  if (!requiresSpecial) return 1;

  // Lógica simplificada - en producción analizar equipment JSON
  return equipment ? 1 : 0;
}

export default router;
