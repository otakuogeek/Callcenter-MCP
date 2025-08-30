// ==============================================
// RUTAS DE MÉTRICAS Y ESTADÍSTICAS
// ==============================================

import express from 'express';
import { MetricsService } from '../services/metricsService';
import { requireAuth, requireRole } from '../middleware/auth';

const router = express.Router();

// Obtener KPIs generales
router.get('/kpis', requireAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const kpis = await MetricsService.getKPIs(days);

    res.json({
      success: true,
      data: kpis
    });
  } catch (error) {
    console.error('Error getting KPIs:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener KPIs'
    });
  }
});

// Obtener métricas diarias
router.get('/daily', requireAuth, async (req, res) => {
  try {
    const startDate = req.query.start_date ? new Date(req.query.start_date as string) : new Date();
    const endDate = req.query.end_date ? new Date(req.query.end_date as string) : new Date();
    const locationId = req.query.location_id ? parseInt(req.query.location_id as string) : undefined;
    const specialtyId = req.query.specialty_id ? parseInt(req.query.specialty_id as string) : undefined;

    // Si no se especifica start_date, usar últimos 30 días
    if (!req.query.start_date) {
      startDate.setDate(startDate.getDate() - 30);
    }

    const metrics = await MetricsService.getDailyMetrics(
      startDate,
      endDate,
      locationId,
      specialtyId
    );

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error getting daily metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener métricas diarias'
    });
  }
});

// Obtener rendimiento por especialidad
router.get('/specialty-performance', requireAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const performance = await MetricsService.getSpecialtyPerformance(days);

    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    console.error('Error getting specialty performance:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener rendimiento por especialidad'
    });
  }
});

// Obtener rendimiento por ubicación
router.get('/location-performance', requireAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const performance = await MetricsService.getLocationPerformance(days);

    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    console.error('Error getting location performance:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener rendimiento por ubicación'
    });
  }
});

// Obtener datos de tendencias
router.get('/trends', requireAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const trends = await MetricsService.getTrendData(days);

    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('Error getting trend data:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener datos de tendencias'
    });
  }
});

// Generar métricas para una fecha específica (solo admin)
router.post('/generate', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Fecha es requerida'
      });
    }

    await MetricsService.generateDailyMetrics(new Date(date));

    res.json({
      success: true,
      message: 'Métricas generadas exitosamente'
    });
  } catch (error) {
    console.error('Error generating metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar métricas'
    });
  }
});

// Obtener métricas de salud del sistema (solo admin)
router.get('/system-health', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const health = await MetricsService.generateSystemHealthMetrics();

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('Error getting system health:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener salud del sistema'
    });
  }
});

export default router;
