import type { Dictionary } from '../../domain/dictionary.js';
import type { DictionaryRepository } from '../../domain/dictionary-repository.js';
import { s2Dictionary } from '../../domain/testing/s2-dictionary.js';

/** The DictionaryRepository contract, in memory, holding S1 0.1.0. A test double, never used in production. */
export class InMemoryDictionaryRepository implements DictionaryRepository {
  private readonly dictionary = s2Dictionary();

  async get(release: string): Promise<Dictionary | null> {
    return release === this.dictionary.release ? this.dictionary : null;
  }
}
