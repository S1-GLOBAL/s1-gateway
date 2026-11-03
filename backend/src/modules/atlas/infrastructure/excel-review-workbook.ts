import ExcelJS from 'exceljs';
import type { ImportReport, ImportReportRow, ImportReportSink, ImportSourceCells } from '../application/ports/import-report-sink.js';
import type { ReviewSheetWriter } from '../application/ports/review-sheet-writer.js';
import { letterOf, type CodedSlotKey } from '../domain/code.js';
import { SLOTS, type SlotKey } from '../domain/slots.js';

/*
 * The review workbook (plan 0013): the import's rows set out for the people
 * who check the codes. One row per workbook row, its cells as written beside
 * what was read from them, with columns for the reviewer's verdict; then the
 * Spec IDs the rows made, the rows most likely to be wrong first, and the
 * dictionary's options. It holds Source One data, so it is written outside the
 * repository, like the CSV report (ADR 0027).
 */

const SOURCE: readonly (readonly [keyof ImportSourceCells, string])[] = [
  ['itemName', 'Item name'],
  ['category', 'Category'],
  ['material', 'Material'],
  ['materialType', 'Material type'],
  ['dimension', 'Dimension'],
  ['weight', 'Weight'],
  ['printing', 'Printing'],
];

const REVIEW = ['Correct?', "What's wrong", 'Reviewer', 'Date'] as const;
const VERDICTS = ['Yes', 'No', 'Unsure'];

/** Light fills for each band of columns, so the eye can move between what was written, made, read and judged. */
const BAND = {
  source: 'FFEFF3F8',
  result: 'FFFFF4D6',
  read: 'FFE8F4EA',
  review: 'FFF3EAF7',
} as const;

/** One reason a row should be looked at first, in order of how likely it is to be wrong. */
interface Concern {
  readonly priority: number;
  readonly why: string;
}

/** The note on a fact's cell: where its words were read. */
function noteOf(fact: ImportReportRow['facts'][number]): string | null {
  if (fact.words === '' && fact.cell === null) return null;
  const from = fact.words === '' ? `From ${fact.cell}` : fact.cell === null ? `From "${fact.words}"` : `From ${fact.cell}: "${fact.words}"`;
  return fact.ruling === null ? from : `${from}, read under ${fact.ruling}`;
}

const SMALL_SIZE = /has no unit, so it was read in millimetres/;

/**
 * Writes the review workbook to a path outside the repository, for the
 * import's `--review`. Its sheets: How to read this, Rows, Spec IDs, Needs a
 * look, and Dictionary.
 */
export class ExcelReviewWorkbook implements ImportReportSink {
  constructor(private readonly path: string) {}

  async write(report: ImportReport): Promise<void> {
    await reviewWorkbook(report).xlsx.writeFile(this.path);
  }
}

/** The same workbook as bytes, for Atlas to hand out as a download (plan 0014). */
export class ExcelReviewSheetWriter implements ReviewSheetWriter {
  async toBytes(report: ImportReport): Promise<Uint8Array> {
    return new Uint8Array(await reviewWorkbook(report).xlsx.writeBuffer());
  }
}

function reviewWorkbook(report: ImportReport): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Atlas';
  const factKeys = SLOTS.map(({ key }) => key).filter((key) => report.rows.some((row) => row.facts.some((fact) => fact.key === key)));
  // Sheets appear in the order they are added: the read-me first.
  readMe(workbook, report);
  rowsOf(workbook, report, factKeys);
  specIdsOf(workbook, report, factKeys);
  needsALook(workbook, report);
  dictionaryOf(workbook, report);
  // The read-me opens first.
  workbook.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];
  return workbook;
}

function headerName(key: SlotKey): string {
  const { name } = SLOTS.find((slot) => slot.key === key) ?? { name: key };
  return key === 'variant' ? name : `${name} (${letterOf(key as CodedSlotKey)})`;
}

