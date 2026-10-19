import { randomUUID } from 'node:crypto';
import { count } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDatabase, resetTables } from '../../../test/database.js';
import { accountsTable } from '../../accounts/index.js';
import { SavedSpecId } from '../domain/saved-spec-id.js';
import { SpecIdChange } from '../domain/spec-id-change.js';
import { SLOTS } from '../domain/slots.js';
import { SpecIdChangedError, SpecIdExistsError } from '../domain/spec-id.errors.js';
import { SpecId, type SpecIdFactsInput } from '../domain/spec-id.js';
import { s2Dictionary } from '../domain/testing/s2-dictionary.js';
import { atlasSpecIdChanges } from './atlas-spec-id-changes.table.js';
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
  const built = SpecId.build(facts, s2Dictionary());
  if (!built.ok) throw new Error(`setup failed: ${JSON.stringify(built.error.issues)}`);
  return SavedSpecId.restore({
    id,
    specId: built.value,
    name,
    dictionaryRelease: 'S2 0.1.0',
    savedBy: SAVER_ID,
    savedAt: new Date(savedAt),
  });
}

/** Adds a Spec ID with its `created` history entry, as SaveSpecId does. */
const add = (saved: SavedSpecId) => repository.add(saved, SpecIdChange.created(saved, randomUUID()));

const rowCount = async () => (await connection.db.select({ n: count() }).from(atlasSpecIds))[0]?.n;
const changeCount = async () => (await connection.db.select({ n: count() }).from(atlasSpecIdChanges))[0]?.n;

const EDITOR_ID = '00000000-0000-4000-8000-0000000000bb';

/** `saved` with a new rim (or none) and name, changed by the editor at `at`. */
function revised(saved: SavedSpecId, at: string, rim?: string, name = saved.name): SavedSpecId {
  const facts: SpecIdFactsInput = { ...LID, ...(rim ? { topDiameter: { value: rim, unit: 'mm' } } : {}) };
  const built = SpecId.build(facts, s2Dictionary());
  if (!built.ok) throw new Error(`setup failed: ${JSON.stringify(built.error.issues)}`);
  const result = saved.revise({ specId: built.value, name, dictionaryRelease: 'S2 0.1.0', by: EDITOR_ID, at: new Date(at) });
  if (!result.ok) throw result.error;
  return result.value;
}

/** Saves `after` over `before` from `before`'s version, with its history entry. */
const update = (before: SavedSpecId, after: SavedSpecId, expectedVersion = before.version) =>
  repository.update(after, SpecIdChange.updated(before, after, randomUUID()), expectedVersion);

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
  await connection.db.insert(accountsTable).values({
    id: EDITOR_ID,
    email: 'editor@sourceone.global',
    fullName: 'Ben Invented',
    passwordHash: 'hash',
    status: 'approved',
    createdAt: new Date('2026-10-14T08:00:00.000Z'),
  });
});
afterAll(() => connection.close());

