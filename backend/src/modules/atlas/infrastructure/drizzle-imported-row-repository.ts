import { asc } from 'drizzle-orm';
import type { Database } from '../../../shared/infrastructure/database/connection.js';
import type { ImportedRow, ImportedRowRepository } from '../domain/import/imported-row.js';
import { atlasImportedRows } from './atlas-imported-rows.table.js';

/** Rows per insert: well under Postgres's limit on bound parameters. */
const CHUNK = 500;

/** The last import's rows, replaced whole in one transaction (plan 0014). */
export class DrizzleImportedRowRepository implements ImportedRowRepository {
  constructor(private readonly db: Database) {}

  async replace(rows: readonly ImportedRow[]): Promise<void> {
    const values = rows.map(({ row, specId, cells, reading, importedAt }) => ({ row, specId, ...cells, reading, importedAt }));
    await this.db.transaction(async (tx) => {
      await tx.delete(atlasImportedRows);
      for (let start = 0; start < values.length; start += CHUNK) {
        await tx.insert(atlasImportedRows).values(values.slice(start, start + CHUNK));
      }
    });
  }

  async all(): Promise<ImportedRow[]> {
    const rows = await this.db.select().from(atlasImportedRows).orderBy(asc(atlasImportedRows.row));
    return rows.map(({ row, specId, itemName, category, material, materialType, dimension, weight, printing, reading, importedAt }) => ({
      row,
      specId,
      cells: { itemName, category, material, materialType, dimension, weight, printing },
      reading,
      importedAt,
    }));
  }
}
