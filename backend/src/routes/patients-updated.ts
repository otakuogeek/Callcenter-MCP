// ==============================================
// RUTAS ACTUALIZADAS DE PACIENTES - BIOSANARCALL 2025
// ==============================================

import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import pool from '../db/pool';
import { sendPatientRegistrationEmail } from '../utils/emailService';
import { z } from 'zod';
import { cacheWrap } from '../utils/cache';
import labsmobileService from '../services/labsmobile-sms.service';

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

// ===== OBTENER ESPECIALIDADES AUTORIZADAS POR EPS (para portal público) =====
// GET /api/patients-v2/public/authorized-specialties/:epsId
// Endpoint para mostrar las especialidades disponibles para agendar citas
router.get('/public/authorized-specialties/:epsId', async (req, res) => {
  console.log('✅ Endpoint /public/authorized-specialties ALCANZADO');
  
  try {
    const { epsId } = req.params;
    
    if (!epsId) {
      return res.status(400).json({ 
        success: false, 
        error: 'EPS ID es requerido' 
      });
    }

    const [specialties] = await pool.execute(
      `SELECT 
        s.id,
        s.name,
        s.description,
        COUNT(DISTINCT a.location_id) as sedes_disponibles,
        GROUP_CONCAT(DISTINCT l.name ORDER BY l.name SEPARATOR ', ') as sedes,
        MIN(a.copay_percentage) as copago_minimo,
        MAX(a.requires_prior_authorization) as requiere_autorizacion
       FROM eps_specialty_location_authorizations a
       JOIN specialties s ON a.specialty_id = s.id
       JOIN locations l ON a.location_id = l.id
       WHERE a.eps_id = ? 
         AND a.authorized = 1
         AND (a.expiration_date IS NULL OR a.expiration_date >= CURDATE())
       GROUP BY s.id, s.name, s.description
       ORDER BY s.name ASC`,
      [epsId]
    );

    console.log(`✅ Especialidades autorizadas encontradas: ${(specialties as any[]).length}`);
    
    res.json({ 
      success: true, 
      data: specialties 
    });
  } catch (e) {
    console.error('❌ Error getting authorized specialties:', e);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener especialidades autorizadas' 
    });
  }
});

// ===== AGREGAR A LISTA DE ESPERA (SIN AUTENTICACIÓN) =====
// POST /api/patients-v2/public/add-to-waiting-list
// Endpoint para agregar automáticamente a lista de espera cuando no hay agenda
router.post('/public/add-to-waiting-list', async (req, res) => {
  console.log('✅ Endpoint /public/add-to-waiting-list ALCANZADO');
  console.log('📝 Datos recibidos:', req.body);
  
  try {
    const { 
      patient_id,
      specialty_id,
      eps_id,
      reason 
    } = req.body;

    // Validaciones básicas
    if (!patient_id || !specialty_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Patient ID y Specialty ID son requeridos' 
      });
    }

    // Insertar directamente en appointments_waiting_list
    const [result] = await pool.execute(
      `INSERT INTO appointments_waiting_list (
        patient_id,
        specialty_id,
        reason,
        priority_level,
        status,
        requested_by,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, 'Normal', 'pending', 'Portal Público', NOW(), NOW())`,
      [patient_id, specialty_id, reason || 'Consulta general']
    );

    const waiting_list_id = (result as any).insertId;
    console.log(`✅ Paciente agregado a lista de espera con ID: ${waiting_list_id}`);

    // Obtener la posición en la cola para esta especialidad
    const [queuePosition] = await pool.execute(
      `SELECT COUNT(*) as position
       FROM appointments_waiting_list
       WHERE specialty_id = ?
         AND status = 'pending'
         AND created_at <= NOW()`,
      [specialty_id]
    );

    const position = (queuePosition as any[])[0]?.position || 1;

    res.json({ 
      success: true, 
      data: { 
        waiting_list_id,
        position,
        message: 'Agregado a lista de espera exitosamente'
      } 
    });

  } catch (error: any) {
    console.error('❌ Error agregando a lista de espera:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al agregar a lista de espera',
      details: error.message 
    });
  }
});

// ========================================
// Endpoint: Buscar código CUPS
// ========================================
router.get('/public/search-cups/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    console.log(`🔍 Buscando código CUPS: ${code}`);
    
    const [cups] = await pool.execute(
      `SELECT id, code, name, category, subcategory, description, price 
       FROM cups 
       WHERE code = ? 
       LIMIT 1`,
      [code]
    );
    
    if ((cups as any[]).length > 0) {
      console.log(`✅ Código CUPS encontrado: ${(cups as any[])[0].name}`);
      res.json({ 
        success: true, 
        found: true,
        data: (cups as any[])[0]
      });
    } else {
      console.log(`⚠️ Código CUPS no encontrado: ${code}`);
      res.json({ 
        success: true, 
        found: false,
        message: 'Código CUPS no encontrado en la base de datos'
      });
    }
  } catch (error: any) {
    console.error('❌ Error buscando código CUPS:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al buscar código CUPS',
      details: error.message 
    });
  }
});

// ========================================
// Endpoint: Actualizado para agregar a lista de espera con CUPS
// ========================================
router.post('/public/add-to-waiting-list-with-cups', async (req, res) => {
  console.log('✅ Endpoint /public/add-to-waiting-list-with-cups ALCANZADO');
  
  try {
    const { patient_id, specialty_id, eps_id, reason, cups_id, cups_name } = req.body;
    
    console.log('📥 Datos recibidos:', { patient_id, specialty_id, eps_id, reason, cups_id, cups_name });
    
    // Validar datos requeridos
    if (!patient_id || !specialty_id) {
      return res.status(400).json({
        success: false,
        error: 'Faltan datos requeridos: patient_id y specialty_id son obligatorios'
      });
    }

    // Construir reason con información del CUPS si existe
    let finalReason = reason || 'Consulta general';
    if (cups_name) {
      finalReason = `${finalReason} - ${cups_name}`;
    }

    // Insertar en lista de espera con cups_id si existe
    const [result] = await pool.execute(
      `INSERT INTO appointments_waiting_list (
        patient_id, specialty_id, cups_id, reason, priority_level, 
        status, requested_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'Normal', 'pending', 'Portal Público', NOW(), NOW())`,
      [patient_id, specialty_id, cups_id || null, finalReason]
    );
    
    const waiting_list_id = (result as any).insertId;
    console.log(`✅ Agregado a lista de espera con ID: ${waiting_list_id}`);
    
    // Calcular posición en cola
    const [queuePosition] = await pool.execute(
      `SELECT COUNT(*) as position
       FROM appointments_waiting_list
       WHERE specialty_id = ? AND status = 'pending' AND created_at <= NOW()`,
      [specialty_id]
    );

    const position = (queuePosition as any[])[0]?.position || 1;

    res.json({ 
      success: true, 
      data: { 
        waiting_list_id,
        position,
        cups_id: cups_id || null,
        cups_name: cups_name || null,
        message: 'Agregado a lista de espera exitosamente'
      } 
    });

  } catch (error: any) {
    console.error('❌ Error agregando a lista de espera con CUPS:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al agregar a lista de espera',
      details: error.message 
    });
  }
});

