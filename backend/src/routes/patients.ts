import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

const patientSchema = z.object({
  external_id: z.string().optional().nullable(),
  document: z.string().min(3, 'Documento requerido (mínimo 3 caracteres)'),
  document_type_id: z.number().int().optional().nullable(),
  name: z.string().min(1, 'Nombre requerido'),
  phone: z.string().optional().nullable(),
  phone_alt: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  birth_date: z.string().optional().nullable(),
  gender: z.enum(['Masculino','Femenino','Otro','No especificado']).default('No especificado'),
  address: z.string().optional().nullable(),
  municipality_id: z.number().int().optional().nullable(),
  zone_id: z.number().int().optional().nullable(),
  insurance_eps_id: z.number().int().optional().nullable(),
  insurance_affiliation_type: z.enum(['Contributivo','Subsidiado','Vinculado','Particular','Otro']).optional().nullable(),
  blood_group_id: z.number().int().optional().nullable(),
  population_group_id: z.number().int().optional().nullable(),
  education_level_id: z.number().int().optional().nullable(),
  marital_status_id: z.number().int().optional().nullable(),
  has_disability: z.boolean().default(false),
  disability_type_id: z.number().int().optional().nullable(),
  estrato: z.number().int().min(1).max(6).optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(['Activo','Inactivo']).default('Activo'),
});

// Esquema ultra-simplificado para registros rápidos
const simplePatientSchema = z.object({
  document: z.string().min(3, 'Documento requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  phone: z.string().optional().nullable(),
});

// Esquema para información básica del paciente (usado por PatientBasicInfo.tsx)
const basicPatientSchema = z.object({
  document: z.string().min(3, 'Documento requerido (mínimo 3 caracteres)'),
  document_type_id: z.number().int().optional().nullable(),
  name: z.string().min(1, 'Nombre requerido'),
  birth_date: z.string().optional().nullable(),
  gender: z.enum(['Masculino','Femenino','Otro','No especificado']).default('No especificado'),
});

// Listado / búsqueda básica
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  try {
    const baseQuery = `
      SELECT 
        p.*,
        z.name as zone,
        m.name as municipality,
        eps.name as eps_name,
        el.name as education_level,
        ms.name as marital_status,
        pg.name as population_group
      FROM patients p
      LEFT JOIN zones z ON p.zone_id = z.id
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      LEFT JOIN eps eps ON p.insurance_eps_id = eps.id
      LEFT JOIN education_levels el ON p.education_level_id = el.id
      LEFT JOIN marital_statuses ms ON p.marital_status_id = ms.id
      LEFT JOIN population_groups pg ON p.population_group_id = pg.id
    `;
    
    if (q) {
      const like = `%${q}%`;
      const [rows] = await pool.query(
        baseQuery + ' WHERE p.name LIKE ? OR p.document LIKE ? OR p.phone LIKE ? ORDER BY p.id DESC LIMIT 5000',
        [like, like, like]
      );
      return res.json(rows);
    }
    
    const [rows] = await pool.query(baseQuery + ' ORDER BY p.id DESC LIMIT 5000');
    return res.json(rows);
  } catch (error) {
    console.error('Error fetching patients:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Obtener detalle por ID
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.*,
        z.name as zone,
        m.name as municipality,
        eps.name as eps_name,
        el.name as education_level,
        ms.name as marital_status,
        pg.name as population_group
      FROM patients p
      LEFT JOIN zones z ON p.zone_id = z.id
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      LEFT JOIN eps eps ON p.insurance_eps_id = eps.id
      LEFT JOIN education_levels el ON p.education_level_id = el.id
      LEFT JOIN marital_statuses ms ON p.marital_status_id = ms.id
      LEFT JOIN population_groups pg ON p.population_group_id = pg.id
      WHERE p.id = ? 
      LIMIT 1
    `, [id]);
    const row = Array.isArray(rows) ? (rows as any)[0] : null;
    if (!row) return res.status(404).json({ message: 'Not found' });
    return res.json(row);
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Crear paciente
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = patientSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const p = parsed.data;
  try {
    const [result] = await pool.query(
      `INSERT INTO patients (external_id, document, name, phone, email, birth_date, gender, address, municipality_id, zone_id, insurance_eps_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.external_id ?? null, p.document, p.name, p.phone ?? null, p.email ?? null, p.birth_date ?? null, p.gender, p.address ?? null, p.municipality_id ?? null, p.zone_id ?? null, p.insurance_eps_id ?? null, p.status]
    );
    // @ts-ignore
    return res.status(201).json({ id: result.insertId, ...p });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Documento ya existe' });
    return res.status(500).json({ message: 'Server error' });
  }
});

