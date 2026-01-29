const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno desde .env
dotenv.config({ path: path.join(__dirname, '.env') });

module.exports = {
  apps: [
    {
      name: 'cita-central-backend',
      cwd: __dirname,
      script: 'dist/server.js',
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
        GROQ_API_KEY: process.env.GROQ_API_KEY,
        REDIS_HOST: process.env.REDIS_HOST,
        REDIS_PORT: process.env.REDIS_PORT,
        REDIS_DB: process.env.REDIS_DB,
        // WhatsApp AI Configuration - Selector de proveedor
        // WHATSAPP_USE_GROQ=true -> Groq | WHATSAPP_USE_GROQ=false -> ChatGPT
        WHATSAPP_USE_GROQ: process.env.WHATSAPP_USE_GROQ !== undefined ? process.env.WHATSAPP_USE_GROQ : 'false',
        GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        WHATSAPP_CHATGPT_API_KEY: process.env.WHATSAPP_CHATGPT_API_KEY,
        CHATGPT_MODEL: process.env.CHATGPT_MODEL || 'gpt-4o-mini',
        WHATSAPP_USE_LANGGRAPH: process.env.WHATSAPP_USE_LANGGRAPH || 'true',
        WHATSAPP_AUTO_REPLY: process.env.WHATSAPP_AUTO_REPLY,
        WHATSAPP_BUSINESS_HOURS_ONLY: process.env.WHATSAPP_BUSINESS_HOURS_ONLY,
        WHATSAPP_BUSINESS_HOURS_START: process.env.WHATSAPP_BUSINESS_HOURS_START,
        WHATSAPP_BUSINESS_HOURS_END: process.env.WHATSAPP_BUSINESS_HOURS_END,
        // Voice Messages Configuration (Whisper + TTS)
        WHATSAPP_VOICE_RESPONSES: process.env.WHATSAPP_VOICE_RESPONSES || 'true',
        // TTS Provider: elevenlabs (default), gpt-audio, openai
        TTS_PROVIDER: process.env.TTS_PROVIDER || 'elevenlabs',
        // ElevenLabs Configuration
        ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
        ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID || 'b2htR0pMe28pYwCY9gnP', // Sofía
        ELEVENLABS_MODEL: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
        // OpenAI TTS Fallback
        TTS_MODEL: process.env.TTS_MODEL || 'tts-1',
        TTS_VOICE: process.env.TTS_VOICE || 'nova',
        // GPT Audio Model (Chat + TTS Integrado) - Alternativa
        USE_GPT_AUDIO_MODEL: process.env.USE_GPT_AUDIO_MODEL || 'false',
        GPT_AUDIO_MODEL: process.env.GPT_AUDIO_MODEL || 'gpt-audio-mini-2025-12-15',
        GPT_AUDIO_VOICE: process.env.GPT_AUDIO_VOICE || 'nova',
        GPT_AUDIO_FORMAT: process.env.GPT_AUDIO_FORMAT || 'mp3',
      },
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      merge_logs: true,
      max_memory_restart: '1G',
    },
  ],
};
