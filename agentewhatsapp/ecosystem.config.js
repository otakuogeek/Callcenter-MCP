module.exports = {
  apps: [
    {
      name: 'biosanarcall-whatsapp-agent',
      script: 'dist/server.js',
      cwd: '/home/ubuntu/app/agentewhatsapp',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/home/ubuntu/app/agentewhatsapp/logs/pm2-error.log',
      out_file: '/home/ubuntu/app/agentewhatsapp/logs/pm2-out.log',
      log_file: '/home/ubuntu/app/agentewhatsapp/logs/pm2-combined.log',
      merge_logs: true,
      time: true,
      kill_timeout: 5000,
      listen_timeout: 3000,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000
    }
  ]
};