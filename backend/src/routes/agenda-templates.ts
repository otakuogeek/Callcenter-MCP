import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

// Utilidades
function parseJsonArray<T=any>(value:any, fallback:any[]=[]): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') { try { const p = JSON.parse(value); return Array.isArray(p)? p : fallback; } catch { return fallback; } }
  return fallback;
}
function validateTimeSlots(slots:any[]): { ok:boolean; error?:string } {
  const norm = slots.map(s=> ({ start:s.start, end:s.end, capacity:Number(s.capacity)||1 }));
  for (const s of norm) {
    if (!/^\d{2}:\d{2}$/.test(s.start) || !/^\d{2}:\d{2}$/.test(s.end)) return { ok:false, error:'Formato de hora inválido'};
    if (s.start >= s.end) return { ok:false, error:'Hora de inicio debe ser < hora fin'};
  }
  const sorted=[...norm].sort((a,b)=> a.start.localeCompare(b.start));
  for (let i=1;i<sorted.length;i++) if (sorted[i].start < sorted[i-1].end) return { ok:false, error:'Horarios solapados'};
  return { ok:true };
}

const router = Router();

// Middleware de autenticación para todas las rutas
router.use(requireAuth);

// Schema para validación de plantillas
const templateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  doctor_id: z.number().optional(),
  specialty_id: z.number().optional(),
  location_id: z.number().optional(),
  days_of_week: z.any(), // se normaliza
  time_slots: z.any(),
  duration_minutes: z.number().min(15).max(240).default(30),
  break_between_slots: z.number().min(0).max(60).default(0),
  active: z.boolean().default(true)
});

const bulkGenerationSchema = z.object({
  template_id: z.number(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  exclude_holidays: z.boolean().default(true)
});

// Listado con filtros
router.get('/', async (req: Request, res: Response) => {
  try {
    const { doctor_id, specialty_id, location_id, active } = req.query;
    const cond:string[]=[]; const params:any[]=[];
    if (doctor_id) { cond.push('at.doctor_id = ?'); params.push(doctor_id); }
    if (specialty_id) { cond.push('at.specialty_id = ?'); params.push(specialty_id); }
    if (location_id) { cond.push('at.location_id = ?'); params.push(location_id); }
    if (typeof active !== 'undefined') { cond.push('at.active = ?'); params.push(active === 'true' ? 1 : 0); }
    const where = cond.length? 'WHERE '+cond.join(' AND ') : '';
    const [rows] = await pool.query(`SELECT at.*, d.name as doctor_name, s.name as specialty_name, l.name as location_name
       FROM agenda_templates at
       LEFT JOIN doctors d ON at.doctor_id = d.id
       LEFT JOIN specialties s ON at.specialty_id = s.id
       LEFT JOIN locations l ON at.location_id = l.id
       ${where}
       ORDER BY at.created_at DESC`, params);
    res.json({ success:true, data: rows });
  } catch (e) {
    console.error('Error getting agenda templates:', e);
    res.status(500).json({ success:false, error:'Error al obtener plantillas' });
  }
});

// Obtener una
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(`SELECT at.*, d.name as doctor_name, s.name as specialty_name, l.name as location_name
      FROM agenda_templates at
      LEFT JOIN doctors d ON at.doctor_id = d.id
      LEFT JOIN specialties s ON at.specialty_id = s.id
      LEFT JOIN locations l ON at.location_id = l.id
      WHERE at.id = ?`, [id]) as any;
    if (!rows.length) return res.status(404).json({ success:false, error:'Plantilla no encontrada' });
    res.json({ success:true, data: rows[0] });
  } catch { res.status(500).json({ success:false, error:'Error al obtener plantilla' }); }
});

// Crear nueva plantilla
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = { ...req.body };
    body.days_of_week = parseJsonArray(body.days_of_week, []);
    body.time_slots = parseJsonArray(body.time_slots, []);
    const data = templateSchema.parse(body);
    const validation = validateTimeSlots(data.time_slots);
    if (!validation.ok) return res.status(400).json({ success:false, error: validation.error });
    const [result] = await pool.query(`INSERT INTO agenda_templates
      (name, description, doctor_id, specialty_id, location_id, days_of_week, time_slots, duration_minutes, break_between_slots, active, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?, NOW())`,[
        data.name,
        data.description || null,
        data.doctor_id || null,
        data.specialty_id || null,
        data.location_id || null,
        JSON.stringify(data.days_of_week),
        JSON.stringify(data.time_slots),
        data.duration_minutes,
        data.break_between_slots,
        data.active
      ]) as any;
    res.json({ success:true, data:{ id: result.insertId, ...data }, message:'Plantilla creada exitosamente' });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ success:false, error:'Datos inválidos', details:error.errors });
    console.error('Error creating agenda template:', error);
    res.status(500).json({ success:false, error:'Error al crear plantilla' });
  }
});

