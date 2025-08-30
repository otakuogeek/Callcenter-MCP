import request from 'supertest';
import app from '../../src/testApp';

describe('Patients quick-search', () => {
  const token = process.env.TEST_JWT || 'test-token';
  it('rejects missing q param', async () => {
    const res = await request(app)
      .get('/api/patients-v2/quick-search')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
  it('returns array for valid q', async () => {
    const res = await request(app)
      .get('/api/patients-v2/quick-search?q=a')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
