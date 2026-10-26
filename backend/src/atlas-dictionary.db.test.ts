import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { composeApp } from './compose.js';
import { createAdmin } from './scripts/create-admin.js';
import { FixedClock, SequentialIdGenerator, silentLogger } from './shared/application/testing/fakes.js';
import { connectTestDatabase, resetTables } from './test/database.js';

const ADMIN = 'admin@sourceone.global';
const PASSWORD = 'correct-horse-battery';
const SUGGESTIONS = '/api/v1/atlas/dictionary/suggestions';

const connection = connectTestDatabase();
const app = composeApp({
  db: connection.db,
  logger: silentLogger,
  clock: new FixedClock(new Date('2026-10-27T08:00:00.000Z')),
  ids: new SequentialIdGenerator(),
  corsOrigin: 'http://localhost:5173',
  cookieSecure: false,
});

let agent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  await resetTables(connection.db);
  const created = await createAdmin(connection.db, {
    email: ADMIN,
    firstName: 'Ada',
    lastName: 'Invented',
    password: PASSWORD,
    nodeEnv: 'test',
    accountAdminEmails: [ADMIN],
  });
  if (!created.ok) throw new Error(created.error);
  agent = request.agent(app);
  await agent.post('/api/v1/auth/sign-in').send({ email: ADMIN, password: PASSWORD });
});
afterAll(() => connection.close());

describe('Dictionary suggestions, composed over Postgres', () => {
  it('refuses every suggestion route without a session', async () => {
    for (const path of [SUGGESTIONS, `${SUGGESTIONS}/waiting-count`, '/api/v1/atlas/dictionary/usage/material/APS']) {
      const response = await request(app).get(path);
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('SIGN_IN_REQUIRED');
    }
  });

  it('keeps a suggestion from the signed-in account, its proposal whole, and leaves the dictionary as it was', async () => {
    const before = (await agent.get('/api/v1/atlas/dictionary')).body.data;
    const proposal = { kind: 'add', meaning: 'Polymer, invented', searchWords: ['invented polymer'], rules: null };

    const created = await agent.post(SUGGESTIONS).send({ slot: 'material', code: 'AZZ', proposal });
    expect(created.status).toBe(201);

    const detail = await agent.get(`${SUGGESTIONS}/${created.body.data.id}`);
    expect(detail.body.data).toMatchObject({
      proposal,
      suggestedBy: { fullName: 'Ada Invented' },
      events: [{ kind: 'suggested', proposalAfter: proposal }],
    });
    expect((await agent.get('/api/v1/atlas/dictionary')).body.data).toEqual(before);
    // An admin does not count their own suggestion as waiting for them.
    expect((await agent.get(`${SUGGESTIONS}/waiting-count`)).body.data).toEqual({ count: 0 });
  });
});
