// =============================================
// RUTAS PARA GESTIÓN DE EMBARAZOS
// =============================================

import express, { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import pool from '../db/pool';
import { z } from 'zod';

const router = express.Router();

// ===== SCHEMAS DE VALIDACIÓN =====

const pregnancySchema = z.object({
  patient_id: z.number().int().positive(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // Formato YYYY-MM-DD
  expected_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['Activa', 'Completada', 'Interrumpida']).default('Activa'),
  high_risk: z.boolean().default(false),
  risk_factors: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const updatePregnancySchema = z.object({
  status: z.enum(['Activa', 'Completada', 'Interrumpida']).optional(),
  interruption_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  interruption_reason: z.enum([
    'Aborto espontáneo',
    'Aborto terapéutico',
    'Muerte fetal',
    'Embarazo ectópico',
    'Otra causa'
  ]).nullable().optional(),
  interruption_notes: z.string().nullable().optional(),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  delivery_type: z.enum(['Parto natural', 'Cesárea', 'Fórceps', 'Vacuum', 'Otro']).nullable().optional(),
  baby_gender: z.enum(['Masculino', 'Femenino', 'No especificado']).nullable().optional(),
  baby_weight_grams: z.number().int().positive().nullable().optional(),
  complications: z.string().nullable().optional(),
  high_risk: z.boolean().optional(),
  risk_factors: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const prenatalControlSchema = z.object({
  pregnancy_id: z.number().int().positive(),
  control_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gestational_weeks: z.number().int().min(0).max(45),
  gestational_days: z.number().int().min(0).max(6).default(0),
  weight_kg: z.number().positive().nullable().optional(),
  blood_pressure_systolic: z.number().int().positive().nullable().optional(),
  blood_pressure_diastolic: z.number().int().positive().nullable().optional(),
  fundal_height_cm: z.number().positive().nullable().optional(),
  fetal_heart_rate: z.number().int().positive().nullable().optional(),
  observations: z.string().nullable().optional(),
  recommendations: z.string().nullable().optional(),
  next_control_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  lab_tests_ordered: z.string().nullable().optional(),
  ultrasound_performed: z.boolean().default(false),
  ultrasound_notes: z.string().nullable().optional(),
});

// ===== OBTENER EMBARAZO ACTIVO DE UNA PACIENTE =====
router.get('/patient/:patientId/active', requireAuth, async (req: Request, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    
    if (isNaN(patientId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID de paciente inválido' 
      });
    }

    const [rows] = await pool.query(`
      SELECT 
        p.*,
        pat.name as patient_name,
        pat.gender as patient_gender,
        DATEDIFF(CURDATE(), p.start_date) DIV 7 as current_weeks,
        DATEDIFF(CURDATE(), p.start_date) % 7 as current_days,
        DATEDIFF(p.expected_due_date, CURDATE()) as days_until_due,
        CASE 
          WHEN DATEDIFF(p.expected_due_date, CURDATE()) < 0 THEN TRUE
          ELSE FALSE
        END as is_overdue
      FROM pregnancies p
      INNER JOIN patients pat ON p.patient_id = pat.id
      WHERE p.patient_id = ? AND p.status = 'Activa'
      ORDER BY p.created_at DESC
      LIMIT 1
    `, [patientId]);

    const pregnancy = (rows as any[])[0] || null;

    return res.json({
      success: true,
      data: pregnancy,
      has_active_pregnancy: pregnancy !== null
    });
  } catch (error) {
    console.error('Error getting active pregnancy:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener el embarazo activo'
    });
  }
});

// ===== OBTENER HISTORIAL DE EMBARAZOS DE UNA PACIENTE =====
router.get('/patient/:patientId/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const patientId = Number(req.params.patientId);
    
    if (isNaN(patientId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID de paciente inválido' 
      });
    }

    const [rows] = await pool.query(`
      SELECT 
        p.*,
        DATEDIFF(
          COALESCE(p.actual_end_date, CURDATE()), 
          p.start_date
        ) DIV 7 as total_weeks
      FROM pregnancies p
      WHERE p.patient_id = ?
      ORDER BY p.start_date DESC
    `, [patientId]);

    return res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting pregnancy history:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener el historial de embarazos'
    });
  }
});

