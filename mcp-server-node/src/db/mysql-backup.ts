import mysql from 'mysql2/promise';
import { logger } from '../logger';

// Database configuration using provided credentials
const dbConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'biosanar_user', 
  password: '/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU',
  database: 'biosanar',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 10000,
  timeout: 10000,
  reconnect: true,
  charset: 'utf8mb4'
};

export const db = mysql.createPool(dbConfig);

// Exportar pool para compatibilidad con queries.ts
export const pool = db;

// Test database connection
export async function testDbConnection(): Promise<boolean> {
  try {
    const connection = await db.getConnection();
    const [rows] = await connection.execute('SELECT 1 as test, NOW() as timestamp');
    connection.release();
    logger.info('✅ MySQL connection successful:', rows);
    return true;
  } catch (error) {
    logger.error('❌ MySQL connection failed:', error);
    return false;
  }
}

// Utility function to execute queries safely
export async function executeQuery<T = any>(query: string, params: any[] = []): Promise<T[]> {
  try {
    const [rows] = await db.execute(query, params);
    return rows as T[];
  } catch (error) {
    logger.error('Query execution failed:', { query, params, error });
    throw error;
  }
}

// Get database stats
export async function getDbStats() {
  try {
    const [patients] = await db.execute('SELECT COUNT(*) as total FROM patients WHERE deleted_at IS NULL');
    const [appointments] = await db.execute('SELECT COUNT(*) as total FROM appointments WHERE DATE(appointment_date) = CURDATE()');
    const [doctors] = await db.execute('SELECT COUNT(*) as total FROM users WHERE role = "doctor"');
    
    return {
      totalPatients: (patients as any)[0].total,
      todayAppointments: (appointments as any)[0].total,
      totalDoctors: (doctors as any)[0].total,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to get database stats:', error);
    throw error;
  }
}
