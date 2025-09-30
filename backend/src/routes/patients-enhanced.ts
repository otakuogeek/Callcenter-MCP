import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Función para formatear fechas de forma segura
function formatDate(value: any): string | null {
  if (!value) return null;
  
  try {
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return null;
      return value.toISOString().split('T')[0];
    }
    
    if (typeof value === 'string') {
      const date = new Date(value);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error formatting date:', error);
    return null;
  }
}

// Función para formatear fecha y hora de forma segura
function formatDateTime(value: any): string | null {
  if (!value) return null;
  
  try {
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return null;
      return value.toISOString();
    }
    
    if (typeof value === 'string') {
      const date = new Date(value);
      if (isNaN(date.getTime())) return null;
      return date.toISOString();
    }
    
    return null;
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return null;
  }
}

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
      
      // Formatear fechas de forma segura
      const formattedRows = (rows as any[]).map(patient => ({
        ...patient,
        birth_date: formatDate(patient.birth_date),
        created_at: formatDateTime(patient.created_at),
        updated_at: formatDateTime(patient.updated_at)
      }));
      
      return res.json(formattedRows);
    }
    
    const [rows] = await pool.query(baseQuery + ' ORDER BY p.id DESC LIMIT 100');
    
    // Formatear fechas de forma segura
    const formattedRows = (rows as any[]).map(patient => ({
      ...patient,
      birth_date: formatDate(patient.birth_date),
      created_at: formatDateTime(patient.created_at),
      updated_at: formatDateTime(patient.updated_at)
    }));
    
    return res.json(formattedRows);
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
    
    // Formatear fechas de forma segura
    const formattedRow = {
      ...row,
      birth_date: formatDate(row.birth_date),
      created_at: formatDateTime(row.created_at),
      updated_at: formatDateTime(row.updated_at)
    };
    
    return res.json(formattedRow);
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

