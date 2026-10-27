import type { AtlasDictionary } from '../domain/atlas';

/** One dictionary value a search found, with the slot it belongs to. */
export interface DictionaryHit {
  slotKey: string;
  slotName: string;
  code: string;
  meaning: string;
}

/** How many matches the suggestion list shows. The rest stay in the slot lists. */
export const SUGGESTIONS_SHOWN = 8;

/**
 * Every value whose code or meaning contains `query`, best match first.
 * An exact code comes before a code that starts with the text, then a meaning
 * that starts with it, then any other containing match. An empty query matches
 * nothing: the dictionary is already on screen.
 */
export function searchDictionary(dictionary: AtlasDictionary, query: string): DictionaryHit[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [];

  const hits: DictionaryHit[] = [];
  for (const slot of dictionary.slots) {
    for (const value of slot.values) {
      if (value.code.toLowerCase().includes(needle) || value.meaning.toLowerCase().includes(needle)) {
        hits.push({ slotKey: slot.key, slotName: slot.name, code: value.code, meaning: value.meaning });
      }
    }
  }

  return hits.sort((a, b) => rank(a, needle) - rank(b, needle));
}

function rank(hit: DictionaryHit, needle: string): number {
  const code = hit.code.toLowerCase();
  const meaning = hit.meaning.toLowerCase();
  if (code === needle) return 0;
  if (code.startsWith(needle)) return 1;
  if (meaning.startsWith(needle)) return 2;
  if (code.includes(needle)) return 3;
  return 4;
}
