import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import pinoHttp from 'pino-http';
import apiRouter from './routes';

const logger = pino({ level: 'silent' });
const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(pinoHttp({ logger }));
if (process.env.NODE_ENV !== 'test') {
	app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 }));
}
app.use('/api/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json());

// Bypass simple para token fijo en tests (antes de montar router)
app.use((req, _res, next) => {
	if (process.env.NODE_ENV === 'test' && req.headers.authorization === 'Bearer test-token') {
		(req as any).user = { id: 1, role: 'admin', name: 'Test User', email: 'test@example.com' };
	}
	next();
});

app.use('/api', apiRouter);
app.use((req,res,next)=>{ if (req.path.startsWith('/api/')) return res.status(404).json({success:false,error:'Not Found'}); next(); });

export default app;
