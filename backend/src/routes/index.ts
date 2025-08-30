import { Router, Request, Response } from 'express';
import pool from '../db/pool';
import pkg from '../../package.json';
import auth from './auth';
import users from './users';
import patients from './patients';
import specialties from './specialties';
import services from './services';
import locations from './locations';
import doctors from './doctors';
import availabilities from './availabilities';
import appointments from './appointments';
import eps from './eps';
import settings from './settings';
import uploads from './uploads';
import timezones from './timezones';
import zones from './zones';
import municipalities from './municipalities';
import locationTypes from './locationTypes';
import callStatuses from './callStatuses';
import callLogs from './callLogs';
import calls from './calls';
import analytics from './analytics';
import queue from './queue';
import transfers from './transfers';
import doctorServicePrices from './doctorServicePrices';
import appointmentBilling from './appointmentBilling';
// Rutas mejoradas existentes
import notifications from './notifications';
import documents from './documents';
import metrics from './metrics';
import audit from './audit';
import sessions from './sessions';
// Nuevas rutas para Biosanarcall 2025
import patientsUpdated from './patients-updated';
import lookups from './lookups';
import webhooks from './webhooks';
// Rutas avanzadas de gestión de agenda
import agendaTemplates from './agenda-templates';
import agendaOptimization from './agenda-optimization';
import agendaConflicts from './agenda-conflicts';
import { requireAuth } from '../middleware/auth';

const router = Router();
// Middleware para soportar token en query para SSE (EventSource no permite headers personalizados)
router.use((req: Request, _res: Response, next) => {
	if (!req.headers.authorization && req.query.token) {
		req.headers.authorization = `Bearer ${req.query.token}` as any;
	}
	next();
});

// Healthcheck
router.get('/health', async (_req: Request, res: Response) => {
	try {
		const [rows] = await pool.query('SELECT 1 AS ok');
		const ok = Array.isArray(rows) && (rows as any)[0]?.ok === 1;
		return res.json({
			status: 'ok',
			db: ok ? 'ok' : 'fail',
			name: (pkg as any).name,
			version: (pkg as any).version,
			uptime: process.uptime(),
			timestamp: new Date().toISOString(),
		});
	} catch {
		return res.status(200).json({
			status: 'degraded',
			db: 'down',
			name: (pkg as any).name,
			version: (pkg as any).version,
			uptime: process.uptime(),
			timestamp: new Date().toISOString(),
		});
	}
});

router.use('/auth', auth);
router.use('/users', users);
router.use('/patients', patients);
router.use('/specialties', specialties);
router.use('/services', services);
router.use('/locations', locations);
router.use('/doctors', doctors);
router.use('/availabilities', availabilities);
router.use('/appointments', appointments);
router.use('/eps', eps);
router.use('/settings', settings);
router.use('/uploads', uploads);
router.use('/timezones', timezones);
router.use('/zones', zones);
router.use('/municipalities', municipalities);
router.use('/location-types', locationTypes);
router.use('/call-statuses', callStatuses);
router.use('/call-logs', callLogs);
router.use('/calls', calls);
router.use('/analytics', analytics);
router.use('/queue', queue);
router.use('/transfers', transfers);
router.use('/doctor-service-prices', doctorServicePrices);
router.use('/appointment-billing', appointmentBilling);
// Rutas mejoradas para funcionalidades avanzadas
router.use('/notifications', notifications);
router.use('/documents', documents);
router.use('/metrics', metrics);
router.use('/audit', audit);
router.use('/sessions', sessions);
// Nuevas rutas Biosanarcall 2025
router.use('/patients-v2', patientsUpdated);
router.use('/lookups', lookups);
router.use('/webhooks', webhooks);
// Rutas avanzadas de gestión de agenda
router.use('/agenda-templates', agendaTemplates);
router.use('/agenda-optimization', agendaOptimization);
router.use('/agenda-conflicts', agendaConflicts);
// TODO: mount more routers as they are implemented

export default router; // Ensure this matches the server import