// Crear paciente con información básica (usado por PatientBasicInfo.tsx)
router.post('/basic', requireAuth, async (req: Request, res: Response) => {
  const parsed = basicPatientSchema.safeParse(req.body);
  
  if (!parsed.success) {
    return res.status(400).json({ 
      success: false,
      message: 'Datos inválidos', 
      errors: parsed.error.flatten() 
    });
  }
  
  const data = parsed.data;
  
  try {
    // Verificar si ya existe el documento
    const [existing] = await pool.query(
      'SELECT id FROM patients WHERE document = ? LIMIT 1',
      [data.document]
    );
    
    if ((existing as any[]).length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe un paciente con este documento'
      });
    }
    
    // Insertar paciente con información básica
    const [result] = await pool.query(
      `INSERT INTO patients (
        document, document_type_id, name, 
        birth_date, gender, status, created_at
      ) VALUES (?, ?, ?, ?, ?, 'Activo', NOW())`,
      [
        data.document,
        data.document_type_id || null,
        data.name,
        data.birth_date || null,
        data.gender
      ]
    );
    
    const insertId = (result as any).insertId;
    
    // Obtener el paciente creado con todos sus datos
    const [newPatient] = await pool.query(
      'SELECT * FROM patients WHERE id = ? LIMIT 1',
      [insertId]
    );
    
    return res.status(201).json({
      success: true,
      message: 'Paciente creado exitosamente',
      data: (newPatient as any[])[0]
    });
    
  } catch (error: any) {
    console.error('Error creating basic patient:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'El documento ya está registrado'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Error del servidor al crear el paciente'
    });
  }
});

// Reemplazo / actualización (permite parcial también por diseño actual)
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'ID de paciente inválido' });
  
  console.log('🔄 PUT /patients/:id - Datos recibidos:', {
    id,
    bodyKeys: Object.keys(req.body),
    body: req.body
  });
  
  const parsed = patientSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    console.error('❌ Validation error en PUT /patients/:id:', parsed.error.flatten());
    return res.status(400).json({ 
      message: 'Datos inválidos en la actualización', 
      errors: parsed.error.flatten().fieldErrors 
    });
  }
  
  const p = parsed.data;
  console.log('✅ Datos validados:', Object.keys(p));
  
  try {
    const fields: string[] = [];
    const values: any[] = [];
    
    for (const key of Object.keys(p) as (keyof typeof p)[]) {
      // @ts-ignore
      fields.push(`${key} = ?`);
      // @ts-ignore
      values.push(p[key] ?? null);
    }
    
    if (!fields.length) {
      return res.status(400).json({ message: 'No se enviaron cambios para actualizar' });
    }
    
    values.push(id);
    
    const sqlQuery = `UPDATE patients SET ${fields.join(', ')} WHERE id = ?`;
    console.log('📝 SQL Query:', sqlQuery);
    console.log('📝 Values:', values);
    
    const [result] = await pool.query(sqlQuery, values);
    
    // @ts-ignore
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: `No se encontró paciente con ID ${id}` });
    }
    
    console.log('✅ Paciente actualizado, affectedRows:', (result as any).affectedRows);
    
    // Obtener datos actualizados completos
    const [rows] = await pool.query('SELECT * FROM patients WHERE id = ? LIMIT 1', [id]);
    const updatedPatient = Array.isArray(rows) ? (rows as any)[0] : null;
    
    console.log('📤 Devolviendo datos actualizados');
    return res.json(updatedPatient);
  } catch (e: any) {
    console.error('❌ Error al actualizar paciente:', e);
    return res.status(500).json({ 
      message: 'Error del servidor al actualizar paciente', 
      error: e.message || 'Error desconocido' 
    });
  }
});

