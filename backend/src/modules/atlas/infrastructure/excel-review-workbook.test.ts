import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ImportReport, ImportReportRow } from '../application/ports/import-report-sink.js';
import { compareCodes, partsOfCode } from '../application/review-sheet-layout.js';
import { ExcelReviewSheetWriter, ExcelReviewWorkbook } from './excel-review-workbook.js';

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'review-workbook-'));
});
afterEach(() => rm(folder, { recursive: true, force: true }));

const EMPTY = { itemName: '', category: '', material: '', materialType: '', dimension: '', weight: '', printing: '' };

/** An invented row: never one of the verified list's own (constraints §6). */
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
  itemName: 'Invented 20 oz Oil Coated Bowl',
  source: { ...EMPTY, itemName: 'Invented 20 oz Oil Coated Bowl', category: 'Invented bowls', material: 'Bagasse', dimension: '180 Dia 45 H' },
  code: 'A3B25-G120H180J45',
  categoryAgrees: true,
  facts: [
    { key: 'productType', name: 'Product type', meaning: 'Bowl', words: 'Bowl', cell: 'Item name', ruling: null },
    { key: 'material', name: 'Material', meaning: 'Molded fibre, bagasse', words: 'Bagasse', cell: 'Material', ruling: null },
    { key: 'capacity', name: 'Nominal capacity', meaning: '20 oz', words: '20 oz', cell: 'Item name', ruling: null },
    { key: 'topDiameter', name: 'Top diameter', meaning: '180 mm', words: '', cell: 'Dimension', ruling: null },
    { key: 'height', name: 'Height', meaning: '45 mm', words: '', cell: 'Dimension', ruling: null },
  ],
  leftOut: ['Invented', 'Oil'],
});

const REPORT: ImportReport = {
  summary: { rows: 4, created: 2, sameAs: 1, alreadySaved: 0, skipped: 1, manufacturers: 1, quotes: 3, agreement: { agreed: 1, compared: 2 } },
  rows: [
    BOWL,
    line({ row: 5, itemName: 'Invented bowl, another name', code: BOWL.code, outcome: 'same as row 4', facts: BOWL.facts }),
    line({
      row: 6,
      itemName: 'Invented napkin',
      code: 'A17B24-K16L14',
      categoryAgrees: false,
      facts: [{ key: 'length', name: 'Length', meaning: '16 mm', words: '16 x 14', cell: 'Dimension', ruling: 'R6' }],
      flags: ['16 x 14 has no unit, so it was read in millimetres (#58). That is small for Napkin (A17): check the unit.'],
    }),
    line({ row: 7, itemName: 'Invented thing', outcome: 'skipped', reason: 'No product type in the item name.', quote: 'not recorded' }),
  ],
  options: [
    { list: 'Product type', part: 'A3', meaning: 'Bowl' },
    { list: 'Material', part: 'B25', meaning: 'Molded fibre, bagasse' },
  ],
};

async function written(): Promise<ExcelJS.Workbook> {
  const path = join(folder, 'review.xlsx');
  await new ExcelReviewWorkbook(path).write(REPORT);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  return workbook;
}

/** The column of a header on a sheet's header row. */
function columnOf(sheet: ExcelJS.Worksheet, header: string, row = 2): number {
  const values = sheet.getRow(row).values as unknown[];
  const index = values.indexOf(header);
  if (index < 1) throw new Error(`No ${header} column`);
  return index;
}

