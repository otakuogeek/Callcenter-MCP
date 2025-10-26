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
      `SELECT a.*, 
              p.name AS patient_name, 
              p.document AS patient_document, 
              p.phone AS patient_phone, 
              p.email AS patient_email,
              p.birth_date AS patient_birth_date,
              TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) AS age,
              eps.name AS patient_eps,
              d.name AS doctor_name, 
              s.name AS specialty_name, 
              l.name AS location_name
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       LEFT JOIN eps eps ON p.insurance_eps_id = eps.id
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

// ============= RESTAURAR CITA CANCELADA =============
router.post('/:id/restore', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ message: 'Invalid appointment id' });
  }

  try {
    // 1. Verificar que la cita existe y está cancelada
    const [apptRows] = await pool.query(
      `SELECT a.*, 
              p.name AS patient_name
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       WHERE a.id = ?
       LIMIT 1`,
      [id]
    );

    if (!Array.isArray(apptRows) || apptRows.length === 0) {
      return res.status(404).json({ message: 'Cita no encontrada' });
    }

    const appointment = apptRows[0] as any;

    if (appointment.status !== 'Cancelada') {
      return res.status(400).json({ 
        message: 'Solo se pueden restaurar citas canceladas',
        currentStatus: appointment.status
      });
    }

    // 2. Verificar que no haya conflictos con el paciente en el mismo día
    const [conflictRows] = await pool.query(
      `SELECT id FROM appointments
       WHERE patient_id = ? 
         AND id != ?
         AND status != 'Cancelada'
         AND DATE(scheduled_at) = DATE(?)
       LIMIT 1`,
      [appointment.patient_id, id, appointment.scheduled_at]
    );

    if (Array.isArray(conflictRows) && conflictRows.length > 0) {
      return res.status(409).json({ 
        message: 'El paciente ya tiene otra cita confirmada en este día. No se puede restaurar.',
        patientName: appointment.patient_name
      });
    }

    // 3. Si tiene availability_id, verificar que hay cupos disponibles
    if (appointment.availability_id) {
      const [availRows] = await pool.query(
        `SELECT id, capacity, booked_slots, status 
         FROM availabilities
         WHERE id = ?
         LIMIT 1`,
        [appointment.availability_id]
      );

      if (!Array.isArray(availRows) || availRows.length === 0) {
        return res.status(404).json({ 
          message: 'La agenda asociada ya no existe. No se puede restaurar.'
        });
      }

      const availability = availRows[0] as any;

      if (availability.status !== 'Activa') {
        return res.status(409).json({ 
          message: `La agenda ya no está activa (estado: ${availability.status}). No se puede restaurar.`
        });
      }

      if (availability.booked_slots >= availability.capacity) {
        return res.status(409).json({ 
          message: 'La agenda ya no tiene cupos disponibles. No se puede restaurar.',
          capacity: availability.capacity,
          booked: availability.booked_slots
        });
      }
    }

    // 4. Restaurar la cita a estado "Confirmada"
    await pool.query(
      `UPDATE appointments 
       SET status = 'Confirmada',
           cancellation_reason = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    );

    // 5. Incrementar booked_slots si tiene availability_id
    if (appointment.availability_id) {
      await pool.query(
        `UPDATE availabilities 
         SET booked_slots = booked_slots + 1
         WHERE id = ? AND booked_slots < capacity`,
        [appointment.availability_id]
      );
    }

    console.log(`✅ Cita ${id} restaurada exitosamente por el usuario`);

    return res.json({ 
      success: true,
      message: 'Cita restaurada exitosamente',
      appointmentId: id,
      patientName: appointment.patient_name,
      scheduledAt: appointment.scheduled_at
    });

  } catch (error) {
    console.error('❌ Error restaurando cita:', error);
    return res.status(500).json({ 
      message: 'Error al restaurar la cita',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
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
    // 🔥 FILTROS: Permitir filtrar por specialty_id o availability_id
    const specialtyId = req.query.specialty_id ? Number(req.query.specialty_id) : null;
    const availabilityId = req.query.availability_id ? Number(req.query.availability_id) : null;
    const statusFilter = (req.query.status as string) || 'pending';

    // Construir query dinámico
    let query = `
      SELECT 
        wl.id,
        wl.patient_id,
        wl.specialty_id AS wl_specialty_id,
        wl.availability_id AS wl_availability_id,
        wl.scheduled_date,
        wl.priority_level,
        wl.call_type,
        wl.created_at,
        wl.status,
        wl.reason,
        wl.notes,
        wl.cups_id,
        p.name AS patient_name,
        p.phone AS patient_phone,
        p.document AS patient_document,
        p.birth_date AS birth_date,
        p.insurance_eps_id AS eps_id,
        eps.name AS eps_name,
        COALESCE(s_direct.name, s_avail.name) AS specialty_name,
        COALESCE(s_direct.id, s_avail.id) AS specialty_id,
        d.name AS doctor_name,
        l.name AS location_name,
        a.date AS appointment_date,
        a.start_time,
        c.code AS cups_code,
        c.name AS cups_name,
        c.category AS cups_category,
        c.price AS cups_price,
        CASE 
          WHEN wl.priority_level = 'Urgente' THEN 1
          WHEN wl.priority_level = 'Alta' THEN 2
          WHEN wl.priority_level = 'Normal' THEN 3
          WHEN wl.priority_level = 'Baja' THEN 4
          ELSE 5
        END AS priority_order
      FROM appointments_waiting_list wl
      INNER JOIN patients p ON wl.patient_id = p.id
      LEFT JOIN eps ON p.insurance_eps_id = eps.id
      LEFT JOIN specialties s_direct ON wl.specialty_id = s_direct.id
      LEFT JOIN availabilities a ON wl.availability_id = a.id
      LEFT JOIN specialties s_avail ON a.specialty_id = s_avail.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN locations l ON a.location_id = l.id
      LEFT JOIN cups c ON wl.cups_id = c.id
      WHERE 1=1
    `;

    const params: any[] = [];

    // Filtro por status
    if (statusFilter && statusFilter !== 'all') {
      query += ' AND wl.status = ?';
      params.push(statusFilter);
    }

    // Filtro por specialty_id (prioridad sobre availability_id)
    if (specialtyId) {
      query += ' AND (wl.specialty_id = ? OR a.specialty_id = ?)';
      params.push(specialtyId, specialtyId);
    } else if (availabilityId) {
      query += ' AND wl.availability_id = ?';
      params.push(availabilityId);
    }

    query += ' ORDER BY COALESCE(s_direct.name, s_avail.name), priority_order, wl.created_at';

    const [rows]: any = await pool.query(query, params);
    
    // Agrupar por especialidad
    const groupedBySpecialty: any = {};
    
    for (const row of rows) {
      const specialtyKey = row.specialty_name || 'Sin especialidad';
      
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
        birth_date: row.birth_date,
        eps_id: row.eps_id,
        eps_name: row.eps_name,
        scheduled_date: row.scheduled_date,
        priority_level: row.priority_level,
        call_type: row.call_type,
        status: row.status,
        created_at: row.created_at,
        reason: row.reason,
        notes: row.notes,
        doctor_name: row.doctor_name || 'Sin asignar',
        location_name: row.location_name || 'Sin asignar',
        appointment_date: row.appointment_date,
        start_time: row.start_time,
        queue_position: groupedBySpecialty[specialtyKey].total_waiting,
        // Indicadores de organización
        organized_by: row.wl_specialty_id ? 'specialty' : 'availability',
        wl_specialty_id: row.wl_specialty_id,
        wl_availability_id: row.wl_availability_id,
        // Información del servicio CUPS
        cups_id: row.cups_id,
        cups_code: row.cups_code,
        cups_name: row.cups_name,
        cups_category: row.cups_category,
        cups_price: row.cups_price
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
      },
      by_status: {
        pending: rows.filter((r: any) => r.status === 'pending').length,
        reassigned: rows.filter((r: any) => r.status === 'reassigned').length,
        cancelled: rows.filter((r: any) => r.status === 'cancelled').length,
        expired: rows.filter((r: any) => r.status === 'expired').length
      },
      filters_applied: {
        specialty_id: specialtyId,
        availability_id: availabilityId,
        status: statusFilter
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
        wl.patient_id,
        wl.scheduled_date AS scheduled_at,
        wl.priority_level,
        wl.call_type,
        wl.status,
        wl.reason,
        wl.notes,
        wl.created_at,
        wl.cups_id,
        wl.availability_id,
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
        a.start_time,
        c.code AS cups_code,
        c.name AS cups_name,
        c.category AS cups_category,
        c.price AS cups_price
      FROM appointments_waiting_list wl
      INNER JOIN patients p ON wl.patient_id = p.id
      INNER JOIN availabilities a ON wl.availability_id = a.id
      INNER JOIN specialties s ON a.specialty_id = s.id
      INNER JOIN doctors d ON a.doctor_id = d.id
      INNER JOIN locations l ON a.location_id = l.id
      LEFT JOIN cups c ON wl.cups_id = c.id
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
        app.cups_id,
        app.availability_id,
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
        app.duration_minutes,
        c.code AS cups_code,
        c.name AS cups_name,
        c.category AS cups_category,
        c.price AS cups_price
      FROM appointments app
      INNER JOIN patients p ON app.patient_id = p.id
      INNER JOIN specialties s ON app.specialty_id = s.id
      INNER JOIN doctors d ON app.doctor_id = d.id
      INNER JOIN locations l ON app.location_id = l.id
      LEFT JOIN cups c ON app.cups_id = c.id
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
        type: 'scheduled' // Cambiado de 'appointment' a 'scheduled' para consistencia con el frontend
      });
    }

    // Ordenar items dentro de cada especialidad
    Object.values(groupedBySpecialty).forEach((group: any) => {
      group.items.sort((a: any, b: any) => {
        // Primero por tipo (waiting antes que scheduled)
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

// ===== AGREGAR A LISTA DE ESPERA POR ESPECIALIDAD =====
router.post('/waiting-list/by-specialty', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      patient_id,
      specialty_id,
      scheduled_date,
      priority_level = 'Normal',
      reason,
      notes,
      call_type = 'normal'
    } = req.body;

    // Validaciones
    if (!patient_id || !specialty_id || !scheduled_date || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Campos requeridos: patient_id, specialty_id, scheduled_date, reason'
      });
    }

    // Validar que el paciente existe
    const [patientCheck]: any = await pool.query(
      'SELECT id, name FROM patients WHERE id = ?',
      [patient_id]
    );

    if (patientCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    // Validar que la especialidad existe
    const [specialtyCheck]: any = await pool.query(
      'SELECT id, name FROM specialties WHERE id = ?',
      [specialty_id]
    );

    if (specialtyCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Especialidad no encontrada'
      });
    }

    // Calcular posición en la cola para esta especialidad
    const [queueCheck]: any = await pool.query(`
      SELECT COUNT(*) + 1 as queue_position
      FROM appointments_waiting_list
      WHERE (specialty_id = ? OR availability_id IN (
        SELECT id FROM availabilities WHERE specialty_id = ?
      ))
      AND status = 'pending'
    `, [specialty_id, specialty_id]);

    const queuePosition = queueCheck[0]?.queue_position || 1;

    // Insertar en lista de espera
    const [result]: any = await pool.query(`
      INSERT INTO appointments_waiting_list (
        patient_id,
        specialty_id,
        scheduled_date,
        priority_level,
        reason,
        notes,
        call_type,
        status,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
    `, [
      patient_id,
      specialty_id,
      scheduled_date,
      priority_level,
      reason,
      notes || null,
      call_type
    ]);

    const waitingListId = result.insertId;

    return res.status(201).json({
      success: true,
      message: 'Paciente agregado a lista de espera por especialidad',
      data: {
        waiting_list_id: waitingListId,
        patient_id,
        patient_name: patientCheck[0].name,
        specialty_id,
        specialty_name: specialtyCheck[0].name,
        scheduled_date,
        priority_level,
        queue_position: queuePosition,
        call_type,
        status: 'pending',
        organized_by: 'specialty'
      }
    });

  } catch (error: any) {
    console.error('Error agregando a lista de espera por especialidad:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al agregar a lista de espera',
      error: error.message
    });
  }
});

