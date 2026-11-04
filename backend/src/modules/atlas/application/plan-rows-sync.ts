import type { CellWrite, RowsEdit, SheetCell } from './ports/review-spreadsheet.js';
import { KEY_COLUMN, ROWS_TRAILING, type LayoutCell, type LayoutColumn, type LayoutLine, type LayoutTab } from './review-sheet-layout.js';

/*
 * How a sync changes the shared sheet's Rows tab (plan 0016), worked out
 * before anything is written, and pure, so every case is tested without
 * Google. The rules, in order of what matters most:
 *
 * - The reviewers' columns, and any column Atlas does not know, are never
 *   written. Atlas writes only its own columns, found by their names on the
 *   header row, wherever they have been moved.
 * - No row is moved, cleared or deleted. A line is found by its key, in a
 *   hidden Atlas key column, however the tab is sorted; a line Atlas no
 *   longer has keeps its review and its Outcome reads "No longer in Atlas".
 * - A line already on the sheet when it is first synced, uploaded from the
 *   workbook, is taken as Atlas's by its Row number and Item name, or, saved
 *   in Atlas, by its Code: its key is written beside it, and its review stays.
 * - A cell is written only when it differs, so a sync with nothing new to
 *   say writes nothing.
 */

/** The Outcome of a line Atlas no longer has. */
export const NO_LONGER_IN_ATLAS = 'No longer in Atlas';

/** A cell a sync changes, for a dry run to show: where, and from what to what. */
export interface CellChange {
  /** The row as the sheet numbers it, from 1. */
  readonly row: number;
  readonly column: string;
  readonly from: string;
  readonly to: string;
}

export interface RowsPlan {
  readonly edit: RowsEdit;
  /** The row of the header, from 0. */
  readonly headerRow: number;
  /** Each line's row after the edit, from 0, by key: where a link to it leads. */
  readonly rowOf: ReadonlyMap<string, number>;
  readonly columnsAdded: readonly string[];
  /** Lines on the sheet before Atlas kept it, now known by their keys. */
  readonly adopted: number;
  /** Lines with at least one cell changed, not counting a key being written. */
  readonly updated: number;
  readonly added: number;
  /** Lines newly marked "No longer in Atlas". */
  readonly removed: number;
  readonly changes: readonly CellChange[];
}

export type RowsPlanResult = { readonly ok: true; readonly plan: RowsPlan } | { readonly ok: false; readonly reason: string };

/** The Rows tab as the shared sheet holds it: Atlas's columns, the review's, and the hidden key last. */
export function sharedRowsTab(rows: LayoutTab): LayoutTab {
  return {
    ...rows,
    columns: [...rows.columns, { name: KEY_COLUMN, width: 20, band: null, hidden: true }],
    lines: rows.lines.map((line) => ({ ...line, cells: [...line.cells, { value: line.key ?? '' }] })),
  };
}

/** How many rows of a tab are read looking for its header. */
const HEADER_SEARCH = 10;

function textOf(cell: SheetCell | undefined): string {
  return (cell?.text ?? '').replace(/\r\n?/g, '\n');
}

function noteOf(cell: SheetCell | undefined): string {
  return (cell?.note ?? '').replace(/\r\n?/g, '\n');
}

/** Whether Atlas keeps the notes in a column: a fact's, saying where it was read. Any other note is a reviewer's. */
function keepsNotes(column: LayoutColumn): boolean {
  return column.band === 'read' && !(ROWS_TRAILING as readonly string[]).includes(column.name);
}

/** Whether a cell's note is the one Atlas would write. */
function notes(cell: SheetCell | undefined, wanted: LayoutCell | null): boolean {
  return noteOf(cell) === (wanted?.note ?? '');
}

/** Whether a cell already shows the value Atlas would write: a number as the sheet formats it. */
function shows(cell: SheetCell | undefined, wanted: LayoutCell | null): boolean {
  const text = textOf(cell);
  const value = wanted?.value ?? '';
  if (typeof value === 'number') return text !== '' && Number(text.replace(/,/g, '')) === value;
  return text === value;
}

function sameName(a: string, b: string): boolean {
  const normal = (name: string) => name.replace(/\s+/g, ' ').trim().toLowerCase();
  return normal(a) === normal(b);
}

