// ==============================================
// SCRIPT PARA APLICAR MIGRACIÓN DE PACIENTES
// ==============================================

import 'dotenv/config';
import pool from '../src/db/pool';
import { promises as fs } from 'fs';
import path from 'path';

async function applyMigration() {
  try {
    console.log('🚀 Iniciando aplicación de migración...');

    // Leer el archivo de migración
    const migrationPath = path.join(__dirname, '../migrations/20250821_add_patient_fields.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8');

    // Dividir por transacciones y ejecutar
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && stmt !== 'START TRANSACTION' && stmt !== 'COMMIT');

    console.log(`📝 Ejecutando ${statements.length} sentencias SQL...`);

    // Obtener conexión para transacción
    const connection = await pool.getConnection();

    try {
      await connection.query('START TRANSACTION');
      
      for (const statement of statements) {
        if (statement.trim()) {
          console.log(`Ejecutando: ${statement.substring(0, 60)}...`);
          await connection.query(statement);
        }
      }

      // Confirmar transacción
      await connection.query('COMMIT');
      console.log('✅ Migración aplicada exitosamente');

    } catch (error) {
      // Revertir en caso de error
      await connection.query('ROLLBACK');
      throw error;
    } finally {
      connection.release();
    }

    // Verificar que las tablas existen
    console.log('🔍 Verificando tablas creadas...');
    
    const tables = [
      'document_types',
      'blood_groups', 
      'education_levels',
      'marital_statuses',
      'population_groups',
      'disability_types'
    ];

    for (const table of tables) {
      const [rows] = await pool.query(`SELECT COUNT(*) as count FROM ${table}`) as any[];
      const count = rows[0].count;
      console.log(`✓ ${table}: ${count} registros`);
    }

    // Verificar columnas añadidas a patients
    console.log('🔍 Verificando columnas de pacientes...');
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'patients' 
      AND COLUMN_NAME IN (
        'document_type_id', 
        'insurance_affiliation_type',
        'blood_group_id',
        'population_group_id',
        'education_level_id',
        'marital_status_id',
        'estrato',
        'has_disability',
        'disability_type_id'
      )
    `);

    console.log(`✓ Nuevas columnas añadidas: ${(columns as any[]).length}/9`);

    console.log('🎉 Migración completada con éxito!');

  } catch (error) {
    console.error('❌ Error aplicando migración:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  applyMigration();
}

export default applyMigration;
