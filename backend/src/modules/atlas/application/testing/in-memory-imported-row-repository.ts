import type { ImportedRow, ImportedRowRepository } from '../../domain/import/imported-row.js';

/** The last import's rows, in memory. For tests only. */
export class InMemoryImportedRowRepository implements ImportedRowRepository {
  rows: ImportedRow[] = [];

  async replace(rows: readonly ImportedRow[]): Promise<void> {
    this.rows = [...rows];
  }

  async all(): Promise<ImportedRow[]> {
    return [...this.rows].sort((a, b) => a.row - b.row);
  }
}
