import type { VerifiedRow } from '../../domain/import/verified-row.js';

/** Where the import reads the verified list: every product row, in workbook order. */
export interface VerifiedListSource {
  rows(): Promise<VerifiedRow[]>;
}
