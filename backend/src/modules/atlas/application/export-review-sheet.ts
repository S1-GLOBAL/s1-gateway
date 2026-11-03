import type { Clock } from '../../../shared/application/ports/clock.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { letterOf } from '../domain/code.js';
import type { Dictionary } from '../domain/dictionary.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import type { ImportedRow, ImportedRowRepository } from '../domain/import/imported-row.js';
import type { RowFact } from '../domain/import/verified-row.js';
import { CURRENT_RELEASE, DICTIONARY_SLOTS, slotDefinition } from '../domain/slots.js';
import type { SavedSpecIdRecord, SpecIdRepository } from '../domain/spec-id-repository.js';
import type { ImportReportRow, RowOutcome } from './ports/import-report-sink.js';
import type { ReviewSheetWriter } from './ports/review-sheet-writer.js';

/** The review workbook as a file to download. */
export interface ReviewSheetFile {
  /** `atlas-review-2026-11-04.xlsx`. */
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

const EMPTY_CELLS = { itemName: '', category: '', material: '', materialType: '', dimension: '', weight: '', printing: '' };

/**
 * The review workbook of the library as it stands (plan 0014): each row of
 * the last import, its cells beside what was read from them, with its Spec
 * ID's code now; then each Spec ID saved in Atlas rather than imported, with
 * no cells. A code changed in Atlas since the import is flagged. Nothing is
 * read again: the rows are kept as the import read them, so this is quick.
 */
export class ExportReviewSheet implements UseCase<void, ReviewSheetFile> {
  constructor(
    private readonly dictionaries: DictionaryRepository,
    private readonly specIds: SpecIdRepository,
    private readonly importedRows: ImportedRowRepository,
    private readonly writer: ReviewSheetWriter,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<ReviewSheetFile> {
    const dictionary = await this.dictionaries.get(CURRENT_RELEASE);
    if (!dictionary) throw new Error(`Dictionary ${CURRENT_RELEASE} is missing`);
    const imported = await this.importedRows.all();
    const saved = await this.specIds.list({ limit: Math.max(1, await this.specIds.count({})) });
    const byId = new Map(saved.map((record) => [record.savedSpecId.id, record]));

    const rows: ImportReportRow[] = imported.map((row) => lineOf(row, byId));
    const fromImport = new Set(imported.map((row) => row.specId).filter((id) => id !== null));
    for (const record of saved) if (!fromImport.has(record.savedSpecId.id)) rows.push(savedLineOf(record, dictionary));

    const codes = new Set(rows.map((row) => row.code).filter((code) => code !== null));
    const report = {
      summary: {
        rows: imported.length,
        created: 0,
        sameAs: rows.filter((row) => row.outcome.startsWith('same as row')).length,
        alreadySaved: codes.size,
        skipped: rows.filter((row) => row.outcome === 'skipped').length,
        manufacturers: 0,
        quotes: 0,
        agreement: {
          agreed: rows.filter((row) => row.categoryAgrees === true).length,
          compared: rows.filter((row) => row.categoryAgrees !== null).length,
        },
      },
      rows,
      options: DICTIONARY_SLOTS.flatMap((slot) =>
        dictionary.valuesOf(slot).map(({ number, meaning }) => ({ list: slotDefinition(slot).name, part: `${letterOf(slot)}${number}`, meaning })),
      ),
    };
    return { fileName: `atlas-review-${this.clock.now().toISOString().slice(0, 10)}.xlsx`, bytes: await this.writer.toBytes(report) };
  }
}

/** A row of the last import, with its Spec ID's code now; flagged when Atlas changed it since. */
function lineOf(row: ImportedRow, byId: ReadonlyMap<string, SavedSpecIdRecord>): ImportReportRow {
  const { reading } = row;
  const now = row.specId === null ? null : (byId.get(row.specId)?.savedSpecId.specId.code ?? null);
  const changed = reading.code !== null && now !== null && now !== reading.code;
  return {
    row: row.row,
    itemName: row.cells.itemName,
    source: row.cells,
    facts: reading.facts,
    leftOut: reading.leftOut,
    categoryAgrees: reading.categoryAgrees,
    outcome: reading.outcome as RowOutcome,
    code: now ?? reading.code,
    reason: reading.reason,
    readFromRow: [],
    dropped: reading.dropped,
    manufacturer: 'found',
    quote: 'recorded',
    flags: [
      ...reading.flags,
      ...(changed ? [`Changed in Atlas since the import: it was imported as ${reading.code}. The facts shown are as the import read them.`] : []),
    ],
  };
}

/** A Spec ID saved in Atlas rather than imported: its facts, from its code, and no cells. */
function savedLineOf(record: SavedSpecIdRecord, dictionary: Dictionary): ImportReportRow {
  const { savedSpecId } = record;
  const facts: RowFact[] = savedSpecId.specId
    .describe(dictionary)
    .filter((slot) => slot.state === 'value' && slot.key !== 'variant')
    .map(({ key, name, meaning }) => ({ key, name, meaning, words: '', cell: null, ruling: null }));
  return {
    row: 0,
    itemName: savedSpecId.name,
    source: { ...EMPTY_CELLS, itemName: savedSpecId.name },
    facts,
    leftOut: [],
    categoryAgrees: null,
    outcome: 'saved in Atlas',
    code: savedSpecId.specId.code,
    reason: null,
    readFromRow: [],
    dropped: [],
    manufacturer: 'found',
    quote: 'recorded',
    flags: [],
  };
}
