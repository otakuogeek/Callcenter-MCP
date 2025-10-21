import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Cache simple para columna opcional room_id
let hasRoomColumnCache: boolean | null = null;
async function hasRoomColumn(): Promise<boolean> {
  if (hasRoomColumnCache !== null) return hasRoomColumnCache;
  try {
    const [rows] = await pool.query(
      `SELECT 1 FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments' AND COLUMN_NAME = 'room_id' LIMIT 1`
    );
    hasRoomColumnCache = Array.isArray(rows) && rows.length > 0;
  } catch {
    hasRoomColumnCache = false;
  }
  return hasRoomColumnCache;
}

const schema = z.object({
  // Campos básicos existentes
  patient_id: z.number().int(),
  availability_id: z.number().int().nullable().optional(),
  location_id: z.number().int(),
  specialty_id: z.number().int(),
  doctor_id: z.number().int(),
  room_id: z.number().int().optional().nullable(),
  scheduled_at: z.string(),
  duration_minutes: z.number().int().min(5).max(480).default(30),
  appointment_type: z.enum(['Presencial','Telemedicina']).default('Presencial'),
  status: z.enum(['Pendiente','Confirmada','Completada','Cancelada']).default('Pendiente'),
  reason: z.string().optional().nullable(),
  insurance_type: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  cancellation_reason: z.string().optional().nullable(),
  manual: z.boolean().optional().default(false),
  
  // Nuevos campos agregados en la migración
  consultation_reason_detailed: z.string().optional().nullable(),
  additional_notes: z.string().optional().nullable(),
  priority_level: z.enum(['Baja', 'Normal', 'Alta', 'Urgente']).default('Normal'),
  insurance_company: z.string().optional().nullable(),
  insurance_policy_number: z.string().optional().nullable(),
  appointment_source: z.enum(['Manual', 'Sistema_Inteligente', 'Llamada', 'Web', 'App']).default('Manual'),
  reminder_sent: z.boolean().optional().default(false),
  reminder_sent_at: z.string().optional().nullable(),
  preferred_time: z.string().optional().nullable(),
  symptoms: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  medications: z.string().optional().nullable(),
  emergency_contact_name: z.string().optional().nullable(),
  emergency_contact_phone: z.string().optional().nullable(),
  follow_up_required: z.boolean().optional().default(false),
  follow_up_date: z.string().optional().nullable(),
  payment_method: z.enum(['Efectivo', 'Tarjeta', 'Transferencia', 'Seguro', 'Credito']).optional().nullable(),
  copay_amount: z.number().min(0).optional().nullable(),
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const status = String(req.query.status || '');
  const date = String(req.query.date || '');
  const patientId = req.query.patient_id ? Number(req.query.patient_id) : undefined;
  const availabilityId = req.query.availability_id ? Number(req.query.availability_id) : undefined;
  const filters: string[] = []; const values: any[] = [];
  if (status) { filters.push('a.status = ?'); values.push(status); }
  if (date) { filters.push('DATE(a.scheduled_at) = ?'); values.push(date); }
  if (typeof patientId === 'number' && !Number.isNaN(patientId)) { filters.push('a.patient_id = ?'); values.push(patientId); }
  if (typeof availabilityId === 'number' && !Number.isNaN(availabilityId)) { filters.push('a.availability_id = ?'); values.push(availabilityId); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  try {
    const [rows] = await pool.query(
      `SELECT a.*, p.name AS patient_name, p.phone AS patient_phone, p.email AS patient_email,
              d.name AS doctor_name, s.name AS specialty_name, l.name AS location_name
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN doctors d ON d.id = a.doctor_id
       JOIN specialties s ON s.id = a.specialty_id
       JOIN locations l ON l.id = a.location_id
       ${where}
       ORDER BY a.scheduled_at DESC
       LIMIT 200`,
      values
    );
    return res.json(rows);
  } catch (e: any) {
    if (e && (e.code === 'ER_NO_SUCH_TABLE' || e.errno === 1146)) {
      return res.json([]);
    }
    return res.status(500).json({ message: 'Server error' });
  }
});

import { sendAppointmentConfirmationEmail } from '../services/mailer';

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data;
  try {
    // ================= Nueva validación basada en cupos disponibles =================
    
    // 1. Validación: evitar que el mismo paciente tenga múltiples citas el mismo día
    try {
      const [patientDayRows] = await pool.query(
        `SELECT id FROM appointments
         WHERE patient_id = ? AND status != 'Cancelada'
           AND DATE(scheduled_at) = DATE(?)
         LIMIT 1`,
        [d.patient_id, d.scheduled_at]
      );
      if (Array.isArray(patientDayRows) && patientDayRows.length) {
        return res.status(409).json({ message: 'El paciente ya tiene una cita agendada para este día.' });
      }
    } catch {/* ignore and continue */}

    // 2. Validación de cupos disponibles en la availability
    if (d.availability_id) {
      try {
        const [availRows] = await pool.query(
          `SELECT capacity, booked_slots, status FROM availabilities
           WHERE id = ? AND status = 'Activa'`,
          [d.availability_id]
        );
        
        if (!Array.isArray(availRows) || availRows.length === 0) {
          return res.status(404).json({ message: 'La agenda seleccionada no existe o no está activa.' });
        }
        
        const availability = availRows[0] as any;
        if (availability.booked_slots >= availability.capacity) {
          return res.status(409).json({ message: 'No hay cupos disponibles en esta agenda. Todos los cupos están ocupados.' });
        }
      } catch (err) {
        console.error('Error validando cupos disponibles:', err);
        return res.status(500).json({ message: 'Error interno validando disponibilidad.' });
      }
    }

    // 3. Validación: evitar que la misma sala/consultorio tenga conflicto (si aplica)
    try {
      if ((d as any).room_id != null && await hasRoomColumn()) {
        const roomId = Number((d as any).room_id);
        if (!Number.isNaN(roomId)) {
          const [confRowsR] = await pool.query(
            `SELECT id FROM appointments
             WHERE room_id = ? AND status != 'Cancelada'
               AND scheduled_at < DATE_ADD(?, INTERVAL ? MINUTE)
               AND DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE) > ?
             LIMIT 1`,
            [roomId, d.scheduled_at, d.duration_minutes, d.scheduled_at]
          );
          if (Array.isArray(confRowsR) && confRowsR.length) {
            return res.status(409).json({ message: 'Conflicto: la sala/consultorio ya tiene una cita que se solapa con ese horario.' });
          }
        }
      }
    } catch {/* ignore */}

    // ================= Auto-asignar agenda (availability) =================
    // Si no vino availability_id intentamos localizar una disponibilidad del doctor que cubra el horario
    let availabilityIdToUse: number | null = d.availability_id ?? null;
    if (availabilityIdToUse == null) {
      try {
        const [availRows]: any = await pool.query(
          `SELECT id
             FROM availabilities
            WHERE doctor_id = ?
              AND date = DATE(?)
              AND CONCAT(date,' ', start_time) <= ?
              AND CONCAT(date,' ', end_time) >= DATE_ADD(?, INTERVAL ? MINUTE)
            ORDER BY start_time
            LIMIT 1`,
          [d.doctor_id, d.scheduled_at, d.scheduled_at, d.scheduled_at, d.duration_minutes]
        );
        if (Array.isArray(availRows) && availRows.length) {
          availabilityIdToUse = Number(availRows[0].id) || null;
        }
      } catch { /* ignorar - seguimos sin availability */ }
    }

    const hasRoom = await hasRoomColumn();
    let cols = [
      'patient_id','availability_id','location_id','specialty_id','doctor_id',
      'scheduled_at','duration_minutes','appointment_type','status','reason',
      'insurance_type','notes','cancellation_reason','created_by_user_id',
      // Nuevos campos de la migración
      'consultation_reason_detailed','additional_notes','priority_level',
      'insurance_company','insurance_policy_number','appointment_source',
      'reminder_sent','reminder_sent_at','preferred_time','symptoms',
      'allergies','medications','emergency_contact_name','emergency_contact_phone',
      'follow_up_required','follow_up_date','payment_method','copay_amount'
    ] as string[];
    let vals: any[] = [
      d.patient_id, availabilityIdToUse, d.location_id, d.specialty_id, d.doctor_id,
      d.scheduled_at, d.duration_minutes, d.appointment_type, d.status, d.reason ?? null,
      d.insurance_type ?? null, d.notes ?? null, d.cancellation_reason ?? null, (req as any).user?.id ?? null,
      // Valores para nuevos campos
      d.consultation_reason_detailed ?? null, d.additional_notes ?? null, d.priority_level ?? 'Normal',
      d.insurance_company ?? null, d.insurance_policy_number ?? null, d.appointment_source ?? 'Manual',
      d.reminder_sent ?? false, d.reminder_sent_at ?? null, d.preferred_time ?? null, d.symptoms ?? null,
      d.allergies ?? null, d.medications ?? null, d.emergency_contact_name ?? null, d.emergency_contact_phone ?? null,
      d.follow_up_required ?? false, d.follow_up_date ?? null, d.payment_method ?? null, d.copay_amount ?? null
    ];
    if (hasRoom) {
      cols.push('room_id');
      vals.push((d as any).room_id ?? null);
    }
    const placeholders = cols.map(() => '?').join(', ');
    const [result] = await pool.query(
      `INSERT INTO appointments (${cols.join(', ')}) VALUES (${placeholders})`,
      vals
    );
    // @ts-ignore
  const created = { id: result.insertId as number, ...d, availability_id: availabilityIdToUse } as any;

    // ================= Facturación automática =================
    // Estrategia: si request incluye service_id lo usamos; si no, intentamos mapear specialty_id -> service con mismo nombre.
    const rawServiceId = (req.body && (req.body as any).service_id) ? Number((req.body as any).service_id) : undefined;
    let serviceIdToBill: number | undefined = undefined;
    if (rawServiceId && !Number.isNaN(rawServiceId)) {
      serviceIdToBill = rawServiceId;
    } else {
      try {
        const [[svc]]: any = await pool.query('SELECT s.id FROM services s JOIN specialties sp ON sp.name = s.name WHERE sp.id = ? LIMIT 1', [d.specialty_id]);
        if (svc && svc.id) serviceIdToBill = Number(svc.id);
      } catch { /* ignore */ }
    }
    if (serviceIdToBill) {
      // Calcular precios e insertar en appointment_billing si no existe
      try {
        const [[exists]]: any = await pool.query('SELECT id FROM appointment_billing WHERE appointment_id = ? LIMIT 1', [created.id]);
        if (!exists) {
          // Obtener precios similares a lógica de appointmentBilling route
          const [[svc]]: any = await pool.query('SELECT base_price, currency FROM services WHERE id = ? LIMIT 1', [serviceIdToBill]);
          if (svc) {
            const [[override]]: any = await pool.query('SELECT price FROM doctor_service_prices WHERE doctor_id = ? AND service_id = ? AND active = 1 LIMIT 1', [d.doctor_id, serviceIdToBill]);
            const base = Number(svc.base_price || 0);
            const doctorPrice = override ? Number(override.price) : null;
            const finalPrice = doctorPrice != null ? doctorPrice : base;
            await pool.query(
              'INSERT INTO appointment_billing (appointment_id, service_id, doctor_id, base_price, doctor_price, final_price, currency) VALUES (?,?,?,?,?,?,?)',
              [created.id, serviceIdToBill, d.doctor_id, base, doctorPrice, finalPrice, svc.currency || 'COP']
            );
            (created as any).billing = { service_id: serviceIdToBill, base_price: base, doctor_price: doctorPrice, final_price: finalPrice };
          }
        }
      } catch { /* ignore billing errors to not block appointment creation */ }
    }

    // Si es manual y existe correo del paciente, enviar confirmación (no bloquear la respuesta)
    if (d.manual) {
      try {
        const [rows] = await pool.query(
    `SELECT p.email AS patient_email, p.name AS patient_name,
      d.name AS doctor_name, s.name AS specialty_name, l.name AS location_name
           FROM patients p, doctors d, specialties s, locations l
           WHERE p.id = ? AND d.id = ? AND s.id = ? AND l.id = ?
           LIMIT 1`,
          [d.patient_id, d.doctor_id, d.specialty_id, d.location_id]
        );
        const info = Array.isArray(rows) && rows.length ? (rows as any)[0] : {};
        const email = info.patient_email as string | undefined;
        if (email) {
          // No await: envío en background
          sendAppointmentConfirmationEmail({
            to: email,
            patientName: info.patient_name || null,
            doctorName: info.doctor_name || null,
            specialtyName: info.specialty_name || null,
            locationName: info.location_name || null,
            scheduledAt: d.scheduled_at,
            appointmentType: d.appointment_type,
          }).catch(() => {/* ignore mail errors */});
        }
      } catch {/* ignore */}
    }

    // Registrar asignación en preallocation si aplica: buscar preallocation del doctor para target_date (DATE(scheduled_at)) y con remaining > 0
    try {
      const targetDate = d.scheduled_at.slice(0,10);
      const [preRows]: any = await pool.query(
        `SELECT id, slots, assigned_count
           FROM scheduling_preallocation
          WHERE doctor_id = ? AND target_date = ? AND pre_date <= CURDATE() AND assigned_count < slots
          ORDER BY pre_date ASC`,
        [d.doctor_id, targetDate]
      );
      if (Array.isArray(preRows) && preRows.length) {
        const pre = preRows[0];
        try {
          await pool.query('CALL assign_preallocation_slot(?,?,?)', [pre.id, d.patient_id, created.id]);
          (created as any).preallocation_id = pre.id;
        } catch (e) { /* ignore slot assign error */ }
      }
    } catch { /* ignore */ }

    // ================= Actualizar cupos reservados en availability =================
    if (availabilityIdToUse) {
      try {
        await pool.query(
          `UPDATE availabilities 
           SET booked_slots = booked_slots + 1 
           WHERE id = ? AND booked_slots < capacity`,
          [availabilityIdToUse]
        );
      } catch (updateErr) {
        console.error('Error actualizando booked_slots:', updateErr);
        // No fallar la creación de la cita por este error
      }
    }

    return res.status(201).json(created);
  } catch (error: any) {
    console.error('Error creating appointment:', error);
    
    // Manejar errores de foreign key específicamente
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      const constraint = error.message;
      if (constraint.includes('fk_appt_patient')) {
        return res.status(400).json({ 
          message: 'El paciente especificado no existe',
          error: `patient_id: ${req.body.patient_id} no encontrado`
        });
      } else if (constraint.includes('fk_appt_doctor')) {
        return res.status(400).json({ 
          message: 'El doctor especificado no existe',
          error: `doctor_id: ${req.body.doctor_id} no encontrado`
        });
      } else if (constraint.includes('fk_appt_specialty')) {
        return res.status(400).json({ 
          message: 'La especialidad especificada no existe',
          error: `specialty_id: ${req.body.specialty_id} no encontrado`
        });
      } else if (constraint.includes('fk_appt_location')) {
        return res.status(400).json({ 
          message: 'La ubicación especificada no existe',
          error: `location_id: ${req.body.location_id} no encontrado`
        });
      }
      return res.status(400).json({ 
        message: 'Error de referencia en la base de datos',
        error: constraint
      });
    }
    
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data;
  try {
    // Si se modifica doctor_id, scheduled_at, duration_minutes o availability_id, validar cupos
    if ('doctor_id' in d || 'scheduled_at' in d || 'duration_minutes' in d || 'availability_id' in d) {
      const [rows] = await pool.query(`SELECT doctor_id, scheduled_at, duration_minutes, patient_id, availability_id${await hasRoomColumn() ? ', room_id' : ''} FROM appointments WHERE id = ? LIMIT 1`, [id]);
      const current = Array.isArray(rows) && rows.length ? (rows as any)[0] : null;
      if (!current) return res.status(404).json({ message: 'Appointment not found' });
      
      const newPatientId = typeof d.patient_id === 'number' ? d.patient_id : Number(current.patient_id);
      const newScheduledAt = d.scheduled_at ?? current.scheduled_at;
      const newAvailabilityId = typeof d.availability_id === 'number' ? d.availability_id : current.availability_id;

      // 1. Validación: evitar que el mismo paciente tenga múltiples citas el mismo día
      if (d.scheduled_at || d.patient_id) {
        const [patientDayRows] = await pool.query(
          `SELECT id FROM appointments
           WHERE patient_id = ? AND status != 'Cancelada' AND id != ?
             AND DATE(scheduled_at) = DATE(?)
           LIMIT 1`,
          [newPatientId, id, newScheduledAt]
        );
        if (Array.isArray(patientDayRows) && patientDayRows.length) {
          return res.status(409).json({ message: 'El paciente ya tiene una cita agendada para este día.' });
        }
      }

      // 2. Validación de cupos disponibles (solo si cambia availability_id)
      if (d.availability_id && d.availability_id !== current.availability_id) {
        const [availRows] = await pool.query(
          `SELECT capacity, booked_slots, status FROM availabilities
           WHERE id = ? AND status = 'Activa'`,
          [d.availability_id]
        );
        
        if (!Array.isArray(availRows) || availRows.length === 0) {
          return res.status(404).json({ message: 'La agenda seleccionada no existe o no está activa.' });
        }
        
        const availability = availRows[0] as any;
        if (availability.booked_slots >= availability.capacity) {
          return res.status(409).json({ message: 'No hay cupos disponibles en esta agenda. Todos los cupos están ocupados.' });
        }
      }

      // 3. Validar sala/consultorio si aplica
      if (await hasRoomColumn()) {
        const newRoomId = ('room_id' in d) ? (d as any).room_id : (current as any).room_id;
        const roomIdNum = Number(newRoomId);
        if (newRoomId != null && !Number.isNaN(roomIdNum)) {
          const newDuration = typeof d.duration_minutes === 'number' ? d.duration_minutes : Number(current.duration_minutes);
          const [confRowsR] = await pool.query(
            `SELECT id FROM appointments
             WHERE room_id = ? AND status != 'Cancelada' AND id != ?
               AND scheduled_at < DATE_ADD(?, INTERVAL ? MINUTE)
               AND DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE) > ?
             LIMIT 1`,
            [roomIdNum, id, newScheduledAt, newDuration, newScheduledAt]
          );
          if (Array.isArray(confRowsR) && confRowsR.length) {
            return res.status(409).json({ message: 'Conflicto: la sala/consultorio ya tiene una cita que se solapa con ese horario.' });
          }
        }
      }
    }

    const fields: string[] = []; const values: any[] = [];
    const allowRoom = await hasRoomColumn();
    for (const k of Object.keys(d) as (keyof typeof d)[]) {
      if (k === 'room_id' && !allowRoom) continue;
      fields.push(`${k} = ?`);
      // @ts-ignore
      values.push(d[k] ?? null);
    }
    if (!fields.length) return res.status(400).json({ message: 'No changes' });
    values.push(id);
    const doctorChanged = fields.some(f => f.startsWith('doctor_id'));
    await pool.query(`UPDATE appointments SET ${fields.join(', ')} WHERE id = ?`, values);
    // Si se cancela, liberar preallocation si corresponde
    if (d.status === 'Cancelada') {
      try { await pool.query('CALL release_preallocation_slot(?)', [id]); } catch { /* ignore */ }
      
      // ================= Decrementar cupos reservados en availability =================
      try {
        // Obtener el availability_id de la cita antes de actualizarlo
        const [apptRows] = await pool.query('SELECT availability_id FROM appointments WHERE id = ? LIMIT 1', [id]);
        if (Array.isArray(apptRows) && apptRows.length) {
          const currentAppt = apptRows[0] as any;
          if (currentAppt.availability_id) {
            await pool.query(
              `UPDATE availabilities 
               SET booked_slots = GREATEST(0, booked_slots - 1) 
               WHERE id = ?`,
              [currentAppt.availability_id]
            );
          }
        }
      } catch (updateErr) {
        console.error('Error decrementando booked_slots:', updateErr);
        // No fallar la actualización por este error
      }
    }
    // Recalcular facturación si cambió el doctor
    if (doctorChanged) {
      try {
        const [[billing]]: any = await pool.query('SELECT service_id FROM appointment_billing WHERE appointment_id = ? LIMIT 1', [id]);
        if (billing) {
          const [[appt]]: any = await pool.query('SELECT doctor_id FROM appointments WHERE id = ? LIMIT 1', [id]);
          if (appt) {
            const [[svc]]: any = await pool.query('SELECT base_price, currency FROM services WHERE id = ? LIMIT 1', [billing.service_id]);
            if (svc) {
              const [[override]]: any = await pool.query('SELECT price FROM doctor_service_prices WHERE doctor_id = ? AND service_id = ? AND active = 1 LIMIT 1', [appt.doctor_id, billing.service_id]);
              const base = Number(svc.base_price || 0);
              const doctorPrice = override ? Number(override.price) : null;
              const finalPrice = doctorPrice != null ? doctorPrice : base;
              await pool.query('UPDATE appointment_billing SET doctor_id = ?, base_price = ?, doctor_price = ?, final_price = ?, currency = ?, updated_at = CURRENT_TIMESTAMP WHERE appointment_id = ?', [appt.doctor_id, base, doctorPrice, finalPrice, svc.currency || 'COP', id]);
            }
          }
        }
      } catch { /* ignore recalculation errors */ }
    }

    // ================= Manejar cambio de availability_id =================
    if (d.availability_id && typeof d.availability_id === 'number') {
      try {
        // Obtener el availability_id anterior
        const [prevRows] = await pool.query('SELECT availability_id FROM appointments WHERE id = ? LIMIT 1', [id]);
        if (Array.isArray(prevRows) && prevRows.length) {
          const prevAppt = prevRows[0] as any;
          const oldAvailabilityId = prevAppt.availability_id;
          
          // Si cambió el availability_id, actualizar contadores
          if (oldAvailabilityId && oldAvailabilityId !== d.availability_id) {
            // Decrementar del availability anterior
            await pool.query(
              `UPDATE availabilities 
               SET booked_slots = GREATEST(0, booked_slots - 1) 
               WHERE id = ?`,
              [oldAvailabilityId]
            );
            
            // Incrementar en el nuevo availability
            await pool.query(
              `UPDATE availabilities 
               SET booked_slots = booked_slots + 1 
               WHERE id = ? AND booked_slots < capacity`,
              [d.availability_id]
            );
          }
        }
      } catch (updateErr) {
        console.error('Error actualizando contadores de availability:', updateErr);
        // No fallar la actualización por este error
      }
    }

    return res.json({ id, ...d });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Resumen de calendario por día en un rango [start, end]
// Devuelve conteos por fecha de citas y disponibilidades para pintar el calendario
router.get('/summary', requireAuth, async (req: Request, res: Response) => {
  const start = String(req.query.start || '');
  const end = String(req.query.end || '');
  if (!start || !end) return res.status(400).json({ message: 'start y end son requeridos (YYYY-MM-DD)' });
  try {
    const [apptRows] = await pool.query(
      `SELECT DATE(scheduled_at) AS date, COUNT(*) AS appointments
       FROM appointments
       WHERE DATE(scheduled_at) BETWEEN ? AND ?
       GROUP BY DATE(scheduled_at)
       ORDER BY DATE(scheduled_at)`,
      [start, end]
    );
    const [availRows] = await pool.query(
      `SELECT date, COUNT(*) AS availabilities
       FROM availabilities
       WHERE date BETWEEN ? AND ?
       GROUP BY date
       ORDER BY date`,
      [start, end]
    );

    const apptMap = new Map<string, number>();
    (Array.isArray(apptRows) ? (apptRows as any[]) : []).forEach(r => {
      const d = (r.date instanceof Date) ? r.date.toISOString().slice(0,10) : String(r.date);
      apptMap.set(d, Number(r.appointments) || 0);
    });
    const availMap = new Map<string, number>();
    (Array.isArray(availRows) ? (availRows as any[]) : []).forEach(r => {
      const d = (r.date instanceof Date) ? r.date.toISOString().slice(0,10) : String(r.date);
      availMap.set(d, Number(r.availabilities) || 0);
    });

    // Generar todas las fechas del rango para asegurar días con 0
    const by_day: Array<{ date: string; appointments: number; availabilities: number }> = [];
    const startDate = new Date(start + 'T00:00:00Z');
    const endDate = new Date(end + 'T00:00:00Z');
    for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      by_day.push({
        date: iso,
        appointments: apptMap.get(iso) || 0,
        availabilities: availMap.get(iso) || 0,
      });
    }

    return res.json({ by_day });
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Verificar conflictos de agenda para un doctor
router.get('/conflicts', requireAuth, async (req: Request, res: Response) => {
  const doctor_id = req.query.doctor_id ? Number(req.query.doctor_id) : undefined;
  const patient_id = req.query.patient_id ? Number(req.query.patient_id) : undefined;
  const room_id = req.query.room_id ? Number(req.query.room_id) : undefined;
  const scheduled_at = String(req.query.scheduled_at || '');
  const duration_minutes = req.query.duration_minutes ? Number(req.query.duration_minutes) : undefined;
  const exclude_id = req.query.exclude_id ? Number(req.query.exclude_id) : undefined;
  if ((!doctor_id && !patient_id && !room_id) || !scheduled_at || !duration_minutes) {
    return res.status(400).json({ message: 'scheduled_at y duration_minutes son requeridos, y al menos doctor_id o patient_id o room_id' });
  }
  try {
    let doctorItems: any[] = [];
    let patientItems: any[] = [];
    let roomItems: any[] = [];
    if (doctor_id) {
      const paramsD: any[] = [doctor_id, scheduled_at, duration_minutes, scheduled_at];
      let extraD = '';
      if (exclude_id && !Number.isNaN(exclude_id)) { extraD = ' AND id != ?'; paramsD.push(exclude_id); }
      const [rowsD] = await pool.query(
        `SELECT id, patient_id, scheduled_at, duration_minutes
         FROM appointments
         WHERE doctor_id = ? AND status != 'Cancelada'${extraD}
           AND scheduled_at < DATE_ADD(?, INTERVAL ? MINUTE)
           AND DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE) > ?
         ORDER BY scheduled_at
         LIMIT 5`,
        paramsD
      );
      doctorItems = Array.isArray(rowsD) ? (rowsD as any[]) : [];
    }
  if (patient_id) {
      const paramsP: any[] = [patient_id, scheduled_at, duration_minutes, scheduled_at];
      let extraP = '';
      if (exclude_id && !Number.isNaN(exclude_id)) { extraP = ' AND id != ?'; paramsP.push(exclude_id); }
      const [rowsP] = await pool.query(
        `SELECT id, patient_id, scheduled_at, duration_minutes
         FROM appointments
         WHERE patient_id = ? AND status != 'Cancelada'${extraP}
           AND scheduled_at < DATE_ADD(?, INTERVAL ? MINUTE)
           AND DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE) > ?
         ORDER BY scheduled_at
         LIMIT 5`,
        paramsP
      );
      patientItems = Array.isArray(rowsP) ? (rowsP as any[]) : [];
    }
    if (room_id && await hasRoomColumn()) {
      const paramsR: any[] = [room_id, scheduled_at, duration_minutes, scheduled_at];
      let extraR = '';
      if (exclude_id && !Number.isNaN(exclude_id)) { extraR = ' AND id != ?'; paramsR.push(exclude_id); }
      const [rowsR] = await pool.query(
        `SELECT id, patient_id, scheduled_at, duration_minutes
         FROM appointments
         WHERE room_id = ? AND status != 'Cancelada'${extraR}
           AND scheduled_at < DATE_ADD(?, INTERVAL ? MINUTE)
           AND DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE) > ?
         ORDER BY scheduled_at
         LIMIT 5`,
        paramsR
      );
      roomItems = Array.isArray(rowsR) ? (rowsR as any[]) : [];
    }
    return res.json({
      conflict: (doctorItems.length > 0) || (patientItems.length > 0) || (roomItems.length > 0),
      doctor_conflict: doctorItems.length > 0,
      patient_conflict: patientItems.length > 0,
      room_conflict: roomItems.length > 0,
      doctor_items: doctorItems,
      patient_items: patientItems,
      room_items: roomItems,
      items: doctorItems.length ? doctorItems : (patientItems.length ? patientItems : roomItems),
    });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Recalcular booked_slots de todas las disponibilidades (uso administrativo)
router.post('/recalc', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [availRows]: any = await pool.query('SELECT id FROM availabilities');
    for (const a of (Array.isArray(availRows) ? availRows : [])) {
      try {
        await pool.query('CALL recalc_availability_slots(?)', [a.id]);
      } catch { /* ignore individual */ }
    }
    return res.json({ success: true, message: 'Recalculo ejecutado' });
  } catch {
    return res.status(500).json({ success: false, message: 'Error durante recálculo'});
  }
});

// Obtener cola de espera agrupada por especialidad
router.get('/waiting-list', requireAuth, async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        wl.id,
        wl.patient_id,
        wl.scheduled_date,
        wl.priority_level,
        wl.call_type,
        wl.created_at,
        wl.reason,
        wl.notes,
        p.name AS patient_name,
        p.phone AS patient_phone,
        p.document AS patient_document,
        s.name AS specialty_name,
        s.id AS specialty_id,
        d.name AS doctor_name,
        l.name AS location_name,
        a.date AS appointment_date,
        a.start_time,
        CASE 
          WHEN wl.priority_level = 'Urgente' THEN 1
          WHEN wl.priority_level = 'Alta' THEN 2
          WHEN wl.priority_level = 'Normal' THEN 3
          WHEN wl.priority_level = 'Baja' THEN 4
          ELSE 5
        END AS priority_order
      FROM appointments_waiting_list wl
      INNER JOIN patients p ON wl.patient_id = p.id
      INNER JOIN availabilities a ON wl.availability_id = a.id
      INNER JOIN specialties s ON a.specialty_id = s.id
      INNER JOIN doctors d ON a.doctor_id = d.id
      INNER JOIN locations l ON a.location_id = l.id
      WHERE wl.status = 'pending'
      ORDER BY s.name, priority_order, wl.created_at
    `;

    const [rows]: any = await pool.query(query);
    
    // Agrupar por especialidad
    const groupedBySpecialty: any = {};
    
    for (const row of rows) {
      const specialtyKey = row.specialty_name;
      
      if (!groupedBySpecialty[specialtyKey]) {
        groupedBySpecialty[specialtyKey] = {
          specialty_id: row.specialty_id,
          specialty_name: row.specialty_name,
          total_waiting: 0,
          patients: []
        };
      }
      
      groupedBySpecialty[specialtyKey].total_waiting++;
      groupedBySpecialty[specialtyKey].patients.push({
        id: row.id,
        patient_id: row.patient_id,
        patient_name: row.patient_name,
        patient_phone: row.patient_phone,
        patient_document: row.patient_document,
        scheduled_date: row.scheduled_date,
        priority_level: row.priority_level,
        call_type: row.call_type, // 🔥 NUEVO: tipo de llamada (normal/reagendar)
        created_at: row.created_at,
        reason: row.reason,
        notes: row.notes,
        doctor_name: row.doctor_name,
        location_name: row.location_name,
        appointment_date: row.appointment_date,
        start_time: row.start_time,
        queue_position: groupedBySpecialty[specialtyKey].total_waiting
      });
    }
    
    // Convertir objeto a array
    const result = Object.values(groupedBySpecialty);
    
    // Calcular estadísticas generales
    const stats = {
      total_specialties: result.length,
      total_patients_waiting: rows.length,
      by_priority: {
        urgente: rows.filter((r: any) => r.priority_level === 'Urgente').length,
        alta: rows.filter((r: any) => r.priority_level === 'Alta').length,
        normal: rows.filter((r: any) => r.priority_level === 'Normal').length,
        baja: rows.filter((r: any) => r.priority_level === 'Baja').length
      }
    };

    return res.json({ 
      success: true, 
      data: result,
      stats: stats
    });

  } catch (error: any) {
    console.error('Error obteniendo cola de espera:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al obtener cola de espera',
      error: error.message 
    });
  }
});

// Obtener cola diaria (citas del día actual: en espera + otorgadas)
router.get('/daily-queue', requireAuth, async (req: Request, res: Response) => {
  try {
    // Permitir parámetro de fecha opcional, por defecto usar hoy
    const dateParam = req.query.date as string;
    let targetDate: Date;
    let targetDateStr: string;
    
    if (dateParam) {
      // Validar formato YYYY-MM-DD
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateParam)) {
        return res.status(400).json({
          success: false,
          error: 'Formato de fecha inválido. Use YYYY-MM-DD'
        });
      }
      targetDate = new Date(dateParam);
      targetDateStr = dateParam;
    } else {
      targetDate = new Date();
      targetDateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    console.log(`[DAILY-QUEUE] Consultando fecha: ${targetDateStr}`);

    // 1. Obtener citas en espera programadas para la fecha seleccionada
    const waitingQuery = `
      SELECT 
        'waiting' AS type,
        wl.id,
        wl.patient_id,pudes 
        wl.scheduled_date AS scheduled_at,
        wl.priority_level,
        wl.call_type,
        wl.status,
        wl.reason,
        wl.notes,
        wl.created_at,
        p.name AS patient_name,
        p.phone AS patient_phone,
        p.document AS patient_document,
        s.name AS specialty_name,
        s.id AS specialty_id,
        d.name AS doctor_name,
        d.id AS doctor_id,
        l.name AS location_name,
        l.id AS location_id,
        a.date AS appointment_date,
        a.start_time
      FROM appointments_waiting_list wl
      INNER JOIN patients p ON wl.patient_id = p.id
      INNER JOIN availabilities a ON wl.availability_id = a.id
      INNER JOIN specialties s ON a.specialty_id = s.id
      INNER JOIN doctors d ON a.doctor_id = d.id
      INNER JOIN locations l ON a.location_id = l.id
      WHERE wl.status = 'pending'
        AND DATE(a.date) = ?
      ORDER BY wl.priority_level, wl.created_at
    `;

    // 2. Obtener citas otorgadas programadas para la fecha seleccionada
    const appointmentsQuery = `
      SELECT 
        'appointment' AS type,
        app.id,
        app.patient_id,
        app.scheduled_at,
        app.priority_level,
        app.status,
        app.reason,
        app.notes,
        app.created_at,
        p.name AS patient_name,
        p.phone AS patient_phone,
        p.document AS patient_document,
        s.name AS specialty_name,
        s.id AS specialty_id,
        d.name AS doctor_name,
        d.id AS doctor_id,
        l.name AS location_name,
        l.id AS location_id,
        app.appointment_type,
        app.duration_minutes
      FROM appointments app
      INNER JOIN patients p ON app.patient_id = p.id
      INNER JOIN specialties s ON app.specialty_id = s.id
      INNER JOIN doctors d ON app.doctor_id = d.id
      INNER JOIN locations l ON app.location_id = l.id
      WHERE DATE(app.scheduled_at) = ?
      ORDER BY app.scheduled_at
    `;

    const [waitingRows]: any = await pool.query(waitingQuery, [targetDateStr]);
    const [appointmentRows]: any = await pool.query(appointmentsQuery, [targetDateStr]);

    // 3. Calcular estadísticas
    const stats = {
      total_waiting: waitingRows.length,
      total_scheduled: appointmentRows.length,
      total_today: waitingRows.length + appointmentRows.length,
      by_status: {
        pending: appointmentRows.filter((a: any) => a.status === 'Pendiente').length,
        confirmed: appointmentRows.filter((a: any) => a.status === 'Confirmada').length,
        completed: appointmentRows.filter((a: any) => a.status === 'Completada').length,
        cancelled: appointmentRows.filter((a: any) => a.status === 'Cancelada').length,
      },
      by_priority: {
        urgente: [...waitingRows, ...appointmentRows].filter((a: any) => a.priority_level === 'Urgente').length,
        alta: [...waitingRows, ...appointmentRows].filter((a: any) => a.priority_level === 'Alta').length,
        normal: [...waitingRows, ...appointmentRows].filter((a: any) => a.priority_level === 'Normal').length,
        baja: [...waitingRows, ...appointmentRows].filter((a: any) => a.priority_level === 'Baja').length,
      }
    };

    // 4. Agrupar por especialidad
    const groupedBySpecialty: any = {};

    // Agregar citas en espera
    for (const row of waitingRows) {
      const key = row.specialty_name;
      if (!groupedBySpecialty[key]) {
        groupedBySpecialty[key] = {
          specialty_id: row.specialty_id,
          specialty_name: row.specialty_name,
          waiting_count: 0,
          scheduled_count: 0,
          items: []
        };
      }
      groupedBySpecialty[key].waiting_count++;
      groupedBySpecialty[key].items.push({
        ...row,
        type: 'waiting'
      });
    }

    // Agregar citas otorgadas
    for (const row of appointmentRows) {
      const key = row.specialty_name;
      if (!groupedBySpecialty[key]) {
        groupedBySpecialty[key] = {
          specialty_id: row.specialty_id,
          specialty_name: row.specialty_name,
          waiting_count: 0,
          scheduled_count: 0,
          items: []
        };
      }
      groupedBySpecialty[key].scheduled_count++;
      groupedBySpecialty[key].items.push({
        ...row,
        type: 'appointment'
      });
    }

    // Ordenar items dentro de cada especialidad
    Object.values(groupedBySpecialty).forEach((group: any) => {
      group.items.sort((a: any, b: any) => {
        // Primero por tipo (waiting antes que appointment)
        if (a.type !== b.type) return a.type === 'waiting' ? -1 : 1;
        // Luego por hora programada
        return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      });
    });

    const data = Object.values(groupedBySpecialty);

    console.log(`[DAILY-QUEUE] Resultados - Fecha: ${targetDateStr}, Waiting: ${waitingRows.length}, Appointments: ${appointmentRows.length}, Grupos: ${data.length}`);

    // Desactivar caché para esta respuesta
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    return res.json({
      success: true,
      date: targetDateStr,
      data,
      stats
    });

  } catch (error: any) {
    console.error('Error obteniendo cola diaria:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al obtener cola diaria',
      error: error.message 
    });
  }
});

export default router;
