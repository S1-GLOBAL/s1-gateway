import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/*
 * The companies the verified list names, one per name compared trimmed and
 * ignoring case (ADR 0027). The import finds or adds them; nothing deletes
 * one, because #57's stages point at them.
 */
export const atlasManufacturers = pgTable(
  'atlas_manufacturers',
  {
    id: uuid('id').primaryKey(),
    /** As first written. */
    name: text('name').notNull(),
    /** The name trimmed and lower-cased: the manufacturer's identity. */
    nameKey: text('name_key').notNull(),
    country: text('country'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex('atlas_manufacturers_name_key_unique').on(table.nameKey)],
);
