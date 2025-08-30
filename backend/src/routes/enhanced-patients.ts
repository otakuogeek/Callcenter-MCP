// ==============================================
// RUTAS MEJORADAS DE PACIENTES - BIOSANARCALL 2025
// ==============================================

import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import pool from '../db/pool';

const router = express.Router();

// Crear un nuevo paciente con auditoría y campos extendidos
router.post('/', requireAuth, requireRole(['admin', 'recepcionista']), async (req, res) => {
  try {
    const {
      // Campos básicos
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
      
      // Campos médicos (legacy compatibility)
      alergias,
      contacto_emergencia_nombre,
      contacto_emergencia_telefono
    } = req.body;

    // Validaciones básicas
    if (!document || !document_type_id || !name || !phone || !birth_date) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios: document, document_type_id, name, phone, birth_date'
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

    // Crear el paciente con todos los campos
    const [result] = await pool.execute(
      `INSERT INTO patients (
        document, document_type_id, name, phone, email, birth_date, gender, address,
        municipality_id, insurance_eps_id, insurance_affiliation_type,
        blood_group_id, population_group_id, education_level_id, marital_status_id,
        estrato, has_disability, disability_type_id, phone_alt, notes,
        alergias, contacto_emergencia_nombre, contacto_emergencia_telefono
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        document, document_type_id, name, phone, email, birth_date, gender, address,
        municipality_id, insurance_eps_id, insurance_affiliation_type,
        blood_group_id, population_group_id, education_level_id, marital_status_id,
        estrato, has_disability, disability_type_id, phone_alt, notes,
        alergias, contacto_emergencia_nombre, contacto_emergencia_telefono
      ]
    );

    const pacienteId = (result as any).insertId;

    // TODO: Implementar auditoría cuando esté disponible
    // await AuditService.logAction('patients', 'create', pacienteId, req.user!.id, {
    //   new_data: req.body
    // });

    // TODO: Implementar notificaciones cuando esté disponible  
    // await NotificationService.createNotification(
    //   pacienteId,
    //   'welcome',
    //   'Bienvenido a Biosanar IPS',
    //   `Hola ${name}, tu registro ha sido completado exitosamente.`
    // );

    res.status(201).json({
      success: true,
      message: 'Paciente creado exitosamente',
      data: { id: pacienteId }
    });
  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear paciente'
    });
  }
});

// Obtener paciente con documentos y notificaciones
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
       WHERE p.id = ?`,
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

    // TODO: Obtener documentos del paciente cuando esté disponible
    // const documentos = await DocumentService.getPatientDocuments(pacienteId);

    // TODO: Obtener notificaciones recientes cuando esté disponible
    // const notificaciones = await NotificationService.getNotifications(pacienteId, 10);

    // Obtener historial médico básico actualizado
    const [historialRows] = await pool.execute(
      `SELECT 
        a.id, 
        a.scheduled_at as fecha_cita, 
        a.status as estado, 
        d.name as doctor_nombre, 
        s.name as servicio_nombre,
        a.notes as notas
       FROM appointments a
       LEFT JOIN doctors d ON a.doctor_id = d.id
       LEFT JOIN services s ON a.service_id = s.id
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

// Actualizar paciente con auditoría
router.put('/:id', requireAuth, requireRole(['admin', 'recepcionista', 'doctor']), async (req, res) => {
  try {
    const pacienteId = parseInt(req.params.id);

    // Obtener datos actuales para auditoría
    const [currentRows] = await pool.execute(
      'SELECT * FROM patients WHERE id = ?',
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
      `UPDATE patients SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...valores, pacienteId]
    );

    // TODO: Implementar auditoría cuando esté disponible
    // await AuditService.logAction('patients', 'update', pacienteId, req.user!.id, {
    //   old_data: currentData,
    //   new_data: req.body
    // });

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

// Eliminar paciente (soft delete) con auditoría
router.delete('/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const pacienteId = parseInt(req.params.id);

    // Verificar que el paciente existe
    const [currentRows] = await pool.execute(
      'SELECT * FROM pacientes WHERE id = ?',
      [pacienteId]
    );

    const currentData = (currentRows as any[])[0];
    if (!currentData) {
      return res.status(404).json({
        success: false,
        message: 'Paciente no encontrado'
      });
    }

    // Soft delete
    await pool.execute(
      'UPDATE pacientes SET activo = FALSE WHERE id = ?',
      [pacienteId]
    );

    // TODO: Implementar auditoría cuando esté disponible
    // await AuditService.logAction('patients', 'delete', pacienteId, req.user!.id, {
    //   old_data: currentData
    // });

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

// Buscar pacientes con filtros avanzados
router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      search,
      eps_id,
      municipio_id,
      tipo_documento,
      genero,
      page = 1,
      limit = 20,
      sort_by = 'nombre',
      sort_order = 'ASC'
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    let whereConditions = ['p.activo = TRUE'];
    let queryParams: any[] = [];

    if (search) {
      whereConditions.push('(p.nombre LIKE ? OR p.numero_documento LIKE ? OR p.telefono LIKE ? OR p.email LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (eps_id) {
      whereConditions.push('p.eps_id = ?');
      queryParams.push(eps_id);
    }

    if (municipio_id) {
      whereConditions.push('p.municipio_id = ?');
      queryParams.push(municipio_id);
    }

    if (tipo_documento) {
      whereConditions.push('p.tipo_documento = ?');
      queryParams.push(tipo_documento);
    }

    if (genero) {
      whereConditions.push('p.genero = ?');
      queryParams.push(genero);
    }

    const whereClause = whereConditions.join(' AND ');

    // Contar total
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM pacientes p WHERE ${whereClause}`,
      queryParams
    );
    const total = (countRows as any[])[0].total;

    // Obtener pacientes
    const [rows] = await pool.execute(
      `SELECT p.*, m.nombre as municipio_nombre, e.nombre as eps_nombre
       FROM pacientes p
       LEFT JOIN municipios m ON p.municipio_id = m.id
       LEFT JOIN eps e ON p.eps_id = e.id
       WHERE ${whereClause}
       ORDER BY p.${sort_by} ${sort_order}
       LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(limit as string), offset]
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
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

export default router;
