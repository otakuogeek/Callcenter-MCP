#!/usr/bin/env ts-node
/**
 * Script de sincronización inicial de llamadas de ElevenLabs
 * Sincroniza todas las llamadas históricas a la base de datos local
 * 
 * Uso: npm run sync:initial [limit]
 * Ejemplo: npm run sync:initial 1000
 */

import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno PRIMERO
dotenv.config({ path: path.join(__dirname, '../.env') });

import { ElevenLabsSync } from '../src/services/elevenLabsSync';

async function runInitialSync() {
  const limit = process.argv[2] ? parseInt(process.argv[2]) : 1000;
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   🔄 SINCRONIZACIÓN INICIAL DE LLAMADAS ELEVENLABS        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`📊 Límite configurado: ${limit} llamadas`);
  console.log(`🕐 Inicio: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);
  console.log('');
  
  try {
    const startTime = Date.now();
    
    const result = await ElevenLabsSync.syncLatestCalls(limit);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                   ✅ RESULTADO                             ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`✅ Llamadas sincronizadas: ${result.synced}`);
    console.log(`❌ Errores: ${result.errors}`);
    console.log(`⏱️  Tiempo total: ${duration} segundos`);
    console.log(`📈 Velocidad: ${(result.synced / parseFloat(duration)).toFixed(2)} llamadas/segundo`);
    console.log('');
    console.log(`🕐 Finalizado: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);
    
    if (result.errors > 0) {
      console.log('');
      console.warn('⚠️  Hubo algunos errores durante la sincronización.');
      console.warn('   Revisa los logs para más detalles.');
      process.exit(1);
    }
    
    process.exit(0);
    
  } catch (error: any) {
    console.error('');
    console.error('╔════════════════════════════════════════════════════════════╗');
    console.error('║                   ❌ ERROR FATAL                          ║');
    console.error('╚════════════════════════════════════════════════════════════╝');
    console.error('');
    console.error(error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

runInitialSync();
