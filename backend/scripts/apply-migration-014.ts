// Script para aplicar migración 014 simplificada
import 'dotenv/config';
import pool from '../src/db/pool';
import { promises as fs } from 'fs';
import path from 'path';

async function applyMigration014() {
  try {
    console.log('🚀 Aplicando migración 014 simplificada...');

    const migrationPath = path.join(__dirname, '../migrations/014_batch_operations_slots_simple.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8');

    const connection = await pool.getConnection();

    try {
      await connection.query(migrationSQL);
      console.log('✅ Migración 014 aplicada exitosamente');

      // Verificar tablas
      const [batchOps] = await connection.query('SELECT COUNT(*) as count FROM batch_operations') as any[];
      const [slots] = await connection.query('SELECT COUNT(*) as count FROM availability_slots') as any[];
      console.log('✓ batch_operations:', batchOps[0].count, 'registros');
      console.log('✓ availability_slots:', slots[0].count, 'registros');

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('❌ Error aplicando migración:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration014();
