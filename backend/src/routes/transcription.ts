import express, { Request, Response } from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Configurar multer para manejar archivos de audio
const upload = multer({
  dest: '/tmp/',
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB límite
  },
  fileFilter: (req, file, cb) => {
    // Aceptar formatos de audio comunes
    const allowedMimes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/webm',
      'audio/ogg',
      'audio/m4a',
      'audio/x-m4a',
      'audio/mp4',
      'audio/flac',
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de audio no soportado. Use MP3, WAV, WEBM, OGG, M4A o FLAC.'));
    }
  },
});

// Middleware de autenticación (reutilizar el existente)
const authenticateToken = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Token de autenticación requerido' 
    });
  }

  const jwt = require('jsonwebtoken');
  jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey_at_least_16_characters_for_security', (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        error: 'Token inválido o expirado' 
      });
    }
    (req as any).user = user;
    next();
  });
};

/**
 * POST /api/transcription/transcribe
 * Transcribe audio a texto usando Whisper de OpenAI
 */
router.post('/transcribe', authenticateToken, upload.single('audio'), async (req: Request, res: Response) => {
  let filePath: string | undefined;

  try {
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No se proporcionó archivo de audio',
      });
    }

    filePath = file.path;

    // Verificar que la API key de OpenAI esté configurada
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      // Limpiar archivo temporal
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      return res.status(500).json({
        success: false,
        error: 'API key de OpenAI no configurada. Por favor, configure OPENAI_API_KEY en las variables de entorno.',
      });
    }

    // Inicializar cliente de OpenAI
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Leer el archivo de audio
    const audioBuffer = fs.readFileSync(filePath);
    
    // Crear un objeto File-like para OpenAI
    const audioFile = new File(
      [audioBuffer], 
      file.originalname || 'audio.webm',
      { type: file.mimetype }
    );

    // Transcribir usando Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'es', // Español
      response_format: 'json',
    });

    // Limpiar archivo temporal
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Devolver transcripción
    return res.json({
      success: true,
      data: {
        text: transcription.text,
        duration: file.size, // Aproximado
      },
    });

  } catch (error: any) {
    console.error('Error en transcripción:', error);

    // Limpiar archivo temporal en caso de error
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkError) {
        console.error('Error al eliminar archivo temporal:', unlinkError);
      }
    }

    // Manejar errores específicos de OpenAI
    if (error.response) {
      return res.status(error.response.status || 500).json({
        success: false,
        error: error.response.data?.error?.message || 'Error en la API de OpenAI',
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || 'Error al transcribir audio',
    });
  }
});

/**
 * GET /api/transcription/status
 * Verificar si el servicio de transcripción está disponible
 */
router.get('/status', authenticateToken, (req: Request, res: Response) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const isConfigured = apiKey && apiKey !== 'your_openai_api_key_here';

  res.json({
    success: true,
    data: {
      available: isConfigured,
      message: isConfigured 
        ? 'Servicio de transcripción disponible'
        : 'API key de OpenAI no configurada',
    },
  });
});

export default router;
