import { sql } from 'drizzle-orm';
import { pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const tools = pgTable(
  'tools',
  {
    id: uuid('id').primaryKey(),
    name: varchar('name', { length: 80 }).notNull(),
    url: varchar('url', { length: 2048 }).notNull(),
    description: varchar('description', { length: 280 }).notNull().default(''),
    category: varchar('category', { length: 40 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    // Names are unique ignoring case. Only the database can enforce that
    // against two simultaneous requests.
    uniqueIndex('tools_name_lower_unique').on(sql`lower(${table.name})`),
  ],
);
