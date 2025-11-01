import express, { Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../db/pool';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Middleware para verificar token de doctor
const authenticateDoctorToken = (req: Request, res: Response, next: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Token no proporcionado'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey_at_least_16_characters_for_security') as any;
    
    if (decoded.type !== 'doctor') {
      return res.status(403).json({
        success: false,
        error: 'No autorizado'
      });
    }

    req.body.doctorId = decoded.id;
    next();
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      error: 'Token inválido o expirado'
    });
  }
};

// ===============================================
// HISTORIAS CLÍNICAS (MEDICAL RECORDS)
// ===============================================

// GET /api/medical-records - Obtener historias clínicas del doctor
router.get('/', authenticateDoctorToken, async (req: Request, res: Response) => {
  try {
    const doctorId = req.body.doctorId;
    const { patient_id, status, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT 
        mr.*,
        p.name as patient_name,
        p.document as patient_document,
        p.phone as patient_phone,
        d.name as doctor_name
      FROM medical_records mr
      LEFT JOIN patients p ON mr.patient_id = p.id
      LEFT JOIN doctors d ON mr.doctor_id = d.id
      WHERE mr.doctor_id = ?
    `;

    const params: any[] = [doctorId];

    if (patient_id) {
      query += ' AND mr.patient_id = ?';
      params.push(patient_id);
    }

    if (status) {
      query += ' AND mr.status = ?';
      params.push(status);
    }

    query += ' ORDER BY mr.visit_date DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const [records] = await pool.query<RowDataPacket[]>(query, params);

    res.json({
      success: true,
      data: records,
      total: records.length
    });

  } catch (error: any) {
    console.error('Error al obtener historias clínicas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener historias clínicas'
    });
  }
});

// GET /api/medical-records/:id - Obtener una historia clínica específica
router.get('/:id', authenticateDoctorToken, async (req: Request, res: Response) => {
  try {
    const doctorId = req.body.doctorId;
    const recordId = req.params.id;

    const [records] = await pool.query<RowDataPacket[]>(
      `SELECT 
        mr.*,
        p.name as patient_name,
        p.document as patient_document,
        p.phone as patient_phone,
        p.email as patient_email,
        p.birth_date,
        p.gender,
        p.address,
        TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as patient_age,
        d.name as doctor_name,
        d.license_number as doctor_license
      FROM medical_records mr
      LEFT JOIN patients p ON mr.patient_id = p.id
      LEFT JOIN doctors d ON mr.doctor_id = d.id
      WHERE mr.id = ? AND mr.doctor_id = ?`,
      [recordId, doctorId]
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Historia clínica no encontrada'
      });
    }

    res.json({
      success: true,
      data: records[0]
    });

  } catch (error: any) {
    console.error('Error al obtener historia clínica:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener historia clínica'
    });
  }
});

// POST /api/medical-records - Crear nueva historia clínica
router.post('/', authenticateDoctorToken, async (req: Request, res: Response) => {
  try {
    const doctorId = req.body.doctorId;
    const {
      patient_id,
      appointment_id,
      visit_type,
      chief_complaint,
      current_illness,
      vital_signs,
      physical_examination,
      diagnosis,
      treatment_plan,
      prescriptions,
      observations,
      follow_up_date,
      status = 'Borrador'
    } = req.body;

    if (!patient_id) {
      return res.status(400).json({
        success: false,
        error: 'patient_id es requerido'
      });
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO medical_records (
        patient_id, doctor_id, appointment_id, visit_type,
        chief_complaint, current_illness, vital_signs, physical_examination,
        diagnosis, treatment_plan, prescriptions, observations,
        follow_up_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patient_id, doctorId, appointment_id || null, visit_type || 'Consulta General',
        chief_complaint, current_illness, 
        vital_signs ? JSON.stringify(vital_signs) : null,
        physical_examination ? JSON.stringify(physical_examination) : null,
        diagnosis, treatment_plan, prescriptions, observations,
        follow_up_date || null, status
      ]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        message: 'Historia clínica creada exitosamente'
      }
    });

  } catch (error: any) {
    console.error('Error al crear historia clínica:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear historia clínica'
    });
  }
});

// PUT /api/medical-records/:id - Actualizar historia clínica
router.put('/:id', authenticateDoctorToken, async (req: Request, res: Response) => {
  try {
    const doctorId = req.body.doctorId;
    const recordId = req.params.id;
    const {
      visit_type,
      chief_complaint,
      current_illness,
      vital_signs,
      physical_examination,
      diagnosis,
      treatment_plan,
      prescriptions,
      observations,
      follow_up_date,
      status
    } = req.body;

    // Verificar que la historia pertenece al doctor
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM medical_records WHERE id = ? AND doctor_id = ?',
      [recordId, doctorId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Historia clínica no encontrada'
      });
    }

    await pool.query(
      `UPDATE medical_records SET
        visit_type = COALESCE(?, visit_type),
        chief_complaint = COALESCE(?, chief_complaint),
        current_illness = COALESCE(?, current_illness),
        vital_signs = COALESCE(?, vital_signs),
        physical_examination = COALESCE(?, physical_examination),
        diagnosis = COALESCE(?, diagnosis),
        treatment_plan = COALESCE(?, treatment_plan),
        prescriptions = COALESCE(?, prescriptions),
        observations = COALESCE(?, observations),
        follow_up_date = COALESCE(?, follow_up_date),
        status = COALESCE(?, status)
      WHERE id = ?`,
      [
        visit_type, chief_complaint, current_illness,
        vital_signs ? JSON.stringify(vital_signs) : null,
        physical_examination ? JSON.stringify(physical_examination) : null,
        diagnosis, treatment_plan, prescriptions, observations,
        follow_up_date, status, recordId
      ]
    );

    res.json({
      success: true,
      message: 'Historia clínica actualizada exitosamente'
    });

  } catch (error: any) {
    console.error('Error al actualizar historia clínica:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar historia clínica'
    });
  }
});

// ===============================================
// PACIENTES - Información para el doctor
// ===============================================

// GET /api/medical-records/patients/search - Buscar pacientes
router.get('/patients/search', authenticateDoctorToken, async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Parámetro de búsqueda inválido (mínimo 2 caracteres)'
      });
    }

    const searchTerm = `%${q}%`;

    const [patients] = await pool.query<RowDataPacket[]>(
      `SELECT 
        p.id,
        p.name,
        p.document,
        p.phone,
        p.email,
        p.birth_date,
        p.gender,
        p.blood_group_id,
        TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age,
        ie.name as eps_name,
        (SELECT COUNT(*) FROM medical_records mr WHERE mr.patient_id = p.id) as total_visits,
        (SELECT MAX(mr.visit_date) FROM medical_records mr WHERE mr.patient_id = p.id) as last_visit
      FROM patients p
      LEFT JOIN insurance_eps ie ON p.insurance_eps_id = ie.id
      WHERE p.name LIKE ? OR p.document LIKE ? OR p.phone LIKE ?
      LIMIT 20`,
      [searchTerm, searchTerm, searchTerm]
    );

    res.json({
      success: true,
      data: patients
    });

  } catch (error: any) {
    console.error('Error al buscar pacientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al buscar pacientes'
    });
  }
});

// GET /api/medical-records/patients/:id/history - Obtener historial completo del paciente
router.get('/patients/:id/history', authenticateDoctorToken, async (req: Request, res: Response) => {
  try {
    const patientId = req.params.id;

    // Información del paciente
    const [patients] = await pool.query<RowDataPacket[]>(
      `SELECT 
        p.*,
        TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age,
        ie.name as eps_name,
        bg.group_name as blood_group
      FROM patients p
      LEFT JOIN insurance_eps ie ON p.insurance_eps_id = ie.id
      LEFT JOIN blood_groups bg ON p.blood_group_id = bg.id
      WHERE p.id = ?`,
      [patientId]
    );

    if (patients.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Paciente no encontrado'
      });
    }

    // Historias clínicas
    const [medicalRecords] = await pool.query<RowDataPacket[]>(
      `SELECT mr.*, d.name as doctor_name
       FROM medical_records mr
       LEFT JOIN doctors d ON mr.doctor_id = d.id
       WHERE mr.patient_id = ?
       ORDER BY mr.visit_date DESC`,
      [patientId]
    );

    // Alergias activas
    const [allergies] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM patient_allergies
       WHERE patient_id = ? AND active = TRUE
       ORDER BY severity DESC`,
      [patientId]
    );

    // Medicamentos activos
    const [medications] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM patient_medications
       WHERE patient_id = ? AND status = 'Activo'
       ORDER BY start_date DESC`,
      [patientId]
    );

    // Antecedentes médicos
    const [medicalHistory] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM patient_medical_history
       WHERE patient_id = ? AND active = TRUE
       ORDER BY history_type, recorded_at DESC`,
      [patientId]
    );

    res.json({
      success: true,
      data: {
        patient: patients[0],
        medicalRecords,
        allergies,
        medications,
        medicalHistory
      }
    });

  } catch (error: any) {
    console.error('Error al obtener historial del paciente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener historial del paciente'
    });
  }
});

export default router;
