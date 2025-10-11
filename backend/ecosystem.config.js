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
      },
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      merge_logs: true,
      max_memory_restart: '300M',
    },
  ],
};
