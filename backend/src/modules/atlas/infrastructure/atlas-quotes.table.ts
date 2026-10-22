import { foreignKey, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { atlasManufacturers } from './atlas-manufacturers.table.js';
import { atlasSpecIds } from './atlas-spec-ids.table.js';

/*
 * One row of the verified list linked to a Spec ID: its manufacturer and
 * what it quotes, each value as the workbook shows it, null when the cell is
 * empty (ADR 0027). Every import with --write replaces them all.
 */
export const atlasQuotes = pgTable(
  'atlas_quotes',
  {
    id: uuid('id').primaryKey(),
    specId: uuid('spec_id').notNull(),
    manufacturerId: uuid('manufacturer_id').notNull(),
    itemName: text('item_name'),
    fobPerUnit: text('fob_per_unit'),
    fobPerCase: text('fob_per_case'),
    fobTotal: text('fob_total'),
    moldCost: text('mold_cost'),
    moldLeadTime: text('mold_lead_time'),
    sampleLeadTime: text('sample_lead_time'),
    productionLeadTime: text('production_lead_time'),
    importedAt: timestamp('imported_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    foreignKey({ name: 'atlas_quotes_spec_id_fk', columns: [table.specId], foreignColumns: [atlasSpecIds.id] }),
    foreignKey({
      name: 'atlas_quotes_manufacturer_id_fk',
      columns: [table.manufacturerId],
      foreignColumns: [atlasManufacturers.id],
    }),
    // A Spec ID's manufacturers (#57).
    index('atlas_quotes_spec_id_idx').on(table.specId),
    index('atlas_quotes_manufacturer_id_idx').on(table.manufacturerId),
  ],
);