// DELETE - Eliminar paciente de la lista de espera
router.delete('/waiting-list/:id', requireAuth, async (req: Request, res: Response) => {
  const waitingListId = Number(req.params.id);

  if (Number.isNaN(waitingListId)) {
    return res.status(400).json({
      success: false,
      message: 'ID de lista de espera inválido'
    });
  }

  try {
    // Verificar que el registro existe
    const [existsCheck]: any = await pool.query(
      'SELECT id, patient_id FROM appointments_waiting_list WHERE id = ?',
      [waitingListId]
    );

    if (!existsCheck || existsCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro no encontrado en lista de espera'
      });
    }

    // Eliminar el registro
    await pool.query(
      'DELETE FROM appointments_waiting_list WHERE id = ?',
      [waitingListId]
    );

    console.log(`[WAITING-LIST-DELETE] Eliminado registro ID ${waitingListId}`);

    return res.status(200).json({
      success: true,
      message: 'Paciente eliminado de la cola de espera exitosamente',
      deleted_id: waitingListId
    });

  } catch (error: any) {
    console.error('[WAITING-LIST-DELETE] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar de lista de espera',
      error: error.message
    });
  }
});

// PATCH - Actualizar CUPS de una solicitud en lista de espera
router.patch('/waiting-list/:id/cups', requireAuth, async (req: Request, res: Response) => {
  const waitingListId = Number(req.params.id);
  const { cups_id } = req.body;

  if (Number.isNaN(waitingListId)) {
    return res.status(400).json({
      success: false,
      message: 'ID de lista de espera inválido'
    });
  }

  // Validar cups_id (puede ser null para eliminar, o un número para asignar/cambiar)
  if (cups_id !== null && cups_id !== undefined && (typeof cups_id !== 'number' || cups_id <= 0)) {
    return res.status(400).json({
      success: false,
      message: 'cups_id debe ser un número válido o null'
    });
  }

  try {
    // Verificar que el registro existe
    const [existsCheck]: any = await pool.query(
      'SELECT id, patient_id, cups_id FROM appointments_waiting_list WHERE id = ?',
      [waitingListId]
    );

    if (!existsCheck || existsCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro no encontrado en lista de espera'
      });
    }

    // Si cups_id no es null, verificar que existe en la tabla cups
    if (cups_id !== null) {
      const [cupsCheck]: any = await pool.query(
        'SELECT id, code, name FROM cups WHERE id = ? AND status = ?',
        [cups_id, 'Activo']
      );

      if (!cupsCheck || cupsCheck.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Código CUPS no encontrado o inactivo'
        });
      }
    }

    // Actualizar cups_id
    await pool.query(
      'UPDATE appointments_waiting_list SET cups_id = ?, updated_at = NOW() WHERE id = ?',
      [cups_id, waitingListId]
    );

    // Obtener datos actualizados con JOIN
    const [updated]: any = await pool.query(
      `SELECT 
        awl.id,
        awl.patient_id,
        awl.cups_id,
        c.code AS cups_code,
        c.name AS cups_name,
        c.category AS cups_category
      FROM appointments_waiting_list awl
      LEFT JOIN cups c ON awl.cups_id = c.id
      WHERE awl.id = ?`,
      [waitingListId]
    );

    const action = cups_id === null ? 'eliminado' : (existsCheck[0].cups_id ? 'actualizado' : 'asignado');
    
    console.log(`[WAITING-LIST-CUPS] CUPS ${action} para registro ID ${waitingListId}, cups_id: ${cups_id}`);

    return res.status(200).json({
      success: true,
      message: `CUPS ${action} exitosamente`,
      data: updated[0]
    });

  } catch (error: any) {
    console.error('[WAITING-LIST-CUPS] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar CUPS',
      error: error.message
    });
  }
});

