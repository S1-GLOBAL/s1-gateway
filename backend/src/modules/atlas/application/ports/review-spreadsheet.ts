import type { LayoutTab } from '../review-sheet-layout.js';

/*
 * The shared review sheet, as Atlas writes to it (plan 0016): a spreadsheet of
 * tabs, each a grid of cells. Atlas reads the Rows tab to find what reviewers
 * have written and where, and writes only its own cells there; every other
 * tab it writes whole. The sheet never writes to Atlas.
 */

export interface SheetTab {
  /** The tab's own id, which survives renaming and moving it. */
  readonly id: number;
  readonly name: string;
  /** How many rows and columns its grid holds, empty ones too. */
  readonly rows: number;
  readonly columns: number;
}

/** A cell as the sheet shows it: its text, and its note; both empty for an empty cell. */
export interface SheetCell {
  readonly text: string;
  readonly note: string;
}

/**
 * One cell Atlas writes. Its note too, where Atlas keeps one, on a fact's
 * cell: an empty note clears one there. Null leaves the note as it is: on any
 * other cell, a note is a reviewer's. Rows and columns count from 0.
 */
export interface CellWrite {
  readonly row: number;
  readonly column: number;
  readonly value: string | number;
  readonly note: string | null;
}

/**
 * What a sync changes on the Rows tab, all at once or not at all. Columns are
 * inserted first, in order, each at its place when it is inserted; every
 * other place is counted after them.
 */
export interface RowsEdit {
  readonly insertColumns: readonly number[];
  readonly writes: readonly CellWrite[];
  /** The rows the tab must hold, so new lines fit; never fewer than it has. */
  readonly rows: number;
  /** The cells to offer Yes, No or Unsure: Correct? on each new line. */
  readonly verdicts: readonly { readonly row: number; readonly column: number }[];
  readonly hideColumns: readonly number[];
}

/** Where a link to a Rows line leads: the Rows tab, and the row each line is on now. */
export interface RowsLinks {
  readonly tab: number;
  rowOf(key: string): number | null;
}

/** Why the sheet could not be synced, in words fit to show staff: never a cell's text, and never a secret. */
export class ReviewSheetSyncError extends Error {
  /** `cause` holds what went wrong in full, for the log alone. */
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ReviewSheetSyncError';
  }
}

export interface ReviewSpreadsheet {
  tabs(): Promise<SheetTab[]>;
  /** Every cell of a tab, row by row from the first; a row may stop at its last cell with text or a note. */
  read(tab: SheetTab): Promise<SheetCell[][]>;
  /** Applies a sync's changes to the Rows tab in one request: all, or none. */
  editRows(tab: SheetTab, edit: RowsEdit): Promise<void>;
  /** Writes a tab whole, as the layout draws it, making it when it is missing. A link leads to its Rows line. */
  replace(layout: LayoutTab, existing: SheetTab | null, links: RowsLinks): Promise<void>;
}
