// ==============================================
// RUTAS DE SESIONES
// ==============================================

import express from 'express';
import { SessionService } from '../services/sessionService';
import { requireAuth, requireRole } from '../middleware/auth';

const router = express.Router();

// Obtener sesiones del usuario actual
router.get('/my-sessions', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const sessions = await SessionService.getUserSessions(userId);

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('Error getting user sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener sesiones'
    });
  }
});

// Terminar una sesión específica
router.delete('/:sessionId', requireAuth, async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const userId = req.user!.id;
    
    // Verificar que la sesión pertenece al usuario o que es admin
    const isAdmin = req.user!.role === 'admin';
    
    await SessionService.endSession(sessionId, userId, isAdmin);

    res.json({
      success: true,
      message: 'Sesión terminada exitosamente'
    });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({
      success: false,
      message: 'Error al terminar sesión'
    });
  }
});

// Terminar todas las sesiones del usuario actual
router.delete('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const excludeCurrentSession = req.query.exclude_current === 'true';
    const currentSessionId = excludeCurrentSession ? req.sessionId : undefined;

    await SessionService.endAllUserSessions(userId, currentSessionId);

    res.json({
      success: true,
      message: 'Todas las sesiones han sido terminadas'
    });
  } catch (error) {
    console.error('Error ending all sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error al terminar sesiones'
    });
  }
});

// Obtener sesiones activas (solo admin)
router.get('/active', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const sessions = await SessionService.getActiveSessions();

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('Error getting active sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener sesiones activas'
    });
  }
});

// Forzar cierre de sesión de un usuario (solo admin)
router.delete('/user/:userId', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    await SessionService.endAllUserSessions(userId);

    res.json({
      success: true,
      message: 'Todas las sesiones del usuario han sido terminadas'
    });
  } catch (error) {
    console.error('Error ending user sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error al terminar sesiones del usuario'
    });
  }
});

export default router;
