import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

const patientSchema = z.object({
  external_id: z.string().optional().nullable(),
  document: z.string().min(3, 'Documento requerido (mínimo 3 caracteres)'),
  name: z.string().min(1, 'Nombre requerido'),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  gender: z.enum(['Masculino','Femenino','Otro','No especificado']).default('No especificado'),
  address: z.string().optional().nullable(),
  municipality_id: z.number().int().optional().nullable(),
  zone_id: z.number().int().optional().nullable(),
  insurance_eps_id: z.number().int().optional().nullable(),
  status: z.enum(['Activo','Inactivo']).default('Activo'),
});

// Esquema ultra-simplificado para registros rápidos
const simplePatientSchema = z.object({
  document: z.string().min(3, 'Documento requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  phone: z.string().optional().nullable(),
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
        eps.name as insurance_type
      FROM patients p
      LEFT JOIN zones z ON p.zone_id = z.id
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      LEFT JOIN eps eps ON p.insurance_eps_id = eps.id
    `;
    
    if (q) {
      const like = `%${q}%`;
      const [rows] = await pool.query(
        baseQuery + ' WHERE p.name LIKE ? OR p.document LIKE ? OR p.phone LIKE ? ORDER BY p.id DESC LIMIT 100',
        [like, like, like]
      );
      return res.json(rows);
    }
    
    const [rows] = await pool.query(baseQuery + ' ORDER BY p.id DESC LIMIT 100');
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
        eps.name as insurance_type
      FROM patients p
      LEFT JOIN zones z ON p.zone_id = z.id
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      LEFT JOIN eps eps ON p.insurance_eps_id = eps.id
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

// Reemplazo / actualización (permite parcial también por diseño actual)
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
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
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
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

export default router;
