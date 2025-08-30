import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

const schema = z.object({
  notifications_email_enabled: z.boolean().optional(),
  notifications_email: z.string().email().nullable().optional(),
  alert_long_queue_enabled: z.boolean().optional(),
  alert_agents_offline_enabled: z.boolean().optional(),
  // General settings (IPS & Call Center)
  org_name: z.string().min(1).max(150).nullable().optional(),
  org_address: z.string().min(1).max(200).nullable().optional(),
  org_phone: z.string().min(3).max(30).nullable().optional(),
  org_nit: z.string().min(3).max(30).nullable().optional(),
  org_logo_url: z
    .string()
    .min(1)
    .max(255)
    .refine((v) => /^https?:\/\//i.test(v) || v.startsWith('/'), {
      message: 'Debe ser URL http(s) o una ruta local iniciando con /',
    })
    .nullable()
    .optional(),
  org_timezone: z.string().min(1).max(64).optional(),
  cc_call_recording_enabled: z.boolean().optional(),
  cc_auto_distribution_enabled: z.boolean().optional(),
  cc_max_wait_minutes: z.number().int().min(1).max(240).optional(),
  // AI agent
  ai_enabled: z.boolean().optional(),
  ai_auto_answer: z.boolean().optional(),
  ai_response_timeout_seconds: z.number().int().min(1).max(120).optional(),
  ai_start_time: z.string().nullable().optional(),
  ai_end_time: z.string().nullable().optional(),
  ai_mon: z.boolean().optional(),
  ai_tue: z.boolean().optional(),
  ai_wed: z.boolean().optional(),
  ai_thu: z.boolean().optional(),
  ai_fri: z.boolean().optional(),
  ai_sat: z.boolean().optional(),
  ai_sun: z.boolean().optional(),
  ai_pause_holidays: z.boolean().optional(),
  ai_vacation_mode: z.boolean().optional(),
  ai_break_start: z.string().nullable().optional(),
  ai_break_end: z.string().nullable().optional(),
  ai_message_welcome: z.string().nullable().optional(),
  ai_message_offline: z.string().nullable().optional(),
  ai_message_transfer: z.string().nullable().optional(),
});

router.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT * FROM system_settings WHERE id = 1');
    // @ts-ignore
    return res.json(rows[0] || null);
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const d = parsed.data;
  try {
    // Obtener columnas reales de system_settings para evitar errores si faltan migraciones
    const [colsRows] = await pool.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_settings'");
    // @ts-ignore
    const colSet = new Set((colsRows as any[]).map(r => r.COLUMN_NAME as string));
    const fields: string[] = []; const values: any[] = [];
    for (const k of Object.keys(d) as (keyof typeof d)[]) {
      if (colSet.has(k as string)) { // @ts-ignore
        fields.push(`${k} = ?`); values.push(d[k]);
      }
    }
    if (fields.length) {
      values.push(1);
      await pool.query(`UPDATE system_settings SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    const [rows] = await pool.query('SELECT * FROM system_settings WHERE id = 1');
    // @ts-ignore
    return res.json(rows[0] || null);
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
