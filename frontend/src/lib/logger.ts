/**
 * Sistema de logging condicional para el frontend
 * Solo imprime logs en desarrollo, silencioso en producción
 */

const IS_DEV = import.meta.env.DEV;
const LOG_LEVEL = import.meta.env.VITE_LOG_LEVEL || 'info';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private minLevel: number;

  constructor(level: LogLevel = 'info') {
    this.minLevel = LOG_LEVELS[level] || LOG_LEVELS.info;
  }

  private shouldLog(level: LogLevel): boolean {
    return IS_DEV && LOG_LEVELS[level] >= this.minLevel;
  }

  debug(...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log('[DEBUG]', ...args);
    }
  }

  info(...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log('[INFO]', ...args);
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  }

  error(...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error('[ERROR]', ...args);
    }
  }

  // Siempre logea en producción (para errores críticos)
  critical(...args: any[]): void {
    console.error('[CRITICAL]', ...args);
  }
}

export const logger = new Logger(LOG_LEVEL as LogLevel);
export default logger;
