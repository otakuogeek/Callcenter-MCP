// ==============================================
// SERVICIO DE DOCUMENTOS DE PACIENTES
// ==============================================

import pool from '../db/pool';
import { PatientDocument } from '../types/enhanced-types';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

export class DocumentService {
  
  static async uploadDocument(
    patientId: number,
    file: Express.Multer.File,
    documentType: PatientDocument['document_type'],
    appointmentId?: number,
    uploadedByUserId?: number,
    notes?: string
  ): Promise<number> {
    // Generar nombre único para el archivo
    const fileExtension = path.extname(file.originalname);
    const uniqueFileName = crypto.randomBytes(16).toString('hex') + fileExtension;
    const filePath = path.join('uploads', 'documents', uniqueFileName);
    
    // Crear directorio si no existe
    const uploadDir = path.dirname(filePath);
    await fs.mkdir(uploadDir, { recursive: true });
    
    // Mover archivo a la ubicación final
    await fs.writeFile(filePath, file.buffer);

    // Guardar información en base de datos
    const [result] = await pool.execute(
      `INSERT INTO patient_documents 
       (patient_id, appointment_id, document_type, file_name, file_path, file_size, mime_type, uploaded_by_user_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patientId,
        appointmentId,
        documentType,
        file.originalname,
        filePath,
        file.size,
        file.mimetype,
        uploadedByUserId,
        notes
      ]
    );

    return (result as any).insertId;
  }

  static async getPatientDocuments(
    patientId: number,
    appointmentId?: number,
    documentType?: string
  ): Promise<PatientDocument[]> {
    let query = `
      SELECT pd.*, u.name as uploaded_by_name
      FROM patient_documents pd
      LEFT JOIN users u ON pd.uploaded_by_user_id = u.id
      WHERE pd.patient_id = ?
    `;
    const params: any[] = [patientId];

    if (appointmentId) {
      query += ` AND pd.appointment_id = ?`;
      params.push(appointmentId);
    }

    if (documentType) {
      query += ` AND pd.document_type = ?`;
      params.push(documentType);
    }

    query += ` ORDER BY pd.created_at DESC`;

    const [rows] = await pool.execute(query, params);
    return rows as PatientDocument[];
  }

  static async getDocument(documentId: number): Promise<PatientDocument | null> {
    const [rows] = await pool.execute(
      `SELECT * FROM patient_documents WHERE id = ?`,
      [documentId]
    );

    const documents = rows as PatientDocument[];
    return documents.length > 0 ? documents[0] : null;
  }

  static async deleteDocument(documentId: number): Promise<boolean> {
    try {
      // Obtener información del documento para eliminar archivo físico
      const document = await this.getDocument(documentId);
      if (!document) return false;

      // Eliminar archivo físico
      try {
        await fs.unlink(document.file_path);
      } catch (error) {
        console.warn('Could not delete physical file:', error);
      }

      // Eliminar registro de base de datos
      const [result] = await pool.execute(
        `DELETE FROM patient_documents WHERE id = ?`,
        [documentId]
      );

      return (result as any).affectedRows > 0;
    } catch (error) {
      console.error('Error deleting document:', error);
      return false;
    }
  }

  static async updateDocumentNotes(documentId: number, notes: string): Promise<boolean> {
    try {
      const [result] = await pool.execute(
        `UPDATE patient_documents SET notes = ? WHERE id = ?`,
        [notes, documentId]
      );
      return (result as any).affectedRows > 0;
    } catch (error) {
      console.error('Error updating document notes:', error);
      return false;
    }
  }

  static async getDocumentStats(): Promise<any> {
    const [rows] = await pool.execute(
      `SELECT 
         document_type,
         COUNT(*) as count,
         SUM(file_size) as total_size,
         AVG(file_size) as avg_size
       FROM patient_documents 
       GROUP BY document_type
       ORDER BY count DESC`
    );
    return rows;
  }

  static getMulterConfig() {
    const storage = multer.memoryStorage();
    
    const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
      // Tipos de archivo permitidos
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];

      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Tipo de archivo no permitido'), false);
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB máximo
      },
    });
  }

  static async cleanupOrphanedFiles(): Promise<number> {
    try {
      const uploadDir = path.join('uploads', 'documents');
      const files = await fs.readdir(uploadDir);
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(uploadDir, file);
        
        // Verificar si el archivo existe en la base de datos
        const [rows] = await pool.execute(
          `SELECT id FROM patient_documents WHERE file_path LIKE ?`,
          [`%${file}%`]
        );

        if ((rows as any[]).length === 0) {
          // Archivo huérfano, eliminar
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up orphaned files:', error);
      return 0;
    }
  }
}
