import type { RowFact } from '../../domain/import/verified-row.js';

/** What happened to one row: a new Spec ID, the same code as an earlier row, one already saved, or skipped. */
export type RowOutcome = 'new' | `same as row ${number}` | 'already saved' | 'skipped';

/** The cells a row's code is read from, as the workbook wrote them. */
export interface ImportSourceCells {
  readonly itemName: string;
  readonly category: string;
  readonly material: string;
  readonly materialType: string;
  readonly dimension: string;
  readonly weight: string;
  readonly printing: string;
}

/** One line of #28's report, per workbook row. */
export interface ImportReportRow {
  readonly row: number;
  /** As the workbook wrote it. */
  readonly itemName: string;
  /** Every cell the code is read from, so a reviewer can compare it with what was read (plan 0013). */
  readonly source: ImportSourceCells;
  /** Each fact the code holds, with the words and the cell it was read from; none when skipped. */
  readonly facts: readonly RowFact[];
  /** The words no rule used, as Search lists them under Left out; none when skipped. */
  readonly leftOut: readonly string[];
  /** Whether the Category column names the product type read from the rest; null when it can't be compared. */
  readonly categoryAgrees: boolean | null;
  readonly outcome: RowOutcome;
  /** Null when skipped. */
  readonly code: string | null;
  /** Why it was skipped; null otherwise. */
  readonly reason: string | null;
  /** Every fact read from the item name or under a ruling, as `Colour / clarity: Clear`, with the ruling's name after one read under it. */
  readonly readFromRow: readonly string[];
  /** Every fact the save rules refused, with the reason. */
  readonly dropped: readonly string[];
  /** Whether the row names its manufacturer: COMPANY, in the block above it (#56). */
  readonly manufacturer: 'found' | 'no manufacturer';
  /** Whether the row's quote is recorded against its Spec ID: it has a manufacturer and is not skipped (#56). */
  readonly quote: 'recorded' | 'not recorded';
  /** Anything else to check, such as a name cut to fit. */
  readonly flags: readonly string[];
}

export interface ImportSummary {
  /** Every product row read: a row with an item name. */
  readonly rows: number;
  /** Spec IDs created, or that a dry run would create. */
  readonly created: number;
  /** Rows with the same code as an earlier row, which add no Spec ID of their own. */
  readonly sameAs: number;
  /** Codes that were already saved before this run. */
  readonly alreadySaved: number;
  readonly skipped: number;
  /** Manufacturers with at least one quote recorded, or that a dry run would record. */
  readonly manufacturers: number;
  /** Quotes recorded, or that a dry run would record: one per row with a manufacturer that is not skipped. */
  readonly quotes: number;
  /** On rows where both the columns and the item name give a product type or material: how many agreed. */
  readonly agreement: { readonly agreed: number; readonly compared: number };
}

/** One dictionary option as a code writes it: Material, `B25`, Molded fibre, bagasse. */
export interface ImportReportOption {
  readonly list: string;
  readonly part: string;
  readonly meaning: string;
}

export interface ImportReport {
  readonly summary: ImportSummary;
  readonly rows: readonly ImportReportRow[];
  /** Every option of the dictionary the codes were read with, list by list, so a reader can decode a code. */
  readonly options: readonly ImportReportOption[];
}

/** Where the import writes its report. It never enters the repository (#28, ADR 0027). */
export interface ImportReportSink {
  write(report: ImportReport): Promise<void>;
}
