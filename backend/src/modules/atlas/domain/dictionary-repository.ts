import type { Dictionary } from './dictionary.js';

/** Where the Atlas dictionary is read. Only the dictionary change store writes it, on an approval (ADR 0031). */
export interface DictionaryRepository {
  /** One release, such as `S1 0.1.0`, or null when there is no such release. */
  get(release: string): Promise<Dictionary | null>;
}
