import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { composeApp } from './compose.js';
import { createAdmin } from './scripts/create-admin.js';
import { FixedClock, SequentialIdGenerator, silentLogger } from './shared/application/testing/fakes.js';
import { connectTestDatabase, resetTables } from './test/database.js';

const ADMIN = 'admin@sourceone.global';
const STAFF = 'staff@sourceone.global';
const PASSWORD = 'correct-horse-battery';
const DICTIONARY = '/api/v1/atlas/dictionary';
const SUGGESTIONS = `${DICTIONARY}/suggestions`;
const NEW_MATERIAL = {
  slot: 'material',
  code: 'AZZ',
  proposal: { kind: 'add', meaning: 'Polymer, invented', searchWords: ['invented polymer'], rules: null },
};
const lid = (rim: string, material = 'APS') => ({
  productType: 'BLD',
  material,
  shape: 'RD',
  profile: 'DM',
  topDiameter: { value: rim, unit: 'mm' },
});

const connection = connectTestDatabase();
const app = composeApp({
  db: connection.db,
  logger: silentLogger,
  clock: new FixedClock(new Date('2026-10-27T08:00:00.000Z')),
  ids: new SequentialIdGenerator(),
  corsOrigin: 'http://localhost:5173',
  cookieSecure: false,
});

/** Signs in a new account; `role` says what it may do. */
async function signedIn(email: string, firstName: string, role: 'staff' | 'system-admin') {
  const created = await createAdmin(connection.db, {
    email,
    firstName,
    lastName: 'Invented',
    password: PASSWORD,
    nodeEnv: 'test',
    accountAdminEmails: [email],
  });
  if (!created.ok) throw new Error(created.error);
  await connection.db.execute(sql`update accounts set role = ${role} where email = ${email}`);
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/sign-in').send({ email, password: PASSWORD });
  return agent;
}

let admin: ReturnType<typeof request.agent>;
let staff: ReturnType<typeof request.agent>;

// Every test starts from the dictionary the migrations made, whatever the one before approved.
beforeEach(async () => {
  await resetTables(connection.db);
  admin = await signedIn(ADMIN, 'Ada', 'system-admin');
  staff = await signedIn(STAFF, 'Ben', 'staff');
});
afterAll(() => connection.close());

async function materials() {
  const dictionary = (await staff.get(DICTIONARY)).body.data as { slots: { key: string; values: { code: string }[] }[] };
  return dictionary.slots.find((slot) => slot.key === 'material')!.values.map((value) => value.code);
}

