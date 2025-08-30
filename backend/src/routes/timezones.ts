import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (_req: Request, res: Response) => {
  const fallback = [
    'UTC',
    'America/Bogota', 'America/Lima', 'America/Guayaquil', 'America/Caracas',
    'America/Mexico_City', 'America/Panama', 'America/Santo_Domingo',
    'America/La_Paz', 'America/Santiago', 'America/Asuncion', 'America/Montevideo', 'America/Argentina/Buenos_Aires',
    'America/Chicago', 'America/New_York', 'America/Los_Angeles',
    'Atlantic/Cape_Verde', 'Atlantic/Azores',
    'Europe/London', 'Europe/Madrid', 'Europe/Berlin', 'Europe/Paris', 'Europe/Rome',
  ];
  try {
    const [rows] = await pool.query('SELECT name FROM timezones ORDER BY name ASC');
    // @ts-ignore
    const names = rows.map((r) => r.name as string);
    if (!Array.isArray(names) || names.length === 0) return res.json(fallback);
    return res.json(names);
  } catch {
    // Si la tabla no existe u otro error, retornar fallback para no romper el UI
    return res.json(fallback);
  }
});

export default router;
