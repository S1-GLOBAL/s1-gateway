import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { composeApp } from './compose.js';
import { createAdmin } from './scripts/create-admin.js';
import { FixedClock, SequentialIdGenerator, silentLogger } from './shared/application/testing/fakes.js';
import { connectTestDatabase, resetTables } from './test/database.js';

const ADMIN = 'admin@sourceone.global';
const PASSWORD = 'correct-horse-battery';

const connection = connectTestDatabase();
const app = composeApp({
  db: connection.db,
  logger: silentLogger,
  clock: new FixedClock(new Date('2026-10-14T08:00:00.000Z')),
  ids: new SequentialIdGenerator(),
  corsOrigin: 'http://localhost:5173',
  cookieSecure: false,
});

beforeEach(() => resetTables(connection.db));
afterAll(() => connection.close());

async function signedInAdmin() {
  const created = await createAdmin(connection.db, {
    email: ADMIN,
    firstName: 'Admin',
    lastName: 'User',
    password: PASSWORD,
    nodeEnv: 'test',
    accountAdminEmails: [ADMIN],
  });
  if (!created.ok) throw new Error(created.error);
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/sign-in').send({ email: ADMIN, password: PASSWORD });
  return agent;
}

describe('the composed app', () => {
  it('answers health without a session', async () => {
    expect((await request(app).get('/api/v1/health')).body).toEqual({ data: { status: 'ok' } });
  });

  it('creates a tool in Postgres and lists it back when signed in', async () => {
    const agent = await signedInAdmin();
    const created = await agent
      .post('/api/v1/tools')
      .send({ name: 'Payroll', url: 'https://payroll.example.com', category: 'Finance' });
    expect(created.status).toBe(201);

    const listed = await agent.get('/api/v1/tools');
    expect(listed.body.data).toEqual([created.body.data]);
  });

  it('answers 409 for a duplicate name against the real unique index', async () => {
    const agent = await signedInAdmin();
    const tool = { name: 'Payroll', url: 'https://payroll.example.com', category: 'Finance' };
    await agent.post('/api/v1/tools').send(tool);
    const duplicate = await agent.post('/api/v1/tools').send({ ...tool, name: 'payroll' });
    expect(duplicate.status).toBe(409);
  });

  it('refuses tools without a session', async () => {
    const response = await request(app).get('/api/v1/tools');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SIGN_IN_REQUIRED');
  });
});
