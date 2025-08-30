// ==============================================
// SCRIPT MEJORADO PARA APLICAR MIGRACIONES
// ==============================================

import 'dotenv/config';
import pool from '../src/db/pool';
import { promises as fs } from 'fs';
import path from 'path';

async function applyMigrationsImproved() {
  try {
    console.log('🚀 Iniciando aplicación de migraciones mejorada...');

    // Lista de migraciones en orden
    const migrations = [
      '014_batch_operations_slots.sql'
    ];

    // Obtener conexión
    const connection = await pool.getConnection();

    try {
      for (const migrationFile of migrations) {
        const migrationPath = path.join(__dirname, '../migrations', migrationFile);

        try {
          console.log(`📝 Aplicando migración: ${migrationFile}`);
          const migrationSQL = await fs.readFile(migrationPath, 'utf-8');

          // Ejecutar la migración completa como un solo bloque
          await connection.query(migrationSQL);
          console.log(`✅ ${migrationFile} aplicada exitosamente`);

        } catch (error) {
          console.log(`⚠️  ${migrationFile} error:`, error instanceof Error ? error.message : String(error));
          // Continuar con la siguiente migración
        }
      }

    } finally {
      connection.release();
    }

    // Verificar tablas importantes
    console.log('🔍 Verificando tablas importantes...');

    const tablesToCheck = [
      'batch_operations',
      'availability_slots'
    ];

    for (const table of tablesToCheck) {
      try {
        const [rows] = await pool.query(`SELECT COUNT(*) as count FROM ${table}`) as any[];
        const count = rows[0].count;
        console.log(`✓ ${table}: ${count} registros`);
      } catch (error) {
        console.log(`⚠️  ${table}: Error verificando - ${error instanceof Error ? error.message : String(error)}`);
      }
    }

  } catch (error) {
    console.error('❌ Error aplicando migraciones:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  applyMigrationsImproved();
}

export default applyMigrationsImproved;
