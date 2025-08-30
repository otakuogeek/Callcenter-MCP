"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.pool = void 0;
exports.testDbConnection = testDbConnection;
exports.executeQuery = executeQuery;
exports.getDbStats = getDbStats;
exports.healthCheck = healthCheck;
const promise_1 = require("mysql2/promise");
// Database configuration using environment variables
const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'biosanar_user',
    password: process.env.DB_PASSWORD || '/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU',
    database: process.env.DB_NAME || 'biosanar',
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
    multipleStatements: false,
    timezone: '+00:00'
};
// Create connection pool
exports.pool = (0, promise_1.createPool)(dbConfig);
// Legacy export for compatibility
exports.db = exports.pool;
// Test database connection
async function testDbConnection() {
    try {
        const connection = await exports.pool.getConnection();
        const [rows] = await connection.execute('SELECT 1 as test, NOW() as timestamp');
        connection.release();
        console.log('✅ MySQL connection successful:', rows);
        return true;
    }
    catch (error) {
        console.error('❌ MySQL connection failed:', error);
        return false;
    }
}
// Utility function to execute queries safely
async function executeQuery(query, params = []) {
    try {
        const [rows] = await exports.pool.execute(query, params);
        return rows;
    }
    catch (error) {
        console.error('Query execution failed:', { query, params, error });
        throw error;
    }
}
// Get database stats
async function getDbStats() {
    try {
        const [stats] = await exports.pool.execute(`
      SHOW STATUS WHERE 
      Variable_name IN ('Connections', 'Uptime', 'Threads_connected', 'Queries')
    `);
        return stats;
    }
    catch (error) {
        console.error('Failed to get database stats:', error);
        return [];
    }
}
// Health check with detailed info
async function healthCheck() {
    try {
        const isConnected = await testDbConnection();
        const stats = await getDbStats();
        return {
            connected: isConnected,
            stats,
            config: {
                host: dbConfig.host,
                port: dbConfig.port,
                database: dbConfig.database,
                user: dbConfig.user
            }
        };
    }
    catch (error) {
        return {
            connected: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
