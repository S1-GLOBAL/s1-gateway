import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import type { QuoteValues } from '../domain/sourcing/quote.js';
import { FindSimilarSpecIds } from './find-similar-spec-ids.js';
import { GetSavedSpecId } from './get-saved-spec-id.js';
import { ListSavedSpecIds } from './list-saved-spec-ids.js';
import { SaveSpecId } from './save-spec-id.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';
import { InMemorySourcingRepository } from './testing/in-memory-sourcing-repository.js';
import { InMemorySpecIdRepository } from './testing/in-memory-spec-id-repository.js';
import { MATERIAL, PRODUCT_TYPE, SHAPE } from '../domain/options.js';

const ADMIN = { id: '00000000-0000-4000-8000-0000000000ad', fullName: 'Ada Admin' };
const NOW = new Date('2026-10-24T08:00:00.000Z');
const ZERO = { specificationsReceived: 0, quoted: 0, sampling: 0, inProduction: 0 };

/** An invented quote: never a Source One price (ADR 0027). */
const values = (overrides: Partial<QuoteValues> = {}): QuoteValues => ({
  itemName: 'Invented cup',
  fobPerUnit: null,
  fobPerCase: null,
  fobTotal: null,
  moldCost: null,
  moldLeadTime: null,
  sampleLeadTime: null,
  productionLeadTime: null,
  ...overrides,
});

/** 21 invented cups, 90 to 110 mm; the newest, first in the library, has three manufacturers at different stages. */
async function setup() {
  const dictionaries = new InMemoryDictionaryRepository();
  const specIds = new InMemorySpecIdRepository();
  specIds.nameSaver(ADMIN.id, ADMIN.fullName);
  const sourcing = new InMemorySourcingRepository();
  const ids = new SequentialIdGenerator();
  const save = new SaveSpecId(dictionaries, specIds, sourcing, new FixedClock(NOW), ids);
  const saved: string[] = [];
  for (let rim = 90; rim <= 110; rim++) {
    const result = await save.execute({
      name: `Invented cup ${rim}`,
      facts: { productType: PRODUCT_TYPE.cup, material: MATERIAL.pp, shape: SHAPE.round, topDiameter: { value: String(rim), unit: 'mm' } },
      savedBy: ADMIN,
    });
    if (!result.ok) throw new Error('setup failed');
    saved.push(result.value.id);
  }
  const first = saved[saved.length - 1] as string;
  const quote = (manufacturerId: string, name: string, overrides: Partial<QuoteValues>) => ({
    id: ids.next(),
    specId: first,
    manufacturer: { id: manufacturerId, name, country: null },
    values: values(overrides),
    importedAt: NOW,
  });
  await sourcing.replaceQuotes([
    quote('acme', 'Acme Packaging', { fobPerUnit: '$0.0123' }),
    quote('borealis', 'Borealis Boxes', { fobPerUnit: 'N/A' }),
    quote('cascade', 'Cascade Cartons', {}),
  ]);
  await sourcing.recordStageChange({ id: ids.next(), specId: first, manufacturerId: 'cascade', stageAfter: 'in-production', changedBy: ADMIN.id, changedAt: NOW });
  sourcing.stageReads.length = 0;
  return { dictionaries, specIds, sourcing, save, saved, first };
}

describe('manufacturerStages on every SavedSpecId (#73)', () => {
  it('reads a library page of 20 in one go, and gives each card its counts', async () => {
    const { dictionaries, specIds, sourcing, saved, first } = await setup();

    const result = await new ListSavedSpecIds(dictionaries, specIds, sourcing).execute({});

    if (!result.ok) throw new Error('expected a page');
    expect(sourcing.stageReads).toHaveLength(1);
    expect(sourcing.stageReads[0]).toHaveLength(20);
    const byId = new Map(result.value.items.map((item) => [item.id, item.manufacturerStages]));
    // Acme quoted, Borealis with N/A only, Cascade set In production: 3 reached the first stage, 2 Quoted, 1 each after.
    expect(byId.get(first)).toEqual({ specificationsReceived: 3, quoted: 2, sampling: 1, inProduction: 1 });
    expect(byId.get(saved[10] as string)).toEqual(ZERO);
  });

  it("reads Search's fits and might fit together in one go", async () => {
    const { dictionaries, specIds, sourcing, first } = await setup();

    const result = await new FindSimilarSpecIds(dictionaries, specIds, sourcing).execute({ productType: PRODUCT_TYPE.cup });

    if (!result.ok) throw new Error('expected results');
    expect(sourcing.stageReads).toHaveLength(1);
    expect(sourcing.stageReads[0]).toHaveLength(result.value.fits.length + result.value.mightFit.length);
    const found = [...result.value.fits, ...result.value.mightFit].find((item) => item.id === first);
    expect(found?.manufacturerStages).toEqual({ specificationsReceived: 3, quoted: 2, sampling: 1, inProduction: 1 });
  });

  it('opens one Spec ID with its counts, and zeros for one with no manufacturers', async () => {
    const { dictionaries, specIds, sourcing, saved, first } = await setup();
    const open = new GetSavedSpecId(dictionaries, specIds, sourcing);

    const withManufacturers = await open.execute({ id: first });
    const without = await open.execute({ id: saved[0] as string });

    expect(withManufacturers.ok && withManufacturers.value.manufacturerStages).toEqual({ specificationsReceived: 3, quoted: 2, sampling: 1, inProduction: 1 });
    expect(without.ok && without.value.manufacturerStages).toEqual(ZERO);
  });

  it('answers zeros for a Spec ID just saved, without a read, and the existing counts in SPEC_ID_EXISTS', async () => {
    const { save, sourcing } = await setup();

    const fresh = await save.execute({ name: 'Invented lid', facts: { productType: PRODUCT_TYPE.cupLid, material: MATERIAL.pet }, savedBy: ADMIN });
    expect(fresh.ok && fresh.value.manufacturerStages).toEqual(ZERO);
    expect(sourcing.stageReads).toHaveLength(0);

    const again = await save.execute({
      name: 'Invented cup, again',
      facts: { productType: PRODUCT_TYPE.cup, material: MATERIAL.pp, shape: SHAPE.round, topDiameter: { value: '110', unit: 'mm' } },
      savedBy: ADMIN,
    });
    expect(!again.ok && again.error.code).toBe('SPEC_ID_EXISTS');
    const existing = !again.ok && again.error.code === 'SPEC_ID_EXISTS' ? (again.error.existing as { manufacturerStages: unknown }) : null;
    expect(existing?.manufacturerStages).toEqual({ specificationsReceived: 3, quoted: 2, sampling: 1, inProduction: 1 });
  });
});
