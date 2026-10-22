import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CsvImportReport } from './csv-import-report.js';

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'csv-report-'));
});
afterEach(() => rm(folder, { recursive: true, force: true }));

describe('CsvImportReport', () => {
  it('quotes a cell with a comma or a quote, doubles its quotes, and joins several facts with "; "', async () => {
    const path = join(folder, 'report.csv');
    await new CsvImportReport(path).write({
      summary: { rows: 1, created: 1, sameAs: 0, alreadySaved: 0, skipped: 0, agreement: { agreed: 0, compared: 0 } },
      rows: [
        {
          row: 4,
          itemName: 'Invented bag, 10x8x6" handle',
          outcome: 'new',
          code: 'BAG.Y',
          reason: null,
          readFromRow: ['Colour / clarity: White', 'Height: 152 mm'],
          dropped: [],
          flags: [],
        },
      ],
    });

    const lines = (await readFile(path, 'utf8')).split('\n');
    expect(lines[8]).toBe('4,"Invented bag, 10x8x6"" handle",new,BAG.Y,,Colour / clarity: White; Height: 152 mm,,');
  });
});
