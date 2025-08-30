module.exports = {
  apps: [{
    name: 'mcp-server-python',
    script: 'main.py',
    interpreter: 'python3',
    cwd: '/home/ubuntu/app/mcp-server-python',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    env: {
      PORT: '8975',
      HOST: '127.0.0.1'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
