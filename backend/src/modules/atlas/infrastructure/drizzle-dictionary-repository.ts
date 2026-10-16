import { eq } from 'drizzle-orm';
import type { Database } from '../../../shared/infrastructure/database/connection.js';
import type { Dictionary } from '../domain/dictionary.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { atlasDictionaryReleases, atlasDictionaryValues, atlasSlotRules } from './atlas-dictionary.table.js';
import { toDomain } from './dictionary.mapper.js';

/** Reads the dictionary the migrations loaded. It only ever selects (ADR 0021). */
export class DrizzleDictionaryRepository implements DictionaryRepository {
  constructor(private readonly db: Database) {}

  async get(release: string): Promise<Dictionary | null> {
    const [releaseRow] = await this.db
      .select()
      .from(atlasDictionaryReleases)
      .where(eq(atlasDictionaryReleases.release, release));
    if (!releaseRow) return null;

    const [values, rules] = await Promise.all([
      this.db.select().from(atlasDictionaryValues).where(eq(atlasDictionaryValues.release, release)),
      this.db.select().from(atlasSlotRules).where(eq(atlasSlotRules.release, release)),
    ]);
    return toDomain(releaseRow, values, rules);
  }
}
