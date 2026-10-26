import { sql } from 'drizzle-orm';
import { check, foreignKey, index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { accountsTable } from '../../accounts/index.js';
import type { Proposal } from '../domain/suggestions/proposal.js';
import { atlasDictionarySuggestions } from './atlas-dictionary-suggestions.table.js';

/*
 * Every step in a suggestion's trail (#95): suggested, each edit with what it
 * said before and after, withdrawn, approved, rejected with the reason. Rows
 * are only ever inserted.
 */
export const atlasDictionarySuggestionEvents = pgTable(
  'atlas_dictionary_suggestion_events',
  {
    id: uuid('id').primaryKey(),
    suggestionId: uuid('suggestion_id').notNull(),
    kind: varchar('kind', { length: 16 }).notNull(),
    by: uuid('by').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull(),
    /** An edit's proposal before it. */
    proposalBefore: jsonb('proposal_before').$type<Proposal>(),
    /** What a suggestion or an edit asks for. */
    proposalAfter: jsonb('proposal_after').$type<Proposal>(),
    /** A rejection's reason. */
    reason: varchar('reason', { length: 500 }),
  },
  (table) => [
    foreignKey({
      name: 'atlas_dictionary_suggestion_events_suggestion_id_fk',
      columns: [table.suggestionId],
      foreignColumns: [atlasDictionarySuggestions.id],
    }),
    foreignKey({
      name: 'atlas_dictionary_suggestion_events_by_fk',
      columns: [table.by],
      foreignColumns: [accountsTable.id],
    }),
    check(
      'atlas_dictionary_suggestion_events_kind_check',
      sql`${table.kind} in ('suggested', 'edited', 'withdrawn', 'approved', 'rejected')`,
    ),
    index('atlas_dictionary_suggestion_events_suggestion_idx').on(table.suggestionId, table.at),
  ],
);
