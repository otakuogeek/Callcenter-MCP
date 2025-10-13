/**
 * Routes: EPS Specialty Location Authorizations
 * Endpoints para gestionar autorizaciones de EPS por especialidad y sede
 */

import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { RowDataPacket, ResultSetHeader, FieldPacket } from 'mysql2';

const router = Router();

// ============================================================================
// INTERFACES
// ============================================================================

interface EPSAuthorization {
  id?: number;
  eps_id: number;
  specialty_id: number;
  location_id: number;
  authorized: boolean;
  authorization_date?: string;
  expiration_date?: string;
  max_monthly_appointments?: number;
  copay_percentage?: number;
  requires_prior_authorization?: boolean;
  notes?: string;
  created_by?: number;
}

interface AuthorizationView extends RowDataPacket {
  id: number;
  eps_id: number;
  eps_name: string;
  eps_code: string;
  affiliation_type: string;
  specialty_id: number;
  specialty_name: string;
  location_id: number;
  location_name: string;
  municipality_id: number;
  authorized: boolean;
  authorization_date: string;
  expiration_date: string;
  max_monthly_appointments: number;
  copay_percentage: number;
  requires_prior_authorization: boolean;
  notes: string;
  is_currently_valid: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// GET: Listar todas las autorizaciones (con filtros opcionales)
// ============================================================================
/**
 * GET /api/eps-authorizations
 * Query params: eps_id, specialty_id, location_id, authorized, active_only
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { eps_id, specialty_id, location_id, authorized, active_only } = req.query;

    let query = 'SELECT * FROM v_eps_authorizations WHERE 1=1';
    const params: any[] = [];

    if (eps_id) {
      query += ' AND eps_id = ?';
      params.push(eps_id);
    }

    if (specialty_id) {
      query += ' AND specialty_id = ?';
      params.push(specialty_id);
    }

    if (location_id) {
      query += ' AND location_id = ?';
      params.push(location_id);
    }

    if (authorized !== undefined) {
      query += ' AND authorized = ?';
      params.push(authorized === 'true' || authorized === '1' ? 1 : 0);
    }

    // Filtrar solo autorizaciones actualmente válidas
    if (active_only === 'true' || active_only === '1') {
      query += ' AND is_currently_valid = 1';
    }

    query += ' ORDER BY eps_name, specialty_name, location_name';

    const [rows] = await pool.query<AuthorizationView[]>(query, params);

    res.json({
      success: true,
      data: rows,
      count: rows.length
    });

  } catch (error: any) {
    console.error('Error fetching EPS authorizations:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener autorizaciones',
      details: error.message
    });
  }
});

// ============================================================================
// GET: Obtener autorización específica por ID
// ============================================================================
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query<AuthorizationView[]>(
      'SELECT * FROM v_eps_authorizations WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Autorización no encontrada'
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (error: any) {
    console.error('Error fetching authorization:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener la autorización',
      details: error.message
    });
  }
});

// ============================================================================
// GET: Verificar si una EPS está autorizada para una especialidad en una sede
// ============================================================================
router.get('/check/:eps_id/:specialty_id/:location_id', async (req: Request, res: Response) => {
  try {
    const { eps_id, specialty_id, location_id } = req.params;

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT is_eps_authorized(?, ?, ?) as authorized',
      [eps_id, specialty_id, location_id]
    );

    const isAuthorized = rows[0]?.authorized === 1;

    res.json({
      success: true,
      authorized: isAuthorized,
      eps_id: parseInt(eps_id),
      specialty_id: parseInt(specialty_id),
      location_id: parseInt(location_id)
    });

  } catch (error: any) {
    console.error('Error checking authorization:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar autorización',
      details: error.message
    });
  }
});

// ============================================================================
// GET: Especialidades autorizadas para una EPS en una sede
// ============================================================================
router.get('/eps/:eps_id/location/:location_id/specialties', async (req: Request, res: Response) => {
  try {
    const { eps_id, location_id } = req.params;

    const [rows] = await pool.query<RowDataPacket[]>(
      'CALL get_authorized_specialties_for_eps(?, ?)',
      [eps_id, location_id]
    );

    res.json({
      success: true,
      data: rows[0] || [],
      count: Array.isArray(rows[0]) ? rows[0].length : 0
    });

  } catch (error: any) {
    console.error('Error fetching authorized specialties:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener especialidades autorizadas',
      details: error.message
    });
  }
});

// ============================================================================
// GET: Sedes autorizadas para una EPS y especialidad
// ============================================================================
router.get('/eps/:eps_id/specialty/:specialty_id/locations', async (req: Request, res: Response) => {
  try {
    const { eps_id, specialty_id } = req.params;

    const [rows] = await pool.query<RowDataPacket[]>(
      'CALL get_authorized_locations_for_eps_specialty(?, ?)',
      [eps_id, specialty_id]
    );

    res.json({
      success: true,
      data: rows[0] || [],
      count: Array.isArray(rows[0]) ? rows[0].length : 0
    });

  } catch (error: any) {
    console.error('Error fetching authorized locations:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener sedes autorizadas',
      details: error.message
    });
  }
});

// ============================================================================
// POST: Crear nueva autorización
// ============================================================================
router.post('/', async (req: Request, res: Response) => {
  try {
    const authData: EPSAuthorization = req.body;

    // Validaciones básicas
    if (!authData.eps_id || !authData.specialty_id || !authData.location_id) {
      return res.status(400).json({
        success: false,
        error: 'Faltan campos requeridos: eps_id, specialty_id, location_id'
      });
    }

    // Verificar si ya existe
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM eps_specialty_location_authorizations 
       WHERE eps_id = ? AND specialty_id = ? AND location_id = ?`,
      [authData.eps_id, authData.specialty_id, authData.location_id]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Ya existe una autorización para esta combinación EPS-Especialidad-Sede'
      });
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO eps_specialty_location_authorizations 
       (eps_id, specialty_id, location_id, authorized, authorization_date, 
        expiration_date, max_monthly_appointments, copay_percentage, 
        requires_prior_authorization, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        authData.eps_id,
        authData.specialty_id,
        authData.location_id,
        authData.authorized !== false ? 1 : 0,
        authData.authorization_date || null,
        authData.expiration_date || null,
        authData.max_monthly_appointments || null,
        authData.copay_percentage || null,
        authData.requires_prior_authorization ? 1 : 0,
        authData.notes || null,
        authData.created_by || null
      ]
    );

    // Obtener la autorización creada con todos sus detalles
    const [created] = await pool.query<AuthorizationView[]>(
      'SELECT * FROM v_eps_authorizations WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Autorización creada exitosamente',
      data: created[0]
    });

  } catch (error: any) {
    console.error('Error creating authorization:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear autorización',
      details: error.message
    });
  }
});

// ============================================================================
// POST: Crear múltiples autorizaciones en batch
// ============================================================================
router.post('/batch', async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const { authorizations } = req.body;

    if (!Array.isArray(authorizations) || authorizations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de autorizaciones'
      });
    }

    await connection.beginTransaction();

    const results = [];
    const errors = [];

    for (const auth of authorizations) {
      try {
        const [result] = await connection.query<ResultSetHeader>(
          `INSERT INTO eps_specialty_location_authorizations 
           (eps_id, specialty_id, location_id, authorized, authorization_date, 
            expiration_date, max_monthly_appointments, copay_percentage, 
            requires_prior_authorization, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           authorized = VALUES(authorized),
           authorization_date = VALUES(authorization_date),
           expiration_date = VALUES(expiration_date),
           notes = VALUES(notes)`,
          [
            auth.eps_id,
            auth.specialty_id,
            auth.location_id,
            auth.authorized !== false ? 1 : 0,
            auth.authorization_date || null,
            auth.expiration_date || null,
            auth.max_monthly_appointments || null,
            auth.copay_percentage || null,
            auth.requires_prior_authorization ? 1 : 0,
            auth.notes || null,
            auth.created_by || null
          ]
        );

        results.push({
          eps_id: auth.eps_id,
          specialty_id: auth.specialty_id,
          location_id: auth.location_id,
          status: 'success',
          id: result.insertId
        });

      } catch (error: any) {
        errors.push({
          eps_id: auth.eps_id,
          specialty_id: auth.specialty_id,
          location_id: auth.location_id,
          status: 'error',
          message: error.message
        });
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Proceso de batch completado',
      created: results.length,
      errorsCount: errors.length,
      results,
      errorDetails: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    await connection.rollback();
    console.error('Error in batch creation:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear autorizaciones en batch',
      details: error.message
    });
  } finally {
    connection.release();
  }
});

// ============================================================================
// PUT: Actualizar autorización existente
// ============================================================================
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const authData: Partial<EPSAuthorization> = req.body;

    // Verificar que existe
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM eps_specialty_location_authorizations WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Autorización no encontrada'
      });
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (authData.authorized !== undefined) {
      updateFields.push('authorized = ?');
      updateValues.push(authData.authorized ? 1 : 0);
    }
    if (authData.authorization_date !== undefined) {
      updateFields.push('authorization_date = ?');
      updateValues.push(authData.authorization_date);
    }
    if (authData.expiration_date !== undefined) {
      updateFields.push('expiration_date = ?');
      updateValues.push(authData.expiration_date);
    }
    if (authData.max_monthly_appointments !== undefined) {
      updateFields.push('max_monthly_appointments = ?');
      updateValues.push(authData.max_monthly_appointments);
    }
    if (authData.copay_percentage !== undefined) {
      updateFields.push('copay_percentage = ?');
      updateValues.push(authData.copay_percentage);
    }
    if (authData.requires_prior_authorization !== undefined) {
      updateFields.push('requires_prior_authorization = ?');
      updateValues.push(authData.requires_prior_authorization ? 1 : 0);
    }
    if (authData.notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(authData.notes);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No hay campos para actualizar'
      });
    }

    updateValues.push(id);

    await pool.query(
      `UPDATE eps_specialty_location_authorizations 
       SET ${updateFields.join(', ')} 
       WHERE id = ?`,
      updateValues
    );

    // Obtener la autorización actualizada
    const [updated] = await pool.query<AuthorizationView[]>(
      'SELECT * FROM v_eps_authorizations WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Autorización actualizada exitosamente',
      data: updated[0]
    });

  } catch (error: any) {
    console.error('Error updating authorization:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar autorización',
      details: error.message
    });
  }
});

// ============================================================================
// DELETE: Eliminar autorización
// ============================================================================
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM eps_specialty_location_authorizations WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Autorización no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Autorización eliminada exitosamente'
    });

  } catch (error: any) {
    console.error('Error deleting authorization:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar autorización',
      details: error.message
    });
  }
});

// ============================================================================
// GET: Historial de cambios (auditoría)
// ============================================================================
router.get('/audit/:authorization_id', async (req: Request, res: Response) => {
  try {
    const { authorization_id } = req.params;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM eps_authorization_audit 
       WHERE authorization_id = ? 
       ORDER BY changed_at DESC`,
      [authorization_id]
    );

    res.json({
      success: true,
      data: rows,
      count: rows.length
    });

  } catch (error: any) {
    console.error('Error fetching audit trail:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener historial de auditoría',
      details: error.message
    });
  }
});

export default router;