// PATCH semántico (alias de PUT parcial) para clientes que esperan PATCH
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const parsed = patientSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const p = parsed.data;
  try {
    const fields: string[] = [];
    const values: any[] = [];
    for (const key of Object.keys(p) as (keyof typeof p)[]) {
      // @ts-ignore
      fields.push(`${key} = ?`);
      // @ts-ignore
      values.push(p[key] ?? null);
    }
    if (!fields.length) return res.status(400).json({ message: 'No changes' });
    values.push(id);
    await pool.query(`UPDATE patients SET ${fields.join(', ')} WHERE id = ?`, values);
    return res.json({ id, ...p });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Actualizar solo EPS
const epsSchema = z.object({ insurance_eps_id: z.number().int().nullable() });
router.post('/:id/eps', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const parsed = epsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  try {
    await pool.query('UPDATE patients SET insurance_eps_id = ? WHERE id = ?', [parsed.data.insurance_eps_id ?? null, id]);
    return res.json({ id, insurance_eps_id: parsed.data.insurance_eps_id ?? null });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Actualizar estado Activo/Inactivo
const statusSchema = z.object({ status: z.enum(['Activo','Inactivo']) });
router.post('/:id/status', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  try {
    await pool.query('UPDATE patients SET status = ? WHERE id = ?', [parsed.data.status, id]);
    return res.json({ id, status: parsed.data.status });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Soft delete (status=Inactivo) o hard delete ?hard=1
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const hard = req.query.hard === '1' || req.query.hard === 'true';
  try {
    if (hard) {
      await pool.query('DELETE FROM patients WHERE id = ?', [id]);
      return res.status(204).send();
    } else {
      await pool.query("UPDATE patients SET status='Inactivo' WHERE id = ?", [id]);
      return res.json({ id, status: 'Inactivo' });
    }
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// DELETE CASCADE - Eliminar paciente y toda su información relacionada
router.delete('/:id/delete-cascade', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ 
      success: false, 
      message: 'ID de paciente inválido' 
    });
  }

  const connection = await pool.getConnection();
  
  try {
    // Iniciar transacción para garantizar consistencia
    await connection.beginTransaction();

    // 1. Eliminar citas del paciente
    const [appointmentsResult] = await connection.query(
      'DELETE FROM appointments WHERE patient_id = ?',
      [id]
    ) as any;
    
    const appointmentsDeleted = appointmentsResult.affectedRows || 0;

    // 2. Eliminar documentos del paciente (si existe la tabla)
    let documentsDeleted = 0;
    try {
      const [docsResult] = await connection.query(
        'DELETE FROM patient_documents WHERE patient_id = ?',
        [id]
      ) as any;
      documentsDeleted = docsResult.affectedRows || 0;
    } catch (err) {
      // Tabla puede no existir, continuar
      console.log('patient_documents table may not exist:', err);
    }

    // 3. Eliminar de lista de espera (si existe)
    let waitingListDeleted = 0;
    try {
      const [waitingResult] = await connection.query(
        'DELETE FROM appointments_waiting_list WHERE patient_id = ?',
        [id]
      ) as any;
      waitingListDeleted = waitingResult.affectedRows || 0;
    } catch (err) {
      console.log('appointments_waiting_list table may not exist:', err);
    }

    // 4. Eliminar historial médico (si existe)
    let medicalHistoryDeleted = 0;
    try {
      const [historyResult] = await connection.query(
        'DELETE FROM medical_history WHERE patient_id = ?',
        [id]
      ) as any;
      medicalHistoryDeleted = historyResult.affectedRows || 0;
    } catch (err) {
      console.log('medical_history table may not exist:', err);
    }

    // 5. Finalmente, eliminar el paciente
    const [patientResult] = await connection.query(
      'DELETE FROM patients WHERE id = ?',
      [id]
    ) as any;

    if (patientResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Paciente no encontrado' 
      });
    }

    // Confirmar transacción
    await connection.commit();

    return res.json({
      success: true,
      message: 'Paciente eliminado exitosamente',
      details: {
        patient_deleted: true,
        appointments_deleted: appointmentsDeleted,
        documents_deleted: documentsDeleted,
        waiting_list_deleted: waitingListDeleted,
        medical_history_deleted: medicalHistoryDeleted
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error deleting patient cascade:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error al eliminar el paciente',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    connection.release();
  }
});

// Bulk import
const bulkSchema = z.array(patientSchema);
router.post('/bulk/import', requireAuth, async (req: Request, res: Response) => {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const items = parsed.data;
  if (!items.length) return res.status(400).json({ message: 'Empty list' });
  let created = 0, duplicated = 0, errors = 0;
  for (const p of items) {
    try {
      await pool.query(
        `INSERT INTO patients (external_id, document, name, phone, email, birth_date, gender, address, municipality_id, zone_id, insurance_eps_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ,[p.external_id ?? null, p.document, p.name, p.phone ?? null, p.email ?? null, p.birth_date ?? null, p.gender, p.address ?? null, p.municipality_id ?? null, p.zone_id ?? null, p.insurance_eps_id ?? null, p.status]
      );
      created++; // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      if (e?.code === 'ER_DUP_ENTRY') duplicated++; else errors++;
    }
  }
  return res.json({ created, duplicated, errors, total: items.length });
});

// Export CSV (máx 1000 registros)
router.get('/export/csv', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT id, document, name, phone, email, birth_date, gender, address, municipality_id, zone_id, insurance_eps_id, status FROM patients ORDER BY id DESC LIMIT 1000');
    const list = Array.isArray(rows) ? rows as any[] : [];
    const header = ['id','document','name','phone','email','birth_date','gender','address','municipality_id','zone_id','insurance_eps_id','status'];
    const csv = [header.join(',')].concat(list.map(r => header.map(h => {
      const v = r[h];
      if (v == null) return '';
      const s = String(v).replace(/"/g,'""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    }).join(','))).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="patients.csv"');
    return res.send(csv);
  } catch (error) {
    return res.status(500).json({ message: 'Error exporting CSV' });
  }
});

// Ruta ultra-simple para registro rápido de pacientes (solo campos esenciales)
router.post('/simple', requireAuth, async (req: Request, res: Response) => {
  const parsed = simplePatientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ 
      success: false,
      message: 'Datos inválidos', 
      errors: parsed.error.flatten() 
    });
  }
  
  const { document, name, phone } = parsed.data;
  
  try {
    // Insertar con solo los 3 campos esenciales
    const [result] = await pool.query(
      `INSERT INTO patients (document, name, phone, gender, status, has_disability, notes)
       VALUES (?, ?, ?, 'No especificado', 'Activo', 0, 'Registro ultra-simple')`,
      [document, name, phone || null]
    );
    
    // @ts-ignore
    const insertId = result.insertId;
    
    // Obtener el paciente creado
    const [patients] = await pool.query(
      'SELECT id, document, name, phone, gender, status FROM patients WHERE id = ?',
      [insertId]
    );
    
    return res.status(201).json({ 
      success: true,
      message: 'Paciente registrado exitosamente con datos mínimos',
      data: (patients as any[])[0]
    });
    
  } catch (e: any) {
    console.error('Error creando paciente simple:', e);
    
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ 
        success: false,
        message: 'Ya existe un paciente con este documento' 
      });
    }
    
    return res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

// Endpoint específico para búsqueda rápida con autocompletado
router.get('/search/quicksearch', requireAuth, async (req: Request, res: Response) => {
  const q = String(req.query.query || req.query.q || '').trim();
  
  if (!q || q.length < 2) {
    return res.json({ success: true, data: [] });
  }
  
  try {
    const like = `%${q}%`;
    const [rows] = await pool.query(`
      SELECT 
        p.id,
        p.document,
        p.name,
        p.phone,
        p.email,
        p.birth_date,
        p.gender,
        p.address,
        p.municipality_id,
        p.zone_id,
        p.insurance_eps_id,
        p.status,
        z.name as zone_name,
        m.name as municipality_name,
        eps.name as insurance_type_name
      FROM patients p
      LEFT JOIN zones z ON p.zone_id = z.id
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      LEFT JOIN eps eps ON p.insurance_eps_id = eps.id
      WHERE p.status = 'Activo' 
        AND (p.name LIKE ? OR p.document LIKE ? OR p.phone LIKE ?)
      ORDER BY 
        CASE 
          WHEN p.document = ? THEN 1
          WHEN p.document LIKE ? THEN 2
          WHEN p.name LIKE ? THEN 3
          ELSE 4
        END,
        p.name ASC
      LIMIT 10
    `, [like, like, like, q, `${q}%`, `${q}%`]);
    
    return res.json({ 
      success: true, 
      data: rows,
      total: Array.isArray(rows) ? rows.length : 0
    });
  } catch (error) {
    console.error('Error en búsqueda rápida:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error en búsqueda de pacientes' 
    });
  }
});

export default router;
