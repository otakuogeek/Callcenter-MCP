"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const promise_1 = __importDefault(require("mysql2/promise"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
async function main() {
    const conn = await promise_1.default.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
    });
    try {
        const email = 'bastidasdaveusa@gmail.com';
        const name = 'Administrador';
        const password = 'Ene*2008';
        const role = 'admin';
        const status = 'Activo';
        const [existing] = await conn.query("SELECT id FROM users WHERE email = ?", [email]);
        // @ts-ignore
        if (existing.length) {
            console.log('Usuario ya existe, no se crea:', email);
            return;
        }
        const hash = await bcryptjs_1.default.hash(password, 10);
        await conn.query(`INSERT INTO users (name, email, role, status, password_hash) VALUES (?, ?, ?, ?, ?)`, [name, email, role, status, hash]);
        console.log('Usuario admin creado:', email);
    }
    finally {
        await conn.end();
    }
}
main().catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
});