// Endpoint de búsqueda avanzada con paginación
router.get('/search/advanced', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search as string || '';
    const municipality = req.query.municipality as string;
    const eps = req.query.eps as string;
    const gender = req.query.gender as string;
    const ageFrom = parseInt(req.query.ageFrom as string);
    const ageTo = parseInt(req.query.ageTo as string);

    let whereConditions: string[] = [];
    let queryParams: any[] = [];

    // Búsqueda por texto
    if (search) {
      whereConditions.push('(p.name LIKE ? OR p.document LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Filtro por municipio
    if (municipality) {
      whereConditions.push('p.municipality_id = ?');
      queryParams.push(municipality);
    }

    // Filtro por EPS
    if (eps) {
      whereConditions.push('p.insurance_eps_id = ?');
      queryParams.push(eps);
    }

    // Filtro por género
    if (gender) {
      whereConditions.push('p.gender = ?');
      queryParams.push(gender);
    }

    // Filtro por edad
    if (!isNaN(ageFrom) || !isNaN(ageTo)) {
      if (!isNaN(ageFrom) && !isNaN(ageTo)) {
        whereConditions.push('FLOOR(DATEDIFF(CURDATE(), p.birth_date) / 365.25) BETWEEN ? AND ?');
        queryParams.push(ageFrom, ageTo);
      } else if (!isNaN(ageFrom)) {
        whereConditions.push('FLOOR(DATEDIFF(CURDATE(), p.birth_date) / 365.25) >= ?');
        queryParams.push(ageFrom);
      } else if (!isNaN(ageTo)) {
        whereConditions.push('FLOOR(DATEDIFF(CURDATE(), p.birth_date) / 365.25) <= ?');
        queryParams.push(ageTo);
      }
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const baseQuery = `
      SELECT 
        p.*,
        z.name as zone,
        m.name as municipality,
        eps.name as insurance_type,
        FLOOR(DATEDIFF(CURDATE(), p.birth_date) / 365.25) as age
      FROM patients p
      LEFT JOIN zones z ON p.zone_id = z.id
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      LEFT JOIN eps eps ON p.insurance_eps_id = eps.id
      ${whereClause}
    `;

    // Obtener datos con paginación
    const [rows] = await pool.query(
      baseQuery + ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?',
      [...queryParams, limit, offset]
    );

    // Contar total
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM patients p ${whereClause}`,
      queryParams
    );
    const total = (countResult as any)[0].total;

    // Formatear fechas
    const formattedRows = (rows as any[]).map(patient => ({
      ...patient,
      birth_date: formatDate(patient.birth_date),
      created_at: formatDateTime(patient.created_at),
      updated_at: formatDateTime(patient.updated_at)
    }));

    res.json({
      success: true,
      data: {
        patients: formattedRows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error in advanced search:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Endpoint para estadísticas de pacientes
router.get('/stats/dashboard', requireAuth, async (req: Request, res: Response) => {
  try {
    // Total de pacientes
    const [totalResult] = await pool.query('SELECT COUNT(*) as total FROM patients WHERE status = "Activo"');
    const total = (totalResult as any)[0].total;

    // Pacientes por género
    const [genderStats] = await pool.query(`
      SELECT gender, COUNT(*) as count 
      FROM patients 
      WHERE status = "Activo" 
      GROUP BY gender
    `);

    // Pacientes por rango de edad
    const [ageStats] = await pool.query(`
      SELECT 
        CASE 
          WHEN FLOOR(DATEDIFF(CURDATE(), birth_date) / 365.25) < 18 THEN 'Menor de 18'
          WHEN FLOOR(DATEDIFF(CURDATE(), birth_date) / 365.25) BETWEEN 18 AND 30 THEN '18-30'
          WHEN FLOOR(DATEDIFF(CURDATE(), birth_date) / 365.25) BETWEEN 31 AND 50 THEN '31-50'
          WHEN FLOOR(DATEDIFF(CURDATE(), birth_date) / 365.25) BETWEEN 51 AND 70 THEN '51-70'
          WHEN FLOOR(DATEDIFF(CURDATE(), birth_date) / 365.25) > 70 THEN 'Mayor de 70'
          ELSE 'Sin datos'
        END as age_range,
        COUNT(*) as count
      FROM patients 
      WHERE status = "Activo" AND birth_date IS NOT NULL
      GROUP BY age_range
    `);

    // Pacientes por EPS
    const [epsStats] = await pool.query(`
      SELECT eps.name as eps_name, COUNT(*) as count
      FROM patients p
      LEFT JOIN eps eps ON p.insurance_eps_id = eps.id
      WHERE p.status = "Activo"
      GROUP BY eps.name
      ORDER BY count DESC
      LIMIT 10
    `);

    // Registros por mes (últimos 6 meses)
    const [monthlyStats] = await pool.query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count
      FROM patients
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month DESC
    `);

    res.json({
      success: true,
      data: {
        total,
        genderStats,
        ageStats,
        epsStats,
        monthlyStats
      }
    });
  } catch (error) {
    console.error('Error getting patient stats:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Endpoint para validar duplicados
router.post('/validate/duplicates', requireAuth, async (req: Request, res: Response) => {
  try {
    const { document, name, phone } = req.body;

    if (!document && !name && !phone) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere al menos un campo para validar (document, name, phone)'
      });
    }

    let whereConditions: string[] = [];
    let queryParams: any[] = [];

    if (document) {
      whereConditions.push('document = ?');
      queryParams.push(document);
    }

    if (name) {
      whereConditions.push('name = ?');
      queryParams.push(name);
    }

    if (phone) {
      whereConditions.push('phone = ?');
      queryParams.push(phone);
    }

    const [rows] = await pool.query(
      `SELECT id, document, name, phone, email, created_at 
       FROM patients 
       WHERE (${whereConditions.join(' OR ')}) AND status = "Activo"`,
      queryParams
    );

    const duplicates = (rows as any[]).map(patient => ({
      ...patient,
      created_at: formatDateTime(patient.created_at)
    }));

    res.json({
      success: true,
      data: {
        hasDuplicates: duplicates.length > 0,
        duplicates,
        count: duplicates.length
      }
    });
  } catch (error) {
    console.error('Error validating duplicates:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Endpoint para exportar pacientes
router.get('/export/csv', requireAuth, async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string || '';
    const municipality = req.query.municipality as string;
    const eps = req.query.eps as string;

    let whereConditions: string[] = ['p.status = "Activo"'];
    let queryParams: any[] = [];

    if (search) {
      whereConditions.push('(p.name LIKE ? OR p.document LIKE ? OR p.phone LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    if (municipality) {
      whereConditions.push('p.municipality_id = ?');
      queryParams.push(municipality);
    }

    if (eps) {
      whereConditions.push('p.insurance_eps_id = ?');
      queryParams.push(eps);
    }

    const [rows] = await pool.query(`
      SELECT 
        p.document,
        p.name,
        p.phone,
        p.email,
        p.birth_date,
        p.gender,
        p.address,
        m.name as municipality,
        eps.name as eps,
        p.insurance_affiliation_type,
        p.created_at
      FROM patients p
      LEFT JOIN municipalities m ON p.municipality_id = m.id
      LEFT JOIN eps eps ON p.insurance_eps_id = eps.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY p.created_at DESC
    `, queryParams);

    // Formatear fechas para CSV
    const csvData = (rows as any[]).map(patient => ({
      ...patient,
      birth_date: formatDate(patient.birth_date),
      created_at: formatDateTime(patient.created_at)
    }));

    // Crear cabeceras CSV
    const headers = [
      'Documento', 'Nombre', 'Teléfono', 'Email', 'Fecha Nacimiento',
      'Género', 'Dirección', 'Municipio', 'EPS', 'Tipo Afiliación', 'Fecha Registro'
    ];

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => [
        `"${row.document}"`,
        `"${row.name || ''}"`,
        `"${row.phone || ''}"`,
        `"${row.email || ''}"`,
        `"${row.birth_date || ''}"`,
        `"${row.gender || ''}"`,
        `"${row.address || ''}"`,
        `"${row.municipality || ''}"`,
        `"${row.eps || ''}"`,
        `"${row.insurance_affiliation_type || ''}"`,
        `"${row.created_at || ''}"`
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pacientes_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Error exporting patients:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

export default router;
