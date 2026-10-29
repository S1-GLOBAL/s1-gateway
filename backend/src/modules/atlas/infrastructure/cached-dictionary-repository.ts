import type { Dictionary, DictionaryChangeStamp } from '../domain/dictionary.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { CURRENT_RELEASE } from '../domain/slots.js';

/** A dictionary repository that can also answer the latest approved change alone, as the Drizzle one does. */
export interface DictionarySource extends DictionaryRepository {
  latestChange(): Promise<DictionaryChangeStamp | null>;
}

/**
 * The live dictionary, kept in memory between requests. Each request still
 * asks the database for the latest approved change, one row, and reads the
 * whole release again only when that has moved: an approval on this API or
 * any other, or a database put back as the migrations made it. A migration
 * changes the dictionary only at a deploy, which starts a new process. A
 * Dictionary is never changed once built, so one copy serves every request.
 * Older releases are read as they always were.
 */
export class CachedDictionaryRepository implements DictionaryRepository {
  private live: { readonly dictionary: Dictionary; readonly change: DictionaryChangeStamp | null } | null = null;

  constructor(private readonly source: DictionarySource) {}

  async get(release: string): Promise<Dictionary | null> {
    if (release !== CURRENT_RELEASE) return this.source.get(release);
    const latest = await this.source.latestChange();
    if (this.live && sameChange(this.live.change, latest)) return this.live.dictionary;

    const dictionary = await this.source.get(release);
    // Kept under the change it was read at, which may be newer than `latest`.
    this.live = dictionary ? { dictionary, change: dictionary.change } : null;
    return dictionary;
  }
}

function sameChange(a: DictionaryChangeStamp | null, b: DictionaryChangeStamp | null): boolean {
  if (a === null || b === null) return a === b;
  return a.number === b.number && a.at.getTime() === b.at.getTime();
}
