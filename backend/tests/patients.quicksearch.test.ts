import request from 'supertest';
import { app } from '../src/testApp';

// NOTA: Se asume que existe al menos un paciente en fixtures / seed.

describe('Patients quick-search', () => {
  const token = process.env.TEST_JWT || 'test-token';
  it('should reject without query', async () => {
    const res = await request(app)
      .get('/api/patients/quick-search')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('should return list with query', async () => {
    const res = await request(app)
      .get('/api/patients/quick-search?q=a')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
