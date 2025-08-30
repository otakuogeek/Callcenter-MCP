import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

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
  days_of_week: z.string(), // JSON array de días [1,2,3,4,5]
  time_slots: z.string(), // JSON array de horarios [{"start":"08:00","end":"12:00","capacity":4}]
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

// Obtener todas las plantillas
router.get('/', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        at.*,
        d.name as doctor_name,
        s.name as specialty_name,
        l.name as location_name
      FROM agenda_templates at
      LEFT JOIN doctors d ON at.doctor_id = d.id
      LEFT JOIN specialties s ON at.specialty_id = s.id
      LEFT JOIN locations l ON at.location_id = l.id
      ORDER BY at.created_at DESC
    `);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error getting agenda templates:', error);
    res.status(500).json({ success: false, error: 'Error al obtener plantillas' });
  }
});

// Crear nueva plantilla
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = templateSchema.parse(req.body);
    
    const [result] = await pool.query(
      `INSERT INTO agenda_templates 
       (name, description, doctor_id, specialty_id, location_id, days_of_week, 
        time_slots, duration_minutes, break_between_slots, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        data.name,
        data.description || null,
        data.doctor_id || null,
        data.specialty_id || null,
        data.location_id || null,
        data.days_of_week,
        data.time_slots,
        data.duration_minutes,
        data.break_between_slots,
        data.active
      ]
    ) as any;

    res.json({ 
      success: true, 
      data: { id: result.insertId, ...data },
      message: 'Plantilla creada exitosamente' 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Datos inválidos', 
        details: error.errors 
      });
    }
    console.error('Error creating agenda template:', error);
    res.status(500).json({ success: false, error: 'Error al crear plantilla' });
  }
});

// Generar disponibilidades masivas desde plantilla
router.post('/generate-bulk', async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const data = bulkGenerationSchema.parse(req.body);
    
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

    const generatedSlots = [];
    const currentDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay(); // Convertir domingo
      const dateStr = currentDate.toISOString().split('T')[0];

      // Verificar si el día está en la plantilla y no es feriado
      if (daysOfWeek.includes(dayOfWeek) && !holidays.includes(dateStr)) {
        for (const slot of timeSlots) {
          const [result] = await connection.query(
            `INSERT INTO availability_slots 
             (doctor_id, specialty_id, location_id, date, time_start, time_end, 
              capacity, duration_minutes, created_from_template, template_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, true, ?)`,
            [
              template.doctor_id,
              template.specialty_id,
              template.location_id,
              dateStr,
              slot.start,
              slot.end,
              slot.capacity || 1,
              template.duration_minutes,
              template.id
            ]
          ) as any;

          generatedSlots.push({
            id: result.insertId,
            date: dateStr,
            time_start: slot.start,
            time_end: slot.end,
            capacity: slot.capacity || 1
          });
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    await connection.commit();

    res.json({
      success: true,
      data: {
        generated_count: generatedSlots.length,
        slots: generatedSlots
      },
      message: `Se generaron ${generatedSlots.length} disponibilidades exitosamente`
    });

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
    const data = templateSchema.parse(req.body);

    const [result] = await pool.query(
      `UPDATE agenda_templates 
       SET name = ?, description = ?, doctor_id = ?, specialty_id = ?, location_id = ?, 
           days_of_week = ?, time_slots = ?, duration_minutes = ?, break_between_slots = ?, 
           active = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        data.name,
        data.description || null,
        data.doctor_id || null,
        data.specialty_id || null,
        data.location_id || null,
        data.days_of_week,
        data.time_slots,
        data.duration_minutes,
        data.break_between_slots,
        data.active,
        id
      ]
    ) as any;

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Plantilla no encontrada' });
    }

    res.json({ 
      success: true, 
      message: 'Plantilla actualizada exitosamente' 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Datos inválidos', 
        details: error.errors 
      });
    }
    console.error('Error updating agenda template:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar plantilla' });
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

// Obtener estadísticas de uso de plantillas
router.get('/usage-stats', async (req: Request, res: Response) => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        at.id,
        at.name,
        COUNT(a.id) as total_availabilities,
        COUNT(DISTINCT DATE(a.date)) as days_used,
        AVG(a.capacity) as avg_capacity,
        SUM(a.booked_slots) as total_booked,
        MAX(a.created_at) as last_used
      FROM agenda_templates at
      LEFT JOIN availabilities a ON a.template_id = at.id
      GROUP BY at.id, at.name
      ORDER BY total_availabilities DESC
    `);

    const [totalStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_templates,
        COUNT(CASE WHEN active = 1 THEN 1 END) as active_templates,
        AVG(duration_minutes) as avg_duration
      FROM agenda_templates
    `) as any;

    res.json({ 
      success: true, 
      data: {
        templates: stats,
        summary: totalStats[0]
      }
    });
  } catch (error) {
    console.error('Error getting template usage stats:', error);
    res.status(500).json({ success: false, error: 'Error al obtener estadísticas' });
  }
});

export default router;
