/**
 * Configuración centralizada del módulo WhatsApp
 * Todas las variables de entorno se validan aquí al arrancar.
 * @module whatsapp/config
 */

import pino from 'pino';
import type { AIProviderConfig } from '../types';

// ─── Logger compartido del módulo WhatsApp ───────────────────────────────────

const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

export const logger = pino({
  level: isTest ? 'silent' : (process.env.LOG_LEVEL || 'info'),
  name: 'whatsapp',
  transport: (!isTest && process.env.NODE_ENV !== 'production') ? {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' }
  } : undefined
});

// ─── Constantes ──────────────────────────────────────────────────────────────

export const CONVERSATION_TTL_MS       = 30 * 60 * 1000;  // 30 min
export const CACHE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;   // 5 min
export const MAX_CACHE_SIZE            = 500;
export const STATE_TIMEOUT_MS          = 7_200_000;        // 2 horas
export const MAX_STATE_CONTEXTS        = 1000;
export const MAX_RETRIES               = 3;
export const MAX_AI_ITERATIONS         = 5;
export const MAX_CONVERSATION_LENGTH   = parseInt(process.env.WHATSAPP_MAX_CONV_LENGTH || '80', 10);
export const SESSION_TIMEOUT_MS        = parseInt(process.env.WHATSAPP_SESSION_TIMEOUT || '7200000', 10);
export const MAX_HISTORY_MESSAGES      = 20;
export const MAX_AI_CONTEXT_MESSAGES   = 15;

// ─── Feature flags ───────────────────────────────────────────────────────────

export const USE_GROQ        = process.env.WHATSAPP_USE_GROQ?.toLowerCase() === 'true';
export const USE_LANGGRAPH   = process.env.WHATSAPP_USE_LANGGRAPH === 'true';
export const AUTO_REPLY      = process.env.WHATSAPP_AUTO_REPLY !== 'false';
export const BUSINESS_HOURS_ONLY = process.env.WHATSAPP_BUSINESS_HOURS_ONLY === 'true';
export const VOICE_RESPONSES = process.env.WHATSAPP_VOICE_RESPONSES === 'true';

// ─── Configuración de proveedores de IA ──────────────────────────────────────

const GROQ_API_URL    = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY    = process.env.GROQ_API_KEY || '';
const GROQ_MODEL      = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const CHATGPT_API_URL = 'https://api.openai.com/v1/chat/completions';
const CHATGPT_API_KEY = process.env.WHATSAPP_CHATGPT_API_KEY || process.env.OPENAI_API_KEY || '';
const CHATGPT_MODEL   = process.env.CHATGPT_MODEL || 'gpt-4o';

/** Modelo activo (para persistencia de mensajes) */
export const AI_MODEL = USE_GROQ ? GROQ_MODEL : CHATGPT_MODEL;

/** Devuelve la configuración del proveedor de IA activo */
export function getAIProviderConfig(): AIProviderConfig {
  if (USE_GROQ) {
    return {
      apiUrl: GROQ_API_URL,
      apiKey: GROQ_API_KEY,
      model: GROQ_MODEL,
      provider: 'Groq',
      isGPT5: false
    };
  }
  const isGPT5 = CHATGPT_MODEL.startsWith('gpt-5');
  return {
    apiUrl: CHATGPT_API_URL,
    apiKey: CHATGPT_API_KEY,
    model: CHATGPT_MODEL,
    provider: 'ChatGPT',
    isGPT5
  };
}

/** Verifica si hay una API key configurada */
export function isAIConfigured(): boolean {
  return !!getAIProviderConfig().apiKey;
}

// ─── Silent tokens ───────────────────────────────────────────────────────────

export const SILENT_TOKENS = ['[NO_REPLY]', '[SILENCIO]', '[NO_RESPONDER]', '{{NO_REPLY}}', '<<NO_REPLY>>'];

// ─── Sede / contacto ─────────────────────────────────────────────────────────

export const IPS_PHONE = '6076911308';
export const IPS_NAME  = 'Fundación Biosanar IPS';
export const IPS_ADDRESS = 'Cra. 9 #10-29, San Gil';
