import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/orders - Listar todas las órdenes (appointments)
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { status, specialty_id, location_id, from_date, to_date, search, page = '1', limit = '50' } = req.query;
    
    let query = `
      SELECT 
        a.id,
        a.patient_id,
        a.scheduled_at,
        a.status,
        a.appointment_type,
        a.reason,
        a.priority_level,
        a.created_at,
        p.name AS patient_name,
        p.document AS patient_document,
        p.phone AS patient_phone,
        p.email AS patient_email,
        s.name AS specialty_name,
        l.name AS location_name,
        d.name AS doctor_name,
        c.name AS cups_name,
        c.code AS cups_code
      FROM appointments a
      INNER JOIN patients p ON a.patient_id = p.id
      LEFT JOIN specialties s ON a.specialty_id = s.id
      LEFT JOIN locations l ON a.location_id = l.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN cups c ON a.cups_id = c.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    // Filtros
    if (status) {
      query += ` AND a.status = ?`;
      params.push(status);
    }
    
    if (specialty_id) {
      query += ` AND a.specialty_id = ?`;
      params.push(specialty_id);
    }
    
    if (location_id) {
      query += ` AND a.location_id = ?`;
      params.push(location_id);
    }
    
    if (from_date) {
      query += ` AND DATE(a.scheduled_at) >= ?`;
      params.push(from_date);
    }
    
    if (to_date) {
      query += ` AND DATE(a.scheduled_at) <= ?`;
      params.push(to_date);
    }
    
    if (search) {
      // Búsqueda SOLO por número de orden
      const isNumeric = /^\d+$/.test(search as string);
      
      if (isNumeric) {
        query += ` AND a.id = ?`;
        params.push(parseInt(search as string));
      } else {
        // Si no es numérico, no buscar nada (solo búsqueda por ID)
        query += ` AND 1=0`;
      }
    }
    
    query += ` ORDER BY a.created_at DESC, a.id DESC`;
    
    // Paginación
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    
    query += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);
    
    const [rows] = await pool.query(query, params);
    
    // Contar total para paginación
    let countQuery = `
      SELECT COUNT(*) as total
      FROM appointments a
      INNER JOIN patients p ON a.patient_id = p.id
      LEFT JOIN specialties s ON a.specialty_id = s.id
      WHERE 1=1
    `;
    
    const countParams: any[] = [];
    
    if (status) {
      countQuery += ` AND a.status = ?`;
      countParams.push(status);
    }
    
    if (specialty_id) {
      countQuery += ` AND a.specialty_id = ?`;
      countParams.push(specialty_id);
    }
    
    if (location_id) {
      countQuery += ` AND a.location_id = ?`;
      countParams.push(location_id);
    }
    
    if (from_date) {
      countQuery += ` AND DATE(a.scheduled_at) >= ?`;
      countParams.push(from_date);
    }
    
    if (to_date) {
      countQuery += ` AND DATE(a.scheduled_at) <= ?`;
      countParams.push(to_date);
    }
    
    if (search) {
      const isNumeric = /^\d+$/.test(search as string);
      
      if (isNumeric) {
        countQuery += ` AND a.id = ?`;
        countParams.push(parseInt(search as string));
      } else {
        countQuery += ` AND 1=0`;
      }
    }
    
    const [countResult] = await pool.query<any[]>(countQuery, countParams);
    const total = countResult[0]?.total || 0;
    
    return res.json({
      success: true,
      data: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
    
  } catch (error: any) {
    console.error('Error obteniendo órdenes:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener órdenes',
      error: error.message
    });
  }
});

// GET /api/orders/:id - Obtener detalles de una orden específica
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        a.*,
        p.name AS patient_name,
        p.document AS patient_document,
        p.phone AS patient_phone,
        p.email AS patient_email,
        p.birth_date AS patient_birth_date,
        p.gender AS patient_gender,
        p.address AS patient_address,
        e.name AS patient_eps,
        s.name AS specialty_name,
        l.name AS location_name,
        l.address AS location_address,
        l.phone AS location_phone,
        d.name AS doctor_name,
        d.license_number AS doctor_license,
        c.name AS cups_name,
        c.code AS cups_code,
        c.description AS cups_description,
        u.name AS created_by_user_name
      FROM appointments a
      INNER JOIN patients p ON a.patient_id = p.id
      LEFT JOIN eps e ON p.insurance_eps_id = e.id
      LEFT JOIN specialties s ON a.specialty_id = s.id
      LEFT JOIN locations l ON a.location_id = l.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN cups c ON a.cups_id = c.id
      LEFT JOIN users u ON a.created_by_user_id = u.id
      WHERE a.id = ?
    `;
    
    const [rows] = await pool.query<any[]>(query, [id]);
    
    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }
    
    return res.json({
      success: true,
      data: rows[0]
    });
    
  } catch (error: any) {
    console.error('Error obteniendo orden:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener orden',
      error: error.message
    });
  }
});

// GET /api/orders/patient/:patient_id - Obtener órdenes de un paciente específico
router.get('/patient/:patient_id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { patient_id } = req.params;
    
    const query = `
      SELECT 
        a.id,
        a.scheduled_at,
        a.status,
        a.appointment_type,
        a.reason,
        a.priority_level,
        s.name AS specialty_name,
        l.name AS location_name,
        d.name AS doctor_name,
        c.name AS cups_name
      FROM appointments a
      LEFT JOIN specialties s ON a.specialty_id = s.id
      LEFT JOIN locations l ON a.location_id = l.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN cups c ON a.cups_id = c.id
      WHERE a.patient_id = ?
      ORDER BY a.scheduled_at DESC
    `;
    
    const [rows] = await pool.query(query, [patient_id]);
    
    return res.json({
      success: true,
      data: rows
    });
    
  } catch (error: any) {
    console.error('Error obteniendo órdenes del paciente:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener órdenes del paciente',
      error: error.message
    });
  }
});

export default router;
