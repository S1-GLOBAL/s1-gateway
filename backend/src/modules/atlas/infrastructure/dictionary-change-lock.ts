import { max, sql } from 'drizzle-orm';
import type { Database } from '../../../shared/infrastructure/database/connection.js';
import { atlasDictionaryChanges } from './atlas-dictionary-changes.table.js';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * The advisory lock between approving a dictionary change and writing a saved
 * Spec ID (ADR 0031). An approval holds it alone; each save or change of a
 * Spec ID holds it shared. So no Spec ID is written from a dictionary an
 * approval is replacing, and no approval misses a Spec ID being written.
 */
const DICTIONARY_CHANGE_LOCK = 95_031;

/** Holds off every other approval, and every save or change of a Spec ID, until `tx` ends. Answers the latest change. */
export async function lockDictionaryAlone(tx: Transaction): Promise<number | null> {
  await tx.execute(sql`select pg_advisory_xact_lock(${DICTIONARY_CHANGE_LOCK})`);
  return latestChange(tx);
}

/** Waits for an approval under way, and holds off the next until `tx` ends. Answers the latest change. */
export async function lockDictionaryShared(tx: Transaction): Promise<number | null> {
  await tx.execute(sql`select pg_advisory_xact_lock_shared(${DICTIONARY_CHANGE_LOCK})`);
  return latestChange(tx);
}

/** The number of the latest approved dictionary change, or null before the first. */
async function latestChange(tx: Transaction): Promise<number | null> {
  const [latest] = await tx.select({ number: max(atlasDictionaryChanges.number) }).from(atlasDictionaryChanges);
  return latest?.number ?? null;
}