// POST - Asignar cita desde lista de espera
router.post('/waiting-list/assign', requireAuth, async (req: Request, res: Response) => {
  const { waiting_list_id, availability_id, patient_id, reason, priority_level, cups_id } = req.body;

  // Validaciones
  if (!waiting_list_id || !availability_id || !patient_id) {
    return res.status(400).json({
      success: false,
      message: 'Faltan datos requeridos: waiting_list_id, availability_id, patient_id'
    });
  }

  try {
    // 1. Verificar que el registro existe en la lista de espera
    const [waitingEntry]: any = await pool.query(
      `SELECT 
        wl.*,
        p.name AS patient_name,
        p.phone AS patient_phone,
        wl.specialty_id
      FROM appointments_waiting_list wl
      INNER JOIN patients p ON wl.patient_id = p.id
      WHERE wl.id = ? AND wl.status = 'pending'`,
      [waiting_list_id]
    );

    if (!waitingEntry || waitingEntry.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro no encontrado en lista de espera o ya fue procesado'
      });
    }

    // 2. Verificar que la nueva agenda tiene cupos disponibles
    const [newAvailability]: any = await pool.query(
      `SELECT 
        a.id, a.specialty_id, a.doctor_id, a.location_id, a.date, a.start_time, a.end_time,
        a.capacity, a.booked_slots, (a.capacity - a.booked_slots) AS available_slots, 
        a.status, a.duration_minutes,
        s.name AS specialty_name,
        d.name AS doctor_name,
        l.name AS location_name
      FROM availabilities a
      INNER JOIN specialties s ON a.specialty_id = s.id
      INNER JOIN doctors d ON a.doctor_id = d.id
      INNER JOIN locations l ON a.location_id = l.id
      WHERE a.id = ? AND a.status = 'Activa' AND (a.capacity - a.booked_slots) > 0`,
      [availability_id]
    );

    if (!newAvailability || newAvailability.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'La agenda seleccionada no está disponible o no tiene cupos'
      });
    }

    const agenda = newAvailability[0];

    // 3. Crear la cita en la tabla appointments
    const scheduledAt = `${agenda.date.toISOString().split('T')[0]} ${agenda.start_time}`;
    
    const [insertResult]: any = await pool.query(
      `INSERT INTO appointments (
        patient_id,
        specialty_id,
        doctor_id,
        location_id,
        availability_id,
        scheduled_at,
        appointment_type,
        status,
        priority_level,
        reason,
        duration_minutes,
        cups_id,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        patient_id,
        agenda.specialty_id,
        agenda.doctor_id,
        agenda.location_id,
        availability_id,
        scheduledAt,
        'Presencial',
        'Confirmada',
        priority_level || 'Normal',
        reason || 'Asignado desde cola de espera',
        agenda.duration_minutes || 15,
        cups_id || null
      ]
    );

    const appointmentId = insertResult.insertId;

    // 4. Actualizar cupos de la agenda
    await pool.query(
      `UPDATE availabilities 
       SET booked_slots = booked_slots + 1
       WHERE id = ?`,
      [availability_id]
    );

    // 5. Eliminar de la lista de espera
    await pool.query(
      'DELETE FROM appointments_waiting_list WHERE id = ?',
      [waiting_list_id]
    );

    console.log(`[ASSIGN-FROM-QUEUE] Paciente ${waitingEntry[0].patient_name} asignado desde cola de espera. Cita ID: ${appointmentId}`);

    return res.status(201).json({
      success: true,
      message: 'Cita asignada exitosamente desde la cola de espera',
      data: {
        appointment_id: appointmentId,
        patient_id: patient_id,
        patient_name: waitingEntry[0].patient_name,
        doctor_name: agenda.doctor_name,
        location_name: agenda.location_name,
        specialty_name: agenda.specialty_name,
        scheduled_at: scheduledAt,
        removed_from_queue: waiting_list_id
      }
    });

  } catch (error: any) {
    console.error('[ASSIGN-FROM-QUEUE] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al asignar cita desde cola de espera',
      error: error.message
    });
  }
});

// GET - Vista del paciente: Ver sus propias citas y solicitudes en cola (solo lectura)
router.get('/my-appointments', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado'
      });
    }

    // Buscar el patient_id asociado al usuario
    const [userPatient]: any = await pool.query(
      'SELECT id, name, document, phone, email FROM patients WHERE user_id = ?',
      [userId]
    );

    if (!userPatient || userPatient.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró un paciente asociado a este usuario'
      });
    }

    const patientId = userPatient[0].id;
    const patientInfo = userPatient[0];

    // Obtener citas confirmadas/pendientes
    const [appointments]: any = await pool.query(
      `SELECT 
        a.id,
        a.scheduled_at,
        a.status,
        a.appointment_type,
        a.reason,
        a.duration_minutes,
        d.name AS doctor_name,
        s.name AS specialty_name,
        l.name AS location_name,
        l.address AS location_address,
        r.name AS room_name,
        c.code AS cups_code,
        c.name AS cups_name,
        c.category AS cups_category
      FROM appointments a
      INNER JOIN doctors d ON a.doctor_id = d.id
      INNER JOIN specialties s ON a.specialty_id = s.id
      INNER JOIN locations l ON a.location_id = l.id
      LEFT JOIN rooms r ON a.room_id = r.id
      LEFT JOIN cups c ON a.cups_id = c.id
      WHERE a.patient_id = ?
        AND a.status IN ('Pendiente', 'Confirmada')
        AND a.scheduled_at >= CURDATE()
      ORDER BY a.scheduled_at ASC`,
      [patientId]
    );

    // Obtener solicitudes en lista de espera con posición calculada
    const [waitingList]: any = await pool.query(
      `SELECT 
        awl.id,
        awl.created_at,
        awl.priority_level,
        awl.reason,
        awl.status,
        awl.call_type,
        awl.scheduled_date,
        awl.specialty_id,
        awl.availability_id,
        COALESCE(s.name, s2.name) AS specialty_name,
        d.name AS doctor_name,
        l.name AS location_name,
        c.code AS cups_code,
        c.name AS cups_name,
        c.category AS cups_category,
        (
          SELECT COUNT(*) + 1
          FROM appointments_waiting_list awl2
          LEFT JOIN availabilities av2 ON awl2.availability_id = av2.id
          WHERE awl2.status = 'pending'
            AND (
              (awl.specialty_id IS NOT NULL AND (awl2.specialty_id = awl.specialty_id OR av2.specialty_id = awl.specialty_id))
              OR
              (awl.availability_id IS NOT NULL AND av2.specialty_id = (SELECT specialty_id FROM availabilities WHERE id = awl.availability_id))
            )
            AND (
              awl2.priority_level > awl.priority_level
              OR (awl2.priority_level = awl.priority_level AND awl2.created_at < awl.created_at)
            )
        ) AS queue_position
      FROM appointments_waiting_list awl
      LEFT JOIN availabilities av ON awl.availability_id = av.id
      LEFT JOIN specialties s ON av.specialty_id = s.id
      LEFT JOIN specialties s2 ON awl.specialty_id = s2.id
      LEFT JOIN doctors d ON av.doctor_id = d.id
      LEFT JOIN locations l ON av.location_id = l.id
      LEFT JOIN cups c ON awl.cups_id = c.id
      WHERE awl.patient_id = ?
        AND awl.status = 'pending'
      ORDER BY awl.id ASC`,
      [patientId]
    );

    console.log(`[MY-APPOINTMENTS] Usuario ${userId} consultó sus citas (${appointments.length} citas, ${waitingList.length} en cola)`);

    return res.status(200).json({
      success: true,
      data: {
        patient: patientInfo,
        appointments: appointments || [],
        waiting_list: waitingList || [],
        summary: {
          total_appointments: appointments.length,
          total_waiting: waitingList.length
        }
      }
    });

  } catch (error: any) {
    console.error('[MY-APPOINTMENTS] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener citas del paciente',
      error: error.message
    });
  }
});

// =====================================================
// ENDPOINT: Cancelar cita y ofrecer cupo a cola de espera
// =====================================================
router.post('/cancel-and-reassign', requireAuth, async (req: Request, res: Response) => {
  const { appointment_id, cancellation_reason, auto_assign } = req.body;

  if (!appointment_id) {
    return res.status(400).json({
      success: false,
      message: 'Se requiere appointment_id'
    });
  }

  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // 1. Obtener información de la cita antes de cancelarla
    const [appointmentRows]: any = await connection.query(
      `SELECT 
        a.id,
        a.patient_id,
        a.specialty_id,
        a.doctor_id,
        a.availability_id,
        a.scheduled_at,
        a.status,
        p.name AS patient_name,
        s.name AS specialty_name,
        d.name AS doctor_name,
        av.date AS availability_date,
        av.start_time,
        av.capacity,
        av.booked_slots
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN specialties s ON a.specialty_id = s.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN availabilities av ON a.availability_id = av.id
      WHERE a.id = ?`,
      [appointment_id]
    );

    if (!appointmentRows || appointmentRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Cita no encontrada'
      });
    }

    const appointment = appointmentRows[0];

    if (appointment.status === 'Cancelada') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'La cita ya está cancelada'
      });
    }

    // 2. Cancelar la cita
    await connection.query(
      `UPDATE appointments 
       SET status = 'Cancelada',
           cancellation_reason = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [cancellation_reason || 'Cancelada por el sistema', appointment_id]
    );

    // 3. Liberar el cupo en availability
    if (appointment.availability_id) {
      await connection.query(
        `UPDATE availabilities 
         SET booked_slots = GREATEST(0, booked_slots - 1)
         WHERE id = ?`,
        [appointment.availability_id]
      );
    }

    // 4. Buscar siguiente paciente en cola de espera de la misma especialidad
    let nextPatient = null;
    let reassignmentResult = null;

    if (appointment.specialty_id && appointment.availability_id) {
      const [waitingListRows]: any = await connection.query(
        `SELECT 
          wl.id AS waiting_list_id,
          wl.patient_id,
          wl.reason,
          wl.priority_level,
          wl.cups_id,
          wl.created_at,
          p.name AS patient_name,
          p.phone AS patient_phone,
          p.document AS patient_document,
          CASE 
            WHEN wl.priority_level = 'Urgente' THEN 1
            WHEN wl.priority_level = 'Alta' THEN 2
            WHEN wl.priority_level = 'Normal' THEN 3
            WHEN wl.priority_level = 'Baja' THEN 4
            ELSE 5
          END AS priority_order
        FROM appointments_waiting_list wl
        INNER JOIN patients p ON wl.patient_id = p.id
        WHERE wl.specialty_id = ?
          AND wl.status = 'pending'
        ORDER BY priority_order ASC, wl.created_at ASC
        LIMIT 1`,
        [appointment.specialty_id]
      );

      if (waitingListRows && waitingListRows.length > 0) {
        nextPatient = waitingListRows[0];

        // 5. Si auto_assign es true, asignar automáticamente
        if (auto_assign === true) {
          // Crear la nueva cita
          const scheduledAt = `${appointment.availability_date} ${appointment.start_time}`;
          
          const [insertResult]: any = await connection.query(
            `INSERT INTO appointments (
              patient_id,
              specialty_id,
              doctor_id,
              location_id,
              availability_id,
              scheduled_at,
              appointment_type,
              status,
              priority_level,
              reason,
              duration_minutes,
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'Presencial', 'Confirmada', ?, ?, 15, CURRENT_TIMESTAMP)`,
            [
              nextPatient.patient_id,
              appointment.specialty_id,
              appointment.doctor_id,
              null, // location_id se puede obtener de availability si es necesario
              appointment.availability_id,
              scheduledAt,
              nextPatient.priority_level || 'Normal',
              nextPatient.reason || 'Asignado desde lista de espera'
            ]
          );

          const newAppointmentId = insertResult.insertId;

          // Incrementar booked_slots nuevamente
          await connection.query(
            `UPDATE availabilities 
             SET booked_slots = booked_slots + 1
             WHERE id = ?`,
            [appointment.availability_id]
          );

          // Eliminar de la lista de espera
          await connection.query(
            `DELETE FROM appointments_waiting_list WHERE id = ?`,
            [nextPatient.waiting_list_id]
          );

          reassignmentResult = {
            assigned: true,
            new_appointment_id: newAppointmentId,
            patient_assigned: nextPatient.patient_name
          };
        }
      }
    }

    await connection.commit();
    connection.release();

    return res.status(200).json({
      success: true,
      message: 'Cita cancelada exitosamente',
      data: {
        cancelled_appointment: {
          id: appointment.id,
          patient_name: appointment.patient_name,
          specialty_name: appointment.specialty_name,
          doctor_name: appointment.doctor_name
        },
        slot_freed: true,
        next_in_queue: nextPatient ? {
          waiting_list_id: nextPatient.waiting_list_id,
          patient_id: nextPatient.patient_id,
          patient_name: nextPatient.patient_name,
          patient_phone: nextPatient.patient_phone,
          patient_document: nextPatient.patient_document,
          priority_level: nextPatient.priority_level,
          reason: nextPatient.reason
        } : null,
        reassignment: reassignmentResult
      }
    });

  } catch (error: any) {
    await connection.rollback();
    connection.release();
    console.error('[CANCEL-AND-REASSIGN] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al cancelar cita',
      error: error.message
    });
  }
});

export default router;
