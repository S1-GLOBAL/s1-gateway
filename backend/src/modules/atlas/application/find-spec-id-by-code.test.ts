import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { SpecIdNotFoundError } from '../domain/spec-id.errors.js';
import { FindSpecIdByCode } from './find-spec-id-by-code.js';
import { SaveSpecId } from './save-spec-id.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';
import { InMemorySpecIdRepository } from './testing/in-memory-spec-id-repository.js';

const ILLUSTRATIVE = 'S1.BLD.APS.00.CL.RD.DM.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX';
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
    expect(result.value.slots).toHaveLength(18);
  });

  it('answers not found for a code nobody saved', async () => {
    const result = await find.execute({ code: ILLUSTRATIVE.replace('.0090.', '.0091.') });
    expect(!result.ok && result.error).toBeInstanceOf(SpecIdNotFoundError);
    expect(!result.ok && result.error.message).toBe('No saved Spec ID has this code. Check it, or build and save it.');
  });
});
