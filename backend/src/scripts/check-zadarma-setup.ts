#!/usr/bin/env ts-node

import { zadarmaCallbackService } from '../services/zadarma-callback.service';

async function checkZadarmaSetup() {
  console.log('🔍 VERIFICANDO CONFIGURACIÓN DE ZADARMA\n');
  console.log('═══════════════════════════════════════════════════\n');
  
  try {
    // 1. Verificar balance
    console.log('1️⃣  Verificando balance de la cuenta...');
    try {
      const balance = await zadarmaCallbackService.getAccountInfo();
      console.log('✅ Balance:', JSON.stringify(balance, null, 2));
    } catch (error: any) {
      console.log('❌ Error verificando balance:', error.response?.data || error.message);
    }
    
    console.log('\n');
    
    // 2. Listar números virtuales
    console.log('2️⃣  Listando números virtuales disponibles...');
    try {
      const numbers = await zadarmaCallbackService.getVirtualNumbers();
      console.log('✅ Números virtuales:', JSON.stringify(numbers, null, 2));
      
      if (numbers.numbers && numbers.numbers.length > 0) {
        console.log('\n📱 Números disponibles para hacer llamadas:');
        numbers.numbers.forEach((num: any) => {
          console.log(`   • ${num.number} (${num.country})`);
        });
      } else {
        console.log('\n⚠️  No hay números virtuales configurados.');
        console.log('   Para hacer llamadas salientes necesitas:');
        console.log('   • Comprar un número virtual en: https://my.zadarma.com/numbers/');
        console.log('   • O configurar un número SIP en: https://my.zadarma.com/sip/');
      }
    } catch (error: any) {
      console.log('❌ Error listando números:', error.response?.data || error.message);
    }
    
    console.log('\n');
    console.log('═══════════════════════════════════════════════════');
    console.log('\n💡 PRÓXIMOS PASOS:\n');
    console.log('Si ves errores de autenticación (401):');
    console.log('1. Ir a https://my.zadarma.com/api/');
    console.log('2. Verificar/regenerar tus claves API');
    console.log('3. Actualizar el archivo .env con las credenciales correctas\n');
    console.log('Si no tienes números virtuales:');
    console.log('1. Comprar número en https://my.zadarma.com/numbers/');
    console.log('2. Actualizar ZADARMA_VIRTUAL_NUMBER en .env');
    console.log('3. Ejecutar una llamada de prueba\n');
    
  } catch (error: any) {
    console.error('❌ Error general:', error.message);
  }
}

// Ejecutar verificación
checkZadarmaSetup();
