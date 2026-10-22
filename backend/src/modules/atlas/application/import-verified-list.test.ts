import { describe, expect, it, vi } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import type { VerifiedRow } from '../domain/import/verified-row.js';
import { ImportVerifiedList } from './import-verified-list.js';
import type { ImportReport, ImportReportSink } from './ports/import-report-sink.js';
import { SaveSpecId } from './save-spec-id.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';
import { InMemorySourcingRepository } from './testing/in-memory-sourcing-repository.js';
import { InMemorySpecIdRepository } from './testing/in-memory-spec-id-repository.js';

const SAVER = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented' };

const NO_QUOTE = { fobPerUnit: '', fobPerCase: '', fobTotal: '', moldCost: '', moldLeadTime: '', sampleLeadTime: '', productionLeadTime: '' };

/** Invented rows, numbered from 4 as the workbook's products are: never the verified list's own (constraints §6). */
function rows(...given: Partial<VerifiedRow>[]): VerifiedRow[] {
  return given.map((overrides, index) => ({
    row: index + 4,
    itemName: '',
    category: '',
    material: '',
    dimension: '',
    weight: '',
    company: '',
    country: '',
    quote: NO_QUOTE,
    unsavedFormulas: [],
    ...overrides,
  }));
}

function setup(given: VerifiedRow[]) {
  const dictionaries = new InMemoryDictionaryRepository();
  const specIds = new InMemorySpecIdRepository();
  specIds.nameSaver(SAVER.id, SAVER.fullName);
  const sourcing = new InMemorySourcingRepository();
  const clock = new FixedClock(new Date('2026-10-22T08:00:00.000Z'));
  const ids = new SequentialIdGenerator();
  const save = new SaveSpecId(dictionaries, specIds, clock, ids);
  const saveSpy = vi.spyOn(save, 'execute');
  const written: ImportReport[] = [];
  const sink: ImportReportSink = { write: async (report) => void written.push(report) };
  const importer = new ImportVerifiedList(dictionaries, specIds, sourcing, save, { rows: async () => given }, sink, clock, ids);
  const run = (write: boolean) => importer.execute({ write, savedBy: SAVER });
  return { run, specIds, sourcing, saveSpy, save, report: () => written.at(-1) as ImportReport };
}

const PP_CUP = { category: 'Cup', material: 'Plastic - PP' };

describe('ImportVerifiedList', () => {
  it('makes one Spec ID of three rows with one code, named by the item name most of them use', async () => {
    const { run, specIds, report } = setup(
      rows({ itemName: 'Invented cup', ...PP_CUP }, { itemName: 'Invented PP cup', ...PP_CUP }, { itemName: 'Invented PP cup', ...PP_CUP }),
    );

    const summary = await run(true);

    const saved = await specIds.list({ limit: 10 });
    expect(saved.map((record) => record.savedSpecId.name)).toEqual(['Invented PP cup']);
    expect(report().rows.map((line) => line.outcome)).toEqual(['new', 'same as row 4', 'same as row 4']);
    expect(summary).toMatchObject({ rows: 3, created: 1, sameAs: 2, alreadySaved: 0, skipped: 0 });
  });

  it('makes two Spec IDs of two rows with the same name and different facts', async () => {
    const { run, specIds } = setup(
      rows({ itemName: 'Invented cup', ...PP_CUP, dimension: '90' }, { itemName: 'Invented cup', ...PP_CUP, dimension: '80' }),
    );

    await run(true);

    expect(await specIds.list({ limit: 10 })).toHaveLength(2);
  });

  it('drops a fact the save rules refuse, reports it, and still saves the row', async () => {
    const { run, specIds, report } = setup(rows({ itemName: '14oz Invented lid', category: 'Lid', material: 'Plastic - PET' }));

    await run(true);

    const [line] = report().rows;
    expect(line?.outcome).toBe('new');
    expect(line?.dropped).toEqual([expect.stringMatching(/^Nominal capacity: /)]);
    expect(await specIds.list({ limit: 10 })).toHaveLength(1);
  });

  it('saves nothing in a dry run, and counts what it would create', async () => {
    const { run, specIds, saveSpy, report } = setup(rows({ itemName: 'Invented cup', ...PP_CUP }));

    const summary = await run(false);

    expect(saveSpy).not.toHaveBeenCalled();
    expect(await specIds.list({ limit: 10 })).toEqual([]);
    expect(summary.created).toBe(1);
    expect(report().rows[0]?.outcome).toBe('new');
  });

  it('flags a value read under a ruling with the ruling and the words', async () => {
    const { run, report } = setup(rows({ itemName: 'Invented lid', category: 'Lid', material: 'Plastic - PET', dimension: '90' }));

    await run(false);

    expect(report().rows[0]?.readFromRow).toContain('Top diameter: 90 mm (R1, from "90")');
  });

  it('skips a row with no product type, giving its row number and why', async () => {
    const { run, report } = setup(rows({ itemName: 'Invented cup', ...PP_CUP }, { itemName: 'Invented order', material: 'Plastic - PP' }));

    const summary = await run(false);

    expect(report().rows[1]).toMatchObject({
      row: 5,
      outcome: 'skipped',
      code: null,
      reason: 'No product type in the Category, Material or item name.',
    });
    expect(summary.skipped).toBe(1);
  });

  it('saves nothing the second time, and reports every saved row already saved', async () => {
    const { run, specIds, report } = setup(rows({ itemName: 'Invented cup', ...PP_CUP }, { itemName: 'Invented cup', ...PP_CUP }));

    await run(true);
    const second = await run(true);

    expect(await specIds.list({ limit: 10 })).toHaveLength(1);
    expect(second).toMatchObject({ created: 0, alreadySaved: 1 });
    expect(report().rows.map((line) => line.outcome)).toEqual(['already saved', 'already saved']);
  });

  it('counts how often the item name agrees with the columns, on rows where both give one', async () => {
    const { run } = setup(
      rows(
        { itemName: 'PP Cup', ...PP_CUP },
        { itemName: 'PET Cup', ...PP_CUP },
        { itemName: 'Invented drink', category: 'Cup' },
      ),
    );

    const summary = await run(false);

    expect(summary.agreement).toEqual({ agreed: 1, compared: 2 });
  });
});

