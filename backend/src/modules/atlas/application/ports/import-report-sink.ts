/** What happened to one row: a new Spec ID, the same code as an earlier row, one already saved, or skipped. */
export type RowOutcome = 'new' | `same as row ${number}` | 'already saved' | 'skipped';

/** One line of #28's report, per workbook row. */
export interface ImportReportRow {
  readonly row: number;
  /** As the workbook wrote it. */
  readonly itemName: string;
  readonly outcome: RowOutcome;
  /** Null when skipped. */
  readonly code: string | null;
  /** Why it was skipped; null otherwise. */
  readonly reason: string | null;
  /** Every fact read from the item name, `Colour / clarity: Clear`, a ruling's name after one read under it. */
  readonly readFromRow: readonly string[];
  /** Every fact the save rules refused, with the reason. */
  readonly dropped: readonly string[];
  /** Anything else to check, such as a name cut to fit. */
  readonly flags: readonly string[];
}

export interface ImportSummary {
  /** Every product row read: a row with an item name. */
  readonly rows: number;
  /** Spec IDs created, or that a dry run would create. */
  readonly created: number;
  /** Codes that were already saved before this run. */
  readonly alreadySaved: number;
  readonly skipped: number;
  /** On rows where both the columns and the item name give a product type or material: how many agreed. */
  readonly agreement: { readonly agreed: number; readonly compared: number };
}

export interface ImportReport {
  readonly summary: ImportSummary;
  readonly rows: readonly ImportReportRow[];
}

/** Where the import writes its report. It never enters the repository (#28, ADR 0027). */
export interface ImportReportSink {
  write(report: ImportReport): Promise<void>;
}
