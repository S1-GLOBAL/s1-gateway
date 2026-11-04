import { describe, expect, it } from 'vitest';
import type { ImportedCells } from '../domain/import/imported-row.js';
import type { RowFact } from '../domain/import/verified-row.js';
import { importedRowKey, savedSpecIdKey, type KeyedReviewReport } from './library-review-report.js';
import { NO_LONGER_IN_ATLAS } from './plan-rows-sync.js';
import type { ImportReport, ImportReportRow } from './ports/import-report-sink.js';
import { ReviewSheetSyncError } from './ports/review-spreadsheet.js';
import { KEY_COLUMN, reviewLayout } from './review-sheet-layout.js';
import { SyncReviewSheet } from './sync-review-sheet.js';
import { InMemoryReviewSpreadsheet } from './testing/in-memory-review-spreadsheet.js';

/*
 * Every line, cell and name here is invented: never the verified list's own
 * (constraints §6).
 */

const EMPTY: ImportedCells = { itemName: '', category: '', material: '', materialType: '', dimension: '', weight: '', printing: '' };

function line(overrides: Partial<ImportReportRow> & Pick<ImportReportRow, 'row' | 'itemName'>): ImportReportRow {
  return {
    source: { ...EMPTY, itemName: overrides.itemName },
    facts: [],
    leftOut: [],
    categoryAgrees: null,
    outcome: 'new',
    code: null,
    reason: null,
    readFromRow: [],
    dropped: [],
    manufacturer: 'found',
    quote: 'recorded',
    flags: [],
    ...overrides,
  };
}

const BOWL = line({
  row: 4,
  itemName: 'Invented bowl',
  source: { ...EMPTY, itemName: 'Invented bowl', material: 'Bagasse', dimension: '180 Dia' },
  code: 'A3B25-H180',
  facts: [
    { key: 'productType', name: 'Product type', meaning: 'Bowl', words: 'bowl', cell: 'Item name', ruling: null },
    { key: 'material', name: 'Material', meaning: 'Molded fibre, bagasse', words: 'Bagasse', cell: 'Material', ruling: null },
    { key: 'topDiameter', name: 'Top diameter', meaning: '180 mm', words: '', cell: 'Dimension', ruling: null },
  ],
});
const NAPKIN = line({
  row: 6,
  itemName: 'Invented napkin',
  source: { ...EMPTY, itemName: 'Invented napkin', dimension: '16 x 14' },
  code: 'A17-K16',
  facts: [
    { key: 'productType', name: 'Product type', meaning: 'Napkin', words: 'napkin', cell: 'Item name', ruling: null },
    { key: 'length', name: 'Length', meaning: '16 mm', words: '16 x 14', cell: 'Dimension', ruling: 'R6' },
  ],
  flags: ['16 x 14 has no unit, so it was read in millimetres (#58).'],
});
const SKIPPED = line({ row: 7, itemName: 'Invented thing', outcome: 'skipped', reason: 'No product type in the item name.' });
const LID_ID = '00000000-0000-4000-8000-00000000001d';
const LID = line({
  row: 0,
  itemName: 'Invented lid, saved by hand',
  outcome: 'saved in Atlas',
  code: 'A1B4',
  facts: [{ key: 'productType', name: 'Product type', meaning: 'Lid', words: '', cell: null, ruling: null }],
});

/** The library's review: imported rows keyed by number and cells, a Spec ID saved in Atlas by its id. */
function library(rows: readonly ImportReportRow[]): KeyedReviewReport {
  const report: ImportReport = {
    summary: { rows: rows.length, created: 0, sameAs: 0, alreadySaved: 0, skipped: 0, manufacturers: 0, quotes: 0, agreement: { agreed: 0, compared: 0 } },
    rows,
    options: [{ list: 'Product type', part: 'A3', meaning: 'Bowl' }],
  };
  return { report, keys: rows.map((row) => (row.row === 0 ? savedSpecIdKey(LID_ID) : importedRowKey(row.row, row.source))) };
}

/** A sheet holding the review workbook's Rows tab as it was uploaded, before Atlas kept it: no keys. */
async function uploaded(rows: readonly ImportReportRow[]): Promise<InMemoryReviewSpreadsheet> {
  const sheet = new InMemoryReviewSpreadsheet();
  await sheet.replace(reviewLayout(library(rows).report).rows, null, { tab: -1, rowOf: () => null });
  sheet.calls.length = 0;
  return sheet;
}

