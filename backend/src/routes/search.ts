import { Router } from 'express';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Búsqueda global inteligente
router.get('/global', requireAuth, async (req, res) => {
  try {
    const { q, type = 'all', limit = 10 } = req.query;
    
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json({ success: true, data: { patients: [], doctors: [], appointments: [] } });
    }

    const searchTerm = `%${q}%`;
    const results: any = {};

    // Búsqueda de pacientes
    if (type === 'all' || type === 'patients') {
      const [patients] = await pool.execute(`
        SELECT 
          p.id,
          p.document,
          p.name,
          p.phone,
          p.email,
          p.birth_date,
          p.gender,
          p.status,
          eps.name as eps_name,
          m.name as municipality_name
        FROM patients p
        LEFT JOIN eps ON p.insurance_eps_id = eps.id
        LEFT JOIN municipalities m ON p.municipality_id = m.id
        WHERE (
          p.name LIKE ? OR 
          p.document LIKE ? OR 
          p.phone LIKE ? OR 
          p.email LIKE ?
        )
        AND p.status = 'Activo'
        ORDER BY p.created_at DESC
        LIMIT ?
      `, [searchTerm, searchTerm, searchTerm, searchTerm, parseInt(limit as string)]);
      results.patients = patients;
    }

    // Búsqueda de doctores
    if (type === 'all' || type === 'doctors') {
      const [doctors] = await pool.execute(`
        SELECT 
          d.id,
          d.name,
          d.license_number,
          d.phone,
          d.email,
          d.active,
          GROUP_CONCAT(s.name) as specialties
        FROM doctors d
        LEFT JOIN doctor_specialties ds ON d.id = ds.doctor_id
        LEFT JOIN specialties s ON ds.specialty_id = s.id
        WHERE (
          d.name LIKE ? OR 
          d.license_number LIKE ? OR 
          d.phone LIKE ? OR 
          d.email LIKE ?
        )
        AND d.active = 1
        GROUP BY d.id
        ORDER BY d.created_at DESC
        LIMIT ?
      `, [searchTerm, searchTerm, searchTerm, searchTerm, parseInt(limit as string)]);
      results.doctors = doctors;
    }

    // Búsqueda de citas
    if (type === 'all' || type === 'appointments') {
      const [appointments] = await pool.execute(`
        SELECT 
          a.id,
          a.scheduled_at,
          a.status,
          a.notes,
          p.name as patient_name,
          p.document as patient_document,
          d.name as doctor_name,
          s.name as specialty_name,
          l.name as location_name
        FROM appointments a
        INNER JOIN patients p ON a.patient_id = p.id
        INNER JOIN doctors d ON a.doctor_id = d.id
        INNER JOIN specialties s ON a.specialty_id = s.id
        INNER JOIN locations l ON a.location_id = l.id
        WHERE (
          p.name LIKE ? OR 
          p.document LIKE ? OR 
          d.name LIKE ? OR 
          a.notes LIKE ?
        )
        ORDER BY a.scheduled_at DESC
        LIMIT ?
      `, [searchTerm, searchTerm, searchTerm, searchTerm, parseInt(limit as string)]);
      results.appointments = appointments;
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error in global search:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Autocompletado inteligente
router.get('/autocomplete', requireAuth, async (req, res) => {
  try {
    const { q, type = 'patients', limit = 5 } = req.query;
    
    if (!q || typeof q !== 'string' || q.length < 1) {
      return res.json({ success: true, data: [] });
    }

    const searchTerm = `${q}%`;
    let results: any[] = [];

    switch (type) {
      case 'patients':
        const [patients] = await pool.execute(`
          SELECT 
            id,
            name as label,
            document,
            phone,
            'patient' as type
          FROM patients 
          WHERE (name LIKE ? OR document LIKE ?) 
          AND status = 'Activo'
          ORDER BY name ASC
          LIMIT ?
        `, [searchTerm, searchTerm, parseInt(limit as string)]);
        results = patients as any[];
        break;

      case 'doctors':
        const [doctors] = await pool.execute(`
          SELECT 
            id,
            name as label,
            license_number,
            'doctor' as type
          FROM doctors 
          WHERE name LIKE ? 
          AND status = 'Activo'
          ORDER BY name ASC
          LIMIT ?
        `, [searchTerm, parseInt(limit as string)]);
        results = doctors as any[];
        break;

      case 'specialties':
        const [specialties] = await pool.execute(`
          SELECT 
            id,
            name as label,
            'specialty' as type
          FROM specialties 
          WHERE name LIKE ?
          ORDER BY name ASC
          LIMIT ?
        `, [searchTerm, parseInt(limit as string)]);
        results = specialties as any[];
        break;
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error in autocomplete:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

export default router;