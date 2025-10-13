// =============================================
// RUTAS PARA TABLAS DE REFERENCIA (LOOKUPS)
// =============================================

import express from 'express';
import { requireAuth } from '../middleware/auth';
import pool from '../db/pool';

const router = express.Router();

// ===== RUTA DE PRUEBA SIN AUTENTICACIÓN =====
router.get('/test', async (req, res) => {
  try {
    const [documentTypes] = await pool.execute(
      'SELECT COUNT(*) as count FROM document_types'
    );

    res.json({
      success: true,
      message: 'Rutas de lookups funcionando correctamente',
      data: {
        document_types_count: (documentTypes as any[])[0].count,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error in test route:', error);
    res.status(500).json({
      success: false,
      message: 'Error en ruta de prueba'
    });
  }
});

// ===== TIPOS DE DOCUMENTO =====
router.get('/document-types', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, code, name FROM document_types ORDER BY name'
    );

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting document types:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tipos de documento'
    });
  }
});

// ===== GRUPOS SANGUÍNEOS =====
router.get('/blood-groups', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, code, name FROM blood_groups ORDER BY code'
    );

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting blood groups:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener grupos sanguíneos'
    });
  }
});

// ===== NIVELES DE EDUCACIÓN =====
router.get('/education-levels', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name FROM education_levels ORDER BY id'
    );

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting education levels:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener niveles de educación'
    });
  }
});

// ===== ESTADOS CIVILES =====
router.get('/marital-statuses', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name FROM marital_statuses ORDER BY id'
    );

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting marital statuses:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estados civiles'
    });
  }
});

// ===== GRUPOS POBLACIONALES =====
router.get('/population-groups', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name FROM population_groups ORDER BY id'
    );

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting population groups:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener grupos poblacionales'
    });
  }
});

// ===== TIPOS DE DISCAPACIDAD =====
router.get('/disability-types', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name FROM disability_types ORDER BY name'
    );

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting disability types:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tipos de discapacidad'
    });
  }
});

// ===== MUNICIPIOS =====
router.get('/municipalities', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, zone_id FROM municipalities ORDER BY name'
    );

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting municipalities:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener municipios'
    });
  }
});

// ===== ZONAS =====
router.get('/zones', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name FROM zones ORDER BY name'
    );

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting zones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener zonas'
    });
  }
});

// ===== EPS (ENTIDADES PROMOTORAS DE SALUD) =====
router.get('/eps', requireAuth, async (req, res) => {
  try {
    // Sin filtro de status para permitir seleccionar EPS inactivas
    // (un paciente puede tener una EPS que ahora está inactiva)
    const [rows] = await pool.execute(
      `SELECT id, code, name, affiliation_type, phone, email, website, status, has_agreement
       FROM eps 
       ORDER BY affiliation_type, name`
    );

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error getting EPS:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener EPS'
    });
  }
});

// ===== ENDPOINT COMBINADO PARA TODOS LOS LOOKUPS =====
router.get('/all', requireAuth, async (req, res) => {
  try {
    const [documentTypes] = await pool.execute(
      'SELECT id, code, name FROM document_types ORDER BY name'
    );

    const [bloodGroups] = await pool.execute(
      'SELECT id, code, name FROM blood_groups ORDER BY code'
    );

    const [educationLevels] = await pool.execute(
      'SELECT id, name FROM education_levels ORDER BY id'
    );

    const [maritalStatuses] = await pool.execute(
      'SELECT id, name FROM marital_statuses ORDER BY id'
    );

    const [populationGroups] = await pool.execute(
      'SELECT id, name FROM population_groups ORDER BY id'
    );

    const [disabilityTypes] = await pool.execute(
      'SELECT id, name FROM disability_types ORDER BY name'
    );

    // También incluir municipios y EPS existentes
    const [municipalities] = await pool.execute(
      'SELECT id, name FROM municipalities ORDER BY name'
    );

    const [eps] = await pool.execute(
      `SELECT id, code, name, affiliation_type, has_agreement, status 
       FROM eps 
       WHERE status = 'Activa'
       ORDER BY affiliation_type, name`
    );

    res.json({
      success: true,
      data: {
        document_types: documentTypes,
        blood_groups: bloodGroups,
        education_levels: educationLevels,
        marital_statuses: maritalStatuses,
        population_groups: populationGroups,
        disability_types: disabilityTypes,
        municipalities: municipalities,
        eps: eps,
        insurance_affiliation_types: [
          { id: 'Contributivo', name: 'Contributivo' },
          { id: 'Subsidiado', name: 'Subsidiado' },
          { id: 'Especial', name: 'Especial' },
          { id: 'Mixto', name: 'Mixto' },
          { id: 'Vinculado', name: 'Vinculado' },
          { id: 'Particular', name: 'Particular' },
          { id: 'Otro', name: 'Otro' }
        ],
        gender_options: [
          { id: 'Masculino', name: 'Masculino' },
          { id: 'Femenino', name: 'Femenino' },
          { id: 'Otro', name: 'Otro' }
        ],
        estratos: [
          { id: 1, name: 'Estrato 1' },
          { id: 2, name: 'Estrato 2' },
          { id: 3, name: 'Estrato 3' },
          { id: 4, name: 'Estrato 4' },
          { id: 5, name: 'Estrato 5' },
          { id: 6, name: 'Estrato 6' }
        ]
      }
    });
  } catch (error) {
    console.error('Error getting all lookups:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener datos de referencia'
    });
  }
});

export default router;
