import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDatabase, resetTables } from '../../../test/database.js';
import { accountsTable } from '../../accounts/index.js';
import { atlasSpecIdChanges } from './atlas-spec-id-changes.table.js';
import { atlasSpecIds } from './atlas-spec-ids.table.js';

const connection = connectTestDatabase();
const BACKFILL = readFileSync(
  new URL('../../../../drizzle/0006_backfill_atlas_spec_id_created_changes.sql', import.meta.url),
  'utf8',
);
const SAVER_ID = '00000000-0000-4000-8000-0000000000aa';
const ILLUSTRATIVE = 'S1.BLD.APS.00.CL.RD.DM.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX';

/** A saved Spec ID row as it stood before history existed: no change rows. */
function row(id: string, code: string, name: string, savedAt: string) {
  const [, productType, material, coating, colourClarity, shape, profile, capacity, topDiameter, bottomDiameter,
    height, length, width, gusset, unitWeight, basisWeight, thickness, variant] = code.split('.') as string[];
  return {
    id, code, name, savedBy: SAVER_ID, savedAt: new Date(savedAt), dictionaryRelease: 'S1 0.1.0',
    productType: productType ?? '', material: material ?? '', coating: coating ?? '', colourClarity: colourClarity ?? '',
    shape: shape ?? '', profile: profile ?? '', capacity: capacity ?? '', topDiameter: topDiameter ?? '',
    bottomDiameter: bottomDiameter ?? '', height: height ?? '', length: length ?? '', width: width ?? '',
    gusset: gusset ?? '', unitWeight: unitWeight ?? '', basisWeight: basisWeight ?? '', thickness: thickness ?? '',
    variant: variant ?? '',
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

describe('the backfill migration, 0006', () => {
  it('gives every Spec ID saved before it exactly one created entry, from who saved it and when', async () => {
    await connection.db.insert(atlasSpecIds).values([
      row('00000000-0000-4000-8000-000000000001', ILLUSTRATIVE, 'Illustrative lid', '2026-10-15T08:00:00.000Z'),
      row('00000000-0000-4000-8000-000000000002', ILLUSTRATIVE.replace('.0090.', '.0091.'), 'Rim 91', '2026-10-16T08:00:00.000Z'),
    ]);

    await connection.db.execute(sql.raw(BACKFILL));

    const entries = await connection.db.select().from(atlasSpecIdChanges).orderBy(atlasSpecIdChanges.changedAt);
    expect(entries.map((entry) => [entry.specId, entry.kind, entry.changedBy, entry.changedAt.toISOString(), entry.codeBefore, entry.codeAfter, entry.nameBefore, entry.nameAfter])).toEqual([
      ['00000000-0000-4000-8000-000000000001', 'created', SAVER_ID, '2026-10-15T08:00:00.000Z', null, ILLUSTRATIVE, null, 'Illustrative lid'],
      ['00000000-0000-4000-8000-000000000002', 'created', SAVER_ID, '2026-10-16T08:00:00.000Z', null, ILLUSTRATIVE.replace('.0090.', '.0091.'), null, 'Rim 91'],
    ]);
  });

  it('does nothing when no Spec ID is saved', async () => {
    await connection.db.execute(sql.raw(BACKFILL));
    expect(await connection.db.select().from(atlasSpecIdChanges)).toEqual([]);
  });
});
