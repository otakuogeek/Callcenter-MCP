import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, path.resolve(__dirname, '../../uploads'));
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const name = crypto.randomBytes(16).toString('hex');
    cb(null, `${name}${ext}`);
  },
});

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!allowed.includes(file.mimetype)) return cb(new Error('Tipo de archivo no permitido'));
  cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const f = req.file as Express.Multer.File | undefined;
    if (!f) return res.status(400).json({ message: 'Archivo requerido' });
    // URL pública
    const filename = path.basename(f.path);
  const base = process.env.PUBLIC_BASE_URL;
  const relative = `/uploads/${filename}`;
  const url = base ? `${base.replace(/\/$/, '')}${relative}` : relative;
    return res.json({ url, filename });
  } catch (e: any) {
    return res.status(500).json({ message: e.message || 'Error subiendo archivo' });
  }
});

export default router;
