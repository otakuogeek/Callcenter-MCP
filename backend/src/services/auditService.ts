/**
 * Servicio de Auditoria Inmutable - BIOSANAR IPS
 */

import pool from '../db/pool';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export type AuditActionType =
  | 'CREATE' | 'UPDATE' | 'DELETE' | 'READ' | 'BULK_UPDATE' | 'BULK_DELETE'
  | 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'PASSWORD_CHANGE' | 'PASSWORD_RESET'
  | 'EXPORT' | 'IMPORT' | 'UPLOAD' | 'DOWNLOAD'
  | 'SMS_SENT' | 'EMAIL_SENT' | 'CALL_INITIATED' | 'WHATSAPP_SENT'
  | 'APPOINTMENT_SCHEDULED' | 'APPOINTMENT_CANCELLED' | 'APPOINTMENT_RESCHEDULED'
  | 'PATIENT_REGISTERED' | 'WAITING_LIST_ADDED' | 'WAITING_LIST_REMOVED'
  | 'AVAILABILITY_CREATED' | 'AVAILABILITY_DELETED' | 'AVAILABILITY_PAUSED'
  | 'CONFIG_CHANGED' | 'PERMISSION_CHANGED' | 'USER_CREATED' | 'USER_DELETED'
  | 'OTHER';

export interface AuditLogEntry {
  userId?: number | null;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  actionType: AuditActionType;
  entityType?: string | null;
  entityId?: string | number | null;
  entityName?: string | null;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  changedFields?: string[] | null;
  requestMethod?: string | null;
  requestPath?: string | null;
  requestQuery?: Record<string, any> | null;
  requestBody?: Record<string, any> | null;
  responseStatus?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  description?: string | null;
  metadata?: Record<string, any> | null;
  durationMs?: number | null;
}

const SENSITIVE_FIELDS = [
  'password', 'password_hash', 'token', 'secret', 'api_key', 'apikey',
  'authorization', 'auth', 'credential', 'jwt', 'refresh_token',
  'credit_card', 'card_number', 'cvv', 'pin', 'ssn'
];

function sanitizeObject(obj: Record<string, any> | null | undefined): Record<string, any> | null {
  if (!obj || typeof obj !== 'object') return null;
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => typeof item === 'object' ? sanitizeObject(item) : item);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function calculateChangedFields(
  oldValues: Record<string, any> | null | undefined,
  newValues: Record<string, any> | null | undefined
): string[] {
  if (!oldValues || !newValues) return [];
  const changed: string[] = [];
  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
  for (const key of allKeys) {
    if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
      changed.push(key);
    }
  }
  return changed;
}

function generateDescription(entry: AuditLogEntry): string {
  const user = entry.userName || entry.userEmail || (entry.userId ? 'Usuario #' + entry.userId : 'Sistema');
  const entity = entry.entityName || (entry.entityId ? '#' + entry.entityId : '');
  const entityType = entry.entityType || 'registro';
  
  const descriptions: Record<AuditActionType, string> = {
    'CREATE': user + ' creo ' + entityType + ' ' + entity,
    'UPDATE': user + ' actualizo ' + entityType + ' ' + entity,
    'DELETE': user + ' elimino ' + entityType + ' ' + entity,
    'READ': user + ' consulto ' + entityType + ' ' + entity,
    'BULK_UPDATE': user + ' actualizo multiples ' + entityType + 's',
    'BULK_DELETE': user + ' elimino multiples ' + entityType + 's',
    'LOGIN': user + ' inicio sesion',
    'LOGOUT': user + ' cerro sesion',
    'LOGIN_FAILED': 'Intento fallido de login para ' + (entry.userEmail || 'desconocido'),
    'PASSWORD_CHANGE': user + ' cambio su contrasena',
    'PASSWORD_RESET': 'Se restablecio la contrasena de ' + user,
    'EXPORT': user + ' exporto datos de ' + entityType,
    'IMPORT': user + ' importo datos a ' + entityType,
    'UPLOAD': user + ' subio archivo',
    'DOWNLOAD': user + ' descargo archivo',
    'SMS_SENT': user + ' envio SMS a ' + entity,
    'EMAIL_SENT': user + ' envio correo a ' + entity,
    'CALL_INITIATED': user + ' inicio llamada a ' + entity,
    'WHATSAPP_SENT': user + ' envio WhatsApp a ' + entity,
    'APPOINTMENT_SCHEDULED': user + ' agendo cita para ' + entity,
    'APPOINTMENT_CANCELLED': user + ' cancelo cita de ' + entity,
    'APPOINTMENT_RESCHEDULED': user + ' reagendo cita de ' + entity,
    'PATIENT_REGISTERED': user + ' registro paciente ' + entity,
    'WAITING_LIST_ADDED': user + ' agrego a lista de espera: ' + entity,
    'WAITING_LIST_REMOVED': user + ' removio de lista de espera: ' + entity,
    'AVAILABILITY_CREATED': user + ' creo disponibilidad ' + entity,
    'AVAILABILITY_DELETED': user + ' elimino disponibilidad ' + entity,
    'AVAILABILITY_PAUSED': user + ' pauso disponibilidad ' + entity,
    'CONFIG_CHANGED': user + ' modifico configuracion: ' + entity,
    'PERMISSION_CHANGED': user + ' cambio permisos de ' + entity,
    'USER_CREATED': user + ' creo usuario ' + entity,
    'USER_DELETED': user + ' elimino usuario ' + entity,
    'OTHER': user + ' realizo accion en ' + entityType + ' ' + entity
  };
  
  return descriptions[entry.actionType] || entry.description || 'Accion no especificada';
}

