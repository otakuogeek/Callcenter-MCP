import pool from '../db/pool';

export interface RandomPreallocationParams {
  target_date: string; // YYYY-MM-DD (fecha de la cita / availability)
  total_slots: number; // capacidad total a distribuir
  publish_date?: string; // día desde el que empiezan a liberarse (default hoy)
  doctor_id?: number;
  location_id?: number;
  specialty_id?: number;
  availability_id?: number; // id del availability recién creado (opcional)
  apply?: boolean; // si se debe persistir
}

export interface RandomPreallocationResult {
  target_date: string;
  publish_date: string;
  working_days: number;
  distribution: { date: string; assigned: number }[];
  stats: {
    total: number;
    average_per_day: number;
    std_deviation: number;
    max_assigned: number;
    min_assigned: number;
  };
  persisted: boolean;
  persisted_rows: number;
}

// Utilidad reutilizable para generar y (opcionalmente) persistir la distribución aleatoria.
export async function generateRandomPreallocation(params: RandomPreallocationParams): Promise<RandomPreallocationResult> {
  const today = new Date();
  const publishDate = params.publish_date ? new Date(params.publish_date) : today;
  const targetDate = new Date(params.target_date);
  publishDate.setHours(0,0,0,0); targetDate.setHours(0,0,0,0);

  if (targetDate <= publishDate) {
    throw new Error('La fecha de atención debe ser posterior a la fecha de publicación.');
  }

  // Construir días hábiles (lunes-viernes) desde publishDate hasta el día anterior
  const workingDays: { date: string; weekday: number }[] = [];
  const cursor = new Date(publishDate);
  while (cursor < targetDate) {
    const wd = cursor.getDay();
    if (wd !== 0 && wd !== 6) {
      workingDays.push({ date: cursor.toISOString().split('T')[0], weekday: wd });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (!workingDays.length) {
    throw new Error('No hay días hábiles disponibles antes de la fecha de atención.');
  }

  const plan = workingDays.map(d => ({ date: d.date, assigned: 0 }));
  let remaining = params.total_slots;
  const theoreticalMax = Math.max(5, Math.ceil(params.total_slots * 0.5));
  for (let i = 0; i < plan.length && remaining > plan.length - i; i++) {
    plan[i].assigned += 1;
    remaining -= 1;
  }
  while (remaining > 0) {
    const idx = Math.floor(Math.random() * plan.length);
    if (plan[idx].assigned < theoreticalMax) {
      plan[idx].assigned += 1;
      remaining -= 1;
    }
  }
  plan.sort(() => Math.random() - 0.5);

  const totalAssigned = plan.reduce((s, d) => s + d.assigned, 0);
  const avg = totalAssigned / plan.length;
  const variance = plan.reduce((s,d)=> s + Math.pow(d.assigned - avg,2),0)/plan.length;
  const stddev = Math.sqrt(variance);

  let persisted = false;
  let persistedCount = 0;
  if (params.apply) {
    try {
      // Crear tabla si no existe (versión nueva)
      await pool.query(`CREATE TABLE IF NOT EXISTS scheduling_preallocation (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        doctor_id BIGINT NULL,
        specialty_id INT NULL,
        location_id INT NULL,
        availability_id BIGINT NULL,
        target_date DATE NOT NULL,
        pre_date DATE NOT NULL,
        slots INT NOT NULL,
        assigned_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_availability (availability_id),
        INDEX idx_target (target_date),
        INDEX idx_pre_date (pre_date)
      ) ENGINE=InnoDB`);

      // Detectar columnas faltantes (instalaciones anteriores)
      const [colRows]: any = await pool.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'scheduling_preallocation'`);
      const cols = new Set((Array.isArray(colRows)?colRows:[]).map((r:any)=>r.COLUMN_NAME));
      const alterStmts: string[] = [];
      if (!cols.has('availability_id')) alterStmts.push('ADD COLUMN availability_id BIGINT NULL AFTER location_id, ADD INDEX idx_availability (availability_id)');
      if (!cols.has('assigned_count')) alterStmts.push('ADD COLUMN assigned_count INT NOT NULL DEFAULT 0 AFTER slots');
      if (alterStmts.length) {
        try { await pool.query(`ALTER TABLE scheduling_preallocation ${alterStmts.join(', ')}`); } catch {/* ignore */}
      }

      // Tabla de asignaciones
      await pool.query(`CREATE TABLE IF NOT EXISTS scheduling_preallocation_assignments (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        preallocation_id BIGINT UNSIGNED NOT NULL,
        patient_id BIGINT UNSIGNED NOT NULL,
        appointment_id BIGINT UNSIGNED NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_preallocation_assignment FOREIGN KEY (preallocation_id) REFERENCES scheduling_preallocation(id) ON DELETE CASCADE,
        INDEX idx_patient (patient_id)
      ) ENGINE=InnoDB`);

      const insertValues: any[] = [];
      for (const row of plan) {
        if (row.assigned > 0) {
          insertValues.push([
            params.doctor_id || null,
            params.specialty_id || null,
            params.location_id || null,
            params.availability_id || null,
            params.target_date,
            row.date,
            row.assigned
          ]);
        }
      }
      if (insertValues.length) {
        await pool.query(
          `INSERT INTO scheduling_preallocation 
           (doctor_id, specialty_id, location_id, availability_id, target_date, pre_date, slots)
           VALUES ?`, [insertValues]
        );
        persisted = true;
        persistedCount = insertValues.length;
      }
    } catch (e) {
      console.warn('No se pudo persistir scheduling_preallocation:', e);
    }
  }

  return {
    target_date: params.target_date,
    publish_date: publishDate.toISOString().split('T')[0],
    working_days: plan.length,
    distribution: plan,
    stats: {
      total: totalAssigned,
      average_per_day: avg,
      std_deviation: Number(stddev.toFixed(2)),
      max_assigned: Math.max(...plan.map(p => p.assigned)),
      min_assigned: Math.min(...plan.map(p => p.assigned))
    },
    persisted,
    persisted_rows: persistedCount
  };
}
