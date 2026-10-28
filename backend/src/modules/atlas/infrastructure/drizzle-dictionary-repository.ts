import { desc, eq } from 'drizzle-orm';
import type { Database } from '../../../shared/infrastructure/database/connection.js';
import type { Dictionary } from '../domain/dictionary.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import { atlasDictionaryChanges } from './atlas-dictionary-changes.table.js';
import {
  atlasDictionaryReleases,
  atlasDictionaryRenames,
  atlasDictionaryRetiredNumbers,
  atlasDictionarySearchWords,
  atlasDictionaryValues,
  atlasSlotRules,
} from './atlas-dictionary.table.js';
import { toDomain } from './dictionary.mapper.js';

/**
 * Reads a dictionary release. The live release also carries what approved
 * changes renamed, the search words they gave, the numbers of options they
 * deleted (ADR 0032), and the latest change (ADR 0031); only the dictionary
 * change store writes any of it.
 */
export class DrizzleDictionaryRepository implements DictionaryRepository {
  constructor(private readonly db: Database) {}

  async get(release: string): Promise<Dictionary | null> {
    const [releaseRow] = await this.db
      .select()
      .from(atlasDictionaryReleases)
      .where(eq(atlasDictionaryReleases.release, release));
    if (!releaseRow) return null;

    const live = release === CURRENT_RELEASE;
    // The latest change first: everything read after it is at least as new, so
    // an approval landing in between leaves a plan the change store refuses,
    // never one that writes the older dictionary back.
    const [latest] = live
      ? await this.db
          .select({ number: atlasDictionaryChanges.number, at: atlasDictionaryChanges.approvedAt })
          .from(atlasDictionaryChanges)
          .orderBy(desc(atlasDictionaryChanges.number))
          .limit(1)
      : [];
    const [values, rules, renames, searchWords, retired] = await Promise.all([
      this.db.select().from(atlasDictionaryValues).where(eq(atlasDictionaryValues.release, release)),
      this.db.select().from(atlasSlotRules).where(eq(atlasSlotRules.release, release)),
      live ? this.db.select().from(atlasDictionaryRenames) : Promise.resolve([]),
      live ? this.db.select().from(atlasDictionarySearchWords) : Promise.resolve([]),
      live ? this.db.select().from(atlasDictionaryRetiredNumbers) : Promise.resolve([]),
    ]);
    return toDomain(releaseRow, values, rules, { renames, searchWords, retired, latest: latest ?? null });
  }
}
