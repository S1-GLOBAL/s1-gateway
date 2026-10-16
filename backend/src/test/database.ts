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

/** Empties every table. Add each new table here. */
export async function resetTables(db: Database): Promise<void> {
  await db.execute(
    sql`truncate table atlas_spec_ids, password_reset_tokens, sessions, accounts, tools restart identity cascade`,
  );
}
