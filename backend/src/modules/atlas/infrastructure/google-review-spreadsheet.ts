import {
  ReviewSheetSyncError,
  type CellWrite,
  type ReviewSpreadsheet,
  type RowsEdit,
  type RowsLinks,
  type SheetCell,
  type SheetTab,
} from '../application/ports/review-spreadsheet.js';
import { VERDICTS, type LayoutCell, type LayoutTab } from '../application/review-sheet-layout.js';
import { BAND_FILL, LINK_COLOUR, VERDICT_FILL, headerRowsOf } from './excel-review-workbook.js';

/*
 * The shared review sheet in Google Sheets (plan 0016, ADR 0034), by the
 * Sheets API v4 over HTTPS: no Google SDK. Each change is one batchUpdate,
 * which Google applies whole or not at all. A value is always written as a
 * value, never read as a formula: a cell starting with "=" stays text. The
 * only formula written is a link Atlas makes itself, from numbers.
 */

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

/** A column's width in pixels, from Excel's width in characters. */
function pixelsOf(width: number): number {
  return Math.round(width * 7 + 5);
}

/** An ARGB colour, `FFEFF3F8`, as the Sheets API gives one. */
function colourOf(argb: string): { red: number; green: number; blue: number } {
  const part = (at: number) => Number.parseInt(argb.slice(at, at + 2), 16) / 255;
  return { red: part(2), green: part(4), blue: part(6) };
}

