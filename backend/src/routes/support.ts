import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configuración de Multer para subir archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Usar ruta absoluta desde la raíz del proyecto
    const uploadDir = path.resolve(process.cwd(), 'uploads/support');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'support-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB máximo
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (JPEG, PNG, GIF) y documentos (PDF, DOC, DOCX)'));
    }
  }
});

// Generar número de ticket único
const generateTicketNumber = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `TKT-${timestamp}-${random}`;
};

const MAX_SUPPORT_LIMIT = 100;
const DEFAULT_SUPPORT_LIMIT = 20;
const MAX_TITLE_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 2000;
const SUPPORT_STATUSES = new Set(['Abierto', 'En Progreso', 'Resuelto', 'Cerrado', 'Reabierto']);

const toPositiveInt = (value: unknown, fallback: number) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// GET /api/support/tickets - Listar tickets
router.get('/tickets', requireAuth, async (req: Request, res: Response) => {
  try {
    const { status, priority, category, user_id, assigned_to, page = '1', limit = '20' } = req.query;
    const user = (req as any).user;

    const parsedUserId = user_id !== undefined ? Number(user_id) : undefined;
    if (user_id !== undefined && (!Number.isFinite(parsedUserId) || parsedUserId <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'user_id inválido'
      });
    }

    const parsedAssignedTo = assigned_to !== undefined ? Number(assigned_to) : undefined;
    if (assigned_to !== undefined && (!Number.isFinite(parsedAssignedTo) || parsedAssignedTo <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'assigned_to inválido'
      });
    }

    let query = `
      SELECT 
        t.*,
        u.name AS user_name,
        u.email AS user_email,
        a.name AS assigned_to_name,
        v.name AS last_viewed_by_name,
        (SELECT COUNT(*) FROM support_messages WHERE ticket_id = t.id) AS message_count,
        (SELECT message FROM support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT COUNT(*) 
         FROM support_messages sm 
         LEFT JOIN users su ON sm.user_id = su.id
         WHERE sm.ticket_id = t.id 
         AND (su.role = 'admin' OR su.role = 'superadmin')
         AND sm.is_internal = 0
         AND sm.created_at > COALESCE(t.last_viewed_at, t.created_at)
        ) AS unread_count
      FROM support_tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN users v ON t.last_viewed_by = v.id
      WHERE 1=1
    `;

    const params: any[] = [];

    // Si no es admin, solo ver sus propios tickets
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      query += ` AND t.user_id = ?`;
      params.push(user.id);
    }

    if (status) {
      query += ` AND t.status = ?`;
      params.push(status);
    }

    if (priority) {
      query += ` AND t.priority = ?`;
      params.push(priority);
    }

    if (category) {
      query += ` AND t.category = ?`;
      params.push(category);
    }

    if (parsedUserId) {
      query += ` AND t.user_id = ?`;
      params.push(parsedUserId);
    }

    if (parsedAssignedTo) {
      query += ` AND t.assigned_to = ?`;
      params.push(parsedAssignedTo);
    }

    query += ` ORDER BY 
      CASE t.status 
        WHEN 'Abierto' THEN 1
        WHEN 'Reabierto' THEN 2
        WHEN 'En Progreso' THEN 3
        WHEN 'Resuelto' THEN 4
        WHEN 'Cerrado' THEN 5
      END,
      CASE t.priority
        WHEN 'Urgente' THEN 1
        WHEN 'Alta' THEN 2
        WHEN 'Normal' THEN 3
        WHEN 'Baja' THEN 4
      END,
      t.created_at DESC
    `;

    // Paginación
    const pageNum = toPositiveInt(page, 1);
    const limitNum = clamp(toPositiveInt(limit, DEFAULT_SUPPORT_LIMIT), 1, MAX_SUPPORT_LIMIT);
    const offset = (pageNum - 1) * limitNum;

    query += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);

    const [tickets] = await pool.query(query, params);

    // Contar total
    let countQuery = `
      SELECT COUNT(*) as total
      FROM support_tickets t
      WHERE 1=1
    `;
    const countParams: any[] = [];

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      countQuery += ` AND t.user_id = ?`;
      countParams.push(user.id);
    }
    if (status) {
      countQuery += ` AND t.status = ?`;
      countParams.push(status);
    }
    if (priority) {
      countQuery += ` AND t.priority = ?`;
      countParams.push(priority);
    }
    if (category) {
      countQuery += ` AND t.category = ?`;
      countParams.push(category);
    }
    if (parsedUserId) {
      countQuery += ` AND t.user_id = ?`;
      countParams.push(parsedUserId);
    }
    if (parsedAssignedTo) {
      countQuery += ` AND t.assigned_to = ?`;
      countParams.push(parsedAssignedTo);
    }

    const [countResult] = await pool.query<any[]>(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    return res.json({
      success: true,
      data: tickets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error('Error listando tickets:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al listar tickets',
      error: error.message
    });
  }
});

