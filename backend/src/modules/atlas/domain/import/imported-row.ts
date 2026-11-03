import type { RowFact } from './verified-row.js';

/*
 * A row of the verified list as the last import with --write read it (plan
 * 0014): its cells as the workbook wrote them, and what was read from them, so
 * Atlas can hand out the review workbook without reading the list again.
 */

/** The cells a row's code is read from, as the workbook wrote them. */
export interface ImportedCells {
  readonly itemName: string;
  readonly category: string;
  readonly material: string;
  readonly materialType: string;
  readonly dimension: string;
  readonly weight: string;
  readonly printing: string;
}

/** What the import read from a row, kept as the review workbook shows it. */
export interface ImportedReading {
  /** `new`, `same as row <n>`, `already saved` or `skipped`, as the import's report says. */
  readonly outcome: string;
  /** The code the row was given; null when it was skipped. */
  readonly code: string | null;
  /** Why it was skipped; null otherwise. */
  readonly reason: string | null;
  readonly facts: readonly RowFact[];
  readonly leftOut: readonly string[];
  /** The reader's notes, and anything else the report flags. */
  readonly flags: readonly string[];
  /** Each fact the save rules refused, with the reason. */
  readonly dropped: readonly string[];
  readonly categoryAgrees: boolean | null;
}

export interface ImportedRow {
  /** The workbook's own row number. */
  readonly row: number;
  /** The Spec ID it was imported into; null when it was skipped. */
  readonly specId: string | null;
  readonly cells: ImportedCells;
  readonly reading: ImportedReading;
  readonly importedAt: Date;
}

/** The rows of the last import with --write. Every such import replaces them all. */
export interface ImportedRowRepository {
  replace(rows: readonly ImportedRow[]): Promise<void>;
  /** Every row, by row number. */
  all(): Promise<ImportedRow[]>;
}