function setup(sheet: InMemoryReviewSpreadsheet, rows: readonly ImportReportRow[]) {
  let current = library(rows);
  const sync = new SyncReviewSheet({ read: async () => current }, sheet);
  return {
    sync,
    /** The library changes. */
    become(next: readonly ImportReportRow[]) {
      current = library(next);
    },
  };
}

/** The Rows tab's column of a header, and its rows as text. */
function rowsOf(sheet: InMemoryReviewSpreadsheet) {
  const text = sheet.textOf('Rows');
  const header = text[1] ?? [];
  const column = (name: string): number => {
    const index = header.indexOf(name);
    if (index === -1) throw new Error(`No ${name} column`);
    return index;
  };
  const lineOf = (itemName: string): string[] => {
    const found = text.find((row) => row[column('Item name')] === itemName);
    if (!found) throw new Error(`No line for ${itemName}`);
    return found;
  };
  return { text, header, column, lineOf, cell: (itemName: string, name: string) => lineOf(itemName)[column(name)] ?? '' };
}

/** A reviewer's verdict on a line, typed into the tab. */
function review(sheet: InMemoryReviewSpreadsheet, itemName: string, verdict: string, wrong = '', reviewer = 'Invented Reviewer') {
  const { text, column } = rowsOf(sheet);
  const row = text.findIndex((cells) => cells[column('Item name')] === itemName);
  sheet.type('Rows', row, column('Correct?'), verdict);
  if (wrong !== '') sheet.type('Rows', row, column("What's wrong"), wrong);
  sheet.type('Rows', row, column('Reviewer'), reviewer);
}

