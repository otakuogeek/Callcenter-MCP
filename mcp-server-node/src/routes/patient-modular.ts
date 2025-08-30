import express from 'express';
import { authenticateApiKey } from '../middleware/auth';
import { pool } from '../db/mysql';
import logger from '../logger-mysql';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = express.Router();

// ===================================
// UTILIDADES COMUNES
// ===================================

interface JSONRPCRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: any;
}

interface JSONRPCResponse {
  jsonrpc: string;
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

function createSuccessResponse(id: string | number, result: any): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id,
    result
  };
}

function createErrorResponse(id: string | number, code: number, message: string, data?: any): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: { code, message, data }
  };
}

// Función para inferir género por nombre
function inferGenderFromName(fullName: string): string {
  if (!fullName || fullName.trim().length < 2) return 'No especificado';
  
  const firstName = fullName.trim().split(' ')[0].toLowerCase();
  
  // Patrones de nombres femeninos comunes
  const femalePatterns = [
    /^ana/, /^maria/, /^luz/, /^carmen/, /^rosa/, /^angela/, /^claudia/, /^sandra/, /^patricia/,
    /^adriana/, /^monica/, /^veronica/, /^gloria/, /^esperanza/, /^soledad/, /^pilar/, /^mercedes/,
    /^isabel/, /^cristina/, /^beatriz/, /^silvia/, /^elena/, /^laura/, /^marta/, /^teresa/,
    /.*a$/, // nombres que terminan en 'a'
  ];
  
  // Patrones de nombres masculinos comunes
  const malePatterns = [
    /^carlos/, /^juan/, /^jose/, /^luis/, /^miguel/, /^antonio/, /^francisco/, /^manuel/,
    /^rafael/, /^pedro/, /^sergio/, /^fernando/, /^ricardo/, /^eduardo/, /^alberto/, /^roberto/,
    /^alejandro/, /^daniel/, /^david/, /^jorge/, /^mario/, /^oscar/, /^raul/, /^andres/,
    /^jesus/, /^martin/, /^pablo/, /^victor/, /^angel/, /^javier/, /^gustavo/, /^ivan/
  ];
  
  for (const pattern of femalePatterns) {
    if (pattern.test(firstName)) return 'Femenino';
  }
  
  for (const pattern of malePatterns) {
    if (pattern.test(firstName)) return 'Masculino';
  }
  
  return 'No especificado';
}

// ===================================
// ENDPOINTS MODULARES DE PACIENTES
// ===================================

