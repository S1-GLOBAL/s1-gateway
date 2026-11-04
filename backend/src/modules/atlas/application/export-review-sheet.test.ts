import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import type { ImportedRow } from '../domain/import/imported-row.js';
import { MATERIAL, PRODUCT_TYPE } from '../domain/options.js';
import { ExportReviewSheet } from './export-review-sheet.js';
import { LibraryReviewReport } from './library-review-report.js';
import type { ImportReport } from './ports/import-report-sink.js';
import { SaveSpecId } from './save-spec-id.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';
import { InMemoryImportedRowRepository } from './testing/in-memory-imported-row-repository.js';
import { InMemorySourcingRepository } from './testing/in-memory-sourcing-repository.js';
import { InMemorySpecIdRepository } from './testing/in-memory-spec-id-repository.js';

const SAVER = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented' };
const CELLS = { itemName: '', category: '', material: '', materialType: '', dimension: '', weight: '', printing: '' };
const AT = new Date('2026-11-04T08:00:00.000Z');

/** An invented imported row: never one of the verified list's own (constraints §6). */
function imported(row: number, specId: string | null, code: string | null, itemName: string): ImportedRow {
  return {
    row,
    specId,
    cells: { ...CELLS, itemName, materialType: 'PP' },
    reading: {
      outcome: specId === null ? 'skipped' : 'new',
      code,
      reason: specId === null ? 'No product type in the item name.' : null,
      facts: specId === null ? [] : [{ key: 'material', name: 'Material', meaning: 'Polymer, PP', words: 'PP', cell: 'Material type', ruling: null }],
      leftOut: [],
      flags: [],
      dropped: [],
      categoryAgrees: null,
    },
    importedAt: AT,
  };
}

async function setup() {
  const dictionaries = new InMemoryDictionaryRepository();
  const specIds = new InMemorySpecIdRepository();
  specIds.nameSaver(SAVER.id, SAVER.fullName);
  const save = new SaveSpecId(dictionaries, specIds, new InMemorySourcingRepository(), new FixedClock(AT), new SequentialIdGenerator());
  const cup = await save.execute({ name: 'Invented PP cup', facts: { productType: PRODUCT_TYPE.cup, material: MATERIAL.pp }, savedBy: SAVER });
  const bowl = await save.execute({ name: 'Invented bowl, saved by hand', facts: { productType: PRODUCT_TYPE.bowl, material: MATERIAL.bagasse }, savedBy: SAVER });
  if (!cup.ok || !bowl.ok) throw new Error('setup failed');
  const importedRows = new InMemoryImportedRowRepository();
  const reports: ImportReport[] = [];
  const exporter = new ExportReviewSheet(
    new LibraryReviewReport(dictionaries, specIds, importedRows),
    { toBytes: async (report) => (reports.push(report), new Uint8Array([1])) },
    new FixedClock(AT),
  );
  return { exporter, importedRows, cup: cup.value, bowl: bowl.value, report: () => reports.at(-1) as ImportReport };
}

describe('ExportReviewSheet (plan 0014)', () => {
  it('sets out each imported row with its cells, what was read, and its Spec ID as it is now; a skipped row stays skipped', async () => {
    const { exporter, importedRows, cup, report } = await setup();
    await importedRows.replace([imported(4, cup.id, cup.code, 'Invented PP cup'), imported(5, null, null, 'Invented sample')]);

    const file = await exporter.execute();

    expect(file.fileName).toBe('atlas-spec-ids-2026-11-04.xlsx');
    expect([...file.bytes]).toEqual([1]);
    const [first, second] = report().rows;
    expect(first).toMatchObject({ row: 4, code: cup.code, outcome: 'new', source: { itemName: 'Invented PP cup', materialType: 'PP' }, flags: [] });
    expect(first?.facts[0]).toMatchObject({ meaning: 'Polymer, PP', cell: 'Material type' });
    expect(second).toMatchObject({ row: 5, code: null, outcome: 'skipped', reason: 'No product type in the item name.' });
  });

  it('flags a row whose Spec ID was changed in Atlas since the import, showing its code now', async () => {
    const { exporter, importedRows, cup, report } = await setup();
    await importedRows.replace([imported(4, cup.id, 'A5B99', 'Invented PP cup')]);

    await exporter.execute();

    const [row] = report().rows;
    expect(row?.code).toBe(cup.code);
    expect(row?.flags).toEqual([
      'Changed in Atlas since the import: it was imported as A5B99. The facts shown are as the import read them.',
    ]);
  });

  it('adds each Spec ID saved in Atlas rather than imported, with its facts and no workbook row', async () => {
    const { exporter, importedRows, cup, bowl, report } = await setup();
    await importedRows.replace([imported(4, cup.id, cup.code, 'Invented PP cup')]);

    await exporter.execute();

    const byHand = report().rows.find((row) => row.outcome === 'saved in Atlas');
    expect(byHand).toMatchObject({ row: 0, itemName: 'Invented bowl, saved by hand', code: bowl.code });
    expect(byHand?.facts.map(({ name, meaning }) => `${name}: ${meaning}`)).toEqual(['Product type: Bowl', 'Material: Molded fibre, bagasse']);
    expect(report().rows).toHaveLength(2);
  });

  it('decodes every option of the dictionary', async () => {
    const { exporter, report } = await setup();
    await exporter.execute();
    expect(report().options).toContainEqual({ list: 'Product type', part: 'A35', meaning: 'Glove' });
  });
});
