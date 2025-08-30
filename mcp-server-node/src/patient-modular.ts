// patient-modular.ts - Rutas modulares para el sistema de registro de pacientes
// Estas rutas soportan el nuevo sistema modular del frontend con menos campos por herramienta

import * as express from 'express';
import { Request, Response } from 'express';
import * as mysql from 'mysql2/promise';

export function setupPatientModularRoutes(app: express.Application, pool: mysql.Pool) {

  // === UTILIDADES ===
  
  // Función para inferir género basado en nombre (heurística mejorada)
  function inferGenderFromName(name: string): string {
    const nameLower = name.toLowerCase().trim();
    
    // Nombres típicamente masculinos
    const maleNames = [
      'juan', 'carlos', 'luis', 'miguel', 'jose', 'david', 'jorge', 'manuel', 
      'ricardo', 'francisco', 'antonio', 'sebastian', 'andres', 'diego', 'pablo', 
      'alejandro', 'pedro', 'rafael', 'jesus', 'daniel', 'oscar', 'fernando', 
      'eduardo', 'javier', 'sergio', 'martin', 'mario', 'alberto', 'gabriel',
      'leonardo', 'raul', 'victor', 'ernesto', 'roberto', 'guillermo'
    ];
    
    // Nombres típicamente femeninos
    const femaleNames = [
      'maria', 'ana', 'carmen', 'lucia', 'patricia', 'rosa', 'laura', 'marta', 
      'elena', 'sofia', 'claudia', 'gabriela', 'andrea', 'paola', 'monica', 
      'teresa', 'cristina', 'diana', 'sandra', 'beatriz', 'gloria', 'martha',
      'lorena', 'alejandra', 'natalia', 'carolina', 'adriana', 'veronica',
      'jessica', 'angela', 'marcela', 'silvia', 'pilar', 'valentina'
    ];
    
    // Extraer primer nombre
    const firstName = nameLower.split(' ')[0];
    
    // Verificar nombres específicos
    if (maleNames.includes(firstName)) return 'Masculino';
    if (femaleNames.includes(firstName)) return 'Femenino';
    
    // Terminaciones comunes
    if (firstName.endsWith('a') || firstName.endsWith('ia') || firstName.endsWith('na')) {
      return 'Femenino';
    }
    if (firstName.endsWith('o') || firstName.endsWith('an') || firstName.endsWith('el')) {
      return 'Masculino';
    }
    
    return 'No especificado';
  }

  // Validador de email
  function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Validador de fecha
  function isValidDate(date: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
  }

  // === RUTAS MODULARES ===

  // 1. INFORMACIÓN BÁSICA (4 campos: documento, tipo_documento, nombre, fecha_nacimiento)
  app.post('/api/patients-basic', async (req: Request, res: Response) => {
    try {
      const { document, document_type_id, name, birth_date } = req.body;

      // Validación de campos obligatorios
      if (!document || !document_type_id || !name || !birth_date) {
        return res.status(400).json({
          error: 'Campos obligatorios: document, document_type_id, name, birth_date'
        });
      }

      // Validación de formato de fecha
      if (!isValidDate(birth_date)) {
        return res.status(400).json({
          error: 'Formato de fecha inválido. Use YYYY-MM-DD'
        });
      }

      // Verificar si el documento ya existe
      const [existing] = await pool.execute(
        'SELECT id FROM patients WHERE document = ? LIMIT 1',
        [document]
      );

      if ((existing as any[]).length > 0) {
        return res.status(409).json({
          error: 'Ya existe un paciente con este documento'
        });
      }

      // Inferir género automáticamente
      const gender = inferGenderFromName(name);

      // Crear paciente con información básica
      const [result] = await pool.execute(
        `INSERT INTO patients (document, document_type_id, name, birth_date, gender, status, created_at) 
         VALUES (?, ?, ?, ?, ?, 'Activo', NOW())`,
        [document, document_type_id, name, birth_date, gender]
      );

      const patientId = (result as any).insertId;

      res.status(201).json({
        success: true,
        patient_id: patientId,
        message: 'Información básica guardada correctamente',
        data: {
          id: patientId,
          document,
          document_type_id,
          name,
          birth_date,
          gender,
          status: 'Activo'
        }
      });

    } catch (error: any) {
      console.error('Error en /api/patients-basic:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        details: error.message
      });
    }
  });

  // 2. INFORMACIÓN DE CONTACTO (6 campos: teléfono, teléfono_alt, email, dirección, municipio, zona)
  app.post('/api/patients-contact', async (req: Request, res: Response) => {
    try {
      const { patient_id, phone, phone_alt, email, address, municipality_id, zone_id } = req.body;

      // Validación de campo obligatorio
      if (!patient_id) {
        return res.status(400).json({
          error: 'Campo obligatorio: patient_id'
        });
      }

      // Validar email si se proporciona
      if (email && !isValidEmail(email)) {
        return res.status(400).json({
          error: 'Formato de email inválido'
        });
      }

      // Verificar que el paciente existe
      const [patient] = await pool.execute(
        'SELECT id FROM patients WHERE id = ? LIMIT 1',
        [patient_id]
      );

      if (!(patient as any[]).length) {
        return res.status(404).json({
          error: 'Paciente no encontrado'
        });
      }

      // Actualizar información de contacto
      const [result] = await pool.execute(
        `UPDATE patients 
         SET phone = ?, phone_alt = ?, email = ?, address = ?, municipality_id = ?, zone_id = ?, updated_at = NOW()
         WHERE id = ?`,
        [phone || null, phone_alt || null, email || null, address || null, municipality_id || null, zone_id || null, patient_id]
      );

      res.json({
        success: true,
        message: 'Información de contacto actualizada correctamente',
        data: {
          patient_id,
          phone,
          phone_alt,
          email,
          address,
          municipality_id,
          zone_id
        }
      });

    } catch (error: any) {
      console.error('Error en /api/patients-contact:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        details: error.message
      });
    }
  });

  // 3. INFORMACIÓN MÉDICA (5 campos: grupo_sanguíneo, tiene_discapacidad, tipo_discapacidad, grupo_poblacional, notas)
  app.post('/api/patients-medical', async (req: Request, res: Response) => {
    try {
      const { patient_id, blood_group_id, has_disability, disability_type_id, population_group_id, notes } = req.body;

      // Validación de campo obligatorio
      if (!patient_id) {
        return res.status(400).json({
          error: 'Campo obligatorio: patient_id'
        });
      }

      // Verificar que el paciente existe
      const [patient] = await pool.execute(
        'SELECT id FROM patients WHERE id = ? LIMIT 1',
        [patient_id]
      );

      if (!(patient as any[]).length) {
        return res.status(404).json({
          error: 'Paciente no encontrado'
        });
      }

      // Validar lógica de discapacidad
      const hasDisabilityBool = Boolean(has_disability);
      const finalDisabilityTypeId = hasDisabilityBool ? disability_type_id : null;

      // Actualizar información médica
      await pool.execute(
        `UPDATE patients 
         SET blood_group_id = ?, has_disability = ?, disability_type_id = ?, population_group_id = ?, notes = ?, updated_at = NOW()
         WHERE id = ?`,
        [blood_group_id || null, hasDisabilityBool, finalDisabilityTypeId, population_group_id || null, notes || null, patient_id]
      );

      res.json({
        success: true,
        message: 'Información médica actualizada correctamente',
        data: {
          patient_id,
          blood_group_id,
          has_disability: hasDisabilityBool,
          disability_type_id: finalDisabilityTypeId,
          population_group_id,
          notes
        }
      });

    } catch (error: any) {
      console.error('Error en /api/patients-medical:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        details: error.message
      });
    }
  });

  // 4. INFORMACIÓN DE SEGURO (3 campos: eps, tipo_afiliación, estrato)
  app.post('/api/patients-insurance', async (req: Request, res: Response) => {
    try {
      const { patient_id, insurance_eps_id, insurance_affiliation_type, estrato } = req.body;

      // Validación de campos obligatorios
      if (!patient_id) {
        return res.status(400).json({
          error: 'Campo obligatorio: patient_id'
        });
      }

      // Validar estrato si se proporciona
      if (estrato !== undefined && (estrato < 0 || estrato > 6)) {
        return res.status(400).json({
          error: 'El estrato debe estar entre 0 y 6'
        });
      }

      // Verificar que el paciente existe
      const [patient] = await pool.execute(
        'SELECT id FROM patients WHERE id = ? LIMIT 1',
        [patient_id]
      );

      if (!(patient as any[]).length) {
        return res.status(404).json({
          error: 'Paciente no encontrado'
        });
      }

      // Actualizar información de seguro
      await pool.execute(
        `UPDATE patients 
         SET insurance_eps_id = ?, insurance_affiliation_type = ?, estrato = ?, updated_at = NOW()
         WHERE id = ?`,
        [insurance_eps_id || null, insurance_affiliation_type || null, estrato || null, patient_id]
      );

      res.json({
        success: true,
        message: 'Información de seguro actualizada correctamente',
        data: {
          patient_id,
          insurance_eps_id,
          insurance_affiliation_type,
          estrato
        }
      });

    } catch (error: any) {
      console.error('Error en /api/patients-insurance:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        details: error.message
      });
    }
  });

  // 5. INFORMACIÓN DEMOGRÁFICA (5 campos: nivel_educativo, estado_civil, género - manual)
  app.post('/api/patients-demographic', async (req: Request, res: Response) => {
    try {
      const { patient_id, education_level_id, marital_status_id, gender } = req.body;

      // Validación de campo obligatorio
      if (!patient_id) {
        return res.status(400).json({
          error: 'Campo obligatorio: patient_id'
        });
      }

      // Validar género si se proporciona
      const validGenders = ['Masculino', 'Femenino', 'Otro', 'No especificado'];
      if (gender && !validGenders.includes(gender)) {
        return res.status(400).json({
          error: `Género inválido. Valores permitidos: ${validGenders.join(', ')}`
        });
      }

      // Verificar que el paciente existe
      const [patient] = await pool.execute(
        'SELECT id, gender as current_gender FROM patients WHERE id = ? LIMIT 1',
        [patient_id]
      );

      if (!(patient as any[]).length) {
        return res.status(404).json({
          error: 'Paciente no encontrado'
        });
      }

      // Usar género actual si no se proporciona uno nuevo
      const currentPatient = (patient as any[])[0];
      const finalGender = gender || currentPatient.current_gender;

      // Actualizar información demográfica
      await pool.execute(
        `UPDATE patients 
         SET education_level_id = ?, marital_status_id = ?, gender = ?, updated_at = NOW()
         WHERE id = ?`,
        [education_level_id || null, marital_status_id || null, finalGender, patient_id]
      );

      res.json({
        success: true,
        message: 'Información demográfica actualizada correctamente',
        data: {
          patient_id,
          education_level_id,
          marital_status_id,
          gender: finalGender
        }
      });

    } catch (error: any) {
      console.error('Error en /api/patients-demographic:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        details: error.message
      });
    }
  });

  // 6. OBTENER PACIENTE COMPLETO - Versión modular (GET)
  app.get('/api/patients-v2/:id', async (req: Request, res: Response) => {
    try {
      const patientId = parseInt(req.params.id);

      if (isNaN(patientId)) {
        return res.status(400).json({
          error: 'ID de paciente inválido'
        });
      }

      // Consulta completa con todos los datos y nombres de tablas relacionadas
      const [rows] = await pool.execute(
        `SELECT 
          p.*,
          dt.name as document_type_name,
          bg.name as blood_group_name,
          el.name as education_level_name,
          ms.name as marital_status_name,
          pg.name as population_group_name,
          disab.name as disability_type_name,
          m.name as municipality_name,
          z.name as zone_name,
          eps.name as eps_name
        FROM patients p
        LEFT JOIN document_types dt ON p.document_type_id = dt.id
        LEFT JOIN blood_groups bg ON p.blood_group_id = bg.id
        LEFT JOIN education_levels el ON p.education_level_id = el.id
        LEFT JOIN marital_statuses ms ON p.marital_status_id = ms.id
        LEFT JOIN population_groups pg ON p.population_group_id = pg.id
        LEFT JOIN disability_types disab ON p.disability_type_id = disab.id
        LEFT JOIN municipalities m ON p.municipality_id = m.id
        LEFT JOIN zones z ON p.zone_id = z.id
        LEFT JOIN eps ON p.insurance_eps_id = eps.id
        WHERE p.id = ? LIMIT 1`,
        [patientId]
      );

      if (!(rows as any[]).length) {
        return res.status(404).json({
          error: 'Paciente no encontrado'
        });
      }

      const patient = (rows as any[])[0];

      // Organizar datos por módulos para el frontend
      const response = {
        success: true,
        patient: {
          id: patient.id,
          status: patient.status,
          created_at: patient.created_at,
          updated_at: patient.updated_at,
          
          // Módulo 1: Información básica
          basic_info: {
            document: patient.document,
            document_type_id: patient.document_type_id,
            document_type_name: patient.document_type_name,
            name: patient.name,
            birth_date: patient.birth_date,
            gender: patient.gender
          },
          
          // Módulo 2: Información de contacto
          contact_info: {
            phone: patient.phone,
            phone_alt: patient.phone_alt,
            email: patient.email,
            address: patient.address,
            municipality_id: patient.municipality_id,
            municipality_name: patient.municipality_name,
            zone_id: patient.zone_id,
            zone_name: patient.zone_name
          },
          
          // Módulo 3: Información médica
          medical_info: {
            blood_group_id: patient.blood_group_id,
            blood_group_name: patient.blood_group_name,
            has_disability: Boolean(patient.has_disability),
            disability_type_id: patient.disability_type_id,
            disability_type_name: patient.disability_type_name,
            population_group_id: patient.population_group_id,
            population_group_name: patient.population_group_name,
            notes: patient.notes
          },
          
          // Módulo 4: Información de seguro
          insurance_info: {
            insurance_eps_id: patient.insurance_eps_id,
            eps_name: patient.eps_name,
            insurance_affiliation_type: patient.insurance_affiliation_type,
            estrato: patient.estrato
          },
          
          // Módulo 5: Información demográfica
          demographic_info: {
            education_level_id: patient.education_level_id,
            education_level_name: patient.education_level_name,
            marital_status_id: patient.marital_status_id,
            marital_status_name: patient.marital_status_name
          }
        }
      };

      res.json(response);

    } catch (error: any) {
      console.error('Error en /api/patients-v2/:id:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        details: error.message
      });
    }
  });

  // 7. LISTAR PACIENTES - Versión modular con paginación
  app.get('/api/patients-v2/', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const search = req.query.search as string || '';
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          p.id, p.document, p.name, p.phone, p.email, p.birth_date, 
          p.gender, p.status, p.created_at,
          dt.name as document_type_name,
          m.name as municipality_name
        FROM patients p
        LEFT JOIN document_types dt ON p.document_type_id = dt.id
        LEFT JOIN municipalities m ON p.municipality_id = m.id
      `;
      
      const queryParams: any[] = [];

      if (search) {
        query += ' WHERE (p.name LIKE ? OR p.document LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)';
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
      queryParams.push(limit, offset);

      const [rows] = await pool.execute(query, queryParams);

      // Contar total de registros
      let countQuery = 'SELECT COUNT(*) as total FROM patients p';
      const countParams: any[] = [];

      if (search) {
        countQuery += ' WHERE (p.name LIKE ? OR p.document LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)';
        const searchPattern = `%${search}%`;
        countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      const [countResult] = await pool.execute(countQuery, countParams);
      const total = (countResult as any[])[0].total;

      res.json({
        success: true,
        data: {
          patients: rows,
          pagination: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
            has_next: page * limit < total,
            has_prev: page > 1
          },
          search: search || null
        }
      });

    } catch (error: any) {
      console.error('Error en /api/patients-v2/:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        details: error.message
      });
    }
  });

  console.log('✅ Rutas modulares de pacientes configuradas:');
  console.log('   POST /api/patients-basic - Información básica (4 campos)');
  console.log('   POST /api/patients-contact - Información de contacto (6 campos)');
  console.log('   POST /api/patients-medical - Información médica (5 campos)');
  console.log('   POST /api/patients-insurance - Información de seguro (3 campos)');
  console.log('   POST /api/patients-demographic - Información demográfica (3 campos)');
  console.log('   GET  /api/patients-v2/:id - Obtener paciente completo');
  console.log('   GET  /api/patients-v2/ - Listar pacientes con paginación');
}
