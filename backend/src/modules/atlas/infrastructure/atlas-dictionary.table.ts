import { sql } from 'drizzle-orm';
import { check, date, foreignKey, pgTable, primaryKey, varchar } from 'drizzle-orm/pg-core';

/*
 * The Atlas dictionary (ADR 0021). Rows arrive only by migration, and nothing in
 * the application updates or deletes one: a published meaning is never
 * reassigned. A new release adds rows under its own `release` key.
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
  },
  (table) => [
    primaryKey({ columns: [table.release, table.slot, table.code] }),
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
