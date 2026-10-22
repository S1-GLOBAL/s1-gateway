import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { formatNumber, shownCell } from './excel-cell-text.js';

describe('formatNumber', () => {
  it.each([
    [0.035, '"$"#,##0.0000', '$0.0350'],
    [1234.5, '"$"#,##0.00', '$1,234.50'],
    [0.0349999999, '_-[$$-409]* #,##0.000_ ;_-[$$-409]* -#,##0.000 ;_-[$$-409]* "-"??_ ;_-@_ ', '$0.035'],
    [1200, '#,##0"$"', '1,200$'],
    [12.3, '$#,##0.00;-$#,##0.00', '$12.30'],
    [7.25, '[$$-47C]#,##0.0', '$7.3'],
    [0.12, '0.000', '0.120'],
    [30, 'General" days"', '30 days'],
    [0.1 + 0.2, 'General', '0.3'],
    [45, undefined, '45'],
    [0.5, '0%', '50%'],
    [-2.5, '"$"#,##0.00', '-$2.50'],
  ])('shows %s under %s as %s', (value, numFmt, shown) => {
    expect(formatNumber(value, numFmt)).toBe(shown);
  });
});

describe('shownCell', () => {
  const sheet = new ExcelJS.Workbook().addWorksheet('Sheet1');

  it('shows a number in its format, and text as written', () => {
    const price = sheet.getCell('A1');
    price.value = 0.035;
    price.numFmt = '"$"#,##0.0000';
    sheet.getCell('A2').value = ' $0.05 per 1000 pouches ';

    expect(shownCell(price)).toEqual({ text: '$0.0350' });
    expect(shownCell(sheet.getCell('A2'))).toEqual({ text: '$0.05 per 1000 pouches' });
    expect(shownCell(sheet.getCell('A3'))).toEqual({ text: '' });
  });

  it("shows a formula's saved value in its format, and says when there is none", () => {
    const saved = sheet.getCell('B1');
    saved.value = { formula: 'C1/50', result: 0.5 };
    saved.numFmt = '"$"#,##0.00';
    sheet.getCell('B2').value = { formula: 'C2/50' } as ExcelJS.CellFormulaValue;

    expect(shownCell(saved)).toEqual({ text: '$0.50' });
    expect(shownCell(sheet.getCell('B2'))).toEqual({ unsavedFormula: true });
  });
});
