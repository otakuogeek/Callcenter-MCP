// ==============================================
// RUTAS ACTUALIZADAS DE PACIENTES - BIOSANARCALL 2025
// ==============================================

import express from 'express';
import { randomInt } from 'crypto';
import { requireAuth, requireRole } from '../middleware/auth';
import pool from '../db/pool';
import { sendPatientRegistrationEmail } from '../utils/emailService';
import { z } from 'zod';
import { cacheWrap } from '../utils/cache';
import labsmobileService from '../services/labsmobile-sms.service';
import { 
  formatDateColombia, 
  formatTimeColombia, 
  formatFullDateColombia,
  COLOMBIA_TIMEZONE,
  formatDateForMySQLUTC,
  utcDateFromYMDAndUTCTime,
  utcDateFromYMDAndColombiaTime
} from '../utils/dateUtils';

/**
 * 🇨🇴 Extrae la hora de un datetime de MySQL (almacenado en UTC-0)
 * y la convierte a hora Colombia (UTC-5).
 * @param mysqlDatetime - Fecha/hora de MySQL en formato 'YYYY-MM-DD HH:mm:ss' o Date
 * @returns Hora formateada como '3:45 p. m.'
 */
function extractTimeFromMySQLDatetime(mysqlDatetime: string | Date): string {
  if (!mysqlDatetime) return '';
  
  // Crear Date object - MySQL datetime es UTC-0
  const date = typeof mysqlDatetime === 'string' 
    ? new Date(mysqlDatetime + 'Z')  // Agregar Z para indicar UTC
    : mysqlDatetime;
  
  // Convertir a hora Colombia (UTC-5)
  const colombiaTime = new Date(date.getTime() - (5 * 60 * 60 * 1000));
  
  let hours = colombiaTime.getUTCHours();
  const minutes = colombiaTime.getUTCMinutes().toString().padStart(2, '0');
  
  // Convertir a formato 12 horas
  const period = hours >= 12 ? 'p. m.' : 'a. m.';
  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;
  
  return `${hours}:${minutes} ${period}`;
}

/**
 * 🇨🇴 Extrae la fecha de un datetime de MySQL (almacenado en UTC-0)
 * y la convierte a fecha Colombia (UTC-5).
 * @param mysqlDatetime - Fecha/hora de MySQL en formato 'YYYY-MM-DD HH:mm:ss' o Date
 * @returns Fecha formateada como 'DD/MM/YYYY'
 */
function extractDateFromMySQLDatetime(mysqlDatetime: string | Date): string {
  if (!mysqlDatetime) return '';
  
  // Crear Date object - MySQL datetime es UTC-0
  const date = typeof mysqlDatetime === 'string' 
    ? new Date(mysqlDatetime + 'Z')  // Agregar Z para indicar UTC
    : mysqlDatetime;
  
  // Convertir a hora Colombia (UTC-5)
  const colombiaTime = new Date(date.getTime() - (5 * 60 * 60 * 1000));
  
  const day = colombiaTime.getUTCDate().toString().padStart(2, '0');
  const month = (colombiaTime.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = colombiaTime.getUTCFullYear();
  
  return `${day}/${month}/${year}`;
}

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

type OtpEntry = {
  code: string;
  patientId: number;
  document: string;
  phone: string;
  expiresAt: number;
  attempts: number;
  requestedAt: number;
};

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const otpStore = new Map<string, OtpEntry>();

function normalizeDocument(document: string): string {
  return document.trim().replace(/\s+/g, '').replace(/[.-]/g, '').toUpperCase();
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('3')) return `+57${digits}`;
  if (digits.startsWith('57') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('58') && digits.length >= 12) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return phone;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone;
  return `***${digits.slice(-4)}`;
}

