import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDatabase, resetTables } from '../../../test/database.js';
import { accountsTable } from '../../accounts/index.js';
import { CAPACITY_UNIT, COLOUR_CLARITY, MATERIAL, PRINT, PRODUCT_TYPE, SHAPE, WALL } from '../domain/options.js';
import { SLOTS } from '../domain/slots.js';
import { s2Dictionary } from '../domain/testing/s2-dictionary.js';
import { atlasDictionarySuggestions } from './atlas-dictionary-suggestions.table.js';
import { atlasSpecIdChanges } from './atlas-spec-id-changes.table.js';
import { atlasSpecIds } from './atlas-spec-ids.table.js';
import { DrizzleDictionaryRepository } from './drizzle-dictionary-repository.js';

const connection = connectTestDatabase();
const NUMBERED = readFileSync(new URL('../../../../drizzle/0021_number_atlas_option_keys.sql', import.meta.url), 'utf8');
/** The statements of 0021 that move saved Spec IDs and suggestions to numbers; the dictionary's own run once. */
const ROWS = NUMBERED.split('--> statement-breakpoint').filter(
  (statement) => statement.includes('UPDATE "atlas_spec_ids"') || statement.includes('UPDATE "atlas_dictionary_suggestions"'),
);
const SAVER_ID = '00000000-0000-4000-8000-0000000000aa';
const SAVED_AT = new Date('2026-10-30T08:00:00.000Z');
/** An invented cup, as 0019 left it: its code tagged, its slots still in letters. */
const CUP_CODE = 'A5B17D3E1Q2R3-G112H90J110';
const CUP_LETTERS = {
  productType: 'CUP', material: 'BCS', coating: 'Y', colourClarity: 'WH', shape: 'RD', profile: 'X',
  capacity: 'Z0012', topDiameter: '0090', bottomDiameter: 'Y', height: '0110', length: 'X', width: 'X', gusset: 'X',
  unitWeight: 'Y', basisWeight: 'Y', thickness: 'Y', wall: 'DW', print: '02', compartments: 'X', plies: 'X',
  lidOpening: 'X', handle: 'X', wrap: 'X', window: 'X', variant: 'X',
};

beforeEach(async () => {
  await resetTables(connection.db);
  await connection.db.insert(accountsTable).values({
    id: SAVER_ID,
    email: 'saver@sourceone.global',
    fullName: 'Ada Invented',
    passwordHash: 'hash',
    status: 'approved',
    createdAt: SAVED_AT,
  });
});

afterAll(async () => {
  await connection.close();
});

async function replay(): Promise<void> {
  for (const statement of ROWS) await connection.db.execute(sql.raw(statement));
}

describe('options known by number, 0021 (plan 0012)', () => {
  it('leaves the dictionary as the domain has it: each option keyed by its number, with its old letters and family', async () => {
    const stored = await new DrizzleDictionaryRepository(connection.db).get('S2 0.1.0');
    const expected = s2Dictionary();

    expect(stored?.values()).toEqual(expected.values());
    expect(stored?.slotRules()).toEqual(expected.slotRules());
    expect(stored?.fromLetters('material', 'BKC')).toBe(MATERIAL.recycledKraft);
    expect(stored?.isGradeOf(MATERIAL.recycledKraft, MATERIAL.paper)).toBe(true);
    expect(stored?.meaningOf('productType', PRODUCT_TYPE.glove)).toBe('Glove');
  });

  it('writes a saved Spec ID’s facts by number, keeping its code, its version and its History', async () => {
    const id = '00000000-0000-4000-8000-000000000001';
    await connection.db.insert(atlasSpecIds).values({
      ...CUP_LETTERS,
      id,
      code: CUP_CODE,
      name: 'Invented cup',
      savedBy: SAVER_ID,
      savedAt: SAVED_AT,
      dictionaryRelease: 'S2 0.1.0',
    });
    const historyBefore = await connection.db.select().from(atlasSpecIdChanges);

    await replay();

    const [row] = await connection.db.select().from(atlasSpecIds);
    expect(row).toMatchObject({
      code: CUP_CODE,
      version: 1,
      productType: PRODUCT_TYPE.cup,
      material: MATERIAL.cupStock,
      colourClarity: COLOUR_CLARITY.white,
      shape: SHAPE.round,
      capacity: `${CAPACITY_UNIT.ounces}0012`,
      topDiameter: '0090',
      wall: WALL.doubleWall,
      print: PRINT.twoColours,
      profile: 'X',
      coating: 'Y',
    });
    expect(SLOTS.filter(({ key }) => !['productType', 'material', 'colourClarity', 'shape', 'capacity', 'wall', 'print'].includes(key))
      .every(({ key }) => row?.[key as keyof typeof row] === CUP_LETTERS[key as keyof typeof CUP_LETTERS])).toBe(true);
    expect(await connection.db.select().from(atlasSpecIdChanges)).toEqual(historyBefore);
  });

  it('names a suggestion’s option by number, and a waiting addition by none until it is approved', async () => {
    const base = { slot: 'material', state: 'waiting', suggestedBy: SAVER_ID, suggestedAt: SAVED_AT } as const;
    await connection.db.insert(atlasDictionarySuggestions).values([
      { ...base, id: '00000000-0000-4000-8000-000000000011', kind: 'add', code: 'AZZ',
        proposal: { kind: 'add', meaning: 'Polymer, invented', searchWords: [], rules: null } },
      { ...base, id: '00000000-0000-4000-8000-000000000012', kind: 'delete', code: 'APS',
        proposal: { kind: 'delete', replacement: 'APP' } },
    ]);

    await replay();

    const rows = await connection.db.select().from(atlasDictionarySuggestions).orderBy(atlasDictionarySuggestions.id);
    expect(rows.map(({ code, proposal }) => ({ code, proposal }))).toEqual([
      { code: '', proposal: { kind: 'add', meaning: 'Polymer, invented', searchWords: [], rules: null } },
      { code: MATERIAL.ps, proposal: { kind: 'delete', replacement: MATERIAL.pp } },
    ]);
  });
});