describe('ImportVerifiedList, manufacturers and quotes (#56)', () => {
  const ACME = { company: 'Acme Packaging', country: 'Atlantis' };
  const BOREALIS = { company: 'Borealis Boxes', country: 'Lemuria' };
  const PRICED = { ...NO_QUOTE, fobPerUnit: '$0.0123', productionLeadTime: '30 days' };

  it('records each row against its own manufacturer, and a row with none as no manufacturer', async () => {
    const { run, sourcing, report } = setup(
      rows(
        { itemName: 'Invented cup', ...PP_CUP, ...ACME, quote: PRICED },
        { itemName: 'Invented lid', category: 'Lid', material: 'Plastic - PET', ...ACME },
        { itemName: 'Invented bowl', category: 'Bowl', material: 'Plastic - PP', ...BOREALIS },
        { itemName: 'Invented tray', category: 'Tray', material: 'Plastic - PP' },
      ),
    );

    const summary = await run(true);

    expect(sourcing.replaced).toBe(1);
    expect(sourcing.allManufacturers.map(({ name, country }) => [name, country])).toEqual([
      ['Acme Packaging', 'Atlantis'],
      ['Borealis Boxes', 'Lemuria'],
    ]);
    const byName = new Map(sourcing.allManufacturers.map((manufacturer) => [manufacturer.name, manufacturer.id]));
    expect(sourcing.allQuotes.map(({ manufacturerId, values }) => [manufacturerId, values.itemName])).toEqual([
      [byName.get('Acme Packaging'), 'Invented cup'],
      [byName.get('Acme Packaging'), 'Invented lid'],
      [byName.get('Borealis Boxes'), 'Invented bowl'],
    ]);
    expect(sourcing.allQuotes[0]?.values).toEqual({
      itemName: 'Invented cup',
      fobPerUnit: '$0.0123',
      fobPerCase: null,
      fobTotal: null,
      moldCost: null,
      moldLeadTime: null,
      sampleLeadTime: null,
      productionLeadTime: '30 days',
    });
    expect(report().rows.map(({ manufacturer, quote }) => [manufacturer, quote])).toEqual([
      ['found', 'recorded'],
      ['found', 'recorded'],
      ['found', 'recorded'],
      ['no manufacturer', 'not recorded'],
    ]);
    expect(summary).toMatchObject({ manufacturers: 2, quotes: 3 });
  });

  it('records the quote of a row whose code is already saved against that Spec ID, and saves no new one', async () => {
    const { run, specIds, sourcing, save, report } = setup(rows({ itemName: 'Invented cup', ...PP_CUP, ...ACME }));
    const seeded = await save.execute({ name: 'Invented seeded cup', facts: { productType: 'CUP', material: 'APP' }, savedBy: SAVER });
    if (!seeded.ok) throw new Error('setup failed');

    await run(true);

    expect(specIds.size).toBe(1);
    expect(report().rows[0]).toMatchObject({ outcome: 'already saved', quote: 'recorded' });
    expect(sourcing.allQuotes.map((quote) => quote.specId)).toEqual([seeded.value.id]);
  });

  it('leaves the number of quotes and manufacturers unchanged on a second --write', async () => {
    const { run, sourcing } = setup(rows({ itemName: 'Invented cup', ...PP_CUP, ...ACME }, { itemName: 'Invented cup', ...PP_CUP, ...ACME }));

    await run(true);
    const manufacturers = sourcing.allManufacturers;
    await run(true);

    expect(sourcing.allQuotes).toHaveLength(2);
    expect(sourcing.allManufacturers).toEqual(manufacturers);
  });

  it('records no manufacturer and no quote in a dry run, and counts what it would record', async () => {
    const { run, sourcing, report } = setup(rows({ itemName: 'Invented cup', ...PP_CUP, ...ACME }));

    const summary = await run(false);

    expect(sourcing.replaced).toBe(0);
    expect(sourcing.allManufacturers).toEqual([]);
    expect(report().rows[0]?.quote).toBe('recorded');
    expect(summary).toMatchObject({ manufacturers: 1, quotes: 1 });
  });

  it('records no quote for a row it skips, though it names a manufacturer', async () => {
    const { run, sourcing, report } = setup(rows({ itemName: 'Invented order', material: 'Plastic - PP', ...ACME }));

    const summary = await run(true);

    expect(report().rows[0]).toMatchObject({ outcome: 'skipped', manufacturer: 'found', quote: 'not recorded' });
    expect(sourcing.allQuotes).toEqual([]);
    expect(summary).toMatchObject({ manufacturers: 0, quotes: 0 });
  });

  it('flags a quote column whose formula has no saved value', async () => {
    const { run, report } = setup(rows({ itemName: 'Invented cup', ...PP_CUP, ...ACME, unsavedFormulas: ['fobPerUnit'] }));

    await run(false);

    expect(report().rows[0]?.flags).toEqual(['FOB per unit: a formula with no value saved in the workbook']);
  });
});
