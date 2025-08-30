import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

async function main() {
  const dbName = process.env.DB_NAME as string;
  if (!dbName) throw new Error('DB_NAME no definido');

  // Permitir credenciales de administrador opcionales para crear la BD
  const adminUser = process.env.DB_ADMIN_USER || process.env.DB_USER;
  const adminPass = process.env.DB_ADMIN_PASS || process.env.DB_PASS;

  // Crear BD si no existe (si el usuario tiene privilegios)
  try {
    const rootConn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      user: adminUser,
      password: adminPass,
      multipleStatements: true,
    });
    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4`);
    await rootConn.end();
  } catch (e) {
    console.warn('Aviso: no se pudo crear la base de datos (falta privilegio). Continuando...');
  }

  // Cargar esquema si existe
  const candidates = [
    path.resolve(__dirname, '../../docs/mysql/schema.sql'),
    path.resolve(__dirname, '../../schema.sql'),
  ];
  const sqlPath = candidates.find((p) => fs.existsSync(p));
  if (!sqlPath) {
    console.log('No se encontró schema.sql; nada que aplicar.');
    return;
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Conectar a la BD y aplicar esquema
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: dbName,
    multipleStatements: true,
  });
  try {
    await conn.query('SET NAMES utf8mb4');
    await conn.query(sql);
    console.log('Esquema aplicado correctamente desde', sqlPath);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('Error inicializando BD:', e);
  process.exit(1);
});
