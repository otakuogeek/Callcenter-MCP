import 'dotenv/config';
import pool from '../src/db/pool';

async function main() {
  console.log('[recalc] Inicio');
  try {
    const [availRows]: any = await pool.query('SELECT id, capacity, booked_slots FROM availabilities LIMIT 10000');
    for (const a of (Array.isArray(availRows) ? availRows : [])) {
      try {
        const [[cnt]]: any = await pool.query('SELECT COUNT(*) AS c FROM appointments WHERE availability_id = ? AND status != "Cancelada"', [a.id]);
        const booked = Number(cnt?.c || 0);
        let newStatus: string | undefined = undefined;
        if (a.capacity && a.capacity > 0 && booked >= a.capacity) newStatus = 'Completa';
        else if (booked === 0 && a.booked_slots !== 0 && a.capacity > 0) newStatus = 'Activa';
        await pool.query('UPDATE availabilities SET booked_slots = ?, status = COALESCE(?, status) WHERE id = ?', [booked, newStatus || null, a.id]);
      } catch {/* ignore individual */}
    }
    console.log('[recalc] Finalizado');
  } catch (e) {
    console.error('[recalc] Error', e);
  } finally {
    process.exit(0);
  }
}

main();
