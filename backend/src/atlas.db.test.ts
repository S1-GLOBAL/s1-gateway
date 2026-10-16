import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { composeApp } from './compose.js';
import { FixedClock, SequentialIdGenerator, silentLogger } from './shared/application/testing/fakes.js';
import { connectTestDatabase, resetTables } from './test/database.js';

const ADMIN = 'admin@sourceone.global';
const PASSWORD = 'correct-horse-battery';
const ILLUSTRATIVE = 'S1.BLD.APS.00.CL.RD.DM.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX';
const FACTS = {
  productType: 'BLD',
  material: 'APS',
  colourClarity: 'CL',
  shape: 'RD',
  profile: 'DM',
  topDiameter: { value: '90', unit: 'mm' },
  unitWeight: { value: '3.3', unit: 'g' },
};

const SPEC_IDS = '/api/v1/atlas/spec-ids';
const PATHS = ['/api/v1/atlas/dictionary', `${SPEC_IDS}/decode`, `${SPEC_IDS}/encode`] as const;
const SAVED_PATHS = [SPEC_IDS, `${SPEC_IDS}/${encodeURIComponent(ILLUSTRATIVE)}`] as const;

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

// One sign-in for the whole file: sign-ups are limited to 5 per hour, and every test shares this app.
// Only the saved Spec IDs are emptied between tests, so the signed-in account survives them.
let agent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  await resetTables(connection.db);
  agent = request.agent(app);
  await agent.post('/api/v1/auth/sign-up').send({ email: ADMIN, fullName: 'Admin', password: PASSWORD });
  await agent.post('/api/v1/auth/sign-in').send({ email: ADMIN, password: PASSWORD });
});
beforeEach(async () => {
  await connection.db.execute(sql`truncate table atlas_spec_ids`);
});
afterAll(() => connection.close());

async function savedCount(): Promise<number> {
  const rows = await connection.db.execute<{ n: string }>(sql`select count(*) as n from atlas_spec_ids`);
  return Number(rows[0]?.n);
}

describe('Atlas, composed over Postgres', () => {
  it('answers the dictionary the migration loaded when signed in', async () => {
    const response = await agent.get('/api/v1/atlas/dictionary');

    expect(response.status).toBe(200);
    expect(response.body.data.release).toBe('S1 0.1.0');
    const values = response.body.data.slots.flatMap((slot: { values: unknown[] }) => slot.values);
    expect(values).toHaveLength(28);
    expect(response.body.data.rules).toHaveLength(56);
  });

  it('decodes the illustrative code when signed in', async () => {
    const response = await agent.post(`${SPEC_IDS}/decode`).send({ code: ILLUSTRATIVE });

    expect(response.status).toBe(200);
    expect(response.body.data.code).toBe(ILLUSTRATIVE);
  });

  it.each([
    ['get', PATHS[0]],
    ['post', PATHS[1]],
    ['post', PATHS[2]],
    ['get', SAVED_PATHS[0]],
    ['get', SAVED_PATHS[1]],
  ] as const)('refuses %s %s without a session', async (method, path) => {
    const response = await request(app)[method](path).send({});
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SIGN_IN_REQUIRED');
  });

  it('refuses to save without a session, and saves nothing', async () => {
    const response = await request(app).post(SPEC_IDS).send({ name: 'Illustrative lid', facts: FACTS });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SIGN_IN_REQUIRED');
    expect(await savedCount()).toBe(0);
  });

  it('saves a Spec ID under the signed-in account', async () => {
    const response = await agent.post(SPEC_IDS).send({ name: 'Illustrative lid', facts: FACTS });

    expect(response.status).toBe(201);
    expect(response.body.data.code).toBe(ILLUSTRATIVE);
    expect(response.body.data.name).toBe('Illustrative lid');
    expect(response.body.data.savedBy.fullName).toBe('Admin');
    expect(response.body.data.savedAt).toBe('2026-10-14T08:00:00.000Z');
    expect(await savedCount()).toBe(1);
  });

  it('answers 409 with the Spec ID already saved for a second save, which saves nothing', async () => {
    await agent.post(SPEC_IDS).send({ name: 'First', facts: FACTS });

    const again = await agent.post(SPEC_IDS).send({ name: 'Second', facts: FACTS });

    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('SPEC_ID_EXISTS');
    expect(again.body.error.details.existing.name).toBe('First');
    expect(again.body.error.details.existing.code).toBe(ILLUSTRATIVE);
    expect(again.body.error.details.existing.savedBy.fullName).toBe('Admin');
    expect(await savedCount()).toBe(1);
  });

  it('answers 201 and 409 to two simultaneous saves of one code, and keeps one row', async () => {
    const responses = await Promise.all([
      agent.post(SPEC_IDS).send({ name: 'One', facts: FACTS }),
      agent.post(SPEC_IDS).send({ name: 'Two', facts: FACTS }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await savedCount()).toBe(1);
    const loser = responses.find((response) => response.status === 409);
    expect(loser?.body.error.details.existing.code).toBe(ILLUSTRATIVE);
  });

  it('answers 400 and saves nothing for a bad name and a bad slot together', async () => {
    const response = await agent
      .post(SPEC_IDS)
      .send({ name: ' ', facts: { ...FACTS, height: { value: '12000', unit: 'mm' } } });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_SPEC_ID');
    expect(Object.keys(response.body.error.details.fields).sort()).toEqual(['height', 'name']);
    expect(await savedCount()).toBe(0);
  });

  it('opens a saved Spec ID by its code with dots, and answers 404 for one nobody saved', async () => {
    await agent.post(SPEC_IDS).send({ name: 'Illustrative lid', facts: FACTS });

    const found = await agent.get(`${SPEC_IDS}/${encodeURIComponent(ILLUSTRATIVE)}`);
    const missing = await agent.get(`${SPEC_IDS}/${encodeURIComponent(ILLUSTRATIVE.replace('.0090.', '.0091.'))}`);

    expect(found.status).toBe(200);
    expect(found.body.data.name).toBe('Illustrative lid');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('SPEC_ID_NOT_FOUND');
  });

  it('puts a rim of 0000 under might fit, 0090 under fits, and leaves 0091 out', async () => {
    // Three different products: the profile tells them apart.
    const rim = (name: string, profile: string, topDiameter: object | null) =>
      agent.post(SPEC_IDS).send({ name, facts: { ...FACTS, profile, topDiameter } });
    expect((await rim('Unstated rim', 'DM', null)).status).toBe(201);
    expect((await rim('Rim 90', 'HD', { value: '90', unit: 'mm' })).status).toBe(201);
    expect((await rim('Rim 91', 'FL', { value: '91', unit: 'mm' })).status).toBe(201);

    const response = await agent.get(`${SPEC_IDS}?topDiameter=0090`);

    expect(response.status).toBe(200);
    expect(response.body.data.fits.map((saved: { name: string }) => saved.name)).toEqual(['Rim 90']);
    expect(response.body.data.mightFit.map((saved: { name: string }) => saved.name)).toEqual(['Unstated rim']);
  });

  it('answers 400 for a lookup of something that is not a slot', async () => {
    const response = await agent.get(`${SPEC_IDS}?colour=CL`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.details.fields.colour).toEqual(['Not a slot of an S1 Spec ID.']);
  });

  it('answers 404 to PUT and DELETE on every path when signed in: nothing changes the dictionary or a saved Spec ID', async () => {
    await agent.post(SPEC_IDS).send({ name: 'Illustrative lid', facts: FACTS });

    for (const path of [...PATHS, ...SAVED_PATHS]) {
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
    expect(await savedCount()).toBe(1);
  });
});
