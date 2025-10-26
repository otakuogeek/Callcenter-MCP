/**
 * Script para sincronizar todas las disponibilidades
 * Ejecutar: node dist/scripts/syncAvailabilities.js
 */

import { syncAllAvailabilities } from '../utils/availabilitySync';

async function main() {
  console.log('🔄 Iniciando sincronización de disponibilidades...\n');
  
  try {
    const result = await syncAllAvailabilities();
    
    console.log('\n✅ Sincronización completada:');
    console.log(`   - Exitosas: ${result.synced}`);
    console.log(`   - Errores: ${result.errors}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error en la sincronización:', error);
    process.exit(1);
  }
}

main();
