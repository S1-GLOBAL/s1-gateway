import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDatabase, resetTables } from '../../../test/database.js';
import { accountsTable } from '../../accounts/index.js';
import { FindSpecIdByCode } from '../application/find-spec-id-by-code.js';
import { fromS1, toShort } from '../domain/old-codes.js';
import { SavedSpecId } from '../domain/saved-spec-id.js';
import { SLOTS } from '../domain/slots.js';
import { SpecIdChange } from '../domain/spec-id-change.js';
import { SpecId } from '../domain/spec-id.js';
import { s2Dictionary } from '../domain/testing/s2-dictionary.js';
import { ILLUSTRATIVE, ILLUSTRATIVE_LONG, ILLUSTRATIVE_S1 } from '../domain/testing/spec-id-codes.js';
import { atlasSpecIdChanges } from './atlas-spec-id-changes.table.js';
import { atlasSpecIds } from './atlas-spec-ids.table.js';
import { DrizzleDictionaryRepository } from './drizzle-dictionary-repository.js';
import { DrizzleSpecIdRepository } from './drizzle-spec-id-repository.js';
import { DrizzleSourcingRepository } from './drizzle-sourcing-repository.js';

const connection = connectTestDatabase();
const SHORTEN = readFileSync(new URL('../../../../drizzle/0012_shorten_atlas_codes.sql', import.meta.url), 'utf8');
/** The migration that follows and tags every code (ADR 0032). */
const TAGGED = readFileSync(new URL('../../../../drizzle/0019_write_atlas_codes_tagged.sql', import.meta.url), 'utf8');
const SAVER_ID = '00000000-0000-4000-8000-0000000000aa';
const SAVED_AT = new Date('2026-10-19T08:00:00.000Z');

/** An S2 cup and container as the API wrote them before ADR 0025. Their values are invented. */
const CUP = 'S2.CUP.BCS.00.WH.RD.XX.Z0012.0090.0000.0110.XXXX.XXXX.XXXX.0000.000.000.DW.02.XX.X.XX.XX.XX.XX.XX';
const CONTAINER = 'S2.CTN.CBG.00.WH.RC.XX.00000.XXXX.XXXX.0045.0230.0150.XXXX.0000.XXX.000.XX.00.03.X.XX.XX.XX.XX.XX';
const CUP_LID_S1 = 'S1.CLD.APT.00.CL.RD.FL.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0021.XXX.000.XX';

type SpecIdRow = typeof atlasSpecIds.$inferInsert;

/** A saved Spec ID row as an API before ADR 0025 wrote it: a long code, each slot as wide as the slot. */
function longRow(id: string, code: string, name: string): SpecIdRow {
  const parts = code.split('.').slice(1);
  const slots = Object.fromEntries(SLOTS.map((slot, index) => [slot.key, parts[index] ?? '']));
  return { ...slots, id, code, name, savedBy: SAVER_ID, savedAt: SAVED_AT, dictionaryRelease: 'S2 0.1.0' } as SpecIdRow;
}

/** A saved Spec ID row as an S1 API wrote it during the deploy of 0011: an S1 code, and no added slots. */
function s1Row(id: string, code: string, name: string): SpecIdRow {
  const parts = code.split('.').slice(1);
  const slots = Object.fromEntries(SLOTS.slice(0, 16).map((slot, index) => [slot.key, parts[index] ?? '']));
  return {
    ...slots,
    variant: parts[16] ?? '',
    id,
    code,
    name,
    savedBy: SAVER_ID,
    savedAt: SAVED_AT,
    dictionaryRelease: 'S1 0.1.0',
  } as SpecIdRow;
}

/** Each slot column of a row, in code order, joined as a code is. */
const columnsOf = (row: typeof atlasSpecIds.$inferSelect) =>
  SLOTS.map((slot) => row[slot.key as keyof typeof row]).join('.');

function created(id: string, specId: string, code: string, name: string) {
  return {
    id, specId, kind: 'created', changedBy: SAVER_ID, changedAt: new Date('2026-10-18T08:00:00.000Z'),
    codeBefore: null, codeAfter: code, nameBefore: null, nameAfter: name,
  };
}

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

