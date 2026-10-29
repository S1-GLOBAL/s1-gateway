import { sql } from 'drizzle-orm';
import { check, date, foreignKey, index, integer, pgTable, primaryKey, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { atlasDictionaryChanges } from './atlas-dictionary-changes.table.js';

/*
 * The Atlas dictionary. Release S1 0.1.0 arrived by migration and never
 * changes. The live release, S2 0.1.0, changes only when an admin approves a
 * suggestion (ADR 0031, superseding ADR 0021): only the dictionary change
 * store writes these tables.
 */

export const atlasDictionaryReleases = pgTable('atlas_dictionary_releases', {
  release: varchar('release', { length: 16 }).primaryKey(),
  approvedOn: date('approved_on', { mode: 'string' }).notNull(),
});

export const atlasDictionaryValues = pgTable(
  'atlas_dictionary_values',
  {
    release: varchar('release', { length: 16 }).notNull(),
    slot: varchar('slot', { length: 32 }).notNull(),
    code: varchar('code', { length: 5 }).notNull(),
    meaning: varchar('meaning', { length: 120 }).notNull(),
    /**
     * The option's number in its list, written after the list's letter in a
     * code: `B17` (ADR 0032). Given in the order options were issued, kept
     * through a rename, never given again once deleted. Null only in S1 0.1.0.
     */
    number: integer('number'),
  },
  (table) => [
    primaryKey({ columns: [table.release, table.slot, table.code] }),
    uniqueIndex('atlas_dictionary_values_number_unique').on(table.release, table.slot, table.number),
    // Named here: Drizzle's generated name is longer than Postgres's 63-character limit.
    foreignKey({
      name: 'atlas_dictionary_values_release_fk',
      columns: [table.release],
      foreignColumns: [atlasDictionaryReleases.release],
    }),
    // An all-0 or all-X value would read as a marker.
    check('atlas_dictionary_values_code_not_marker', sql`${table.code} !~ '^(0+|X+)$'`),
  ],
);

export const atlasSlotRules = pgTable(
  'atlas_slot_rules',
  {
    release: varchar('release', { length: 16 }).notNull(),
    productType: varchar('product_type', { length: 3 }).notNull(),
    slot: varchar('slot', { length: 32 }).notNull(),
    rule: varchar('rule', { length: 16 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.release, table.productType, table.slot] }),
    foreignKey({
      name: 'atlas_slot_rules_release_fk',
      columns: [table.release],
      foreignColumns: [atlasDictionaryReleases.release],
    }),
    check(
      'atlas_slot_rules_rule_check',
      sql`${table.rule} in ('applies', 'never', 'round_only', 'non_round_only', 'paper_only')`,
    ),
  ],
);

/**
 * Every code an approved change renamed or deleted, and its live letters now:
 * null once deleted (ADR 0031). Flattened: renaming A to B, then B to C, leaves
 * A → C and B → C, so a lookup is one step. Code that names an S2 0.1.0 code
 * asks this table for its live letters.
 */
export const atlasDictionaryRenames = pgTable(
  'atlas_dictionary_renames',
  {
    slot: varchar('slot', { length: 32 }).notNull(),
    oldCode: varchar('old_code', { length: 5 }).notNull(),
    newCode: varchar('new_code', { length: 5 }),
    /** The change that last moved it. */
    changeNumber: integer('change_number').notNull(),
  },
  (table) => [
    primaryKey({ name: 'atlas_dictionary_renames_pk', columns: [table.slot, table.oldCode] }),
    foreignKey({
      name: 'atlas_dictionary_renames_change_number_fk',
      columns: [table.changeNumber],
      foreignColumns: [atlasDictionaryChanges.number],
    }),
  ],
);

/**
 * Every number whose option an approved change deleted, with the letters and
 * meaning it had (ADR 0032): no new option takes it, and a code written with
 * it still reads. Null `change_number` for one deleted before numbers were
 * stored.
 */
export const atlasDictionaryRetiredNumbers = pgTable(
  'atlas_dictionary_retired_numbers',
  {
    slot: varchar('slot', { length: 32 }).notNull(),
    number: integer('number').notNull(),
    code: varchar('code', { length: 5 }).notNull(),
    meaning: varchar('meaning', { length: 120 }).notNull(),
    changeNumber: integer('change_number'),
  },
  (table) => [
    primaryKey({ name: 'atlas_dictionary_retired_numbers_pk', columns: [table.slot, table.number] }),
    foreignKey({
      name: 'atlas_dictionary_retired_numbers_change_number_fk',
      columns: [table.changeNumber],
      foreignColumns: [atlasDictionaryChanges.number],
    }),
  ],
);

/**
 * Words an approved change gave an option, read in pasted text as that option
 * alongside the word list in the code (ADR 0026, ADR 0031). One meaning per
 * word in each list.
 */
export const atlasDictionarySearchWords = pgTable(
  'atlas_dictionary_search_words',
  {
    slot: varchar('slot', { length: 32 }).notNull(),
    word: varchar('word', { length: 40 }).notNull(),
    code: varchar('code', { length: 5 }).notNull(),
    /** The change that gave it. */
    changeNumber: integer('change_number').notNull(),
  },
  (table) => [
    primaryKey({ name: 'atlas_dictionary_search_words_pk', columns: [table.slot, table.word] }),
    foreignKey({
      name: 'atlas_dictionary_search_words_change_number_fk',
      columns: [table.changeNumber],
      foreignColumns: [atlasDictionaryChanges.number],
    }),
    index('atlas_dictionary_search_words_option_idx').on(table.slot, table.code),
  ],
);
