import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

const schema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(255),
  affiliation_type: z.enum(['Contributivo', 'Subsidiado', 'Especial', 'Mixto']).default('Contributivo'),
  status: z.enum(['active', 'inactive', 'liquidation']).default('active'),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  website: z.string().url().optional().nullable(),
  has_agreement: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    // Parámetros de filtro opcionales
    const status = req.query.status as string | undefined;
    const affiliation_type = req.query.affiliation_type as string | undefined;
    const has_agreement = req.query.has_agreement as string | undefined;
    
    let query = 'SELECT * FROM eps WHERE 1=1';
    const params: any[] = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (affiliation_type) {
      query += ' AND affiliation_type = ?';
      params.push(affiliation_type);
    }
    
    if (has_agreement !== undefined) {
      query += ' AND has_agreement = ?';
      params.push(has_agreement === 'true' ? 1 : 0);
    }
    
    query += ' ORDER BY name ASC';
    
    const [rows] = await pool.query(query, params);
    return res.json(rows);
  } catch (e: any) {
    if (e && (e.code === 'ER_NO_SUCH_TABLE' || e.errno === 1146)) {
      return res.json([]);
    }
    console.error('Error fetching EPS:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data;
  try {
    const [result] = await pool.query(
      `INSERT INTO eps (code, name, affiliation_type, status, phone, email, website, has_agreement, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.code, d.name, d.affiliation_type, d.status, d.phone ?? null, d.email ?? null, d.website ?? null, d.has_agreement, d.notes ?? null]
    );
    // @ts-ignore
    return res.status(201).json({ id: result.insertId, ...d });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Código de EPS ya existe' });
    console.error('Error creating EPS:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); 
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  
  const d = parsed.data;
  try {
    const fields: string[] = []; 
    const values: any[] = [];
    
    for (const k of Object.keys(d) as (keyof typeof d)[]) { 
      fields.push(`${k} = ?`); 
      // @ts-ignore
      values.push(d[k] ?? null); 
    }
    
    if (!fields.length) return res.status(400).json({ message: 'No changes' });
    
    values.push(id);
    await pool.query(`UPDATE eps SET ${fields.join(', ')} WHERE id = ?`, values);
    return res.json({ id, ...d });
  } catch (e: any) {
    console.error('Error updating EPS:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); 
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  
  try {
    // Verificar si hay pacientes usando esta EPS
    const [patients]: any = await pool.query(
      'SELECT COUNT(*) as count FROM patients WHERE insurance_eps_id = ?', 
      [id]
    );
    
    if (patients[0].count > 0) {
      return res.status(400).json({ 
        message: 'No se puede eliminar la EPS porque tiene pacientes asociados',
        patients_count: patients[0].count
      });
    }
    
    await pool.query('DELETE FROM eps WHERE id = ?', [id]);
    return res.status(204).send();
  } catch (e: any) {
    console.error('Error deleting EPS:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Endpoint adicional: Obtener estadísticas de EPS
router.get('/stats', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        e.id,
        e.name,
        e.code,
        e.affiliation_type,
        e.status,
        e.has_agreement,
        COUNT(p.id) as patients_count
      FROM eps e
      LEFT JOIN patients p ON p.insurance_eps_id = e.id
      GROUP BY e.id, e.name, e.code, e.affiliation_type, e.status, e.has_agreement
      ORDER BY patients_count DESC, e.name ASC
    `);
    
    return res.json(stats);
  } catch (e: any) {
    console.error('Error fetching EPS stats:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