describe('ExcelReviewWorkbook (plan 0013)', () => {
  it('opens on how to read it, then the rows, the Spec IDs, the rows to look at first and the dictionary', async () => {
    const workbook = await written();
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['How to read this', 'Rows', 'Spec IDs', 'Needs a look', 'Dictionary']);
  });

  it('sets each row out as written, made, read and reviewed, a fact only in a column the rows use', async () => {
    const sheet = (await written()).getWorksheet('Rows') as ExcelJS.Worksheet;
    expect(sheet.getRow(1).getCell(1).value).toBe('What the workbook said');
    expect((sheet.getRow(2).values as unknown[]).slice(1, 12)).toEqual([
      'Row', 'Item name', 'Category', 'Material', 'Material type', 'Dimension', 'Weight', 'Printing', 'Code', 'Outcome', 'Category agrees?',
    ]);
    expect(sheet.getRow(2).values).toContain('Top diameter (H)');
    expect(sheet.getRow(2).values).not.toContain('Gusset (M)');

    const bowl = sheet.getRow(3);
    expect(bowl.getCell(columnOf(sheet, 'Dimension')).value).toBe('180 Dia 45 H');
    expect(bowl.getCell(columnOf(sheet, 'Code')).value).toBe('A3B25-G120H180J45');
    expect(bowl.getCell(columnOf(sheet, 'Category agrees?')).value).toBe('Yes');
    expect(bowl.getCell(columnOf(sheet, 'Material (B)')).value).toBe('Molded fibre, bagasse');
    expect(bowl.getCell(columnOf(sheet, 'Material (B)')).note).toBe('From Material: "Bagasse"');
    expect(bowl.getCell(columnOf(sheet, 'Height (J)')).note).toBe('From Dimension');
    expect(bowl.getCell(columnOf(sheet, 'Left out')).value).toBe('Invented, Oil');
    expect(sheet.getRow(5).getCell(columnOf(sheet, 'Length (K)')).note).toBe('From Dimension: "16 x 14", read under R6');
    expect(sheet.getRow(6).getCell(columnOf(sheet, 'Outcome')).value).toBe('skipped: No product type in the item name.');
  });

  it('offers Yes, No or Unsure under Correct?, and leaves the review to the reviewer', async () => {
    const sheet = (await written()).getWorksheet('Rows') as ExcelJS.Worksheet;
    const verdict = sheet.getRow(3).getCell(columnOf(sheet, 'Correct?'));
    expect(verdict.value).toBeNull();
    expect(verdict.dataValidation).toMatchObject({ type: 'list', formulae: ['"Yes,No,Unsure"'] });
  });

  it('lists each code once, with the rows that share it, and says when their names differ', async () => {
    const sheet = (await written()).getWorksheet('Spec IDs') as ExcelJS.Worksheet;
    const bowl = sheet.getRow(3);
    expect((sheet.getRow(1).values as unknown[]).slice(1, 8)).toEqual(['Code', 'Facts', 'Sizes', 'Rows', 'Row numbers', 'Item names', 'Names differ?']);
    expect([1, 2, 3, 4, 5, 7].map((column) => bowl.getCell(column).value)).toEqual(['A3B25-G120H180J45', 'A3B25', 'G120H180J45', 2, '4, 5', 'Yes']);
  });

  it('groups the codes by their facts under a divider, a code of facts alone first in its group (plan 0015)', async () => {
    const factsOnly = line({ row: 0, itemName: 'Invented bowl, size unknown', outcome: 'saved in Atlas', code: 'A3B25', facts: BOWL.facts.slice(0, 2) });
    const path = join(folder, 'grouped.xlsx');
    await new ExcelReviewWorkbook(path).write({ ...REPORT, rows: [...REPORT.rows, factsOnly] });
    const book = new ExcelJS.Workbook();
    await book.xlsx.readFile(path);
    const sheet = book.getWorksheet('Spec IDs') as ExcelJS.Worksheet;

    const lines = [2, 3, 4, 5, 6].map((index) => sheet.getRow(index).getCell(1).value);
    expect(lines).toEqual([
      'A3B25  ·  Bowl, Molded fibre, bagasse  ·  2 Spec IDs, 2 rows',
      'A3B25',
      'A3B25-G120H180J45',
      'A17B24  ·  1 Spec ID, 1 row',
      'A17B24-K16L14',
    ]);
    expect(sheet.getRow(3).getCell(3).value).toBe('');
    // A divider holds its facts, so a filter on Facts keeps it with its group, and is shaded across the row.
    expect([2, 3, 4].map((index) => sheet.getRow(index).getCell(2).value)).toEqual(['A3B25', 'A3B25', 'A3B25']);
    const lastColumn = (sheet.getRow(1).values as unknown[]).length - 1;
    expect(sheet.getRow(2).getCell(lastColumn).fill).toMatchObject({ type: 'pattern', fgColor: { argb: 'FFD6E0EC' } });
  });

  it('folds and merges nothing, so Google Sheets opens every Spec ID in sight, and can sort and filter them', async () => {
    const sheet = (await written()).getWorksheet('Spec IDs') as ExcelJS.Worksheet;
    const rows = Array.from({ length: sheet.rowCount }, (_, index) => sheet.getRow(index + 1));
    expect(rows.every((row) => (row.outlineLevel ?? 0) === 0 && !row.hidden)).toBe(true);
    expect(rows.some((row) => row.getCell(2).isMerged)).toBe(false);
  });
});

describe('codes in reading order (plan 0015)', () => {
  it('splits a code into its facts and sizes', () => {
    expect(partsOfCode('A3B25C8E1-G125')).toEqual({ facts: 'A3B25C8E1', sizes: 'G125' });
    expect(partsOfCode('A3B25C8E1')).toEqual({ facts: 'A3B25C8E1', sizes: '' });
  });

  it('compares each part by its letter, then its number as a number, a shorter code first', () => {
    expect(['A10B1', 'A3B25-G125', 'A3B25', 'A3B4', 'A3B25-G13.25'].sort(compareCodes)).toEqual([
      'A3B4',
      'A3B25',
      'A3B25-G13.25',
      'A3B25-G125',
      'A10B1',
    ]);
  });

  it('puts the rows most likely to be wrong first, each linked to its row', async () => {
    const sheet = (await written()).getWorksheet('Needs a look') as ExcelJS.Worksheet;
    const rows = [2, 3, 4, 5].map((index) => {
      const row = sheet.getRow(index);
      return [row.getCell(1).value, (row.getCell(3).value as { text: string }).text];
    });
    // Skipped, then a small size with no unit, then a code shared by rows of other names.
    expect(rows).toEqual([[1, '7'], [2, '6'], [3, '4'], [3, '5']]);
    expect((sheet.getRow(2).getCell(3).value as { hyperlink: string }).hyperlink).toBe("#'Rows'!A6");
  });

  it('decodes every option a code can hold', async () => {
    const sheet = (await written()).getWorksheet('Dictionary') as ExcelJS.Worksheet;
    expect((sheet.getRow(3).values as unknown[]).slice(1)).toEqual(['Material', 'B25', 'Molded fibre, bagasse']);
  });
});

describe('ExcelReviewSheetWriter (plan 0014, plan 0016)', () => {
  it('writes the Spec IDs sheet alone as bytes, a Spec ID saved in Atlas in its group with no row numbers', async () => {
    const byHand = line({ row: 0, itemName: 'Invented lid, saved by hand', outcome: 'saved in Atlas', code: 'A1B4' });
    const bytes = await new ExcelReviewSheetWriter().toBytes({ ...REPORT, rows: [...REPORT.rows, byHand] });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Spec IDs']);
    const sheet = workbook.getWorksheet('Spec IDs') as ExcelJS.Worksheet;
    // A1B4 is the first group: its divider, then the lid.
    const lid = sheet.getRow(3);
    expect([lid.getCell(1).value, lid.getCell(4).value, lid.getCell(5).value, lid.getCell(6).value]).toEqual(['A1B4', 0, '', 'Invented lid, saved by hand']);
  });
});
