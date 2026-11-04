import ExcelJS from 'exceljs';
import type { ImportReport, ImportReportSink } from '../application/ports/import-report-sink.js';
import type { ReviewSheetWriter } from '../application/ports/review-sheet-writer.js';
import { reviewLayout, specIdsLayout, VERDICTS, type Band, type LayoutTab } from '../application/review-sheet-layout.js';

/*
 * The review workbook (plan 0013): the import's rows set out for the people
 * who check the codes. What each sheet holds is the review sheet's layout,
 * which the shared Google Sheet is drawn from too (plan 0016); this draws it
 * in Excel. It holds Source One data, so it is written outside the
 * repository, like the CSV report (ADR 0027).
 */

/** Light fills for each band of columns, so the eye can move between what was written, made, read and judged. */
export const BAND_FILL: Record<Band | 'group', string> = {
  source: 'FFEFF3F8',
  result: 'FFFFF4D6',
  read: 'FFE8F4EA',
  review: 'FFF3EAF7',
  /** The divider above a group of Spec IDs with the same facts. */
  group: 'FFD6E0EC',
};

/** The verdicts' fills, on the Rows tab's Correct? column. */
export const VERDICT_FILL: Record<(typeof VERDICTS)[number], string> = { No: 'FFF8D7DA', Yes: 'FFD4EDDA', Unsure: 'FFFFF3CD' };

/** The colour of a link. */
export const LINK_COLOUR = 'FF1F5FBF';

/**
 * Writes the review workbook to a path outside the repository, for the
 * import's `--review`. Its sheets: How to read this, Rows, Spec IDs, Needs a
 * look, and Dictionary.
 */
export class ExcelReviewWorkbook implements ImportReportSink {
  constructor(private readonly path: string) {}

  async write(report: ImportReport): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Atlas';
    const layout = reviewLayout(report);
    // Sheets appear in the order they are added: the read-me first.
    for (const tab of [layout.readMe, layout.rows, layout.specIds, layout.needsALook, layout.dictionary]) draw(workbook, tab, layout.rows);
    // The read-me opens first.
    workbook.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];
    await workbook.xlsx.writeFile(this.path);
  }
}

/**
 * The Spec IDs sheet alone, as bytes, for Atlas to hand out as a download
 * (plan 0014, plan 0016): the review itself lives in the shared Google Sheet.
 */
export class ExcelReviewSheetWriter implements ReviewSheetWriter {
  async toBytes(report: ImportReport): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Atlas';
    draw(workbook, specIdsLayout(report), null);
    return new Uint8Array(await workbook.xlsx.writeBuffer());
  }
}

function solid(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

/** How many header rows a tab has: its band titles, then its column names. */
export function headerRowsOf(tab: LayoutTab): number {
  return (tab.bands.length > 0 ? 1 : 0) + (tab.header ? 1 : 0);
}

/** Draws one tab as a sheet. A link to a Rows line finds the line on `rows`. */
function draw(workbook: ExcelJS.Workbook, tab: LayoutTab, rows: LayoutTab | null): void {
  const { frozen } = tab;
  const sheet = workbook.addWorksheet(
    tab.name,
    frozen.rows + frozen.columns > 0 ? { views: [{ state: 'frozen', xSplit: frozen.columns, ySplit: frozen.rows }] } : {},
  );
  const headerRows = headerRowsOf(tab);
  if (tab.bands.length > 0) {
    const top = sheet.getRow(1);
    for (const band of tab.bands) {
      if (band.count > 1) sheet.mergeCells(1, band.first + 1, 1, band.first + band.count);
      const title = top.getCell(band.first + 1);
      title.value = band.title;
      title.font = { bold: true, size: 12 };
      title.fill = solid(BAND_FILL[band.band]);
    }
  }
  if (tab.header) {
    const names = sheet.getRow(headerRows);
    tab.columns.forEach((column, index) => {
      const cell = names.getCell(index + 1);
      cell.value = column.name;
      cell.font = { bold: true };
      if (column.band !== null) cell.fill = solid(BAND_FILL[column.band]);
      if (tab.bands.length > 0) {
        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = { bottom: { style: 'thin' } };
      }
    });
  }

  const rowsAt = new Map((rows?.lines ?? []).map((line, index) => [line.key, index + 1 + (rows === null ? 0 : headerRowsOf(rows))]));
  tab.lines.forEach((line, index) => {
    const row = sheet.getRow(headerRows + index + 1);
    line.cells.forEach((value, column) => {
      if (value === null) return;
      const cell = row.getCell(column + 1);
      const at = value.linkTo === undefined ? undefined : rowsAt.get(value.linkTo);
      if (at !== undefined && rows !== null) {
        cell.value = { text: String(value.value), hyperlink: `#'${rows.name}'!A${at}` };
        cell.font = { color: { argb: LINK_COLOUR }, underline: true };
      } else {
        cell.value = value.value;
      }
      if (value.note !== undefined) cell.note = value.note;
      if (value.emphasis !== undefined) cell.font = { bold: true, size: value.emphasis === 'title' ? 16 : 11 };
    });
    if (tab.verdictColumn !== null) {
      row.getCell(tab.verdictColumn + 1).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${VERDICTS.join(',')}"`],
        showErrorMessage: true,
        errorTitle: 'Correct?',
        error: 'Choose Yes, No or Unsure.',
      };
    }
    if (line.divider === true) {
      // Shaded and ruled across the whole row, its words wrapped in the first column.
      for (let column = 1; column <= tab.columns.length; column += 1) {
        const cell = row.getCell(column);
        cell.font = { bold: true };
        cell.alignment = { vertical: 'middle', wrapText: column === 1 };
        cell.fill = solid(BAND_FILL.group);
        cell.border = { top: { style: 'medium' }, bottom: { style: 'thin' } };
      }
    } else if (tab.wrap) {
      row.alignment = { vertical: 'top', wrapText: true };
    }
  });

  tab.columns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width;
  });
  if (tab.filter) {
    sheet.autoFilter = { from: { row: headerRows, column: 1 }, to: { row: headerRows + tab.lines.length, column: tab.columns.length } };
  }
  if (tab.verdictColumn !== null && tab.lines.length > 0) {
    const letter = sheet.getColumn(tab.verdictColumn + 1).letter;
    sheet.addConditionalFormatting({
      ref: `${letter}${headerRows + 1}:${letter}${headerRows + tab.lines.length}`,
      rules: VERDICTS.map((verdict, index) => ({
        type: 'cellIs' as const,
        operator: 'equal' as const,
        formulae: [`"${verdict}"`],
        priority: index + 1,
        style: { fill: { type: 'pattern' as const, pattern: 'solid' as const, bgColor: { argb: VERDICT_FILL[verdict] } } },
      })),
    });
  }
}
