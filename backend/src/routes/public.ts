import express from 'express';
import pool from '../db/pool';

const router = express.Router();

// GET /api/public/municipalities
router.get('/municipalities', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, name 
       FROM municipalities 
       ORDER BY name ASC`
    );

    res.json({ 
      success: true, 
      data: rows 
    });
  } catch (e) {
    console.error('Error getting municipalities:', e);
    res.status(500).json({ success: false, message: 'Error al obtener municipios' });
  }
});

// GET /api/public/maintenance-status
router.get('/maintenance-status', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT maintenance_mode FROM system_settings WHERE id = 1');
    const maintenanceMode = (rows as any[])[0]?.maintenance_mode === 1;
    
    res.json({ 
      success: true, 
      maintenance_mode: maintenanceMode 
    });
  } catch (e) {
    console.error('Error getting maintenance status:', e);
    res.status(500).json({ success: false, message: 'Error al obtener estado de mantenimiento' });
  }
});

export default router;
