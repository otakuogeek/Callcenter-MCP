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
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

import { sendAppointmentConfirmationEmail } from '../services/mailer';

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data;
  try {
    // Validación: evitar que el mismo doctor tenga dos citas que se solapen en el tiempo
    try {
      const [confRows] = await pool.query(
        `SELECT id FROM appointments
         WHERE doctor_id = ? AND status != 'Cancelada'
           AND scheduled_at < DATE_ADD(?, INTERVAL ? MINUTE)
           AND DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE) > ?
         LIMIT 1`,
        [d.doctor_id, d.scheduled_at, d.duration_minutes, d.scheduled_at]
      );
      if (Array.isArray(confRows) && confRows.length) {
        return res.status(409).json({ message: 'Conflicto: el doctor ya tiene una cita que se solapa con ese horario.' });
      }
    } catch {/* ignore and continue, fallback to insert error if any */}

    // Validación: evitar que el mismo paciente tenga dos citas que se solapen
    // Validación: evitar que la misma sala/consultorio tenga solape (si existe columna room_id y se envía)
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
    try {
      const [confRowsP] = await pool.query(
        `SELECT id FROM appointments
         WHERE patient_id = ? AND status != 'Cancelada'
           AND scheduled_at < DATE_ADD(?, INTERVAL ? MINUTE)
           AND DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE) > ?
         LIMIT 1`,
        [d.patient_id, d.scheduled_at, d.duration_minutes, d.scheduled_at]
      );
      if (Array.isArray(confRowsP) && confRowsP.length) {
        return res.status(409).json({ message: 'Conflicto: el paciente ya tiene una cita que se solapa con ese horario.' });
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
    let cols = ['patient_id','availability_id','location_id','specialty_id','doctor_id','scheduled_at','duration_minutes','appointment_type','status','reason','insurance_type','notes','cancellation_reason','created_by_user_id'] as string[];
    let vals: any[] = [d.patient_id, availabilityIdToUse, d.location_id, d.specialty_id, d.doctor_id, d.scheduled_at, d.duration_minutes, d.appointment_type, d.status, d.reason ?? null, d.insurance_type ?? null, d.notes ?? null, d.cancellation_reason ?? null, (req as any).user?.id ?? null];
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

    return res.status(201).json(created);
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data;
  try {
    // Si se modifica doctor_id, scheduled_at o duration_minutes, validar conflictos
    if ('doctor_id' in d || 'scheduled_at' in d || 'duration_minutes' in d || 'room_id' in d) {
      const [rows] = await pool.query(`SELECT doctor_id, scheduled_at, duration_minutes, patient_id${await hasRoomColumn() ? ', room_id' : ''} FROM appointments WHERE id = ? LIMIT 1`, [id]);
      const current = Array.isArray(rows) && rows.length ? (rows as any)[0] : null;
      if (!current) return res.status(404).json({ message: 'Appointment not found' });
      const newDoctorId = typeof d.doctor_id === 'number' ? d.doctor_id : Number(current.doctor_id);
      const newScheduledAt = d.scheduled_at ?? current.scheduled_at;
      const newDuration = typeof d.duration_minutes === 'number' ? d.duration_minutes : Number(current.duration_minutes);
      const newPatientId = typeof d.patient_id === 'number' ? d.patient_id : Number(current.patient_id);
      const newRoomId = ('room_id' in d) ? (d as any).room_id : (await hasRoomColumn() ? (current as any).room_id : undefined);
      const [confRows] = await pool.query(
        `SELECT id FROM appointments
         WHERE doctor_id = ? AND status != 'Cancelada' AND id != ?
           AND scheduled_at < DATE_ADD(?, INTERVAL ? MINUTE)
           AND DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE) > ?
         LIMIT 1`,
        [newDoctorId, id, newScheduledAt, newDuration, newScheduledAt]
      );
      if (Array.isArray(confRows) && confRows.length) {
        return res.status(409).json({ message: 'Conflicto: el doctor ya tiene una cita que se solapa con ese horario.' });
      }

      const [confRowsP] = await pool.query(
        `SELECT id FROM appointments
         WHERE patient_id = ? AND status != 'Cancelada' AND id != ?
           AND scheduled_at < DATE_ADD(?, INTERVAL ? MINUTE)
           AND DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE) > ?
         LIMIT 1`,
        [newPatientId, id, newScheduledAt, newDuration, newScheduledAt]
      );
      if (Array.isArray(confRowsP) && confRowsP.length) {
        return res.status(409).json({ message: 'Conflicto: el paciente ya tiene una cita que se solapa con ese horario.' });
      }

      // Validar sala/consultorio si aplica
      if (await hasRoomColumn()) {
        const roomIdNum = Number(newRoomId);
        if (newRoomId != null && !Number.isNaN(roomIdNum)) {
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

export default router;
