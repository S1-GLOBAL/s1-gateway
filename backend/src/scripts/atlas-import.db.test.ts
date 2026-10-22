import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { count } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { accountsTable } from '../modules/accounts/index.js';
import { atlasManufacturers } from '../modules/atlas/infrastructure/atlas-manufacturers.table.js';
import { atlasQuotes } from '../modules/atlas/infrastructure/atlas-quotes.table.js';
import { DrizzleSourcingRepository } from '../modules/atlas/infrastructure/drizzle-sourcing-repository.js';
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
    expect(report.slice(0, 8)).toEqual([
      'Rows read,4',
      'Spec IDs created,2',
      'Rows the same as an earlier row,1',
      'Spec IDs already saved,0',
      'Rows skipped,1',
      'Manufacturers found,0',
      'Quotes recorded,0',
      'Item name agreed with Category and Material,3 of 3',
    ]);
    expect(report[9]).toBe('Row,Item name,Outcome,Code,Manufacturer,Quote,Reason skipped,Read from the row,Dropped,Flags');
    expect(report.slice(10, 14).map((line) => line.split(',').slice(0, 3).join(','))).toEqual([
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
      .slice(10, 13)
      .map((line) => line.split(',')[2]);
    expect(outcomes).toEqual(['already saved', 'already saved', 'already saved']);
  });

  it('refuses an --as with no active account, and reads nothing', async () => {
    const result = await run(join(folder, 'no-such-workbook.xlsx'), true, 'nobody@sourceone.global');

    expect(result).toEqual({ ok: false, error: 'No active staff account is nobody@sourceone.global. Nothing was imported.' });
    expect(await saved()).toEqual([]);
  });

  it('refuses an --as whose account is disabled, and reads nothing', async () => {
    await connection.db.insert(accountsTable).values({
      id: '00000000-0000-4000-8000-0000000000ab',
      email: 'gone@sourceone.global',
      fullName: 'Bo Invented',
      passwordHash: 'hash',
      status: 'disabled',
      createdAt: new Date('2026-10-22T08:00:00.000Z'),
    });

    const result = await run(join(folder, 'no-such-workbook.xlsx'), true, 'gone@sourceone.global');

    expect(result).toEqual({ ok: false, error: 'No active staff account is gone@sourceone.global. Nothing was imported.' });
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

/**
 * An invented workbook with two manufacturer blocks, COMPANY and COUNTRY
 * merged down each, and a row outside both. Invented manufacturers and prices
 * only (ADR 0027).
 */
async function blocksWorkbook(): Promise<string> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Main Table');
  const products: [string, string, string, number | string][] = [
    ['Invented PP cup', 'Cup', 'Plastic - PP', 90],
    ['Invented PET lid', 'Lid', 'Plastic - PET', ''],
    ['Invented PP bowl', 'Bowl', 'Plastic - PP', ''],
    ['Invented PP cup', 'Cup', 'Plastic - PP', 90],
  ];
  products.forEach(([itemName, category, material, dimension], index) => {
    sheet.getCell(index + 4, 3).value = itemName;
    sheet.getCell(index + 4, 4).value = category;
    sheet.getCell(index + 4, 5).value = material;
    sheet.getCell(index + 4, 6).value = dimension;
  });
  sheet.getCell('A4').value = 'Acme Packaging';
  sheet.getCell('B4').value = 'Atlantis';
  sheet.mergeCells('A4:A5');
  sheet.mergeCells('B4:B5');
  sheet.getCell('A6').value = 'Borealis Boxes';
  sheet.getCell('B6').value = 'Lemuria';
  sheet.getCell('O4').value = 0.0123;
  sheet.getCell('O4').numFmt = '"$"#,##0.0000';
  sheet.getCell('U4').value = '30 days';
  const path = join(folder, 'blocks.xlsx');
  await book.xlsx.writeFile(path);
  return path;
}

const tally = async () => ({
  manufacturers: (await connection.db.select({ n: count() }).from(atlasManufacturers))[0]?.n,
  quotes: (await connection.db.select({ n: count() }).from(atlasQuotes))[0]?.n,
});

describe('atlas:import, manufacturers and quotes (#56)', () => {
  it("records each row against its own block's manufacturer, and reports a row outside both", async () => {
    await run(await blocksWorkbook(), true);

    const sourcing = new DrizzleSourcingRepository(connection.db);
    const quotes = (await Promise.all((await saved()).map((record) => sourcing.quotesOf(record.savedSpecId.id)))).flat();
    expect(
      quotes.map(({ manufacturer, quote }) => [quote.values.itemName, manufacturer.name, manufacturer.country]).sort(),
    ).toEqual([
      ['Invented PET lid', 'Acme Packaging', 'Atlantis'],
      ['Invented PP bowl', 'Borealis Boxes', 'Lemuria'],
      ['Invented PP cup', 'Acme Packaging', 'Atlantis'],
    ]);
    const cup = quotes.find(({ quote }) => quote.values.itemName === 'Invented PP cup');
    expect(cup?.quote.values).toMatchObject({ fobPerUnit: '$0.0123', fobPerCase: null, productionLeadTime: '30 days' });
    const report = (await readFile(join(folder, 'report.csv'), 'utf8')).split('\n');
    expect(report.slice(5, 7)).toEqual(['Manufacturers found,2', 'Quotes recorded,3']);
    expect(report[13]?.split(',').slice(0, 6)).toEqual(['7', 'Invented PP cup', 'same as row 4', expect.any(String), 'no manufacturer', 'not recorded']);
  });

  it('leaves the number of quotes, manufacturers and Spec IDs unchanged on a second --write', async () => {
    const path = await blocksWorkbook();
    await run(path, true);
    const first = { ...(await tally()), specIds: (await saved()).length };

    await run(path, true);

    expect({ ...(await tally()), specIds: (await saved()).length }).toEqual(first);
    expect(first).toEqual({ manufacturers: 2, quotes: 3, specIds: 3 });
  });

  it('records no manufacturer and no quote in a dry run', async () => {
    await run(await blocksWorkbook(), false);

    expect(await tally()).toEqual({ manufacturers: 0, quotes: 0 });
  });
});
