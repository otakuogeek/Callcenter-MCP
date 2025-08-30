// ==============================================
// SERVICIO DE MÉTRICAS Y ESTADÍSTICAS
// ==============================================

import pool from '../db/pool';
import { DailyMetrics } from '../types/enhanced-types';

export class MetricsService {
  
  static async generateDailyMetrics(date: Date): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];

    // Obtener todas las combinaciones de location_id y specialty_id
    const [combinations] = await pool.execute(`
      SELECT DISTINCT a.location_id, a.specialty_id
      FROM appointments a
      WHERE DATE(a.scheduled_at) = ?
    `, [dateStr]);

    for (const combo of combinations as any[]) {
      await this.generateMetricsForLocationSpecialty(date, combo.location_id, combo.specialty_id);
    }
  }

  static async generateMetricsForLocationSpecialty(
    date: Date, 
    locationId: number, 
    specialtyId: number
  ): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];

    // Obtener métricas de citas
    const [appointmentMetrics] = await pool.execute(`
      SELECT 
        COUNT(*) as total_appointments,
        COUNT(CASE WHEN status = 'Completada' THEN 1 END) as completed_appointments,
        COUNT(CASE WHEN status = 'Cancelada' THEN 1 END) as cancelled_appointments,
        COUNT(CASE WHEN status = 'Pendiente' AND scheduled_at < NOW() THEN 1 END) as no_show_appointments,
        AVG(wait_time_minutes) as avg_wait_time_minutes
      FROM appointments
      WHERE DATE(scheduled_at) = ? AND location_id = ? AND specialty_id = ?
    `, [dateStr, locationId, specialtyId]);

    // Obtener métricas de pacientes
    const [patientMetrics] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT patient_id) as total_patients,
        COUNT(DISTINCT CASE WHEN DATE(p.created_at) = ? THEN p.id END) as new_patients
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      WHERE DATE(a.scheduled_at) = ? AND a.location_id = ? AND a.specialty_id = ?
    `, [dateStr, dateStr, locationId, specialtyId]);

    // Obtener métricas de ingresos
    const [revenueMetrics] = await pool.execute(`
      SELECT 
        COALESCE(SUM(CASE WHEN ab.status = 'paid' THEN ab.final_price ELSE 0 END), 0) as total_revenue
      FROM appointments a
      LEFT JOIN appointment_billing ab ON a.id = ab.appointment_id
      WHERE DATE(a.scheduled_at) = ? AND a.location_id = ? AND a.specialty_id = ?
    `, [dateStr, locationId, specialtyId]);

    // Obtener promedio de satisfacción
    const [satisfactionMetrics] = await pool.execute(`
      SELECT AVG(overall_rating) as patient_satisfaction_avg
      FROM satisfaction_surveys ss
      JOIN appointments a ON ss.appointment_id = a.id
      WHERE DATE(a.scheduled_at) = ? AND a.location_id = ? AND a.specialty_id = ?
    `, [dateStr, locationId, specialtyId]);

    const metrics = {
      ...(appointmentMetrics as any[])[0],
      ...(patientMetrics as any[])[0],
      ...(revenueMetrics as any[])[0],
      ...(satisfactionMetrics as any[])[0]
    };

    // Insertar o actualizar métricas
    await pool.execute(`
      INSERT INTO daily_metrics (
        date, location_id, specialty_id, total_appointments, completed_appointments,
        cancelled_appointments, no_show_appointments, total_patients, new_patients,
        total_revenue, avg_wait_time_minutes, patient_satisfaction_avg
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        total_appointments = VALUES(total_appointments),
        completed_appointments = VALUES(completed_appointments),
        cancelled_appointments = VALUES(cancelled_appointments),
        no_show_appointments = VALUES(no_show_appointments),
        total_patients = VALUES(total_patients),
        new_patients = VALUES(new_patients),
        total_revenue = VALUES(total_revenue),
        avg_wait_time_minutes = VALUES(avg_wait_time_minutes),
        patient_satisfaction_avg = VALUES(patient_satisfaction_avg),
        updated_at = CURRENT_TIMESTAMP
    `, [
      dateStr, locationId, specialtyId, metrics.total_appointments,
      metrics.completed_appointments, metrics.cancelled_appointments,
      metrics.no_show_appointments, metrics.total_patients, metrics.new_patients,
      metrics.total_revenue, metrics.avg_wait_time_minutes, metrics.patient_satisfaction_avg
    ]);
  }

  static async getDailyMetrics(
    startDate: Date,
    endDate: Date,
    locationId?: number,
    specialtyId?: number
  ): Promise<DailyMetrics[]> {
    let query = `
      SELECT dm.*, l.name as location_name, s.name as specialty_name
      FROM daily_metrics dm
      LEFT JOIN locations l ON dm.location_id = l.id
      LEFT JOIN specialties s ON dm.specialty_id = s.id
      WHERE dm.date BETWEEN ? AND ?
    `;
    const params: any[] = [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]];

    if (locationId) {
      query += ` AND dm.location_id = ?`;
      params.push(locationId);
    }

    if (specialtyId) {
      query += ` AND dm.specialty_id = ?`;
      params.push(specialtyId);
    }

    query += ` ORDER BY dm.date DESC, l.name, s.name`;

    const [rows] = await pool.execute(query, params);
    return rows as DailyMetrics[];
  }

  static async getKPIs(days: number = 30): Promise<any> {
    const [rows] = await pool.execute(`
      SELECT 
        SUM(total_appointments) as total_appointments,
        SUM(completed_appointments) as completed_appointments,
        SUM(cancelled_appointments) as cancelled_appointments,
        SUM(no_show_appointments) as no_show_appointments,
        SUM(total_revenue) as total_revenue,
        AVG(avg_wait_time_minutes) as avg_wait_time,
        AVG(patient_satisfaction_avg) as avg_satisfaction,
        ROUND((SUM(completed_appointments) / SUM(total_appointments)) * 100, 2) as completion_rate,
        ROUND((SUM(cancelled_appointments) / SUM(total_appointments)) * 100, 2) as cancellation_rate,
        ROUND((SUM(no_show_appointments) / SUM(total_appointments)) * 100, 2) as no_show_rate
      FROM daily_metrics 
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `, [days]);

    return (rows as any[])[0];
  }

  static async getSpecialtyPerformance(days: number = 30): Promise<any[]> {
    const [rows] = await pool.execute(`
      SELECT 
        s.name as specialty_name,
        SUM(dm.total_appointments) as total_appointments,
        SUM(dm.completed_appointments) as completed_appointments,
        SUM(dm.total_revenue) as total_revenue,
        AVG(dm.avg_wait_time_minutes) as avg_wait_time,
        AVG(dm.patient_satisfaction_avg) as avg_satisfaction,
        ROUND((SUM(dm.completed_appointments) / SUM(dm.total_appointments)) * 100, 2) as completion_rate
      FROM daily_metrics dm
      JOIN specialties s ON dm.specialty_id = s.id
      WHERE dm.date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY s.id, s.name
      ORDER BY total_appointments DESC
    `, [days]);

    return rows as any[];
  }

  static async getLocationPerformance(days: number = 30): Promise<any[]> {
    const [rows] = await pool.execute(`
      SELECT 
        l.name as location_name,
        SUM(dm.total_appointments) as total_appointments,
        SUM(dm.completed_appointments) as completed_appointments,
        SUM(dm.total_revenue) as total_revenue,
        AVG(dm.avg_wait_time_minutes) as avg_wait_time,
        AVG(dm.patient_satisfaction_avg) as avg_satisfaction,
        ROUND((SUM(dm.completed_appointments) / SUM(dm.total_appointments)) * 100, 2) as completion_rate
      FROM daily_metrics dm
      JOIN locations l ON dm.location_id = l.id
      WHERE dm.date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY l.id, l.name
      ORDER BY total_appointments DESC
    `, [days]);

    return rows as any[];
  }

  static async getTrendData(days: number = 30): Promise<any[]> {
    const [rows] = await pool.execute(`
      SELECT 
        date,
        SUM(total_appointments) as daily_appointments,
        SUM(completed_appointments) as daily_completed,
        SUM(total_revenue) as daily_revenue,
        AVG(avg_wait_time_minutes) as daily_avg_wait_time
      FROM daily_metrics 
      WHERE date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY date
      ORDER BY date ASC
    `, [days]);

    return rows as any[];
  }

  static async generateSystemHealthMetrics(): Promise<any> {
    // Métricas de conexiones de base de datos
    const [connectionMetrics] = await pool.execute(`
      SHOW STATUS LIKE 'Threads_connected'
    `);

    // Métricas de consultas
    const [queryMetrics] = await pool.execute(`
      SHOW STATUS LIKE 'Queries'
    `);

    // Métricas de tablas
    const [tableMetrics] = await pool.execute(`
      SELECT 
        COUNT(*) as total_tables,
        SUM(data_length + index_length) as total_size_bytes
      FROM information_schema.tables 
      WHERE table_schema = 'biosanar'
    `);

    return {
      database: {
        connections: (connectionMetrics as any[])[0]?.Value || 0,
        queries: (queryMetrics as any[])[0]?.Value || 0,
        total_tables: (tableMetrics as any[])[0]?.total_tables || 0,
        total_size_mb: Math.round(((tableMetrics as any[])[0]?.total_size_bytes || 0) / 1024 / 1024)
      },
      timestamp: new Date()
    };
  }
}