// Generar disponibilidades masivas desde plantilla
router.post('/generate-bulk', async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
  const data = bulkGenerationSchema.parse(req.body);
  const skipExisting = (req.body.skip_existing !== false); // default true
    
    await connection.beginTransaction();

    // Obtener plantilla
    const [templateRows] = await connection.query(
      'SELECT * FROM agenda_templates WHERE id = ? AND active = true',
      [data.template_id]
    ) as any;

    if (!templateRows.length) {
      throw new Error('Plantilla no encontrada o inactiva');
    }

    const template = templateRows[0];
    const daysOfWeek = JSON.parse(template.days_of_week);
    const timeSlots = JSON.parse(template.time_slots);

    // Obtener feriados si se excluyen
    let holidays: string[] = [];
    if (data.exclude_holidays) {
      const [holidayRows] = await connection.query(
        'SELECT date FROM holidays WHERE date BETWEEN ? AND ?',
        [data.start_date, data.end_date]
      ) as any;
      holidays = holidayRows.map((h: any) => h.date);
    }

  const generatedSlots: any[] = [];
  let skippedConflicts = 0;
    const currentDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay(); // Convertir domingo
      const dateStr = currentDate.toISOString().split('T')[0];

      // Verificar si el día está en la plantilla y no es feriado
      if (daysOfWeek.includes(dayOfWeek) && !holidays.includes(dateStr)) {
        for (const slot of timeSlots) {
          if (skipExisting) {
            const [existing] = await connection.query(`SELECT id FROM availability_slots
              WHERE doctor_id <=> ? AND specialty_id <=> ? AND location_id <=> ?
                AND date = ? AND time_start < ? AND time_end > ? LIMIT 1`,
                [template.doctor_id, template.specialty_id, template.location_id, dateStr, slot.end, slot.start]) as any;
            if (existing.length) { skippedConflicts++; continue; }
          }
          const [result] = await connection.query(`INSERT INTO availability_slots
             (doctor_id, specialty_id, location_id, date, time_start, time_end, capacity, duration_minutes, created_from_template, template_id)
             VALUES (?,?,?,?,?,?,?,?, true, ?)`,[
              template.doctor_id,
              template.specialty_id,
              template.location_id,
              dateStr,
              slot.start,
              slot.end,
              slot.capacity || 1,
              template.duration_minutes,
              template.id
             ]) as any;
          generatedSlots.push({ id: result.insertId, date: dateStr, time_start: slot.start, time_end: slot.end, capacity: slot.capacity || 1 });
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    await connection.commit();

  res.json({ success:true, data:{ generated_count: generatedSlots.length, skipped_conflicts: skippedConflicts, slots: generatedSlots }, message:`Se generaron ${generatedSlots.length} slots. Conflictos omitidos: ${skippedConflicts}` });

  } catch (error) {
    await connection.rollback();
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Datos inválidos', 
        details: error.errors 
      });
    }
    console.error('Error generating bulk availability:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error al generar disponibilidades' 
    });
  } finally {
    connection.release();
  }
});

// Actualizar plantilla
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const body = { ...req.body };
    body.days_of_week = parseJsonArray(body.days_of_week, []);
    body.time_slots = parseJsonArray(body.time_slots, []);
    const data = templateSchema.parse(body);
    const validation = validateTimeSlots(data.time_slots);
    if (!validation.ok) return res.status(400).json({ success:false, error: validation.error });
    const [result] = await pool.query(`UPDATE agenda_templates SET name=?, description=?, doctor_id=?, specialty_id=?, location_id=?, days_of_week=?, time_slots=?, duration_minutes=?, break_between_slots=?, active=?, updated_at=NOW() WHERE id = ?`,[
      data.name, data.description || null, data.doctor_id || null, data.specialty_id || null, data.location_id || null, JSON.stringify(data.days_of_week), JSON.stringify(data.time_slots), data.duration_minutes, data.break_between_slots, data.active, id
    ]) as any;
    if (result.affectedRows === 0) return res.status(404).json({ success:false, error:'Plantilla no encontrada' });
    res.json({ success:true, message:'Plantilla actualizada exitosamente' });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ success:false, error:'Datos inválidos', details:error.errors });
    console.error('Error updating agenda template:', error);
    res.status(500).json({ success:false, error:'Error al actualizar plantilla' });
  }
});

// Duplicar
router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query('SELECT * FROM agenda_templates WHERE id = ?', [id]) as any;
    if (!rows.length) return res.status(404).json({ success:false, error:'Plantilla no encontrada' });
    const tpl = rows[0];
    const [result] = await pool.query(`INSERT INTO agenda_templates (name, description, doctor_id, specialty_id, location_id, days_of_week, time_slots, duration_minutes, break_between_slots, active, created_at) VALUES (?,?,?,?,?,?,?,?,?,?, NOW())`,[
      tpl.name + ' (Copia)', tpl.description, tpl.doctor_id, tpl.specialty_id, tpl.location_id, tpl.days_of_week, tpl.time_slots, tpl.duration_minutes, tpl.break_between_slots, tpl.active
    ]) as any;
    res.json({ success:true, data:{ id: result.insertId }, message:'Plantilla duplicada' });
  } catch (e) {
    console.error('Duplicate template error', e);
    res.status(500).json({ success:false, error:'Error al duplicar plantilla' });
  }
});

// Eliminar plantilla
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    const [result] = await pool.query(
      'DELETE FROM agenda_templates WHERE id = ?',
      [id]
    ) as any;

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Plantilla no encontrada' });
    }

    res.json({ 
      success: true, 
      message: 'Plantilla eliminada exitosamente' 
    });
  } catch (error) {
    console.error('Error deleting agenda template:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar plantilla' });
  }
});

export default router;
