import type { ImportReport } from './import-report-sink.js';

/** Writes the review workbook (plan 0013) to bytes, for Atlas to hand out as a download (plan 0014). */
export interface ReviewSheetWriter {
  toBytes(report: ImportReport): Promise<Uint8Array>;
}