// GET /api/support/tickets/:id - Obtener ticket específico con mensajes
router.get('/tickets/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const user = (req as any).user;

    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID de ticket inválido'
      });
    }

    const ticketQuery = `
      SELECT 
        t.*,
        u.name AS user_name,
        u.email AS user_email,
        a.name AS assigned_to_name,
        a.email AS assigned_to_email,
        v.name AS last_viewed_by_name
      FROM support_tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      LEFT JOIN users v ON t.last_viewed_by = v.id
      WHERE t.id = ?
    `;

    const [tickets] = await pool.query<any[]>(ticketQuery, [id]);

    if (!tickets || tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket no encontrado'
      });
    }

    const ticket = tickets[0];

    // Verificar permisos
    if (user.role !== 'admin' && user.role !== 'superadmin' && ticket.user_id !== user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver este ticket'
      });
    }

    // Obtener mensajes
    const messagesQuery = `
      SELECT 
        m.*,
        u.name AS user_name,
        u.email AS user_email,
        u.role AS user_role
      FROM support_messages m
      LEFT JOIN users u ON m.user_id = u.id
      WHERE m.ticket_id = ?
      ORDER BY m.created_at ASC
    `;

    const [messages] = await pool.query(messagesQuery, [id]);

    // Actualizar last_viewed_at y last_viewed_by si:
    // 1. El usuario es el dueño del ticket (para limpiar sus notificaciones)
    // 2. O si el usuario NO es admin/superadmin viendo ticket de otro
    // Esto permite que admins vean tickets ajenos sin resetear contadores,
    // pero que dueños del ticket (aunque sean admin) sí marquen como leído
    const isOwner = ticket.user_id === user.id;
    if (isOwner) {
      await pool.query(
        'UPDATE support_tickets SET last_viewed_at = NOW(), last_viewed_by = ? WHERE id = ?',
        [user.id, id]
      );
    }

    return res.json({
      success: true,
      data: {
        ticket,
        messages
      }
    });
  } catch (error: any) {
    console.error('Error obteniendo ticket:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener ticket',
      error: error.message
    });
  }
});

// PATCH /api/support/tickets/:id/mark-read - Marcar ticket como leído
router.patch('/tickets/:id/mark-read', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const user = (req as any).user;

    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID de ticket inválido'
      });
    }

    // Verificar que el ticket existe
    const [tickets] = await pool.query<any[]>(
      'SELECT * FROM support_tickets WHERE id = ?',
      [id]
    );

    if (!tickets || tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket no encontrado'
      });
    }

    const ticket = tickets[0];

    // Actualizar last_viewed_at y last_viewed_by si el usuario es el dueño del ticket
    // Esto permite que el dueño marque como leído (limpia sus badges)
    // pero admins viendo tickets ajenos no resetean el contador del dueño
    const isOwner = ticket.user_id === user.id;
    if (isOwner) {
      await pool.query(
        'UPDATE support_tickets SET last_viewed_at = NOW(), last_viewed_by = ? WHERE id = ?',
        [user.id, id]
      );
    }

    return res.json({
      success: true,
      message: 'Ticket marcado como leído'
    });
  } catch (error: any) {
    console.error('Error marcando ticket como leído:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al marcar ticket como leído',
      error: error.message
    });
  }
});

