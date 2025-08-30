// ==============================================
// RUTAS DE DOCUMENTOS DE PACIENTES
// ==============================================

import express from 'express';
import { DocumentService } from '../services/documentService';
import { requireAuth, requireRole } from '../middleware/auth';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

// Configurar multer para subida de archivos
const upload = DocumentService.getMulterConfig();

// Subir documento
router.post('/upload', requireAuth, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se ha proporcionado archivo'
      });
    }

    const { patient_id, document_type, appointment_id, notes } = req.body;
    const userId = (req as any).user.id;

    if (!patient_id || !document_type) {
      return res.status(400).json({
        success: false,
        message: 'patient_id y document_type son requeridos'
      });
    }

    const documentId = await DocumentService.uploadDocument(
      parseInt(patient_id),
      req.file,
      document_type,
      appointment_id ? parseInt(appointment_id) : undefined,
      userId,
      notes
    );

    res.status(201).json({
      success: true,
      data: { id: documentId },
      message: 'Documento subido exitosamente'
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir documento'
    });
  }
});

// Obtener documentos de un paciente
router.get('/patient/:patientId', requireAuth, async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const appointmentId = req.query.appointment_id ? parseInt(req.query.appointment_id as string) : undefined;
    const documentType = req.query.document_type as string;

    const documents = await DocumentService.getPatientDocuments(
      patientId,
      appointmentId,
      documentType
    );

    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    console.error('Error getting patient documents:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener documentos del paciente'
    });
  }
});

// Descargar documento
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const document = await DocumentService.getDocument(documentId);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado'
      });
    }

    // Verificar que el archivo existe
    try {
      await fs.access(document.file_path);
    } catch {
      return res.status(404).json({
        success: false,
        message: 'Archivo no encontrado en el sistema'
      });
    }

    // Configurar headers para descarga
    res.setHeader('Content-Disposition', `attachment; filename="${document.file_name}"`);
    res.setHeader('Content-Type', document.mime_type);

    // Enviar archivo
    res.sendFile(path.resolve(document.file_path));
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({
      success: false,
      message: 'Error al descargar documento'
    });
  }
});

// Ver documento (inline en navegador)
router.get('/:id/view', requireAuth, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const document = await DocumentService.getDocument(documentId);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado'
      });
    }

    // Verificar que el archivo existe
    try {
      await fs.access(document.file_path);
    } catch {
      return res.status(404).json({
        success: false,
        message: 'Archivo no encontrado en el sistema'
      });
    }

    // Configurar headers para visualización
    res.setHeader('Content-Type', document.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${document.file_name}"`);

    // Enviar archivo
    res.sendFile(path.resolve(document.file_path));
  } catch (error) {
    console.error('Error viewing document:', error);
    res.status(500).json({
      success: false,
      message: 'Error al visualizar documento'
    });
  }
});

// Actualizar notas del documento
router.patch('/:id/notes', requireAuth, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const { notes } = req.body;

    if (notes === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Campo notes es requerido'
      });
    }

    const success = await DocumentService.updateDocumentNotes(documentId, notes);

    if (success) {
      res.json({
        success: true,
        message: 'Notas actualizadas exitosamente'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Documento no encontrado'
      });
    }
  } catch (error) {
    console.error('Error updating document notes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar notas del documento'
    });
  }
});

// Eliminar documento (solo admin/supervisor)
router.delete('/:id', requireAuth, requireRole(['admin', 'supervisor']), async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const success = await DocumentService.deleteDocument(documentId);

    if (success) {
      res.json({
        success: true,
        message: 'Documento eliminado exitosamente'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Documento no encontrado'
      });
    }
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar documento'
    });
  }
});

// Obtener estadísticas de documentos (solo admin)
router.get('/stats', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const stats = await DocumentService.getDocumentStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting document stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas de documentos'
    });
  }
});

export default router;