export async function logAudit(entry: AuditLogEntry): Promise<number | null> {
  try {
    const sanitizedOldValues = sanitizeObject(entry.oldValues);
    const sanitizedNewValues = sanitizeObject(entry.newValues);
    const sanitizedRequestBody = sanitizeObject(entry.requestBody);
    const changedFields = entry.changedFields || calculateChangedFields(entry.oldValues, entry.newValues);
    const description = entry.description || generateDescription(entry);
    
    const query = `
      INSERT INTO audit_logs (
        user_id, user_name, user_email, user_role,
        action_type, entity_type, entity_id, entity_name,
        old_values, new_values, changed_fields,
        request_method, request_path, request_query, request_body, response_status,
        ip_address, user_agent, session_id, description, metadata, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      entry.userId || null,
      entry.userName || null,
      entry.userEmail || null,
      entry.userRole || null,
      entry.actionType,
      entry.entityType || null,
      entry.entityId ? String(entry.entityId) : null,
      entry.entityName || null,
      sanitizedOldValues ? JSON.stringify(sanitizedOldValues) : null,
      sanitizedNewValues ? JSON.stringify(sanitizedNewValues) : null,
      changedFields.length > 0 ? JSON.stringify(changedFields) : null,
      entry.requestMethod || null,
      entry.requestPath || null,
      entry.requestQuery ? JSON.stringify(entry.requestQuery) : null,
      sanitizedRequestBody ? JSON.stringify(sanitizedRequestBody) : null,
      entry.responseStatus || null,
      entry.ipAddress || null,
      entry.userAgent || null,
      entry.sessionId || null,
      description,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
      entry.durationMs || null
    ];
    
    const [result] = await pool.execute<ResultSetHeader>(query, values);
    
    updateDailySummary(entry).catch(err => {
      console.error('Error actualizando resumen diario de auditoria:', err);
    });
    
    return result.insertId;
  } catch (error) {
    console.error('Error registrando auditoria:', error);
    return null;
  }
}

async function updateDailySummary(entry: AuditLogEntry): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const query = `
    INSERT INTO audit_daily_summary (summary_date, user_id, action_type, entity_type, action_count)
    VALUES (?, ?, ?, ?, 1)
    ON DUPLICATE KEY UPDATE action_count = action_count + 1
  `;
  await pool.execute(query, [today, entry.userId || null, entry.actionType, entry.entityType || 'other']);
}

export interface AuditQueryParams {
  userId?: number;
  actionType?: AuditActionType | AuditActionType[];
  entityType?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  ipAddress?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AuditQueryResult {
  logs: RowDataPacket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function queryAuditLogs(params: AuditQueryParams): Promise<AuditQueryResult> {
  const page = params.page || 1;
  const limit = Math.min(params.limit || 50, 500);
  const offset = (page - 1) * limit;
  
  const conditions: string[] = ['1=1'];
  const values: any[] = [];
  
  if (params.userId) {
    conditions.push('user_id = ?');
    values.push(params.userId);
  }
  if (params.actionType) {
    if (Array.isArray(params.actionType)) {
      conditions.push('action_type IN (' + params.actionType.map(() => '?').join(',') + ')');
      values.push(...params.actionType);
    } else {
      conditions.push('action_type = ?');
      values.push(params.actionType);
    }
  }
  if (params.entityType) {
    conditions.push('entity_type = ?');
    values.push(params.entityType);
  }
  if (params.entityId) {
    conditions.push('entity_id = ?');
    values.push(params.entityId);
  }
  if (params.startDate) {
    conditions.push('created_at >= ?');
    values.push(params.startDate + ' 00:00:00');
  }
  if (params.endDate) {
    conditions.push('created_at <= ?');
    values.push(params.endDate + ' 23:59:59');
  }
  if (params.ipAddress) {
    conditions.push('ip_address = ?');
    values.push(params.ipAddress);
  }
  if (params.search) {
    conditions.push('(description LIKE ? OR entity_name LIKE ? OR user_name LIKE ?)');
    const searchTerm = '%' + params.search + '%';
    values.push(searchTerm, searchTerm, searchTerm);
  }
  
  const whereClause = conditions.join(' AND ');
  
  const [countResult] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) as total FROM audit_logs WHERE ' + whereClause, values
  );
  const total = countResult[0]?.total || 0;
  
  const [logs] = await pool.query<RowDataPacket[]>(
    'SELECT id, created_at, user_id, user_name, user_email, user_role, action_type, entity_type, entity_id, entity_name, description, ip_address, request_method, request_path, response_status, duration_ms, old_values, new_values, changed_fields, metadata FROM audit_logs WHERE ' + whereClause + ' ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [...values, limit, offset]
  );
  
  return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getAuditStats(days: number = 7): Promise<any> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];
  
  const [totalResult] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as total FROM audit_logs');
  const [todayResult] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) as total FROM audit_logs WHERE DATE(created_at) = ?', [today]
  );
  const [topUsers] = await pool.query<RowDataPacket[]>(
    'SELECT user_id, user_name, COUNT(*) as count FROM audit_logs WHERE created_at >= ? AND user_id IS NOT NULL GROUP BY user_id, user_name ORDER BY count DESC LIMIT 10', [startDateStr]
  );
  const [actionsByType] = await pool.query<RowDataPacket[]>(
    'SELECT action_type, COUNT(*) as count FROM audit_logs WHERE created_at >= ? GROUP BY action_type ORDER BY count DESC', [startDateStr]
  );
  const [recentActivity] = await pool.query<RowDataPacket[]>(
    'SELECT id, created_at, user_name, action_type, entity_type, description FROM audit_logs ORDER BY created_at DESC LIMIT 20'
  );
  
  return {
    totalLogs: totalResult[0]?.total || 0,
    todayLogs: todayResult[0]?.total || 0,
    topUsers, actionsByType, recentActivity
  };
}

export async function getEntityHistory(entityType: string, entityId: string | number): Promise<RowDataPacket[]> {
  const [logs] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM audit_logs WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC',
    [entityType, String(entityId)]
  );
  return logs;
}

export async function getUserActivity(userId: number, limit: number = 100): Promise<RowDataPacket[]> {
  const [logs] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit]
  );
  return logs;
}

export async function getActiveUsers(): Promise<RowDataPacket[]> {
  const [users] = await pool.query<RowDataPacket[]>(
    'SELECT DISTINCT user_id, user_name, user_email, user_role, COUNT(*) as total_actions FROM audit_logs WHERE user_id IS NOT NULL GROUP BY user_id, user_name, user_email, user_role ORDER BY total_actions DESC'
  );
  return users;
}

export async function getEntityTypes(): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT DISTINCT entity_type FROM audit_logs WHERE entity_type IS NOT NULL ORDER BY entity_type'
  );
  return rows.map(r => r.entity_type);
}

// Clase legacy para compatibilidad
export class AuditService {
  static async logAction(
    tableName: string, recordId: number, action: string,
    oldValues: any, newValues: any, userId: number | null,
    ipAddress?: string, userAgent?: string
  ): Promise<number | null> {
    return logAudit({
      userId, actionType: action as AuditActionType,
      entityType: tableName, entityId: recordId,
      oldValues, newValues, ipAddress, userAgent
    });
  }
  
  static async getAuditLogs(
    tableName?: string, recordId?: number, userId?: number,
    limit: number = 50, offset: number = 0
  ): Promise<RowDataPacket[]> {
    const result = await queryAuditLogs({
      entityType: tableName, entityId: recordId ? String(recordId) : undefined,
      userId, limit, page: Math.floor(offset / limit) + 1
    });
    return result.logs;
  }
}

export default {
  logAudit, queryAuditLogs, getAuditStats, getEntityHistory, getUserActivity, getActiveUsers, getEntityTypes
};