/** Two header rows: the band each column is in, then its name. */
function headers(sheet: ExcelJS.Worksheet, bands: readonly { readonly title: string; readonly columns: readonly string[]; readonly fill: string }[]): void {
  const top = sheet.getRow(1);
  const names = sheet.getRow(2);
  let column = 1;
  for (const band of bands) {
    const first = column;
    for (const name of band.columns) {
      const cell = names.getCell(column);
      cell.value = name;
      cell.font = { bold: true };
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: band.fill } };
      cell.border = { bottom: { style: 'thin' } };
      column += 1;
    }
    if (band.columns.length > 1) sheet.mergeCells(1, first, 1, column - 1);
    const title = top.getCell(first);
    title.value = band.title;
    title.font = { bold: true, size: 12 };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: band.fill } };
  }
}

function rowsOf(workbook: ExcelJS.Workbook, report: ImportReport, factKeys: readonly SlotKey[]): void {
  const sheet = workbook.addWorksheet('Rows', { views: [{ state: 'frozen', xSplit: 2, ySplit: 2 }] });
  const sourceColumns = ['Row', ...SOURCE.map(([, name]) => name)];
  const resultColumns = ['Code', 'Outcome', 'Category agrees?'];
  const readColumns = [...factKeys.map(headerName), 'Left out', 'Notes', 'Dropped'];
  headers(sheet, [
    { title: 'What the workbook said', columns: sourceColumns, fill: BAND.source },
    { title: 'What Atlas made', columns: resultColumns, fill: BAND.result },
    { title: 'What Atlas read (hover a fact to see where it came from)', columns: readColumns, fill: BAND.read },
    { title: 'Your review', columns: [...REVIEW], fill: BAND.review },
  ]);

  const factStart = sourceColumns.length + resultColumns.length + 1;
  const verdictColumn = sourceColumns.length + resultColumns.length + readColumns.length + 1;
  report.rows.forEach((entry, index) => {
    const row = sheet.getRow(index + 3);
    // A Spec ID saved in Atlas has no workbook row.
    row.getCell(1).value = entry.row === 0 ? '' : entry.row;
    SOURCE.forEach(([key], offset) => {
      row.getCell(2 + offset).value = entry.source[key];
    });
    let column = sourceColumns.length + 1;
    row.getCell(column++).value = entry.code ?? '';
    row.getCell(column++).value = entry.outcome === 'skipped' ? `skipped: ${entry.reason ?? ''}` : entry.outcome;
    row.getCell(column++).value = entry.categoryAgrees === null ? '' : entry.categoryAgrees ? 'Yes' : 'No';
    factKeys.forEach((key, offset) => {
      const fact = entry.facts.find((candidate) => candidate.key === key);
      if (!fact) return;
      const cell = row.getCell(factStart + offset);
      cell.value = fact.meaning;
      const note = noteOf(fact);
      if (note !== null) cell.note = note;
    });
    column = factStart + factKeys.length;
    row.getCell(column++).value = entry.leftOut.join(', ');
    row.getCell(column++).value = entry.flags.join('\n');
    row.getCell(column++).value = entry.dropped.join('\n');
    row.getCell(verdictColumn).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${VERDICTS.join(',')}"`],
      showErrorMessage: true,
      errorTitle: 'Correct?',
      error: 'Choose Yes, No or Unsure.',
    };
    row.alignment = { vertical: 'top', wrapText: true };
  });

  const widths = [6, 40, 18, 14, 18, 24, 12, 18, 28, 16, 10, ...factKeys.map(() => 18), 20, 50, 30, 10, 40, 14, 12];
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  const last = verdictColumn + REVIEW.length - 1;
  sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: report.rows.length + 2, column: last } };
  const verdicts = `${sheet.getColumn(verdictColumn).letter}3:${sheet.getColumn(verdictColumn).letter}${report.rows.length + 2}`;
  sheet.addConditionalFormatting({
    ref: verdicts,
    rules: [
      { type: 'cellIs', operator: 'equal', formulae: ['"No"'], priority: 1, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFF8D7DA' } } } },
      { type: 'cellIs', operator: 'equal', formulae: ['"Yes"'], priority: 2, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFD4EDDA' } } } },
      { type: 'cellIs', operator: 'equal', formulae: ['"Unsure"'], priority: 3, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFF3CD' } } } },
    ],
  });
}

function readMe(workbook: ExcelJS.Workbook, report: ImportReport): void {
  const sheet = workbook.addWorksheet('How to read this');
  const { summary } = report;
  const lines: readonly (readonly [string, string?])[] = [
    ['Atlas code review'],
    [''],
    ['What this is', 'Every row of the verified list, the code Atlas gave it, and what Atlas read from the row to make that code. Check that what was read matches what the row says.'],
    ['Rows', 'One line per workbook row. Grey: the cells as the workbook wrote them. Yellow: the code and what happened to the row. Green: each fact Atlas read, one column per fact. Hover a green cell to see which cell and words it came from. Purple: your review.'],
    ['Your review', 'Choose Yes, No or Unsure under "Correct?". For No, say what is wrong: the fact that is wrong, missing or extra, and what it should be.'],
    ['A blank fact', 'Atlas did not find it, so the code leaves it out. It is not known, rather than wrong, unless the row does say it.'],
    ['Left out', 'Words no rule used. A product word or size here may be something Atlas missed.'],
    ['Notes', 'What Atlas noticed: a fact the row gives two values for, a size with no unit, a word that could mean several things.'],
    ['Same as row N', 'This row describes exactly the same product as row N, so it shares that row\'s Spec ID and code. If the two rows are different products, the code is missing what tells them apart.'],
    ['Already saved', 'The first row of its Spec ID when the sheet comes from Atlas: the import saved its code. Rows after it read "Same as row N".'],
    ['Saved in Atlas', 'A Spec ID saved by hand in Atlas, not imported: it has no workbook row or cells, only its facts.'],
    ['Spec IDs', 'One line per code, with the rows that share it. Look for rows whose names differ but share one code.'],
    ['Needs a look', 'The rows most likely to be wrong, most likely first. A good place to start.'],
    ['Dictionary', 'What each number in a code means. A code is a letter and a number per fact: A is the product type, B the material, and so on; the sizes come after the hyphen. B25 is material 25, Molded fibre, bagasse. J110 is a height of 110 mm.'],
    ['Sizes', 'H top diameter, I bottom diameter, J height, K length, L width, M gusset: millimetres. N unit weight: tenths of a gram (N33 is 3.3 g). O basis weight: gsm. P thickness: micrometres. G capacity: the unit\'s number, then the amount (G112 is 12 oz).'],
    [''],
    ['Rows read', String(summary.rows)],
    ['Spec IDs', String(summary.created + summary.alreadySaved)],
    ['Rows sharing an earlier row\'s code', String(summary.sameAs)],
    ['Rows skipped', String(summary.skipped)],
    ['Category agreed with the rest of the row', `${summary.agreement.agreed} of ${summary.agreement.compared}`],
  ];
  lines.forEach(([label, text], index) => {
    const row = sheet.getRow(index + 1);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true, size: index === 0 ? 16 : 11 };
    if (text !== undefined) row.getCell(2).value = text;
    row.alignment = { vertical: 'top', wrapText: true };
  });
  sheet.getColumn(1).width = 34;
  sheet.getColumn(2).width = 110;
}

function specIdsOf(workbook: ExcelJS.Workbook, report: ImportReport, factKeys: readonly SlotKey[]): void {
  const sheet = workbook.addWorksheet('Spec IDs', { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] });
  const groups = new Map<string, ImportReportRow[]>();
  for (const row of report.rows) if (row.code !== null) groups.set(row.code, [...(groups.get(row.code) ?? []), row]);
  const columns = ['Code', 'Rows', 'Row numbers', 'Item names', 'Names differ?', ...factKeys.map(headerName)];
  const header = sheet.getRow(1);
  columns.forEach((name, index) => {
    const cell = header.getCell(index + 1);
    cell.value = name;
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index < 5 ? BAND.result : BAND.read } };
  });
  [...groups.entries()].forEach(([code, members], index) => {
    const row = sheet.getRow(index + 2);
    const names = [...new Set(members.map((member) => member.itemName.trim()))];
    row.getCell(1).value = code;
    row.getCell(2).value = members.length;
    row.getCell(3).value = members.map((member) => member.row).join(', ');
    row.getCell(4).value = names.join('\n');
    row.getCell(5).value = names.length > 1 ? 'Yes' : '';
    const [first] = members;
    factKeys.forEach((key, offset) => {
      const fact = first?.facts.find((candidate) => candidate.key === key);
      if (fact) row.getCell(6 + offset).value = fact.meaning;
    });
    row.alignment = { vertical: 'top', wrapText: true };
  });
  [28, 6, 16, 50, 10, ...factKeys.map(() => 18)].forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: groups.size + 1, column: columns.length } };
}

