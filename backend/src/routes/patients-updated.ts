// ==============================================
// RUTAS ACTUALIZADAS DE PACIENTES - BIOSANARCALL 2025
// ==============================================

import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import pool from '../db/pool';
import { sendPatientRegistrationEmail } from '../utils/emailService';
import { z } from 'zod';
import { cacheWrap } from '../utils/cache';

interface PatientRegistrationData {
  id: number;
  name: string;
  email: string;
  document: string;
  phone?: string;
  birthDate?: string;
  gender?: string;
  address?: string;
  eps?: string;
}

const router = express.Router();

// Función auxiliar para obtener el nombre de la EPS
async function getEpsName(epsId: number): Promise<string | undefined> {
  try {
    const [rows] = await pool.execute(
      'SELECT name FROM insurance_eps WHERE id = ?',
      [epsId]
    );
    return rows && (rows as any[])[0] ? (rows as any[])[0].name : undefined;
  } catch (error) {
    console.error('Error al obtener el nombre de la EPS:', error);
    return undefined;
  }
}

// ===== OBTENER MUNICIPIOS (para portal público) =====
// GET /api/patients-v2/public/municipalities
// Endpoint público SIN autenticación - DEBE IR ANTES DE RUTAS DINÁMICAS
router.get('/public/municipalities', async (req, res) => {
  console.log('✅ Endpoint /public/municipalities ALCANZADO');
  try {
    const [rows] = await pool.execute(
      `SELECT id, name 
       FROM municipalities 
       ORDER BY name ASC`
    );

    console.log(`✅ Municipios encontrados: ${(rows as any[]).length}`);
    
    res.json({ 
      success: true, 
      data: rows 
    });
  } catch (e) {
    console.error('❌ Error getting municipalities:', e);
    res.status(500).json({ success: false, message: 'Error al obtener municipios' });
  }
});

// ===== CREAR PACIENTE CON CAMPOS EXTENDIDOS =====
router.post('/', requireAuth, requireRole(['admin', 'recepcionista']), async (req, res) => {
  try {
    const {
      // Campos básicos obligatorios
      document,
      document_type_id,
      name,
      phone,
      email,
      birth_date,
      gender,
      address,
      municipality_id,
      
      // Campos de seguro
      insurance_eps_id,
      insurance_affiliation_type,
      
      // Campos demográficos
      blood_group_id,
      population_group_id,
      education_level_id,
      marital_status_id,
      estrato,
      
      // Campos de discapacidad
      has_disability = false,
      disability_type_id,
      
      // Campos adicionales
      phone_alt,
      notes,
      // Tipo de registro
      registration_type
    } = req.body;

    // Validaciones básicas: sólo nombre y documento son obligatorios
    if (!document || !name) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios: document, name'
      });
    }

    // Verificar si el paciente ya existe
    const [existing] = await pool.execute(
      'SELECT id FROM patients WHERE document = ?',
      [document]
    );

    if ((existing as any[]).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un paciente con este número de documento'
      });
    }

    // Crear el paciente con todos los campos (manejar undefined como null)
    const [result] = await pool.execute(
      `INSERT INTO patients (
        document, document_type_id, name, phone, email, birth_date, gender, address,
        municipality_id, insurance_eps_id, insurance_affiliation_type,
        blood_group_id, population_group_id, education_level_id, marital_status_id,
        estrato, has_disability, disability_type_id, phone_alt, notes,
        created_at, status, registration_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1, ?)`,
      [
        document,
        // permitir null si no se proporciona
        document_type_id || null,
        name,
        // almacenar null si el teléfono está vacío
        phone || null,
        email || null,
        // birth_date opcional
        birth_date || null,
        gender || null,
        address || null,
        municipality_id || null,
        insurance_eps_id || null,
        insurance_affiliation_type || null,
        blood_group_id || null,
        population_group_id || null,
        education_level_id || null,
        marital_status_id || null,
        estrato || null,
        has_disability ? 1 : 0,
        disability_type_id || null,
        phone_alt || null,
        notes || null,
        registration_type || 'standard'
      ]);

    const pacienteId = (result as any).insertId;

    // Enviar correo si es registro anual o si el paciente tiene email
    if ((registration_type === 'annual' || registration_type === undefined) && email) {
      try {
        const patientData: PatientRegistrationData = {
          id: pacienteId,
          name,
          email,
          document,
          phone: phone || undefined,
          birthDate: birth_date || undefined,
          gender: gender || undefined,
          address: address || undefined
        };

        if (insurance_eps_id) {
          const epsName = await getEpsName(insurance_eps_id);
          if (epsName) {
            patientData.eps = epsName;
          }
        }

        await sendPatientRegistrationEmail(patientData);
        console.log(`Correo ${registration_type === 'annual' ? 'de registro anual' : 'de bienvenida'} enviado a ${email}`);
      } catch (emailError) {
        console.error('Error al enviar el correo:', emailError);
        // No detenemos el flujo si falla el envío del correo
      }
    }

    res.status(201).json({
      success: true,
      message: 'Paciente creado exitosamente',
      data: { 
        id: pacienteId,
        document: document,
        name: name
      }
    });

  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear paciente'
    });
  }
});

