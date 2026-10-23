import { count, sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { composeApp } from './compose.js';
import { atlasManufacturerStageChanges } from './modules/atlas/infrastructure/atlas-manufacturer-stage-changes.table.js';
import { DrizzleSourcingRepository } from './modules/atlas/infrastructure/drizzle-sourcing-repository.js';
import { createAdmin } from './scripts/create-admin.js';
import { FixedClock, SequentialIdGenerator, silentLogger } from './shared/application/testing/fakes.js';
import { connectTestDatabase, resetTables } from './test/database.js';

const ADMIN = 'admin@sourceone.global';
const STAFF = 'staff@sourceone.global';
const PASSWORD = 'correct-horse-battery';
const NOW = new Date('2026-10-23T08:00:00.000Z');
const UNKNOWN = '00000000-0000-4000-8000-0000000000ff';

const connection = connectTestDatabase();
const app = composeApp({
  db: connection.db,
  logger: silentLogger,
  clock: new FixedClock(NOW),
  ids: new SequentialIdGenerator(),
  corsOrigin: 'http://localhost:5173',
  accountAdminEmails: [ADMIN],
  cookieSecure: false,
});

let admin: ReturnType<typeof request.agent>;
let staff: ReturnType<typeof request.agent>;
let adminId: string;

/** Signs in an account made like the admin, but only `email` in its own list: the app's list decides who is an admin. */
async function signedIn(email: string, firstName: string): Promise<ReturnType<typeof request.agent>> {
  const created = await createAdmin(connection.db, {
    email,
    firstName,
    lastName: 'Invented',
    password: PASSWORD,
    nodeEnv: 'test',
    accountAdminEmails: [email],
  });
  if (!created.ok) throw new Error(created.error);
  const agent = request.agent(app);
  const signIn = await agent.post('/api/v1/auth/sign-in').send({ email, password: PASSWORD });
  if (signIn.status !== 200) throw new Error(`sign-in failed: ${signIn.status}`);
  return agent;
}

beforeAll(async () => {
  await resetTables(connection.db);
  admin = await signedIn(ADMIN, 'Ada');
  staff = await signedIn(STAFF, 'Ben');
  adminId = (await admin.get('/api/v1/auth/me')).body.data.id;
});
beforeEach(async () => {
  await connection.db.execute(
    sql`truncate table atlas_manufacturer_stage_changes, atlas_quotes, atlas_manufacturers, atlas_spec_id_changes, atlas_spec_ids`,
  );
});
afterAll(() => connection.close());

/** Saves an invented cup and records two invented manufacturers' quotes on it. Never Source One data (ADR 0027). */
async function cupWithQuotes(): Promise<{ id: string; acme: string }> {
  const saved = await admin.post('/api/v1/atlas/spec-ids').send({ name: 'Invented PP cup', facts: { productType: 'CUP', material: 'APP' } });
  const id: string = saved.body.data.id;
  const values = (fobPerUnit: string | null) => ({
    itemName: 'Invented PP cup',
    fobPerUnit,
    fobPerCase: null,
    fobTotal: null,
    moldCost: null,
    moldLeadTime: null,
    sampleLeadTime: '7',
    productionLeadTime: '30 days',
  });
  const sourcing = new DrizzleSourcingRepository(connection.db);
  await sourcing.replaceQuotes([
    { id: crypto.randomUUID(), specId: id, manufacturer: { id: crypto.randomUUID(), name: 'Acme Packaging', country: 'Atlantis' }, values: values('$0.0123'), importedAt: NOW },
    { id: crypto.randomUUID(), specId: id, manufacturer: { id: crypto.randomUUID(), name: 'Borealis Boxes', country: null }, values: values('N/A'), importedAt: NOW },
  ]);
  const acme = (await sourcing.quotesOf(id)).find((record) => record.manufacturer.name === 'Acme Packaging')?.manufacturer.id as string;
  return { id, acme };
}

const stageChanges = async () => (await connection.db.select({ n: count() }).from(atlasManufacturerStageChanges))[0]?.n;
const stagePath = (id: string, manufacturerId: string) => `/api/v1/atlas/saved/${id}/manufacturers/${manufacturerId}/stage`;

describe('GET /api/v1/atlas/saved/:id/manufacturers', () => {
  it('answers each manufacturer once, by name, with its stage and quotes, to any signed-in staff member', async () => {
    const { id } = await cupWithQuotes();

    const response = await staff.get(`/api/v1/atlas/saved/${id}/manufacturers`);

    expect(response.status).toBe(200);
    expect(response.body.data.specId).toMatchObject({ id, name: 'Invented PP cup' });
    expect(response.body.data.manufacturers).toEqual([
      expect.objectContaining({ name: 'Acme Packaging', country: 'Atlantis', stage: 'quoted', stageSet: null, quotes: [expect.objectContaining({ fobPerUnit: '$0.0123', productionLeadTime: '30 days' })] }),
      expect.objectContaining({ name: 'Borealis Boxes', country: null, stage: 'specifications-received', stageSet: null }),
    ]);
  });

  it('answers 401 without a session, and 404 SPEC_ID_NOT_FOUND for an unknown id or one that is not an id', async () => {
    expect((await request(app).get(`/api/v1/atlas/saved/${UNKNOWN}/manufacturers`)).status).toBe(401);
    for (const id of [UNKNOWN, 'not-an-id']) {
      const response = await staff.get(`/api/v1/atlas/saved/${id}/manufacturers`);
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('SPEC_ID_NOT_FOUND');
    }
  });
});

describe('PUT /api/v1/atlas/saved/:id/manufacturers/:manufacturerId/stage', () => {
  it('refuses staff who are not admins with 403 NOT_ALLOWED, and records nothing', async () => {
    const { id, acme } = await cupWithQuotes();

    const response = await staff.put(stagePath(id, acme)).send({ stage: 'sampling' });

    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({ code: 'NOT_ALLOWED', message: 'You are not allowed to do that.' });
    expect(await stageChanges()).toBe(0);
  });

  it('sets the stage for an admin, answers the manufacturer, and records who, when, before and after', async () => {
    const { id, acme } = await cupWithQuotes();

    const response = await admin.put(stagePath(id, acme)).send({ stage: 'sampling' });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: acme,
      stage: 'sampling',
      stageSet: { by: { id: adminId, fullName: 'Ada Invented' }, at: NOW.toISOString(), stage: 'sampling' },
    });
    const [row] = await connection.db.select().from(atlasManufacturerStageChanges);
    expect(row).toMatchObject({ specId: id, manufacturerId: acme, stageBefore: null, stageAfter: 'sampling', changedBy: adminId, changedAt: NOW });

    const cleared = await admin.put(stagePath(id, acme)).send({ stage: null });
    expect(cleared.body.data).toMatchObject({ stage: 'quoted', stageSet: { stage: null } });
    expect(await stageChanges()).toBe(2);
  });

  it('answers 400 VALIDATION_FAILED for any other stage, and 404 for an unknown manufacturer or Spec ID', async () => {
    const { id, acme } = await cupWithQuotes();

    const invalid = await admin.put(stagePath(id, acme)).send({ stage: 'quoted' });
    const noManufacturer = await admin.put(stagePath(id, UNKNOWN)).send({ stage: 'sampling' });
    const notAnId = await admin.put(stagePath(id, 'not-an-id')).send({ stage: 'sampling' });
    const noSpecId = await admin.put(stagePath(UNKNOWN, acme)).send({ stage: 'sampling' });

    expect([invalid.status, invalid.body.error.code]).toEqual([400, 'VALIDATION_FAILED']);
    expect([noManufacturer.status, noManufacturer.body.error.code]).toEqual([404, 'MANUFACTURER_NOT_FOUND']);
    expect([notAnId.status, notAnId.body.error.code]).toEqual([404, 'MANUFACTURER_NOT_FOUND']);
    expect([noSpecId.status, noSpecId.body.error.code]).toEqual([404, 'SPEC_ID_NOT_FOUND']);
    expect(await stageChanges()).toBe(0);
  });

  it('answers 401 without a session', async () => {
    const response = await request(app).put(stagePath(UNKNOWN, UNKNOWN)).send({ stage: 'sampling' });

    expect(response.status).toBe(401);
  });
});

describe('manufacturerStages on the library (#73)', () => {
  it("answers each Spec ID's stage counts with it in GET /api/v1/atlas/saved", async () => {
    const { id, acme } = await cupWithQuotes();
    await admin.put(stagePath(id, acme)).send({ stage: 'sampling' });

    const response = await staff.get('/api/v1/atlas/saved');

    expect(response.status).toBe(200);
    const cup = response.body.data.items.find((item: { id: string }) => item.id === id);
    // Acme set to Sampling; Borealis with N/A only.
    expect(cup.manufacturerStages).toEqual({ specificationsReceived: 2, quoted: 1, sampling: 1, inProduction: 0 });
  });
});
