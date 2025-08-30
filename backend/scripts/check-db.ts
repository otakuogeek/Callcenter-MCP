import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  try {
    const [rows] = await conn.query('SELECT 1 AS ok');
    console.log('DB OK:', rows);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('DB FAIL:', e.message);
  process.exit(1);
});