// ===== BÚSQUEDA RÁPIDA (autocomplete) =====
// GET /api/patients-v2/quick-search?q=term&limit=10
// Usa FULLTEXT si devuelve resultados; fallback a LIKE. Caché 5s.
const quickSearchSchema = z.object({ q: z.string().min(1).max(100), limit: z.string().optional() });
router.get('/quick-search', requireAuth, async (req, res) => {
  try {
    const parsed = quickSearchSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Parámetros inválidos' });
    const { q } = parsed.data;
    const limit = Math.min(parseInt(parsed.data.limit || '10', 10), 50);
    const cacheKey = `patient_qs:${q}:${limit}`;
    const data = await cacheWrap(cacheKey, 5_000, async () => {
      // Intentar FULLTEXT primero si está habilitado
      const likePattern = `%${q}%`;
      if (process.env.ENABLE_FULLTEXT_SEARCH === 'true') {
        try {
          const [rows] = await pool.execute(
            `SELECT id, document, name, phone, email FROM patients 
             WHERE status=1 AND MATCH(name, document, phone, email) AGAINST (? IN NATURAL LANGUAGE MODE)
             LIMIT ?`, [q, limit]
          );
          if ((rows as any[]).length > 0) return rows;
        } catch { /* fallback a LIKE */ }
      }
      const [likeRows] = await pool.execute(
        `SELECT id, document, name, phone, email FROM patients 
         WHERE status=1 AND (name LIKE ? OR document LIKE ? OR phone LIKE ? OR email LIKE ?)
         ORDER BY name ASC
         LIMIT ${limit}`, [likePattern, likePattern, likePattern, likePattern]
      );
      return likeRows;
    });
    res.json({ success: true, data });
  } catch (e) {
    console.error('Error quick-search patients:', e);
    res.status(500).json({ success: false, message: 'Error en quick-search' });
  }
});

// ===== BÚSQUEDA DE PACIENTES (para portal público) =====
// GET /api/patients-v2/search?q=document
// Búsqueda pública SIN autenticación para portal de pacientes
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q as string;
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Parámetro de búsqueda requerido' 
      });
    }

    // Buscar paciente por documento exacto con JOINs
    const [rows] = await pool.execute(
      `SELECT 
        p.id as patient_id,
        p.document,
        p.name,
        SUBSTRING_INDEX(p.name, ' ', 1) as first_name,
        SUBSTRING_INDEX(p.name, ' ', -1) as last_name,
        p.phone,
        p.phone_alt,
        p.email,
        DATE_FORMAT(p.birth_date, '%Y-%m-%d') as birth_date,
        p.gender,
        p.address,
        p.municipality_id,
        p.zone_id,
        p.insurance_eps_id,
        p.insurance_affiliation_type,
        p.blood_group_id,
        p.notes,
        p.status,
        p.created_at,
        m.name as municipality_name,
        z.name as zone_name,
        e.name as eps_name,
        bg.name as blood_group_name,
        bg.code as blood_group
      FROM patients p
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      LEFT JOIN zones z ON p.zone_id = z.id
      LEFT JOIN eps e ON p.insurance_eps_id = e.id
      LEFT JOIN blood_groups bg ON p.blood_group_id = bg.id
      WHERE p.status = 'Activo' AND p.document = ?
      LIMIT 1`, 
      [q.trim()]
    );

    if ((rows as any[]).length === 0) {
      return res.json({ 
        success: true, 
        patients: [],
        message: 'No se encontró ningún paciente con ese documento'
      });
    }

    res.json({ 
      success: true, 
      patients: rows 
    });
  } catch (e) {
    console.error('Error search patients:', e);
    res.status(500).json({ success: false, message: 'Error en búsqueda de pacientes' });
  }
});

