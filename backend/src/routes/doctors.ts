import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

const doctorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  license_number: z.string().min(3),
  active: z.boolean().default(true),
  specialties: z.array(z.number().int()).optional(),
  locations: z.array(z.number().int()).optional(),
});

router.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    // Corregido: usar campo 'name' que existe en la tabla
    const [doctors] = await pool.query<any[]>(
      `SELECT 
         id,
         name,
         email,
         phone,
         license_number,
         CASE WHEN active IS NULL THEN 1 ELSE active END AS active
       FROM doctors
       ORDER BY name ASC`
    );

    // Intentar cargar especialidades/ubicaciones si existen las tablas, si no, devolver vacíos
    let specRows: any[] = [];
    let locRows: any[] = [];
    try {
      const [specs] = await pool.query<any[]>(
        `SELECT ds.doctor_id, s.id, s.name
         FROM doctor_specialties ds
         JOIN specialties s ON s.id = ds.specialty_id`
      );
      specRows = Array.isArray(specs) ? specs : [];
    } catch {}
    try {
      const [locs] = await pool.query<any[]>(
        `SELECT dl.doctor_id, l.id, l.name
         FROM doctor_locations dl
         JOIN locations l ON l.id = dl.location_id`
      );
      locRows = Array.isArray(locs) ? locs : [];
    } catch {}

    const map = new Map<number, any[]>();
    for (const r of specRows) {
      const arr = map.get(Number(r.doctor_id)) || [];
      arr.push({ id: Number(r.id), name: r.name });
      map.set(Number(r.doctor_id), arr);
    }
    const locMap = new Map<number, any[]>();
    for (const r of locRows) {
      const arr = locMap.get(Number(r.doctor_id)) || [];
      arr.push({ id: Number(r.id), name: r.name });
      locMap.set(Number(r.doctor_id), arr);
    }

    const withSpecs = (doctors as any[]).map((d) => ({
      ...d,
      specialties: map.get(Number(d.id)) || [],
      locations: locMap.get(Number(d.id)) || [],
    }));
    return res.json(withSpecs);
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Búsqueda rápida para autocomplete (?q=texto)
router.get('/search/q', requireAuth, async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);
  try {
    const [rows] = await pool.query(
      `SELECT id, CONCAT(first_name,' ',last_name) AS name
       FROM doctors
       WHERE CONCAT(first_name,' ',last_name) LIKE ?
       ORDER BY first_name ASC, last_name ASC
       LIMIT 20`,
      ['%' + q + '%']
    );
    return res.json(rows);
  } catch { return res.status(500).json({ message: 'Server error' }); }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = doctorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      'INSERT INTO doctors (name, email, phone, license_number, active) VALUES (?, ?, ?, ?, ?)',
      [d.name, d.email ?? null, d.phone ?? null, d.license_number, d.active]
    );
    // @ts-ignore
    const doctorId = result.insertId as number;
    if (d.specialties?.length) {
      const values = d.specialties.map((sid) => [doctorId, sid]);
      await conn.query('INSERT INTO doctor_specialties (doctor_id, specialty_id) VALUES ?', [values]);
    }
    if (d.locations?.length) {
      const values = d.locations.map((lid) => [doctorId, lid]);
      await conn.query('INSERT INTO doctor_locations (doctor_id, location_id) VALUES ?', [values]);
    }
    await conn.commit();
    return res.status(201).json({ id: doctorId, ...d });
  } catch (e: any) {
    await conn.rollback();
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Médico ya existe (licencia)' });
    return res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
});

