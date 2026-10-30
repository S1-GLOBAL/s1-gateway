import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import type { QuoteValues } from '../domain/sourcing/quote.js';
import { GetSpecIdManufacturers } from './get-spec-id-manufacturers.js';
import { SaveSpecId } from './save-spec-id.js';
import { SetManufacturerStage } from './set-manufacturer-stage.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';
import { InMemorySourcingRepository } from './testing/in-memory-sourcing-repository.js';
import { InMemorySpecIdRepository } from './testing/in-memory-spec-id-repository.js';
import { MATERIAL, PRODUCT_TYPE } from '../domain/options.js';

const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', fullName: 'Ada Admin' };
const ACME = '00000000-0000-4000-8000-00000000ac01';
const BOREALIS = '00000000-0000-4000-8000-00000000b001';
const NOW = new Date('2026-10-23T08:00:00.000Z');

/** An invented quote: never a Source One price (ADR 0027). */
const values = (overrides: Partial<QuoteValues> = {}): QuoteValues => ({
  itemName: 'Invented PP cup',
  fobPerUnit: null,
  fobPerCase: null,
  fobTotal: null,
  moldCost: null,
  moldLeadTime: null,
  sampleLeadTime: null,
  productionLeadTime: null,
  ...overrides,
});

async function setup() {
  const dictionaries = new InMemoryDictionaryRepository();
  const specIds = new InMemorySpecIdRepository();
  const sourcing = new InMemorySourcingRepository();
  sourcing.nameChanger(ADMIN.id, ADMIN.fullName);
  const ids = new SequentialIdGenerator();
  const clock = new FixedClock(NOW);
  const save = new SaveSpecId(dictionaries, specIds, new InMemorySourcingRepository(), clock, ids);
  const saved = async (material: string) => {
    const result = await save.execute({ name: 'Invented cup', facts: { productType: PRODUCT_TYPE.cup, material }, savedBy: ADMIN });
    if (!result.ok) throw new Error('setup failed');
    return result.value.id;
  };
  const cup = await saved(MATERIAL.pp);
  const other = await saved(MATERIAL.pet);
  const quote = (specId: string, manufacturerId: string, name: string, overrides: Partial<QuoteValues> = {}) => ({
    id: ids.next(),
    specId,
    manufacturer: { id: manufacturerId, name, country: 'Atlantis' },
    values: values(overrides),
    importedAt: NOW,
  });
  await sourcing.replaceQuotes([
    quote(cup, ACME, 'Acme Packaging', { itemName: 'Invented cup A', fobPerUnit: '$0.0123' }),
    quote(cup, ACME, 'Acme Packaging', { itemName: 'Invented cup B', fobPerUnit: 'N/A' }),
    quote(cup, ACME, 'Acme Packaging', { itemName: 'Invented cup C' }),
    quote(cup, BOREALIS, 'Borealis Boxes', { fobPerUnit: 'N/A', fobPerCase: '-' }),
    quote(other, '00000000-0000-4000-8000-00000000c001', 'Cascade Cartons', { fobPerUnit: '$0.0200' }),
  ]);
  return {
    sourcing,
    cup,
    list: (id: string) => new GetSpecIdManufacturers(specIds, sourcing).execute({ id }),
    setStage: (id: string, manufacturerId: string, stage: 'sampling' | 'in-production' | null) =>
      new SetManufacturerStage(specIds, sourcing, clock, ids).execute({ id, manufacturerId, stage, by: ADMIN }),
  };
}

describe('GetSpecIdManufacturers', () => {
  it('lists a manufacturer with three quotes once, with all three, by name', async () => {
    const { list, cup } = await setup();

    const result = await list(cup);

    if (!result.ok) throw new Error('expected manufacturers');
    expect(result.value.manufacturers.map((m) => [m.name, m.quotes.length])).toEqual([
      ['Acme Packaging', 3],
      ['Borealis Boxes', 1],
    ]);
    expect(result.value.specId).toMatchObject({ id: cup, name: 'Invented cup' });
  });

  it('is Quoted with a per-unit price, and Specifications received with only N/A and -', async () => {
    const { list, cup } = await setup();

    const result = await list(cup);

    if (!result.ok) throw new Error('expected manufacturers');
    expect(result.value.manufacturers.map((m) => [m.name, m.stage, m.stageSet])).toEqual([
      ['Acme Packaging', 'quoted', null],
      ['Borealis Boxes', 'specifications-received', null],
    ]);
  });

  it('answers SPEC_ID_NOT_FOUND for an id no Spec ID has', async () => {
    const { list } = await setup();

    const result = await list('00000000-0000-4000-8000-0000000000ff');

    expect(!result.ok && result.error.code).toBe('SPEC_ID_NOT_FOUND');
  });
});

describe('SetManufacturerStage', () => {
  it('shows an admin-set Sampling over Quoted, naming who and when, and Quoted again once cleared', async () => {
    const { setStage, list, cup } = await setup();

    const set = await setStage(cup, ACME, 'sampling');

    expect(set.ok && set.value).toMatchObject({
      stage: 'sampling',
      stageSet: { by: ADMIN, at: NOW.toISOString(), stage: 'sampling' },
    });
    const cleared = await setStage(cup, ACME, null);
    expect(cleared.ok && cleared.value).toMatchObject({ stage: 'quoted', stageSet: { by: ADMIN, stage: null } });
    const listed = await list(cup);
    expect(listed.ok && listed.value.manufacturers[0]?.stage).toBe('quoted');
  });

  it('records who, when, and the stage before and after, and nothing for the stage it already has', async () => {
    const { setStage, sourcing, cup } = await setup();

    await setStage(cup, BOREALIS, 'sampling');
    await setStage(cup, BOREALIS, 'sampling');
    await setStage(cup, BOREALIS, 'in-production');

    // The second change shares this clock, so its stored time is 1ms later.
    expect(sourcing.allStageChanges.map((c) => [c.stageBefore, c.stageAfter, c.changedBy, c.changedAt])).toEqual([
      [null, 'sampling', ADMIN.id, NOW],
      ['sampling', 'in-production', ADMIN.id, new Date(NOW.getTime() + 1)],
    ]);
  });

  it('answers MANUFACTURER_NOT_FOUND for a manufacturer whose quotes are on another Spec ID', async () => {
    const { setStage, sourcing, cup } = await setup();

    const result = await setStage(cup, '00000000-0000-4000-8000-00000000c001', 'sampling');

    expect(!result.ok && result.error.code).toBe('MANUFACTURER_NOT_FOUND');
    expect(sourcing.allStageChanges).toEqual([]);
  });

  it('answers SPEC_ID_NOT_FOUND for an id no Spec ID has, and records nothing', async () => {
    const { setStage, sourcing } = await setup();

    const result = await setStage('00000000-0000-4000-8000-0000000000ff', ACME, 'sampling');

    expect(!result.ok && result.error.code).toBe('SPEC_ID_NOT_FOUND');
    expect(sourcing.allStageChanges).toEqual([]);
  });
});
