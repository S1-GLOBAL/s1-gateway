import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export type Database = PostgresJsDatabase;

export interface DatabaseConnection {
  readonly db: Database;
  close(): Promise<void>;
}

export function connectDatabase(url: string): DatabaseConnection {
  const sql = postgres(url, { max: 10, onnotice: () => undefined });
  return {
    db: drizzle(sql),
    close: () => sql.end({ timeout: 5 }),
  };
}
