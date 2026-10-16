import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { composeApp } from './compose.js';
import { FixedClock, SequentialIdGenerator, silentLogger } from './shared/application/testing/fakes.js';
import { connectTestDatabase, resetTables } from './test/database.js';

const ADMIN = 'admin@sourceone.global';
const PASSWORD = 'correct-horse-battery';
const ILLUSTRATIVE = 'S1.BLD.APS.00.CL.RD.DM.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX';

const PATHS = ['/api/v1/atlas/dictionary', '/api/v1/atlas/spec-ids/decode', '/api/v1/atlas/spec-ids/encode'] as const;

const connection = connectTestDatabase();
const app = composeApp({
  db: connection.db,
  logger: silentLogger,
  clock: new FixedClock(new Date('2026-10-14T08:00:00.000Z')),
  ids: new SequentialIdGenerator(),
  corsOrigin: 'http://localhost:5173',
  accountAdminEmails: [ADMIN],
  cookieSecure: false,
});

beforeEach(() => resetTables(connection.db));
afterAll(() => connection.close());

async function signedInAdmin() {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/sign-up').send({ email: ADMIN, fullName: 'Admin', password: PASSWORD });
  await agent.post('/api/v1/auth/sign-in').send({ email: ADMIN, password: PASSWORD });
  return agent;
}

describe('Atlas, composed over Postgres', () => {
  it('answers the dictionary the migration loaded when signed in', async () => {
    const agent = await signedInAdmin();
    const response = await agent.get('/api/v1/atlas/dictionary');

    expect(response.status).toBe(200);
    expect(response.body.data.release).toBe('S1 0.1.0');
    const values = response.body.data.slots.flatMap((slot: { values: unknown[] }) => slot.values);
    expect(values).toHaveLength(28);
    expect(response.body.data.rules).toHaveLength(56);
  });

  it('decodes the illustrative code when signed in', async () => {
    const agent = await signedInAdmin();
    const response = await agent.post('/api/v1/atlas/spec-ids/decode').send({ code: ILLUSTRATIVE });

    expect(response.status).toBe(200);
    expect(response.body.data.code).toBe(ILLUSTRATIVE);
  });

  it.each([
    ['get', PATHS[0]],
    ['post', PATHS[1]],
    ['post', PATHS[2]],
  ] as const)('refuses %s %s without a session', async (method, path) => {
    const response = await request(app)[method](path).send({});
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SIGN_IN_REQUIRED');
  });

  // One sign-in for all six: sign-ups are rate-limited per address, and this file shares one app.
  it('answers 404 to PUT and DELETE on every path when signed in: nothing changes the dictionary', async () => {
    const agent = await signedInAdmin();
    for (const path of PATHS) {
      for (const method of ['put', 'delete'] as const) {
        const response = await agent[method](path).send({});
        expect({ method, path, status: response.status, code: response.body.error?.code }).toEqual({
          method,
          path,
          status: 404,
          code: 'NOT_FOUND',
        });
      }
    }
  });
});
