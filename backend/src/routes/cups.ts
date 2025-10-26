import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { requireAuth, requireRole } from '../middleware/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const router = Router();

// ===== OBTENER TODOS LOS CÓDIGOS CUPS =====
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { 
      search, 
      category, 
      status = 'Activo',
      page = 1, 
      limit = 50 
    } = req.query;

    let whereConditions = ['1=1'];
    let queryParams: any[] = [];

    // Filtro por búsqueda (código o nombre)
    if (search) {
      whereConditions.push('(code LIKE ? OR name LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern);
    }

    // Filtro por categoría
    if (category && category !== 'all') {
      whereConditions.push('category = ?');
      queryParams.push(category);
    }

    // Filtro por estado
    if (status && status !== 'all') {
      whereConditions.push('status = ?');
      queryParams.push(status);
    }

    const whereClause = whereConditions.join(' AND ');
    const pageNumber = Math.max(1, parseInt(page as string));
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit as string)));
    const offset = (pageNumber - 1) * limitNumber;

    // Consulta principal
    const query = `
      SELECT 
        id,
        code,
        name,
        category,
        subcategory,
        description,
        specialty_id,
        price,
        requires_authorization,
        complexity_level,
        estimated_duration_minutes,
        requires_anesthesia,
        requires_hospitalization,
        requires_previous_studies,
        status,
        is_surgical,
        notes,
        created_at,
        updated_at
      FROM cups
      WHERE ${whereClause}
      ORDER BY code ASC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.execute<RowDataPacket[]>(
      query, 
      [...queryParams, limitNumber, offset]
    );

    // Contar total para paginación
    const countQuery = `SELECT COUNT(*) as total FROM cups WHERE ${whereClause}`;
    const [countRows] = await pool.execute<RowDataPacket[]>(countQuery, queryParams);
    const total = countRows[0].total;

    res.json({
      success: true,
      data: {
        cups: rows,
        pagination: {
          current_page: pageNumber,
          per_page: limitNumber,
          total: total,
          total_pages: Math.ceil(total / limitNumber)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching CUPS:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener códigos CUPS'
    });
  }
});

// ===== OBTENER CATEGORÍAS ÚNICAS =====
router.get('/categories', requireAuth, async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT DISTINCT category FROM cups WHERE category IS NOT NULL ORDER BY category'
    );

    res.json({
      success: true,
      data: rows.map(row => row.category)
    });

  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener categorías'
    });
  }
});

// ===== OBTENER UN CÓDIGO CUPS POR ID =====
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM cups WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Código CUPS no encontrado'
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error('Error fetching CUPS:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener código CUPS'
    });
  }
});

// ===== CREAR NUEVO CÓDIGO CUPS =====
router.post('/', requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const {
      code,
      name,
      category,
      subcategory,
      description,
      specialty_id,
      price = 0,
      requires_authorization = false,
      complexity_level = 'Media',
      estimated_duration_minutes = 30,
      requires_anesthesia = false,
      requires_hospitalization = false,
      requires_previous_studies = false,
      status = 'Activo',
      is_surgical = false,
      notes
    } = req.body;

    // Validaciones
    if (!code || !name) {
      return res.status(400).json({
        success: false,
        message: 'El código y el nombre son obligatorios'
      });
    }

    // Verificar si el código ya existe
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM cups WHERE code = ?',
      [code]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El código CUPS ya existe'
      });
    }

    const userId = (req as any).user?.id || null;
    
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO cups (
        code, name, category, subcategory, description, specialty_id,
        price, requires_authorization, complexity_level, estimated_duration_minutes,
        requires_anesthesia, requires_hospitalization, requires_previous_studies,
        status, is_surgical, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code, name, category, subcategory, description, specialty_id,
        price, requires_authorization, complexity_level, estimated_duration_minutes,
        requires_anesthesia, requires_hospitalization, requires_previous_studies,
        status, is_surgical, notes, userId
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Código CUPS creado exitosamente',
      data: { id: result.insertId }
    });

  } catch (error) {
    console.error('Error creating CUPS:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear código CUPS'
    });
  }
});

// ===== ACTUALIZAR CÓDIGO CUPS =====
router.put('/:id', requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verificar que existe
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM cups WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Código CUPS no encontrado'
      });
    }

    // Verificar código duplicado (excluyendo el actual) solo si se envía código
    if (req.body.code) {
      const [duplicate] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM cups WHERE code = ? AND id != ?',
        [req.body.code, id]
      );

      if (duplicate.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'El código CUPS ya existe'
        });
      }
    }

    // Construir UPDATE dinámico solo con campos enviados
    const allowedFields = [
      'code', 'name', 'category', 'subcategory', 'description', 'specialty_id',
      'price', 'requires_authorization', 'complexity_level', 'estimated_duration_minutes',
      'requires_anesthesia', 'requires_hospitalization', 'requires_previous_studies',
      'status', 'is_surgical', 'notes'
    ];

    const updates: string[] = [];
    const values: any[] = [];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se enviaron campos para actualizar'
      });
    }

    // Agregar campos de auditoría
    updates.push('updated_by = ?', 'updated_at = NOW()');
    const userId = (req as any).user?.id || null;
    values.push(userId, id);

    const sql = `UPDATE cups SET ${updates.join(', ')} WHERE id = ?`;
    
    console.log('DEBUG UPDATE CUPS:', { sql, values, userId, requestBody: req.body });

    await pool.execute(sql, values);

    res.json({
      success: true,
      message: 'Código CUPS actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error updating CUPS:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar código CUPS'
    });
  }
});

// ===== ELIMINAR (SOFT DELETE) CÓDIGO CUPS =====
router.delete('/:id', requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM cups WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Código CUPS no encontrado'
      });
    }

    const userId = (req as any).user?.id || null;

    // Soft delete
    await pool.execute(
      'UPDATE cups SET status = ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
      ['Inactivo', userId, id]
    );

    res.json({
      success: true,
      message: 'Código CUPS desactivado exitosamente'
    });

  } catch (error) {
    console.error('Error deleting CUPS:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar código CUPS'
    });
  }
});

// ===== ESTADÍSTICAS DE CUPS =====
router.get('/stats/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const [stats] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'Activo' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'Inactivo' THEN 1 END) as inactive,
        SUM(price) as total_price,
        AVG(price) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price
      FROM cups
    `);

    const [byCategory] = await pool.execute<RowDataPacket[]>(`
      SELECT 
        category,
        COUNT(*) as count,
        SUM(price) as total_price,
        AVG(price) as avg_price
      FROM cups
      WHERE status = 'Activo'
      GROUP BY category
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      data: {
        summary: stats[0],
        by_category: byCategory
      }
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
});

export default router;