describe('Dictionary suggestions, composed over Postgres', () => {
  it('refuses every suggestion route without a session', async () => {
    const id = '00000000-0000-4000-8000-0000000000ff';
    for (const response of [
      await request(app).get(SUGGESTIONS),
      await request(app).post(SUGGESTIONS).send({}),
      await request(app).get(`${SUGGESTIONS}/waiting-count`),
      await request(app).get(`${SUGGESTIONS}/${id}`),
      await request(app).put(`${SUGGESTIONS}/${id}`).send({}),
      await request(app).post(`${SUGGESTIONS}/${id}/withdraw`),
      await request(app).post(`${SUGGESTIONS}/${id}/approve`).send({ version: 1 }),
      await request(app).post(`${SUGGESTIONS}/${id}/reject`).send({ reason: 'No.' }),
      await request(app).get(`${DICTIONARY}/usage/material/APS`),
    ]) {
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('SIGN_IN_REQUIRED');
    }
  });

  it('keeps a suggestion from the signed-in account, its proposal whole, and leaves the dictionary as it was', async () => {
    const before = (await staff.get(DICTIONARY)).body.data;

    const created = await staff.post(SUGGESTIONS).send(NEW_MATERIAL);
    expect(created.status).toBe(201);

    const detail = await staff.get(`${SUGGESTIONS}/${created.body.data.id}`);
    expect(detail.body.data).toMatchObject({
      proposal: NEW_MATERIAL.proposal,
      suggestedBy: { fullName: 'Ben Invented' },
      events: [{ kind: 'suggested', proposalAfter: NEW_MATERIAL.proposal }],
    });
    expect((await staff.get(DICTIONARY)).body.data).toEqual(before);
    expect((await admin.get(`${SUGGESTIONS}/waiting-count`)).body.data).toEqual({ count: 1 });
  });

  it("lets an admin approve staff's suggestion, which the dictionary answers as change #1; staff can't approve", async () => {
    const { id } = (await staff.post(SUGGESTIONS).send(NEW_MATERIAL)).body.data;

    const refused = await staff.post(`${SUGGESTIONS}/${id}/approve`).send({ version: 1 });
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe('NOT_ALLOWED');

    const approved = await admin.post(`${SUGGESTIONS}/${id}/approve`).send({ version: 1 });
    expect(approved.status).toBe(200);
    expect(approved.body.data).toMatchObject({ changeNumber: 1, specIdsRewritten: 0 });

    const dictionary = (await staff.get(DICTIONARY)).body.data;
    expect(dictionary.change).toEqual({ number: 1, at: '2026-10-27T08:00:00.000Z' });
    expect(await materials()).toContain('AZZ');
    expect((await admin.get(`${SUGGESTIONS}/waiting-count`)).body.data).toEqual({ count: 0 });
  });

  it('renames a material in use, rewriting each saved Spec ID with a history entry naming both people', async () => {
    const saved = [
      (await staff.post('/api/v1/atlas/spec-ids').send({ name: 'Lid 90', facts: lid('90') })).body.data,
      (await staff.post('/api/v1/atlas/spec-ids').send({ name: 'Lid 95', facts: lid('95') })).body.data,
    ] as { id: string; code: string }[];
    const proposal = { kind: 'edit', newCode: 'APZ', meaning: null, searchWords: null };
    const { id } = (await staff.post(SUGGESTIONS).send({ slot: 'material', code: 'APS', proposal })).body.data;

    const preview = (await admin.get(`${SUGGESTIONS}/${id}`)).body.data;
    expect(preview.usage).toBe(2);
    expect(preview.rewrites.map((rewrite: { codeAfter: string }) => rewrite.codeAfter).sort()).toEqual(
      saved.map((one) => one.code.replace('.APS.', '.APZ.')).sort(),
    );

    const approved = await admin.post(`${SUGGESTIONS}/${id}/approve`).send({ version: 1 });
    expect(approved.body.data).toMatchObject({ changeNumber: 1, specIdsRewritten: 2 });

    for (const one of saved) {
      const now = (await staff.get(`/api/v1/atlas/saved/${one.id}`)).body.data;
      expect(now.code).toBe(one.code.replace('.APS.', '.APZ.'));
      const [latest] = (await staff.get(`/api/v1/atlas/saved/${one.id}/history`)).body.data;
      expect(latest).toMatchObject({
        changedBy: { fullName: 'Ada Invented' },
        codeBefore: one.code,
        dictionaryChange: { number: 1, suggestedBy: { fullName: 'Ben Invented' }, approvedBy: { fullName: 'Ada Invented' } },
      });
    }
    expect(await materials()).not.toContain('APS');
  });

  it('starts the next test from the seeded dictionary again', async () => {
    expect(await materials()).toContain('APS');
    expect((await staff.get(DICTIONARY)).body.data.change).toBeNull();
  });

  it('refuses a deletion that would make two Spec IDs one, writing nothing', async () => {
    await staff.post('/api/v1/atlas/spec-ids').send({ name: 'PS lid', facts: lid('90') });
    await staff.post('/api/v1/atlas/spec-ids').send({ name: 'PP lid', facts: lid('90', 'APP') });
    const { id } = (
      await staff.post(SUGGESTIONS).send({ slot: 'material', code: 'APS', proposal: { kind: 'delete', replacement: 'APP' } })
    ).body.data;

    const refused = await admin.post(`${SUGGESTIONS}/${id}/approve`).send({ version: 1 });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('SPEC_IDS_WOULD_CLASH');
    expect(await materials()).toContain('APS');
    expect((await staff.get(`${SUGGESTIONS}/${id}`)).body.data.state).toBe('waiting');
  });

  it('rejects with a reason the suggester sees', async () => {
    const { id } = (await staff.post(SUGGESTIONS).send(NEW_MATERIAL)).body.data;
    const rejected = await admin.post(`${SUGGESTIONS}/${id}/reject`).send({ reason: 'We have APP.' });
    expect(rejected.status).toBe(200);
    expect((await staff.get(`${SUGGESTIONS}/${id}`)).body.data).toMatchObject({
      state: 'rejected',
      reason: 'We have APP.',
      decidedBy: { fullName: 'Ada Invented' },
      events: [{ kind: 'suggested' }, { kind: 'rejected', reason: 'We have APP.' }],
    });
  });
});
