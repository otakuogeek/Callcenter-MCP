#!/usr/bin/env ts-node-dev
/**
 * Script para generar contraseñas iniciales para doctores
 * Ejecutar: npm run doctors:init-passwords
 */

import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import pool from '../src/db/pool';
import { RowDataPacket } from 'mysql2';

interface Doctor extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  password_hash: string | null;
}

async function generatePassword(length: number = 12): Promise<string> {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  
  const allChars = uppercase + lowercase + numbers + symbols;
  let password = '';
  
  // Asegurar que tenga al menos uno de cada tipo
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Rellenar el resto
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Mezclar caracteres
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

async function initDoctorPasswords() {
  try {
    console.log('🔐 Inicializando contraseñas para doctores...\n');

    // Obtener doctores sin contraseña
    const [doctors] = await pool.query<Doctor[]>(
      'SELECT id, name, email, password_hash FROM doctors WHERE active = 1'
    );

    if (doctors.length === 0) {
      console.log('✅ No hay doctores activos en el sistema');
      process.exit(0);
    }

    console.log(`📋 Se encontraron ${doctors.length} doctores activos\n`);
    console.log('╔════════════════════════════════════════════════════════════════════╗');
    console.log('║  CREDENCIALES DE ACCESO PARA DOCTORES                             ║');
    console.log('║  ⚠️  GUARDE ESTA INFORMACIÓN EN UN LUGAR SEGURO                    ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');

    const credentials: Array<{name: string, email: string, password: string}> = [];

    for (const doctor of doctors) {
      // Si ya tiene contraseña, omitir
      if (doctor.password_hash) {
        console.log(`⏭️  ${doctor.name} - Ya tiene contraseña configurada`);
        continue;
      }

      // Generar contraseña
      const password = await generatePassword();
      const hashedPassword = await bcrypt.hash(password, 10);

      // Actualizar en la base de datos
      await pool.query(
        'UPDATE doctors SET password_hash = ?, updated_at = NOW() WHERE id = ?',
        [hashedPassword, doctor.id]
      );

      credentials.push({
        name: doctor.name,
        email: doctor.email,
        password: password
      });

      console.log(`✅ ${doctor.name}`);
      console.log(`   Email: ${doctor.email}`);
      console.log(`   Contraseña: ${password}\n`);
    }

    console.log('\n╔════════════════════════════════════════════════════════════════════╗');
    console.log('║  RESUMEN DE CREDENCIALES                                          ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝\n');

    credentials.forEach((cred, index) => {
      console.log(`${index + 1}. ${cred.name}`);
      console.log(`   👤 Email: ${cred.email}`);
      console.log(`   🔑 Contraseña: ${cred.password}`);
      console.log(`   🌐 Login: https://biosanarcall.site/doctor-login\n`);
    });

    console.log('\n📝 NOTAS IMPORTANTES:');
    console.log('   • Cada doctor debe cambiar su contraseña en el primer login');
    console.log('   • Las contraseñas se pueden resetear desde el panel de administración');
    console.log('   • Después de 5 intentos fallidos, la cuenta se bloqueará por 30 minutos');
    console.log('   • Las sesiones expiran después de 2 días de inactividad\n');

    console.log('✅ Proceso completado exitosamente\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al inicializar contraseñas:', error);
    process.exit(1);
  }
}

initDoctorPasswords();
