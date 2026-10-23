import { sql } from 'drizzle-orm';
import { check, foreignKey, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { accountsTable } from '../../accounts/index.js';
import { atlasManufacturers } from './atlas-manufacturers.table.js';
import { atlasSpecIds } from './atlas-spec-ids.table.js';

/*
 * Every change an admin made to a manufacturer's stage on a Spec ID: who,
 * when, and the stage before and after (#57). Rows are only ever inserted;
 * the newest one is the current stage, and a null `stage_after` hands the
 * stage back to the quotes. The import never touches this table.
 */
export const atlasManufacturerStageChanges = pgTable(
  'atlas_manufacturer_stage_changes',
  {
    id: uuid('id').primaryKey(),
    specId: uuid('spec_id').notNull(),
    manufacturerId: uuid('manufacturer_id').notNull(),
    /** Null when no admin had set a stage. */
    stageBefore: varchar('stage_before', { length: 16 }),
    /** Null is a cleared stage. */
    stageAfter: varchar('stage_after', { length: 16 }),
    changedBy: uuid('changed_by').notNull(),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    foreignKey({ name: 'atlas_manufacturer_stage_changes_spec_id_fk', columns: [table.specId], foreignColumns: [atlasSpecIds.id] }),
    foreignKey({
      name: 'atlas_manufacturer_stage_changes_manufacturer_id_fk',
      columns: [table.manufacturerId],
      foreignColumns: [atlasManufacturers.id],
    }),
    foreignKey({
      name: 'atlas_manufacturer_stage_changes_changed_by_fk',
      columns: [table.changedBy],
      foreignColumns: [accountsTable.id],
    }),
    check(
      'atlas_manufacturer_stage_changes_stage_check',
      sql`(${table.stageBefore} is null or ${table.stageBefore} in ('sampling', 'in-production')) and (${table.stageAfter} is null or ${table.stageAfter} in ('sampling', 'in-production'))`,
    ),
    // A manufacturer's newest change on a Spec ID.
    index('atlas_stage_changes_spec_manufacturer_idx').on(table.specId, table.manufacturerId, table.changedAt),
  ],
);