// 1. INFORMACIÓN BÁSICA DEL PACIENTE
router.post('/patients-basic', authenticateApiKey, async (req, res) => {
  try {
    const { document, document_type_id, name, birth_date, gender } = req.body;
    
    // Validar campos obligatorios
    if (!document || !name) {
      return res.status(400).json({
        success: false,
        message: 'Documento y nombre son obligatorios'
      });
    }
    
    // Verificar si el paciente ya existe
    const [existingPatients] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM patients WHERE document = ?',
      [document]
    );
    
    if (existingPatients.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe un paciente con este documento'
      });
    }
    
    // Inferir género si no se proporciona
    let finalGender = gender;
    if (!finalGender || finalGender === 'No especificado') {
      finalGender = inferGenderFromName(name);
    }
    
    // Validar formato de fecha si se proporciona
    if (birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(birth_date)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de fecha inválido (debe ser YYYY-MM-DD)'
      });
    }
    
    // Insertar información básica
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO patients (document, document_type_id, name, birth_date, gender, status, created_at) 
       VALUES (?, ?, ?, ?, ?, 'Activo', NOW())`,
      [document, document_type_id || null, name, birth_date || null, finalGender]
    );
    
    const patientId = result.insertId;
    
    logger.info('Información básica de paciente creada', {
      patientId,
      document,
      name
    });
    
    res.json({
      success: true,
      data: {
        id: patientId,
        document,
        name,
        birth_date,
        gender: finalGender,
        status: 'Activo'
      },
      message: 'Información básica del paciente guardada correctamente'
    });
    
  } catch (error) {
    logger.error('Error al crear información básica del paciente', { error });
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// 2. INFORMACIÓN DE CONTACTO
router.post('/patients-contact', authenticateApiKey, async (req, res) => {
  try {
    const { 
      patient_id, phone, phone_alt, email, address, 
      municipality_id, estrato 
    } = req.body;
    
    // Validar que exista el paciente
    const [patients] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM patients WHERE id = ?',
      [patient_id]
    );
    
    if (patients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }
    
    // Validar teléfono obligatorio
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Teléfono principal es obligatorio'
      });
    }
    
    // Validar formato de email si se proporciona
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de email inválido'
      });
    }
    
    // Actualizar información de contacto
    await pool.execute(
      `UPDATE patients SET 
       phone = ?, phone_alt = ?, email = ?, address = ?, 
       municipality_id = ?, estrato = ?, updated_at = NOW()
       WHERE id = ?`,
      [phone, phone_alt || null, email || null, address || null, 
       municipality_id || null, estrato || null, patient_id]
    );
    
    logger.info('Información de contacto actualizada', {
      patientId: patient_id,
      phone
    });
    
    res.json({
      success: true,
      data: {
        patient_id,
        phone,
        phone_alt,
        email,
        address,
        municipality_id,
        estrato
      },
      message: 'Información de contacto guardada correctamente'
    });
    
  } catch (error) {
    logger.error('Error al actualizar información de contacto', { error });
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// 3. INFORMACIÓN MÉDICA
router.post('/patients-medical', authenticateApiKey, async (req, res) => {
  try {
    const { 
      patient_id, blood_group_id, has_disability, disability_type_id,
      medical_notes, allergies, chronic_conditions
    } = req.body;
    
    // Validar que exista el paciente
    const [patients] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM patients WHERE id = ?',
      [patient_id]
    );
    
    if (patients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }
    
    // Actualizar información médica
    await pool.execute(
      `UPDATE patients SET 
       blood_group_id = ?, has_disability = ?, disability_type_id = ?,
       notes = ?, updated_at = NOW()
       WHERE id = ?`,
      [blood_group_id || null, has_disability || false, 
       disability_type_id || null, medical_notes || null, patient_id]
    );
    
    // Si hay información adicional de alergias/condiciones, crear registros separados
    if (allergies || chronic_conditions) {
      // Crear tabla de historial médico si no existe (opcional)
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS patient_medical_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          patient_id INT NOT NULL,
          allergies TEXT,
          chronic_conditions TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (patient_id) REFERENCES patients(id)
        )
      `);
      
      // Insertar o actualizar historial médico
      await pool.execute(`
        INSERT INTO patient_medical_history (patient_id, allergies, chronic_conditions)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE 
        allergies = VALUES(allergies), 
        chronic_conditions = VALUES(chronic_conditions),
        updated_at = NOW()
      `, [patient_id, allergies || null, chronic_conditions || null]);
    }
    
    logger.info('Información médica actualizada', {
      patientId: patient_id,
      hasDisability: has_disability
    });
    
    res.json({
      success: true,
      data: {
        patient_id,
        blood_group_id,
        has_disability,
        disability_type_id,
        medical_notes,
        allergies,
        chronic_conditions
      },
      message: 'Información médica guardada correctamente'
    });
    
  } catch (error) {
    logger.error('Error al actualizar información médica', { error });
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// 4. INFORMACIÓN DE SEGURO
router.post('/patients-insurance', authenticateApiKey, async (req, res) => {
  try {
    const { 
      patient_id, insurance_eps_id, insurance_affiliation_type,
      insurance_notes
    } = req.body;
    
    // Validar que exista el paciente
    const [patients] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM patients WHERE id = ?',
      [patient_id]
    );
    
    if (patients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }
    
    // Validar campos obligatorios
    if (!insurance_eps_id || !insurance_affiliation_type) {
      return res.status(400).json({
        success: false,
        message: 'EPS y tipo de afiliación son obligatorios'
      });
    }
    
    // Actualizar información de seguro
    await pool.execute(
      `UPDATE patients SET 
       insurance_eps_id = ?, insurance_affiliation_type = ?,
       updated_at = NOW()
       WHERE id = ?`,
      [insurance_eps_id, insurance_affiliation_type, patient_id]
    );
    
    logger.info('Información de seguro actualizada', {
      patientId: patient_id,
      epsId: insurance_eps_id
    });
    
    res.json({
      success: true,
      data: {
        patient_id,
        insurance_eps_id,
        insurance_affiliation_type,
        insurance_notes
      },
      message: 'Información de seguro guardada correctamente'
    });
    
  } catch (error) {
    logger.error('Error al actualizar información de seguro', { error });
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// 5. INFORMACIÓN DEMOGRÁFICA
router.post('/patients-demographic', authenticateApiKey, async (req, res) => {
  try {
    const { 
      patient_id, population_group_id, education_level_id, 
      marital_status_id, occupation, demographic_notes
    } = req.body;
    
    // Validar que exista el paciente
    const [patients] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM patients WHERE id = ?',
      [patient_id]
    );
    
    if (patients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }
    
    // Actualizar información demográfica
    await pool.execute(
      `UPDATE patients SET 
       population_group_id = ?, education_level_id = ?, 
       marital_status_id = ?, updated_at = NOW()
       WHERE id = ?`,
      [population_group_id || null, education_level_id || null, 
       marital_status_id || null, patient_id]
    );
    
    // Crear tabla de información demográfica extendida si no existe
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS patient_demographics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        occupation VARCHAR(100),
        demographic_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id),
        UNIQUE KEY unique_patient_demographics (patient_id)
      )
    `);
    
    // Insertar o actualizar información demográfica extendida
    await pool.execute(`
      INSERT INTO patient_demographics (patient_id, occupation, demographic_notes)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      occupation = VALUES(occupation), 
      demographic_notes = VALUES(demographic_notes),
      updated_at = NOW()
    `, [patient_id, occupation || null, demographic_notes || null]);
    
    logger.info('Información demográfica actualizada', {
      patientId: patient_id
    });
    
    res.json({
      success: true,
      data: {
        patient_id,
        population_group_id,
        education_level_id,
        marital_status_id,
        occupation,
        demographic_notes
      },
      message: 'Información demográfica guardada correctamente'
    });
    
  } catch (error) {
    logger.error('Error al actualizar información demográfica', { error });
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// 6. OBTENER PACIENTE COMPLETO POR ID
router.get('/patients-v2/:id', authenticateApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [patients] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        p.*,
        dt.name as document_type_name,
        dt.code as document_type_code,
        bg.name as blood_group_name,
        bg.code as blood_group_code,
        pg.name as population_group_name,
        el.name as education_level_name,
        ms.name as marital_status_name,
        dit.name as disability_type_name,
        m.name as municipality_name,
        eps.name as eps_name,
        pmh.allergies,
        pmh.chronic_conditions,
        pd.occupation,
        pd.demographic_notes
      FROM patients p
      LEFT JOIN document_types dt ON p.document_type_id = dt.id
      LEFT JOIN blood_groups bg ON p.blood_group_id = bg.id
      LEFT JOIN population_groups pg ON p.population_group_id = pg.id
      LEFT JOIN education_levels el ON p.education_level_id = el.id
      LEFT JOIN marital_statuses ms ON p.marital_status_id = ms.id
      LEFT JOIN disability_types dit ON p.disability_type_id = dit.id
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      LEFT JOIN eps eps ON p.insurance_eps_id = eps.id
      LEFT JOIN patient_medical_history pmh ON p.id = pmh.patient_id
      LEFT JOIN patient_demographics pd ON p.id = pd.patient_id
      WHERE p.id = ?
    `, [id]);
    
    if (patients.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: patients[0]
    });
    
  } catch (error) {
    logger.error('Error al obtener paciente', { error });
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// 7. LISTAR PACIENTES CON FILTROS
router.get('/patients-v2', authenticateApiKey, async (req, res) => {
  try {
    const { 
      search, eps_id, municipality_id, gender, 
      limit = 50, offset = 0 
    } = req.query;
    
    let whereConditions = ['p.status = "Activo"'];
    let queryParams: any[] = [];
    
    // Agregar filtros
    if (search) {
      whereConditions.push('(p.name LIKE ? OR p.document LIKE ? OR p.phone LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (eps_id) {
      whereConditions.push('p.insurance_eps_id = ?');
      queryParams.push(eps_id);
    }
    
    if (municipality_id) {
      whereConditions.push('p.municipality_id = ?');
      queryParams.push(municipality_id);
    }
    
    if (gender) {
      whereConditions.push('p.gender = ?');
      queryParams.push(gender);
    }
    
    // Agregar límites
    queryParams.push(parseInt(limit as string), parseInt(offset as string));
    
    const [patients] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        p.id, p.document, p.name, p.phone, p.email, 
        p.birth_date, p.gender, p.address, p.status, p.created_at,
        dt.name as document_type_name,
        bg.name as blood_group_name,
        m.name as municipality_name,
        eps.name as eps_name,
        p.insurance_affiliation_type
      FROM patients p
      LEFT JOIN document_types dt ON p.document_type_id = dt.id
      LEFT JOIN blood_groups bg ON p.blood_group_id = bg.id
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      LEFT JOIN eps eps ON p.insurance_eps_id = eps.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `, queryParams);
    
    // Contar total
    const countParams = queryParams.slice(0, -2); // Remover limit y offset
    const [countResult] = await pool.execute<RowDataPacket[]>(`
      SELECT COUNT(*) as total
      FROM patients p
      WHERE ${whereConditions.join(' AND ')}
    `, countParams);
    
    res.json({
      success: true,
      data: {
        patients,
        total: countResult[0].total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
    
  } catch (error) {
    logger.error('Error al listar pacientes', { error });
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

export default router;