// ===== OBTENER CITAS DE UN PACIENTE (para portal público) =====
// GET /api/patients-v2/:id/appointments
// Endpoint público SIN autenticación
router.get('/:id/appointments', async (req, res) => {
  try {
    const patientId = parseInt(req.params.id);

    // Obtener citas del paciente
    const [rows] = await pool.execute(
      `SELECT 
        a.id as appointment_id,
        DATE_FORMAT(a.scheduled_at, '%Y-%m-%d') as scheduled_date,
        TIME_FORMAT(a.scheduled_at, '%H:%i') as scheduled_time,
        DATE_FORMAT(a.scheduled_at, '%Y-%m-%d %H:%i:%s') as scheduled_at,
        a.status,
        a.reason,
        a.created_at,
        d.name as doctor_name,
        s.name as specialty_name,
        l.name as location_name
      FROM appointments a
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN specialties s ON a.specialty_id = s.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.patient_id = ?
      ORDER BY a.scheduled_at DESC
      LIMIT 50`,
      [patientId]
    );

    res.json({ 
      success: true, 
      data: rows 
    });
  } catch (e) {
    console.error('Error getting patient appointments:', e);
    res.status(500).json({ success: false, message: 'Error al obtener citas del paciente' });
  }
});

// ===== OBTENER PACIENTE CON TODOS LOS DATOS =====
// Endpoint quick-search debe declararse antes de rutas dinámicas :id para evitar colisiones
// (Movido al final superior)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const pacienteId = parseInt(req.params.id);

    // Verificar permisos (solo el propio paciente, doctores y admin pueden ver)
    if (req.user!.role === 'patient' && req.user!.id !== pacienteId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver este paciente'
      });
    }

    // Obtener datos del paciente con todos los lookups
    const [pacienteRows] = await pool.execute(
      `SELECT 
        p.*,
        dt.name as document_type_name,
        dt.code as document_type_code,
        m.name as municipality_name,
        e.name as eps_name,
        bg.name as blood_group_name,
        bg.code as blood_group_code,
        pg.name as population_group_name,
        el.name as education_level_name,
        ms.name as marital_status_name,
        dt_dis.name as disability_type_name
       FROM patients p
       LEFT JOIN document_types dt ON p.document_type_id = dt.id
       LEFT JOIN municipalities m ON p.municipality_id = m.id
       LEFT JOIN eps e ON p.insurance_eps_id = e.id
       LEFT JOIN blood_groups bg ON p.blood_group_id = bg.id
       LEFT JOIN population_groups pg ON p.population_group_id = pg.id
       LEFT JOIN education_levels el ON p.education_level_id = el.id
       LEFT JOIN marital_statuses ms ON p.marital_status_id = ms.id
       LEFT JOIN disability_types dt_dis ON p.disability_type_id = dt_dis.id
       WHERE p.id = ? AND p.status = 1`,
      [pacienteId]
    );

    const pacientes = pacienteRows as any[];
    if (pacientes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    const paciente = pacientes[0];

    // Obtener historial médico básico
    const [historialRows] = await pool.execute(
      `SELECT 
        a.id, 
        DATE_FORMAT(a.scheduled_at, '%Y-%m-%d %H:%i:%s') as fecha_cita, 
        a.status as estado, 
        d.name as doctor_nombre, 
        s.name as especialidad_nombre,
        a.reason as motivo,
        a.notes as notas
       FROM appointments a
       LEFT JOIN doctors d ON a.doctor_id = d.id
       LEFT JOIN specialties s ON a.specialty_id = s.id
       WHERE a.patient_id = ?
       ORDER BY a.scheduled_at DESC
       LIMIT 10`,
      [pacienteId]
    );

    res.json({
      success: true,
      data: {
        paciente,
        historial_medico: historialRows
      }
    });

  } catch (error) {
    console.error('Error getting patient:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener paciente'
    });
  }
});

