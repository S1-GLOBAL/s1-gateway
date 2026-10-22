import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { accountsTable } from '../modules/accounts/index.js';
import { DrizzleSpecIdRepository } from '../modules/atlas/infrastructure/drizzle-spec-id-repository.js';
import { connectTestDatabase, resetTables } from '../test/database.js';
import { atlasImport } from './atlas-import.js';

const connection = connectTestDatabase();
const AS = 'saver@sourceone.global';
let folder: string;

/**
 * An invented workbook shaped like the verified list: sheet "Main Table",
 * three header rows, products from row 4 in columns C to G. Never the
 * verified list's own rows (constraints §6).
 */
async function workbook(rows: (string | number)[][], merge?: string): Promise<string> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Main Table');
  sheet.getCell('C1').value = 'PRODUCT DETAILS';
  sheet.getCell('C2').value = 'Item Name / Description';
  sheet.getCell('C3').value = '/';
  rows.forEach((values, index) => {
    values.forEach((value, column) => {
      sheet.getCell(index + 4, column + 3).value = value;
    });
  });
  if (merge) sheet.mergeCells(merge);
  const path = join(folder, 'invented.xlsx');
  await book.xlsx.writeFile(path);
  return path;
}

const run = (path: string, write: boolean, as = AS) =>
  atlasImport(connection.db, { workbook: path, report: join(folder, 'report.csv'), as, write });

const saved = () => new DrizzleSpecIdRepository(connection.db).list({ limit: 50 });

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'atlas-import-'));
  await resetTables(connection.db);
  await connection.db.insert(accountsTable).values({
    id: '00000000-0000-4000-8000-0000000000aa',
    email: AS,
    fullName: 'Ada Invented',
    passwordHash: 'hash',
    status: 'approved',
    createdAt: new Date('2026-10-22T08:00:00.000Z'),
  });
});
afterEach(() => rm(folder, { recursive: true, force: true }));
afterAll(() => connection.close());

const ROWS: (string | number)[][] = [
  ['Invented PP cup', 'Cup', 'Plastic - PP', 90, ''],
  ['Invented PP cup', 'Cup', 'Plastic - PP', 90, ''],
  ['Invented PET lid', 'Lid', 'Plastic - PET', '', '3.3g'],
  ['Invented sample order', '', 'Plastic - PP', '', ''],
];

describe('atlas:import', () => {
  it('saves nothing in a dry run, and says what it would do', async () => {
    const path = await workbook(ROWS);

    const result = await run(path, false);

    expect(result).toEqual({
      ok: true,
      value: `Dry run: nothing was saved. 2 Spec IDs would be created from 4 rows; 1 rows skipped. Report: ${join(folder, 'report.csv')}`,
    });
    expect(await saved()).toEqual([]);
  });

  it('saves with --write, says so, and writes a report with the totals first and one line per row', async () => {
    const path = await workbook(ROWS);

    const result = await run(path, true);

    expect(result.ok && result.value).toBe(
      `Saved 2 Spec IDs from 4 rows; 0 were already saved; 1 rows skipped. Report: ${join(folder, 'report.csv')}`,
    );
    const stored = await saved();
    expect(stored.map((record) => [record.savedSpecId.name, record.savedByName])).toEqual(
      expect.arrayContaining([
        ['Invented PP cup', 'Ada Invented'],
        ['Invented PET lid', 'Ada Invented'],
      ]),
    );
    const report = (await readFile(join(folder, 'report.csv'), 'utf8')).split('\n');
    expect(report.slice(0, 6)).toEqual([
      'Rows read,4',
      'Spec IDs created,2',
      'Rows the same as an earlier row,1',
      'Spec IDs already saved,0',
      'Rows skipped,1',
      'Item name agreed with Category and Material,3 of 3',
    ]);
    expect(report[7]).toBe('Row,Item name,Outcome,Code,Reason skipped,Read from the row,Dropped,Flags');
    expect(report.slice(8, 12).map((line) => line.split(',').slice(0, 3).join(','))).toEqual([
      '4,Invented PP cup,new',
      '5,Invented PP cup,same as row 4',
      '6,Invented PET lid,new',
      '7,Invented sample order,skipped',
    ]);
  });

  it('saves nothing the second time, and reports every saved row already saved', async () => {
    const path = await workbook(ROWS);
    await run(path, true);

    const again = await run(path, true);

    expect(again.ok && again.value).toMatch(/^Saved 0 Spec IDs from 4 rows; 2 were already saved; 1 rows skipped\./);
    expect(await saved()).toHaveLength(2);
    const outcomes = (await readFile(join(folder, 'report.csv'), 'utf8'))
      .split('\n')
      .slice(8, 11)
      .map((line) => line.split(',')[2]);
    expect(outcomes).toEqual(['already saved', 'already saved', 'already saved']);
  });

  it('refuses an --as with no active account, and reads nothing', async () => {
    const result = await run(join(folder, 'no-such-workbook.xlsx'), true, 'nobody@sourceone.global');

    expect(result).toEqual({ ok: false, error: 'No active staff account is nobody@sourceone.global. Nothing was imported.' });
    expect(await saved()).toEqual([]);
  });

  it('gives every row an item name merged down three rows', async () => {
    const path = await workbook(
      [
        ['Invented merged cup', 'Cup', 'Plastic - PP', 80, ''],
        ['', 'Cup', 'Plastic - PP', 90, ''],
        ['', 'Cup', 'Plastic - PP', 95, ''],
      ],
      'C4:C6',
    );

    await run(path, true);

    const names = (await saved()).map((record) => record.savedSpecId.name);
    expect(names).toEqual(['Invented merged cup', 'Invented merged cup', 'Invented merged cup']);
  });
});
