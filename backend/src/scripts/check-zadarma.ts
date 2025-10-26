import zadarmaRealCallService from '../services/zadarma-real-call.service';

async function main() {
  console.log('🔍 DIAGNÓSTICO DE ZADARMA\n');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // 1. Verificar balance
    console.log('1️⃣  Verificando balance...');
    const balance = await zadarmaRealCallService.getBalance();
    console.log('✅ Balance verificado\n');

    // 2. Obtener información de cuenta
    console.log('2️⃣  Obteniendo información de cuenta...');
    const accountInfo = await zadarmaRealCallService.getAccountInfo();
    console.log('✅ Información obtenida\n');

    // 3. Obtener números SIP
    console.log('3️⃣  Verificando números SIP...');
    const sipNumbers = await zadarmaRealCallService.getSipNumbers();
    console.log('');

    console.log('═══════════════════════════════════════════════════\n');
    console.log('📋 RESUMEN DE CONFIGURACIÓN:\n');
    
    if (sipNumbers && sipNumbers.sips && sipNumbers.sips.length > 0) {
      console.log('✅ Tienes números SIP configurados:');
      sipNumbers.sips.forEach((sip: any, index: number) => {
        console.log(`   ${index + 1}. SIP: ${sip.id} - ${sip.number || 'Sin número'}`);
      });
      console.log('');
      console.log('✅ ¡Puedes hacer llamadas salientes!');
      console.log('');
      console.log('Para hacer la llamada al +584264377421:');
      console.log(`   Usa el SIP: ${sipNumbers.sips[0].id}`);
    } else {
      console.log('⚠️  No hay números SIP configurados');
      console.log('');
      console.log('Para hacer llamadas necesitas:');
      console.log('1. Ir a https://my.zadarma.com/sip/');
      console.log('2. Crear un nuevo número SIP');
      console.log('3. O comprar un número virtual en https://my.zadarma.com/numbers/');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
