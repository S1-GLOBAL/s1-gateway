import { foreignKey, integer, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { accountsTable } from '../../accounts/index.js';
import { atlasDictionarySuggestions } from './atlas-dictionary-suggestions.table.js';

/**
 * One row per approved suggestion: dictionary change #1, #2, #3… with no gaps.
 * The next number is the last plus one, taken under the approval's lock.
 */
export const atlasDictionaryChanges = pgTable(
  'atlas_dictionary_changes',
  {
    number: integer('number').primaryKey(),
    suggestionId: uuid('suggestion_id').notNull(),
    approvedBy: uuid('approved_by').notNull(),
    approvedAt: timestamp('approved_at', { withTimezone: true }).notNull(),
    /** How many saved Spec IDs the approval rewrote. */
    specIdsRewritten: integer('spec_ids_rewritten').notNull(),
  },
  (table) => [
    foreignKey({
      name: 'atlas_dictionary_changes_suggestion_id_fk',
      columns: [table.suggestionId],
      foreignColumns: [atlasDictionarySuggestions.id],
    }),
    foreignKey({
      name: 'atlas_dictionary_changes_approved_by_fk',
      columns: [table.approvedBy],
      foreignColumns: [accountsTable.id],
    }),
    uniqueIndex('atlas_dictionary_changes_suggestion_id_unique').on(table.suggestionId),
  ],
);