function generateOtpCode(): string {
  return randomInt(100000, 1000000).toString();
}

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
        s.allows_double_appointment,
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
       GROUP BY s.id, s.name, s.description, s.allows_double_appointment
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
      ) VALUES (?, ?, ?, 'Normal', 'pending', 'Manual', NOW(), NOW())`,
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
    const { patient_id, specialty_id, eps_id, reason, cups_list } = req.body;
    
    console.log('📥 Datos recibidos:', { patient_id, specialty_id, eps_id, reason, cups_list });
    
    // Validar datos requeridos
    if (!patient_id || !specialty_id) {
      return res.status(400).json({
        success: false,
        error: 'Faltan datos requeridos: patient_id y specialty_id son obligatorios'
      });
    }

    // Validar que cups_list sea un array y tenga máximo 3 elementos
    if (cups_list && (!Array.isArray(cups_list) || cups_list.length > 3)) {
      return res.status(400).json({
        success: false,
        error: 'cups_list debe ser un array con máximo 3 elementos'
      });
    }

    // Construir reason final
    const finalReason = reason || 'Consulta general';

    // Insertar en lista de espera (cups_id NULL, se usa nueva tabla de relación)
    const [result] = await pool.execute(
      `INSERT INTO appointments_waiting_list (
        patient_id, specialty_id, cups_id, reason, priority_level, 
        status, requested_by, created_at, updated_at
      ) VALUES (?, ?, NULL, ?, 'Normal', 'pending', 'Manual', NOW(), NOW())`,
      [patient_id, specialty_id, finalReason]
    );
    
    const waiting_list_id = (result as any).insertId;
    console.log(`✅ Agregado a lista de espera con ID: ${waiting_list_id}`);
    
    // Insertar cada CUPS en la tabla de relación
    let cupsNames: string[] = [];
    if (cups_list && cups_list.length > 0) {
      for (const cups of cups_list) {
        await pool.execute(
          `INSERT INTO waiting_list_cups (
            waiting_list_id, cups_id, cups_code, cups_name, category, is_manual
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            waiting_list_id,
            cups.cups_id || null,
            cups.cups_code || null,
            cups.cups_name,
            cups.category || null,
            cups.manual || false
          ]
        );
        cupsNames.push(cups.cups_name);
      }
      console.log(`✅ Insertados ${cups_list.length} códigos CUPS para waiting_list_id=${waiting_list_id}`);
    }
    
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
        cups_count: cups_list?.length || 0,
        cups_names: cupsNames.join(', '),
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
         LIMIT ?`, [likePattern, likePattern, likePattern, likePattern, limit]
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

// ===== AUTENTICACIÓN PORTAL PACIENTE POR OTP (SMS) =====
// POST /api/patients-v2/public/auth/request-otp
// Body: { document: string, phone?: string }
router.post('/public/auth/request-otp', async (req, res) => {
  try {
    const rawDocument = (req.body?.document || '').toString();
    const rawPhone = (req.body?.phone || '').toString();

    if (!rawDocument.trim()) {
      return res.status(400).json({
        success: false,
        error: 'El documento es requerido'
      });
    }

    const document = normalizeDocument(rawDocument);

    const [rows] = await pool.execute(
      `SELECT id, name, document, phone
       FROM patients
       WHERE status = 'Activo' AND document = ?
       LIMIT 1`,
      [document]
    );

    if ((rows as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No se encontró un paciente activo con ese documento'
      });
    }

    const patient = (rows as any[])[0];
    const currentPhone = patient.phone ? normalizePhone(patient.phone) : '';
    const requestedPhone = rawPhone.trim() ? normalizePhone(rawPhone) : '';
    const phoneToUse = requestedPhone || currentPhone;

    if (!phoneToUse || phoneToUse.replace(/\D/g, '').length < 10) {
      return res.status(400).json({
        success: false,
        error: 'No hay un número de teléfono válido para enviar el OTP'
      });
    }

    const existingOtp = otpStore.get(document);
    const now = Date.now();
    if (existingOtp && (now - existingOtp.requestedAt) < OTP_RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - existingOtp.requestedAt)) / 1000);
      return res.status(429).json({
        success: false,
        error: `Espere ${waitSeconds} segundos antes de solicitar un nuevo código`,
        retry_after_seconds: waitSeconds,
        masked_phone: maskPhone(existingOtp.phone)
      });
    }

    if (requestedPhone && requestedPhone !== currentPhone) {
      await pool.execute(
        'UPDATE patients SET phone = ? WHERE id = ?',
        [requestedPhone, patient.id]
      );
    }

    const code = generateOtpCode();
    const message = `Fundacion Biosanar IPS: su codigo de verificacion es ${code}. Vence en 10 minutos. No lo comparta.`;

    const smsResult = await labsmobileService.sendSMS({
      number: phoneToUse,
      message,
      recipient_name: patient.name,
      patient_id: patient.id,
      template_id: 'portal_patient_login_otp'
    });

    if (!smsResult.success) {
      return res.status(500).json({
        success: false,
        error: smsResult.error || 'No se pudo enviar el código OTP'
      });
    }

    otpStore.set(document, {
      code,
      patientId: patient.id,
      document,
      phone: phoneToUse,
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      requestedAt: now
    });

    return res.json({
      success: true,
      data: {
        document,
        patient_id: patient.id,
        masked_phone: maskPhone(phoneToUse),
        phone: phoneToUse,
        expires_in_seconds: Math.floor(OTP_TTL_MS / 1000),
        resend_cooldown_seconds: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000)
      },
      message: 'Código OTP enviado por SMS'
    });
  } catch (error: any) {
    console.error('❌ Error solicitando OTP de portal paciente:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno solicitando OTP',
      details: error.message
    });
  }
});

// POST /api/patients-v2/public/auth/verify-otp
// Body: { document: string, code: string }
router.post('/public/auth/verify-otp', async (req, res) => {
  try {
    const rawDocument = (req.body?.document || '').toString();
    const rawCode = (req.body?.code || '').toString();

    if (!rawDocument.trim() || !rawCode.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Documento y código OTP son requeridos'
      });
    }

    const document = normalizeDocument(rawDocument);
    const code = rawCode.replace(/\D/g, '').trim();
    const otpEntry = otpStore.get(document);

    if (!otpEntry) {
      return res.status(400).json({
        success: false,
        error: 'No hay un OTP activo para este documento'
      });
    }

    const now = Date.now();
    if (now > otpEntry.expiresAt) {
      otpStore.delete(document);
      return res.status(400).json({
        success: false,
        error: 'El código OTP expiró. Solicite uno nuevo.'
      });
    }

    if (otpEntry.attempts >= OTP_MAX_ATTEMPTS) {
      otpStore.delete(document);
      return res.status(429).json({
        success: false,
        error: 'Se excedió el máximo de intentos. Solicite un nuevo código.'
      });
    }

    if (otpEntry.code !== code) {
      otpEntry.attempts += 1;
      otpStore.set(document, otpEntry);
      const remainingAttempts = Math.max(0, OTP_MAX_ATTEMPTS - otpEntry.attempts);

      return res.status(400).json({
        success: false,
        error: `Código inválido. Intentos restantes: ${remainingAttempts}`
      });
    }

    otpStore.delete(document);

    return res.json({
      success: true,
      data: {
        document,
        patient_id: otpEntry.patientId,
        phone: otpEntry.phone,
        verified: true
      },
      message: 'OTP verificado correctamente'
    });
  } catch (error: any) {
    console.error('❌ Error verificando OTP de portal paciente:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno verificando OTP',
      details: error.message
    });
  }
});

// ===== VERIFICAR CITA PÚBLICA (para escaneo de QR) =====
// GET /api/patients-v2/public/verify/:appointmentId
// Endpoint público SIN autenticación - para verificar citas escaneando QR
router.get('/public/verify/:appointmentId', async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.appointmentId);
    
    if (isNaN(appointmentId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de cita inválido'
      });
    }

    // Obtener datos de la cita con información del paciente
    // NOTA: Las horas en MySQL están almacenadas en UTC-0
    // Usamos CONVERT_TZ para convertir a hora Colombia (UTC-5)
    const [rows] = await pool.execute(
      `SELECT 
        a.id as appointment_id,
        p.name as patient_name,
        p.document as patient_document,
        DATE_FORMAT(a.scheduled_at, '%Y-%m-%d') as scheduled_date,
        DATE_FORMAT(CONVERT_TZ(a.scheduled_at, '+00:00', '-05:00'), '%l:%i %p') as scheduled_time_raw,
        a.status,
        a.reason,
        a.created_at,
        a.updated_at,
        d.name as doctor_name,
        s.name as specialty_name,
        l.name as location_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN specialties s ON a.specialty_id = s.id
      LEFT JOIN locations l ON a.location_id = l.id
      WHERE a.id = ?`,
      [appointmentId]
    );

    const appointments = rows as any[];
    
    if (appointments.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cita no encontrada'
      });
    }

    const appointment = appointments[0];
    
    // Formatear hora con notación española (a. m. / p. m.)
    let scheduled_time = appointment.scheduled_time_raw || '';
    if (scheduled_time) {
      scheduled_time = scheduled_time
        .replace(/AM/i, 'a. m.')
        .replace(/PM/i, 'p. m.');
    }

    // Limpiar nombre del paciente (quitar espacios extras)
    const cleanName = appointment.patient_name.replace(/\s+/g, ' ').trim();

    res.json({
      success: true,
      data: {
        appointment_id: appointment.appointment_id,
        patient_name: cleanName,
        patient_document: appointment.patient_document,
        scheduled_date: appointment.scheduled_date,
        scheduled_time: scheduled_time,
        doctor_name: appointment.doctor_name || 'Por asignar',
        specialty_name: appointment.specialty_name || 'No especificada',
        location_name: appointment.location_name || 'No especificada',
        reason: appointment.reason || '',
        status: appointment.status,
        created_at: appointment.created_at,
        updated_at: appointment.updated_at
      }
    });

  } catch (error: any) {
    console.error('❌ Error verificando cita:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar la cita'
    });
  }
});

// ===== OBTENER CITAS DE UN PACIENTE (para portal público) =====
// GET /api/patients-v2/:id/appointments
// Endpoint público SIN autenticación - incluye citas y lista de espera
router.get('/:id/appointments', async (req, res) => {
  try {
    const patientId = parseInt(req.params.id);

    // Obtener citas del paciente
    // NOTA: Las horas en MySQL están almacenadas en UTC-0
    // Usamos CONVERT_TZ para convertir a hora Colombia (UTC-5)
    const [rows] = await pool.execute(
      `SELECT 
        a.id as appointment_id,
        DATE_FORMAT(a.scheduled_at, '%Y-%m-%d') as scheduled_date,
        DATE_FORMAT(CONVERT_TZ(a.scheduled_at, '+00:00', '-05:00'), '%l:%i %p') as scheduled_time_raw,
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

    // Formatear la hora con notación española (a. m. / p. m.)
    const appointmentsWithColombiaTime = (rows as any[]).map(row => {
      // MySQL devuelve formato "3:45 PM", convertir a "3:45 p. m."
      let scheduled_time = row.scheduled_time_raw || '';
      if (scheduled_time) {
        scheduled_time = scheduled_time
          .replace(/AM/i, 'a. m.')
          .replace(/PM/i, 'p. m.');
      }
      return {
        ...row,
        scheduled_time,
        scheduled_time_raw: undefined // No enviar campo raw al frontend
      };
    });

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
      data: appointmentsWithColombiaTime,
      waiting_list: waitingList || []
    });
  } catch (e) {
    console.error('Error getting patient appointments:', e);
    res.status(500).json({ success: false, message: 'Error al obtener citas del paciente' });
  }
});