// ===== CREAR NUEVO EMBARAZO =====
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = pregnancySchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        errors: parsed.error.flatten()
      });
    }

    const data = parsed.data;
    const userId = (req as any).user?.id || null;

    // Verificar que la paciente sea femenina
    const [patientCheck] = await pool.query(
      'SELECT gender FROM patients WHERE id = ?',
      [data.patient_id]
    );

    const patient = (patientCheck as any[])[0];
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    if (patient.gender !== 'Femenino') {
      return res.status(400).json({
        success: false,
        message: 'Solo pacientes de género femenino pueden tener embarazos registrados'
      });
    }

    // Verificar si ya tiene un embarazo activo
    const [activeCheck] = await pool.query(
      'SELECT id FROM pregnancies WHERE patient_id = ? AND status = "Activa"',
      [data.patient_id]
    );

    if ((activeCheck as any[]).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'La paciente ya tiene un embarazo activo. Finalice el embarazo actual antes de registrar uno nuevo.'
      });
    }

    // Calcular fecha probable de parto si no se proporcionó
    const expectedDueDate = data.expected_due_date || 
      new Date(new Date(data.start_date).getTime() + (280 * 24 * 60 * 60 * 1000))
        .toISOString().split('T')[0];

    const [result] = await pool.query(`
      INSERT INTO pregnancies (
        patient_id, start_date, expected_due_date, status,
        high_risk, risk_factors, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.patient_id,
      data.start_date,
      expectedDueDate,
      data.status,
      data.high_risk,
      data.risk_factors || null,
      data.notes || null,
      userId
    ]);

    const insertId = (result as any).insertId;

    // Obtener el registro completo creado
    const [created] = await pool.query(
      'SELECT * FROM pregnancies WHERE id = ?',
      [insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'Embarazo registrado exitosamente',
      data: (created as any[])[0]
    });
  } catch (error) {
    console.error('Error creating pregnancy:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al registrar el embarazo'
    });
  }
});

// ===== ACTUALIZAR EMBARAZO =====
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de embarazo inválido'
      });
    }

    const parsed = updatePregnancySchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        errors: parsed.error.flatten()
      });
    }

    const data = parsed.data;

    // Construir query dinámica
    const updates: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay datos para actualizar'
      });
    }

    values.push(id);

    await pool.query(
      `UPDATE pregnancies SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Obtener el registro actualizado
    const [updated] = await pool.query(
      'SELECT * FROM pregnancies WHERE id = ?',
      [id]
    );

    return res.json({
      success: true,
      message: 'Embarazo actualizado exitosamente',
      data: (updated as any[])[0]
    });
  } catch (error) {
    console.error('Error updating pregnancy:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar el embarazo'
    });
  }
});

// ===== OBTENER CONTROLES PRENATALES DE UN EMBARAZO =====
router.get('/:pregnancyId/controls', requireAuth, async (req: Request, res: Response) => {
  try {
    const pregnancyId = Number(req.params.pregnancyId);
    
    if (isNaN(pregnancyId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de embarazo inválido'
      });
    }

    const [rows] = await pool.query(`
      SELECT * FROM prenatal_controls
      WHERE pregnancy_id = ?
      ORDER BY control_date DESC
    `, [pregnancyId]);

    return res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting prenatal controls:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener los controles prenatales'
    });
  }
});

// ===== REGISTRAR CONTROL PRENATAL =====
router.post('/controls', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = prenatalControlSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        errors: parsed.error.flatten()
      });
    }

    const data = parsed.data;
    const userId = (req as any).user?.id || null;

    const [result] = await pool.query(`
      INSERT INTO prenatal_controls (
        pregnancy_id, control_date, gestational_weeks, gestational_days,
        weight_kg, blood_pressure_systolic, blood_pressure_diastolic,
        fundal_height_cm, fetal_heart_rate, observations, recommendations,
        next_control_date, lab_tests_ordered, ultrasound_performed,
        ultrasound_notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.pregnancy_id,
      data.control_date,
      data.gestational_weeks,
      data.gestational_days,
      data.weight_kg || null,
      data.blood_pressure_systolic || null,
      data.blood_pressure_diastolic || null,
      data.fundal_height_cm || null,
      data.fetal_heart_rate || null,
      data.observations || null,
      data.recommendations || null,
      data.next_control_date || null,
      data.lab_tests_ordered || null,
      data.ultrasound_performed,
      data.ultrasound_notes || null,
      userId
    ]);

    const insertId = (result as any).insertId;

    const [created] = await pool.query(
      'SELECT * FROM prenatal_controls WHERE id = ?',
      [insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'Control prenatal registrado exitosamente',
      data: (created as any[])[0]
    });
  } catch (error) {
    console.error('Error creating prenatal control:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al registrar el control prenatal'
    });
  }
});

// ===== OBTENER EMBARAZOS ACTIVOS (TODOS) =====
router.get('/active', requireAuth, async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query(`
      SELECT * FROM active_pregnancies
      ORDER BY expected_due_date ASC
    `);

    return res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting active pregnancies:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener los embarazos activos'
    });
  }
});

export default router;
