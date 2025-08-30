import request from 'supertest';
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import app from '../testApp';

// Generar token de prueba
const token = jwt.sign({ userId: 1, role: 'admin' }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });

describe('Calls API', () => {
  it('GET /api/calls/status debe responder con estructura esperada', async () => {
    const res = await request(app)
      .get('/api/calls/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stats).toHaveProperty('active_calls');
    expect(res.body.data.stats).not.toHaveProperty('active'); // legacy removido
  });

  it('GET /api/calls/history paginado', async () => {
    const res = await request(app)
      .get('/api/calls/history?limit=5&page=0')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('items');
    expect(res.body.data).toHaveProperty('total');
  });

  afterAll(async () => {
    const poolModule = await import('../db/pool');
    await poolModule.default.end();
  });
});