describe('the shortening migration, 0012', () => {
  it('converts every saved code and its slot columns exactly as toShort does, and changes no fact', async () => {
    const codes = [ILLUSTRATIVE_LONG, fromS1(CUP_LID_S1) ?? '', CUP, CONTAINER];
    await connection.db
      .insert(atlasSpecIds)
      .values(codes.map((code, index) => longRow(`00000000-0000-4000-8000-00000000000${index + 1}`, code, `Product ${index + 1}`)));

    await connection.db.execute(sql.raw(SHORTEN));

    const rows = await connection.db.select().from(atlasSpecIds).orderBy(atlasSpecIds.id);
    expect(rows.map((row) => row.code)).toEqual(codes.map((code) => toShort(code)));
    for (const row of rows) expect(columnsOf(row), row.name).toBe(row.code);
    expect(rows.every((row) => row.dictionaryRelease === 'S2 0.1.0')).toBe(true);
  });

  it('converts an S1 code an older API saved during the deploy of 0011, with its added slots', async () => {
    await connection.db.insert(atlasSpecIds).values(s1Row('00000000-0000-4000-8000-000000000001', CUP_LID_S1, 'Cup lid'));

    await connection.db.execute(sql.raw(SHORTEN));

    const [row] = await connection.db.select().from(atlasSpecIds);
    expect(row?.code).toBe(toShort(CUP_LID_S1));
    expect(row && columnsOf(row)).toBe(toShort(CUP_LID_S1));
    expect(row?.dictionaryRelease).toBe('S2 0.1.0');
  });

  it('converts every History code and adds no History entry', async () => {
    const moved = CUP.replace('.0110.', '.0112.');
    await connection.db.insert(atlasSpecIds).values(longRow('00000000-0000-4000-8000-000000000001', moved, 'Cup'));
    await connection.db.insert(atlasSpecIdChanges).values([
      created('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001', CUP, 'Cup'),
      {
        ...created('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001', moved, 'Cup'),
        kind: 'updated',
        changedAt: new Date('2026-10-19T08:00:00.000Z'),
        codeBefore: CUP,
        nameBefore: 'Cup',
      },
    ]);

    await connection.db.execute(sql.raw(SHORTEN));

    const changes = await connection.db.select().from(atlasSpecIdChanges).orderBy(atlasSpecIdChanges.changedAt);
    expect(changes.map((change) => [change.codeBefore, change.codeAfter])).toEqual([
      [null, toShort(CUP)],
      [toShort(CUP), toShort(moved)],
    ]);
  });

  it('still finds a Spec ID by the long and the S1 code it was changed away from', async () => {
    const moved = ILLUSTRATIVE_LONG.replace('.0033.', '.0040.');
    await connection.db.insert(atlasSpecIds).values(longRow('00000000-0000-4000-8000-000000000001', moved, 'Lid'));
    await connection.db.insert(atlasSpecIdChanges).values({
      ...created('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001', moved, 'Lid'),
      kind: 'updated',
      codeBefore: ILLUSTRATIVE_LONG,
      nameBefore: 'Lid',
    });
    await connection.db.execute(sql.raw(SHORTEN));
    await connection.db.execute(sql.raw(TAGGED));
    const find = new FindSpecIdByCode(new DrizzleDictionaryRepository(connection.db), new DrizzleSpecIdRepository(connection.db), new DrizzleSourcingRepository(connection.db));

    for (const code of [ILLUSTRATIVE_LONG, ILLUSTRATIVE_S1.toLowerCase(), ILLUSTRATIVE]) {
      const result = await find.execute({ code });
      expect(result.ok && result.value.id, code).toBe('00000000-0000-4000-8000-000000000001');
      expect(result.ok && result.value.replacedCode, code).toBe('A1B4D1E1F1-H90N33');
    }
  });

  it('touches nothing already short', async () => {
    const repository = new DrizzleSpecIdRepository(connection.db);
    const saved = savedSpecId('00000000-0000-4000-8000-000000000001', ILLUSTRATIVE, 'Lid');
    await repository.add(saved, SpecIdChange.created(saved, '00000000-0000-4000-8000-0000000000c1'), null);
    const before = await connection.db.select().from(atlasSpecIds);

    await connection.db.execute(sql.raw(SHORTEN));

    expect(await connection.db.select().from(atlasSpecIds)).toEqual(before);
  });
});

describe('a row an older API saved during the deploy', () => {
  it('is read with its slots in the short form', async () => {
    await connection.db.insert(atlasSpecIds).values(longRow('00000000-0000-4000-8000-000000000001', CUP, 'Cup'));
    const repository = new DrizzleSpecIdRepository(connection.db);

    const byId = await repository.findById('00000000-0000-4000-8000-000000000001');
    expect(byId?.savedSpecId.specId.dottedCode).toBe(toShort(CUP));
  });

  it('counts its slots written wide as not known in the similar lookup', async () => {
    await connection.db.insert(atlasSpecIds).values(longRow('00000000-0000-4000-8000-000000000001', CUP, 'Cup'));
    const repository = new DrizzleSpecIdRepository(connection.db);

    const candidates = await repository.findCandidates({ bottomDiameter: '0060' });

    expect(candidates.map((record) => record.savedSpecId.id)).toEqual(['00000000-0000-4000-8000-000000000001']);
  });

  it('keeps its code: another Spec ID with the same facts is refused', async () => {
    await connection.db.insert(atlasSpecIds).values(longRow('00000000-0000-4000-8000-000000000001', CUP, 'Cup'));
    const repository = new DrizzleSpecIdRepository(connection.db);
    const saved = savedSpecId('00000000-0000-4000-8000-000000000002', CUP, 'Second cup');

    const result = await repository.add(saved, SpecIdChange.created(saved, '00000000-0000-4000-8000-0000000000c9'), null);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('SPEC_ID_EXISTS');
  });
});

/** A new saved Spec ID for `code`, read in the short form. */
function savedSpecId(id: string, code: string, name: string): SavedSpecId {
  const parsed = SpecId.parse(code, s2Dictionary());
  if (!parsed.ok) throw new Error(`expected ${code} to parse`);
  const saved = SavedSpecId.create({
    id,
    specId: parsed.value,
    name,
    dictionaryRelease: 'S2 0.1.0',
    savedBy: SAVER_ID,
    savedAt: SAVED_AT,
  });
  if (!saved.ok) throw new Error('expected the Spec ID to be valid');
  return saved.value;
}
