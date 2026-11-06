import { sql } from 'drizzle-orm';
import { check, foreignKey, index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { accountsTable } from '../../accounts/index.js';
import type { QuoteProposal } from '../domain/sourcing/quote-suggestion.js';
import { atlasQuoteSuggestions } from './atlas-quote-suggestions.table.js';

/*
 * Every step in a quotation's trail (ADR 0035): added, each edit with what it
 * said before and after, withdrawn, approved, rejected with the reason. Rows
 * are only ever inserted.
 */
export const atlasQuoteSuggestionEvents = pgTable(
  'atlas_quote_suggestion_events',
  {
    id: uuid('id').primaryKey(),
    suggestionId: uuid('suggestion_id').notNull(),
    kind: varchar('kind', { length: 16 }).notNull(),
    by: uuid('by').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull(),
    /** An edit's proposal before it. */
    proposalBefore: jsonb('proposal_before').$type<QuoteProposal>(),
    /** What an addition or an edit asks for. */
    proposalAfter: jsonb('proposal_after').$type<QuoteProposal>(),
    /** A rejection's reason. */
    reason: varchar('reason', { length: 500 }),
  },
  (table) => [
    foreignKey({
      name: 'atlas_quote_suggestion_events_suggestion_id_fk',
      columns: [table.suggestionId],
      foreignColumns: [atlasQuoteSuggestions.id],
    }),
    foreignKey({ name: 'atlas_quote_suggestion_events_by_fk', columns: [table.by], foreignColumns: [accountsTable.id] }),
    check('atlas_quote_suggestion_events_kind_check', sql`${table.kind} in ('suggested', 'edited', 'withdrawn', 'approved', 'rejected')`),
    index('atlas_quote_suggestion_events_suggestion_idx').on(table.suggestionId, table.at),
  ],
);
