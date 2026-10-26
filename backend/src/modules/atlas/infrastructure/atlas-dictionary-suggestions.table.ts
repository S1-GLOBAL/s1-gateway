import { sql } from 'drizzle-orm';
import { check, foreignKey, index, integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { accountsTable } from '../../accounts/index.js';
import type { Proposal } from '../domain/suggestions/proposal.js';

/*
 * Changes to the dictionary someone suggested (#95, ADR 0031). A row is
 * updated as its suggester edits it and as it is decided; every step is also
 * recorded, never changed, in `atlas_dictionary_suggestion_events`.
 */
export const atlasDictionarySuggestions = pgTable(
  'atlas_dictionary_suggestions',
  {
    id: uuid('id').primaryKey(),
    kind: varchar('kind', { length: 16 }).notNull(),
    /** A dictionary slot key; `productType` for a rules change. */
    slot: varchar('slot', { length: 32 }).notNull(),
    /** The option it is about: the new code for an add, the product type for a rules change. */
    code: varchar('code', { length: 5 }).notNull(),
    /** What it asks for, by kind. Replaced on each edit. */
    proposal: jsonb('proposal').$type<Proposal>().notNull(),
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
    /** The dictionary change it became; its foreign key comes with that table (plan 0010, phase 2). */
    changeNumber: integer('change_number'),
  },
  (table) => [
    foreignKey({
      name: 'atlas_dictionary_suggestions_suggested_by_fk',
      columns: [table.suggestedBy],
      foreignColumns: [accountsTable.id],
    }),
    foreignKey({
      name: 'atlas_dictionary_suggestions_decided_by_fk',
      columns: [table.decidedBy],
      foreignColumns: [accountsTable.id],
    }),
    check('atlas_dictionary_suggestions_kind_check', sql`${table.kind} in ('add', 'edit', 'delete', 'rules')`),
    check(
      'atlas_dictionary_suggestions_state_check',
      sql`${table.state} in ('waiting', 'approved', 'rejected', 'withdrawn')`,
    ),
    // Waiting has no decision; withdrawn has a time but no decider; approved and rejected name who decided; only a rejection has a reason.
    check(
      'atlas_dictionary_suggestions_decision_check',
      sql`(${table.state} = 'waiting' and ${table.decidedBy} is null and ${table.decidedAt} is null and ${table.reason} is null)
        or (${table.state} = 'withdrawn' and ${table.decidedBy} is null and ${table.decidedAt} is not null and ${table.reason} is null)
        or (${table.state} = 'approved' and ${table.decidedBy} is not null and ${table.decidedAt} is not null and ${table.reason} is null)
        or (${table.state} = 'rejected' and ${table.decidedBy} is not null and ${table.decidedAt} is not null and ${table.reason} is not null)`,
    ),
    index('atlas_dictionary_suggestions_state_idx').on(table.state, table.suggestedAt),
  ],
);
