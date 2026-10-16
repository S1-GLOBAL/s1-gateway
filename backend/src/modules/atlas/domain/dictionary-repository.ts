import type { Dictionary } from './dictionary.js';

/** Where the S1 dictionary is kept. Read-only: only migrations add to it (ADR 0021). */
export interface DictionaryRepository {
  /** One release, such as `S1 0.1.0`, or null when there is no such release. */
  get(release: string): Promise<Dictionary | null>;
}
