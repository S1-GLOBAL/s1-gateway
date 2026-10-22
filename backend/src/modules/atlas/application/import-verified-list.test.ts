import { describe, expect, it, vi } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import type { VerifiedRow } from '../domain/import/verified-row.js';
import { ImportVerifiedList } from './import-verified-list.js';
import type { ImportReport, ImportReportSink } from './ports/import-report-sink.js';
import { SaveSpecId } from './save-spec-id.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';
import { InMemorySpecIdRepository } from './testing/in-memory-spec-id-repository.js';

const SAVER = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented' };

/** Invented rows, numbered from 4 as the workbook's products are: never the verified list's own (constraints §6). */
function rows(...given: Partial<VerifiedRow>[]): VerifiedRow[] {
  return given.map((overrides, index) => ({
    row: index + 4,
    itemName: '',
    category: '',
    material: '',
    dimension: '',
    weight: '',
    ...overrides,
  }));
}

function setup(given: VerifiedRow[]) {
  const dictionaries = new InMemoryDictionaryRepository();
  const specIds = new InMemorySpecIdRepository();
  specIds.nameSaver(SAVER.id, SAVER.fullName);
  const save = new SaveSpecId(dictionaries, specIds, new FixedClock(new Date('2026-10-22T08:00:00.000Z')), new SequentialIdGenerator());
  const saveSpy = vi.spyOn(save, 'execute');
  const written: ImportReport[] = [];
  const sink: ImportReportSink = { write: async (report) => void written.push(report) };
  const importer = new ImportVerifiedList(dictionaries, specIds, save, { rows: async () => given }, sink);
  const run = (write: boolean) => importer.execute({ write, savedBy: SAVER });
  return { run, specIds, saveSpy, report: () => written.at(-1) as ImportReport };
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
    expect(summary).toMatchObject({ rows: 3, created: 1, alreadySaved: 0, skipped: 0 });
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
