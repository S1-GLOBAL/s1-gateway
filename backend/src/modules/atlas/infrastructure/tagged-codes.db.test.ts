import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDatabase, resetTables } from '../../../test/database.js';
import { accountsTable } from '../../accounts/index.js';
import { FindSpecIdByCode } from '../application/find-spec-id-by-code.js';
import { SLOTS } from '../domain/slots.js';
import { SpecId } from '../domain/spec-id.js';
import { s2Dictionary } from '../domain/testing/s2-dictionary.js';
import { ILLUSTRATIVE, ILLUSTRATIVE_LONG, ILLUSTRATIVE_S1 } from '../domain/testing/spec-id-codes.js';
import { atlasSpecIdChanges } from './atlas-spec-id-changes.table.js';
import { atlasSpecIds } from './atlas-spec-ids.table.js';
import { DrizzleDictionaryRepository } from './drizzle-dictionary-repository.js';
import { DrizzleSourcingRepository } from './drizzle-sourcing-repository.js';
import { DrizzleSpecIdRepository } from './drizzle-spec-id-repository.js';

const connection = connectTestDatabase();
const TAGGED = readFileSync(new URL('../../../../drizzle/0019_write_atlas_codes_tagged.sql', import.meta.url), 'utf8');
const SAVER_ID = '00000000-0000-4000-8000-0000000000aa';
const SAVED_AT = new Date('2026-10-28T08:00:00.000Z');

/** A cup and a container as the API wrote them before ADR 0032. Their values are invented. */
const CUP = 'CUP.BCS.Y.WH.RD.X.Z0012.0090.Y.0110.X.X.X.Y.Y.Y.DW.02.X.X.X.X.X.X.X';
const CONTAINER = 'CTN.CBG.Y.WH.RC.X.Y.X.X.0045.0230.0150.X.Y.X.Y.X.Y.03.X.X.X.X.X.X';

type SpecIdRow = typeof atlasSpecIds.$inferInsert;

/** A saved Spec ID row as an API before ADR 0032 wrote it: a dotted code, each slot in its column. */
function dottedRow(id: string, code: string, name: string): SpecIdRow {
  const parts = code.split('.');
  const slots = Object.fromEntries(SLOTS.map((slot, index) => [slot.key, parts[index] ?? '']));
  return { ...slots, id, code, name, savedBy: SAVER_ID, savedAt: SAVED_AT, dictionaryRelease: 'S2 0.1.0' } as SpecIdRow;
}

/** The code `dotted` is written as today, by the domain. */
function tagged(dotted: string): string {
  const parsed = SpecId.parse(dotted, s2Dictionary());
  if (!parsed.ok) throw new Error(`expected ${dotted} to parse`);
  return parsed.value.code;
}

const columnsOf = (row: typeof atlasSpecIds.$inferSelect) => SLOTS.map((slot) => row[slot.key as keyof typeof row]).join('.');

function created(id: string, specId: string, code: string, name: string) {
  return {
    id, specId, kind: 'created', changedBy: SAVER_ID, changedAt: new Date('2026-10-27T08:00:00.000Z'),
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

describe('the tagged-code migration, 0019', () => {
  it('numbers each option as the domain does, the seed in the order it issued them, then the vessels sold with their lids', async () => {
    const dictionary = await new DrizzleDictionaryRepository(connection.db).get('S2 0.1.0');
    const numbers = (values: readonly { slot: string; code: string; number: number }[]) =>
      values.map(({ slot, code, number }) => `${slot}:${code}:${number}`).sort();
    expect(numbers(dictionary?.values() ?? [])).toEqual(numbers(s2Dictionary().values()));
    expect(dictionary?.numberOf('productType', 'PWC')).toBe(34);
  });

  it('writes every saved code tagged, as the domain writes it, and changes no fact', async () => {
    const codes = [ILLUSTRATIVE, CUP, CONTAINER];
    await connection.db
      .insert(atlasSpecIds)
      .values(codes.map((code, index) => dottedRow(`00000000-0000-4000-8000-00000000000${index + 1}`, code, `Product ${index + 1}`)));

    await connection.db.execute(sql.raw(TAGGED));

    const rows = await connection.db.select().from(atlasSpecIds).orderBy(atlasSpecIds.id);
    expect(rows.map((row) => row.code)).toEqual(['A1B4D1E1F1-H90N33', 'A5B17D3E1Q2R3-G112H90J110', codes.map(tagged)[2]]);
    expect(rows.map(columnsOf)).toEqual(codes);
  });

  it('writes every History code tagged, and adds no History entry', async () => {
    const moved = CUP.replace('.0110.', '.0112.');
    await connection.db.insert(atlasSpecIds).values(dottedRow('00000000-0000-4000-8000-000000000001', moved, 'Cup'));
    await connection.db.insert(atlasSpecIdChanges).values([
      created('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001', CUP, 'Cup'),
      {
        ...created('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001', moved, 'Cup'),
        kind: 'updated',
        changedAt: new Date('2026-10-28T08:00:00.000Z'),
        codeBefore: CUP,
        nameBefore: 'Cup',
      },
    ]);

    await connection.db.execute(sql.raw(TAGGED));

    const changes = await connection.db.select().from(atlasSpecIdChanges).orderBy(atlasSpecIdChanges.changedAt);
    expect(changes.map((change) => [change.codeBefore, change.codeAfter])).toEqual([
      [null, tagged(CUP)],
      [tagged(CUP), tagged(moved)],
    ]);
  });

  it('touches nothing already tagged', async () => {
    await connection.db.insert(atlasSpecIds).values(dottedRow('00000000-0000-4000-8000-000000000001', CUP, 'Cup'));
    await connection.db.execute(sql.raw(TAGGED));
    const before = await connection.db.select().from(atlasSpecIds);

    await connection.db.execute(sql.raw(TAGGED));

    expect(await connection.db.select().from(atlasSpecIds)).toEqual(before);
  });

  it('still finds a Spec ID by every code it was given out as, and by the one it was changed away from', async () => {
    const moved = ILLUSTRATIVE.replace('.0033.', '.0040.');
    await connection.db.insert(atlasSpecIds).values(dottedRow('00000000-0000-4000-8000-000000000001', moved, 'Lid'));
    await connection.db.insert(atlasSpecIdChanges).values({
      ...created('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001', moved, 'Lid'),
      kind: 'updated',
      codeBefore: ILLUSTRATIVE,
      nameBefore: 'Lid',
    });
    await connection.db.execute(sql.raw(TAGGED));
    const find = new FindSpecIdByCode(
      new DrizzleDictionaryRepository(connection.db),
      new DrizzleSpecIdRepository(connection.db),
      new DrizzleSourcingRepository(connection.db),
    );

    for (const code of [ILLUSTRATIVE, ILLUSTRATIVE_LONG, ILLUSTRATIVE_S1.toLowerCase(), 'n33h90a1b4d1e1f1']) {
      const result = await find.execute({ code });
      expect(result.ok && result.value.id, code).toBe('00000000-0000-4000-8000-000000000001');
      expect(result.ok && result.value.replacedCode, code).toBe('A1B4D1E1F1-H90N33');
    }
    const now = await find.execute({ code: tagged(moved) });
    expect(now.ok && now.value.replacedCode).toBeNull();
  });
});
