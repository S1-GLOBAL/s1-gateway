import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { SpecIdNotFoundError } from '../domain/spec-id.errors.js';
import { ILLUSTRATIVE_LONG, ILLUSTRATIVE_S1, withSlot } from '../domain/testing/spec-id-codes.js';
import { FindSpecIdByCode } from './find-spec-id-by-code.js';
import { SaveSpecId } from './save-spec-id.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';
import { InMemorySpecIdRepository } from './testing/in-memory-spec-id-repository.js';
import { UpdateSpecId } from './update-spec-id.js';

const ILLUSTRATIVE = 'BLD.APS.Y.CL.RD.DM.X.0090.X.Y.X.X.X.0033.X.Y.X.Y.X.X.X.X.X.X.X';
const FACTS = {
  productType: 'BLD',
  material: 'APS',
  colourClarity: 'CL',
  shape: 'RD',
  profile: 'DM',
  topDiameter: { value: '90', unit: 'mm' },
  unitWeight: { value: '3.3', unit: 'g' },
};
const SAVER = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented' };

describe('FindSpecIdByCode', () => {
  const dictionaries = new InMemoryDictionaryRepository();
  const specIds = new InMemorySpecIdRepository();
  specIds.nameSaver(SAVER.id, SAVER.fullName);
  const find = new FindSpecIdByCode(dictionaries, specIds);

  it('opens a saved Spec ID with its saver, ignoring spaces around the code', async () => {
    await new SaveSpecId(
      dictionaries,
      specIds,
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

  it('finds a Spec ID by the long code and the S1 code it was given out as', async () => {
    const saved = new InMemorySpecIdRepository();
    saved.nameSaver(SAVER.id, SAVER.fullName);
    await new SaveSpecId(
      dictionaries,
      saved,
      new FixedClock(new Date('2026-10-16T08:00:00.000Z')),
      new SequentialIdGenerator(),
    ).execute({ name: 'Illustrative lid', facts: FACTS, savedBy: SAVER });
    const findSaved = new FindSpecIdByCode(dictionaries, saved);

    for (const code of [ILLUSTRATIVE_LONG, ILLUSTRATIVE_S1.toLowerCase(), withSlot(ILLUSTRATIVE, 'height', '0000')]) {
      const result = await findSaved.execute({ code });
      expect(result.ok && result.value.code, code).toBe(ILLUSTRATIVE);
    }
  });

  it('answers not found for a code nobody saved', async () => {
    const result = await find.execute({ code: ILLUSTRATIVE.replace('.0090.', '.0091.') });
    expect(!result.ok && result.error).toBeInstanceOf(SpecIdNotFoundError);
    expect(!result.ok && result.error.message).toBe('No saved Spec ID has this code. Check it, or build and save it.');
  });
});

describe('FindSpecIdByCode, after codes change', () => {
  const EDITOR = { id: '00000000-0000-4000-8000-0000000000bb', fullName: 'Ben Invented' };
  const C1 = ILLUSTRATIVE;
  const C2 = withSlot(ILLUSTRATIVE, 'height', '0012');

  /** A is saved as C1 and corrected to C2; `takeC1` then saves B as C1. */
  async function setup(takeC1: boolean) {
    const dictionaries = new InMemoryDictionaryRepository();
    const specIds = new InMemorySpecIdRepository();
    specIds.nameSaver(SAVER.id, SAVER.fullName);
    specIds.nameSaver(EDITOR.id, EDITOR.fullName);
    const ids = new SequentialIdGenerator();
    const save = new SaveSpecId(dictionaries, specIds, new FixedClock(new Date('2026-10-16T08:00:00.000Z')), ids);
    const a = await save.execute({ name: 'A', facts: FACTS, savedBy: SAVER });
    if (!a.ok) throw a.error;
    const corrected = await new UpdateSpecId(
      dictionaries,
      specIds,
      new FixedClock(new Date('2026-10-17T08:00:00.000Z')),
      ids,
    ).execute({ id: a.value.id, name: 'A', facts: { ...FACTS, height: { value: '12', unit: 'mm' } }, version: 1, updatedBy: EDITOR });
    if (!corrected.ok) throw corrected.error;
    if (takeC1) {
      const b = await save.execute({ name: 'B', facts: FACTS, savedBy: SAVER });
      if (!b.ok) throw b.error;
    }
    return { find: new FindSpecIdByCode(dictionaries, specIds), aId: a.value.id };
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
