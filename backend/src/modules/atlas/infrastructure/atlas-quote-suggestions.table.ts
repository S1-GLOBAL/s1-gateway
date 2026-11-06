import { sql } from 'drizzle-orm';
import { check, foreignKey, index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { accountsTable } from '../../accounts/index.js';
import { atlasManufacturers } from './atlas-manufacturers.table.js';
import { atlasSpecIds } from './atlas-spec-ids.table.js';

/*
 * Quotations added in Atlas, waiting for an admin or decided (ADR 0035). A row
 * is updated as its suggester edits it and as it is decided; every step is
 * also recorded, never changed, in `atlas_quote_suggestion_events`. Its
 * manufacturer is one chosen, by id, or a new one, by name and country.
 */
export const atlasQuoteSuggestions = pgTable(
  'atlas_quote_suggestions',
  {
    id: uuid('id').primaryKey(),
    specId: uuid('spec_id').notNull(),
    /** A manufacturer already in Atlas; null when the quotation names a new one. */
    manufacturerId: uuid('manufacturer_id'),
    /** A new manufacturer's name, as written; null when one is chosen. */
    manufacturerName: varchar('manufacturer_name', { length: 120 }),
    manufacturerCountry: varchar('manufacturer_country', { length: 60 }),
    itemName: text('item_name'),
    fobPerUnit: text('fob_per_unit').notNull(),
    fobPerCase: text('fob_per_case'),
    fobTotal: text('fob_total'),
    moldCost: text('mold_cost'),
    moldLeadTime: text('mold_lead_time'),
    sampleLeadTime: text('sample_lead_time'),
    productionLeadTime: text('production_lead_time'),
    state: varchar('state', { length: 16 }).notNull(),
    /** Raised on each edit, so an approval decides what the approver saw. */
    version: integer('version').notNull().default(1),
    suggestedBy: uuid('suggested_by').notNull(),
    suggestedAt: timestamp('suggested_at', { withTimezone: true }).notNull(),
    /** Who approved or rejected it. */
    decidedBy: uuid('decided_by'),
    /** When it was approved, rejected or withdrawn. */
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    /** Why it was rejected. */
    reason: varchar('reason', { length: 500 }),
    /**
     * The quote it became, once approved. It mirrors `atlas_quotes.suggestion_id`,
     * which holds the foreign key: one each way would make each table's type
     * depend on the other's.
     */
    quoteId: uuid('quote_id'),
  },
  (table) => [
    foreignKey({ name: 'atlas_quote_suggestions_spec_id_fk', columns: [table.specId], foreignColumns: [atlasSpecIds.id] }),
    foreignKey({
      name: 'atlas_quote_suggestions_manufacturer_id_fk',
      columns: [table.manufacturerId],
      foreignColumns: [atlasManufacturers.id],
    }),
    foreignKey({ name: 'atlas_quote_suggestions_suggested_by_fk', columns: [table.suggestedBy], foreignColumns: [accountsTable.id] }),
    foreignKey({ name: 'atlas_quote_suggestions_decided_by_fk', columns: [table.decidedBy], foreignColumns: [accountsTable.id] }),
    // A manufacturer chosen, or one named: never both, never neither.
    check(
      'atlas_quote_suggestions_manufacturer_check',
      sql`(${table.manufacturerId} is not null and ${table.manufacturerName} is null and ${table.manufacturerCountry} is null)
        or (${table.manufacturerId} is null and ${table.manufacturerName} is not null)`,
    ),
    check('atlas_quote_suggestions_state_check', sql`${table.state} in ('waiting', 'approved', 'rejected', 'withdrawn')`),
    // As a dictionary suggestion's (ADR 0031); only an approval has a quote.
    check(
      'atlas_quote_suggestions_decision_check',
      sql`(${table.state} = 'waiting' and ${table.decidedBy} is null and ${table.decidedAt} is null and ${table.reason} is null and ${table.quoteId} is null)
        or (${table.state} = 'withdrawn' and ${table.decidedBy} is null and ${table.decidedAt} is not null and ${table.reason} is null and ${table.quoteId} is null)
        or (${table.state} = 'approved' and ${table.decidedBy} is not null and ${table.decidedAt} is not null and ${table.reason} is null and ${table.quoteId} is not null)
        or (${table.state} = 'rejected' and ${table.decidedBy} is not null and ${table.decidedAt} is not null and ${table.reason} is not null and ${table.quoteId} is null)`,
    ),
    index('atlas_quote_suggestions_state_idx').on(table.state, table.suggestedAt),
    // A Spec ID's quotations, on its manufacturers screen.
    index('atlas_quote_suggestions_spec_id_idx').on(table.specId, table.state),
  ],
);
