import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import type { VerifiedListSource } from '../application/ports/verified-list-source.js';
import type { QuoteColumn, VerifiedRow } from '../domain/import/verified-row.js';
import { shownCell } from './excel-cell-text.js';

/**
 * The verified list's one sheet, its first product row, and the columns the
 * import reads (#28, #56): the restructured layout, with Material Type and
 * Printing beside the product's columns, and the case's columns between them
 * and the prices.
 */
export const SHEET = 'Restructured Main Table';
const FIRST_ROW = 4;
const COLUMNS = {
  company: 1,
  country: 2,
  itemName: 3,
  category: 4,
  material: 5,
  materialType: 6,
  dimension: 7,
  weight: 8,
  printing: 9,
} as const;
/** The quote's columns: U and V are FOB per unit and per case, X to AA the mold and lead times. It has no FOB total. */
const QUOTE: Partial<Record<QuoteColumn, number>> = {
  fobPerUnit: 21,
  fobPerCase: 22,
  moldCost: 24,
  moldLeadTime: 25,
  sampleLeadTime: 26,
  productionLeadTime: 27,
};

/**
 * Reads the verified list from a workbook on disk, never one committed to the
 * repository (ADR 0027). A merged cell's value applies to every row it spans:
 * the workbook merges some item names, dimensions and weights down groups of
 * rows, and COMPANY and COUNTRY down every manufacturer's rows. A number in
 * columns C to I reads as its value, `90` as `90`; the quote's columns read as
 * Excel shows them, `$0.0350`. A row with no item name is not a product.
 */
export class ExcelVerifiedListSource implements VerifiedListSource {
  constructor(private readonly path: string) {}

  async rows(): Promise<VerifiedRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await withoutCellComments(await readFile(this.path)));
    const sheet = workbook.getWorksheet(SHEET);
    if (!sheet) throw new Error(`The workbook has no sheet called "${SHEET}".`);

    const cellAt = (row: number, column: number): ExcelJS.Cell => {
      const cell = sheet.getCell(row, column);
      return cell.isMerged ? cell.master : cell;
    };
    const text = (row: number, column: number): string => cellAt(row, column).text.trim();
    const rows: VerifiedRow[] = [];
    for (let row = FIRST_ROW; row <= sheet.rowCount; row += 1) {
      const itemName = text(row, COLUMNS.itemName);
      if (itemName === '') continue;
      const quote = { fobTotal: '' } as Record<QuoteColumn, string>;
      const unsavedFormulas: QuoteColumn[] = [];
      for (const [column, at] of Object.entries(QUOTE) as [QuoteColumn, number][]) {
        const shown = shownCell(cellAt(row, at));
        quote[column] = 'text' in shown ? shown.text : '';
        if ('unsavedFormula' in shown) unsavedFormulas.push(column);
      }
      rows.push({
        row,
        itemName,
        category: text(row, COLUMNS.category),
        material: text(row, COLUMNS.material),
        materialType: text(row, COLUMNS.materialType),
        dimension: text(row, COLUMNS.dimension),
        weight: text(row, COLUMNS.weight),
        printing: text(row, COLUMNS.printing),
        company: text(row, COLUMNS.company),
        country: text(row, COLUMNS.country),
        quote,
        unsavedFormulas,
      });
    }
    return rows;
  }
}

/** A sheet's link to its cell comments, in `xl/worksheets/_rels/sheetN.xml.rels`. */
const COMMENTS_RELATIONSHIP = /<Relationship\b[^>]*\bType="[^"]*\/comments"[^>]*\/>/g;

/**
 * The workbook without its sheets' links to cell comments, which the import
 * never reads. exceljs 4.4.0 finds comments only at `xl/commentsN.xml`; a
 * workbook that keeps them elsewhere, as the verified list does
 * (`xl/comments/comment1.xml`), fails to load. Changed in memory only.
 */
async function withoutCellComments(file: Buffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(file);
  for (const name of Object.keys(zip.files).filter((entry) => /^xl\/worksheets\/_rels\/[^/]+\.rels$/.test(entry))) {
    const xml = await zip.file(name)?.async('string');
    if (xml !== undefined) zip.file(name, xml.replace(COMMENTS_RELATIONSHIP, ''));
  }
  return zip.generateAsync({ type: 'arraybuffer' });
}
