import winston from 'winston';

export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;

  private constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.prettyPrint()
      ),
      defaultMeta: { 
        service: 'biosanarcall-whatsapp-agent',
        version: '1.0.0'
      },
      transports: [
        // Archivo para errores
        new winston.transports.File({ 
          filename: 'logs/error.log', 
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          tailable: true
        }),
        // Archivo para todos los logs
        new winston.transports.File({ 
          filename: 'logs/combined.log',
          maxsize: 5242880, // 5MB
          maxFiles: 10,
          tailable: true
        }),
        // Consola para desarrollo
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              let metaStr = '';
              if (Object.keys(meta).length > 0) {
                metaStr = '\n' + JSON.stringify(meta, null, 2);
              }
              return `${timestamp} [${level}]: ${message}${metaStr}`;
            })
          )
        })
      ]
    });

    // Crear directorio de logs si no existe
    const fs = require('fs');
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs');
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  public error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  public warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  public debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  public verbose(message: string, meta?: any): void {
    this.logger.verbose(message, meta);
  }

  public silly(message: string, meta?: any): void {
    this.logger.silly(message, meta);
  }

  // Métodos específicos para el contexto médico
  public medicalInfo(message: string, patientId?: number, sessionId?: string, meta?: any): void {
    this.logger.info(`[MEDICAL] ${message}`, {
      patientId,
      sessionId,
      ...meta
    });
  }

  public emergency(message: string, patientId?: number, sessionId?: string, meta?: any): void {
    this.logger.error(`[EMERGENCY] ${message}`, {
      patientId,
      sessionId,
      emergency: true,
      ...meta
    });
  }

  public appointment(message: string, appointmentId?: number, patientId?: number, meta?: any): void {
    this.logger.info(`[APPOINTMENT] ${message}`, {
      appointmentId,
      patientId,
      ...meta
    });
  }

  public whatsapp(message: string, phoneNumber?: string, messageId?: string, meta?: any): void {
    this.logger.info(`[WHATSAPP] ${message}`, {
      phoneNumber,
      messageId,
      ...meta
    });
  }

  public mcp(message: string, tool?: string, sessionId?: string, meta?: any): void {
    this.logger.debug(`[MCP] ${message}`, {
      tool,
      sessionId,
      ...meta
    });
  }

  public ai(message: string, model?: string, tokens?: number, meta?: any): void {
    this.logger.debug(`[AI] ${message}`, {
      model,
      tokens,
      ...meta
    });
  }
}