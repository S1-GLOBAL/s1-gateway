import { foreignKey, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { ImportedReading } from '../domain/import/imported-row.js';
import { atlasSpecIds } from './atlas-spec-ids.table.js';

/*
 * Each row of the verified list as the last import with --write read it
 * (plan 0014): its cells as the workbook wrote them, and what was read from
 * them, so Atlas can hand out the review workbook without reading the list
 * again. Every such import replaces them all. Like the quotes, they hold
 * Source One text, and live only in the database (ADR 0027).
 */
export const atlasImportedRows = pgTable(
  'atlas_imported_rows',
  {
    /** The workbook's own row number. */
    row: integer('row').primaryKey(),
    /** The Spec ID the row was imported into; null when it was skipped. */
    specId: uuid('spec_id'),
    itemName: text('item_name').notNull(),
    category: text('category').notNull(),
    material: text('material').notNull(),
    materialType: text('material_type').notNull(),
    dimension: text('dimension').notNull(),
    weight: text('weight').notNull(),
    printing: text('printing').notNull(),
    /** What was read from the cells, as the review workbook shows it. */
    reading: jsonb('reading').$type<ImportedReading>().notNull(),
    importedAt: timestamp('imported_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    foreignKey({ name: 'atlas_imported_rows_spec_id_fk', columns: [table.specId], foreignColumns: [atlasSpecIds.id] }),
    index('atlas_imported_rows_spec_id_idx').on(table.specId),
  ],
);
