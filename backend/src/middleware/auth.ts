import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload { id: number; role: string; name: string; email: string }

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    // Bypass en entorno de test si coincide con TEST_JWT
    if (process.env.NODE_ENV === 'test' && process.env.TEST_JWT && token === process.env.TEST_JWT) {
      (req as any).user = { id: 1, role: 'admin', name: 'Test User', email: 'test@example.com' };
      return next();
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as AuthPayload;
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AuthPayload | undefined;
    if (!user) return res.status(401).json({ message: 'No auth' });
    if (!roles.includes(user.role)) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}