// ===== DETECTAR PACIENTES DUPLICADOS =====
// GET /api/patients-v2/duplicates
// IMPORTANTE: Esta ruta debe estar ANTES de /:id para evitar colisiones
router.get('/duplicates', requireAuth, async (req, res) => {
  try {
    const { type = 'document' } = req.query;
    
    let duplicatesQuery = '';
    
    switch (type) {
      case 'document':
        // Duplicados por mismo número de documento
        duplicatesQuery = `
          SELECT 
            p.id,
            p.document,
            p.name,
            p.phone,
            p.email,
            p.birth_date,
            p.gender,
            p.status,
            p.created_at,
            e.name as eps_name,
            p.document as duplicate_value
          FROM patients p
          LEFT JOIN eps e ON p.insurance_eps_id = e.id
          WHERE p.document IN (
            SELECT document 
            FROM patients 
            WHERE document IS NOT NULL AND document != ''
            GROUP BY document 
            HAVING COUNT(*) > 1
          )
          ORDER BY p.document, p.created_at ASC
        `;
        break;
        
      case 'name':
        // Duplicados por mismo nombre exacto
        duplicatesQuery = `
          SELECT 
            p.id,
            p.document,
            p.name,
            p.phone,
            p.email,
            p.birth_date,
            p.gender,
            p.status,
            p.created_at,
            e.name as eps_name,
            p.name as duplicate_value
          FROM patients p
          LEFT JOIN eps e ON p.insurance_eps_id = e.id
          WHERE LOWER(TRIM(p.name)) IN (
            SELECT LOWER(TRIM(name)) 
            FROM patients 
            WHERE name IS NOT NULL AND name != ''
            GROUP BY LOWER(TRIM(name)) 
            HAVING COUNT(*) > 1
          )
          ORDER BY p.name, p.created_at ASC
        `;
        break;
        
      case 'phone':
        // Duplicados por mismo teléfono
        duplicatesQuery = `
          SELECT 
            p.id,
            p.document,
            p.name,
            p.phone,
            p.email,
            p.birth_date,
            p.gender,
            p.status,
            p.created_at,
            e.name as eps_name,
            p.phone as duplicate_value
          FROM patients p
          LEFT JOIN eps e ON p.insurance_eps_id = e.id
          WHERE p.phone IN (
            SELECT phone 
            FROM patients 
            WHERE phone IS NOT NULL AND phone != '' AND LENGTH(phone) >= 7
            GROUP BY phone 
            HAVING COUNT(*) > 1
          )
          ORDER BY p.phone, p.created_at ASC
        `;
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Tipo de duplicado no válido. Use: document, name, phone'
        });
    }
    
    const [rows] = await pool.execute(duplicatesQuery);
    const patients = rows as any[];
    
    // Agrupar pacientes por valor duplicado
    const groupedDuplicates: Record<string, any[]> = {};
    
    patients.forEach(patient => {
      const key = type === 'name' 
        ? patient.duplicate_value?.toLowerCase().trim() 
        : patient.duplicate_value;
      
      if (key) {
        if (!groupedDuplicates[key]) {
          groupedDuplicates[key] = [];
        }
        groupedDuplicates[key].push({
          id: patient.id,
          document: patient.document,
          name: patient.name,
          phone: patient.phone,
          email: patient.email,
          birth_date: patient.birth_date,
          gender: patient.gender,
          status: patient.status,
          created_at: patient.created_at,
          eps_name: patient.eps_name
        });
      }
    });
    
    // Convertir a array de grupos
    const duplicateGroups = Object.entries(groupedDuplicates).map(([value, patients]) => ({
      duplicate_value: value,
      duplicate_type: type,
      count: patients.length,
      patients: patients
    }));
    
    // Ordenar por cantidad de duplicados (más duplicados primero)
    duplicateGroups.sort((a, b) => b.count - a.count);
    
    res.json({
      success: true,
      data: {
        type: type,
        total_groups: duplicateGroups.length,
        total_duplicates: patients.length,
        groups: duplicateGroups
      }
    });
    
  } catch (error) {
    console.error('Error al obtener duplicados:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener pacientes duplicados'
    });
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
       LIMIT ? OFFSET ?`;
    
    const [rows] = await pool.execute(query, [...queryParams, limitNumber, offsetNumber]);

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
    
    // Validar datos requeridos - NO PERMITIR valores NULL, undefined, 0 o vacíos
    if (!patient_id || patient_id === 0 || patient_id === '0') {
      return res.status(400).json({
        success: false,
        error: 'patient_id es obligatorio y debe tener un valor válido'
      });
    }

    if (!specialty_id || specialty_id === 0 || specialty_id === '0') {
      return res.status(400).json({
        success: false,
        error: 'specialty_id es obligatorio y debe tener un valor válido'
      });
    }

    if (!doctor_id || doctor_id === 0 || doctor_id === '0') {
      return res.status(400).json({
        success: false,
        error: 'doctor_id es obligatorio y debe tener un valor válido'
      });
    }

    if (!availability_id || availability_id === 0 || availability_id === '0') {
      return res.status(400).json({
        success: false,
        error: 'availability_id es obligatorio y debe tener un valor válido'
      });
    }

    // Validar que reason no esté vacío
    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'El motivo de la consulta es obligatorio'
      });
    }

    // Validar que el paciente exista en la base de datos
    console.log(`🔍 Verificando que el paciente ${patient_id} exista...`);
    const [patientCheck] = await pool.execute(
      `SELECT id, name, phone, gender FROM patients WHERE id = ? LIMIT 1`,
      [patient_id]
    );

    if ((patientCheck as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        error: `No se encontró el paciente con ID ${patient_id}`
      });
    }

    const patientData = (patientCheck as any[])[0];

    // ⛔ VALIDACIÓN DE GÉNERO: Pacientes masculinos NO pueden agendar Ginecología/Control Prenatal
    {
      const [specCheck] = await pool.execute(
        'SELECT name FROM specialties WHERE id = ? LIMIT 1', [specialty_id]
      );
      const specName = (specCheck as any[])[0]?.name || '';
      if (/ginecolog[ií]a|control\s*prenatal/i.test(specName) && patientData.gender === 'Masculino') {
        return res.status(400).json({
          success: false,
          error: `La especialidad ${specName} está disponible únicamente para pacientes de género femenino.`
        });
      }
    }

    // Validar que el doctor exista y esté activo
    console.log(`🔍 Verificando que el doctor ${doctor_id} exista y esté activo...`);
    const [doctorCheck] = await pool.execute(
      `SELECT id, name, active FROM doctors WHERE id = ? LIMIT 1`,
      [doctor_id]
    );

    if ((doctorCheck as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        error: `No se encontró el doctor con ID ${doctor_id}`
      });
    }

    if (!(doctorCheck as any[])[0].active) {
      return res.status(400).json({
        success: false,
        error: `El doctor seleccionado no está activo en el sistema`
      });
    }

    // Validar que la especialidad exista
    console.log(`🔍 Verificando que la especialidad ${specialty_id} exista...`);
    const [specialtyCheck] = await pool.execute(
      `SELECT id, name FROM specialties WHERE id = ? LIMIT 1`,
      [specialty_id]
    );

    if ((specialtyCheck as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        error: `No se encontró la especialidad con ID ${specialty_id}`
      });
    }

    // Obtener nombre de la especialidad para detectar citas dobles
    const specialtyName = (specialtyCheck as any[])[0].name;
    const isOdontologia = specialtyName.toLowerCase().includes('odontolog');

    // Extraer flags de cita doble consecutiva
    const { is_consecutive_double, first_appointment_id } = req.body;

    // Validar que el paciente no tenga citas activas en la MISMA ESPECIALIDAD (Confirmada o Pendiente)
    // EXCEPCIÓN: Permitir si es la segunda parte de una cita doble consecutiva
    console.log(`🔍 Verificando si el paciente ${patient_id} tiene citas activas en la especialidad ${specialty_id}...`);
    
    if (is_consecutive_double && first_appointment_id) {
      console.log(`✅ Es cita doble consecutiva (parte 2/2), omitiendo validación de duplicados. Primera cita: ${first_appointment_id}`);
    } else {
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
        
        console.log(`⚠️ Paciente ${patient_id} ya tiene una cita activa en ${existingAppointment.specialty_name}: ID ${existingAppointment.id}`);
        
        // Formatear fechas con timezone Colombia
        const scheduledDateFormatted = formatDateColombia(existingAppointment.scheduled_at);
        const scheduledTimeFormatted = formatTimeColombia(existingAppointment.scheduled_at);
        
        return res.status(409).json({
          success: false,
          error: 'Ya tienes una cita activa en esta especialidad',
          details: {
            existing_appointment_id: existingAppointment.id,
            specialty_name: existingAppointment.specialty_name,
            scheduled_date: scheduledDateFormatted,
            scheduled_time: scheduledTimeFormatted,
            status: existingAppointment.status,
            reason: existingAppointment.reason
          },
          message: `Ya tienes una cita ${existingAppointment.status.toLowerCase()} en ${existingAppointment.specialty_name} programada para el ${scheduledDateFormatted} a las ${scheduledTimeFormatted}. No puedes agendar otra cita en la misma especialidad hasta completar o cancelar la anterior.`
        });
      }
    }

    console.log(`✅ Paciente ${patient_id} no tiene citas activas en la especialidad ${specialty_id}, puede agendar nueva cita`);

    // Obtener información de la disponibilidad (availability)
    const [availabilityData] = await pool.execute(
      `SELECT 
        a.location_id,
        DATE_FORMAT(a.date, '%Y-%m-%d') as appointment_date,
        a.start_time,
        a.end_time,
        a.capacity,
        a.booked_slots,
        a.duration_minutes,
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
    const { location_id, appointment_date, start_time, end_time, duration_minutes } = availability;
    console.log(`⏱️ Duración de la agenda: ${duration_minutes} minutos`);

    // Validar que todos los datos críticos de la availability existan
    if (!location_id || !appointment_date || !start_time || !end_time || !duration_minutes) {
      return res.status(400).json({
        success: false,
        error: 'La disponibilidad seleccionada tiene datos incompletos. Por favor contacte al administrador.',
        details: {
          missing_fields: {
            location_id: !location_id,
            appointment_date: !appointment_date,
            start_time: !start_time,
            end_time: !end_time,
            duration_minutes: !duration_minutes
          }
        }
      });
    }

    // Validar que duration_minutes sea un número válido mayor a 0
    if (isNaN(duration_minutes) || duration_minutes <= 0) {
      return res.status(400).json({
        success: false,
        error: `La duración de la agenda es inválida: ${duration_minutes} minutos`
      });
    }

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

    const appointmentDateStr = String(appointment_date).split('T')[0].split(' ')[0];
    let newAppointmentTime: Date;
    
    // NUEVA LÓGICA: Si el usuario seleccionó una hora específica, usarla
    if (selected_time) {
      console.log(`🕐 Hora seleccionada (hora Colombia UTC-5): ${selected_time}`);
      
      // Validar que la hora seleccionada esté en formato correcto (HH:mm)
      const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timePattern.test(selected_time)) {
        return res.status(400).json({
          success: false,
          error: 'Formato de hora seleccionada inválido. Use formato HH:mm'
        });
      }
      
      newAppointmentTime = utcDateFromYMDAndColombiaTime(appointmentDateStr, selected_time);
      const checkDateString = newAppointmentTime.toISOString().slice(0, 10);
      const selected_time_utc = `${String(newAppointmentTime.getUTCHours()).padStart(2, '0')}:${String(newAppointmentTime.getUTCMinutes()).padStart(2, '0')}`;
      
      const [conflictingAppointments] = await pool.execute(
        `SELECT id 
         FROM appointments 
         WHERE availability_id = ? 
           AND doctor_id = ? 
           AND specialty_id = ? 
           AND DATE(scheduled_at) = ?
           AND TIME_FORMAT(scheduled_at, '%H:%i') = ?
           AND status IN ('Pendiente', 'Confirmada')
         LIMIT 1`,
        [availability_id, doctor_id, specialty_id, checkDateString, selected_time_utc]
      );
      
      if ((conflictingAppointments as any[]).length > 0) {
        return res.status(400).json({
          success: false,
          error: `La hora ${selected_time} ya está ocupada. Por favor seleccione otra hora.`
        });
      }
      
      console.log(`✅ Cita programada - UTC: ${newAppointmentTime.toISOString()} | Colombia: ${selected_time}`);
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
      newAppointmentTime = utcDateFromYMDAndUTCTime(appointmentDateStr, availability.start_time);
      console.log(`🕐 Primera cita del bloque programada para: ${newAppointmentTime.toISOString()} (usando start_time UTC: ${availability.start_time})`);
    }

    // Validar que la nueva cita + duración no exceda el horario de fin del bloque
    const blockEndTime = utcDateFromYMDAndUTCTime(appointmentDateStr, availability.end_time);
    
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

    // Validación final antes de insertar - Asegurar que ningún campo crítico sea NULL o inválido
    const dataToInsert = {
      patient_id,
      specialty_id,
      doctor_id,
      location_id,
      availability_id,
      cups_id: cups_id || null,
      scheduled_at: newAppointmentTime,
      duration_minutes,
      finalReason
    };

    console.log(`🔍 Validación final de datos antes de insertar:`, dataToInsert);

    // Validar que scheduled_at sea una fecha válida
    if (!newAppointmentTime || isNaN(newAppointmentTime.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'La fecha/hora de la cita calculada es inválida'
      });
    }

    // Validar que todos los IDs sean números válidos mayores a 0
    const requiredIds = { patient_id, specialty_id, doctor_id, location_id, availability_id };
    for (const [key, value] of Object.entries(requiredIds)) {
      if (!value || isNaN(value) || value <= 0) {
        return res.status(400).json({
          success: false,
          error: `El campo ${key} tiene un valor inválido: ${value}`
        });
      }
    }

    // Validar que finalReason no esté vacío
    if (!finalReason || finalReason.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'El motivo de la consulta no puede estar vacío'
      });
    }

    console.log(`✅ Todos los datos validados correctamente, procediendo a insertar...`);

    // 6. Detectar si es CITA DOBLE para Odontología
    const isDoubleAppointment = isOdontologia && /cita\s+doble|doble\s+cita|2\s+cupos|dos\s+cupos/i.test(reason);
    let secondAppointmentTime = null;
    
    if (isDoubleAppointment) {
      console.log(`🦷 Cita doble detectada para Odontología`);
      
      // Calcular hora de segunda cita (inmediatamente después de la primera)
      secondAppointmentTime = new Date(newAppointmentTime);
      secondAppointmentTime.setMinutes(secondAppointmentTime.getMinutes() + duration_minutes);
      
      // Verificar que la segunda cita no exceda el horario de cierre del bloque
      const appointmentEndTime = new Date(secondAppointmentTime);
      appointmentEndTime.setMinutes(appointmentEndTime.getMinutes() + duration_minutes);
      
      if (appointmentEndTime > blockEndTime) {
        console.log(`❌ No hay espacio para cita doble. Segunda cita excedería horario de cierre`);
        return res.status(400).json({
          success: false,
          error: 'No se puede agendar cita doble. No hay espacio suficiente en este horario',
          details: {
            first_appointment_ends_at: secondAppointmentTime.toLocaleTimeString('es-CO', { timeZone: COLOMBIA_TIMEZONE }),
            second_appointment_would_end_at: appointmentEndTime.toLocaleTimeString('es-CO', { timeZone: COLOMBIA_TIMEZONE }),
            availability_ends_at: blockEndTime.toLocaleTimeString('es-CO', { timeZone: COLOMBIA_TIMEZONE })
          },
          suggestion: 'La cita doble requiere 2 cupos consecutivos. Intente con otro horario o día con más disponibilidad.'
        });
      }
      
      // Verificar que haya al menos 2 cupos disponibles
      if (availability.booked_slots + 2 > availability.capacity) {
        console.log(`❌ No hay 2 cupos disponibles. Booked: ${availability.booked_slots}, Capacity: ${availability.capacity}`);
        return res.status(400).json({
          success: false,
          error: 'No hay suficientes cupos disponibles para cita doble',
          details: {
            required_slots: 2,
            available_slots: availability.capacity - availability.booked_slots
          },
          suggestion: 'Se requieren 2 cupos consecutivos. Seleccione otro horario con más disponibilidad.'
        });
      }
      
      console.log(`✅ Espacio validado para cita doble. Segunda cita: ${secondAppointmentTime.toLocaleTimeString('es-CO', { timeZone: COLOMBIA_TIMEZONE })}`);
    }

    // 7. Insertar primera cita en la base de datos
    const scheduledAtString = formatDateForMySQLUTC(newAppointmentTime);
    console.log(`📅 Guardando cita con fecha/hora: ${scheduledAtString}`);
    
    const [result] = await pool.execute(
      `INSERT INTO appointments (
        patient_id, specialty_id, doctor_id, location_id, availability_id, cups_id,
        scheduled_at, duration_minutes, appointment_type, status, reason,
        appointment_source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Presencial', 'Confirmada', ?, 'Manual', NOW())`,
      [
        patient_id, specialty_id, doctor_id, location_id, availability_id,
        cups_id || null, scheduledAtString, duration_minutes, 
        finalReason + (isDoubleAppointment ? ' - CITA DOBLE (1/2)' : '')
      ]
    );
    
    const appointment_id = (result as any).insertId;
    console.log(`✅ Primera cita creada con ID: ${appointment_id}`);

    let second_appointment_id = null;
    
    // 8. Si es cita doble, insertar segunda cita consecutiva
    if (isDoubleAppointment && secondAppointmentTime) {
      const secondScheduledAtString = formatDateForMySQLUTC(secondAppointmentTime);
      console.log(`📅 Guardando segunda cita con fecha/hora: ${secondScheduledAtString}`);
      
      const [result2] = await pool.execute(
        `INSERT INTO appointments (
          patient_id, specialty_id, doctor_id, location_id, availability_id, cups_id,
          scheduled_at, duration_minutes, appointment_type, status, reason,
          appointment_source, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Presencial', 'Confirmada', ?, 'Manual', NOW())`,
        [
          patient_id, specialty_id, doctor_id, location_id, availability_id,
          cups_id || null, secondScheduledAtString, duration_minutes,
          finalReason + ' - CITA DOBLE (2/2)'
        ]
      );
      
      second_appointment_id = (result2 as any).insertId;
      console.log(`✅ Segunda cita creada con ID: ${second_appointment_id}`);
    }

    // 9. Actualizar slots disponibles en availabilities
    const slotsToAdd = isDoubleAppointment ? 2 : 1;
    await pool.execute(
      `UPDATE availabilities 
       SET booked_slots = booked_slots + ? 
       WHERE id = ? AND booked_slots < capacity`,
      [slotsToAdd, availability_id]
    );
    console.log(`📈 ${slotsToAdd} slot(s) incrementado(s) en availabilities ID: ${availability_id}`);

    // 10. Respuesta exitosa con información completa
    // Formatear fecha correctamente sin problemas de zona horaria
    const localDate = new Date(newAppointmentTime);
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    
    const responseData: any = { 
      appointment_id,
      doctor_name: doctorName,
      scheduled_time: newAppointmentTime.toLocaleTimeString('es-CO', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Bogota'
      }),
      scheduled_date: localDate.toLocaleDateString('es-CO', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      appointment_date: formattedDate,
      scheduled_datetime: newAppointmentTime.toISOString(),
      duration_minutes: duration_minutes,
      cups_name: cups_name || null,
      reason: finalReason,
      location_name: availability.location_name,
      message: isDoubleAppointment 
        ? 'Cita doble agendada exitosamente - 2 cupos consecutivos reservados'
        : 'Cita agendada exitosamente'
    };
    
    // Agregar información de segunda cita si es cita doble
    if (isDoubleAppointment && second_appointment_id && secondAppointmentTime) {
      responseData.double_appointment = true;
      responseData.second_appointment_id = second_appointment_id;
      responseData.second_scheduled_time = secondAppointmentTime.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: COLOMBIA_TIMEZONE
      });
      responseData.second_scheduled_datetime = secondAppointmentTime.toISOString();
      responseData.appointments_created = 2;
    }

    // 🔔 ENVIAR SMS DE CONFIRMACIÓN AL PACIENTE
    if (patientData.phone && labsmobileService) {
      try {
        console.log(`📱 Enviando SMS de confirmación a ${patientData.phone}...`);
        
        // Formatear hora a UTC-5 (Colombia)
        const horaFormateada = newAppointmentTime.toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Bogota'
        });
        
        // Formatear fecha legible
        const fechaFormateada = newAppointmentTime.toLocaleDateString('es-CO', {
          timeZone: 'America/Bogota',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        // Construir mensaje SMS (sin emojis para compatibilidad con LabsMobile)
        let smsMessage = `Hola ${patientData.name.split(' ')[0]}! Tu cita ha sido CONFIRMADA.\n\n`;
        smsMessage += `Fecha: ${fechaFormateada}\n`;
        smsMessage += `Hora: ${horaFormateada}\n`;
        smsMessage += `Especialidad: ${specialtyName}\n`;
        smsMessage += `Doctor(a): ${doctorName}\n`;
        smsMessage += `Sede: ${availability.location_name}\n`;
        smsMessage += `Cita #${appointment_id}\n\n`;
        
        if (isDoubleAppointment && secondAppointmentTime) {
          const horaSegundaCita = secondAppointmentTime.toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'America/Bogota'
          });
          smsMessage += `CITA DOBLE: Tambien tienes cita a las ${horaSegundaCita}\n\n`;
        }
        
        smsMessage += `Recuerda llegar 15 min antes.\nFundacion Biosanar IPS`;
        
        // Enviar SMS de forma asíncrona (no bloquear la respuesta)
        labsmobileService.sendSMS({
          number: patientData.phone,
          message: smsMessage,
          recipient_name: patientData.name,
          patient_id: patient_id,
          appointment_id: appointment_id
        }).then(smsResult => {
          if (smsResult.success) {
            console.log(`✅ SMS de confirmación enviado exitosamente a ${patientData.phone}`);
          } else {
            console.warn(`⚠️ No se pudo enviar SMS de confirmación: ${smsResult.error}`);
          }
        }).catch(smsError => {
          console.error('❌ Error enviando SMS de confirmación:', smsError);
        });
        
      } catch (smsError) {
        // No fallar la creación de cita si falla el SMS
        console.error('❌ Error preparando SMS de confirmación:', smsError);
      }
    } else {
      console.log(`📱 No se envió SMS: ${!patientData.phone ? 'Paciente sin teléfono' : 'Servicio SMS no disponible'}`);
    }
    
    res.json({ 
      success: true, 
      data: responseData
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

    console.log(`🔍 Datos de cancelación recibidos:`, { appointmentId, patientId, cancellationReason });

    if (!appointmentId || !patientId) {
      console.log(`❌ Validación fallida: appointmentId=${appointmentId}, patientId=${patientId}`);
      return res.status(400).json({
        success: false,
        error: 'ID de cita y ID de paciente son requeridos'
      });
    }

    // Validar que sean números válidos
    const apptId = parseInt(appointmentId);
    const ptId = parseInt(patientId);

    if (isNaN(apptId) || isNaN(ptId) || apptId <= 0 || ptId <= 0) {
      console.log(`❌ IDs inválidos: appointmentId=${apptId}, patientId=${ptId}`);
      return res.status(400).json({
        success: false,
        error: 'Los IDs deben ser números válidos mayores a 0'
      });
    }

    console.log(`🚫 Intentando cancelar cita ${apptId} para paciente ${ptId}`);

    // 1. Verificar que la cita existe y pertenece al paciente
    console.log(`🔍 Buscando cita en base de datos...`);
    console.log(`🔍 Buscando cita en base de datos...`);
    const [appointmentRows] = await pool.execute(
      `SELECT 
        a.id, a.patient_id, a.status, a.availability_id, a.specialty_id,
        a.scheduled_at, d.name as doctor_name, s.name as specialty_name,
        l.name as location_name, p.name as patient_name, p.phone as patient_phone
       FROM appointments a
       LEFT JOIN doctors d ON a.doctor_id = d.id  
       LEFT JOIN specialties s ON a.specialty_id = s.id
       LEFT JOIN locations l ON a.location_id = l.id
       LEFT JOIN patients p ON a.patient_id = p.id
       WHERE a.id = ? AND a.patient_id = ?`,
      [apptId, ptId]
    );

    console.log(`🔍 Resultado de búsqueda: ${(appointmentRows as any[]).length} citas encontradas`);

    if ((appointmentRows as any[]).length === 0) {
      console.log(`❌ Cita no encontrada: appointmentId=${apptId}, patientId=${ptId}`);
      return res.status(404).json({
        success: false,
        error: 'Cita no encontrada o no pertenece a este paciente'
      });
    }

    const appointment = (appointmentRows as any[])[0];
    console.log(`✅ Cita encontrada:`, { 
      id: appointment.id, 
      status: appointment.status, 
      patient: appointment.patient_name,
      doctor: appointment.doctor_name 
    });
    // 2. Verificar que la cita se puede cancelar (no está ya cancelada o completada)
    if (appointment.status === 'Cancelada') {
      console.log(`⚠️ Cita ${apptId} ya está cancelada`);
      return res.status(400).json({
        success: false,
        error: 'Esta cita ya está cancelada'
      });
    }

    if (appointment.status === 'Completada') {
      console.log(`⚠️ Cita ${apptId} ya fue completada`);
      return res.status(400).json({
        success: false,
        error: 'No se puede cancelar una cita que ya fue completada'
      });
    }

    console.log(`✅ Validaciones pasadas, procediendo a cancelar...`);

    // 3. Verificar que no se esté cancelando muy tarde (opcional - se puede ajustar)
    const scheduledTime = new Date(appointment.scheduled_at);
    const now = new Date();
    const hoursUntilAppointment = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    console.log(`⏰ Horas hasta la cita: ${hoursUntilAppointment.toFixed(2)}`);

    if (hoursUntilAppointment < 2) {
      console.log(`⚠️ Cita programada en ${hoursUntilAppointment.toFixed(2)} horas - permitir cancelación tardía`);
      // Por ahora permitiremos la cancelación, pero se puede agregar restricción aquí
    }

    // 4. Actualizar el estado de la cita a 'Cancelada'
    const reason = cancellationReason ? `Cancelada por paciente: ${cancellationReason}` : 'Cancelada por paciente';
    
    console.log(`📝 Actualizando estado de la cita a Cancelada con razón: ${reason}`);
    
    await pool.execute(
      `UPDATE appointments 
       SET status = 'Cancelada', 
           cancellation_reason = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [reason, apptId]
    );

    console.log(`✅ Estado de cita actualizado en base de datos`);

    // 5. Liberar el cupo en la availability si existe
    if (appointment.availability_id) {
      console.log(`📉 Liberando cupo en availability_id: ${appointment.availability_id}`);
      await pool.execute(
        `UPDATE availabilities 
         SET booked_slots = CASE 
           WHEN booked_slots > 0 THEN booked_slots - 1 
           ELSE 0 
         END 
         WHERE id = ?`,
        [appointment.availability_id]
      );
      console.log(`✅ Cupo liberado en availability_id ${appointment.availability_id}`);
    } else {
      console.log(`ℹ️ No hay availability_id asociado, no se libera cupo`);
    }

    console.log(`✅ Cita ${apptId} cancelada exitosamente`);

    // 6. Verificar si es una CITA DOBLE y cancelar la segunda cita de forma SECUENCIAL
    console.log(`🔍 Verificando si es una cita doble (Odontología)...`);
    
    // Buscar si hay otra cita del mismo paciente en la misma especialidad, 
    // en la misma fecha y con horario consecutivo (dentro de los próximos 30 minutos)
    const scheduledAt = new Date(appointment.scheduled_at);
    const nextTimeWindow = new Date(scheduledAt);
    nextTimeWindow.setMinutes(nextTimeWindow.getMinutes() + 30); // Ventana de 30 minutos

    const [relatedAppointments] = await pool.execute(
      `SELECT id, scheduled_at, status, reason 
       FROM appointments 
       WHERE patient_id = ? 
         AND specialty_id = ?
         AND id != ?
         AND status IN ('Confirmada', 'Pendiente')
         AND scheduled_at BETWEEN ? AND ?
       LIMIT 1`,
      [ptId, appointment.specialty_id, apptId, scheduledAt, nextTimeWindow]
    );

    if ((relatedAppointments as any[]).length > 0) {
      const relatedAppointment = (relatedAppointments as any[])[0];
      console.log(`🔗 Cita doble detectada! Cita relacionada ID: ${relatedAppointment.id}`);
      console.log(`⏳ Cancelando segunda cita de forma SECUENCIAL para evitar conflicto de triggers...`);

      try {
        // CANCELAR LA SEGUNDA CITA DE FORMA SECUENCIAL (después de que se completen los triggers de la primera)
        await pool.execute(
          `UPDATE appointments 
           SET status = 'Cancelada', 
               cancellation_reason = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [`Cancelada automáticamente (cita doble vinculada a #${apptId})`, relatedAppointment.id]
        );
        
        console.log(`✅ Segunda cita ${relatedAppointment.id} cancelada exitosamente`);

        // Liberar el cupo de la segunda cita si tiene availability_id
        const [relatedAvailability] = await pool.execute(
          `SELECT availability_id FROM appointments WHERE id = ?`,
          [relatedAppointment.id]
        );

        if ((relatedAvailability as any[]).length > 0) {
          const relatedAvailId = (relatedAvailability as any[])[0].availability_id;
          if (relatedAvailId) {
            await pool.execute(
              `UPDATE availabilities 
               SET booked_slots = CASE 
                 WHEN booked_slots > 0 THEN booked_slots - 1 
                 ELSE 0 
               END 
               WHERE id = ?`,
              [relatedAvailId]
            );
            console.log(`✅ Cupo de segunda cita liberado en availability_id ${relatedAvailId}`);
          }
        }

      } catch (secondCancelError: any) {
        console.error(`❌ Error cancelando segunda cita ${relatedAppointment.id}:`, secondCancelError.message);
        // No interrumpir el flujo - la primera cita ya fue cancelada exitosamente
      }
    } else {
      console.log(`ℹ️ No se encontró cita doble relacionada, solo se canceló la cita ${apptId}`);
    }

    // 7. Procesar lista de espera manualmente (ya que deshabilitamos el trigger)
    if (appointment.availability_id) {
      console.log(`📋 Procesando lista de espera para availability_id: ${appointment.availability_id}`);
      try {
        // Buscar si hay pacientes en lista de espera para esta disponibilidad
        const [waitingList] = await pool.execute(
          `SELECT id, patient_id, scheduled_date, appointment_type, reason, notes, priority_level
           FROM appointments_waiting_list
           WHERE availability_id = ?
             AND status = 'pending'
           ORDER BY 
             CASE priority_level
               WHEN 'Urgente' THEN 1
               WHEN 'Alta' THEN 2
               WHEN 'Normal' THEN 3
               WHEN 'Baja' THEN 4
             END,
             created_at ASC
           LIMIT 1`,
          [appointment.availability_id]
        );

        if ((waitingList as any[]).length > 0) {
          const waitingPatient = (waitingList as any[])[0];
          console.log(`✅ Paciente encontrado en lista de espera: ${waitingPatient.patient_id}, creando cita...`);

          // Obtener información de la availability
          const [availInfo] = await pool.execute(
            `SELECT location_id, specialty_id, doctor_id, duration_minutes
             FROM availabilities
             WHERE id = ?`,
            [appointment.availability_id]
          );

          if ((availInfo as any[]).length > 0) {
            const avail = (availInfo as any[])[0];
            
            // Crear nueva cita para el paciente en lista de espera
            const [newApptResult] = await pool.execute(
              `INSERT INTO appointments (
                patient_id, availability_id, location_id, specialty_id, doctor_id,
                scheduled_at, duration_minutes, appointment_type, status, 
                reason, notes, priority_level
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente', ?, ?, ?)`,
              [
                waitingPatient.patient_id,
                appointment.availability_id,
                avail.location_id,
                avail.specialty_id,
                avail.doctor_id,
                waitingPatient.scheduled_date,
                avail.duration_minutes,
                waitingPatient.appointment_type,
                waitingPatient.reason,
                `Reasignada desde lista de espera. ${waitingPatient.notes || ''}`,
                waitingPatient.priority_level
              ]
            );

            const newAppointmentId = (newApptResult as any).insertId;
            
            // Actualizar el estado en la lista de espera
            await pool.execute(
              `UPDATE appointments_waiting_list
               SET status = 'reassigned',
                   reassigned_at = NOW(),
                   reassigned_appointment_id = ?
               WHERE id = ?`,
              [newAppointmentId, waitingPatient.id]
            );

            console.log(`✅ Cita creada desde lista de espera: appointment_id=${newAppointmentId}`);
          }
        } else {
          console.log(`ℹ️ No hay pacientes en lista de espera para availability_id ${appointment.availability_id}`);
        }
      } catch (waitingListError: any) {
        console.error(`⚠️ Error procesando lista de espera:`, waitingListError.message);
        // No interrumpir el flujo - la cancelación ya fue exitosa
      }
    }

    // 8. Enviar notificación SMS al administrador (no bloqueante)
    console.log(`📱 Intentando enviar notificación SMS...`);
    try {
      const adminPhone = process.env.CANCELLATION_NOTIFICATION_PHONE || process.env.ADMIN_NOTIFICATION_PHONE;
      console.log(`📱 Admin phone configurado: ${adminPhone ? 'SÍ' : 'NO'}`);
      console.log(`📱 labsmobileService disponible: ${labsmobileService ? 'SÍ' : 'NO'}`);
      console.log(`📱 sendSMS es función: ${typeof labsmobileService?.sendSMS === 'function' ? 'SÍ' : 'NO'}`);
      
      if (adminPhone && labsmobileService && typeof labsmobileService.sendSMS === 'function') {
        // Usar funciones utilitarias para extraer fecha/hora sin problemas de timezone
        const appointmentDate = extractDateFromMySQLDatetime(appointment.scheduled_at);
        const appointmentTime = extractTimeFromMySQLDatetime(appointment.scheduled_at);

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
        console.log(`⚠️ No se pudo enviar notificación: servicio SMS no disponible o CANCELLATION_NOTIFICATION_PHONE no configurado`);
      }
    } catch (smsError: any) {
      console.error('❌ Error enviando notificación SMS al administrador:', smsError.message || smsError);
      // No interrumpir el flujo si falla el SMS - continuar con la respuesta exitosa
    }

    // 8.5. Enviar SMS de cancelación al PACIENTE
    if (appointment.patient_phone && labsmobileService) {
      try {
        console.log(`📱 Enviando SMS de cancelación al paciente: ${appointment.patient_phone}`);
        
        // Usar funciones utilitarias para extraer fecha/hora sin problemas de timezone
        const horaFormateada = extractTimeFromMySQLDatetime(appointment.scheduled_at);
        const fechaFormateada = extractDateFromMySQLDatetime(appointment.scheduled_at);
        
        // Obtener primer nombre del paciente
        const primerNombre = appointment.patient_name ? appointment.patient_name.split(' ')[0] : 'Paciente';
        
        // Construir mensaje SMS de cancelación (sin emojis para compatibilidad)
        let smsMessage = `Hola ${primerNombre}, tu cita ha sido CANCELADA.\n\n`;
        smsMessage += `Fecha: ${fechaFormateada}\n`;
        smsMessage += `Hora: ${horaFormateada}\n`;
        smsMessage += `Especialidad: ${appointment.specialty_name || 'N/A'}\n`;
        smsMessage += `Doctor(a): ${appointment.doctor_name || 'N/A'}\n`;
        smsMessage += `Sede: ${appointment.location_name || 'N/A'}\n`;
        if (cancellationReason && cancellationReason.trim()) {
          smsMessage += `Motivo: ${cancellationReason.trim()}\n`;
        }
        smsMessage += `\nReagenda en: biosanarcall.site\n`;
        smsMessage += `Fundacion Biosanar IPS`;
        
        // Enviar SMS de forma asíncrona
        labsmobileService.sendSMS({
          number: appointment.patient_phone,
          message: smsMessage,
          recipient_name: appointment.patient_name,
          patient_id: appointment.patient_id,
          appointment_id: appointment.id
        }).then(smsResult => {
          if (smsResult.success) {
            console.log(`✅ SMS de cancelación enviado al paciente: ${appointment.patient_phone}`);
          } else {
            console.warn(`⚠️ No se pudo enviar SMS de cancelación: ${smsResult.error}`);
          }
        }).catch(err => {
          console.error('❌ Error enviando SMS de cancelación al paciente:', err);
        });
        
      } catch (patientSmsError: any) {
        console.error('❌ Error preparando SMS de cancelación al paciente:', patientSmsError.message);
      }
    } else {
      console.log(`📱 No se envió SMS al paciente: ${!appointment.patient_phone ? 'Sin teléfono' : 'Servicio no disponible'}`);
    }

    // 9. Respuesta exitosa con detalles de la cita cancelada
    // NOTA: Usar extractTimeFromMySQLDatetime en lugar de toLocaleTimeString para evitar problemas de timezone
    console.log(`📤 Enviando respuesta exitosa al cliente`);
    res.json({
      success: true,
      data: {
        appointment_id: appointment.id,
        status: 'Cancelada',
        doctor_name: appointment.doctor_name,
        specialty_name: appointment.specialty_name,
        location_name: appointment.location_name,
        scheduled_date: extractDateFromMySQLDatetime(appointment.scheduled_at),
        scheduled_time: extractTimeFromMySQLDatetime(appointment.scheduled_at),
        cancellation_reason: reason
      },
      message: 'Cita cancelada exitosamente'
    });

  } catch (error: any) {
    console.error('❌ Error cancelando cita:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Error al cancelar la cita',
      details: error.message,
      errorType: error.name
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

    console.log(`✅ Endpoint /public/available-schedules ALCANZADO - specialtyId: ${specialtyId}, epsId: ${epsId}`);

    // Primero obtenemos la duración de la especialidad
    const [specialtyRows] = await pool.execute(
      'SELECT default_duration_minutes FROM specialties WHERE id = ?',
      [specialtyId]
    );
    
    const duration = (specialtyRows as any[])[0]?.default_duration_minutes || 15;
    console.log(`✅ Duración de la especialidad: ${duration} minutos`);

    // Obtener agendas disponibles SIN LIMITE - todas las fechas futuras
    const [availabilityRows] = await pool.execute(
      `SELECT 
        av.id as availability_id,
        DATE_FORMAT(av.date, '%Y-%m-%d') as appointment_date,
        av.start_time,
        av.end_time,
        av.capacity as total_slots,
        av.booked_slots,
        GREATEST(0, CAST(av.capacity AS SIGNED) - CAST(av.booked_slots AS SIGNED)) as slots_available,
        d.name as doctor_name,
        d.id as doctor_id,
        s.name as specialty_name,
        l.name as location_name,
        l.id as location_id,
        av.date as raw_date,
        av.duration_minutes
       FROM availabilities av
       INNER JOIN doctors d ON av.doctor_id = d.id
       INNER JOIN specialties s ON av.specialty_id = s.id
       INNER JOIN locations l ON av.location_id = l.id
       WHERE av.specialty_id = ?
       AND av.status = 'Activa'
       AND av.date >= CURDATE()
       AND GREATEST(0, CAST(av.capacity AS SIGNED) - CAST(av.booked_slots AS SIGNED)) > 0
       AND (av.is_paused = 0 OR av.is_paused IS NULL)
       ORDER BY av.date ASC, av.start_time ASC`,
      [specialtyId]
    );

    let availabilities = availabilityRows as any[];
    console.log(`✅ Agendas encontradas: ${availabilities.length}`);

    // Función para calcular todos los time slots disponibles
    const calculateAvailableTimeSlots = async (availability: any): Promise<string[]> => {
      try {
        // IMPORTANTE: start_time y end_time están en UTC en la base de datos
        // Debemos convertirlos a hora Colombia (UTC-5) para que coincidan con las citas convertidas
        const startTimeUTC = availability.start_time; // formato HH:mm:ss (hora UTC)
        const endTimeUTC = availability.end_time;     // formato HH:mm:ss (hora UTC)
        const slotDuration = availability.duration_minutes || duration;
        const availabilityId = availability.availability_id;
        const date = availability.appointment_date;

        // Convertir times a minutos desde medianoche
        const parseTimeToMinutes = (time: string): number => {
          const parts = time.split(':').map(Number);
          return parts[0] * 60 + parts[1];
        };

        const formatMinutesToTime = (minutes: number): string => {
          const h = Math.floor(minutes / 60);
          const m = minutes % 60;
          return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
        };

        // Convertir de UTC a hora Colombia (restar 5 horas = 300 minutos)
        const UTC_OFFSET_MINUTES = 5 * 60; // 5 horas = 300 minutos
        let startMinutes = parseTimeToMinutes(startTimeUTC) - UTC_OFFSET_MINUTES;
        let endMinutes = parseTimeToMinutes(endTimeUTC) - UTC_OFFSET_MINUTES;
        
        // Manejar caso donde las horas se vuelven negativas (cruzando medianoche)
        if (startMinutes < 0) startMinutes += 24 * 60;
        if (endMinutes < 0) endMinutes += 24 * 60;
        
        // Generar todos los slots posibles en hora Colombia
        const allSlots: string[] = [];
        for (let time = startMinutes; time + slotDuration <= endMinutes; time += slotDuration) {
          allSlots.push(formatMinutesToTime(time));
        }

        // Consultar citas ya agendadas para esta agenda y fecha
        // scheduled_at está en UTC, convertir a UTC-5 (Colombia) para comparar
        const [bookedAppointments] = await pool.execute(
          `SELECT TIME_FORMAT(CONVERT_TZ(scheduled_at, '+00:00', '-05:00'), '%H:%i') AS booked_time 
           FROM appointments 
           WHERE availability_id = ? 
             AND DATE(CONVERT_TZ(scheduled_at, '+00:00', '-05:00')) = ? 
             AND status NOT IN ('Cancelada', 'No Show')
           ORDER BY scheduled_at`,
          [availabilityId, date]
        );

        // Crear set de horas ocupadas (ya en hora local Colombia)
        const bookedTimes = new Set(
          (bookedAppointments as any[]).map(app => app.booked_time)
        );

        // Filtrar slots disponibles (ahora ambos están en hora Colombia)
        const availableSlots = allSlots.filter(slot => {
          const slotTime = slot.substring(0, 5); // HH:mm
          return !bookedTimes.has(slotTime);
        });
        
        console.log(`[CALCULATE-TIME-SLOTS] Agenda ${availabilityId}: UTC(${startTimeUTC}-${endTimeUTC}) -> COL. Slots: ${availableSlots.length}/${allSlots.length} disponibles`);
        return availableSlots;
      } catch (error) {
        console.error('[CALCULATE-TIME-SLOTS] Error:', error);
        return [];
      }
    };

    // Calcular time slots disponibles para cada agenda
    const availabilitiesWithTimeSlots = await Promise.all(
      availabilities.map(async (availability) => {
        const availableTimeSlots = await calculateAvailableTimeSlots(availability);
        
        // Limpiar campos no necesarios
        delete availability.raw_date;
        delete availability.duration_minutes;
        
        return {
          ...availability,
          available_time_slots: availableTimeSlots,
          slots_available: availableTimeSlots.length
        };
      })
    );

    // Filtrar solo las agendas que realmente tienen slots disponibles
    const filteredAvailabilities = availabilitiesWithTimeSlots.filter(av => av.available_time_slots.length > 0);

    console.log(`✅ Agendas con slots disponibles: ${filteredAvailabilities.length}`);
    console.log(`✅ Total de slots disponibles: ${filteredAvailabilities.reduce((sum, av) => sum + av.available_time_slots.length, 0)}`);

    res.json({
      success: true,
      data: filteredAvailabilities,
      message: `Se encontraron ${filteredAvailabilities.length} agendas con ${filteredAvailabilities.reduce((sum, av) => sum + av.available_time_slots.length, 0)} horarios disponibles`
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
        d.name as doctor_name, s.name as specialty_name, l.name as location_name,
        p.name as patient_name, p.phone as patient_phone
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
        av.id, av.doctor_id, av.specialty_id, av.location_id, DATE_FORMAT(av.date, '%Y-%m-%d') as date, 
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
    const newDateStr = String(newAvailability.date).split('T')[0].split(' ')[0];
    
    if (selected_time) {
      // Usar la hora específica seleccionada por el usuario
      console.log(`⏰ Usando hora específica seleccionada: ${selected_time}`);
      
      // Limpiar el tiempo - remover segundos si vienen incluidos (HH:MM:SS -> HH:MM)
      let cleanTime = selected_time;
      if (selected_time.split(':').length === 3) {
        cleanTime = selected_time.substring(0, 5); // Tomar solo HH:MM
      }
      
      // Validar formato de hora (HH:MM)
      const timeRegex = /^([01]?\d|2[0-3]):([0-5]?\d)$/;
      if (!timeRegex.test(cleanTime)) {
        return res.status(400).json({
          success: false,
          error: 'Formato de hora inválido. Use HH:MM'
        });
      }
      
      const [selectedHour, selectedMinute] = cleanTime.split(':');
      newScheduledTime = utcDateFromYMDAndColombiaTime(newDateStr, `${selectedHour}:${selectedMinute}`);
      
      // Verificar que la hora esté dentro del horario de disponibilidad
      const availabilityStart = utcDateFromYMDAndUTCTime(newDateStr, newAvailability.start_time);
      
      const availabilityEnd = utcDateFromYMDAndUTCTime(newDateStr, newAvailability.end_time);
      
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
      const scheduledUTCDateStr = newScheduledTime.toISOString().slice(0, 10);
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
          scheduledUTCDateStr, 
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
        [newAvailabilityId, newAvailability.doctor_id, newAvailability.specialty_id, newDateStr]
      );

      const lastScheduledTime = (lastAppointmentRows as any[])[0]?.last_scheduled_time;

      if (lastScheduledTime) {
        // Hay citas previas, programar después de la última
        newScheduledTime = new Date(lastScheduledTime);
        newScheduledTime.setMinutes(newScheduledTime.getMinutes() + duration);
      } else {
        // Primera cita del día, usar la hora de inicio de la availability
        newScheduledTime = utcDateFromYMDAndUTCTime(newDateStr, newAvailability.start_time);
      }
      
      // Validar que la nueva hora esté dentro del horario de la availability
      const endTime = utcDateFromYMDAndUTCTime(newDateStr, newAvailability.end_time);

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
          formatDateForMySQLUTC(newScheduledTime),
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

    // 9. Enviar SMS de confirmación de reagendamiento al paciente
    if (currentAppointment.patient_phone && labsmobileService) {
      try {
        console.log(`📱 Enviando SMS de reagendamiento a ${currentAppointment.patient_phone}`);
        
        // Formatear nueva hora a UTC-5 (Colombia)
        const horaFormateada = newScheduledTime.toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Bogota'
        });
        
        const fechaFormateada = newScheduledTime.toLocaleDateString('es-CO', {
          timeZone: 'America/Bogota',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        const primerNombre = currentAppointment.patient_name ? currentAppointment.patient_name.split(' ')[0] : 'Paciente';
        
        // Construir mensaje SMS
        let smsMessage = `Hola ${primerNombre}, tu cita ha sido REAGENDADA.\n\n`;
        smsMessage += `NUEVA CITA:\n`;
        smsMessage += `Fecha: ${fechaFormateada}\n`;
        smsMessage += `Hora: ${horaFormateada}\n`;
        smsMessage += `Especialidad: ${newAvailability.specialty_name}\n`;
        smsMessage += `Doctor(a): ${newAvailability.doctor_name}\n`;
        smsMessage += `Sede: ${newAvailability.location_name}\n`;
        smsMessage += `Cita #${appointmentId}\n\n`;
        smsMessage += `Recuerda llegar 15 min antes.\nFundacion Biosanar IPS`;
        
        // Enviar SMS de forma asíncrona
        labsmobileService.sendSMS({
          number: currentAppointment.patient_phone,
          message: smsMessage,
          recipient_name: currentAppointment.patient_name,
          patient_id: patientId,
          appointment_id: parseInt(appointmentId)
        }).then(smsResult => {
          if (smsResult.success) {
            console.log(`✅ SMS de reagendamiento enviado a ${currentAppointment.patient_phone}`);
          } else {
            console.warn(`⚠️ No se pudo enviar SMS de reagendamiento: ${smsResult.error}`);
          }
        }).catch(err => {
          console.error('❌ Error enviando SMS de reagendamiento:', err);
        });
        
      } catch (smsError: any) {
        console.error('❌ Error preparando SMS de reagendamiento:', smsError.message);
      }
    } else {
      console.log(`📱 No se envió SMS: ${!currentAppointment.patient_phone ? 'Sin teléfono' : 'Servicio no disponible'}`);
    }

    // 10. Respuesta exitosa con detalles de la nueva cita
    const scheduledTimeFormatted = newScheduledTime.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Bogota'
    });
    
    res.json({
      success: true,
      data: {
        appointmentId: appointmentId,
        oldDate: currentAppointment.scheduled_at,
        newDate: newScheduledTime,
        scheduled_time: scheduledTimeFormatted,
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

// ===== ACTUALIZAR TELÉFONO DEL PACIENTE (para portal público) =====
// PUT /api/patients-v2/public/update-phone
// Permite al paciente actualizar su número de teléfono
router.put('/public/update-phone', async (req, res) => {
  try {
    const { patientId, document, phone } = req.body;

    console.log('📱 Solicitud de actualización de teléfono:', { patientId, document, phone });

    // Validar datos requeridos
    if (!patientId || !document || !phone) {
      return res.status(400).json({
        success: false,
        error: 'ID de paciente, documento y teléfono son requeridos'
      });
    }

    // Validar formato de teléfono (debe tener al menos 10 dígitos)
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'El teléfono debe tener al menos 10 dígitos'
      });
    }

    // Verificar que el paciente existe y el documento coincide (seguridad)
    const [patientRows] = await pool.execute(
      `SELECT id, document, name FROM patients WHERE id = ? AND document = ? AND status = 'Activo'`,
      [patientId, document]
    );

    if ((patientRows as any[]).length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Paciente no encontrado o documento no coincide'
      });
    }

    // Actualizar el teléfono
    await pool.execute(
      `UPDATE patients SET phone = ? WHERE id = ?`,
      [phone, patientId]
    );

    console.log(`✅ Teléfono actualizado exitosamente para paciente ${patientId}`);

    res.json({
      success: true,
      message: 'Teléfono actualizado exitosamente',
      data: {
        patientId,
        phone
      }
    });

  } catch (error: any) {
    console.error('❌ Error actualizando teléfono:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar el teléfono',
      details: error.message
    });
  }
});

// PUT /api/patients-v2/public/waiting-list/:waitingListId/status
// Actualizar estado de lista de espera (público - para portal de pacientes)
router.put('/public/waiting-list/:waitingListId/status', async (req, res) => {
  try {
    const { waitingListId } = req.params;
    const { status } = req.body;
    
    // Validar que se proporcione el estado
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'El estado es obligatorio'
      });
    }
    
    // Validar que el estado sea válido
    const validStatuses = ['pending', 'reassigned', 'expired', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}`
      });
    }
    
    console.log(`📝 Actualizando lista de espera ID ${waitingListId} a estado: ${status}`);
    
    // Actualizar el estado
    const [result] = await pool.execute(
      'UPDATE appointments_waiting_list SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, waitingListId]
    );
    
    if ((result as any).affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'No se encontró la solicitud en lista de espera'
      });
    }
    
    console.log(`✅ Lista de espera ID ${waitingListId} actualizada a: ${status}`);
    
    res.json({
      success: true,
      message: `Estado de lista de espera actualizado a: ${status}`,
      data: {
        waiting_list_id: waitingListId,
        status
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error actualizando estado de lista de espera:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar el estado de lista de espera',
      details: error.message
    });
  }
});

export default router;
