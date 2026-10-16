import { count } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDatabase, resetTables } from '../../../test/database.js';
import { accountsTable } from '../../accounts/index.js';
import { SavedSpecId } from '../domain/saved-spec-id.js';
import { SLOTS } from '../domain/slots.js';
import { SpecIdExistsError } from '../domain/spec-id.errors.js';
import { SpecId, type SpecIdFactsInput } from '../domain/spec-id.js';
import { s1Dictionary } from '../domain/testing/s1-dictionary.js';
import { atlasSpecIds } from './atlas-spec-ids.table.js';
import { DrizzleSpecIdRepository } from './drizzle-spec-id-repository.js';

const connection = connectTestDatabase();
const repository = new DrizzleSpecIdRepository(connection.db);

const SAVER_ID = '00000000-0000-4000-8000-0000000000aa';
const LID: SpecIdFactsInput = {
  productType: 'BLD',
  material: 'APS',
  colourClarity: 'CL',
  shape: 'RD',
  profile: 'DM',
  unitWeight: { value: '3.3', unit: 'g' },
};

/** A lid whose rim is `rim` mm, or not stated; `profile` tells two lids with the same rim apart. */
function lid(id: string, name: string, savedAt: string, rim?: string, profile = 'DM'): SavedSpecId {
  const facts: SpecIdFactsInput = { ...LID, profile, ...(rim ? { topDiameter: { value: rim, unit: 'mm' } } : {}) };
  const built = SpecId.build(facts, s1Dictionary());
  if (!built.ok) throw new Error(`setup failed: ${JSON.stringify(built.error.issues)}`);
  return SavedSpecId.restore({
    id,
    specId: built.value,
    name,
    dictionaryRelease: 'S1 0.1.0',
    savedBy: SAVER_ID,
    savedAt: new Date(savedAt),
  });
}

const rowCount = async () => (await connection.db.select({ n: count() }).from(atlasSpecIds))[0]?.n;

// resetTables empties the saved Spec IDs and accounts, never the dictionary: only the migration fills that.
beforeEach(async () => {
  await resetTables(connection.db);
  await connection.db.insert(accountsTable).values({
    id: SAVER_ID,
    email: 'saver@sourceone.global',
    fullName: 'Ada Invented',
    passwordHash: 'hash',
    status: 'approved',
    createdAt: new Date('2026-10-14T08:00:00.000Z'),
  });
});
afterAll(() => connection.close());

describe('DrizzleSpecIdRepository', () => {
  it('round-trips every column and reads the name of whoever saved it', async () => {
    const saved = lid('00000000-0000-4000-8000-000000000001', 'Illustrative lid', '2026-10-16T08:00:00.000Z', '90');
    expect((await repository.add(saved)).ok).toBe(true);

    const record = await repository.findByCode(saved.specId.code);

    expect(record?.savedByName).toBe('Ada Invented');
    expect(record?.savedSpecId.id).toBe('00000000-0000-4000-8000-000000000001');
    expect(record?.savedSpecId.name).toBe('Illustrative lid');
    expect(record?.savedSpecId.dictionaryRelease).toBe('S1 0.1.0');
    expect(record?.savedSpecId.savedBy).toBe(SAVER_ID);
    expect(record?.savedSpecId.savedAt.toISOString()).toBe('2026-10-16T08:00:00.000Z');
    for (const { key } of SLOTS) expect(record?.savedSpecId.specId.slot(key)).toBe(saved.specId.slot(key));
    expect(record?.savedSpecId.specId.code).toBe(
      'S1.BLD.APS.00.CL.RD.DM.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX',
    );
  });

  it('answers null for a code nobody saved', async () => {
    expect(await repository.findByCode('S1.NONE')).toBeNull();
  });

  it('refuses a second add of one code with SpecIdExistsError', async () => {
    const first = lid('00000000-0000-4000-8000-000000000001', 'First', '2026-10-16T08:00:00.000Z', '90');
    const second = lid('00000000-0000-4000-8000-000000000002', 'Second', '2026-10-16T09:00:00.000Z', '90');
    await repository.add(first);

    const result = await repository.add(second);

    expect(!result.ok && result.error).toBeInstanceOf(SpecIdExistsError);
    expect(await rowCount()).toBe(1);
    expect((await repository.findByCode(first.specId.code))?.savedSpecId.name).toBe('First');
  });

  it('leaves one row when two adds of one code arrive together', async () => {
    const first = lid('00000000-0000-4000-8000-000000000001', 'First', '2026-10-16T08:00:00.000Z', '90');
    const second = lid('00000000-0000-4000-8000-000000000002', 'Second', '2026-10-16T08:00:00.000Z', '90');

    const results = await Promise.all([repository.add(first), repository.add(second)]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    expect(await rowCount()).toBe(1);
  });

  it('finds the unstated and 90 mm rims for a request of 90 mm, newest first, and not 91 mm', async () => {
    await repository.add(lid('00000000-0000-4000-8000-000000000001', 'Unstated rim', '2026-10-14T08:00:00.000Z'));
    await repository.add(lid('00000000-0000-4000-8000-000000000002', 'Rim 90', '2026-10-15T08:00:00.000Z', '90'));
    await repository.add(lid('00000000-0000-4000-8000-000000000003', 'Rim 91', '2026-10-16T08:00:00.000Z', '91'));

    const found = await repository.findCandidates({ topDiameter: '0090' });

    expect(found.map((record) => record.savedSpecId.name)).toEqual(['Rim 90', 'Unstated rim']);
    expect(found.every((record) => record.savedByName === 'Ada Invented')).toBe(true);
  });

  it('answers every saved Spec ID, newest first then by code, when nothing is chosen', async () => {
    const at = '2026-10-16T08:00:00.000Z';
    await repository.add(lid('00000000-0000-4000-8000-000000000001', 'Older', '2026-10-14T08:00:00.000Z', '90', 'HD'));
    await repository.add(lid('00000000-0000-4000-8000-000000000002', 'Tie, profile FL', at, '90', 'FL'));
    await repository.add(lid('00000000-0000-4000-8000-000000000003', 'Tie, profile DM', at, '90', 'DM'));

    const found = await repository.findCandidates({});

    const codes = found.map((record) => record.savedSpecId.specId.code);
    expect(found.map((record) => record.savedSpecId.name)).toEqual(['Tie, profile DM', 'Tie, profile FL', 'Older']);
    expect(codes[0]! < codes[1]!).toBe(true);
  });
});