// List specialties for a doctor
router.get('/:id/specialties', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const [rows] = await pool.query(
      `SELECT s.* FROM specialties s
       INNER JOIN doctor_specialties ds ON ds.specialty_id = s.id
       WHERE ds.doctor_id = ?
       ORDER BY s.name ASC`,
      [id]
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Replace specialties for a doctor
router.put('/:id/specialties', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const schema = z.object({ specialty_ids: z.array(z.number().int()).default([]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const { specialty_ids } = parsed.data;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM doctor_specialties WHERE doctor_id = ?', [id]);
    if (specialty_ids.length) {
      const values = specialty_ids.map((sid) => [id, sid]);
      await conn.query('INSERT INTO doctor_specialties (doctor_id, specialty_id) VALUES ?', [values]);
    }
    await conn.commit();
    return res.json({ doctor_id: id, specialty_ids });
  } catch {
    await conn.rollback();
    return res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
});

// List locations for a doctor
router.get('/:id/locations', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const [rows] = await pool.query(
      `SELECT l.* FROM locations l
       INNER JOIN doctor_locations dl ON dl.location_id = l.id
       WHERE dl.doctor_id = ?
       ORDER BY l.name ASC`,
      [id]
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Replace locations for a doctor
router.put('/:id/locations', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const schema = z.object({ location_ids: z.array(z.number().int()).default([]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const { location_ids } = parsed.data;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM doctor_locations WHERE doctor_id = ?', [id]);
    if (location_ids.length) {
      const values = location_ids.map((lid) => [id, lid]);
      await conn.query('INSERT INTO doctor_locations (doctor_id, location_id) VALUES ?', [values]);
    }
    await conn.commit();
    return res.json({ doctor_id: id, location_ids });
  } catch {
    await conn.rollback();
    return res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
});

router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const parsed = doctorSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const fields: string[] = []; const values: any[] = [];
    for (const k of ['name','email','phone','license_number','active'] as const) {
      if (k in d) { fields.push(`${k} = ?`); // @ts-ignore
        values.push(d[k] ?? null); }
    }
    if (fields.length) {
      values.push(id);
      await conn.query(`UPDATE doctors SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    if ('specialties' in d) {
      await conn.query('DELETE FROM doctor_specialties WHERE doctor_id = ?', [id]);
      if (d.specialties?.length) {
        const values = d.specialties.map((sid) => [id, sid]);
        await conn.query('INSERT INTO doctor_specialties (doctor_id, specialty_id) VALUES ?', [values]);
      }
    }
    if ('locations' in d) {
      await conn.query('DELETE FROM doctor_locations WHERE doctor_id = ?', [id]);
      if (d.locations?.length) {
        const values = d.locations.map((lid) => [id, lid]);
        await conn.query('INSERT INTO doctor_locations (doctor_id, location_id) VALUES ?', [values]);
      }
    }
    await conn.commit();
    return res.json({ id, ...d });
  } catch {
    await conn.rollback();
    return res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
});

// Nuevo endpoint: obtener doctores por especialidad
router.get('/by-specialty/:specialtyId', requireAuth, async (req: Request, res: Response) => {
  const specialtyId = Number(req.params.specialtyId);
  if (Number.isNaN(specialtyId)) {
    return res.status(400).json({ message: 'Invalid specialty ID' });
  }

  try {
    const [doctors] = await pool.query<any[]>(
      `SELECT DISTINCT 
         d.id,
         d.name,
         d.email,
         d.phone,
         d.license_number,
         CASE WHEN d.active IS NULL THEN 1 ELSE d.active END AS active
       FROM doctors d
       INNER JOIN doctor_specialties ds ON ds.doctor_id = d.id
       WHERE ds.specialty_id = ? AND (d.active IS NULL OR d.active = 1)
       ORDER BY d.name ASC`,
      [specialtyId]
    );

    return res.json(doctors || []);
  } catch (error) {
    console.error('Error fetching doctors by specialty:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    await pool.query('DELETE FROM doctors WHERE id = ?', [id]);
    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /doctors/:id/set-password
 * Establece o actualiza la contraseña de un doctor para acceder al panel
 */
router.post('/:id/set-password', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ message: 'Invalid doctor ID' });
  }

  const schema = z.object({
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres')
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ 
      message: 'Datos inválidos', 
      errors: parsed.error.flatten() 
    });
  }

  const { password } = parsed.data;

  try {
    // Verificar que el doctor existe
    const [doctors] = await pool.query<any[]>(
      'SELECT id, name, email FROM doctors WHERE id = ?',
      [id]
    );

    if (!Array.isArray(doctors) || doctors.length === 0) {
      return res.status(404).json({ message: 'Doctor no encontrado' });
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Actualizar la contraseña del doctor
    await pool.query(
      'UPDATE doctors SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [passwordHash, id]
    );

    return res.json({
      success: true,
      message: `Contraseña establecida para ${doctors[0].name}`,
      doctor: {
        id: doctors[0].id,
        name: doctors[0].name,
        email: doctors[0].email,
        hasPassword: true
      }
    });
  } catch (error: any) {
    console.error('Error setting doctor password:', error);
    return res.status(500).json({ 
      message: 'Error al establecer la contraseña',
      error: error.message 
    });
  }
});

/**
 * GET /doctors/:id/has-password
 * Verifica si un doctor tiene contraseña configurada
 */
router.get('/:id/has-password', requireAuth, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ message: 'Invalid doctor ID' });
  }

  try {
    const [doctors] = await pool.query<any[]>(
      'SELECT id, password_hash FROM doctors WHERE id = ?',
      [id]
    );

    if (!Array.isArray(doctors) || doctors.length === 0) {
      return res.status(404).json({ message: 'Doctor no encontrado' });
    }

    return res.json({
      hasPassword: doctors[0].password_hash !== null && doctors[0].password_hash !== ''
    });
  } catch (error: any) {
    console.error('Error checking doctor password:', error);
    return res.status(500).json({ 
      message: 'Error al verificar la contraseña',
      error: error.message 
    });
  }
});

export default router;
