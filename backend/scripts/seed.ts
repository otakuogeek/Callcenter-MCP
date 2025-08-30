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
    const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
    const name = process.env.SEED_ADMIN_NAME || 'Administrador';
    const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
    const role = process.env.SEED_ADMIN_ROLE || 'admin';
    const status = process.env.SEED_ADMIN_STATUS || 'Activo';

    const [existing] = await conn.query("SELECT id FROM users WHERE email = ?", [email]);
    // @ts-ignore
    if (existing.length) {
      console.log('Usuario ya existe, no se crea:', email);
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    await conn.query(
      `INSERT INTO users (name, email, role, status, password_hash) VALUES (?, ?, ?, ?, ?)`,
      [name, email, role, status, hash]
    );
    console.log('Usuario admin creado:', email);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('Error en seed:', e);
  process.exit(1);
});