describe('DrizzleSpecIdRepository', () => {
  it('round-trips every column and reads the name of whoever saved it', async () => {
    const saved = lid('00000000-0000-4000-8000-000000000001', 'Illustrative lid', '2026-10-16T08:00:00.000Z', '90');
    expect((await add(saved)).ok).toBe(true);

    const record = await repository.findByCode(saved.specId.code);

    expect(record?.savedByName).toBe('Ada Invented');
    expect(record?.savedSpecId.id).toBe('00000000-0000-4000-8000-000000000001');
    expect(record?.savedSpecId.name).toBe('Illustrative lid');
    expect(record?.savedSpecId.dictionaryRelease).toBe('S2 0.1.0');
    expect(record?.savedSpecId.savedBy).toBe(SAVER_ID);
    expect(record?.savedSpecId.savedAt.toISOString()).toBe('2026-10-16T08:00:00.000Z');
    for (const { key } of SLOTS) expect(record?.savedSpecId.specId.slot(key)).toBe(saved.specId.slot(key));
    expect(record?.savedSpecId.specId.code).toBe(
      'S2.BLD.APS.00.CL.RD.DM.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX.00.XX.X.XX.XX.XX.XX.XX',
    );
  });

  it('answers null for a code nobody saved', async () => {
    expect(await repository.findByCode('S1.NONE')).toBeNull();
  });

  it('refuses a second add of one code with SpecIdExistsError', async () => {
    const first = lid('00000000-0000-4000-8000-000000000001', 'First', '2026-10-16T08:00:00.000Z', '90');
    const second = lid('00000000-0000-4000-8000-000000000002', 'Second', '2026-10-16T09:00:00.000Z', '90');
    await add(first);

    const result = await add(second);

    expect(!result.ok && result.error).toBeInstanceOf(SpecIdExistsError);
    expect(await rowCount()).toBe(1);
    expect((await repository.findByCode(first.specId.code))?.savedSpecId.name).toBe('First');
  });

  it('leaves one row when two adds of one code arrive together', async () => {
    const first = lid('00000000-0000-4000-8000-000000000001', 'First', '2026-10-16T08:00:00.000Z', '90');
    const second = lid('00000000-0000-4000-8000-000000000002', 'Second', '2026-10-16T08:00:00.000Z', '90');

    const results = await Promise.all([add(first), add(second)]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
    expect(await rowCount()).toBe(1);
  });

  it('finds the unstated and 90 mm rims for a request of 90 mm, newest first, and not 91 mm', async () => {
    await add(lid('00000000-0000-4000-8000-000000000001', 'Unstated rim', '2026-10-14T08:00:00.000Z'));
    await add(lid('00000000-0000-4000-8000-000000000002', 'Rim 90', '2026-10-15T08:00:00.000Z', '90'));
    await add(lid('00000000-0000-4000-8000-000000000003', 'Rim 91', '2026-10-16T08:00:00.000Z', '91'));

    const found = await repository.findCandidates({ topDiameter: '0090' });

    expect(found.map((record) => record.savedSpecId.name)).toEqual(['Rim 90', 'Unstated rim']);
    expect(found.every((record) => record.savedByName === 'Ada Invented')).toBe(true);
  });

  it('answers every saved Spec ID, newest first then by code, when nothing is chosen', async () => {
    const at = '2026-10-16T08:00:00.000Z';
    await add(lid('00000000-0000-4000-8000-000000000001', 'Older', '2026-10-14T08:00:00.000Z', '90', 'HD'));
    await add(lid('00000000-0000-4000-8000-000000000002', 'Tie, profile FL', at, '90', 'FL'));
    await add(lid('00000000-0000-4000-8000-000000000003', 'Tie, profile DM', at, '90', 'DM'));

    const found = await repository.findCandidates({});

    const codes = found.map((record) => record.savedSpecId.specId.code);
    expect(found.map((record) => record.savedSpecId.name)).toEqual(['Tie, profile DM', 'Tie, profile FL', 'Older']);
    expect(codes[0]! < codes[1]!).toBe(true);
  });
});

describe('DrizzleSpecIdRepository, changes and history', () => {
  const FIRST = '00000000-0000-4000-8000-000000000001';
  const SECOND = '00000000-0000-4000-8000-000000000002';

  it('writes the created entry with the Spec ID', async () => {
    const saved = lid(FIRST, 'Illustrative lid', '2026-10-16T08:00:00.000Z', '90');
    await add(saved);

    const history = await repository.history(FIRST);

    expect(history.map(({ change, changedByName }) => [change.kind, change.codeAfter, changedByName])).toEqual([
      ['created', saved.specId.code, 'Ada Invented'],
    ]);
  });

  it('leaves no history entry behind when the add is refused', async () => {
    await add(lid(FIRST, 'First', '2026-10-16T08:00:00.000Z', '90'));

    const result = await add(lid(SECOND, 'Second', '2026-10-16T09:00:00.000Z', '90'));

    expect(!result.ok && result.error).toBeInstanceOf(SpecIdExistsError);
    expect(await changeCount()).toBe(1);
  });

  it('saves a change: the new code, the next version, who and when, and its entry', async () => {
    const before = lid(FIRST, 'Illustrative lid', '2026-10-16T08:00:00.000Z');
    await add(before);
    const after = revised(before, '2026-10-17T08:00:00.000Z', '90');

    expect((await update(before, after)).ok).toBe(true);

    const record = await repository.findById(FIRST);
    expect(record?.savedSpecId.specId.code).toBe(after.specId.code);
    expect(record?.savedSpecId.version).toBe(2);
    expect(record?.savedSpecId.updatedAt?.toISOString()).toBe('2026-10-17T08:00:00.000Z');
    expect(record?.updatedByName).toBe('Ben Invented');
    expect(record?.savedByName).toBe('Ada Invented');
    expect(record?.savedSpecId.savedAt.toISOString()).toBe('2026-10-16T08:00:00.000Z');
    const history = await repository.history(FIRST);
    expect(history.map(({ change }) => [change.kind, change.codeBefore, change.codeAfter])).toEqual([
      ['updated', before.specId.code, after.specId.code],
      ['created', null, before.specId.code],
    ]);
    expect(history[0]?.changedByName).toBe('Ben Invented');
  });

  it('refuses a change from an older version, and changes nothing', async () => {
    const before = lid(FIRST, 'Illustrative lid', '2026-10-16T08:00:00.000Z');
    await add(before);
    await update(before, revised(before, '2026-10-17T08:00:00.000Z', '90'));

    const stale = await update(before, revised(before, '2026-10-17T09:00:00.000Z', '91'));

    expect(!stale.ok && stale.error).toBeInstanceOf(SpecIdChangedError);
    expect((await repository.findById(FIRST))?.savedSpecId.specId.slot('topDiameter')).toBe('0090');
    expect(await changeCount()).toBe(2);
  });

  it('leaves one change when two arrive together from one version', async () => {
    const before = lid(FIRST, 'Illustrative lid', '2026-10-16T08:00:00.000Z');
    await add(before);

    const results = await Promise.all([
      update(before, revised(before, '2026-10-17T08:00:00.000Z', '90')),
      update(before, revised(before, '2026-10-17T08:00:00.000Z', '91')),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.error instanceof SpecIdChangedError)).toHaveLength(1);
    expect((await repository.findById(FIRST))?.savedSpecId.version).toBe(2);
    expect(await changeCount()).toBe(2);
  });

  it("refuses a change to another Spec ID's code, and changes nothing", async () => {
    const before = lid(FIRST, 'First', '2026-10-16T08:00:00.000Z');
    await add(before);
    await add(lid(SECOND, 'Second', '2026-10-16T09:00:00.000Z', '90'));

    const result = await update(before, revised(before, '2026-10-17T08:00:00.000Z', '90'));

    expect(!result.ok && result.error).toBeInstanceOf(SpecIdExistsError);
    expect((await repository.findById(FIRST))?.savedSpecId.version).toBe(1);
    expect(await changeCount()).toBe(2);
  });

  it('names each Spec ID that once had a code, newest first, with when it stopped', async () => {
    const a = lid(FIRST, 'A', '2026-10-16T08:00:00.000Z', '90');
    await add(a);
    await update(a, revised(a, '2026-10-17T08:00:00.000Z', '91'));

    const former = await repository.formerHolders(a.specId.code);

    expect(former.map(({ record, until }) => [record.savedSpecId.name, until.toISOString()])).toEqual([
      ['A', '2026-10-17T08:00:00.000Z'],
    ]);
    expect(await repository.formerHolders(revised(a, '2026-10-18T08:00:00.000Z', '91').specId.code)).toEqual([]);
  });
});

describe('DrizzleSpecIdRepository, the library', () => {
  /** `count` lids a minute apart, named "Lid 1"…, each with its own height. */
  async function saveLids(count: number): Promise<SavedSpecId[]> {
    const saved: SavedSpecId[] = [];
    for (let n = 1; n <= count; n += 1) {
      const facts: SpecIdFactsInput = { ...LID, height: { value: String(n), unit: 'mm' } };
      const built = SpecId.build(facts, s2Dictionary());
      if (!built.ok) throw new Error('setup failed');
      const one = SavedSpecId.restore({
        id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
        specId: built.value,
        name: `Lid ${n}`,
        dictionaryRelease: 'S2 0.1.0',
        savedBy: SAVER_ID,
        savedAt: new Date(Date.UTC(2026, 9, 17, 8, n)),
      });
      await add(one);
      saved.push(one);
    }
    return saved;
  }

  it('pages 21 Spec IDs as 20, newest first, then the 21st newest', async () => {
    await saveLids(21);

    const first = await repository.list({ limit: 20 });
    const last = first.at(-1)?.savedSpecId;
    if (!last) throw new Error('no first page');
    const second = await repository.list({ limit: 20, after: { lastChangedAt: last.lastChangedAt, id: last.id } });

    expect(first.map((record) => record.savedSpecId.name)).toEqual(
      Array.from({ length: 20 }, (_, index) => `Lid ${21 - index}`),
    );
    expect(second.map((record) => record.savedSpecId.name)).toEqual(['Lid 1']);
  });

  it('lists a Spec ID by when it was last changed', async () => {
    const [one] = await saveLids(3);
    if (!one) throw new Error('setup failed');
    await update(one, revised(one, '2026-10-18T08:00:00.000Z', undefined, 'Lid 1, renamed'));

    const listed = await repository.list({ limit: 20 });

    expect(listed.map((record) => record.savedSpecId.name)).toEqual(['Lid 1, renamed', 'Lid 3', 'Lid 2']);
  });

  it('matches part of the name ignoring case, with % and _ meaning themselves', async () => {
    const saved = await saveLids(3);
    const [one, two] = saved;
    if (!one || !two) throw new Error('setup failed');
    await update(one, revised(one, '2026-10-18T08:00:00.000Z', undefined, 'Lid 100% PS'));
    await update(two, revised(two, '2026-10-18T09:00:00.000Z', '90', 'Lid_two'));

    const names = async (q: string) => (await repository.list({ q, limit: 20 })).map((r) => r.savedSpecId.name);

    expect(await names('%')).toEqual(['Lid 100% PS']);
    expect(await names('_')).toEqual(['Lid_two']);
    expect(await names('LID 3')).toEqual(['Lid 3']);
  });

  it('filters by product type', async () => {
    await saveLids(2);
    expect(await repository.list({ productType: 'BLD', limit: 20 })).toHaveLength(2);
    expect(await repository.list({ productType: 'BWL', limit: 20 })).toEqual([]);
  });
});
