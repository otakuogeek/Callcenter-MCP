import 'dotenv/config';
import pool from '../src/db/pool';

// Parámetros (pueden convertirse en flags)
const DAYS_THRESHOLD = parseInt(process.env.CALL_ARCHIVE_DAYS || '90', 10);
const BATCH_SIZE = 500; // mover en lotes para no bloquear

async function archiveOldCalls() {
  console.log(`📦 Archivando llamadas con más de ${DAYS_THRESHOLD} días...`);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Seleccionar lote de IDs
    const [rows] = await conn.query(
      `SELECT id FROM calls WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY) LIMIT ?`,
      [DAYS_THRESHOLD, BATCH_SIZE]
    );
    const ids = (rows as any[]).map(r => r.id);
    if (ids.length === 0) {
      await conn.rollback();
      console.log('✅ No hay llamadas para archivar.');
      return;
    }
    // Insertar en archivo
    await conn.query(`INSERT INTO calls_archive SELECT * FROM calls WHERE id IN (${ids.map(()=>'?').join(',')})`, ids);
    // Borrar del primario
    await conn.query(`DELETE FROM calls WHERE id IN (${ids.map(()=>'?').join(',')})`, ids);
    await conn.commit();
    console.log(`✅ Archivadas ${ids.length} llamadas.`);
  } catch (err) {
    console.error('❌ Error archivando llamadas:', err);
    await conn.rollback();
  } finally {
    conn.release();
  // Pool se mantiene para ejecución encadenada; cierre lo hará el proceso externo si corresponde
  }
}

archiveOldCalls();
