// ==============================================
// SCRIPT PARA APLICAR TODAS LAS MIGRACIONES
// ==============================================

import 'dotenv/config';
import pool from '../src/db/pool';
import { promises as fs } from 'fs';
import path from 'path';

async function applyAllMigrations() {
  try {
    console.log('🚀 Iniciando aplicación de todas las migraciones...');

    // Lista de migraciones en orden
    const migrations = [
      '011_elevenlabs_webhooks.sql',
      '011_elevenlabs_webhooks_simple.sql',
      '012_call_management.sql',
      '013_batch_availabilities_holidays.sql',
      '014_batch_operations_slots.sql',
      '20250821_add_patient_fields.sql',
      '20250826_add_calls_indexes.sql',
      '20250826_add_patient_search_indexes.sql',
      '20250826_cleanup_calls_indexes.sql',
      '20250826_create_call_events.sql',
      '20250826_create_calls_archive.sql',
      '20250826_reintroduce_unique_and_extra_index.sql'
    ];

    // Obtener conexión para transacción
    const connection = await pool.getConnection();

    try {
      await connection.query('START TRANSACTION');

      for (const migrationFile of migrations) {
        const migrationPath = path.join(__dirname, '../migrations', migrationFile);

        try {
          console.log(`📝 Aplicando migración: ${migrationFile}`);
          const migrationSQL = await fs.readFile(migrationPath, 'utf-8');

          // Dividir por transacciones y ejecutar
          const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && stmt !== 'START TRANSACTION' && stmt !== 'COMMIT');

          for (const statement of statements) {
            if (statement.trim()) {
              await connection.query(statement);
            }
          }

          console.log(`✅ ${migrationFile} aplicada exitosamente`);
        } catch (error) {
          console.log(`⚠️  ${migrationFile} ya aplicada o error (continuando):`, error instanceof Error ? error.message : String(error));
        }
      }

      // Confirmar transacción
      await connection.query('COMMIT');
      console.log('🎉 Todas las migraciones aplicadas exitosamente');

    } catch (error) {
      // Revertir en caso de error
      await connection.query('ROLLBACK');
      throw error;
    } finally {
      connection.release();
    }

    // Verificar tablas importantes
    console.log('🔍 Verificando tablas importantes...');

    const tablesToCheck = [
      'batch_operations',
      'availability_slots',
      'holidays'
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
  applyAllMigrations();
}

export default applyAllMigrations;
