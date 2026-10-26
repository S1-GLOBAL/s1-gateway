import { sql } from 'drizzle-orm';
import {
  connectDatabase,
  type Database,
  type DatabaseConnection,
} from '../shared/infrastructure/database/connection.js';

export function connectTestDatabase(): DatabaseConnection {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL was not set by vitest.config.ts.');
  return connectDatabase(url);
}

/**
 * Empties every table the application fills, and puts the dictionary back as
 * the migrations made it (ADR 0031: approving a suggestion changes it). Add
 * each new table here.
 */
export async function resetTables(db: Database): Promise<void> {
  await db.execute(
    sql`truncate table account_invites, atlas_dictionary_renames, atlas_dictionary_search_words, atlas_dictionary_changes, atlas_dictionary_suggestion_events, atlas_dictionary_suggestions, atlas_manufacturer_stage_changes, atlas_quotes, atlas_manufacturers, atlas_spec_id_changes, atlas_spec_ids, password_reset_tokens, sessions, accounts, tools restart identity cascade`,
  );
  await restoreDictionary(db);
}

/** The dictionary's two tables, and the copies `global-setup.ts` takes of them after migrating. */
const DICTIONARY_COPIES = [
  ['atlas_dictionary_values', 'atlas_dictionary_values_seed'],
  ['atlas_slot_rules', 'atlas_slot_rules_seed'],
] as const;

/** Puts the dictionary back as the migrations made it, from the copies taken after migrating. */
export async function restoreDictionary(db: Database): Promise<void> {
  for (const [table, copy] of DICTIONARY_COPIES) {
    await db.execute(sql.raw(`delete from ${table}`));
    await db.execute(sql.raw(`insert into ${table} select * from ${copy}`));
  }
}

/**
 * Called by `global-setup.ts`: before migrating, undoes what a run that
 * stopped mid-test left in the dictionary; after migrating, copies the
 * dictionary as the migrations made it. Test database only.
 */
export const dictionarySeedSql = {
  restoreIfCopied: DICTIONARY_COPIES.map(
    ([table, copy]) =>
      `do $$ begin if to_regclass('${copy}') is not null then delete from ${table}; insert into ${table} select * from ${copy}; end if; end $$`,
  ),
  copy: DICTIONARY_COPIES.flatMap(([table, copy]) => [
    `drop table if exists ${copy}`,
    `create table ${copy} as select * from ${table}`,
  ]),
} as const;
