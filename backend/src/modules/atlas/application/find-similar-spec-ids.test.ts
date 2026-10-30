import { describe, expect, it } from 'vitest';
import type { Clock } from '../../../shared/application/ports/clock.js';
import { SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { FindSimilarSpecIds } from './find-similar-spec-ids.js';
import { SaveSpecId } from './save-spec-id.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';
import { InMemorySpecIdRepository } from './testing/in-memory-spec-id-repository.js';
import { InMemorySourcingRepository } from './testing/in-memory-sourcing-repository.js';
import { COLOUR_CLARITY, MATERIAL, PRODUCT_TYPE, SHAPE } from '../domain/options.js';

const SAVER = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented' };
const LID = { productType: PRODUCT_TYPE.bowlLid, material: MATERIAL.ps, shape: SHAPE.round };

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
  const save = new SaveSpecId(dictionaries, specIds, new InMemorySourcingRepository(), clock, new SequentialIdGenerator());
  const saveLid = async (name: string, at: string, extra: object) => {
    clock.set(at);
    const result = await save.execute({ name, facts: { ...LID, ...extra }, savedBy: SAVER });
    if (!result.ok) throw result.error;
  };
  await saveLid('Unstated rim', '2026-10-14T08:00:00.000Z', {});
  await saveLid('Rim 90', '2026-10-15T08:00:00.000Z', { topDiameter: { value: '90', unit: 'mm' } });
  await saveLid('Rim 91', '2026-10-16T08:00:00.000Z', { topDiameter: { value: '91', unit: 'mm' } });
  return { find: new FindSimilarSpecIds(dictionaries, specIds, new InMemorySourcingRepository()), saveLid };
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

  it('keeps Spec IDs that tie newest first', async () => {
    const { find, saveLid } = await setup();
    await saveLid('Clear unstated rim', '2026-10-17T08:00:00.000Z', { colourClarity: COLOUR_CLARITY.clear });
    const result = await find.execute({ topDiameter: '0090' });
    if (!result.ok) throw result.error;

    expect(result.value.mightFit.map((saved) => saved.name)).toEqual(['Clear unstated rim', 'Unstated rim']);
  });

  it('names an unknown key, a repeated key and a bad value, each under its own key', async () => {
    const { find } = await setup();
    const result = await find.execute({ colour: COLOUR_CLARITY.clear, topDiameter: ['0090', '0091'], shape: 'QQ' });

    expect(!result.ok && result.error.message).toBe('The lookup is not valid.');
    expect(!result.ok && result.error.details).toEqual({
      fields: {
        colour: ['Not a slot of a Spec ID.'],
        topDiameter: ['Choose one value.'],
        shape: ['Shape: QQ is not in the dictionary.'],
      },
    });
  });

  it('refuses the variant, and the format version codes no longer have, as lookup keys', async () => {
    const { find } = await setup();
    const result = await find.execute({ variant: 'X', formatVersion: 'S2' });
    expect(!result.ok && result.error.details).toEqual({
      fields: { variant: ['Not a slot of a Spec ID.'], formatVersion: ['Not a slot of a Spec ID.'] },
    });
  });
});

describe('FindSimilarSpecIds, closest first (#50)', () => {
  it('lists those that might fit by how many of the chosen slots they record, most first, whatever their age', async () => {
    const { find, saveLid } = await setup();
    // Newer than every rim, so newest first would list them first.
    await saveLid('Type and material', '2026-10-19T08:00:00.000Z', { shape: null });
    await saveLid('Type only', '2026-10-20T08:00:00.000Z', { material: null, shape: null });
    const result = await find.execute({ productType: PRODUCT_TYPE.bowlLid, material: MATERIAL.ps, shape: SHAPE.round, colourClarity: COLOUR_CLARITY.clear });
    if (!result.ok) throw result.error;

    // The rims record three of the four (colour is not known), and tie, so stay newest first.
    expect(result.value.fits).toEqual([]);
    expect(result.value.mightFit.map((saved) => saved.name)).toEqual([
      'Rim 91',
      'Rim 90',
      'Unstated rim',
      'Type and material',
      'Type only',
    ]);
  });

  it('lists those that fit by how few slots they leave not known, fewest first, whatever their age', async () => {
    const { find, saveLid } = await setup();
    await saveLid('Rim 92, clear', '2026-10-01T08:00:00.000Z', {
      colourClarity: COLOUR_CLARITY.clear,
      topDiameter: { value: '92', unit: 'mm' },
    });
    const result = await find.execute({ shape: SHAPE.round });
    if (!result.ok) throw result.error;

    expect(result.value.fits.map((saved) => saved.name)).toEqual(['Rim 92, clear', 'Rim 91', 'Rim 90', 'Unstated rim']);
    expect(result.value.mightFit).toEqual([]);
  });
});

describe('FindSimilarSpecIds, a material family (plan 0011)', () => {
  /** Invented bags that differ only in their material. */
  async function bags() {
    const dictionaries = new InMemoryDictionaryRepository();
    const specIds = new InMemorySpecIdRepository();
    specIds.nameSaver(SAVER.id, SAVER.fullName);
    const clock = new SteppingClock(new Date('2026-10-14T08:00:00.000Z'));
    const save = new SaveSpecId(dictionaries, specIds, new InMemorySourcingRepository(), clock, new SequentialIdGenerator());
    const materials: [string, string][] = [
      ['Recycled kraft bag', MATERIAL.recycledKraft],
      ['Kraft bag', MATERIAL.kraft],
      ['Paper bag', MATERIAL.paper],
      ['White kraft bag', MATERIAL.whiteKraft],
      ['Plastic bag', MATERIAL.polymer],
    ];
    for (const [index, [name, material]] of materials.entries()) {
      clock.set(`2026-10-1${index}T08:00:00.000Z`);
      const result = await save.execute({ name, facts: { productType: PRODUCT_TYPE.bag, material }, savedBy: SAVER });
      if (!result.ok) throw result.error;
    }
    return new FindSimilarSpecIds(dictionaries, specIds, new InMemorySourcingRepository());
  }

  it('fits every grade of the family asked for: paper of unknown grade fits any paper, kraft any kraft', async () => {
    const find = await bags();
    const paper = await find.execute({ productType: PRODUCT_TYPE.bag, material: MATERIAL.paper });
    if (!paper.ok) throw paper.error;
    expect(paper.value.fits.map((saved) => saved.name).sort()).toEqual(['Kraft bag', 'Paper bag', 'Recycled kraft bag', 'White kraft bag']);
    expect(paper.value.mightFit).toEqual([]);

    const kraft = await find.execute({ productType: PRODUCT_TYPE.bag, material: MATERIAL.kraft });
    if (!kraft.ok) throw kraft.error;
    expect(kraft.value.fits.map((saved) => saved.name).sort()).toEqual(['Kraft bag', 'Recycled kraft bag', 'White kraft bag']);
    expect(kraft.value.mightFit.map((saved) => saved.name)).toEqual(['Paper bag']);
  });

  it('might fit a grade to a Spec ID that records only its family, and leaves another grade out', async () => {
    const find = await bags();
    const result = await find.execute({ productType: PRODUCT_TYPE.bag, material: MATERIAL.recycledKraft });
    if (!result.ok) throw result.error;
    expect(result.value.fits.map((saved) => saved.name)).toEqual(['Recycled kraft bag']);
    expect(result.value.mightFit.map((saved) => saved.name).sort()).toEqual(['Kraft bag', 'Paper bag']);
  });
});
