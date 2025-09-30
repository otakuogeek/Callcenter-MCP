import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

const statusSchema = z.enum(['pending','billed','paid','cancelled']);

const createSchema = z.object({
  appointment_id: z.number().int(),
  service_id: z.number().int(),
  base_price: z.number().nonnegative().optional(),
  doctor_price: z.number().nonnegative().optional(),
  final_price: z.number().nonnegative().optional(),
  currency: z.string().length(3).default('COP')
});

// Conexiones SSE en memoria (simple broadcast)
interface SSEClient { id: number; res: Response }
const sseClients: SSEClient[] = [];
let sseSeq = 0;
function broadcast(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(c => {
    try { c.res.write(payload); } catch { /* ignore */ }
  });
}

// Endpoint SSE (requiere auth por token query ya gestionado en router padre)
router.get('/stream', requireAuth, (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const id = ++sseSeq;
  sseClients.push({ id, res });
  res.write(`event: open\ndata: {"id":${id}}\n\n`);
  // Heartbeat
  const interval = setInterval(()=> { try { res.write('event: ping\ndata: {}\n\n'); } catch {} }, 25000);
  req.on('close', () => {
    clearInterval(interval);
    const idx = sseClients.findIndex(c => c.id === id);
    if (idx >= 0) sseClients.splice(idx,1);
  });
});

