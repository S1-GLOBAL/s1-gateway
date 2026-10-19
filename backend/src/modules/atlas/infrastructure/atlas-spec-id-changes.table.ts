import { sql } from 'drizzle-orm';
import { check, foreignKey, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { accountsTable } from '../../accounts/index.js';
import { atlasSpecIds } from './atlas-spec-ids.table.js';

/*
 * Every change to a saved Spec ID: who, when, and the code and
 * name before and after. Rows are only ever inserted (ADR 0022). Which slots
 * changed is worked out by comparing the two codes, so nothing else is stored.
 */
export const atlasSpecIdChanges = pgTable(
  'atlas_spec_id_changes',
  {
    id: uuid('id').primaryKey(),
    specId: uuid('spec_id').notNull(),
    kind: varchar('kind', { length: 16 }).notNull(),
    changedBy: uuid('changed_by').notNull(),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull(),
    /** Null for `created`. */
    codeBefore: varchar('code_before', { length: 97 }),
    codeAfter: varchar('code_after', { length: 97 }).notNull(),
    /** Null for `created`. */
    nameBefore: varchar('name_before', { length: 120 }),
    nameAfter: varchar('name_after', { length: 120 }).notNull(),
  },
  (table) => [
    foreignKey({ name: 'atlas_spec_id_changes_spec_id_fk', columns: [table.specId], foreignColumns: [atlasSpecIds.id] }),
    foreignKey({
      name: 'atlas_spec_id_changes_changed_by_fk',
      columns: [table.changedBy],
      foreignColumns: [accountsTable.id],
    }),
    check('atlas_spec_id_changes_kind_check', sql`${table.kind} in ('created', 'updated')`),
    index('atlas_spec_id_changes_spec_id_changed_at_idx').on(table.specId, table.changedAt),
    // A pasted old code finds the Spec IDs it once belonged to.
    index('atlas_spec_id_changes_code_before_idx').on(table.codeBefore),
  ],
);
