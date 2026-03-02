import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  // Pool sizing: connectionLimit = expected_concurrent_queries + buffer
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 25,
  // Max requests queued when all connections busy (avoid unbounded queue)
  queueLimit: Number(process.env.DB_QUEUE_LIMIT) || 50,
  // Timeout waiting for a free connection (ms)
  waitForConnections: true,
  // Timeout for establishing a new connection (ms)
  connectTimeout: 30000,
  charset: 'utf8mb4',
  timezone: '+00:00',
  namedPlaceholders: true,
  // Enable keep-alive to prevent MariaDB closing idle connections
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000,
  // Configuración de SSL si está habilitada
  ...(process.env.DB_SSL === 'true' && {
    ssl: {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
    }
  }),
});

export default pool;
