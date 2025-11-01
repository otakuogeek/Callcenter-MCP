const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno desde .env
dotenv.config({ path: path.join(__dirname, '.env') });

module.exports = {
  apps: [
    {
      name: 'cita-central-backend',
      cwd: __dirname,
      script: 'dist/src/server.js',
      exec_mode: 'fork',
      instances: 1,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 4000,
        HOST: process.env.HOST || '0.0.0.0',
        // CORS: permitir apex y www por defecto (se puede sobreescribir con env real)
        CORS_ORIGINS: process.env.CORS_ORIGINS || 'https://biosanarcall.site,https://www.biosanarcall.site',
        // Todas las variables de entorno del .env
        DB_HOST: process.env.DB_HOST,
        DB_PORT: process.env.DB_PORT,
        DB_USER: process.env.DB_USER,
        DB_PASS: process.env.DB_PASS,
        DB_NAME: process.env.DB_NAME,
        JWT_SECRET: process.env.JWT_SECRET,
        JWT_EXPIRES: process.env.JWT_EXPIRES,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        REDIS_HOST: process.env.REDIS_HOST,
        REDIS_PORT: process.env.REDIS_PORT,
        REDIS_DB: process.env.REDIS_DB,
      },
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      merge_logs: true,
      max_memory_restart: '300M',
    },
  ],
};
