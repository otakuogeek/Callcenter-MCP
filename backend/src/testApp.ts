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
app.use('/api', apiRouter);
app.use((req,res,next)=>{ if (req.path.startsWith('/api/')) return res.status(404).json({success:false,error:'Not Found'}); next(); });
export default app;
