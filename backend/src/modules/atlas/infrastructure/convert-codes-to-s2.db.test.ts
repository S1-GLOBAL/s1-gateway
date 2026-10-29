import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDatabase, resetTables } from '../../../test/database.js';
import { accountsTable } from '../../accounts/index.js';
import { FindSpecIdByCode } from '../application/find-spec-id-by-code.js';
import { fromS1 } from '../domain/old-codes.js';
import { SpecId } from '../domain/spec-id.js';
import { s2Dictionary } from '../domain/testing/s2-dictionary.js';
import { atlasSpecIdChanges } from './atlas-spec-id-changes.table.js';
import { atlasSpecIds } from './atlas-spec-ids.table.js';
import { DrizzleDictionaryRepository } from './drizzle-dictionary-repository.js';
import { DrizzleSpecIdRepository } from './drizzle-spec-id-repository.js';
import { DrizzleSourcingRepository } from './drizzle-sourcing-repository.js';

const connection = connectTestDatabase();
const CONVERT = readFileSync(new URL('../../../../drizzle/0011_convert_atlas_codes_to_s2.sql', import.meta.url), 'utf8');
/** The migrations that follow 0011 and rewrite codes again: 0012 shortens them (ADR 0025), 0019 tags them (ADR 0032). */
const LATER = ['0012_shorten_atlas_codes', '0019_write_atlas_codes_tagged'].map((name) =>
  readFileSync(new URL(`../../../../drizzle/${name}.sql`, import.meta.url), 'utf8'),
);
const SAVER_ID = '00000000-0000-4000-8000-0000000000aa';

/** The illustrative bowl lid as S1 wrote it. Every other value here is invented. */
const LID = 'S1.BLD.APS.00.CL.RD.DM.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX';
const CUP_LID = 'S1.CLD.APT.00.CL.RD.FL.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0021.XXX.000.XX';
const BOWL = 'S1.BWL.BKR.PB.WH.RD.XX.Z0016.0150.0120.0060.XXXX.XXXX.XXXX.0100.300.000.XX';
const POUCH = 'S1.SUP.B00.00.BR.XX.XX.Z0012.XXXX.XXXX.0250.XXXX.0160.0080.0000.000.000.XX';

/** A saved Spec ID row as an S1 API wrote it: an S1 code, and no added slots. */
function s1Row(id: string, code: string, name: string) {
  const [, productType, material, coating, colourClarity, shape, profile, capacity, topDiameter, bottomDiameter,
    height, length, width, gusset, unitWeight, basisWeight, thickness, variant] = code.split('.') as string[];
  return {
    id, code, name, savedBy: SAVER_ID, savedAt: new Date('2026-10-16T08:00:00.000Z'), dictionaryRelease: 'S1 0.1.0',
    productType: productType ?? '', material: material ?? '', coating: coating ?? '', colourClarity: colourClarity ?? '',
    shape: shape ?? '', profile: profile ?? '', capacity: capacity ?? '', topDiameter: topDiameter ?? '',
    bottomDiameter: bottomDiameter ?? '', height: height ?? '', length: length ?? '', width: width ?? '',
    gusset: gusset ?? '', unitWeight: unitWeight ?? '', basisWeight: basisWeight ?? '', thickness: thickness ?? '',
    variant: variant ?? '',
  };
}

function created(id: string, specId: string, code: string, name: string) {
  return {
    id, specId, kind: 'created', changedBy: SAVER_ID, changedAt: new Date('2026-10-16T08:00:00.000Z'),
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

describe('the conversion migration, 0011', () => {
  it('converts every saved code and its added slots exactly as fromS1 does, for each S1 product type', async () => {
    const codes = [LID, CUP_LID, BOWL, POUCH];
    await connection.db.insert(atlasSpecIds).values(
      codes.map((code, index) => s1Row(`00000000-0000-4000-8000-00000000000${index + 1}`, code, `Product ${index + 1}`)),
    );

    await connection.db.execute(sql.raw(CONVERT));

    const rows = await connection.db.select().from(atlasSpecIds).orderBy(atlasSpecIds.id);
    expect(rows.map((row) => row.code)).toEqual(codes.map((code) => fromS1(code)));
    expect(rows.every((row) => row.dictionaryRelease === 'S2 0.1.0')).toBe(true);
    for (const row of rows) {
      const added = [row.wall, row.print, row.compartments, row.plies, row.lidOpening, row.handle, row.wrap, row.window];
      expect(added.join('.')).toBe(row.code.split('.').slice(17, 25).join('.'));
    }
  });

  it('converts every History code and adds no History entry', async () => {
    const moved = LID.replace('.0000.', '.0062.');
    await connection.db.insert(atlasSpecIds).values(s1Row('00000000-0000-4000-8000-000000000001', moved, 'Lid'));
    await connection.db.insert(atlasSpecIdChanges).values([
      created('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000001', LID, 'Lid'),
      {
        ...created('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001', moved, 'Lid'),
        kind: 'updated',
        changedAt: new Date('2026-10-17T08:00:00.000Z'),
        codeBefore: LID,
        nameBefore: 'Lid',
      },
    ]);

    await connection.db.execute(sql.raw(CONVERT));

    const changes = await connection.db.select().from(atlasSpecIdChanges).orderBy(atlasSpecIdChanges.changedAt);
    expect(changes.map((change) => [change.codeBefore, change.codeAfter])).toEqual([
      [null, fromS1(LID)],
      [fromS1(LID), fromS1(moved)],
    ]);
  });

  it('still finds a Spec ID by the S1 code it was changed away from', async () => {
    const moved = LID.replace('.0000.', '.0062.');
    await connection.db.insert(atlasSpecIds).values(s1Row('00000000-0000-4000-8000-000000000001', moved, 'Lid'));
    await connection.db.insert(atlasSpecIdChanges).values({
      ...created('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000001', moved, 'Lid'),
      kind: 'updated',
      codeBefore: LID,
      nameBefore: 'Lid',
    });
    await connection.db.execute(sql.raw(CONVERT));
    for (const later of LATER) await connection.db.execute(sql.raw(later));

    const find = new FindSpecIdByCode(new DrizzleDictionaryRepository(connection.db), new DrizzleSpecIdRepository(connection.db), new DrizzleSourcingRepository(connection.db));
    const result = await find.execute({ code: LID.toLowerCase() });

    expect(result.ok && result.value.id).toBe('00000000-0000-4000-8000-000000000001');
    const tagged = SpecId.parse(LID, s2Dictionary());
    expect(result.ok && result.value.replacedCode).toBe(tagged.ok && tagged.value.code);
  });

  it('touches nothing already in S2', async () => {
    await connection.db.execute(sql.raw(CONVERT));
    expect(await connection.db.select().from(atlasSpecIds)).toEqual([]);
  });
});
