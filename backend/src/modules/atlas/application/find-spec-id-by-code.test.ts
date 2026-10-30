import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { SpecIdNotFoundError } from '../domain/spec-id.errors.js';
import { Dictionary } from '../domain/dictionary.js';
import { S2_0_1_0_RULES, S2_0_1_0_VALUES } from '../domain/testing/s2-dictionary.js';
import { ILLUSTRATIVE as ILLUSTRATIVE_DOTTED, ILLUSTRATIVE_LONG, ILLUSTRATIVE_S1, withSlot } from '../domain/testing/spec-id-codes.js';
import { FindSpecIdByCode } from './find-spec-id-by-code.js';
import { SaveSpecId } from './save-spec-id.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';
import { InMemorySourcingRepository } from './testing/in-memory-sourcing-repository.js';
import { InMemorySpecIdRepository } from './testing/in-memory-spec-id-repository.js';
import { UpdateSpecId } from './update-spec-id.js';
import { CAPACITY_UNIT, COLOUR_CLARITY, MATERIAL, PRODUCT_TYPE, PROFILE, SHAPE } from '../domain/options.js';

const ILLUSTRATIVE = 'A1B4D1E1F1-H90N33';
const FACTS = {
  productType: PRODUCT_TYPE.bowlLid,
  material: MATERIAL.ps,
  colourClarity: COLOUR_CLARITY.clear,
  shape: SHAPE.round,
  profile: PROFILE.dome,
  topDiameter: { value: '90', unit: 'mm' },
  unitWeight: { value: '3.3', unit: 'g' },
};
const SAVER = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented' };

describe('FindSpecIdByCode', () => {
  const dictionaries = new InMemoryDictionaryRepository();
  const specIds = new InMemorySpecIdRepository();
  specIds.nameSaver(SAVER.id, SAVER.fullName);
  const find = new FindSpecIdByCode(dictionaries, specIds, new InMemorySourcingRepository());

  it('opens a saved Spec ID with its saver, ignoring spaces around the code', async () => {
    await new SaveSpecId(
      dictionaries,
      specIds, new InMemorySourcingRepository(),
      new FixedClock(new Date('2026-10-16T08:00:00.000Z')),
      new SequentialIdGenerator(),
    ).execute({ name: 'Illustrative lid', facts: FACTS, savedBy: SAVER });

    const result = await find.execute({ code: ` ${ILLUSTRATIVE} ` });

    if (!result.ok) throw result.error;
    expect(result.value.code).toBe(ILLUSTRATIVE);
    expect(result.value.name).toBe('Illustrative lid');
    expect(result.value.savedBy).toEqual(SAVER);
    expect(result.value.slots).toHaveLength(25);
  });

  it('finds a Spec ID by its code in any order and case, and by every dotted code it was given out as', async () => {
    const saved = new InMemorySpecIdRepository();
    saved.nameSaver(SAVER.id, SAVER.fullName);
    await new SaveSpecId(
      dictionaries,
      saved, new InMemorySourcingRepository(),
      new FixedClock(new Date('2026-10-16T08:00:00.000Z')),
      new SequentialIdGenerator(),
    ).execute({ name: 'Illustrative lid', facts: FACTS, savedBy: SAVER });
    const findSaved = new FindSpecIdByCode(dictionaries, saved, new InMemorySourcingRepository());

    for (const code of [
      'n33h90-f1e1d1b4a1',
      ILLUSTRATIVE_DOTTED,
      ILLUSTRATIVE_LONG,
      ILLUSTRATIVE_S1.toLowerCase(),
      withSlot(ILLUSTRATIVE_DOTTED, 'height', '0000'),
    ]) {
      const result = await findSaved.execute({ code });
      expect(result.ok && result.value.code, code).toBe(ILLUSTRATIVE);
    }
  });

  it('answers not found for a code nobody saved', async () => {
    const result = await find.execute({ code: ILLUSTRATIVE.replace('H90', 'H91') });
    expect(!result.ok && result.error).toBeInstanceOf(SpecIdNotFoundError);
    expect(!result.ok && result.error.message).toBe('No saved Spec ID has this code. Check it, or build and save it.');
  });
});