/**
 * Plans the sync of a Rows tab, `grid`, to `layout`, the Rows tab the
 * library makes now. Fails, writing nothing, when the tab has no header row
 * naming Code and Correct?: it is then not a tab Atlas can safely write to.
 */
export function planRowsSync(grid: readonly (readonly SheetCell[])[], layout: LayoutTab): RowsPlanResult {
  const headerRow = grid.slice(0, HEADER_SEARCH).findIndex((row) => {
    const names = row.map((cell) => textOf(cell).trim());
    return names.includes('Code') && names.includes('Correct?');
  });
  if (headerRow === -1) {
    return { ok: false, reason: 'The Rows tab has no header row naming Code and Correct?, so Atlas will not write to it.' };
  }

  // A working copy of the grid, which the planned edit is applied to as it is worked out.
  const width = Math.max(0, ...grid.map((row) => row.length));
  const cells: SheetCell[][] = grid.map((row) => Array.from({ length: width }, (_, column) => row[column] ?? { text: '', note: '' }));
  const header = (): string[] => (cells[headerRow] ?? []).map((cell) => textOf(cell).trim());
  const insertColumns: number[] = [];
  const writes: CellWrite[] = [];
  const changes: CellChange[] = [];
  const columnsAdded: string[] = [];
  const hideColumns: number[] = [];

  /** Writes a cell; its note too when `withNote`, and otherwise leaves the note as it is. */
  const write = (row: number, column: number, wanted: LayoutCell | null, label: string, { record = true, withNote = false } = {}): void => {
    const was = cells[row]?.[column];
    const value = wanted?.value ?? '';
    const note = withNote ? (wanted?.note ?? '') : null;
    writes.push({ row, column, value, note });
    if (record) {
      const sameText = textOf(was) === String(value);
      changes.push(
        sameText && note !== null
          ? { row: row + 1, column: `${label}, its note`, from: noteOf(was), to: note }
          : { row: row + 1, column: label, from: textOf(was), to: String(value) },
      );
    }
    while (cells.length <= row) cells.push(Array.from({ length: cells[0]?.length ?? 0 }, () => ({ text: '', note: '' })));
    const line = cells[row] as SheetCell[];
    line[column] = { text: String(value), note: note ?? noteOf(was) };
  };

  // Atlas's own columns: every one but the review's, and the key, last.
  const shared = sharedRowsTab(layout);
  const owned = shared.columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => column.band !== 'review');

  // A column Atlas needs and the tab lacks is inserted after the one it follows in the layout, or, the key, after the last.
  for (const { column, index } of owned) {
    if (header().includes(column.name)) continue;
    const names = header();
    let at: number;
    if (column.name === KEY_COLUMN) {
      at = names.reduce((last, name, position) => (name === '' ? last : position + 1), 0);
    } else {
      const before = shared.columns.slice(0, index).map((earlier) => names.indexOf(earlier.name)).filter((position) => position !== -1);
      at = before.length === 0 ? 0 : Math.max(...before) + 1;
    }
    insertColumns.push(at);
    for (const row of cells) row.splice(at, 0, { text: '', note: '' });
    // Named in the working copy now, so a later column finds it; written once every column is in, at its final place.
    (cells[headerRow] as SheetCell[])[at] = { text: column.name, note: '' };
    columnsAdded.push(column.name);
  }
  for (const name of columnsAdded) {
    const position = header().indexOf(name);
    write(headerRow, position, { value: name }, name, { record: false });
    if (shared.columns.find((column) => column.name === name)?.hidden === true) hideColumns.push(position);
  }

  const at = (name: string): number => header().indexOf(name);
  const keyColumn = at(KEY_COLUMN);
  const rowColumn = at('Row');
  const codeColumn = at('Code');
  const outcomeColumn = at('Outcome');
  const itemColumn = at('Item name');
  const verdictColumn = at('Correct?');

  const layoutValue = (line: LayoutLine, name: string): string =>
    String(line.cells[shared.columns.findIndex((column) => column.name === name)]?.value ?? '');
  const linesByKey = new Map(shared.lines.flatMap((line) => (line.key === undefined ? [] : [[line.key, line]] as const)));
  const byRowNumber = new Map<string, LayoutLine>();
  const savedByCode = new Map<string, LayoutLine>();
  for (const line of shared.lines) {
    const key = line.key ?? '';
    const number = /^row (\d+) · /.exec(key)?.[1];
    if (number !== undefined) byRowNumber.set(number, line);
    else if (key.startsWith('spec ')) savedByCode.set(layoutValue(line, 'Code'), line);
  }

  let adopted = 0;
  let updated = 0;
  let removed = 0;
  const onSheet = new Set<string>();
  const rowOf = new Map<string, number>();
  let lastUsed = headerRow;

  for (let row = headerRow + 1; row < cells.length; row += 1) {
    const line = cells[row] as SheetCell[];
    if (line.some((cell) => cell.text !== '' || cell.note !== '')) lastUsed = row;
    let key = textOf(line[keyColumn]).trim();
    const number = textOf(line[rowColumn]).trim();
    const code = textOf(line[codeColumn]).trim();
    if (key === '') {
      // Uploaded before Atlas kept the sheet: taken as Atlas's line only when it is plainly the same one. A
      // workbook row is known by its number and item name; a Spec ID saved in Atlas, whose name may change, by its code.
      const imported = /^\d+$/.test(number) ? byRowNumber.get(number) : undefined;
      const byHand =
        number === '' && code !== '' && sameName(textOf(line[outcomeColumn]), 'saved in Atlas') ? savedByCode.get(code) : undefined;
      const candidate =
        imported !== undefined && sameName(textOf(line[itemColumn]), layoutValue(imported, 'Item name')) ? imported : byHand;
      if (candidate?.key !== undefined) {
        key = candidate.key;
        write(row, keyColumn, { value: key }, KEY_COLUMN, { record: false });
        adopted += 1;
      } else if (number === '' && code === '') {
        // Not a line Atlas wrote: a reviewer's own, or empty. Left alone.
        continue;
      }
    }
    const wanted = key === '' ? undefined : linesByKey.get(key);
    if (wanted === undefined) {
      if (textOf(line[outcomeColumn]) !== NO_LONGER_IN_ATLAS) {
        write(row, outcomeColumn, { value: NO_LONGER_IN_ATLAS }, 'Outcome');
        removed += 1;
      }
      continue;
    }
    onSheet.add(key);
    if (!rowOf.has(key)) rowOf.set(key, row);
    let changed = false;
    for (const { column, index } of owned) {
      if (column.name === KEY_COLUMN) continue;
      const target = at(column.name);
      const cell = wanted.cells[index] ?? null;
      const withNote = keepsNotes(column);
      if (shows(line[target], cell) && (!withNote || notes(line[target], cell))) continue;
      write(row, target, cell, column.name, { withNote });
      changed = true;
    }
    if (changed) updated += 1;
  }

  // Lines the sheet lacks go below the last line with anything in it, in the layout's order.
  let next = lastUsed + 1;
  let added = 0;
  const verdicts: { row: number; column: number }[] = [];
  for (const line of shared.lines) {
    if (line.key === undefined || onSheet.has(line.key)) continue;
    for (const { column, index } of owned) {
      const cell = line.cells[index] ?? null;
      // A new row is empty: only what it holds is written.
      if ((cell?.value ?? '') === '' && cell?.note === undefined) continue;
      write(next, at(column.name), cell, column.name, { record: column.name !== KEY_COLUMN, withNote: keepsNotes(column) });
    }
    if (verdictColumn !== -1) verdicts.push({ row: next, column: verdictColumn });
    rowOf.set(line.key, next);
    onSheet.add(line.key);
    next += 1;
    added += 1;
  }

  return {
    ok: true,
    plan: {
      edit: { insertColumns, writes, rows: next, verdicts, hideColumns },
      headerRow,
      rowOf,
      columnsAdded,
      adopted,
      updated,
      added,
      removed,
      changes,
    },
  };
}

/** What identifies each line of a Rows tab: its header, and each line's key, Row, Code and Item name. */
export function identityOf(grid: readonly (readonly SheetCell[])[], headerRow: number): string {
  const header = (grid[headerRow] ?? []).map((cell) => textOf(cell).trim());
  const columns = [KEY_COLUMN, 'Row', 'Code', 'Item name'].map((name) => header.indexOf(name));
  return JSON.stringify([header, ...grid.slice(headerRow + 1).map((row) => columns.map((column) => (column === -1 ? '' : textOf(row[column]))))]);
}
