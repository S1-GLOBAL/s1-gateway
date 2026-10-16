import { describe, expect, it } from 'vitest';
import type { Clock } from '../../../shared/application/ports/clock.js';
import { SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { FindSimilarSpecIds } from './find-similar-spec-ids.js';
import { SaveSpecId } from './save-spec-id.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';
import { InMemorySpecIdRepository } from './testing/in-memory-spec-id-repository.js';

const SAVER = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented' };
const LID = { productType: 'BLD', material: 'APS', shape: 'RD' };

/** A clock the test moves, so each save has its own time. */
class SteppingClock implements Clock {
  constructor(private at: Date) {}

  now(): Date {
    return new Date(this.at);
  }

  set(at: string): void {
    this.at = new Date(at);
  }
}

/** Three lids that differ only in their rim: not stated, 90 mm and 91 mm. Their colour tells the unstated ones apart. */
async function setup() {
  const dictionaries = new InMemoryDictionaryRepository();
  const specIds = new InMemorySpecIdRepository();
  specIds.nameSaver(SAVER.id, SAVER.fullName);
  const clock = new SteppingClock(new Date('2026-10-14T08:00:00.000Z'));
  const save = new SaveSpecId(dictionaries, specIds, clock, new SequentialIdGenerator());
  const saveLid = async (name: string, at: string, extra: object) => {
    clock.set(at);
    const result = await save.execute({ name, facts: { ...LID, ...extra }, savedBy: SAVER });
    if (!result.ok) throw result.error;
  };
  await saveLid('Unstated rim', '2026-10-14T08:00:00.000Z', {});
  await saveLid('Rim 90', '2026-10-15T08:00:00.000Z', { topDiameter: { value: '90', unit: 'mm' } });
  await saveLid('Rim 91', '2026-10-16T08:00:00.000Z', { topDiameter: { value: '91', unit: 'mm' } });
  return { find: new FindSimilarSpecIds(dictionaries, specIds), saveLid };
}

describe('FindSimilarSpecIds', () => {
  it('puts 90 mm under fits, an unstated rim under might fit, and leaves 91 mm out', async () => {
    const { find } = await setup();
    const result = await find.execute({ topDiameter: '0090' });
    if (!result.ok) throw result.error;

    expect(result.value.fits.map((saved) => saved.name)).toEqual(['Rim 90']);
    expect(result.value.mightFit.map((saved) => saved.name)).toEqual(['Unstated rim']);
  });

  it('puts every saved Spec ID under fits, newest first, when nothing is chosen', async () => {
    const { find } = await setup();
    const result = await find.execute({});
    if (!result.ok) throw result.error;

    expect(result.value.fits.map((saved) => saved.name)).toEqual(['Rim 91', 'Rim 90', 'Unstated rim']);
    expect(result.value.mightFit).toEqual([]);
  });

  it('lists each group newest first', async () => {
    const { find, saveLid } = await setup();
    await saveLid('Clear unstated rim', '2026-10-17T08:00:00.000Z', { colourClarity: 'CL' });
    const result = await find.execute({ topDiameter: '0090' });
    if (!result.ok) throw result.error;

    expect(result.value.mightFit.map((saved) => saved.name)).toEqual(['Clear unstated rim', 'Unstated rim']);
  });

  it('names an unknown key, a repeated key and a bad value, each under its own key', async () => {
    const { find } = await setup();
    const result = await find.execute({ colour: 'CL', topDiameter: ['0090', '0091'], shape: 'QQ' });

    expect(!result.ok && result.error.message).toBe('The lookup is not valid.');
    expect(!result.ok && result.error.details).toEqual({
      fields: {
        colour: ['Not a slot of an S1 Spec ID.'],
        topDiameter: ['Choose one value.'],
        shape: ['Shape: QQ is not in the dictionary.'],
      },
    });
  });

  it('refuses the format version and the variant as lookup keys', async () => {
    const { find } = await setup();
    const result = await find.execute({ variant: 'XX', formatVersion: 'S1' });
    expect(!result.ok && result.error.details).toEqual({
      fields: { variant: ['Not a slot of an S1 Spec ID.'], formatVersion: ['Not a slot of an S1 Spec ID.'] },
    });
  });
});