// ===== ACTUALIZAR PACIENTE =====
router.put('/:id', requireAuth, requireRole(['admin', 'recepcionista', 'doctor']), async (req, res) => {
  try {
    const pacienteId = parseInt(req.params.id);

    // Obtener datos actuales
    const [currentRows] = await pool.execute(
      'SELECT * FROM patients WHERE id = ? AND status = 1',
      [pacienteId]
    );

    const currentData = (currentRows as any[])[0];
    if (!currentData) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    // Actualizar paciente
    const campos = Object.keys(req.body).filter(key => key !== 'id');
    const valores = campos.map(key => req.body[key]);
    const setClause = campos.map(key => `${key} = ?`).join(', ');

    if (campos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos para actualizar'
      });
    }

    await pool.execute(
      `UPDATE patients SET ${setClause} WHERE id = ?`,
      [...valores, pacienteId]
    );

    res.json({
      success: true,
      message: 'Paciente actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar paciente'
    });
  }
});

// ===== BUSCAR PACIENTES CON FILTROS AVANZADOS =====
router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      search,
      eps_id,
      municipality_id,
      document_type_id,
      gender,
      blood_group_id,
      population_group_id,
      status, // Agregar status como filtro opcional
      page = 1,
      limit = 20,
      sort_by = 'name',
      sort_order = 'ASC'
    } = req.query;

    const pageNumber = Math.max(1, parseInt(page as string) || 1);
    const limitNumber = Math.max(1, Math.min(100, parseInt(limit as string) || 20));
    const offsetNumber = (pageNumber - 1) * limitNumber;
    
    let whereConditions = ['1=1']; // Cambiar de status = 1 a condición que siempre sea true
    let queryParams: any[] = [];

    if (search) {
      whereConditions.push('(p.name LIKE ? OR p.document LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (eps_id) {
      whereConditions.push('p.insurance_eps_id = ?');
      queryParams.push(parseInt(eps_id as string));
    }

    if (municipality_id) {
      whereConditions.push('p.municipality_id = ?');
      queryParams.push(parseInt(municipality_id as string));
    }

    if (document_type_id) {
      whereConditions.push('p.document_type_id = ?');
      queryParams.push(parseInt(document_type_id as string));
    }

    if (gender) {
      whereConditions.push('p.gender = ?');
      queryParams.push(gender);
    }

    if (blood_group_id) {
      whereConditions.push('p.blood_group_id = ?');
      queryParams.push(parseInt(blood_group_id as string));
    }

    if (population_group_id) {
      whereConditions.push('p.population_group_id = ?');
      queryParams.push(parseInt(population_group_id as string));
    }

    // Agregar filtro de status opcional
    if (status) {
      whereConditions.push('p.status = ?');
      queryParams.push(status);
    }

    const whereClause = whereConditions.join(' AND ');
    
    // Validar sort_by para prevenir SQL injection
    const allowedSorts = ['name', 'document', 'created_at', 'birth_date'];
    const sortBy = allowedSorts.includes(sort_by as string) ? sort_by : 'name';
    const sortOrder = sort_order === 'DESC' ? 'DESC' : 'ASC';

    // Consulta principal con todos los JOINs
    const query = `SELECT 
        p.id,
        p.document,
        p.name,
        p.phone,
        p.email,
        DATE_FORMAT(p.birth_date, '%Y-%m-%d') as birth_date,
        p.gender,
        p.address,
        p.estrato,
        p.insurance_affiliation_type,
        p.has_disability,
        p.status,
        dt.name as document_type_name,
        dt.code as document_type_code,
        m.name as municipality_name,
        e.name as eps_name,
        bg.name as blood_group_name,
        bg.code as blood_group_code,
        pg.name as population_group_name,
        el.name as education_level_name,
        ms.name as marital_status_name,
        dt2.name as disability_type_name,
        p.created_at
       FROM patients p
       LEFT JOIN document_types dt ON p.document_type_id = dt.id
       LEFT JOIN municipalities m ON p.municipality_id = m.id
       LEFT JOIN eps e ON p.insurance_eps_id = e.id
       LEFT JOIN blood_groups bg ON p.blood_group_id = bg.id
       LEFT JOIN population_groups pg ON p.population_group_id = pg.id
       LEFT JOIN education_levels el ON p.education_level_id = el.id
       LEFT JOIN marital_statuses ms ON p.marital_status_id = ms.id
       LEFT JOIN disability_types dt2 ON p.disability_type_id = dt2.id
       WHERE ${whereClause}
       ORDER BY p.${sortBy} ${sortOrder}
       LIMIT ${limitNumber} OFFSET ${offsetNumber}`;
    
    const [rows] = await pool.execute(query, queryParams);

    // Contar total para paginación
    const countQuery = `SELECT COUNT(*) as total FROM patients p WHERE ${whereClause}`;
    const [countRows] = await pool.execute(countQuery, queryParams);

    const total = (countRows as any[])[0].total;
    const totalPages = Math.ceil(total / limitNumber);

    res.json({
      success: true,
      data: {
        patients: rows,
        pagination: {
          current_page: pageNumber,
          per_page: limitNumber,
          total: total,
          total_pages: totalPages
        }
      }
    });

  } catch (error) {
    console.error('Error searching patients:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar pacientes'
    });
  }
});