// Listado con paginación server-side + búsqueda q
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const dateFrom = req.query.from ? String(req.query.from) : undefined;
  const dateTo = req.query.to ? String(req.query.to) : undefined;
  const doctorId = req.query.doctor_id ? Number(req.query.doctor_id) : undefined;
  const patientId = req.query.patient_id ? Number(req.query.patient_id) : undefined;
  const serviceId = req.query.service_id ? Number(req.query.service_id) : undefined;
  const q = req.query.q ? String(req.query.q) : undefined;
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const sortKeyRaw = String(req.query.sort || 'created_at');
  const sortDirRaw = String(req.query.dir || 'desc').toLowerCase();
  const allowedSort: Record<string,string> = {
    created_at: 'ab.created_at',
    service_name: 's.name',
    doctor_name: "d.name",
    base_price: 'ab.base_price',
    doctor_price: 'ab.doctor_price',
    final_price: 'ab.final_price',
    status: 'ab.status'
  };
  const sortCol = allowedSort[sortKeyRaw] || 'ab.created_at';
  const sortDir = sortDirRaw === 'asc' ? 'ASC' : 'DESC';
  const filters: string[] = [];
  const values: any[] = [];
  if (status && ['pending','billed','paid','cancelled'].includes(status)) { filters.push('ab.status = ?'); values.push(status); }
  if (doctorId) { filters.push('ab.doctor_id = ?'); values.push(doctorId); }
  if (serviceId) { filters.push('ab.service_id = ?'); values.push(serviceId); }
  if (patientId) { filters.push('a.patient_id = ?'); values.push(patientId); }
  if (dateFrom) { filters.push('ab.created_at >= ?'); values.push(dateFrom + ' 00:00:00'); }
  if (dateTo) { filters.push('ab.created_at <= ?'); values.push(dateTo + ' 23:59:59'); }
  if (q && q.length >= 2) { filters.push(`(s.name LIKE ? OR d.name LIKE ?)`); values.push(`%${q}%`, `%${q}%`); }
  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
  try {
    // total count
    const [countRows]: any = await pool.query(
      `SELECT COUNT(*) AS total
       FROM appointment_billing ab
       JOIN services s ON s.id = ab.service_id
       JOIN appointments a ON a.id = ab.appointment_id
       LEFT JOIN doctors d ON d.id = ab.doctor_id
       ${where}`,
      values
    );
    const total = countRows?.[0]?.total || 0;
    // data page
    const [rows] = await pool.query(
      `SELECT ab.*, s.name AS service_name, d.name AS doctor_name, a.patient_id
       FROM appointment_billing ab
       JOIN services s ON s.id = ab.service_id
       JOIN appointments a ON a.id = ab.appointment_id
       LEFT JOIN doctors d ON d.id = ab.doctor_id
       ${where}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT ? OFFSET ?`,
      [...values, limit, offset]
    );
  return res.json({ data: rows, total, limit, offset, sort: sortKeyRaw, dir: sortDir.toLowerCase() });
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:appointment_id', requireAuth, async (req: Request, res: Response) => {
  const appointmentId = Number(req.params.appointment_id);
  if (Number.isNaN(appointmentId)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const [rows] = await pool.query(
      `SELECT ab.*, s.name AS service_name
       FROM appointment_billing ab JOIN services s ON s.id = ab.service_id
       WHERE ab.appointment_id = ?`, [appointmentId]
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

async function calculatePrices(appointmentId: number, serviceId: number) {
  // Obtener doctor de la cita
  const [[appt]]: any = await pool.query('SELECT doctor_id FROM appointments WHERE id = ? LIMIT 1', [appointmentId]);
  if (!appt) throw new Error('Appointment not found');
  const doctorId = appt.doctor_id;
  // Precio base del servicio
  const [[service]]: any = await pool.query('SELECT base_price, currency FROM services WHERE id = ? LIMIT 1', [serviceId]);
  if (!service) throw new Error('Service not found');
  const base = Number(service.base_price || 0);
  // Override del doctor
  const [[override]]: any = await pool.query('SELECT price FROM doctor_service_prices WHERE doctor_id = ? AND service_id = ? AND active = 1 LIMIT 1', [doctorId, serviceId]);
  const doctorPrice = override ? Number(override.price) : null;
  const finalPrice = doctorPrice != null ? doctorPrice : base;
  return { base, doctorPrice, finalPrice, currency: service.currency || 'COP', doctorId };
}

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.flatten() });
  const { appointment_id, service_id } = parsed.data;
  try {
    const pricing = await calculatePrices(appointment_id, service_id);
  const [result] = await pool.query(
      `INSERT INTO appointment_billing (appointment_id, service_id, doctor_id, base_price, doctor_price, final_price, currency)
       VALUES (?,?,?,?,?,?,?)`,
      [appointment_id, service_id, pricing.doctorId, pricing.base, pricing.doctorPrice, pricing.finalPrice, pricing.currency]
    );
    // @ts-ignore
  const created = { id: result.insertId, appointment_id, service_id, doctor_id: pricing.doctorId, ...pricing, status: 'pending' };
  // Broadcast creación (estado inicial pending)
  broadcast('billing_created', created);
  return res.status(201).json(created);
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Factura ya existe' });
    return res.status(500).json({ message: e.message || 'Server error' });
  }
});

router.post('/:appointment_id/recalculate', requireAuth, async (req: Request, res: Response) => {
  const appointmentId = Number(req.params.appointment_id);
  if (Number.isNaN(appointmentId)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const [[row]]: any = await pool.query('SELECT service_id FROM appointment_billing WHERE appointment_id = ?', [appointmentId]);
    if (!row) return res.status(404).json({ message: 'No billing record' });
    const pricing = await calculatePrices(appointmentId, row.service_id);
    await pool.query('UPDATE appointment_billing SET base_price=?, doctor_price=?, final_price=?, currency=?, updated_at = CURRENT_TIMESTAMP WHERE appointment_id = ?', [pricing.base, pricing.doctorPrice, pricing.finalPrice, pricing.currency, appointmentId]);
    return res.json({ appointment_id: appointmentId, service_id: row.service_id, ...pricing });
  } catch (e: any) {
    return res.status(500).json({ message: e.message || 'Server error' });
  }
});