describe('SyncReviewSheet (plan 0016)', () => {
  it('takes the uploaded workbook as its own, writing only each line\'s hidden key, and keeps every review', async () => {
    const sheet = await uploaded([BOWL, NAPKIN, SKIPPED]);
    review(sheet, 'Invented bowl', 'Yes');
    review(sheet, 'Invented napkin', 'No', 'It is 16 x 14 inches');
    const before = rowsOf(sheet).text;
    const { sync } = setup(sheet, [BOWL, NAPKIN, SKIPPED]);

    const summary = await sync.execute();

    expect(summary).toMatchObject({ columnsAdded: [KEY_COLUMN], adopted: 3, updated: 0, added: 0, removed: 0, madeRows: false, changes: [] });
    const after = rowsOf(sheet);
    // Every cell as it was, with the key beside it.
    const width = before[1]?.length ?? 0;
    const padded = (rows: string[][]) => rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ''));
    expect(padded(after.text)).toEqual(padded(before));
    expect(after.cell('Invented napkin', KEY_COLUMN)).toBe(importedRowKey(6, NAPKIN.source));
    expect(sheet.hiddenColumns('Rows')).toEqual([after.column(KEY_COLUMN)]);
    expect(after.cell('Invented napkin', "What's wrong")).toBe('It is 16 x 14 inches');
    expect(sheet.names()).toEqual(['Rows', 'How to read this', 'Spec IDs', 'Needs a look', 'Dictionary']);
  });

  it('writes nothing to the Rows tab when nothing it shows has changed', async () => {
    const sheet = await uploaded([BOWL, NAPKIN]);
    const { sync } = setup(sheet, [BOWL, NAPKIN]);
    await sync.execute();
    sheet.calls.length = 0;

    const summary = await sync.execute();

    expect(summary).toMatchObject({ adopted: 0, updated: 0, added: 0, removed: 0, columnsAdded: [] });
    expect(sheet.calls.filter((call) => call.startsWith('edit'))).toEqual([]);
  });

  it('changes a code in place, beside its review, and only that cell', async () => {
    const sheet = await uploaded([BOWL, NAPKIN]);
    const { sync, become } = setup(sheet, [BOWL, NAPKIN]);
    await sync.execute();
    review(sheet, 'Invented bowl', 'Yes');
    const before = rowsOf(sheet).lineOf('Invented bowl');

    become([{ ...BOWL, code: 'A3B25-H181' }, NAPKIN]);
    const summary = await sync.execute();

    expect(summary.updated).toBe(1);
    expect(summary.changes).toEqual([{ row: 3, column: 'Code', from: 'A3B25-H180', to: 'A3B25-H181' }]);
    const after = rowsOf(sheet);
    const changed = [...before];
    changed[after.column('Code')] = 'A3B25-H181';
    expect(after.lineOf('Invented bowl')).toEqual(changed);
  });

  it('finds each line by its key however the tab was sorted, its review with it', async () => {
    const sheet = await uploaded([BOWL, NAPKIN, SKIPPED]);
    const { sync, become } = setup(sheet, [BOWL, NAPKIN, SKIPPED]);
    await sync.execute();
    review(sheet, 'Invented bowl', 'Yes');
    review(sheet, 'Invented napkin', 'No', 'Inches');
    sheet.sort('Rows', 2, rowsOf(sheet).column('Item name'), true);

    become([BOWL, { ...NAPKIN, code: 'A17-K406' }, SKIPPED]);
    await sync.execute();

    const after = rowsOf(sheet);
    expect(after.text.slice(2).map((row) => row[after.column('Item name')])).toEqual(['Invented thing', 'Invented napkin', 'Invented bowl']);
    expect([after.cell('Invented napkin', 'Code'), after.cell('Invented napkin', 'Correct?'), after.cell('Invented napkin', "What's wrong")]).toEqual(['A17-K406', 'No', 'Inches']);
    expect([after.cell('Invented bowl', 'Code'), after.cell('Invented bowl', 'Correct?')]).toEqual(['A3B25-H180', 'Yes']);
  });

  it('keeps a line Atlas no longer has, with its review, its Outcome saying so, and says it once', async () => {
    const sheet = await uploaded([BOWL, NAPKIN]);
    const { sync, become } = setup(sheet, [BOWL, NAPKIN]);
    await sync.execute();
    review(sheet, 'Invented napkin', 'No', 'Inches');

    become([BOWL]);
    expect((await sync.execute()).removed).toBe(1);
    expect((await sync.execute()).removed).toBe(0);

    const after = rowsOf(sheet);
    expect([after.cell('Invented napkin', 'Outcome'), after.cell('Invented napkin', 'Code'), after.cell('Invented napkin', 'Correct?')]).toEqual([
      NO_LONGER_IN_ATLAS,
      'A17-K16',
      'No',
    ]);
  });

  it('adds a new Spec ID below the last line, offering Yes, No or Unsure', async () => {
    const sheet = await uploaded([BOWL, NAPKIN]);
    const { sync, become } = setup(sheet, [BOWL, NAPKIN]);
    await sync.execute();

    become([BOWL, NAPKIN, LID]);
    const summary = await sync.execute();

    expect(summary.added).toBe(1);
    const after = rowsOf(sheet);
    expect(after.text).toHaveLength(5);
    expect([after.cell(LID.itemName, 'Row'), after.cell(LID.itemName, 'Code'), after.cell(LID.itemName, 'Outcome'), after.cell(LID.itemName, KEY_COLUMN)]).toEqual([
      '',
      'A1B4',
      'saved in Atlas',
      savedSpecIdKey(LID_ID),
    ]);
    expect(sheet.hasVerdict('Rows', 4, after.column('Correct?'))).toBe(true);
  });

  it('makes a row whose cells changed in a later import a new line, and leaves the old with its review', async () => {
    const sheet = await uploaded([BOWL, NAPKIN]);
    const { sync, become } = setup(sheet, [BOWL, NAPKIN]);
    await sync.execute();
    review(sheet, 'Invented napkin', 'Yes');

    const reworded = { ...NAPKIN, source: { ...NAPKIN.source, dimension: '16 x 16' } };
    become([BOWL, reworded]);
    const summary = await sync.execute();

    expect(summary).toMatchObject({ removed: 1, added: 1 });
    const napkins = rowsOf(sheet).text.filter((row) => row[rowsOf(sheet).column('Item name')] === 'Invented napkin');
    const { column } = rowsOf(sheet);
    expect(napkins.map((row) => [row[column('Dimension')], row[column('Outcome')], row[column('Correct?')] ?? ''])).toEqual([
      ['16 x 14', NO_LONGER_IN_ATLAS, 'Yes'],
      ['16 x 16', 'new', ''],
    ]);
  });

  it('inserts a fact column the tab lacks among the facts, and the reviews move with their columns', async () => {
    const sheet = await uploaded([BOWL, NAPKIN]);
    const { sync, become } = setup(sheet, [BOWL, NAPKIN]);
    await sync.execute();
    review(sheet, 'Invented napkin', 'No', 'Width missing');

    const width: RowFact = { key: 'width', name: 'Width', meaning: '14 mm', words: '16 x 14', cell: 'Dimension', ruling: 'R6' };
    become([BOWL, { ...NAPKIN, code: 'A17-K16L14', facts: [...NAPKIN.facts, width] }]);
    const summary = await sync.execute();

    expect(summary.columnsAdded).toEqual(['Width (L)']);
    const after = rowsOf(sheet);
    expect(after.column('Width (L)')).toBe(after.column('Length (K)') + 1);
    expect(after.column('Left out')).toBe(after.column('Width (L)') + 1);
    expect([after.cell('Invented napkin', 'Width (L)'), after.cell('Invented napkin', 'Correct?'), after.cell('Invented napkin', "What's wrong")]).toEqual([
      '14 mm',
      'No',
      'Width missing',
    ]);
    expect(sheet.noteAt('Rows', 3, after.column('Width (L)'))).toBe('From Dimension: "16 x 14", read under R6');
    expect(sheet.hiddenColumns('Rows')).toEqual([after.column(KEY_COLUMN) - 1]);
  });

  it("leaves a reviewer's own columns and lines alone, and puts the key after their columns", async () => {
    const sheet = await uploaded([BOWL]);
    const width = rowsOf(sheet).header.length;
    sheet.type('Rows', 1, width, 'Checked twice?');
    sheet.type('Rows', 2, width, 'Yes, twice');
    sheet.type('Rows', 5, rowsOf(sheet).column("What's wrong"), 'A note of our own, below the lines');
    const { sync } = setup(sheet, [BOWL]);

    await sync.execute();

    const after = rowsOf(sheet);
    expect(after.column(KEY_COLUMN)).toBe(width + 1);
    expect(after.cell('Invented bowl', 'Checked twice?')).toBe('Yes, twice');
    expect(after.text[5]?.[after.column("What's wrong")]).toBe('A note of our own, below the lines');
    expect(after.text[5]?.[after.column('Outcome')] ?? '').toBe('');
  });

  it('takes a Spec ID saved in Atlas as its own by its code, though its name changed since the upload', async () => {
    const sheet = await uploaded([BOWL, LID]);
    review(sheet, LID.itemName, 'Unsure');
    const renamed = 'Invented lid, renamed';
    const { sync } = setup(sheet, [BOWL, { ...LID, itemName: renamed, source: { ...LID.source, itemName: renamed } }]);

    const summary = await sync.execute();

    expect(summary).toMatchObject({ adopted: 2, updated: 1, added: 0, removed: 0 });
    expect([rowsOf(sheet).cell('Invented lid, renamed', 'Correct?'), rowsOf(sheet).cell('Invented lid, renamed', KEY_COLUMN)]).toEqual([
      'Unsure',
      savedSpecIdKey(LID_ID),
    ]);
  });

  it('does not take a numbered line whose item name differs: it is kept, marked, and the row is added anew', async () => {
    const sheet = await uploaded([BOWL]);
    sheet.type('Rows', 2, rowsOf(sheet).column('Item name'), 'Invented bowl, as someone retyped it');
    const { sync } = setup(sheet, [BOWL]);

    const summary = await sync.execute();

    expect(summary).toMatchObject({ adopted: 0, removed: 1, added: 1 });
    expect(rowsOf(sheet).cell('Invented bowl, as someone retyped it', 'Outcome')).toBe(NO_LONGER_IN_ATLAS);
    expect(rowsOf(sheet).cell('Invented bowl', 'Code')).toBe('A3B25-H180');
  });

  it('writes nothing to a Rows tab with no header naming Code and Correct?', async () => {
    const sheet = new InMemoryReviewSpreadsheet();
    sheet.addTab('Rows', [['Our own notes'], ['Row', 'Item name', 'Code']]);
    const { sync } = setup(sheet, [BOWL]);

    await expect(sync.execute()).rejects.toThrow(ReviewSheetSyncError);
    expect(sheet.calls.filter((call) => call.startsWith('edit') || call.startsWith('replace'))).toEqual([]);
    expect(sheet.textOf('Rows')).toEqual([['Our own notes'], ['Row', 'Item name', 'Code']]);
  });

  it('plans again when someone sorts the tab between its reading and its writing', async () => {
    const sheet = await uploaded([BOWL, NAPKIN, SKIPPED]);
    const { sync, become } = setup(sheet, [BOWL, NAPKIN, SKIPPED]);
    await sync.execute();
    review(sheet, 'Invented bowl', 'Yes');
    sheet.calls.length = 0;
    sheet.onRead = (reads) => {
      if (reads === 4) sheet.sort('Rows', 2, rowsOf(sheet).column('Item name'), true);
    };

    become([{ ...BOWL, code: 'A3B25-H181' }, NAPKIN, SKIPPED]);
    await sync.execute();

    expect(sheet.calls.filter((call) => call === 'read Rows')).toHaveLength(3);
    expect([rowsOf(sheet).cell('Invented bowl', 'Code'), rowsOf(sheet).cell('Invented bowl', 'Correct?')]).toEqual(['A3B25-H181', 'Yes']);
    expect(rowsOf(sheet).cell('Invented thing', 'Code')).toBe('');
  });

  it('gives up for now, writing nothing, when the tab keeps moving', async () => {
    const sheet = await uploaded([BOWL, NAPKIN]);
    const { sync, become } = setup(sheet, [BOWL, NAPKIN]);
    await sync.execute();
    let descending = false;
    sheet.onRead = () => {
      descending = !descending;
      sheet.sort('Rows', 2, rowsOf(sheet).column('Item name'), descending);
    };
    sheet.calls.length = 0;

    become([{ ...BOWL, code: 'A3B25-H181' }, NAPKIN]);

    await expect(sync.execute()).rejects.toThrow('kept changing');
    expect(sheet.calls.filter((call) => call.startsWith('edit') || call.startsWith('replace'))).toEqual([]);
  });

  it('makes the Rows tab whole on an empty sheet, its key hidden, and links each line to look at to its row', async () => {
    const sheet = new InMemoryReviewSpreadsheet();
    const { sync } = setup(sheet, [BOWL, NAPKIN, SKIPPED]);

    const summary = await sync.execute();

    expect(summary).toMatchObject({ madeRows: true, added: 3 });
    const after = rowsOf(sheet);
    expect(after.header.at(-1)).toBe(KEY_COLUMN);
    expect(sheet.hiddenColumns('Rows')).toEqual([after.header.length - 1]);
    expect(sheet.hasVerdict('Rows', 2, after.column('Correct?'))).toBe(true);
    // Needs a look: the skipped row first, linked to its line on Rows, the fourth row (index 4).
    const needs = sheet.textOf('Needs a look');
    expect(needs[1]?.slice(0, 3)).toEqual(['1', 'Skipped: No product type in the item name.', '7']);
    expect(sheet.linkAt('Needs a look', 1, 2)).toMatch(/^\d+:4$/);
  });

  it('links each line to look at to its row as the tab is sorted now', async () => {
    const sheet = await uploaded([BOWL, NAPKIN, SKIPPED]);
    const { sync } = setup(sheet, [BOWL, NAPKIN, SKIPPED]);
    await sync.execute();
    sheet.sort('Rows', 2, rowsOf(sheet).column('Item name'), true);

    await sync.execute();

    // The skipped row, Invented thing, is first now: row index 2.
    expect(sheet.linkAt('Needs a look', 1, 2)).toMatch(/^\d+:2$/);
  });

  it("leaves a reviewer's note on Atlas's cell as it is, and keeps a fact's note, where it was read, in step", async () => {
    const sheet = await uploaded([BOWL, NAPKIN]);
    const { sync, become } = setup(sheet, [BOWL, NAPKIN]);
    await sync.execute();
    const { column } = rowsOf(sheet);
    sheet.annotate('Rows', 2, column('Code'), 'Checked with the supplier');

    // The diameter read again, its words now known.
    const reread: RowFact = { key: 'topDiameter', name: 'Top diameter', meaning: '180 mm', words: '180 Dia', cell: 'Dimension', ruling: null };
    become([{ ...BOWL, code: 'A3B25-H181', facts: [...BOWL.facts.slice(0, 2), reread] }, NAPKIN]);
    const summary = await sync.execute();

    expect(sheet.noteAt('Rows', 2, column('Code'))).toBe('Checked with the supplier');
    expect(rowsOf(sheet).cell('Invented bowl', 'Code')).toBe('A3B25-H181');
    expect(sheet.noteAt('Rows', 2, column('Top diameter (H)'))).toBe('From Dimension: "180 Dia"');
    expect(summary.changes).toEqual([
      { row: 3, column: 'Code', from: 'A3B25-H180', to: 'A3B25-H181' },
      { row: 3, column: 'Top diameter (H), its note', from: 'From Dimension', to: 'From Dimension: "180 Dia"' },
    ]);
  });

  it('in a dry run, lists each cell it would change and writes nothing', async () => {
    const sheet = await uploaded([BOWL, NAPKIN]);
    const { sync, become } = setup(sheet, [BOWL, NAPKIN]);
    await sync.execute();
    sheet.calls.length = 0;

    become([{ ...BOWL, code: 'A3B25-H181' }]);
    const summary = await sync.execute({ dryRun: true });

    expect(summary).toMatchObject({ dryRun: true, updated: 1, removed: 1 });
    expect(summary.changes).toEqual([
      { row: 3, column: 'Code', from: 'A3B25-H180', to: 'A3B25-H181' },
      { row: 4, column: 'Outcome', from: 'new', to: NO_LONGER_IN_ATLAS },
    ]);
    expect(sheet.calls.filter((call) => call.startsWith('edit') || call.startsWith('replace'))).toEqual([]);
  });
});