// ===== REGISTRO PÚBLICO DE PACIENTES (SIN AUTENTICACIÓN) =====
// POST /api/patients-v2/public/register
// Endpoint para el portal público de pacientes
router.post('/public/register', async (req, res) => {
  console.log('✅ Endpoint /public/register ALCANZADO');
  console.log('📝 Datos recibidos:', req.body);
  
  try {
    const { 
      document, 
      name, 
      birth_date, 
      gender, 
      phone, 
      email, 
      address, 
      city,           // Nombre del municipio
      neighborhood,   // NO se guarda (tabla no tiene este campo)
      eps,            // Nombre de la EPS
      zone_id         // String que necesita convertirse a int
    } = req.body;

    // Validaciones básicas
    if (!document || !name || !birth_date || !phone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Campos obligatorios faltantes: document, name, birth_date, phone' 
      });
    }

    // Verificar si el paciente ya existe
    const [existingPatient] = await pool.execute(
      'SELECT id FROM patients WHERE document = ?',
      [document]
    );

    if ((existingPatient as any[]).length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'Ya existe un paciente registrado con este número de documento' 
      });
    }

    // Buscar municipality_id por nombre (si se proporcionó city)
    let municipality_id = null;
    if (city && city.trim() !== '') {
      const [municipalities] = await pool.execute(
        'SELECT id FROM municipalities WHERE name = ? LIMIT 1',
        [city.trim()]
      );
      municipality_id = (municipalities as any[])[0]?.id || null;
      console.log(`🏙️  Municipio "${city}" → ID: ${municipality_id}`);
    }

    // Buscar insurance_eps_id por nombre (si se proporcionó eps)
    let insurance_eps_id = null;
    if (eps && eps.trim() !== '') {
      const [epsRows] = await pool.execute(
        'SELECT id FROM eps WHERE name = ? LIMIT 1',
        [eps.trim()]
      );
      insurance_eps_id = (epsRows as any[])[0]?.id || null;
      console.log(`🏥 EPS "${eps}" → ID: ${insurance_eps_id}`);
    }

    // Convertir zone_id de string a int
    const zone_id_int = zone_id && zone_id !== '' ? parseInt(zone_id) : null;
    console.log(`📍 Zona: ${zone_id} → ${zone_id_int}`);

    // document_type_id por defecto: 1 (Cédula de Ciudadanía)
    const document_type_id = 1;

    // Insertar paciente
    const [result] = await pool.execute(
      `INSERT INTO patients (
        document, 
        document_type_id, 
        name, 
        birth_date, 
        gender, 
        phone, 
        email, 
        address, 
        municipality_id, 
        insurance_eps_id, 
        zone_id,
        status,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Activo', NOW())`,
      [
        document,
        document_type_id,
        name,
        birth_date,
        gender || 'No especificado',
        phone,
        email || null,
        address || null,
        municipality_id,
        insurance_eps_id,
        zone_id_int
      ]
    );

    const patient_id = (result as any).insertId;
    console.log(`✅ Paciente registrado con ID: ${patient_id}`);

    res.json({ 
      success: true, 
      data: { 
        patient_id,
        message: 'Paciente registrado exitosamente'
      } 
    });

  } catch (error: any) {
    console.error('❌ Error en registro público:', error);
    
    // Error de clave duplicada
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ 
        success: false, 
        error: 'Ya existe un paciente con este documento' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Error al registrar el paciente',
      details: error.message 
    });
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
// Endpoint público SIN autenticación - incluye citas y lista de espera
router.get('/:id/appointments', async (req, res) => {
  try {
    const patientId = parseInt(req.params.id);

    // Obtener citas del paciente
    const [rows] = await pool.execute(
      `SELECT 
        a.id as appointment_id,
        DATE_FORMAT(a.scheduled_at, '%Y-%m-%d') as scheduled_date,
        TIME_FORMAT(a.scheduled_at, '%h:%i %p') as scheduled_time,
        DATE_FORMAT(a.scheduled_at, '%Y-%m-%d %H:%i:%s') as scheduled_at,
        a.status,
        a.reason,
        a.created_at,
        a.specialty_id,
        d.name as doctor_name,
        s.name as specialty_name,
        l.name as location_name
      FROM appointments a
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN specialties s ON a.specialty_id = s.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.patient_id = ?
      ORDER BY a.scheduled_at DESC`,
      [patientId]
    );

    // Obtener lista de espera del paciente con posición calculada
    const [waitingList] = await pool.execute(
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

    res.json({ 
      success: true, 
      data: rows,
      waiting_list: waitingList || []
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
    const limitNumber = Math.max(1, Math.min(50000, parseInt(limit as string) || 20));
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
router.get('/stats/demographics', requireAuth, requireRole(['admin', 'doctor', 'recepcionista']), async (req, res) => {
  try {
    // Total de pacientes
    const [totalCount] = await pool.execute(
      'SELECT COUNT(*) as total FROM patients WHERE status = 1'
    );

    // Estadísticas por género
    const [genderStats] = await pool.execute(
      `SELECT 
        COALESCE(gender, 'No especificado') as gender, 
        COUNT(*) as count 
       FROM patients 
       WHERE status = 1 
       GROUP BY gender`
    );

    // Estadísticas por rangos de edad
    const [ageStats] = await pool.execute(
      `SELECT 
        CASE 
          WHEN TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) < 1 THEN 'Menores de 1 año'
          WHEN TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) BETWEEN 1 AND 5 THEN '1-5 años'
          WHEN TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) BETWEEN 6 AND 12 THEN '6-12 años'
          WHEN TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) BETWEEN 13 AND 17 THEN '13-17 años'
          WHEN TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) BETWEEN 18 AND 25 THEN '18-25 años'
          WHEN TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) BETWEEN 26 AND 40 THEN '26-40 años'
          WHEN TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) BETWEEN 41 AND 60 THEN '41-60 años'
          WHEN TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) > 60 THEN 'Mayores de 60'
          ELSE 'Sin edad registrada'
        END as age_range,
        COUNT(*) as count
       FROM patients 
       WHERE status = 1
       GROUP BY age_range
       ORDER BY 
         CASE age_range
           WHEN 'Menores de 1 año' THEN 1
           WHEN '1-5 años' THEN 2
           WHEN '6-12 años' THEN 3
           WHEN '13-17 años' THEN 4
           WHEN '18-25 años' THEN 5
           WHEN '26-40 años' THEN 6
           WHEN '41-60 años' THEN 7
           WHEN 'Mayores de 60' THEN 8
           ELSE 9
         END`
    );

    // Promedio de edad
    const [avgAge] = await pool.execute(
      `SELECT 
        AVG(TIMESTAMPDIFF(YEAR, birth_date, CURDATE())) as avg_age,
        MIN(TIMESTAMPDIFF(YEAR, birth_date, CURDATE())) as min_age,
        MAX(TIMESTAMPDIFF(YEAR, birth_date, CURDATE())) as max_age
       FROM patients 
       WHERE status = 1 AND birth_date IS NOT NULL`
    );

    // Estadísticas por grupo sanguíneo
    const [bloodGroupStats] = await pool.execute(
      `SELECT 
        COALESCE(bg.code, 'No registrado') as name, 
        COUNT(*) as count 
       FROM patients p 
       LEFT JOIN blood_groups bg ON p.blood_group_id = bg.id 
       WHERE p.status = 1 
       GROUP BY bg.code
       ORDER BY count DESC`
    );

    // Estadísticas por EPS
    const [epsStats] = await pool.execute(
      `SELECT 
        COALESCE(e.name, 'Sin EPS') as name, 
        COUNT(*) as count 
       FROM patients p 
       LEFT JOIN eps e ON p.insurance_eps_id = e.id 
       WHERE p.status = 1 
       GROUP BY e.name 
       ORDER BY count DESC 
       LIMIT 10`
    );

    // Estadísticas por estrato
    const [estratoStats] = await pool.execute(
      `SELECT 
        COALESCE(estrato, 0) as estrato, 
        COUNT(*) as count 
       FROM patients 
       WHERE status = 1
       GROUP BY estrato 
       ORDER BY estrato`
    );

    // Estadísticas por municipio
    const [municipioStats] = await pool.execute(
      `SELECT 
        COALESCE(m.name, 'No especificado') as name, 
        COUNT(*) as count 
       FROM patients p 
       LEFT JOIN municipalities m ON p.municipality_id = m.id 
       WHERE p.status = 1 
       GROUP BY m.name 
       ORDER BY count DESC 
       LIMIT 10`
    );

    // Niños por género (menores de 18 años)
    const [childrenByGender] = await pool.execute(
      `SELECT 
        COALESCE(gender, 'No especificado') as gender,
        COUNT(*) as count
       FROM patients
       WHERE status = 1 
         AND birth_date IS NOT NULL
         AND TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) < 18
       GROUP BY gender`
    );

    // Personas de la tercera edad (mayores de 60)
    const [elderlyCount] = await pool.execute(
      `SELECT COUNT(*) as count
       FROM patients
       WHERE status = 1 
         AND birth_date IS NOT NULL
         AND TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) >= 60`
    );

    res.json({
      success: true,
      data: {
        total_patients: (totalCount as any[])[0].total,
        average_age: Math.round((avgAge as any[])[0]?.avg_age || 0),
        min_age: (avgAge as any[])[0]?.min_age || 0,
        max_age: (avgAge as any[])[0]?.max_age || 0,
        by_gender: genderStats,
        by_age_range: ageStats,
        by_blood_group: bloodGroupStats,
        by_eps: epsStats,
        by_estrato: estratoStats,
        by_municipality: municipioStats,
        children_by_gender: childrenByGender,
        elderly_count: (elderlyCount as any[])[0]?.count || 0
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

// ========================================
// Endpoint: Agendar cita con horario secuencial
// ========================================
router.post('/public/schedule-appointment', async (req, res) => {
  console.log('✅ Endpoint /public/schedule-appointment ALCANZADO');
  
  try {
    const { 
      patient_id, 
      specialty_id, 
      doctor_id, 
      availability_id,
      reason, 
      cups_id, 
      cups_name,
      selected_time  // Nueva hora específica seleccionada por el usuario
    } = req.body;
    
    console.log('📥 Datos recibidos:', { 
      patient_id, specialty_id, doctor_id, availability_id, 
      reason, cups_id, cups_name, selected_time 
    });
    
    // Validar datos requeridos
    if (!patient_id || !specialty_id || !doctor_id || !availability_id) {
      return res.status(400).json({
        success: false,
        error: 'Faltan datos requeridos: patient_id, specialty_id, doctor_id y availability_id son obligatorios'
      });
    }

    // Validar que el paciente no tenga citas activas en la MISMA ESPECIALIDAD (Confirmada o Pendiente)
    console.log(`🔍 Verificando si el paciente ${patient_id} tiene citas activas en la especialidad ${specialty_id}...`);
    const [existingAppointments] = await pool.execute(
      `SELECT a.id, a.scheduled_at, a.status, a.reason, s.name as specialty_name
       FROM appointments a
       JOIN specialties s ON a.specialty_id = s.id
       WHERE a.patient_id = ? 
         AND a.specialty_id = ?
         AND a.status IN ('Confirmada', 'Pendiente') 
         AND a.scheduled_at >= NOW()
       LIMIT 1`,
      [patient_id, specialty_id]
    );

    if ((existingAppointments as any[]).length > 0) {
      const existingAppointment = (existingAppointments as any[])[0];
      const scheduledDate = new Date(existingAppointment.scheduled_at);
      
      console.log(`⚠️ Paciente ${patient_id} ya tiene una cita activa en ${existingAppointment.specialty_name}: ID ${existingAppointment.id}`);
      
      return res.status(409).json({
        success: false,
        error: 'Ya tienes una cita activa en esta especialidad',
        details: {
          existing_appointment_id: existingAppointment.id,
          specialty_name: existingAppointment.specialty_name,
          scheduled_date: scheduledDate.toLocaleDateString('es-CO'),
          scheduled_time: scheduledDate.toLocaleTimeString('es-CO', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          status: existingAppointment.status,
          reason: existingAppointment.reason
        },
        message: `Ya tienes una cita ${existingAppointment.status.toLowerCase()} en ${existingAppointment.specialty_name} programada para el ${scheduledDate.toLocaleDateString('es-CO')} a las ${scheduledDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}. No puedes agendar otra cita en la misma especialidad hasta completar o cancelar la anterior.`
      });
    }

    console.log(`✅ Paciente ${patient_id} no tiene citas activas en la especialidad ${specialty_id}, puede agendar nueva cita`);

    // Obtener duración de la especialidad
    const [specialtyInfo] = await pool.execute(
      `SELECT default_duration_minutes FROM specialties WHERE id = ?`,
      [specialty_id]
    );
    
    const duration_minutes = (specialtyInfo as any[])[0]?.default_duration_minutes || 15; // Default 15 minutos
    console.log(`⏱️ Duración de la especialidad: ${duration_minutes} minutos`);

    // Obtener información de la disponibilidad (availability)
    const [availabilityData] = await pool.execute(
      `SELECT 
        a.location_id,
        a.date as appointment_date,
        a.start_time,
        a.end_time,
        a.capacity,
        a.booked_slots,
        l.name as location_name,
        d.name as doctor_name
       FROM availabilities a
       LEFT JOIN locations l ON a.location_id = l.id
       LEFT JOIN doctors d ON a.doctor_id = d.id
       WHERE a.id = ? AND a.doctor_id = ?`,
      [availability_id, doctor_id]
    );

    if ((availabilityData as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No se encontró la disponibilidad especificada'
      });
    }

    const availability = (availabilityData as any[])[0];
    const { location_id, appointment_date, start_time, end_time } = availability;

    // Verificar que haya cupos disponibles
    if (availability.booked_slots >= availability.capacity) {
      return res.status(400).json({
        success: false,
        error: 'No hay cupos disponibles para esta agenda'
      });
    }

    // 1. Buscar la última cita agendada para la misma disponibilidad (availability_id)
    console.log(`🔍 Buscando última cita para availability_id ${availability_id}, doctor ${doctor_id}, especialidad ${specialty_id}, fecha ${appointment_date}`);
    
    const [lastAppointments] = await pool.execute(
      `SELECT scheduled_at, duration_minutes 
       FROM appointments 
       WHERE availability_id = ? 
         AND doctor_id = ? 
         AND specialty_id = ? 
         AND DATE(scheduled_at) = DATE(?) 
         AND status IN ('Pendiente', 'Confirmada')
       ORDER BY scheduled_at DESC 
       LIMIT 1`,
      [availability_id, doctor_id, specialty_id, appointment_date]
    );

    let newAppointmentTime: Date;
    
    // Crear fecha base correctamente en zona horaria de Colombia
    // appointment_date puede venir como Date object o como string desde MySQL
    let baseDate: Date;
    
    if (appointment_date instanceof Date) {
      // Ya es un objeto Date
      baseDate = new Date(appointment_date.getFullYear(), appointment_date.getMonth(), appointment_date.getDate(), 0, 0, 0, 0);
    } else if (typeof appointment_date === 'string') {
      // Es un string, parsearlo correctamente
      const dateParts = appointment_date.split('-');
      baseDate = new Date(
        parseInt(dateParts[0]), // año
        parseInt(dateParts[1]) - 1, // mes (0-indexed)
        parseInt(dateParts[2]), // día
        0, 0, 0, 0 // hora, minuto, segundo, milisegundo
      );
    } else {
      // Fallback: intentar crear Date directamente
      baseDate = new Date(appointment_date);
      baseDate.setHours(0, 0, 0, 0);
    }
    
    // NUEVA LÓGICA: Si el usuario seleccionó una hora específica, usarla
    if (selected_time) {
      console.log(`🕐 Usando hora específica seleccionada: ${selected_time}`);
      
      // Validar que la hora seleccionada esté en formato correcto (HH:mm)
      const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timePattern.test(selected_time)) {
        return res.status(400).json({
          success: false,
          error: 'Formato de hora seleccionada inválido. Use formato HH:mm'
        });
      }
      
      // Verificar que la hora seleccionada no esté ocupada
      const [conflictingAppointments] = await pool.execute(
        `SELECT id 
         FROM appointments 
         WHERE availability_id = ? 
           AND doctor_id = ? 
           AND specialty_id = ? 
           AND DATE(scheduled_at) = DATE(?) 
           AND TIME_FORMAT(scheduled_at, '%H:%i') = ?
           AND status IN ('Pendiente', 'Confirmada')
         LIMIT 1`,
        [availability_id, doctor_id, specialty_id, appointment_date, selected_time]
      );
      
      if ((conflictingAppointments as any[]).length > 0) {
        return res.status(400).json({
          success: false,
          error: `La hora ${selected_time} ya está ocupada. Por favor seleccione otra hora.`
        });
      }
      
      // Usar la hora seleccionada
      const timeParts = selected_time.split(':');
      newAppointmentTime = new Date(baseDate);
      newAppointmentTime.setHours(
        parseInt(timeParts[0]), 
        parseInt(timeParts[1]), 
        0, 
        0
      );
      
      console.log(`✅ Cita programada para hora específica: ${newAppointmentTime.toLocaleString()}`);
    }
    // LÓGICA ORIGINAL: Cálculo secuencial automático
    else if ((lastAppointments as any[]).length > 0) {
      // 2. Si hay citas previas, calcular próximo horario disponible
      const lastAppointment = (lastAppointments as any[])[0];
      const lastScheduledAt = new Date(lastAppointment.scheduled_at);
      const lastDuration = lastAppointment.duration_minutes || duration_minutes; // Usar duración de la especialidad
      
      // Sumar duración de la última cita para obtener próximo horario
      newAppointmentTime = new Date(lastScheduledAt);
      newAppointmentTime.setMinutes(newAppointmentTime.getMinutes() + lastDuration);
      
      console.log(`📅 Encontrada cita previa en esta availability_id`);
      console.log(`📅 Última cita: ${lastScheduledAt.toLocaleString()}, duración: ${lastDuration} min`);
      console.log(`⏰ Nueva cita programada para: ${newAppointmentTime.toLocaleString()}`);
    } else {
      console.log(`🆕 No hay citas previas en esta availability_id, usando horario de inicio del bloque`);
      // 3. Si no hay citas previas, usar el start_time del bloque de disponibilidad
      const startTimeParts = availability.start_time.split(':');
      newAppointmentTime = new Date(baseDate);
      newAppointmentTime.setHours(
        parseInt(startTimeParts[0]), 
        parseInt(startTimeParts[1]), 
        0, 
        0
      );
      
      console.log(`🕐 Primera cita del bloque programada para: ${newAppointmentTime.toLocaleString()} (usando start_time: ${availability.start_time})`);
    }

    // Validar que la nueva cita + duración no exceda el horario de fin del bloque
    const endTimeParts = availability.end_time.split(':');
    const blockEndTime = new Date(baseDate);
    blockEndTime.setHours(
      parseInt(endTimeParts[0]), 
      parseInt(endTimeParts[1]), 
      0, 
      0
    );
    
    const appointmentEndTime = new Date(newAppointmentTime);
    appointmentEndTime.setMinutes(appointmentEndTime.getMinutes() + duration_minutes);
    
    if (appointmentEndTime > blockEndTime) {
      console.log(`❌ La cita excedería el horario del bloque. Fin de cita: ${appointmentEndTime.toLocaleString()}, Fin de bloque: ${blockEndTime.toLocaleString()}`);
      return res.status(400).json({
        success: false,
        error: 'No hay tiempo suficiente en este bloque para la duración de la cita'
      });
    }

    console.log(`✅ Validación de horario exitosa. Cita: ${newAppointmentTime.toLocaleString()} - ${appointmentEndTime.toLocaleString()}`);

    // 4. Obtener información del doctor para la respuesta
    const [doctorInfo] = await pool.execute(
      `SELECT name as doctor_name
       FROM doctors 
       WHERE id = ?`,
      [doctor_id]
    );

    const doctorName = (doctorInfo as any[])[0]?.doctor_name || 'Doctor no encontrado';

    // 5. Construir reason final con información de CUPS si existe
    let finalReason = reason || 'Consulta general';
    if (cups_name) {
      finalReason = `${finalReason} - ${cups_name}`;
    }

    // 6. Insertar nueva cita en la base de datos
    const [result] = await pool.execute(
      `INSERT INTO appointments (
        patient_id, specialty_id, doctor_id, location_id, availability_id, cups_id,
        scheduled_at, duration_minutes, appointment_type, status, reason,
        appointment_source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Presencial', 'Confirmada', ?, 'Web', NOW())`,
      [
        patient_id, specialty_id, doctor_id, location_id, availability_id,
        cups_id || null, newAppointmentTime, duration_minutes, finalReason
      ]
    );
    
    const appointment_id = (result as any).insertId;
    console.log(`✅ Cita creada con ID: ${appointment_id}`);

    // 7. Actualizar slots disponibles en availabilities
    await pool.execute(
      `UPDATE availabilities 
       SET booked_slots = booked_slots + 1 
       WHERE id = ? AND booked_slots < capacity`,
      [availability_id]
    );
    console.log(`📈 Slot incrementado en availabilities ID: ${availability_id}`);

    // 8. Respuesta exitosa con información completa
    // Formatear fecha correctamente sin problemas de zona horaria
    const localDate = new Date(newAppointmentTime);
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    
    res.json({ 
      success: true, 
      data: { 
        appointment_id,
        doctor_name: doctorName,
        scheduled_time: newAppointmentTime.toLocaleTimeString('es-CO', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        }),
        scheduled_date: localDate.toLocaleDateString('es-CO', {
          timeZone: 'America/Bogota',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        appointment_date: formattedDate,
        scheduled_datetime: newAppointmentTime.toISOString(),
        duration_minutes: 15,
        cups_name: cups_name || null,
        reason: finalReason,
        location_name: availability.location_name,
        message: 'Cita agendada exitosamente'
      } 
    });

  } catch (error: any) {
    console.error('❌ Error agendando cita:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al agendar la cita',
      details: error.message 
    });
  }
});

// Endpoint público para cancelar citas (solo el propio paciente)
router.put('/public/appointments/:appointmentId/cancel', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { patientId, cancellationReason } = req.body;

    if (!appointmentId || !patientId) {
      return res.status(400).json({
        success: false,
        error: 'ID de cita y ID de paciente son requeridos'
      });
    }

    console.log(`🚫 Intentando cancelar cita ${appointmentId} para paciente ${patientId}`);

    // 1. Verificar que la cita existe y pertenece al paciente
    const [appointmentRows] = await pool.execute(
      `SELECT 
        a.id, a.patient_id, a.status, a.availability_id,
        a.scheduled_at, d.name as doctor_name, s.name as specialty_name,
        l.name as location_name, p.name as patient_name
       FROM appointments a
       LEFT JOIN doctors d ON a.doctor_id = d.id  
       LEFT JOIN specialties s ON a.specialty_id = s.id
       LEFT JOIN locations l ON a.location_id = l.id
       LEFT JOIN patients p ON a.patient_id = p.id
       WHERE a.id = ? AND a.patient_id = ?`,
      [appointmentId, patientId]
    );

    if ((appointmentRows as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cita no encontrada o no pertenece a este paciente'
      });
    }

    const appointment = (appointmentRows as any[])[0];
    
    // 2. Verificar que la cita se puede cancelar (no está ya cancelada o completada)
    if (appointment.status === 'Cancelada') {
      return res.status(400).json({
        success: false,
        error: 'Esta cita ya está cancelada'
      });
    }

    if (appointment.status === 'Completada') {
      return res.status(400).json({
        success: false,
        error: 'No se puede cancelar una cita que ya fue completada'
      });
    }

    // 3. Verificar que no se esté cancelando muy tarde (opcional - se puede ajustar)
    const scheduledTime = new Date(appointment.scheduled_at);
    const now = new Date();
    const hoursUntilAppointment = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilAppointment < 2) {
      console.log(`⚠️ Cita programada en ${hoursUntilAppointment} horas - permitir cancelación tardía`);
      // Por ahora permitiremos la cancelación, pero se puede agregar restricción aquí
    }

    // 4. Actualizar el estado de la cita a 'Cancelada'
    const reason = cancellationReason ? `Cancelada por paciente: ${cancellationReason}` : 'Cancelada por paciente';
    
    await pool.execute(
      `UPDATE appointments 
       SET status = 'Cancelada', 
           cancellation_reason = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [reason, appointmentId]
    );

    // 5. Liberar el cupo en la availability si existe
    if (appointment.availability_id) {
      await pool.execute(
        `UPDATE availabilities 
         SET booked_slots = CASE 
           WHEN booked_slots > 0 THEN booked_slots - 1 
           ELSE 0 
         END 
         WHERE id = ?`,
        [appointment.availability_id]
      );
      console.log(`✅ Liberado cupo en availability_id ${appointment.availability_id}`);
    }

    console.log(`✅ Cita ${appointmentId} cancelada exitosamente`);

    // 6. Enviar notificación SMS al administrador
    try {
      const adminPhone = process.env.CANCELLATION_NOTIFICATION_PHONE || process.env.ADMIN_NOTIFICATION_PHONE;
      if (adminPhone) {
        const scheduledDate = new Date(appointment.scheduled_at);
        const appointmentDate = scheduledDate.toLocaleDateString('es-CO', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });

        const appointmentTime = scheduledDate.toLocaleTimeString('es-CO', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });

        // Mensaje de notificación de cancelación
        const notificationMessage = `Se informa que el paciente: ${appointment.patient_name || 'Paciente'}, ha cancelado su cita con: ${appointment.doctor_name || 'Doctor'} para la fecha ${appointmentDate} a las ${appointmentTime}.`;

        const smsResult = await labsmobileService.sendSMS({
          number: adminPhone,
          message: notificationMessage,
          recipient_name: 'Administrador',
          patient_id: appointment.patient_id,
          appointment_id: appointment.id
        });

        if (smsResult.success) {
          console.log(`✅ Notificación de cancelación enviada exitosamente al administrador: ${adminPhone}`);
        } else {
          console.log(`⚠️ Error enviando notificación de cancelación: ${smsResult.error}`);
        }
      } else {
        console.log(`⚠️ No se pudo enviar notificación: CANCELLATION_NOTIFICATION_PHONE no configurado`);
      }
    } catch (smsError: any) {
      console.error('❌ Error enviando notificación SMS al administrador:', smsError);
      // No interrumpir el flujo si falla el SMS
    }

    // 7. Respuesta exitosa con detalles de la cita cancelada
    res.json({
      success: true,
      data: {
        appointment_id: appointment.id,
        status: 'Cancelada',
        doctor_name: appointment.doctor_name,
        specialty_name: appointment.specialty_name,
        location_name: appointment.location_name,
        scheduled_date: new Date(appointment.scheduled_at).toLocaleDateString('es-CO'),
        scheduled_time: new Date(appointment.scheduled_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        cancellation_reason: reason
      },
      message: 'Cita cancelada exitosamente'
    });

  } catch (error: any) {
    console.error('❌ Error cancelando cita:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cancelar la cita',
      details: error.message
    });
  }
});

// ===== OBTENER CITAS DISPONIBLES PARA REASIGNACIÓN (para portal público) =====
// GET /api/patients-v2/public/available-schedules/:specialtyId/:epsId
// Lista las agendas disponibles para reasignar una cita a una especialidad específica
router.get('/public/available-schedules/:specialtyId/:epsId', async (req, res) => {
  try {
    const { specialtyId, epsId } = req.params;

    if (!specialtyId || !epsId) {
      return res.status(400).json({
        success: false,
        error: 'ID de especialidad y EPS son requeridos'
      });
    }

    console.log(`✅ Endpoint /public/available-schedules ALCANZADO`);

    // Primero obtenemos la duración de la especialidad
    const [specialtyRows] = await pool.execute(
      'SELECT default_duration_minutes FROM specialties WHERE id = ?',
      [specialtyId]
    );
    
    const duration = (specialtyRows as any[])[0]?.default_duration_minutes || 15;

    // Obtener agendas disponibles con cálculo de hora real disponible
    const [availabilityRows] = await pool.execute(
      `SELECT 
        av.id as availability_id,
        DATE_FORMAT(av.date, '%Y-%m-%d') as appointment_date,
        TIME_FORMAT(av.start_time, '%h:%i %p') as start_time,
        TIME_FORMAT(av.end_time, '%h:%i %p') as end_time,
        av.capacity as total_slots,
        av.booked_slots,
        GREATEST(0, CAST(av.capacity AS SIGNED) - CAST(av.booked_slots AS SIGNED)) as slots_available,
        d.name as doctor_name,
        d.id as doctor_id,
        s.name as specialty_name,
        l.name as location_name,
        l.id as location_id,
        av.date as raw_date,
        av.start_time as raw_start_time,
        av.end_time as raw_end_time
       FROM availabilities av
       INNER JOIN doctors d ON av.doctor_id = d.id
       INNER JOIN specialties s ON av.specialty_id = s.id
       INNER JOIN locations l ON av.location_id = l.id
       WHERE av.specialty_id = ?
       AND av.status IN ('Activa', 'Completa')
       AND av.date >= CURDATE()
       AND GREATEST(0, CAST(av.capacity AS SIGNED) - CAST(av.booked_slots AS SIGNED)) > 0
       AND (av.is_paused = 0 OR av.is_paused IS NULL)
       ORDER BY av.date ASC, av.start_time ASC`,
      [specialtyId]
    );

    let availabilities = availabilityRows as any[];
    console.log(`✅ Agendas encontradas antes del cálculo: ${availabilities.length}`);

    // Calcular la hora real disponible para cada agenda
    for (let i = 0; i < availabilities.length; i++) {
      const availability = availabilities[i];
      
      // Buscar la última cita programada en esta agenda
      const [lastAppointmentRows] = await pool.execute(
        `SELECT MAX(scheduled_at) as last_scheduled_time 
         FROM appointments 
         WHERE availability_id = ? AND status IN ('Confirmada', 'Pendiente')
         AND doctor_id = ? AND specialty_id = ?
         AND DATE(scheduled_at) = ?`,
        [availability.availability_id, availability.doctor_id, specialtyId, availability.raw_date]
      );

      let availableTime;
      const lastScheduledTime = (lastAppointmentRows as any[])[0]?.last_scheduled_time;

      if (lastScheduledTime) {
        // Hay citas previas, calcular próximo horario disponible
        const nextTime = new Date(lastScheduledTime);
        nextTime.setMinutes(nextTime.getMinutes() + duration);
        availableTime = nextTime;
      } else {
        // No hay citas, usar hora de inicio de la agenda
        const startTime = new Date(availability.raw_date);
        const [startHour, startMinute] = availability.raw_start_time.split(':');
        startTime.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);
        availableTime = startTime;
      }

      // Verificar que el horario calculado esté dentro del rango de la agenda
      const endTime = new Date(availability.raw_date);
      const [endHour, endMinute] = availability.raw_end_time.split(':');
      endTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);
      
      // Verificar que hay tiempo suficiente para la cita completa
      const appointmentEndTime = new Date(availableTime);
      appointmentEndTime.setMinutes(appointmentEndTime.getMinutes() + duration);

      if (appointmentEndTime <= endTime) {
        // Hay tiempo suficiente, actualizar con la hora real disponible
        availability.available_time = availableTime.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: true 
        });
        availability.calculated_time = availableTime.toISOString();
      } else {
        // No hay tiempo suficiente, marcar como no disponible
        availability.slots_available = 0;
        availability.available_time = 'Sin cupos';
      }
      
      // Limpiar campos temporales
      delete availability.raw_date;
      delete availability.raw_start_time;
      delete availability.raw_end_time;
    }

    // Filtrar solo las agendas que realmente tienen tiempo disponible
    availabilities = availabilities.filter(av => av.slots_available > 0);

    console.log(`✅ Agendas disponibles después del cálculo: ${availabilities.length}`);

    res.json({
      success: true,
      data: availabilities,
      message: `Se encontraron ${availabilities.length} opciones disponibles`
    });

  } catch (error: any) {
    console.error('❌ Error obteniendo horarios disponibles:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener horarios disponibles',
      details: error.message
    });
  }
});

// ===== REASIGNAR CITA (para portal público) =====
// PUT /api/patients-v2/public/appointments/:appointmentId/reschedule
// Permite al paciente reasignar su cita a una nueva fecha/hora disponible
router.put('/public/appointments/:appointmentId/reschedule', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { patientId, newAvailabilityId, reason, selected_time } = req.body;

    if (!appointmentId || !patientId || !newAvailabilityId) {
      return res.status(400).json({
        success: false,
        error: 'ID de cita, ID de paciente y nueva disponibilidad son requeridos'
      });
    }

    console.log(`🔄 Intentando reasignar cita ${appointmentId} del paciente ${patientId} a availability ${newAvailabilityId}`, selected_time ? `con hora específica ${selected_time}` : '');

    // 1. Verificar que la cita actual existe y pertenece al paciente
    const [appointmentRows] = await pool.execute(
      `SELECT 
        a.id, a.patient_id, a.status, a.availability_id, a.specialty_id,
        a.scheduled_at, a.doctor_id,
        d.name as doctor_name, s.name as specialty_name, l.name as location_name
       FROM appointments a
       LEFT JOIN doctors d ON a.doctor_id = d.id  
       LEFT JOIN specialties s ON a.specialty_id = s.id
       LEFT JOIN locations l ON a.location_id = l.id
       WHERE a.id = ? AND a.patient_id = ?`,
      [appointmentId, patientId]
    );

    if ((appointmentRows as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cita no encontrada o no pertenece a este paciente'
      });
    }

    const currentAppointment = (appointmentRows as any[])[0];
    
    // 2. Verificar que la cita se puede reasignar
    if (currentAppointment.status === 'Cancelada') {
      return res.status(400).json({
        success: false,
        error: 'No se puede reasignar una cita cancelada'
      });
    }

    if (currentAppointment.status === 'Completada') {
      return res.status(400).json({
        success: false,
        error: 'No se puede reasignar una cita completada'
      });
    }

    // 3. Verificar que la nueva availability existe y tiene cupos
    const [newAvailabilityRows] = await pool.execute(
      `SELECT 
        av.id, av.doctor_id, av.specialty_id, av.location_id, av.date, 
        av.start_time, av.end_time, av.capacity, av.booked_slots,
        av.status, d.name as doctor_name, s.name as specialty_name, l.name as location_name
       FROM availabilities av
       LEFT JOIN doctors d ON av.doctor_id = d.id
       LEFT JOIN specialties s ON av.specialty_id = s.id
       LEFT JOIN locations l ON av.location_id = l.id
       WHERE av.id = ? AND av.status IN ('Activa', 'Completa')`,
      [newAvailabilityId]
    );

    if ((newAvailabilityRows as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        error: 'La nueva agenda no existe o no está disponible'
      });
    }

    const newAvailability = (newAvailabilityRows as any[])[0];

    // 4. Verificar que la nueva agenda es de la misma especialidad
    if (newAvailability.specialty_id !== currentAppointment.specialty_id) {
      return res.status(400).json({
        success: false,
        error: 'Solo puedes reasignar a una agenda de la misma especialidad'
      });
    }

    // 5. Verificar que hay cupos disponibles
    if (newAvailability.booked_slots >= newAvailability.capacity) {
      return res.status(400).json({
        success: false,
        error: 'La nueva agenda no tiene cupos disponibles'
      });
    }

    // 6. Obtener duración de la especialidad
    const [specialtyRows] = await pool.execute(
      'SELECT default_duration_minutes FROM specialties WHERE id = ?',
      [currentAppointment.specialty_id]
    );
    
    const duration = (specialtyRows as any[])[0]?.default_duration_minutes || 15;

    // 7. Calcular nueva hora de la cita
    let newScheduledTime;
    
    if (selected_time) {
      // Usar la hora específica seleccionada por el usuario
      console.log(`⏰ Usando hora específica seleccionada: ${selected_time}`);
      
      // Validar formato de hora
      const timeRegex = /^([01]?\d|2[0-3]):([0-5]?\d)$/;
      if (!timeRegex.test(selected_time)) {
        return res.status(400).json({
          success: false,
          error: 'Formato de hora inválido. Use HH:MM'
        });
      }
      
      const [selectedHour, selectedMinute] = selected_time.split(':');
      newScheduledTime = new Date(newAvailability.date);
      newScheduledTime.setHours(parseInt(selectedHour), parseInt(selectedMinute), 0, 0);
      
      // Verificar que la hora esté dentro del horario de disponibilidad
      const availabilityStart = new Date(newAvailability.date);
      const [startHour, startMinute] = newAvailability.start_time.split(':');
      availabilityStart.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);
      
      const availabilityEnd = new Date(newAvailability.date);
      const [endHour, endMinute] = newAvailability.end_time.split(':');
      availabilityEnd.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);
      
      if (newScheduledTime < availabilityStart || newScheduledTime >= availabilityEnd) {
        return res.status(400).json({
          success: false,
          error: 'La hora seleccionada está fuera del horario disponible'
        });
      }
      
      // Verificar que no hay conflictos con otras citas en esa hora exacta
      const appointmentEndTime = new Date(newScheduledTime);
      appointmentEndTime.setMinutes(appointmentEndTime.getMinutes() + duration);
      
      // Verificar conflictos con citas existentes
      const [conflictRows] = await pool.execute(
        `SELECT id FROM appointments 
         WHERE availability_id = ? 
         AND doctor_id = ?
         AND status IN ('Confirmada', 'Pendiente')
         AND DATE(scheduled_at) = ?
         AND id != ?
         AND (
           (scheduled_at <= ? AND DATE_ADD(scheduled_at, INTERVAL ? MINUTE) > ?)
           OR 
           (scheduled_at < ? AND DATE_ADD(scheduled_at, INTERVAL ? MINUTE) >= ?)
         )`,
        [
          newAvailabilityId, 
          newAvailability.doctor_id, 
          newAvailability.date, 
          appointmentId,
          newScheduledTime, duration, newScheduledTime,
          appointmentEndTime, duration, appointmentEndTime
        ]
      );
      
      if ((conflictRows as any[]).length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Ya hay una cita programada en ese horario'
        });
      }
      
    } else {
      // Lógica original: calcular hora automáticamente
      // Buscar la última cita en la nueva availability
      const [lastAppointmentRows] = await pool.execute(
        `SELECT MAX(scheduled_at) as last_scheduled_time 
         FROM appointments 
         WHERE availability_id = ? AND status IN ('Confirmada', 'Pendiente')
         AND doctor_id = ? AND specialty_id = ?
         AND DATE(scheduled_at) = ?`,
        [newAvailabilityId, newAvailability.doctor_id, newAvailability.specialty_id, newAvailability.date]
      );

      const lastScheduledTime = (lastAppointmentRows as any[])[0]?.last_scheduled_time;

      if (lastScheduledTime) {
        // Hay citas previas, programar después de la última
        newScheduledTime = new Date(lastScheduledTime);
        newScheduledTime.setMinutes(newScheduledTime.getMinutes() + duration);
      } else {
        // Primera cita del día, usar la hora de inicio de la availability
        const [startHour, startMinute] = newAvailability.start_time.split(':');
        newScheduledTime = new Date(newAvailability.date);
        newScheduledTime.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);
      }
      
      // Validar que la nueva hora esté dentro del horario de la availability
      const endTime = new Date(newAvailability.date);
      const [endHour, endMinute] = newAvailability.end_time.split(':');
      endTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);

      const appointmentEndTime = new Date(newScheduledTime);
      appointmentEndTime.setMinutes(appointmentEndTime.getMinutes() + duration);

      if (appointmentEndTime > endTime) {
        return res.status(400).json({
          success: false,
          error: 'No hay tiempo suficiente en esta agenda para programar la cita'
        });
      }
    }

    // 8. Realizar la reasignación en una transacción
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Liberar cupo en la availability anterior (solo si es diferente)
      if (currentAppointment.availability_id !== newAvailabilityId) {
        await connection.execute(
          `UPDATE availabilities 
           SET booked_slots = CASE 
             WHEN booked_slots > 0 THEN booked_slots - 1 
             ELSE 0 
           END 
           WHERE id = ?`,
          [currentAppointment.availability_id]
        );
        console.log(`✅ Liberado cupo en availability_id ${currentAppointment.availability_id}`);

        // Ocupar cupo en la nueva availability
        await connection.execute(
          `UPDATE availabilities 
           SET booked_slots = booked_slots + 1 
           WHERE id = ?`,
          [newAvailabilityId]
        );
        console.log(`📈 Ocupado cupo en availability_id ${newAvailabilityId}`);
      }

      // Actualizar la cita
      await connection.execute(
        `UPDATE appointments 
         SET 
           availability_id = ?,
           doctor_id = ?,
           location_id = ?,
           scheduled_at = ?,
           rescheduled_reason = ?,
           rescheduled_at = NOW(),
           updated_at = NOW()
         WHERE id = ?`,
        [
          newAvailabilityId,
          newAvailability.doctor_id,
          newAvailability.location_id,
          newScheduledTime,
          reason || 'Reasignada por el paciente',
          appointmentId
        ]
      );

      await connection.commit();
      console.log(`✅ Cita ${appointmentId} reasignada exitosamente`);

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    // 9. Respuesta exitosa con detalles de la nueva cita
    res.json({
      success: true,
      data: {
        appointmentId: appointmentId,
        oldDate: currentAppointment.scheduled_at,
        newDate: newScheduledTime,
        doctor: newAvailability.doctor_name,
        specialty: newAvailability.specialty_name,
        location: newAvailability.location_name,
        duration: duration
      },
      message: 'Cita reasignada exitosamente'
    });

  } catch (error: any) {
    console.error('❌ Error reasignando cita:', error);
    res.status(500).json({
      success: false,
      error: 'Error al reasignar la cita',
      details: error.message
    });
  }
});

export default router;