// (Se reubica definición quick-search antes de :id)

// ===== ELIMINAR PACIENTE (SOFT DELETE) =====
router.delete('/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const pacienteId = parseInt(req.params.id);

    // Verificar que existe
    const [existing] = await pool.execute(
      'SELECT id FROM patients WHERE id = ? AND status = 1',
      [pacienteId]
    );

    if ((existing as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    // Soft delete
    await pool.execute(
      'UPDATE patients SET status = 0 WHERE id = ?',
      [pacienteId]
    );

    res.json({
      success: true,
      message: 'Paciente eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar paciente'
    });
  }
});

// ===== OBTENER ESTADÍSTICAS DE PACIENTES =====
router.get('/stats/demographics', requireAuth, requireRole(['admin', 'doctor']), async (req, res) => {
  try {
    // Estadísticas por género
    const [genderStats] = await pool.execute(
      `SELECT gender, COUNT(*) as count 
       FROM patients 
       WHERE status = 1 
       GROUP BY gender`
    );

    // Estadísticas por grupo sanguíneo
    const [bloodGroupStats] = await pool.execute(
      `SELECT bg.name, COUNT(*) as count 
       FROM patients p 
       LEFT JOIN blood_groups bg ON p.blood_group_id = bg.id 
       WHERE p.status = 1 
       GROUP BY bg.name`
    );

    // Estadísticas por estrato
    const [estratoStats] = await pool.execute(
      `SELECT estrato, COUNT(*) as count 
       FROM patients 
       WHERE status = 1 AND estrato IS NOT NULL 
       GROUP BY estrato 
       ORDER BY estrato`
    );

    // Estadísticas por municipio
    const [municipioStats] = await pool.execute(
      `SELECT m.name, COUNT(*) as count 
       FROM patients p 
       LEFT JOIN municipalities m ON p.municipality_id = m.id 
       WHERE p.status = 1 
       GROUP BY m.name 
       ORDER BY count DESC 
       LIMIT 10`
    );

    // Total de pacientes
    const [totalCount] = await pool.execute(
      'SELECT COUNT(*) as total FROM patients WHERE status = 1'
    );

    res.json({
      success: true,
      data: {
        total_patients: (totalCount as any[])[0].total,
        by_gender: genderStats,
        by_blood_group: bloodGroupStats,
        by_estrato: estratoStats,
        by_municipality: municipioStats
      }
    });

  } catch (error) {
    console.error('Error getting patient stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
});

export default router;