// POST /api/support/tickets - Crear nuevo ticket
router.post('/tickets', requireAuth, async (req: Request, res: Response) => {
  try {
    const { title, description, category, priority } = req.body;
    const user = (req as any).user;

    const cleanTitle = String(title || '').trim();
    const cleanDescription = String(description || '').trim();

    if (!cleanTitle || !cleanDescription) {
      return res.status(400).json({
        success: false,
        message: 'Título y descripción son requeridos'
      });
    }

    if (cleanTitle.length > MAX_TITLE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `El título supera el máximo de ${MAX_TITLE_LENGTH} caracteres`
      });
    }

    if (cleanDescription.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `La descripción supera el máximo de ${MAX_MESSAGE_LENGTH} caracteres`
      });
    }

    const ticketNumber = generateTicketNumber();

    const insertQuery = `
      INSERT INTO support_tickets (
        ticket_number, user_id, title, description, category, priority, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'Abierto')
    `;

    const [result] = await pool.query<any>(insertQuery, [
      ticketNumber,
      user.id,
      cleanTitle,
      cleanDescription,
      category || 'Otro',
      priority || 'Normal'
    ]);

    const ticketId = result.insertId;

    // Agregar mensaje inicial
    await pool.query(
      `INSERT INTO support_messages (ticket_id, user_id, message) VALUES (?, ?, ?)`,
      [ticketId, user.id, cleanDescription]
    );

    return res.status(201).json({
      success: true,
      message: 'Ticket creado exitosamente',
      data: {
        id: ticketId,
        ticket_number: ticketNumber
      }
    });
  } catch (error: any) {
    console.error('Error creando ticket:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al crear ticket',
      error: error.message
    });
  }
});

// POST /api/support/tickets/:id/messages - Agregar mensaje
router.post('/tickets/:id/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { message, is_internal } = req.body;
    const user = (req as any).user;

    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID de ticket inválido'
      });
    }

    const cleanMessage = String(message || '').trim();

    if (!cleanMessage) {
      return res.status(400).json({
        success: false,
        message: 'El mensaje es requerido'
      });
    }

    if (cleanMessage.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `El mensaje supera el máximo de ${MAX_MESSAGE_LENGTH} caracteres`
      });
    }

    // Verificar que el ticket existe
    const [tickets] = await pool.query<any[]>(
      'SELECT * FROM support_tickets WHERE id = ?',
      [id]
    );

    if (!tickets || tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket no encontrado'
      });
    }

    const ticket = tickets[0];

    // Verificar permisos
    if (user.role !== 'admin' && user.role !== 'superadmin' && ticket.user_id !== user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para responder este ticket'
      });
    }

    // Insertar mensaje
    const internalFlag = (user.role === 'admin' || user.role === 'superadmin') && !!is_internal;

    await pool.query(
      `INSERT INTO support_messages (ticket_id, user_id, message, is_internal) VALUES (?, ?, ?, ?)`
      , [id, user.id, cleanMessage, internalFlag ? 1 : 0]
    );

    // Si el usuario (no admin) responde a un ticket Resuelto/Cerrado, reabrir automáticamente
    if (user.role !== 'admin' && user.role !== 'superadmin' && (ticket.status === 'Resuelto' || ticket.status === 'Cerrado')) {
      await pool.query(
        `UPDATE support_tickets 
         SET status = 'Reabierto', reopened_count = reopened_count + 1, resolved_at = NULL, closed_at = NULL
         WHERE id = ?`,
        [id]
      );
    }

    // Actualizar timestamp del ticket
    await pool.query(
      'UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    return res.json({
      success: true,
      message: 'Mensaje agregado exitosamente'
    });
  } catch (error: any) {
    console.error('Error agregando mensaje:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al agregar mensaje',
      error: error.message
    });
  }
});

