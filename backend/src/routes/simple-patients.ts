import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool from '../db/pool';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Esquema ultra-simplificado para registro rápido de pacientes
const simplePatientSchema = z.object({
  document: z.string().min(3, 'Documento requerido (mínimo 3 caracteres)'),
  name: z.string().min(1, 'Nombre requerido'),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  birth_date: z.string().optional().nullable(),
});

// Ruta para registro ultra-simple de pacientes (mínimos campos requeridos)
router.post('/simple', requireAuth, async (req: Request, res: Response) => {
  const parsed = simplePatientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ 
      success: false,
      message: 'Datos inválidos', 
      errors: parsed.error.flatten() 
    });
  }
  
  const { document, name, phone, email, birth_date } = parsed.data;
  
  try {
    // Insertar con solo los campos mínimos requeridos
    const [result] = await pool.query(
      `INSERT INTO patients (document, name, phone, email, birth_date, gender, status, has_disability, notes)
       VALUES (?, ?, ?, ?, ?, 'No especificado', 'Activo', 0, 'Registro simplificado')`,
      [document, name, phone || null, email || null, birth_date || null]
    );
    
    // @ts-ignore
    const insertId = result.insertId;
    
    // Obtener el paciente creado
    const [patients] = await pool.query(
      'SELECT id, document, name, phone, email, birth_date, gender, status FROM patients WHERE id = ?',
      [insertId]
    );
    
    return res.status(201).json({ 
      success: true,
      message: 'Paciente registrado exitosamente',
      data: (patients as any[])[0]
    });
    
  } catch (e: any) {
    console.error('Error creando paciente simple:', e);
    
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ 
        success: false,
        message: 'Ya existe un paciente con este documento' 
      });
    }
    
    return res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor' 
    });
  }
});

export { router as simplePatientRoutes };