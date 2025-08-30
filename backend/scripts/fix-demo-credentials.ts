import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  try {
    const email = 'demo@demo.com';
    const password = 'Ene*2008';
    
    // Verificar si el usuario existe
    const [existing] = await conn.query("SELECT id, email, password_hash FROM users WHERE email = ?", [email]);
    const users = existing as any[];
    
    if (!users.length) {
      console.log('❌ Usuario demo@demo.com no encontrado');
      return;
    }

    const user = users[0];
    console.log('✅ Usuario encontrado:', user.email);

    // Verificar contraseña actual
    try {
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (isValid) {
        console.log('✅ La contraseña "Ene*2008" ya es correcta');
        return;
      }
    } catch (err) {
      console.log('❌ Error verificando contraseña actual:', err);
    }

    // Actualizar contraseña
    const newHash = await bcrypt.hash(password, 10);
    await conn.query(
      "UPDATE users SET password_hash = ? WHERE email = ?",
      [newHash, email]
    );

    console.log('✅ Contraseña actualizada para demo@demo.com');
    console.log('📧 Email: demo@demo.com');
    console.log('🔑 Password: Ene*2008');

    // Verificar que funciona
    const isValid = await bcrypt.compare(password, newHash);
    console.log('✅ Verificación final:', isValid ? 'CORRECTA' : 'FALLO');

  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