// PATCH /api/support/tickets/:id/status - Actualizar estado del ticket
router.patch('/tickets/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { status, assigned_to } = req.body;
    const user = (req as any).user;

    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID de ticket inválido'
      });
    }

    // Solo admins pueden cambiar estado
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para cambiar el estado'
      });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (status) {
      if (!SUPPORT_STATUSES.has(status)) {
        return res.status(400).json({
          success: false,
          message: 'Estado inválido'
        });
      }
      updates.push('status = ?');
      params.push(status);

      if (status === 'Resuelto') {
        updates.push('resolved_at = CURRENT_TIMESTAMP');
      } else if (status === 'Cerrado') {
        updates.push('closed_at = CURRENT_TIMESTAMP');
      } else if (status === 'Reabierto') {
        updates.push('reopened_count = reopened_count + 1');
        updates.push('resolved_at = NULL, closed_at = NULL');
      }
    }

    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      params.push(assigned_to || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay cambios para realizar'
      });
    }

    params.push(id);

    await pool.query(
      `UPDATE support_tickets SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return res.json({
      success: true,
      message: 'Estado actualizado exitosamente'
    });
  } catch (error: any) {
    console.error('Error actualizando estado:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar estado',
      error: error.message
    });
  }
});

// POST /api/support/tickets/:id/attachments - Subir archivos adjuntos
router.post('/tickets/:id/attachments', requireAuth, upload.array('files', 5), async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id);
    const user = (req as any).user;
    const files = req.files as Express.Multer.File[];

    if (!Number.isFinite(ticketId) || ticketId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID de ticket inválido'
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se han subido archivos'
      });
    }

    // Verificar que el ticket existe y el usuario tiene acceso
    const [tickets] = await pool.query<any[]>(
      'SELECT * FROM support_tickets WHERE id = ?',
      [ticketId]
    );

    if (!tickets || tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket no encontrado'
      });
    }

    const ticket = tickets[0];

    // Verificar permisos
    if (user.role !== 'admin' && user.role !== 'superadmin' && ticket.user_id !== user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para adjuntar archivos a este ticket'
      });
    }

    // Guardar información de los archivos en la base de datos
    const attachments = [];
    for (const file of files) {
      const insertQuery = `
        INSERT INTO support_attachments (
          ticket_id, uploaded_by, file_name, file_path, file_size, mime_type
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;

      const filePath = `/uploads/support/${file.filename}`;

      const [result] = await pool.query<any>(insertQuery, [
        ticketId,
        user.id,
        file.originalname,
        filePath,
        file.size,
        file.mimetype
      ]);

      attachments.push({
        id: result.insertId,
        file_name: file.originalname,
        file_path: filePath,
        file_size: file.size,
        file_type: file.mimetype
      });
    }

    return res.json({
      success: true,
      message: `${files.length} archivo(s) subido(s) correctamente`,
      data: attachments
    });
  } catch (error: any) {
    console.error('Error subiendo archivos:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al subir archivos',
      error: error.message
    });
  }
});

// GET /api/support/tickets/:id/attachments - Obtener archivos adjuntos
router.get('/tickets/:id/attachments', requireAuth, async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id);
    const user = (req as any).user;

    if (!Number.isFinite(ticketId) || ticketId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'ID de ticket inválido'
      });
    }

    // Verificar acceso al ticket
    const [tickets] = await pool.query<any[]>(
      'SELECT * FROM support_tickets WHERE id = ?',
      [ticketId]
    );

    if (!tickets || tickets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ticket no encontrado'
      });
    }

    const ticket = tickets[0];

    if (user.role !== 'admin' && user.role !== 'superadmin' && ticket.user_id !== user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver los archivos de este ticket'
      });
    }

    // Obtener archivos adjuntos
    const [attachments] = await pool.query(`
      SELECT 
        a.*,
        a.mime_type as file_type,
        a.created_at as uploaded_at,
        u.name as uploaded_by_name
      FROM support_attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.ticket_id = ?
      ORDER BY a.created_at DESC
    `, [ticketId]);

    return res.json({
      success: true,
      data: attachments
    });
  } catch (error: any) {
    console.error('Error obteniendo archivos:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener archivos',
      error: error.message
    });
  }
});

// GET /api/support/stats - Estadísticas de soporte (solo admin)
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver estadísticas'
      });
    }

    const [stats] = await pool.query<any[]>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Abierto' THEN 1 ELSE 0 END) as abiertos,
        SUM(CASE WHEN status = 'En Progreso' THEN 1 ELSE 0 END) as en_progreso,
        SUM(CASE WHEN status = 'Resuelto' THEN 1 ELSE 0 END) as resueltos,
        SUM(CASE WHEN status = 'Cerrado' THEN 1 ELSE 0 END) as cerrados,
        SUM(CASE WHEN status = 'Reabierto' THEN 1 ELSE 0 END) as reabiertos,
        SUM(CASE WHEN priority = 'Urgente' THEN 1 ELSE 0 END) as urgentes,
        SUM(CASE WHEN priority = 'Alta' THEN 1 ELSE 0 END) as alta_prioridad
      FROM support_tickets
    `);

    return res.json({
      success: true,
      data: stats[0]
    });
  } catch (error: any) {
    console.error('Error obteniendo estadísticas:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
});

export default router;