// Actualizar estado (billed/paid/cancelled)
router.patch('/:id/status', requireAuth, requireRole(['admin','supervisor']), async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  const st = statusSchema.safeParse(req.body?.status);
  if (!st.success) return res.status(400).json({ message: 'Invalid status' });
  try {
    const [[row]]: any = await pool.query('SELECT id, appointment_id, status FROM appointment_billing WHERE id = ? LIMIT 1', [id]);
    if (!row) return res.status(404).json({ message: 'Not found' });
    const oldStatus = row.status;
    if (oldStatus === st.data) return res.json({ id, status: st.data });
  await pool.query('UPDATE appointment_billing SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [st.data, id]);
    try { await pool.query('INSERT INTO billing_audit_logs (billing_id, appointment_id, changed_by_user_id, old_status, new_status) VALUES (?,?,?,?,?)', [id, row.appointment_id, (req as any).user?.id || null, oldStatus, st.data]); } catch {}
  broadcast('billing_status_updated', { id, old_status: oldStatus, new_status: st.data });
  return res.json({ id, status: st.data });
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Obtener auditoría de una factura
router.get('/:id/audit', requireAuth, requireRole(['admin','supervisor']), async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const [rows] = await pool.query('SELECT * FROM billing_audit_logs WHERE billing_id = ? ORDER BY id DESC LIMIT 100', [id]);
    return res.json(rows);
  } catch { return res.status(500).json({ message: 'Server error' }); }
});

// Export CSV auditoría de una factura
router.get('/:id/audit.csv', requireAuth, requireRole(['admin','supervisor']), async (req: Request, res: Response) => {
  const id = Number(req.params.id); if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const [rows] = await pool.query('SELECT id, billing_id, appointment_id, old_status, new_status, changed_by_user_id, created_at FROM billing_audit_logs WHERE billing_id = ? ORDER BY id ASC', [id]);
    const header = ['id','billing_id','appointment_id','old_status','new_status','changed_by_user_id','created_at'];
    const lines = [header.join(',')];
    (rows as any[]).forEach(r => {
      lines.push(header.map(h => {
        const v = r[h];
        if (v == null) return '';
        const s = String(v).replace(/"/g,'""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      }).join(','));
    });
    const csv = lines.join('\n');
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="billing-audit-${id}.csv"`);
    return res.send(csv);
  } catch { return res.status(500).json({ message: 'Server error' }); }
});

// Métricas agregadas
router.get('/metrics', requireAuth, async (req: Request, res: Response) => {
  const from = String(req.query.from || '');
  const to = String(req.query.to || '');
  if (!from || !to) return res.status(400).json({ message: 'from y to requeridos' });
  const status = req.query.status ? String(req.query.status) : undefined;
  const filters: string[] = ['ab.created_at BETWEEN ? AND ?'];
  const values: any[] = [from + ' 00:00:00', to + ' 23:59:59'];
  if (status && ['pending','billed','paid','cancelled'].includes(status)) { filters.push('ab.status = ?'); values.push(status); }
  const where = 'WHERE ' + filters.join(' AND ');
  try {
    const [[totals]]: any = await pool.query(
      `SELECT COUNT(*) AS total_count, SUM(ab.final_price) AS total_amount FROM appointment_billing ab ${where}`,
      values
    );
    const [avgByDoctor]: any = await pool.query(
      `SELECT ab.doctor_id, d.name AS doctor_name, COUNT(*) AS count_bills, AVG(ab.final_price) AS avg_final, SUM(ab.final_price) AS total_final
       FROM appointment_billing ab
       LEFT JOIN doctors d ON d.id = ab.doctor_id
       ${where}
       GROUP BY ab.doctor_id, doctor_name
       ORDER BY avg_final DESC
       LIMIT 50`, values
    );
    const [topServices]: any = await pool.query(
      `SELECT ab.service_id, s.name AS service_name, COUNT(*) AS count_bills, SUM(ab.final_price) AS total_final
       FROM appointment_billing ab
       JOIN services s ON s.id = ab.service_id
       ${where}
       GROUP BY ab.service_id, s.name
       ORDER BY total_final DESC
       LIMIT 50`, values
    );
    const totalAmount = Number(totals?.total_amount || 0);
    const totalCount = Number(totals?.total_count || 0);
    const avgTicket = totalCount ? totalAmount / totalCount : 0;
    return res.json({ from, to, total_amount: totalAmount, total_count: totalCount, avg_ticket: avgTicket, avg_by_doctor: avgByDoctor, top_services: topServices });
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Resumen financiero agregado (agrupaciones dinámicas)
router.get('/summary', requireAuth, async (req: Request, res: Response) => {
  const group = String(req.query.group || 'day'); // day | doctor | service
  const from = String(req.query.from || '');
  const to = String(req.query.to || '');
  if (!from || !to) return res.status(400).json({ message: 'from y to requeridos (YYYY-MM-DD)' });
  const validGroups = ['day','doctor','service'];
  if (!validGroups.includes(group)) return res.status(400).json({ message: 'group inválido' });
  try {
    let selectPart = '';
    let groupPart = '';
    if (group === 'day') { selectPart = 'DATE(ab.created_at) AS label'; groupPart = 'DATE(ab.created_at)'; }
  else if (group === 'doctor') { selectPart = "ab.doctor_id AS label, d.name AS doctor_name"; groupPart = 'ab.doctor_id'; }
    else { selectPart = 'ab.service_id AS label, s.name AS service_name'; groupPart = 'ab.service_id'; }
    const [rows] = await pool.query(
      `SELECT ${selectPart}, COUNT(*) AS count_bills, SUM(ab.final_price) AS total_final, SUM(ab.base_price) AS total_base,
              SUM(COALESCE(ab.doctor_price,0)) AS total_doctor_override
       FROM appointment_billing ab
       JOIN services s ON s.id = ab.service_id
       JOIN appointments a ON a.id = ab.appointment_id
       LEFT JOIN doctors d ON d.id = ab.doctor_id
       WHERE ab.created_at BETWEEN ? AND ?
       GROUP BY ${groupPart}
       ORDER BY ${groupPart} DESC
       LIMIT 365`, [from + ' 00:00:00', to + ' 23:59:59']
    );
    return res.json({ group_by: group, from, to, items: rows });
  } catch (e) {
    return res.status(500).json({ message: 'Server error' });
  }
});

// Exportación CSV
router.get('/export.csv', requireAuth, requireRole(['admin','supervisor']), async (req: Request, res: Response) => {
  const from = String(req.query.from || '');
  const to = String(req.query.to || '');
  if (!from || !to) return res.status(400).json({ message: 'from y to requeridos (YYYY-MM-DD)' });
  const status = req.query.status ? String(req.query.status) : undefined;
  const filters: string[] = ['ab.created_at BETWEEN ? AND ?'];
  const values: any[] = [from + ' 00:00:00', to + ' 23:59:59'];
  if (status && ['pending','billed','paid','cancelled'].includes(status)) { filters.push('ab.status = ?'); values.push(status); }
  const where = 'WHERE ' + filters.join(' AND ');
  try {
    const [rows] = await pool.query(
  `SELECT ab.id, ab.appointment_id, ab.service_id, s.name AS service_name, ab.doctor_id, d.name AS doctor_name,
              ab.base_price, ab.doctor_price, ab.final_price, ab.currency, ab.status, ab.created_at
       FROM appointment_billing ab
       JOIN services s ON s.id = ab.service_id
       LEFT JOIN doctors d ON d.id = ab.doctor_id
       ${where}
       ORDER BY ab.created_at DESC
       LIMIT 5000`, values
    );
    const header = ['id','appointment_id','service_id','service_name','doctor_id','doctor_name','base_price','doctor_price','final_price','currency','status','created_at'];
    const lines = [header.join(',')];
    (rows as any[]).forEach(r => {
      lines.push(header.map(h => {
        const v = r[h];
        if (v == null) return '';
        const s = String(v).replace(/"/g,'""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      }).join(','));
    });
    const csv = lines.join('\n');
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="billing-${from}_to_${to}.csv"`);
    return res.send(csv);
  } catch {
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
