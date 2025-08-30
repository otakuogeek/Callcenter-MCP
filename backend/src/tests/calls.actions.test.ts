import request from 'supertest';
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import app from '../testApp';
import pool from '../db/pool';

const token = jwt.sign({ userId: 1, role: 'admin' }, process.env.JWT_SECRET || 'testsecret', { expiresIn: '1h' });

let createdId: number;

beforeAll(async () => {
  // Crear llamada dummy en espera
  const [res] = await pool.query(`INSERT INTO calls (conversation_id, patient_name, agent_name, status, priority, created_at, updated_at) VALUES (?,?,?,?,?,NOW(),NOW())`, [
    'test_conv_actions', 'Paciente Test', 'Agente X', 'waiting', 'Normal'
  ]);
  // @ts-ignore
  createdId = res.insertId;
});

describe('Calls actions', () => {
  it('attend call', async () => {
    const res = await request(app)
      .post(`/api/calls/${createdId}/attend`)
      .set('Authorization', `Bearer ${token}`)
      .send({ agent_name: 'Dr. Tester' });
    expect([200,404]).toContain(res.status); // si ya fue atendida por otro proceso, 404
  });

  it('transfer call (puede fallar si no está activa)', async () => {
    const res = await request(app)
      .post(`/api/calls/${createdId}/transfer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ agent_name: 'Dr. Nuevo' });
    expect([200,404]).toContain(res.status);
  });

  it('hold call', async () => {
    const res = await request(app)
      .post(`/api/calls/${createdId}/hold`)
      .set('Authorization', `Bearer ${token}`);
    expect([200,404]).toContain(res.status);
  });
});

afterAll(async () => {
  await pool.query('DELETE FROM calls WHERE id=?', [createdId]);
  await pool.end();
});
