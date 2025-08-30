"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const promise_1 = __importDefault(require("mysql2/promise"));
async function main() {
    const sqlPath = path_1.default.resolve(__dirname, '../../docs/mysql/schema.sql');
    if (!fs_1.default.existsSync(sqlPath)) {
        console.error('No se encontró docs/mysql/schema.sql');
        process.exit(1);
    }
    const sql = fs_1.default.readFileSync(sqlPath, 'utf8');
    const dbName = process.env.DB_NAME;
    if (!dbName)
        throw new Error('DB_NAME no definido');
    // Primero conectar sin BD para crearla si no existe
    const rootConn = await promise_1.default.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        multipleStatements: true,
    });
    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4`);
    await rootConn.end();
    // Conectar a la BD y aplicar esquema
    const conn = await promise_1.default.createConnection({
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
        console.log('Esquema aplicado correctamente.');
    }
    finally {
        await conn.end();
    }
}
main().catch((e) => {
    console.error('Error inicializando BD:', e);
    process.exit(1);
});
