// ==============================================
// SERVICIO DE SESIONES DE USUARIO
// ==============================================

import pool from '../db/pool';
import { UserSession } from '../types/enhanced-types';
import crypto from 'crypto';

export class SessionService {
  
  static generateSessionId(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  static async createSession(
    userId: number, 
    ipAddress: string, 
    userAgent?: string,
    expiresInHours: number = 24
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    await pool.execute(
      `INSERT INTO user_sessions (id, user_id, ip_address, user_agent, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [sessionId, userId, ipAddress, userAgent, expiresAt]
    );

    return sessionId;
  }

  static async getSession(sessionId: string): Promise<UserSession | null> {
    const [rows] = await pool.execute(
      `SELECT * FROM user_sessions WHERE id = ? AND expires_at > NOW()`,
      [sessionId]
    );

    const sessions = rows as UserSession[];
    return sessions.length > 0 ? sessions[0] : null;
  }

  static async updateSessionActivity(sessionId: string): Promise<boolean> {
    try {
      const [result] = await pool.execute(
        `UPDATE user_sessions SET last_activity = NOW() WHERE id = ?`,
        [sessionId]
      );
      return (result as any).affectedRows > 0;
    } catch (error) {
      console.error('Error updating session activity:', error);
      return false;
    }
  }

  static async destroySession(sessionId: string): Promise<boolean> {
    try {
      const [result] = await pool.execute(
        `DELETE FROM user_sessions WHERE id = ?`,
        [sessionId]
      );
      return (result as any).affectedRows > 0;
    } catch (error) {
      console.error('Error destroying session:', error);
      return false;
    }
  }

  static async destroyUserSessions(userId: number): Promise<boolean> {
    try {
      await pool.execute(
        `DELETE FROM user_sessions WHERE user_id = ?`,
        [userId]
      );
      return true;
    } catch (error) {
      console.error('Error destroying user sessions:', error);
      return false;
    }
  }

  static async getUserSessions(userId: number): Promise<UserSession[]> {
    const [rows] = await pool.execute(
      `SELECT * FROM user_sessions 
       WHERE user_id = ? AND expires_at > NOW()
       ORDER BY last_activity DESC`,
      [userId]
    );
    return rows as UserSession[];
  }

  static async getActiveSessions(): Promise<UserSession[]> {
    const [rows] = await pool.execute(
      `SELECT us.*, u.nombre as user_name, u.email as user_email
       FROM user_sessions us
       JOIN usuarios u ON us.user_id = u.id
       WHERE us.expires_at > NOW()
       ORDER BY us.last_activity DESC`
    );
    return rows as UserSession[];
  }

  static async endSession(sessionId: string, userId: number, isAdmin: boolean = false): Promise<boolean> {
    try {
      let query = `DELETE FROM user_sessions WHERE id = ?`;
      let params: (string | number)[] = [sessionId];

      if (!isAdmin) {
        query += ` AND user_id = ?`;
        params.push(userId);
      }

      const [result] = await pool.execute(query, params);
      return (result as any).affectedRows > 0;
    } catch (error) {
      console.error('Error ending session:', error);
      return false;
    }
  }

  static async endAllUserSessions(userId: number, excludeSessionId?: string): Promise<boolean> {
    try {
      let query = `DELETE FROM user_sessions WHERE user_id = ?`;
      let params: (string | number)[] = [userId];

      if (excludeSessionId) {
        query += ` AND id != ?`;
        params.push(excludeSessionId);
      }

      await pool.execute(query, params);
      return true;
    } catch (error) {
      console.error('Error ending all user sessions:', error);
      return false;
    }
  }

  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const [result] = await pool.execute(
        `DELETE FROM user_sessions WHERE expires_at <= NOW()`
      );
      return (result as any).affectedRows;
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  static async getSessionStats(): Promise<any> {
    const [rows] = await pool.execute(
      `SELECT 
         COUNT(*) as total_active_sessions,
         COUNT(DISTINCT user_id) as unique_users,
         AVG(TIMESTAMPDIFF(MINUTE, created_at, last_activity)) as avg_session_duration_minutes
       FROM user_sessions 
       WHERE expires_at > NOW()`
    );
    return (rows as any[])[0];
  }
}
