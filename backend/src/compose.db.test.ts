import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { composeApp } from './compose.js';
import { FixedClock, SequentialIdGenerator, silentLogger } from './shared/application/testing/fakes.js';
import { connectTestDatabase, resetTables } from './test/database.js';

const connection = connectTestDatabase();
const app = composeApp({
  db: connection.db,
  logger: silentLogger,
  clock: new FixedClock(new Date('2026-10-14T08:00:00.000Z')),
  ids: new SequentialIdGenerator(),
  corsOrigin: 'http://localhost:5173',
});

beforeEach(() => resetTables(connection.db));
afterAll(() => connection.close());

describe('the composed app', () => {
  it('answers health', async () => {
    expect((await request(app).get('/api/v1/health')).body).toEqual({ data: { status: 'ok' } });
  });

  it('creates a tool in Postgres and lists it back', async () => {
    const created = await request(app)
      .post('/api/v1/tools')
      .send({ name: 'Payroll', url: 'https://payroll.example.com', category: 'Finance' });
    expect(created.status).toBe(201);

    const listed = await request(app).get('/api/v1/tools');
    expect(listed.body.data).toEqual([created.body.data]);
  });

  it('answers 409 for a duplicate name against the real unique index', async () => {
    const tool = { name: 'Payroll', url: 'https://payroll.example.com', category: 'Finance' };
    await request(app).post('/api/v1/tools').send(tool);
    const duplicate = await request(app).post('/api/v1/tools').send({ ...tool, name: 'payroll' });
    expect(duplicate.status).toBe(409);
  });
});
