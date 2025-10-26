#!/usr/bin/env node

const { exec } = require('child_process');
const path = require('path');

/**
 * Script para hacer llamada FÍSICA REAL usando el PHP verificado de Zadarma
 */

const phoneNumber = process.argv[2] || '+584264377421';
const message = process.argv[3] || 'Hola, buenos días. Este es un mensaje de Fundación Biosanar IPS.';

console.log('╔═══════════════════════════════════════════════════════════════════╗');
console.log('║                                                                   ║');
console.log('║     📞 LLAMADA FÍSICA REAL - SCRIPT NODE.JS                       ║');
console.log('║                                                                   ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

console.log(`Número destino: ${phoneNumber}`);
console.log(`Mensaje: ${message.substring(0, 50)}...`);
console.log('');
console.log('═══════════════════════════════════════════════════════════════════\n');

const phpScript = path.join(__dirname, '../../zadarma-oficial/call_with_sip.php');

console.log('📞 Ejecutando llamada con Zadarma (PHP verificado)...\n');

exec(`php ${phpScript}`, (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    return;
  }
  
  if (stderr) {
    console.error(`⚠️  Advertencia: ${stderr}`);
  }
  
  console.log(stdout);
  
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('\n✅ PROCESO COMPLETADO\n');
  console.log('Si la respuesta fue "success":');
  console.log('  • El SIP 895480 está recibiendo la llamada');
  console.log('  • Cuando contestes, se conectará automáticamente');
  console.log('  • El número +584264377421 comenzará a sonar\n');
  console.log('═══════════════════════════════════════════════════════════════════\n');
});