/** A tab's name in a range: quoted, a quote in it doubled. */
function quoted(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

interface CellData {
  userEnteredValue?: { stringValue: string } | { numberValue: number } | { formulaValue: string };
  userEnteredFormat?: Record<string, unknown>;
  note?: string;
}

/** A value as the API writes it: text as text, a number as a number, nothing for an empty cell, which clears it. */
function valueOf(value: string | number): CellData['userEnteredValue'] | undefined {
  if (typeof value === 'number') return { numberValue: value };
  return value === '' ? undefined : { stringValue: value };
}

function dataOf(value: string | number, note: string | null): CellData {
  const entered = valueOf(value);
  return { ...(entered === undefined ? {} : { userEnteredValue: entered }), ...(note === null || note === '' ? {} : { note }) };
}

type Request = Record<string, unknown>;

interface Spreadsheet {
  sheets?: {
    properties: { sheetId: number; title: string; gridProperties?: { rowCount?: number; columnCount?: number } };
    basicFilter?: unknown;
    data?: { rowData?: { values?: { formattedValue?: string; note?: string }[] }[] }[];
  }[];
}

export class GoogleReviewSpreadsheet implements ReviewSpreadsheet {
  /** The tabs with a filter, as last listed: a tab drawn without one has its old one cleared. */
  private readonly filtered = new Set<number>();

  constructor(
    private readonly spreadsheetId: string,
    private readonly token: { get(): Promise<string> },
    /** The service account's address, for the message that asks for the sheet to be shared with it. */
    private readonly serviceAccount: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async tabs(): Promise<SheetTab[]> {
    const fields = 'sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)),basicFilter(range))';
    const spreadsheet = await this.call<Spreadsheet>('GET', `?fields=${encodeURIComponent(fields)}`);
    this.filtered.clear();
    return (spreadsheet.sheets ?? []).map(({ properties, basicFilter }) => {
      if (basicFilter !== undefined) this.filtered.add(properties.sheetId);
      return {
        id: properties.sheetId,
        name: properties.title,
        rows: properties.gridProperties?.rowCount ?? 0,
        columns: properties.gridProperties?.columnCount ?? 0,
      };
    });
  }

  async read(tab: SheetTab): Promise<SheetCell[][]> {
    const fields = 'sheets(data(rowData(values(formattedValue,note))))';
    const spreadsheet = await this.call<Spreadsheet>(
      'GET',
      `?includeGridData=true&ranges=${encodeURIComponent(quoted(tab.name))}&fields=${encodeURIComponent(fields)}`,
    );
    const rows = spreadsheet.sheets?.[0]?.data?.[0]?.rowData ?? [];
    return rows.map((row) => (row.values ?? []).map((cell) => ({ text: cell.formattedValue ?? '', note: cell.note ?? '' })));
  }

  async editRows(tab: SheetTab, edit: RowsEdit): Promise<void> {
    const sheetId = tab.id;
    const requests: Request[] = [];
    let columns = tab.columns;
    for (const at of edit.insertColumns) {
      // A column past the last is added at the end: the API inserts only before one that is there.
      requests.push(
        at >= columns
          ? { appendDimension: { sheetId, dimension: 'COLUMNS', length: 1 } }
          : { insertDimension: { range: { sheetId, dimension: 'COLUMNS', startIndex: at, endIndex: at + 1 }, inheritFromBefore: at > 0 } },
      );
      columns += 1;
    }
    if (edit.rows > tab.rows) requests.push({ appendDimension: { sheetId, dimension: 'ROWS', length: edit.rows - tab.rows } });
    for (const run of runsOf(edit.writes)) {
      requests.push({
        updateCells: {
          start: { sheetId, rowIndex: run.row, columnIndex: run.column },
          rows: [{ values: run.cells.map(({ value, note }) => dataOf(value, note)) }],
          // A cell whose note is not Atlas's has its value written alone, and its note left as it is.
          fields: run.withNote ? 'userEnteredValue,note' : 'userEnteredValue',
        },
      });
    }
    for (const { row, column } of edit.verdicts) {
      requests.push({
        setDataValidation: {
          range: { sheetId, startRowIndex: row, endRowIndex: row + 1, startColumnIndex: column, endColumnIndex: column + 1 },
          rule: verdictRule(),
        },
      });
    }
    for (const column of edit.hideColumns) {
      requests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: column, endIndex: column + 1 },
          properties: { hiddenByUser: true },
          fields: 'hiddenByUser',
        },
      });
    }
    if (requests.length > 0) await this.batchUpdate(requests);
  }

  async replace(layout: LayoutTab, existing: SheetTab | null, links: RowsLinks): Promise<void> {
    let sheetId: number;
    if (existing === null) {
      const reply = await this.batchUpdate<{ replies: { addSheet: { properties: { sheetId: number } } }[] }>([
        { addSheet: { properties: { title: layout.name } } },
      ]);
      sheetId = reply.replies[0]?.addSheet.properties.sheetId ?? 0;
    } else {
      sheetId = existing.id;
    }
    await this.batchUpdate(drawRequests(sheetId, layout, links, { fresh: existing === null, filtered: this.filtered.has(sheetId) }));
  }

  private async batchUpdate<T = unknown>(requests: readonly Request[]): Promise<T> {
    return this.call<T>('POST', ':batchUpdate', { requests });
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const response = await this.fetchImpl(`${API}/${encodeURIComponent(this.spreadsheetId)}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await this.token.get()}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw this.failure(response.status, await response.text());
    return (await response.json()) as T;
  }

  /** What went wrong, in words fit for staff; Google's own answer goes to the log alone. */
  private failure(status: number, detail: string): ReviewSheetSyncError {
    const message =
      status === 403
        ? `Atlas may not edit the shared sheet: share it with ${this.serviceAccount} as an Editor.`
        : status === 404
          ? 'Atlas cannot find the shared sheet: check ATLAS_REVIEW_SHEET_URL.'
          : status === 401
            ? "Google refused Atlas's service account key: check ATLAS_REVIEW_SHEET_SYNC_KEY."
            : status === 429 || status >= 500
              ? 'Google Sheets is busy or unavailable. Atlas will try again.'
              : `Google Sheets refused the sync (${status}). The API log says why.`;
    return new ReviewSheetSyncError(message, { cause: new Error(`Google Sheets answered ${status}: ${detail.slice(0, 2000)}`) });
  }
}

interface Run {
  row: number;
  column: number;
  /** Whether the run writes its cells' notes: every cell in it does, or none. */
  withNote: boolean;
  cells: CellWrite[];
}

/** Writes grouped into runs of cells side by side on one row, alike in whether they write a note, one request each. */
function runsOf(writes: readonly CellWrite[]): Run[] {
  const sorted = [...writes].sort((a, b) => a.row - b.row || a.column - b.column);
  const runs: Run[] = [];
  for (const write of sorted) {
    const withNote = write.note !== null;
    const last = runs.at(-1);
    const lastCell = last?.cells.at(-1);
    if (last !== undefined && lastCell !== undefined && last.row === write.row && lastCell.column === write.column) {
      // The same cell twice: the later write wins.
      runs[runs.length - 1] = { ...last, withNote: last.cells.length === 1 ? withNote : last.withNote, cells: [...last.cells.slice(0, -1), write] };
    } else if (last !== undefined && lastCell !== undefined && last.row === write.row && lastCell.column + 1 === write.column && last.withNote === withNote) {
      last.cells.push(write);
    } else {
      runs.push({ row: write.row, column: write.column, withNote, cells: [write] });
    }
  }
  return runs;
}

function verdictRule(): Record<string, unknown> {
  return {
    condition: { type: 'ONE_OF_LIST', values: VERDICTS.map((verdict) => ({ userEnteredValue: verdict })) },
    strict: true,
    showCustomUi: true,
  };
}

const BOLD = { bold: true };

/** A cell of a line: its value, its note, and a link drawn as the API's HYPERLINK to its Rows line. */
function lineCellOf(cell: LayoutCell | null, links: RowsLinks): CellData {
  if (cell === null) return {};
  const row = cell.linkTo === undefined ? null : links.rowOf(cell.linkTo);
  if (row !== null && links.tab >= 0) {
    const text = String(cell.value).replace(/"/g, '""');
    return {
      userEnteredValue: { formulaValue: `=HYPERLINK("#gid=${links.tab}&range=A${row + 1}","${text}")` },
      userEnteredFormat: { textFormat: { foregroundColor: colourOf(LINK_COLOUR), underline: true } },
      ...(cell.note === undefined ? {} : { note: cell.note }),
    };
  }
  return {
    ...dataOf(cell.value, cell.note ?? ''),
    ...(cell.emphasis === undefined ? {} : { userEnteredFormat: { textFormat: { ...BOLD, fontSize: cell.emphasis === 'title' ? 16 : 11 } } }),
  };
}

/** The requests that draw a tab whole: everything on it cleared, then its grid, header, lines, widths and filter. */
function drawRequests(sheetId: number, layout: LayoutTab, links: RowsLinks, { fresh, filtered }: { fresh: boolean; filtered: boolean }): Request[] {
  const headerRows = headerRowsOf(layout);
  const width = layout.columns.length;
  const height = headerRows + layout.lines.length;
  const whole = { sheetId };
  const requests: Request[] = [{ unmergeCells: { range: whole } }];
  if (filtered) requests.push({ clearBasicFilter: { sheetId } });
  requests.push({ updateCells: { range: whole, fields: '*' } });
  requests.push({
    updateSheetProperties: {
      properties: {
        sheetId,
        gridProperties: {
          rowCount: Math.max(height, layout.frozen.rows + 1),
          columnCount: Math.max(width, layout.frozen.columns + 1),
          frozenRowCount: layout.frozen.rows,
          frozenColumnCount: layout.frozen.columns,
        },
      },
      fields: 'gridProperties(rowCount,columnCount,frozenRowCount,frozenColumnCount)',
    },
  });
  layout.columns.forEach((column, index) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: index, endIndex: index + 1 },
        properties: { pixelSize: pixelsOf(column.width), hiddenByUser: column.hidden === true },
        fields: 'pixelSize,hiddenByUser',
      },
    });
  });

  // Every line top-aligned and wrapped first; a divider and the header are drawn over it.
  if (layout.wrap && layout.lines.length > 0) {
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: headerRows, endRowIndex: height, startColumnIndex: 0, endColumnIndex: width },
        cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' } },
        fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)',
      },
    });
  }

  const rows: { values: CellData[] }[] = [];
  if (layout.bands.length > 0) {
    const values: CellData[] = layout.columns.map(() => ({}));
    for (const band of layout.bands) {
      values[band.first] = {
        userEnteredValue: { stringValue: band.title },
        userEnteredFormat: { textFormat: { ...BOLD, fontSize: 12 }, backgroundColor: colourOf(BAND_FILL[band.band]) },
      };
    }
    rows.push({ values });
  }
  if (layout.header) {
    rows.push({
      values: layout.columns.map((column) => ({
        ...dataOf(column.name, ''),
        userEnteredFormat: {
          textFormat: BOLD,
          ...(column.band === null ? {} : { backgroundColor: colourOf(BAND_FILL[column.band]) }),
          ...(layout.bands.length > 0
            ? { wrapStrategy: 'WRAP', verticalAlignment: 'TOP', borders: { bottom: { style: 'SOLID' } } }
            : {}),
        },
      })),
    });
  }
  const base = layout.wrap ? { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' } : {};
  for (const line of layout.lines) {
    const values = layout.columns.map((_, index) => lineCellOf(line.cells[index] ?? null, links));
    if (values.some((value) => value.userEnteredFormat !== undefined)) {
      // A row written with formats clears any a cell does not bring: each keeps the line's wrap.
      for (const value of values) value.userEnteredFormat = { ...base, ...value.userEnteredFormat };
    }
    if (line.divider === true) {
      // Shaded and ruled across the whole row, its words wrapped in the first column.
      values.forEach((value, index) => {
        value.userEnteredFormat = {
          textFormat: BOLD,
          backgroundColor: colourOf(BAND_FILL.group),
          verticalAlignment: 'MIDDLE',
          wrapStrategy: index === 0 ? 'WRAP' : 'OVERFLOW_CELL',
          borders: { top: { style: 'SOLID_MEDIUM' }, bottom: { style: 'SOLID' } },
        };
      });
    }
    rows.push({ values });
  }
  // Runs of rows alike, one request each: a plain row writes its values and notes alone, and keeps the wrap above;
  // a formatted row, the header or a divider, writes its formats too. A band's title is not merged across its band:
  // Google refuses a merge that a frozen column cuts, and the title reads as well unmerged.
  let start = 0;
  while (start < rows.length) {
    const formatted = (index: number) => rows[index]?.values.some((value) => value.userEnteredFormat !== undefined) ?? false;
    let end = start + 1;
    while (end < rows.length && formatted(end) === formatted(start) && end - start < 500) end += 1;
    requests.push({
      updateCells: {
        start: { sheetId, rowIndex: start, columnIndex: 0 },
        rows: rows.slice(start, end),
        fields: formatted(start) ? 'userEnteredValue,note,userEnteredFormat' : 'userEnteredValue,note',
      },
    });
    start = end;
  }
  if (layout.verdictColumn !== null && layout.lines.length > 0) {
    const verdicts = { sheetId, startRowIndex: headerRows, endRowIndex: height, startColumnIndex: layout.verdictColumn, endColumnIndex: layout.verdictColumn + 1 };
    requests.push({ setDataValidation: { range: verdicts, rule: verdictRule() } });
    // Only on a tab made new: on one already there, the rules it has stay, and are not doubled.
    if (fresh) {
      VERDICTS.forEach((verdict, index) => {
        requests.push({
          addConditionalFormatRule: {
            index,
            rule: {
              ranges: [verdicts],
              booleanRule: {
                condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: verdict }] },
                format: { backgroundColor: colourOf(VERDICT_FILL[verdict]) },
              },
            },
          },
        });
      });
    }
  }
  if (layout.filter) {
    requests.push({
      setBasicFilter: {
        filter: { range: { sheetId, startRowIndex: headerRows - 1, endRowIndex: height, startColumnIndex: 0, endColumnIndex: width } },
      },
    });
  }
  return requests;
}
