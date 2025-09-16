module.exports = {
  apps: [{
    name: 'voice-call-service',
    script: 'dist/server.js',
    cwd: '/home/ubuntu/app/voice-call-service',
    instances: 1,
    exec_mode: 'fork',
    
    // Variables de entorno
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      DB_HOST: '127.0.0.1',
      DB_USER: 'biosanar_user',
      DB_PASS: '/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU',
      DB_NAME: 'biosanar',
      OPENAI_API_KEY: 'sk-test-placeholder-configure-with-real-key',
      ELEVENLABS_API_KEY: 'sk_e809c1b338ddc2faede9c910df68d1a35da34fa994b088dc',
      ELEVENLABS_VOICE_ID: 'pNInz6obpgDQGcFmaJgB',
      ELEVENLABS_WEBHOOK_SECRET: 'wsec_10242422f757a3433ce3983064bd5d44f74ec516cc921e972ed1561cb896bdfa',
      // Asistente de voz
      VOICE_ASSISTANT_ENABLED: 'true',
      ELEVENLABS_AGENT_ID: 'your_elevenlabs_agent_id', // Configurar en ElevenLabs
      // SIP Directo - Configuración Real de Zadarma
      SIP_ENABLED: 'true',
      SIP_AUTO_ANSWER: 'true',
      SIP_TRANSCRIPTION: 'true',
      SIP_GREETING: 'Hola, te has comunicado con Biosanar Call, tu asistente médico virtual. ¿En qué puedo ayudarte?',
      SIP_SERVER: 'pbx.zadarma.com',
      SIP_PORT: '5060',
      SIP_USERNAME: '524494-100',
      SIP_PASSWORD: 'Ub4jdrtJi24',
      SIP_REALM: 'pbx.zadarma.com',
      SIP_EXTENSION: '100',
      SIP_AUTO_START: 'true',
      ZADARMA_SIP_USERNAME: '2eeea07f46fcf59e3a10',
      ZADARMA_SIP_PASSWORD: 'c87065c063195ad4b3da',
      ZADARMA_SIP_REALM: 'zadarma.com',
      SIP_AUTO_START: 'true',
      // Zadarma - Credenciales corregidas
      ZADARMA_KEY: '2eeea07f46fcf59e3a10',
      ZADARMA_SECRET: 'c87065c063195ad4b3da',
      ZADARMA_BASE_URL: 'https://api.zadarma.com/v1',
      BACKEND_BASE_URL: 'http://localhost:4000/api',
      BACKEND_JWT_TOKEN: 'your_backend_jwt_token',
      WEBHOOK_BASE_URL: 'https://biosanarcall.site/webhook',
      WEBHOOK_SECRET: 'your_webhook_secret'
    },
    
    // Configuración de recursos
    max_memory_restart: '400M',
    min_uptime: '10s',
    max_restarts: 10,
    
    // Logs
    log_file: './logs/voice-service.log',
    out_file: './logs/voice-service-out.log',
    error_file: './logs/voice-service-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Configuración de reinicio
    restart_delay: 4000,
    autorestart: true,
    watch: false,
    
    // Configuración específica para servicio de voz
    kill_timeout: 5000,
    listen_timeout: 8000,
    
    // Variables de entorno específicas
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
      
      // Base de datos
      DB_HOST: '127.0.0.1',
      DB_USER: 'biosanar_user',
      DB_PASSWORD: '/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU',
      DB_NAME: 'biosanar',
      
      // APIs externas
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
      ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB',
      
      // Zadarma
      ZADARMA_API_KEY: process.env.ZADARMA_API_KEY || '',
      ZADARMA_API_SECRET: process.env.ZADARMA_API_SECRET || '',
      
      // Backend integration
      BACKEND_BASE_URL: 'http://127.0.0.1:4000/api',
      BACKEND_TOKEN: process.env.BACKEND_TOKEN || '',
      
      // Configuración del servicio
      BASE_URL: 'https://biosanarcall.site',
      CORS_ORIGINS: 'https://biosanarcall.site,http://localhost:3000',
      
      // Configuración de archivos
      TEMP_DIR: '/tmp/voice-service',
      AUDIO_OUTPUT_DIR: './audio-output'
    }
  }]
};