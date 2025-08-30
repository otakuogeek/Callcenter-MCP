// ==============================================
// SERVICIO DE AUDITORÍA
// ==============================================

import pool from '../db/pool';
import { AuditLog } from '../types/enhanced-types';

export class AuditService {
  
  static async logAction(
    tableName: string,
    recordId: number,
    action: 'INSERT' | 'UPDATE' | 'DELETE',
    oldValues: any = null,
    newValues: any = null,
    userId?: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      const [result] = await pool.execute(
        `INSERT INTO audit_log 
         (table_name, record_id, action, old_values, new_values, user_id, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tableName,
          recordId,
          action,
          oldValues ? JSON.stringify(oldValues) : null,
          newValues ? JSON.stringify(newValues) : null,
          userId,
          ipAddress,
          userAgent
        ]
      );
    } catch (error) {
      console.error('Error logging audit action:', error);
      // No lanzar error para no interrumpir la operación principal
    }
  }

  static async getAuditLogs(
    tableName?: string,
    recordId?: number,
    userId?: number,
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditLog[]> {
    let query = `
      SELECT al.*, u.name as user_name 
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (tableName) {
      query += ` AND al.table_name = ?`;
      params.push(tableName);
    }

    if (recordId) {
      query += ` AND al.record_id = ?`;
      params.push(recordId);
    }

    if (userId) {
      query += ` AND al.user_id = ?`;
      params.push(userId);
    }

    query += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [rows] = await pool.execute(query, params);
    return rows as AuditLog[];
  }

  static async getAuditSummary(days: number = 30): Promise<any> {
    const [rows] = await pool.execute(
      `SELECT 
         table_name,
         action,
         COUNT(*) as count,
         DATE(created_at) as date
       FROM audit_log 
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY table_name, action, DATE(created_at)
       ORDER BY date DESC, count DESC`,
      [days]
    );
    return rows;
  }
}
