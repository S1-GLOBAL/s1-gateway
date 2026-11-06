import { foreignKey, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { atlasManufacturers } from './atlas-manufacturers.table.js';
import { atlasQuoteSuggestions } from './atlas-quote-suggestions.table.js';
import { atlasSpecIds } from './atlas-spec-ids.table.js';

/*
 * One row of the verified list linked to a Spec ID: its manufacturer and
 * what it quotes, each value as the workbook shows it, null when the cell is
 * empty (ADR 0027); or a quotation approved in Atlas, with the quotation it
 * came from (ADR 0035). Every import with --write replaces its own, and keeps
 * those approved in Atlas.
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
    /** When it was recorded: imported, or approved in Atlas. */
    importedAt: timestamp('imported_at', { withTimezone: true }).notNull(),
    /** The quotation it was approved from; null for a quote the import recorded. */
    suggestionId: uuid('suggestion_id'),
  },
  (table) => [
    foreignKey({ name: 'atlas_quotes_spec_id_fk', columns: [table.specId], foreignColumns: [atlasSpecIds.id] }),
    foreignKey({
      name: 'atlas_quotes_manufacturer_id_fk',
      columns: [table.manufacturerId],
      foreignColumns: [atlasManufacturers.id],
    }),
    foreignKey({
      name: 'atlas_quotes_suggestion_id_fk',
      columns: [table.suggestionId],
      foreignColumns: [atlasQuoteSuggestions.id],
    }),
    // One quote per approved quotation.
    uniqueIndex('atlas_quotes_suggestion_id_unique').on(table.suggestionId),
    // A Spec ID's manufacturers (#57).
    index('atlas_quotes_spec_id_idx').on(table.specId),
    index('atlas_quotes_manufacturer_id_idx').on(table.manufacturerId),
  ],
);