describe('FindSpecIdByCode, after codes change', () => {
  const EDITOR = { id: '00000000-0000-4000-8000-0000000000bb', fullName: 'Ben Invented' };
  const C1 = ILLUSTRATIVE;
  const C2 = 'A1B4D1E1F1-H90J12N33';

  /** A is saved as C1 and corrected to C2; `takeC1` then saves B as C1. */
  async function setup(takeC1: boolean) {
    const dictionaries = new InMemoryDictionaryRepository();
    const specIds = new InMemorySpecIdRepository();
    specIds.nameSaver(SAVER.id, SAVER.fullName);
    specIds.nameSaver(EDITOR.id, EDITOR.fullName);
    const ids = new SequentialIdGenerator();
    const save = new SaveSpecId(dictionaries, specIds, new InMemorySourcingRepository(), new FixedClock(new Date('2026-10-16T08:00:00.000Z')), ids);
    const a = await save.execute({ name: 'A', facts: FACTS, savedBy: SAVER });
    if (!a.ok) throw a.error;
    const corrected = await new UpdateSpecId(
      dictionaries,
      specIds, new InMemorySourcingRepository(),
      new FixedClock(new Date('2026-10-17T08:00:00.000Z')),
      ids,
    ).execute({ id: a.value.id, name: 'A', facts: { ...FACTS, height: { value: '12', unit: 'mm' } }, version: 1, updatedBy: EDITOR });
    if (!corrected.ok) throw corrected.error;
    if (takeC1) {
      const b = await save.execute({ name: 'B', facts: FACTS, savedBy: SAVER });
      if (!b.ok) throw b.error;
    }
    return { find: new FindSpecIdByCode(dictionaries, specIds, new InMemorySourcingRepository()), aId: a.value.id };
  }

  it('answers the Spec ID a replaced code became, naming the code asked for', async () => {
    const { find, aId } = await setup(false);

    const result = await find.execute({ code: C1 });

    if (!result.ok) throw result.error;
    expect(result.value.id).toBe(aId);
    expect(result.value.code).toBe(C2);
    expect(result.value.replacedCode).toBe(C1);
    expect(result.value.formerHolders).toEqual([]);
  });

  it('answers the Spec ID that has a code now, with every one that had it before', async () => {
    const { find, aId } = await setup(true);

    const result = await find.execute({ code: C1 });

    if (!result.ok) throw result.error;
    expect(result.value.name).toBe('B');
    expect(result.value.replacedCode).toBeNull();
    expect(result.value.formerHolders).toEqual([
      { id: aId, name: 'A', code: C2, until: '2026-10-17T08:00:00.000Z' },
    ]);
  });

  it('finds a code typed in lower case', async () => {
    const { find } = await setup(true);
    const result = await find.execute({ code: C1.toLowerCase() });
    expect(result.ok && result.value.name).toBe('B');
  });

  it('answers no former holders for a code that never changed', async () => {
    const { find } = await setup(false);
    const result = await find.execute({ code: C2 });
    expect(result.ok && result.value.formerHolders).toEqual([]);
  });
});

describe('FindSpecIdByCode after an approved rename (ADR 0031, ADR 0033)', () => {
  it('finds a Spec ID by a dotted code typed in letters its material had before or after a rename, since a number never moves', async () => {
    const dictionaries = new InMemoryDictionaryRepository();
    // Bagasse renamed CBG → CBQ before options were known by number, so migration 0021 kept CBQ as its letters.
    dictionaries.replace(
      new Dictionary(
        'S2 0.1.0',
        '2026-10-19',
        S2_0_1_0_VALUES.map((value) => (value.slot === 'material' && value.code === MATERIAL.bagasse ? { ...value, legacyCode: 'CBQ' } : value)),
        S2_0_1_0_RULES,
        { renames: [{ slot: 'material', oldCode: 'CBG', newCode: 'CBQ', changeNumber: 1 }], change: { number: 1, at: new Date('2026-10-27T10:00:00.000Z') } },
      ),
    );
    const specIds = new InMemorySpecIdRepository();
    specIds.nameSaver(SAVER.id, SAVER.fullName);
    const saved = await new SaveSpecId(dictionaries, specIds, new InMemorySourcingRepository(), new FixedClock(new Date('2026-10-27T11:00:00.000Z')), new SequentialIdGenerator()).execute({
      name: 'Bagasse bowl',
      facts: { productType: PRODUCT_TYPE.bowl, material: MATERIAL.bagasse, capacity: { unit: CAPACITY_UNIT.ounces, value: '14' } },
      savedBy: SAVER,
    });
    if (!saved.ok) throw saved.error;
    expect(saved.value.code).toBe('A3B25-G114');

    const find = new FindSpecIdByCode(dictionaries, specIds, new InMemorySourcingRepository());
    for (const letters of ['CBG', 'CBQ']) {
      const result = await find.execute({ code: `BWL.${letters}.Y.Y.Y.X.Z0014.Y.Y.Y.Y.Y.X.Y.X.Y.Y.Y.Y.X.X.X.X.X.X` });
      if (!result.ok) throw result.error;
      expect(result.value).toMatchObject({ id: saved.value.id, code: 'A3B25-G114', replacedCode: null });
    }
  });
});