/** Why a row should be looked at first; null when nothing points at it. */
function concernOf(row: ImportReportRow, sharedNames: ReadonlyMap<string, number>): Concern | null {
  if (row.outcome === 'skipped') return { priority: 1, why: `Skipped: ${row.reason ?? ''}` };
  if (row.flags.some((flag) => SMALL_SIZE.test(flag))) return { priority: 2, why: 'A size with no unit, read in millimetres: check it is not inches' };
  if (row.code !== null && (sharedNames.get(row.code) ?? 1) > 1) return { priority: 3, why: 'Shares its code with rows of another name: check they are one product' };
  if (row.categoryAgrees === false) return { priority: 4, why: 'The Category column names another product type' };
  if (row.dropped.length > 0) return { priority: 5, why: 'A fact read was refused by the rules and left out of the code' };
  if (row.flags.length > 0 || row.leftOut.length > 0) return { priority: 6, why: 'Atlas left notes, or words it did not use' };
  return null;
}

function needsALook(workbook: ExcelJS.Workbook, report: ImportReport): void {
  const sheet = workbook.addWorksheet('Needs a look', { views: [{ state: 'frozen', ySplit: 1 }] });
  const names = new Map<string, Set<string>>();
  for (const row of report.rows) {
    if (row.code === null) continue;
    names.set(row.code, (names.get(row.code) ?? new Set()).add(row.itemName.trim()));
  }
  const sharedNames = new Map([...names.entries()].map(([code, set]) => [code, set.size]));
  const indexOf = new Map(report.rows.map((row, index) => [row.row, index + 3]));
  const flagged = report.rows
    .map((row) => ({ row, concern: concernOf(row, sharedNames) }))
    .filter((entry): entry is { row: ImportReportRow; concern: Concern } => entry.concern !== null)
    .sort((a, b) => a.concern.priority - b.concern.priority || a.row.row - b.row.row);
  const columns = ['Priority', 'Why', 'Row', 'Item name', 'Code', 'What Atlas read', 'Notes'];
  const header = sheet.getRow(1);
  columns.forEach((name, index) => {
    const cell = header.getCell(index + 1);
    cell.value = name;
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND.result } };
  });
  flagged.forEach(({ row, concern }, index) => {
    const line = sheet.getRow(index + 2);
    line.getCell(1).value = concern.priority;
    line.getCell(2).value = concern.why;
    // The row number opens the row on the Rows sheet, where the review is written.
    line.getCell(3).value = { text: String(row.row), hyperlink: `#'Rows'!A${indexOf.get(row.row) ?? 3}` };
    line.getCell(3).font = { color: { argb: 'FF1F5FBF' }, underline: true };
    line.getCell(4).value = row.itemName;
    line.getCell(5).value = row.code ?? '';
    line.getCell(6).value = row.facts.map((fact) => `${fact.name}: ${fact.meaning}`).join('\n');
    line.getCell(7).value = [...row.flags, ...(row.leftOut.length > 0 ? [`Left out: ${row.leftOut.join(', ')}`] : [])].join('\n');
    line.alignment = { vertical: 'top', wrapText: true };
  });
  [8, 40, 6, 40, 28, 40, 60].forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: flagged.length + 1, column: columns.length } };
}

function dictionaryOf(workbook: ExcelJS.Workbook, report: ImportReport): void {
  const sheet = workbook.addWorksheet('Dictionary', { views: [{ state: 'frozen', ySplit: 1 }] });
  const header = sheet.getRow(1);
  ['List', 'Part', 'Meaning'].forEach((name, index) => {
    const cell = header.getCell(index + 1);
    cell.value = name;
    cell.font = { bold: true };
  });
  report.options.forEach((option, index) => {
    const row = sheet.getRow(index + 2);
    row.getCell(1).value = option.list;
    row.getCell(2).value = option.part;
    row.getCell(3).value = option.meaning;
  });
  [20, 8, 50].forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: report.options.length + 1, column: 3 } };
}
