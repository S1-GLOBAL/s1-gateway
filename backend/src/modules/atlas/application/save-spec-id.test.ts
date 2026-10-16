import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { InvalidSpecIdError, SpecIdExistsError } from '../domain/spec-id.errors.js';
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

function setup() {
  const specIds = new InMemorySpecIdRepository();
  specIds.nameSaver(SAVER.id, SAVER.fullName);
  const save = new SaveSpecId(
    new InMemoryDictionaryRepository(),
    specIds,
    new FixedClock(new Date('2026-10-16T08:00:00.000Z')),
    new SequentialIdGenerator(),
  );
  return { specIds, save };
}

describe('SaveSpecId', () => {
  it('saves the built Spec ID under the trimmed name, by whom and when', async () => {
    const { specIds, save } = setup();
    const result = await save.execute({ name: '  Illustrative lid  ', facts: FACTS, savedBy: SAVER });
    if (!result.ok) throw result.error;

    expect(result.value.code).toBe(ILLUSTRATIVE);
    expect(result.value.name).toBe('Illustrative lid');
    expect(result.value.savedBy).toEqual(SAVER);
    expect(result.value.savedAt).toBe('2026-10-16T08:00:00.000Z');
    expect(result.value.dictionaryRelease).toBe('S1 0.1.0');
    expect(result.value.slots).toHaveLength(18);
    expect(specIds.size).toBe(1);
  });

  it('records who saved it and when as the first history entry', async () => {
    const { specIds, save } = setup();
    const result = await save.execute({ name: 'Illustrative lid', facts: FACTS, savedBy: SAVER });
    if (!result.ok) throw result.error;

    const history = await specIds.history(result.value.id);

    expect(history).toHaveLength(1);
    expect(history[0]?.change.kind).toBe('created');
    expect(history[0]?.change.codeAfter).toBe(ILLUSTRATIVE);
    expect(history[0]?.changedByName).toBe('Ada Invented');
    expect(result.value.version).toBe(1);
    expect(result.value.updatedBy).toBeNull();
  });

  it('answers the Spec ID already saved for a duplicate, and saves nothing new', async () => {
    const { specIds, save } = setup();
    await save.execute({ name: 'First', facts: FACTS, savedBy: SAVER });

    const again = await save.execute({ name: 'Second', facts: FACTS, savedBy: SAVER });

    expect(!again.ok && again.error).toBeInstanceOf(SpecIdExistsError);
    const details = !again.ok ? (again.error.details as { existing: { name: string; savedBy: unknown } }) : undefined;
    expect(details?.existing.name).toBe('First');
    expect(details?.existing.savedBy).toEqual(SAVER);
    expect(specIds.size).toBe(1);
  });

  it('reads the winner when it loses a race the first look did not see', async () => {
    const { specIds, save } = setup();
    await save.execute({ name: 'Winner', facts: FACTS, savedBy: SAVER });
    // The first look misses the winner; the add then finds it.
    const realFind = specIds.findByCode.bind(specIds);
    let looks = 0;
    specIds.findByCode = async (code) => (looks++ === 0 ? null : realFind(code));

    const result = await save.execute({ name: 'Loser', facts: FACTS, savedBy: SAVER });

    const details = !result.ok ? (result.error.details as { existing: { name: string } }) : undefined;
    expect(!result.ok && result.error.code).toBe('SPEC_ID_EXISTS');
    expect(details?.existing.name).toBe('Winner');
    expect(specIds.size).toBe(1);
  });

  it('reports an invalid name and an invalid slot together, saving nothing', async () => {
    const { specIds, save } = setup();
    const result = await save.execute({
      name: '   ',
      facts: { ...FACTS, height: { value: '12000', unit: 'mm' } },
      savedBy: SAVER,
    });

    expect(!result.ok && result.error).toBeInstanceOf(InvalidSpecIdError);
    expect(!result.ok && result.error.details).toEqual({
      fields: { height: ['Height: 12000 mm is outside 1–9999 mm.'], name: ['Name is required.'] },
    });
    expect(specIds.size).toBe(0);
  });

  it('reports only the name when the slots are fine', async () => {
    const { save } = setup();
    const result = await save.execute({ name: 'a'.repeat(121), facts: FACTS, savedBy: SAVER });
    expect(!result.ok && result.error.details).toEqual({
      fields: { name: ['Name must be at most 120 characters.'] },
    });
  });

  it('saves a name of 120 characters', async () => {
    const { save } = setup();
    const result = await save.execute({ name: 'a'.repeat(120), facts: FACTS, savedBy: SAVER });
    expect(result.ok).toBe(true);
  });
});
