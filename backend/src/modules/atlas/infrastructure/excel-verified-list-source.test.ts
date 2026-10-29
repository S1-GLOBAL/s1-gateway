import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExcelVerifiedListSource } from './excel-verified-list-source.js';

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'verified-list-'));
});
afterEach(() => rm(folder, { recursive: true, force: true }));

/** An invented one-row verified list whose item name carries a cell comment. */
async function commentedWorkbook(): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Restructured Main Table');
  sheet.getCell('C4').value = 'Invented PP cup';
  sheet.getCell('C4').note = 'Invented comment';
  sheet.getCell('D4').value = 'Cup';
  sheet.getCell('E4').value = 'Plastic';
  sheet.getCell('F4').value = 'PP';
  sheet.getCell('I4').value = '1c print';
  return Buffer.from(await book.xlsx.writeBuffer());
}

/** Moves the comments part to `xl/comments/comment1.xml`, where the verified list keeps it. */
async function withCommentsMoved(file: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(file);
  const comments = await zip.file('xl/comments1.xml')!.async('string');
  zip.remove('xl/comments1.xml');
  zip.file('xl/comments/comment1.xml', comments);
  for (const name of ['xl/worksheets/_rels/sheet1.xml.rels', '[Content_Types].xml']) {
    const xml = await zip.file(name)!.async('string');
    zip.file(name, xml.replace(/comments1\.xml/g, 'comments/comment1.xml'));
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('ExcelVerifiedListSource', () => {
  it('reads a workbook that keeps its cell comments at xl/comments/comment1.xml, and leaves the file as it was', async () => {
    const file = await withCommentsMoved(await commentedWorkbook());
    await expect(new ExcelJS.Workbook().xlsx.load(Uint8Array.from(file).buffer)).rejects.toThrow();
    const path = join(folder, 'invented.xlsx');
    await writeFile(path, file);

    const rows = await new ExcelVerifiedListSource(path).rows();

    expect(rows).toEqual([
      {
        row: 4,
        itemName: 'Invented PP cup',
        category: 'Cup',
        material: 'Plastic',
        materialType: 'PP',
        dimension: '',
        weight: '',
        printing: '1c print',
        company: '',
        country: '',
        quote: { fobPerUnit: '', fobPerCase: '', fobTotal: '', moldCost: '', moldLeadTime: '', sampleLeadTime: '', productionLeadTime: '' },
        unsavedFormulas: [],
      },
    ]);
    expect(await readFile(path)).toEqual(file);
  });

  it("reads a row's manufacturer, and its quote as Excel shows it, noting a formula with no saved value", async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('Restructured Main Table');
    sheet.getCell('A4').value = 'Acme Packaging';
    sheet.getCell('B4').value = 'Atlantis';
    sheet.getCell('C4').value = 'Invented PP cup';
    sheet.getCell('U4').value = { formula: 'V4/50' } as ExcelJS.CellFormulaValue;
    sheet.getCell('V4').value = 6;
    sheet.getCell('V4').numFmt = '"$"#,##0.00';
    sheet.getCell('AA4').value = '30 days';
    const path = join(folder, 'invented.xlsx');
    await book.xlsx.writeFile(path);

    const [row] = await new ExcelVerifiedListSource(path).rows();

    expect(row).toMatchObject({
      company: 'Acme Packaging',
      country: 'Atlantis',
      quote: { fobPerUnit: '', fobPerCase: '$6.00', fobTotal: '', productionLeadTime: '30 days' },
      unsavedFormulas: ['fobPerUnit'],
    });
  });

  it('says so when the workbook has no "Restructured Main Table" sheet', async () => {
    const book = new ExcelJS.Workbook();
    book.addWorksheet('Sheet1');
    const path = join(folder, 'invented.xlsx');
    await book.xlsx.writeFile(path);

    await expect(new ExcelVerifiedListSource(path).rows()).rejects.toThrow('The workbook has no sheet called "Restructured Main Table".');
  });
});
