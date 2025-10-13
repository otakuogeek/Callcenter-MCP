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

export default router;
