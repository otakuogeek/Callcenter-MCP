module.exports = {
  apps: [
    {
      name: 'biosanar-monitor',
      script: 'src/server.js',
      cwd: '/home/ubuntu/app/cluster-monitor',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '150M',
      env: {
        NODE_ENV: 'production',
        PORT: 5055
      },
      out_file: 'logs/monitor-out.log',
      error_file: 'logs/monitor-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true
    }
  ]
};
